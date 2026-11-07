const { api, setupDb, teardownDb, registerCustomer, auth } = require('./helpers');
const { makeCategory, makeProduct } = require('./factories');
const { addAddress, addToCart, checkout, newKey, DECLINED_CARD, GOOD_CARD } = require('./shopHelpers');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Cart = require('../src/models/Cart');

let cat;
beforeAll(async () => { await setupDb(); cat = await makeCategory('Audio'); });
afterAll(teardownDb);

const stockOf = async (p) => (await Product.findById(p._id)).variants[0].stock;
const newCustomer = async (email) => { const { token } = await registerCustomer(email); return { token, addressId: await addAddress(token) }; };

describe('AT1 — find product, add to cart, place an order end-to-end', () => {
  test('full customer journey', async () => {
    const p = await makeProduct(cat, { name: 'Studio Headphones', price: 300000, stock: 5 });
    const { token, addressId } = await newCustomer('e2e@test.dev');

    const found = await api().get('/api/catalog/products?q=studio');
    expect(found.body.data.products[0]._id).toBe(String(p._id));
    expect((await addToCart(token, p, 2)).status).toBe(201);

    const res = await checkout(token, addressId);
    expect(res.status).toBe(201);
    const { order, payment, paymentSucceeded } = res.body.data;
    expect(paymentSucceeded).toBe(true);
    expect(order.status).toBe('PAID');
    expect(order.paymentStatus).toBe('PAID');
    expect(order.orderNumber).toMatch(/^ALG-\d{8}-[A-Z2-9]{6}$/);
    expect(order.pricing.subtotal).toBe(600000);
    expect(order.pricing.total).toBe(600000 + Math.round(600000 * 0.18)); // free shipping above ₹999
    expect(order.items[0]).toMatchObject({ name: 'Studio Headphones', unitPrice: 300000, quantity: 2, lineTotal: 600000 });
    expect(order.shippingAddress.city).toBe('Pune');
    expect(order.statusHistory.map((h) => h.status)).toEqual(['PLACED', 'PAID']);
    expect(payment.instrument).toBe('•••• 4242');
    expect(JSON.stringify(res.body)).not.toContain('4242424242424242');

    expect(await stockOf(p)).toBe(3);
    const cart = await api().get('/api/cart').set(auth(token));
    expect(cart.body.data.cart.items).toHaveLength(0); // cart emptied

    const history = await api().get('/api/orders').set(auth(token));
    expect(history.body.data.orders).toHaveLength(1);
    const detail = await api().get(`/api/orders/${order._id}`).set(auth(token));
    expect(detail.body.data.payments).toHaveLength(1);
  });

  test('checkout needs an address, a non-empty cart and an Idempotency-Key', async () => {
    const p = await makeProduct(cat, { stock: 5 });
    const { token, addressId } = await newCustomer('neg1@test.dev');
    expect((await checkout(token, addressId)).body.error.code).toBe('CART_EMPTY');
    await addToCart(token, p, 1);
    const noAddr = await api().post('/api/orders/checkout').set(auth(token)).set('Idempotency-Key', newKey()).send({ payment: GOOD_CARD });
    expect(noAddr.status).toBe(400);
    const wrongAddr = await checkout(token, '64b64b64b64b64b64b64b64b');
    expect(wrongAddr.body.error.code).toBe('ADDRESS_REQUIRED');
    const noKey = await api().post('/api/orders/checkout').set(auth(token)).send({ addressId, payment: GOOD_CARD });
    expect(noKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(await Order.countDocuments({ user: (await api().get('/api/auth/me').set(auth(token))).body.data.user._id })).toBe(0);
    expect(await stockOf(p)).toBe(5);
  });

  test("a customer cannot use someone else's address or read someone else's order", async () => {
    const p = await makeProduct(cat, { stock: 5 });
    const a = await newCustomer('owner@test.dev');
    const b = await newCustomer('intruder@test.dev');
    await addToCart(b.token, p, 1);
    expect((await checkout(b.token, a.addressId)).body.error.code).toBe('ADDRESS_REQUIRED');
    await addToCart(a.token, p, 1);
    const mine = await checkout(a.token, a.addressId);
    const read = await api().get(`/api/orders/${mine.body.data.order._id}`).set(auth(b.token));
    expect(read.status).toBe(404);
    expect((await api().post(`/api/orders/${mine.body.data.order._id}/cancel`).set(auth(b.token)).send({})).status).toBe(404);
  });
});

describe('AT2 — stock is re-checked at checkout and cannot go negative', () => {
  test('stale cart: stock dropped after adding → checkout refused, nothing reserved', async () => {
    const p = await makeProduct(cat, { stock: 5 });
    const { token, addressId } = await newCustomer('stale@test.dev');
    await addToCart(token, p, 4);
    await Product.updateOne({ _id: p._id }, { $set: { 'variants.0.stock': 2 } }); // someone else bought some
    const res = await checkout(token, addressId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details[0]).toMatchObject({ requested: 4, available: 2 });
    expect(await stockOf(p)).toBe(2);
  });

  test('multi-line cart is all-or-nothing: a failing line rolls back lines already reserved', async () => {
    const ok = await makeProduct(cat, { stock: 5 });
    const scarce = await makeProduct(cat, { stock: 5 });
    const { token, addressId } = await newCustomer('allornothing@test.dev');
    await addToCart(token, ok, 2);
    await addToCart(token, scarce, 2);
    // Make the SECOND line fail inside the reservation step by draining it after the pre-check would pass:
    // we emulate this by calling reserve directly through a competing purchase.
    const inventory = require('../src/services/inventoryService');
    await inventory.reserve(scarce._id, scarce.variants[0].sku, 4); // competitor takes 4 of 5 → only 1 left
    const res = await checkout(token, addressId);
    expect(res.status).toBe(409);
    expect(await stockOf(ok)).toBe(5); // first line was NOT left reserved
    expect(await stockOf(scarce)).toBe(1);
  });

  test('CONCURRENCY: 8 buyers race for 3 units → exactly 3 orders, stock ends at 0, never negative', async () => {
    const p = await makeProduct(cat, { price: 100000, stock: 3 });
    const buyers = [];
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      const b = await newCustomer(`racer${i}@test.dev`);
      // eslint-disable-next-line no-await-in-loop
      await addToCart(b.token, p, 1);
      buyers.push(b);
    }
    const results = await Promise.all(buyers.map((b) => checkout(b.token, b.addressId)));
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);
    expect(created).toHaveLength(3);
    expect(rejected).toHaveLength(5);
    rejected.forEach((r) => expect(r.body.error.code).toMatch(/INSUFFICIENT_STOCK/));
    expect(await stockOf(p)).toBe(0);
    expect(await Order.countDocuments({ 'items.product': p._id })).toBe(3);
  });
});

