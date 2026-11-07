const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const audit = require('./auditService');
const { escapeRegex, pageMeta } = require('../utils/helpers');
const { notFound, forbidden } = require('../utils/AppError');

const dayStart = (s) => new Date(`${s}T00:00:00.000Z`);
const dayEnd = (s) => new Date(`${s}T23:59:59.999Z`);
const dateRange = (from, to) => (from || to) ? { ...(from && { $gte: dayStart(from) }), ...(to && { $lte: dayEnd(to) }) } : undefined;

async function listOrders({ status, q, from, to, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  const range = dateRange(from, to);
  if (range) filter.createdAt = range;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id');
    filter.$or = [{ orderNumber: rx }, { user: { $in: users.map((u) => u._id) } }];
  }
  const [items, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

async function getOrder(id) {
  const order = await Order.findById(id).populate('user', 'name email phone');
  if (!order) throw notFound('Order');
  const payments = await Payment.find({ order: order._id }).sort({ createdAt: 1 });
  const logs = await AuditLog.find({ entityType: 'Order', entityId: String(order._id) }).sort({ createdAt: 1 });
  return { order, payments, logs };
}

async function listCustomers({ q, page, limit }) {
  const filter = { role: 'customer' };
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { email: rx }]; }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) } } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, '$pricing.total', 0] } } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));
  const items = users.map((u) => ({ ...u.toSafeJSON(), orderCount: (byUser.get(String(u._id)) || {}).orders || 0, totalSpent: (byUser.get(String(u._id)) || {}).spent || 0 }));
  return { items, meta: pageMeta(page, limit, total) };
}

async function setCustomerActive(admin, id, isActive) {
  const user = await User.findById(id);
  if (!user || user.role !== 'customer') throw notFound('Customer');
  if (String(user._id) === String(admin._id)) throw forbidden('You cannot change your own account');
  user.isActive = isActive;
  await user.save();
  await audit.record(admin, isActive ? 'customer.enabled' : 'customer.disabled', 'User', user._id, `${isActive ? 'Enabled' : 'Disabled'} customer ${user.email}`);
  return user.toSafeJSON();
}

async function listAuditLogs({ action, entityType, entityId, from, to, page, limit }) {
  const filter = {};
  if (action) filter.action = new RegExp(`^${escapeRegex(action)}`);
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  const range = dateRange(from, to);
  if (range) filter.createdAt = range;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

module.exports = { listOrders, getOrder, listCustomers, setCustomerActive, listAuditLogs, dateRange, dayStart, dayEnd };
