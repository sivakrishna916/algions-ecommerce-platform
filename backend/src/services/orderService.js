const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const cartService = require('./cartService');
const inventory = require('./inventoryService');
const { simulateCharge } = require('./paymentService');
const { computePricing } = require('./pricingService');
const sm = require('./orderStateMachine');
const audit = require('./auditService');
const { generateOrderNumber, pageMeta } = require('../utils/helpers');
const { AppError, conflict, notFound, unprocessable, forbidden } = require('../utils/AppError');

const LOCK_TTL_MS = 30 * 1000;

/* ----------------------------- helpers ----------------------------- */

/**
 * Atomic status change guarded by the status we expect to be in. If another request (e.g. another admin,
 * or a cancellation racing a payment) already moved the order, this matches nothing and returns null.
 */
function transition(orderId, from, to, { by, note, set = {} } = {}) {
  return Order.findOneAndUpdate(
    { _id: orderId, status: { $in: [].concat(from) } },
    { $set: { status: to, ...set }, $push: { statusHistory: { status: to, at: new Date(), by, note } } },
    { new: true }
  );
}

async function findOwned(user, orderId) {
  const order = await Order.findOne({ _id: orderId, user: user._id });
  if (!order) throw notFound('Order'); // 404 (not 403) so other customers' order ids are not revealed
  return order;
}

async function acquireCartLock(userId) {
  const now = new Date();
  const cart = await Cart.findOneAndUpdate(
    { user: userId, $or: [{ checkoutLockedAt: { $exists: false } }, { checkoutLockedAt: null }, { checkoutLockedAt: { $lt: new Date(now - LOCK_TTL_MS) } }] },
    { $set: { checkoutLockedAt: now } },
    { new: true }
  );
  return cart;
}

/* ----------------------------- payment ----------------------------- */

/** Charge via the sandbox gateway, record the attempt, and move PLACED → PAID on success. */
async function attemptPayment(order, user, paymentInput) {
  const result = simulateCharge(paymentInput);
  const payment = await Payment.create({
    order: order._id, user: user._id, amount: order.pricing.total, method: paymentInput.method,
    instrument: result.instrument, status: result.status, providerRef: result.providerRef,
    failureCode: result.failureCode, failureReason: result.failureReason,
  });

  if (result.status === 'FAILED') {
    await audit.record(user, 'payment.failed', 'Order', order._id, `Payment failed for ${order.orderNumber}: ${result.failureReason}`, { code: result.failureCode });
    return { order, payment };
  }

  const paid = await transition(order._id, 'PLACED', 'PAID', { by: user._id, note: 'Payment received', set: { paymentStatus: 'PAID' } });
  if (!paid) {
    // Lost a race (order was cancelled while we were charging): give the money back immediately.
    await Payment.updateOne({ _id: payment._id }, { status: 'REFUNDED', refundedAt: new Date() });
    const current = await Order.findById(order._id);
    throw conflict('ORDER_NOT_PAYABLE', `Order is ${current.status} and can no longer be paid; the charge was reversed`);
  }
  await audit.record(user, 'payment.succeeded', 'Order', order._id, `Payment received for ${order.orderNumber}`, { amount: order.pricing.total });
  return { order: paid, payment };
}

async function pay(user, orderId, paymentInput) {
  const order = await findOwned(user, orderId);
  if (order.status === 'CANCELLED') throw conflict('ORDER_NOT_PAYABLE', 'This order was cancelled');
  if (order.paymentStatus === 'PAID') {
    const payment = await Payment.findOne({ order: order._id, status: 'SUCCEEDED' });
    return { order, payment, alreadyPaid: true }; // idempotent: paying twice does not charge twice
  }
  if (order.status !== 'PLACED') throw conflict('ORDER_NOT_PAYABLE', `Order is ${order.status} and cannot be paid`);
  return attemptPayment(order, user, paymentInput);
}

/* ----------------------------- checkout ----------------------------- */