describe('AT3 — repeated checkout requests do not create duplicate orders', () => {
  test('sequential retry with the same Idempotency-Key returns the original order', async () => {
    const p = await makeProduct(cat, { price: 150000, stock: 10 });
    const { token, addressId } = await newCustomer('retry@test.dev');
    await addToCart(token, p, 2);
    const key = newKey();
    const first = await checkout(token, addressId, { key });
    const second = await checkout(token, addressId, { key });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.replayed).toBe(true);
    expect(second.body.data.order._id).toBe(first.body.data.order._id);
    expect(second.body.data.order.orderNumber).toBe(first.body.data.order.orderNumber);
    expect(await stockOf(p)).toBe(8); // decremented once, not twice
    expect(await Payment.countDocuments({ order: first.body.data.order._id })).toBe(1); // charged once
  });

  test('CONCURRENCY: 6 simultaneous identical requests → exactly one order and one stock deduction', async () => {
    const p = await makeProduct(cat, { price: 150000, stock: 10 });
    const { token, addressId } = await newCustomer('doubleclick@test.dev');
    await addToCart(token, p, 2);
    const key = newKey();
    const results = await Promise.all(Array.from({ length: 6 }, () => checkout(token, addressId, { key })));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    // every other response is a safe replay (200) or a "retry shortly" (409 CHECKOUT_IN_PROGRESS) — never a second order
    results.filter((r) => r.status !== 201).forEach((r) => {
      expect([200, 409]).toContain(r.status);
      if (r.status === 409) expect(r.body.error.code).toBe('CHECKOUT_IN_PROGRESS');
    });
    const user = (await api().get('/api/auth/me').set(auth(token))).body.data.user;
    expect(await Order.countDocuments({ user: user._id })).toBe(1);
    expect(await stockOf(p)).toBe(8);
    // a client retry after the burst gets the original order
    const retry = await checkout(token, addressId, { key });
    expect(retry.status).toBe(200);
    expect(retry.body.data.replayed).toBe(true);
    expect((await Cart.findOne({ user: user._id })).checkoutLockedAt).toBeUndefined(); // lock released
  });

  test('CONCURRENCY: two different keys for the same cart still make only one order', async () => {
    const p = await makeProduct(cat, { price: 150000, stock: 10 });
    const { token, addressId } = await newCustomer('twokeys@test.dev');
    await addToCart(token, p, 1);
    const [a, b] = await Promise.all([checkout(token, addressId), checkout(token, addressId)]);
    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);
    expect(await stockOf(p)).toBe(9);
  });

  test('a different key after the cart was emptied cannot create an order from nothing', async () => {
    const p = await makeProduct(cat, { stock: 10 });
    const { token, addressId } = await newCustomer('empty@test.dev');
    await addToCart(token, p, 1);
    await checkout(token, addressId);
    const again = await checkout(token, addressId); // new key, empty cart
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('CART_EMPTY');
  });
});

