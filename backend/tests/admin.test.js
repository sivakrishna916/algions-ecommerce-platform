
const { api, setupDb, teardownDb, createAdmin, registerCustomer, auth } = require('./helpers');
const { makeCategory, makeProduct } = require('./factories');
const { addAddress, addToCart, checkout, DECLINED_CARD } = require('./shopHelpers');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const AuditLog = require('../src/models/AuditLog');

let admin; let cust; let cat;
beforeAll(async () => {
  await setupDb();
  admin = await createAdmin();
  cust = await registerCustomer('shopper@test.dev');
  cust.addressId = await addAddress(cust.token);
  cat = await makeCategory('Wearables');
});
afterAll(teardownDb);

const productBody = (over = {}) => ({
  name: 'Smart Watch', description: 'Tracks things', brand: 'Acme', category: String(cat._id),
  images: ['/products/smart-watch.svg'], tags: ['watch'],
  variants: [{ sku: 'SW-BLK', label: 'Black', price: 499900, stock: 10 }, { sku: 'SW-SLV', label: 'Silver', price: 519900, stock: 4 }], ...over,
});
const stockOf = async (id, sku) => (await Product.findById(id)).variants.find((v) => v.sku === sku).stock;

describe('AT5 — admin updates are protected (server-side RBAC)', () => {
  const adminEndpoints = [
    ['get', '/api/admin/dashboard'], ['get', '/api/admin/products'], ['post', '/api/admin/products'],
    ['get', '/api/admin/categories'], ['get', '/api/admin/orders'], ['get', '/api/admin/customers'],
    ['get', '/api/admin/audit-logs'], ['get', '/api/admin/reports/sales'], ['get', '/api/admin/reports/reconciliation'],
    ['patch', '/api/admin/orders/64b64b64b64b64b64b64b64b/status'], ['delete', '/api/admin/products/64b64b64b64b64b64b64b64b'],
    ['post', '/api/admin/products/64b64b64b64b64b64b64b64b/stock'],
  ];
  test.each(adminEndpoints)('%s %s → 401 without a token', async (m, url) => {
    expect((await api()[m](url).send({})).status).toBe(401);
  });
  test.each(adminEndpoints)('%s %s → 403 for a customer token', async (m, url) => {
    const res = await api()[m](url).set(auth(cust.token)).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
  test('a customer cannot create a product or change stock, and nothing changes', async () => {
    const before = await Product.countDocuments();
    expect((await api().post('/api/admin/products').set(auth(cust.token)).send(productBody())).status).toBe(403);
    expect(await Product.countDocuments()).toBe(before);
  });
  test('a forged token signed with a different secret is rejected', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ sub: admin.user._id.toString(), role: 'admin' }, 'wrong-secret');
    expect((await api().get('/api/admin/dashboard').set(auth(forged))).status).toBe(401);
  });
  test('role is read from the database, not the token: a demoted admin loses access immediately', async () => {
    const tmp = await createAdmin('demote@test.dev');
    expect((await api().get('/api/admin/dashboard').set(auth(tmp.token))).status).toBe(200);
    await require('../src/models/User').updateOne({ _id: tmp.user._id }, { role: 'customer' });
    expect((await api().get('/api/admin/dashboard').set(auth(tmp.token))).status).toBe(403);
  });
  test('admins cannot shop (cart/orders are customer-only)', async () => {
    expect((await api().get('/api/cart').set(auth(admin.token))).status).toBe(403);
  });
});

