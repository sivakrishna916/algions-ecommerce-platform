const orders = require('../services/orderService');
const { asyncHandler, send } = require('../utils/helpers');
const { badRequest } = require('../utils/AppError');

const publicPayment = (p) => p && ({ id: p._id, status: p.status, method: p.method, instrument: p.instrument, amount: p.amount, failureCode: p.failureCode, failureReason: p.failureReason, createdAt: p.createdAt });

exports.checkout = asyncHandler(async (req, res) => {
  const key = req.headers['idempotency-key'];
  if (!key || key.trim().length < 8 || key.length > 128) {
    throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (8–128 chars) so retries cannot create duplicate orders');
  }
  const { order, payment, replayed } = await orders.checkout(req.user, req.body, key.trim());
  send(res, replayed ? 200 : 201, { order, payment: publicPayment(payment), replayed, paymentSucceeded: !!payment && payment.status !== 'FAILED' });
});

exports.pay = asyncHandler(async (req, res) => {
  const { order, payment, alreadyPaid } = await orders.pay(req.user, req.params.id, req.body.payment);
  send(res, 200, { order, payment: publicPayment(payment), alreadyPaid: !!alreadyPaid, paymentSucceeded: !!payment && payment.status !== 'FAILED' });
});

exports.cancel = asyncHandler(async (req, res) => send(res, 200, { order: await orders.cancel(req.user, req.params.id, req.body.reason) }));
exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await orders.listForUser(req.user, req.query);
  send(res, 200, { orders: items }, meta);
});
exports.get = asyncHandler(async (req, res) => {
  const { order, payments, allowed } = await orders.getForUser(req.user, req.params.id);
  send(res, 200, { order, payments: payments.map(publicPayment), allowed });
});
