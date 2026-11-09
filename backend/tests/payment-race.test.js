const { api, setupDb, teardownDb, createAdmin, registerCustomer, auth } = require('./helpers');
const { makeCategory, makeProduct } = require('./factories');
const { addAddress, addToCart, checkout, DECLINED_CARD, GOOD_CARD } = require('./shopHelpers');
const orderService = require('../src/services/orderService');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Product = require('../src/models/Product');

beforeAll(setupDb);
afterAll(teardownDb);

describe('Payment arriving after the order was cancelled (race compensation)', () => {
  test('the charge is reversed, the order stays cancelled, stock is not double-restored, and reconciliation still balances', async () => {
    const admin = await createAdmin();
    const cat = await makeCategory('Race');
    const product = await makeProduct(cat, { price: 100000, stock: 5 });
    const { token, user } = await registerCustomer('race@test.dev');
    const addressId = await addAddress(token);
    await addToCart(token, product, 1);

    // Unpaid order (declined) → customer is about to retry payment, holding a copy of the order as PLACED
    const placed = (await checkout(token, addressId, { payment: DECLINED_CARD })).body.data.order;
    const staleOrder = await Order.findById(placed._id); // what an in-flight payment request would be holding
    expect(staleOrder.status).toBe('PLACED');

    // ...meanwhile the order is cancelled (stock restored once)
    expect((await api().post(`/api/orders/${placed._id}/cancel`).set(auth(token)).send({})).status).toBe(200);
    expect((await Product.findById(product._id)).variants[0].stock).toBe(5);

    // ...and the payment request finishes its charge afterwards
    const userDoc = await require('../src/models/User').findById(user._id);
    await expect(orderService.attemptPayment(staleOrder, userDoc, { method: 'card', number: GOOD_CARD.number.replace(/ /g, '') }))
      .rejects.toMatchObject({ status: 409, code: 'ORDER_NOT_PAYABLE' });

    const final = await Order.findById(placed._id);
    expect(final.status).toBe('CANCELLED');
    expect((await Product.findById(product._id)).variants[0].stock).toBe(5); // not restored twice
    const pays = await Payment.find({ order: placed._id });
    expect(pays.filter((p) => p.status === 'SUCCEEDED')).toHaveLength(0); // customer is not left charged
    expect(pays.filter((p) => p.status === 'REFUNDED')).toHaveLength(1);
    expect(final.paymentStatus).toBe('REFUNDED'); // order and payment records agree

    const rec = (await api().get('/api/admin/reports/reconciliation').set(auth(admin.token))).body.data;
    expect(rec.checks.filter((c) => !c.ok)).toEqual([]);
    expect(rec.balanced).toBe(true);
  });
});