/**
 * Idempotent checkout.
 *  1. Same (user, Idempotency-Key) as an earlier request → return that order, create nothing.
 *  2. A per-cart lock stops two checkouts of the same cart running at once.
 *  3. Prices and stock are re-read from the database (never from the client).
 *  4. Stock is reserved atomically per line (all or nothing, with rollback).
 *  5. The order insert is protected by a UNIQUE (user, idempotencyKey) index as the final guard.
 */
async function checkout(user, { addressId, payment }, idempotencyKey) {
  const previous = await Order.findOne({ user: user._id, idempotencyKey });
  if (previous) return replay(user, previous);

  const address = user.addresses.id(addressId);
  if (!address) throw unprocessable('ADDRESS_REQUIRED', 'Select a valid delivery address');

  const cartLocked = await acquireCartLock(user._id);
  if (!cartLocked) {
    // Either a duplicate request is in flight, or the cart doesn't exist.
    if (await Cart.exists({ user: user._id })) throw conflict('CHECKOUT_IN_PROGRESS', 'A checkout for this cart is already in progress. Retry in a moment.');
    throw unprocessable('CART_EMPTY', 'Your cart is empty');
  }

  let reserved = [];
  let created = null;
  try {
    // A concurrent duplicate may have finished between our first lookup and acquiring the lock.
    const raced = await Order.findOne({ user: user._id, idempotencyKey });
    if (raced) return await replay(user, raced);

    const cart = await Cart.findById(cartLocked._id);
    if (!cart.items.length) throw unprocessable('CART_EMPTY', 'Your cart is empty');

    const lines = await cartService.resolveLines(cart);
    const unavailable = lines.filter((l) => l.issue === 'UNAVAILABLE');
    if (unavailable.length) throw conflict('ITEM_UNAVAILABLE', 'Some items are no longer available', unavailable.map((l) => ({ sku: l.sku, name: l.name })));
    const short = lines.filter((l) => l.issue);
    if (short.length) throw conflict('INSUFFICIENT_STOCK', 'Some items do not have enough stock', short.map((l) => ({ sku: l.sku, name: l.name, requested: l.quantity, available: l.stock })));

    const priced = lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity }));
    const pricing = computePricing(priced, cart.couponCode);
    if (pricing.couponError) throw unprocessable('COUPON_NOT_APPLICABLE', pricing.couponError);

    // Authoritative stock check-and-decrement (atomic). Throws INSUFFICIENT_STOCK if someone else just bought it.
    reserved = await inventory.reserveAll(priced);

    const addressSnapshot = address.toObject();
    delete addressSnapshot._id; delete addressSnapshot.createdAt; delete addressSnapshot.updatedAt;
    const now = new Date();
    created = await Order.create({
      orderNumber: generateOrderNumber(), user: user._id, idempotencyKey,
      items: priced.map((l) => ({ product: l.product, sku: l.sku, name: l.name, variantLabel: l.variantLabel, image: l.image, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal })),
      shippingAddress: addressSnapshot, couponCode: cart.couponCode,
      pricing: { subtotal: pricing.subtotal, discount: pricing.discount, tax: pricing.tax, shipping: pricing.shipping, total: pricing.total },
      status: 'PLACED', paymentStatus: 'UNPAID', statusHistory: [{ status: 'PLACED', at: now, by: user._id, note: 'Order placed' }],
    });
  } catch (err) {
    if (reserved.length) await inventory.releaseAll(reserved); // never leave stock reserved without an order
    if (err && err.code === 11000) {
      const dup = await Order.findOne({ user: user._id, idempotencyKey });
      if (dup) return replay(user, dup);
    }
    throw err;
  } finally {
    // The lock is ALWAYS released, on success, replay and every error path.
    await Cart.updateOne({ _id: cartLocked._id }, { $unset: { checkoutLockedAt: 1 } });
  }

  // Order exists → empty the cart (only reached when this request created the order).
  await Cart.updateOne({ _id: cartLocked._id }, { $set: { items: [] }, $unset: { couponCode: 1 } });
  await audit.record(user, 'order.placed', 'Order', created._id, `Order ${created.orderNumber} placed`, { total: created.pricing.total, items: created.items.length });

  const outcome = await attemptPayment(created, user, payment);
  return { order: outcome.order, payment: outcome.payment, replayed: false };
}