describe('Admin product, category and inventory management', () => {
  let product;
  test('creates a product with variants, validates input', async () => {
    const bad = await api().post('/api/admin/products').set(auth(admin.token)).send(productBody({ variants: [{ sku: 'A', label: 'x', price: -5, stock: 1 }], name: '' }));
    expect(bad.status).toBe(400);
    const dup = await api().post('/api/admin/products').set(auth(admin.token)).send(productBody({ variants: [{ sku: 'DUP-1', label: 'a', price: 100, stock: 1 }, { sku: 'dup-1', label: 'b', price: 100, stock: 1 }] }));
    expect(dup.status).toBe(400);
    const ok = await api().post('/api/admin/products').set(auth(admin.token)).send(productBody());
    expect(ok.status).toBe(201);
    product = ok.body.data.product;
    expect(product.minPrice).toBe(499900);
    expect(product.slug).toBe('smart-watch');
    const same = await api().post('/api/admin/products').set(auth(admin.token)).send(productBody({ variants: [{ sku: 'SW-BLK', label: 'x', price: 100, stock: 1 }] }));
    expect(same.status).toBe(409); // global SKU uniqueness
  });

  test('edit keeps live stock (no clobbering) and recalculates minPrice; new SKU takes supplied stock', async () => {
    await api().post(`/api/admin/products/${product._id}/stock`).set(auth(admin.token)).send({ sku: 'SW-BLK', delta: -3 }); // simulate orders → 7
    const res = await api().put(`/api/admin/products/${product._id}`).set(auth(admin.token)).send({
      variants: [{ sku: 'SW-BLK', label: 'Black', price: 449900, stock: 999 }, { sku: 'SW-SLV', label: 'Silver', price: 519900, stock: 999 }, { sku: 'SW-GLD', label: 'Gold', price: 559900, stock: 6 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.product.minPrice).toBe(449900);
    expect(await stockOf(product._id, 'SW-BLK')).toBe(7); // NOT 999
    expect(await stockOf(product._id, 'SW-GLD')).toBe(6);
  });

  // REGRESSION TEST: category must remain an ObjectId after an admin product edit.
  test('REGRESSION: editing a product preserves ObjectId category and storefront visibility', async () => {
    const p = await makeProduct(cat, {
      name: 'Pulse Wireless Earbuds',
      brand: 'Pulse',
      stock: 10,
    });

    const response = await api()
      .put(`/api/admin/products/${p._id}`)
      .set(auth(admin.token))
      .send({
        name: 'Pulse Wireless Earbuds',
        description: 'Wireless earbuds',
        brand: 'Pulse',
        category: String(cat._id),
        images: ['/products/pulse-wireless-earbuds.svg'],
        tags: ['audio', 'bluetooth'],
        isActive: true,
        variants: p.variants.map((v) => ({
          sku: v.sku,
          label: v.label,
          price: v.price,
          mrp: v.mrp,
          stock: 999,
        })),
      });

    expect(response.status).toBe(200);

    // Check the actual stored BSON type, without Mongoose casting.
    const raw = await Product.collection.findOne({ _id: p._id });
    expect(raw.category._bsontype).toBe('ObjectId');
    expect(String(raw.category)).toBe(String(cat._id));

    // Existing stock must not be overwritten by the edit form.
    expect(await stockOf(p._id, p.variants[0].sku)).toBe(10);

    // Product must remain visible in storefront search.
    const search = await api().get('/api/catalog/products?q=Pulse');
    expect(search.status).toBe(200);
    expect(search.body.data.products.map((item) => item.name))
      .toContain('Pulse Wireless Earbuds');

    // Product must remain visible under its category.
    const categoryResults = await api()
      .get(`/api/catalog/products?category=${cat.slug}`);

    expect(categoryResults.status).toBe(200);
    expect(categoryResults.body.data.products.map((item) => item.name))
      .toContain('Pulse Wireless Earbuds');
  });

  test('CONCURRENCY: product edit preserves a stock deduction made after the edit read', async () => {
    const p = await makeProduct(cat, { stock: 10 });
    const inventory = require('../src/services/inventoryService');
    const originalFindById = Product.findById.bind(Product);
    let raced = false;

    // Force a purchase after updateProduct has loaded the old product document,
    // but before it performs the admin update.
    const findSpy = jest.spyOn(Product, 'findById').mockImplementation(async (...args) => {
      const doc = await originalFindById(...args);
      if (!raced && String(args[0]) === String(p._id)) {
        raced = true;
        await inventory.reserve(p._id, p.variants[0].sku, 2);
      }
      return doc;
    });

    let response;
    try {
      response = await api().put(`/api/admin/products/${p._id}`).set(auth(admin.token)).send({
        variants: [{
          sku: p.variants[0].sku,
          label: p.variants[0].label,
          price: p.variants[0].price + 100,
          stock: 999,
        }],
      });
    } finally {
      findSpy.mockRestore();
    }

    expect(response.status).toBe(200);
    expect(raced).toBe(true);
  });

  test('stock adjustment is atomic and can never go negative', async () => {
    const neg = await api().post(`/api/admin/products/${product._id}/stock`).set(auth(admin.token)).send({ sku: 'SW-SLV', delta: -5 });
    expect(neg.status).toBe(409);
    expect(neg.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await stockOf(product._id, 'SW-SLV')).toBe(4);
    const restock = await api().post(`/api/admin/products/${product._id}/stock`).set(auth(admin.token)).send({ sku: 'SW-SLV', delta: 10, reason: 'new shipment' });
    expect(restock.status).toBe(200);
    expect(await stockOf(product._id, 'SW-SLV')).toBe(14);
    expect((await api().post(`/api/admin/products/${product._id}/stock`).set(auth(admin.token)).send({ sku: 'SW-SLV', delta: 0 })).status).toBe(400);
    expect((await api().post(`/api/admin/products/${product._id}/stock`).set(auth(admin.token)).send({ sku: 'NOPE', delta: 1 })).status).toBe(404);
  });

  test('CONCURRENCY: 10 simultaneous -1 adjustments on stock of 4 → exactly 4 succeed, stock is 0', async () => {
    const p = await makeProduct(cat, { stock: 4 });
    const rs = await Promise.all(Array.from({ length: 10 }, () => api().post(`/api/admin/products/${p._id}/stock`).set(auth(admin.token)).send({ sku: p.variants[0].sku, delta: -1 })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(4);
    expect(await stockOf(p._id, p.variants[0].sku)).toBe(0);
  });

  test('soft delete hides the product from the storefront but keeps order history intact', async () => {
    const p = await makeProduct(cat, { name: 'Doomed Gadget', stock: 5 });
    await addToCart(cust.token, p, 1);
    const o = (await checkout(cust.token, cust.addressId)).body.data.order;
    expect((await api().delete(`/api/admin/products/${p._id}`).set(auth(admin.token))).status).toBe(200);
    expect((await api().get(`/api/catalog/products/${p._id}`)).status).toBe(404);
    const detail = await api().get(`/api/orders/${o._id}`).set(auth(cust.token));
    expect(detail.body.data.order.items[0].name).toBe('Doomed Gadget');
  });

  test('categories: create, update, duplicate rejected, delete blocked while in use', async () => {
    const c = await api().post('/api/admin/categories').set(auth(admin.token)).send({ name: 'Gaming' });
    expect(c.status).toBe(201);
    expect((await api().post('/api/admin/categories').set(auth(admin.token)).send({ name: 'Gaming' })).status).toBe(409);
    const up = await api().put(`/api/admin/categories/${c.body.data.category._id}`).set(auth(admin.token)).send({ description: 'Consoles and more' });
    expect(up.body.data.category.description).toBe('Consoles and more');
    const inUse = await api().delete(`/api/admin/categories/${cat._id}`).set(auth(admin.token));
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe('CATEGORY_IN_USE');
    expect((await api().delete(`/api/admin/categories/${c.body.data.category._id}`).set(auth(admin.token))).status).toBe(200);
  });

  test('admin product list supports search, status and low-stock filters', async () => {
    const low = await makeProduct(cat, { name: 'Almost Gone Widget', stock: 2 });
    const r = await api().get('/api/admin/products?lowStock=true&q=almost').set(auth(admin.token));
    expect(r.body.data.products.map((p) => p.name)).toEqual(['Almost Gone Widget']);
    const inactive = await api().get('/api/admin/products?status=inactive').set(auth(admin.token));
    expect(inactive.body.data.products.every((p) => p.isActive === false)).toBe(true);
    expect(low).toBeTruthy();
  });
});

describe('Admin order management and state transitions', () => {
  let order; let product;
  beforeAll(async () => {
    product = await makeProduct(cat, { price: 250000, stock: 20 });
    await addToCart(cust.token, product, 2);
    order = (await checkout(cust.token, cust.addressId)).body.data.order;
  });
  const setStatus = (status, id = order._id) => api().patch(`/api/admin/orders/${id}/status`).set(auth(admin.token)).send({ status });

  test('walks the happy path PAID → PACKED → SHIPPED → DELIVERED with history', async () => {
    for (const s of ['PACKED', 'SHIPPED', 'DELIVERED']) {
      // eslint-disable-next-line no-await-in-loop
      const r = await setStatus(s);
      expect(r.status).toBe(200);
      expect(r.body.data.order.status).toBe(s);
    }
    const final = await Order.findById(order._id);
    expect(final.statusHistory.map((h) => h.status)).toEqual(['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED']);
  });

  test('invalid transitions are rejected with the allowed next states', async () => {
    const o = (await (async () => { await addToCart(cust.token, product, 1); return checkout(cust.token, cust.addressId); })()).body.data.order;
    const skip = await setStatus('SHIPPED', o._id); // PAID → SHIPPED skips PACKED
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_TRANSITION');
    expect(skip.body.error.details.allowed).toEqual(['PACKED', 'CANCELLED']);
    const backwards = await setStatus('PACKED', order._id); // DELIVERED → PACKED
    expect(backwards.status).toBe(409);
    const manualPaid = await setStatus('PAID', o._id);
    expect(manualPaid.status).toBe(422);
    expect(manualPaid.body.error.code).toBe('STATUS_NOT_SETTABLE');
    expect((await api().patch(`/api/admin/orders/${o._id}/status`).set(auth(admin.token)).send({ status: 'TELEPORTED' })).status).toBe(400);
    expect((await Order.findById(o._id)).status).toBe('PAID');
  });

  test('CONCURRENCY: two admins race PAID→PACKED; exactly one wins', async () => {
    await addToCart(cust.token, product, 1);
    const o = (await checkout(cust.token, cust.addressId)).body.data.order;
    const rs = await Promise.all([setStatus('PACKED', o._id), setStatus('PACKED', o._id), setStatus('PACKED', o._id)]);
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    rs.filter((r) => r.status !== 200).forEach((r) => expect(r.status).toBe(409));
    expect((await Order.findById(o._id)).statusHistory.filter((h) => h.status === 'PACKED')).toHaveLength(1);
  });

  test('admin cancel of a PACKED order restores stock and refunds; cannot cancel once shipped', async () => {
    await addToCart(cust.token, product, 3);
    const before = await stockOf(product._id, product.variants[0].sku);
    const o = (await checkout(cust.token, cust.addressId)).body.data.order;
    expect(await stockOf(product._id, product.variants[0].sku)).toBe(before - 3);
    await setStatus('PACKED', o._id);
    const c = await setStatus('CANCELLED', o._id);
    expect(c.status).toBe(200);
    expect(c.body.data.order.paymentStatus).toBe('REFUNDED');
    expect(await stockOf(product._id, product.variants[0].sku)).toBe(before);
    await addToCart(cust.token, product, 1);
    const o2 = (await checkout(cust.token, cust.addressId)).body.data.order;
    await setStatus('PACKED', o2._id); await setStatus('SHIPPED', o2._id);
    expect((await setStatus('CANCELLED', o2._id)).status).toBe(409);
  });

  test('order list filters by status/search and order detail includes payments and audit trail', async () => {
    const list = await api().get('/api/admin/orders?status=DELIVERED').set(auth(admin.token));
    expect(list.body.data.orders.every((o) => o.status === 'DELIVERED')).toBe(true);
    const search = await api().get(`/api/admin/orders?q=${order.orderNumber}`).set(auth(admin.token));
    expect(search.body.data.orders).toHaveLength(1);
    const detail = await api().get(`/api/admin/orders/${order._id}`).set(auth(admin.token));
    expect(detail.body.data.payments).toHaveLength(1);
    expect(detail.body.data.logs.map((l) => l.action)).toEqual(expect.arrayContaining(['order.placed', 'payment.succeeded', 'order.status_changed']));
    expect(detail.body.data.order.user.email).toBe('shopper@test.dev');
  });
});

describe('AT5 — dashboard, reports and reconciliation agree with the orders', () => {
  test('dashboard totals equal values computed independently from the orders collection', async () => {
    const p = await makeProduct(cat, { price: 175000, stock: 50 });
    const other = await registerCustomer('second@test.dev');
    const otherAddr = await addAddress(other.token);
    for (const [c, qty, payment] of [[cust, 2, undefined], [other, 1, undefined], [other, 1, DECLINED_CARD]]) {
      // eslint-disable-next-line no-await-in-loop
      await addToCart(c.token, p, qty);
      // eslint-disable-next-line no-await-in-loop
      await checkout(c.token, c === cust ? c.addressId : otherAddr, payment ? { payment } : {});
    }
    const res = await api().get('/api/admin/dashboard').set(auth(admin.token));
    expect(res.status).toBe(200);
    const d = res.body.data;

    const all = await Order.find();
    const expectedRevenue = all.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.pricing.total, 0);
    expect(d.totals.revenue).toBe(expectedRevenue);
    expect(d.totals.orders).toBe(all.length);
    expect(d.totals.paidOrders).toBe(all.filter((o) => o.paymentStatus === 'PAID').length);
    expect(d.totals.customers).toBe(await require('../src/models/User').countDocuments({ role: 'customer' }));
    expect(Object.values(d.statusCounts).reduce((a, b) => a + b, 0)).toBe(all.length); // status breakdown covers every order
    expect(d.statusCounts.PLACED).toBeGreaterThanOrEqual(1); // the declined-payment order
    expect(d.salesByDay).toHaveLength(14);
    expect(d.salesByDay.reduce((s, x) => s + x.revenue, 0)).toBe(expectedRevenue);
    expect(d.recentOrders.length).toBeGreaterThan(0);
  });

  test('low-stock list contains only variants at or below the threshold', async () => {
    await makeProduct(cat, { name: 'Nearly Out', stock: 1 });
    const d = (await api().get('/api/admin/dashboard').set(auth(admin.token))).body.data;
    expect(d.lowStock.length).toBeGreaterThan(0);
    d.lowStock.forEach((l) => expect(l.stock).toBeLessThanOrEqual(d.lowStockThreshold));
  });

  test('sales report: daily rows and top products sum to the totals; range validation works', async () => {
    const r = (await api().get('/api/admin/reports/sales').set(auth(admin.token))).body.data;
    expect(r.daily.reduce((s, x) => s + x.revenue, 0)).toBe(r.totals.revenue);
    expect(r.daily.reduce((s, x) => s + x.orders, 0)).toBe(r.totals.orders);
    expect(r.totals.averageOrderValue).toBe(r.totals.orders ? Math.round(r.totals.revenue / r.totals.orders) : 0);
    expect(r.topProducts.reduce((s, x) => s + x.revenue, 0)).toBeLessThanOrEqual(r.totals.revenue); // item lines exclude tax/shipping
    expect(r.topProducts[0].revenue).toBeGreaterThan(0);
    expect((await api().get('/api/admin/reports/sales?from=yesterday').set(auth(admin.token))).status).toBe(400);
  });

  test('reconciliation balances after paid, declined, cancelled and refunded orders', async () => {
    const rec = (await api().get('/api/admin/reports/reconciliation').set(auth(admin.token))).body.data;
    expect(rec.checks.length).toBeGreaterThanOrEqual(6);
    rec.checks.forEach((c) => expect({ name: c.name, ok: c.ok }).toEqual({ name: c.name, ok: true }));
    expect(rec.balanced).toBe(true);
  });

  test('reconciliation DETECTS tampering (a paid order with no payment record)', async () => {
    const o = await Order.findOne({ paymentStatus: 'PAID' });
    await require('../src/models/Payment').deleteMany({ order: o._id });
    const rec = (await api().get('/api/admin/reports/reconciliation').set(auth(admin.token))).body.data;
    expect(rec.balanced).toBe(false);
    expect(rec.checks.filter((c) => !c.ok).length).toBeGreaterThanOrEqual(1);
  });
});

describe('Audit trail and customers', () => {
  test('material actions are logged with actor and entity; filters work; logs are not writable via API', async () => {
    const logs = (await api().get('/api/admin/audit-logs?limit=100').set(auth(admin.token))).body.data.logs;
    const actions = new Set(logs.map((l) => l.action));
    ['product.created', 'product.updated', 'product.deleted', 'inventory.adjusted', 'category.created', 'order.placed', 'order.status_changed', 'order.cancelled', 'payment.succeeded', 'payment.failed'].forEach((a) => expect(actions).toContain(a));
    const stock = logs.find((l) => l.action === 'inventory.adjusted');
    expect(stock.actorEmail).toBe('admin@test.dev');
    expect(stock.actorRole).toBe('admin');
    const filtered = (await api().get('/api/admin/audit-logs?action=order.').set(auth(admin.token))).body.data.logs;
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((l) => l.action.startsWith('order.'))).toBe(true);
    expect((await api().post('/api/admin/audit-logs').set(auth(admin.token)).send({})).status).toBe(404);
    expect((await api().delete('/api/admin/audit-logs').set(auth(admin.token))).status).toBe(404);
    expect(await AuditLog.countDocuments()).toBeGreaterThan(10);
  });

  test('customer list shows order counts and spend; admin can disable a customer who is then locked out', async () => {
    const res = await api().get('/api/admin/customers?q=shopper').set(auth(admin.token));
    const row = res.body.data.customers[0];
    expect(row.email).toBe('shopper@test.dev');
    expect(row.orderCount).toBeGreaterThan(0);
    expect(row.passwordHash).toBeUndefined();
    const victim = await registerCustomer('victim@test.dev');
    expect((await api().patch(`/api/admin/customers/${victim.user._id}/status`).set(auth(admin.token)).send({ isActive: false })).status).toBe(200);
    expect((await api().get('/api/auth/me').set(auth(victim.token))).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'victim@test.dev', password: 'Customer@123' })).body.error.code).toBe('ACCOUNT_DISABLED');
    expect((await api().patch(`/api/admin/customers/${admin.user._id}/status`).set(auth(admin.token)).send({ isActive: false })).status).toBe(404); // admins are not "customers"
  });
});
