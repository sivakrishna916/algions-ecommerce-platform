const { api, setupDb, teardownDb, registerCustomer, auth } = require('./helpers');
const { makeCategory, makeProduct } = require('./factories');
const { addToCart } = require('./shopHelpers');

let token; let cat;
beforeAll(async () => { await setupDb(); cat = await makeCategory('Gadgets'); ({ token } = await registerCustomer('cart@test.dev')); });
afterAll(teardownDb);

describe('Cart', () => {
  test('requires authentication', async () => {
    expect((await api().get('/api/cart')).status).toBe(401);
  });

  test('adds items, merges duplicates, persists, and computes totals server-side', async () => {
    const p = await makeProduct(cat, { price: 20000, stock: 10 });
    await addToCart(token, p, 1);
    const res = await addToCart(token, p, 2);
    expect(res.status).toBe(201);
    const cart = res.body.data.cart;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.pricing.subtotal).toBe(60000);
    expect(cart.pricing.total).toBe(60000 + Math.round(60000 * 0.18) + 4900);
    const again = await api().get('/api/cart').set(auth(token)); // persisted
    expect(again.body.data.cart.itemCount).toBe(3);
  });

  test('rejects invalid quantities (0, negative, fractional, huge, non-numeric)', async () => {
    const p = await makeProduct(cat, { stock: 50 });
    for (const q of [0, -1, 1.5, 11, '2', null]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await api().post('/api/cart/items').set(auth(token)).send({ productId: String(p._id), sku: p.variants[0].sku, quantity: q });
      expect([400]).toContain(r.status);
    }
  });

  test('cannot add more than available stock, or an out-of-stock item', async () => {
    const low = await makeProduct(cat, { stock: 2 });
    expect((await addToCart(token, low, 3)).body.error.code).toBe('INSUFFICIENT_STOCK');
    const none = await makeProduct(cat, { stock: 0 });
    const r = await addToCart(token, none, 1);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('OUT_OF_STOCK');
  });

  test('unknown product / variant / inactive product', async () => {
    const p = await makeProduct(cat);
    expect((await api().post('/api/cart/items').set(auth(token)).send({ productId: String(p._id), sku: 'NOPE', quantity: 1 })).status).toBe(404);
    expect((await api().post('/api/cart/items').set(auth(token)).send({ productId: 'abc', sku: 'X', quantity: 1 })).status).toBe(400);
    const hidden = await makeProduct(cat, { isActive: false });
    expect((await addToCart(token, hidden, 1)).status).toBe(404);
  });

  test('updates quantity within stock, removes items, applies and rejects coupons', async () => {
    const { token: t2 } = await registerCustomer('cart2@test.dev');
    const p = await makeProduct(cat, { price: 100000, stock: 5 });
    await addToCart(t2, p, 1);
    const up = await api().patch('/api/cart/items').set(auth(t2)).send({ productId: String(p._id), sku: p.variants[0].sku, quantity: 4 });
    expect(up.body.data.cart.items[0].quantity).toBe(4);
    const over = await api().patch('/api/cart/items').set(auth(t2)).send({ productId: String(p._id), sku: p.variants[0].sku, quantity: 6 });
    expect(over.status).toBe(409);

    const bad = await api().post('/api/cart/coupon').set(auth(t2)).send({ code: 'BOGUS' });
    expect(bad.status).toBe(422);
    const good = await api().post('/api/cart/coupon').set(auth(t2)).send({ code: 'flat100' });
    expect(good.body.data.cart.pricing.discount).toBe(10000);

    const del = await api().delete(`/api/cart/items/${p._id}/${p.variants[0].sku}`).set(auth(t2));
    expect(del.body.data.cart.items).toHaveLength(0);
  });

  test('flags a cart line whose stock dropped after it was added', async () => {
    const { token: t3 } = await registerCustomer('cart3@test.dev');
    const p = await makeProduct(cat, { stock: 5 });
    await addToCart(t3, p, 4);
    await require('../src/models/Product').updateOne({ _id: p._id }, { $set: { 'variants.0.stock': 1 } });
    const res = await api().get('/api/cart').set(auth(t3));
    expect(res.body.data.cart.hasIssues).toBe(true);
    expect(res.body.data.cart.items[0].issue).toBe('INSUFFICIENT_STOCK');
  });
});