async function replay(user, order) {
  const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  return { order, payment, replayed: true };
}

/* ----------------------------- cancellation ----------------------------- */

/**
 * Cancel an order. Only the request that wins the atomic status change restores stock and refunds,
 * so double clicks / concurrent cancels can never restore stock twice.
 */
async function cancel(actor, orderId, reason) {
  const isAdmin = actor.role === 'admin';
  const order = isAdmin ? await Order.findById(orderId) : await findOwned(actor, orderId);
  if (!order) throw notFound('Order');
  const role = isAdmin ? 'admin' : 'customer';

  if (!sm.canCancel(role, order.status)) {
    throw conflict('INVALID_TRANSITION', `An order that is ${order.status} cannot be cancelled${role === 'customer' && order.status === 'PACKED' ? ' by the customer — contact support' : ''}`,
      { status: order.status });
  }
  const cancelled = await transition(order._id, sm.CANCELLABLE_BY[role], 'CANCELLED', {
    by: actor._id, note: reason || 'Cancelled', set: { cancelReason: reason || 'Cancelled', cancelledBy: role },
  });
  if (!cancelled) {
    const now = await Order.findById(order._id);
    throw conflict('INVALID_TRANSITION', `Order changed to ${now.status} while cancelling; please refresh`, { status: now.status });
  }

  await inventory.releaseAll(cancelled.items);
  await Order.updateOne({ _id: cancelled._id }, { stockRestored: true });
  const refund = await Payment.updateMany({ order: cancelled._id, status: 'SUCCEEDED' }, { status: 'REFUNDED', refundedAt: new Date() });
  if (refund.modifiedCount > 0) await Order.updateOne({ _id: cancelled._id }, { paymentStatus: 'REFUNDED' });

  await audit.record(actor, 'order.cancelled', 'Order', cancelled._id, `Order ${cancelled.orderNumber} cancelled by ${role}`, { reason, refunded: refund.modifiedCount > 0 });
  return Order.findById(cancelled._id);
}

/* ----------------------------- admin fulfilment ----------------------------- */

async function adminSetStatus(admin, orderId, status, note) {
  if (!sm.ADMIN_SETTABLE.includes(status)) {
    throw unprocessable('STATUS_NOT_SETTABLE', status === 'PAID' ? 'PAID is set automatically by a successful payment' : `Unknown or non-settable status ${status}`);
  }
  if (status === 'CANCELLED') return cancel(admin, orderId, note || 'Cancelled by admin');

  const order = await Order.findById(orderId);
  if (!order) throw notFound('Order');
  if (!sm.canTransition(order.status, status)) {
    throw conflict('INVALID_TRANSITION', `Cannot change order from ${order.status} to ${status}`, { from: order.status, to: status, allowed: sm.allowedNext(order.status) });
  }
  const updated = await transition(order._id, order.status, status, { by: admin._id, note });
  if (!updated) {
    const now = await Order.findById(order._id);
    throw conflict('ORDER_CHANGED', `Order was just updated to ${now.status} by someone else; refresh and retry`, { status: now.status });
  }
  await audit.record(admin, 'order.status_changed', 'Order', order._id, `${order.orderNumber}: ${order.status} → ${status}`, { from: order.status, to: status, note });
  return updated;
}

/* ----------------------------- queries ----------------------------- */

async function listForUser(user, { status, page, limit }) {
  const filter = { user: user._id };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

async function getForUser(user, orderId) {
  const order = await findOwned(user, orderId);
  const payments = await Payment.find({ order: order._id }).sort({ createdAt: 1 });
  return { order, payments, allowed: { cancel: sm.canCancel('customer', order.status), pay: order.status === 'PLACED' } };
}

module.exports = { checkout, pay, cancel, adminSetStatus, listForUser, getForUser, transition };
