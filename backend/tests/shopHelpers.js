const { api, auth } = require('./helpers');

const GOOD_CARD = { method: 'card', number: '4242 4242 4242 4242', expiry: '12/30', cvv: '123' };
const DECLINED_CARD = { method: 'card', number: '4000000000000002', expiry: '12/30', cvv: '123' };
const ADDRESS = { fullName: 'Asha Rao', phone: '9876543210', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001' };

let keyN = 0;
const newKey = () => `test-key-${Date.now()}-${++keyN}-abcdef`;

async function addAddress(token) {
  const r = await api().post('/api/auth/me/addresses').set(auth(token)).send(ADDRESS);
  return r.body.data.address._id;
}
const addToCart = (token, product, quantity = 1, sku) =>
  api().post('/api/cart/items').set(auth(token)).send({ productId: String(product._id), sku: sku || product.variants[0].sku, quantity });
const checkout = (token, addressId, { key = newKey(), payment = GOOD_CARD } = {}) =>
  api().post('/api/orders/checkout').set(auth(token)).set('Idempotency-Key', key).send({ addressId, payment });

module.exports = { GOOD_CARD, DECLINED_CARD, ADDRESS, newKey, addAddress, addToCart, checkout };