describe('AT4 — failed payment and cancellation', () => {
  test('declined card: order stays PLACED/UNPAID, stock held, retry with a good card pays it', async () => {
    const p = await makeProduct(cat, { price: 200000, stock: 5 });
    const { token, addressId } = await newCustomer('declined@test.dev');
    await addToCart(token, p, 1);
    const res = await checkout(token, addressId, { payment: DECLINED_CARD });
    expect(res.status).toBe(201);
    expect(res.body.data.paymentSucceeded).toBe(false);
    expect(res.body.data.payment).toMatchObject({ status: 'FAILED', failureCode: 'CARD_DECLINED' });
    expect(res.body.data.order.status).toBe('PLACED');
    expect(res.body.data.order.paymentStatus).toBe('UNPAID');
    expect(await stockOf(p)).toBe(4);

    const id = res.body.data.order._id;
    const retry = await api().post(`/api/orders/${id}/pay`).set(auth(token)).send({ payment: GOOD_CARD });
    expect(retry.status).toBe(200);
    expect(retry.body.data.order.status).toBe('PAID');
    // paying again does not charge again
    const twice = await api().post(`/api/orders/${id}/pay`).set(auth(token)).send({ payment: GOOD_CARD });
    expect(twice.body.data.alreadyPaid).toBe(true);
    expect(await Payment.countDocuments({ order: id, status: 'SUCCEEDED' })).toBe(1);
    expect(await Payment.countDocuments({ order: id, status: 'FAILED' })).toBe(1);
  });

  test('invalid card details are rejected before reaching the gateway', async () => {
    const p = await makeProduct(cat, { stock: 5 });
    const { token, addressId } = await newCustomer('badcard@test.dev');
    await addToCart(token, p, 1);
    const res = await checkout(token, addressId, { payment: { method: 'card', number: '4242424242424241', expiry: '13/99', cvv: '1' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
    expect(await stockOf(p)).toBe(5);
  });

  test('cancelling an unpaid order restores stock exactly once', async () => {
    const p = await makeProduct(cat, { stock: 5 });
    const { token, addressId } = await newCustomer('cancel-unpaid@test.dev');
    await addToCart(token, p, 2);
    const o = (await checkout(token, addressId, { payment: DECLINED_CARD })).body.data.order;
    expect(await stockOf(p)).toBe(3);
    const results = await Promise.all([1, 2, 3].map(() => api().post(`/api/orders/${o._id}/cancel`).set(auth(token)).send({ reason: 'changed my mind' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1); // only one cancel wins
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await stockOf(p)).toBe(5); // restored once, not 3 times
    const final = await Order.findById(o._id);
    expect(final.status).toBe('CANCELLED');
    expect(final.stockRestored).toBe(true);
  });

  test('cancelling a paid order refunds the payment and restores stock; cancelled orders cannot be paid or cancelled again', async () => {
    const p = await makeProduct(cat, { price: 120000, stock: 5 });
    const { token, addressId } = await newCustomer('cancel-paid@test.dev');
    await addToCart(token, p, 1);
    const o = (await checkout(token, addressId)).body.data.order;
    const c = await api().post(`/api/orders/${o._id}/cancel`).set(auth(token)).send({ reason: 'ordered by mistake' });
    expect(c.body.data.order.status).toBe('CANCELLED');
    expect(c.body.data.order.paymentStatus).toBe('REFUNDED');
    expect(await stockOf(p)).toBe(5);
    expect(await Payment.countDocuments({ order: o._id, status: 'REFUNDED' })).toBe(1);
    expect((await api().post(`/api/orders/${o._id}/cancel`).set(auth(token)).send({})).status).toBe(409);
    const payAgain = await api().post(`/api/orders/${o._id}/pay`).set(auth(token)).send({ payment: GOOD_CARD });
    expect(payAgain.status).toBe(409);
    expect(payAgain.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  test('customer cannot cancel once the order is packed', async () => {
    const p = await makeProduct(cat, { stock: 5 });
    const { token, addressId } = await newCustomer('late-cancel@test.dev');
    await addToCart(token, p, 1);
    const o = (await checkout(token, addressId)).body.data.order;
    await Order.updateOne({ _id: o._id }, { status: 'PACKED' });
    const r = await api().post(`/api/orders/${o._id}/cancel`).set(auth(token)).send({});
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INVALID_TRANSITION');
    expect(await stockOf(p)).toBe(4);
  });
});
