const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const User = require('../models/User');
const env = require('../config/env');
const { dateRange } = require('./adminDataService');

/**
 * "Revenue" = total of orders whose payment is currently PAID (so cancelled/refunded and unpaid orders are excluded).
 * The dashboard, sales report and reconciliation all use this single definition so the numbers can be checked against each other.
 */
const REVENUE_MATCH = { paymentStatus: 'PAID' };

const isoDay = (d) => d.toISOString().slice(0, 10);

async function salesByDay(match) {
  const rows = await Order.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, orders: r.orders, revenue: r.revenue }));
}

async function lowStock(limit = 20) {
  return Product.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$variants' },
    { $match: { 'variants.stock': { $lte: env.lowStockThreshold } } },
    { $sort: { 'variants.stock': 1, name: 1 } },
    { $limit: limit },
    { $project: { _id: 0, productId: '$_id', name: 1, sku: '$variants.sku', label: '$variants.label', stock: '$variants.stock' } },
  ]);
}

async function dashboard() {
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 13); since.setUTCHours(0, 0, 0, 0);

  const [rev, totalOrders, totalCustomers, totalProducts, statusRows, recent, daily, low] = await Promise.all([
    Order.aggregate([{ $match: REVENUE_MATCH }, { $group: { _id: null, revenue: { $sum: '$pricing.total' }, orders: { $sum: 1 } } }]),
    Order.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ isActive: true }),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(8),
    salesByDay({ ...REVENUE_MATCH, createdAt: { $gte: since } }),
    lowStock(10),
  ]);

  const map = new Map(daily.map((d) => [d.date, d]));
  const series = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since); d.setUTCDate(since.getUTCDate() + i);
    const key = isoDay(d);
    series.push(map.get(key) || { date: key, orders: 0, revenue: 0 });
  }
  const statusCounts = Object.fromEntries(['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => [s, 0]));
  statusRows.forEach((r) => { statusCounts[r._id] = r.count; });

  return {
    totals: { revenue: rev[0] ? rev[0].revenue : 0, paidOrders: rev[0] ? rev[0].orders : 0, orders: totalOrders, customers: totalCustomers, products: totalProducts },
    statusCounts, salesByDay: series, recentOrders: recent, lowStock: low, lowStockThreshold: env.lowStockThreshold,
  };
}

async function salesReport({ from, to }) {
  const end = to ? new Date(`${to}T00:00:00.000Z`) : new Date();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 29 * 86400000);
  const range = dateRange(isoDay(start), isoDay(end));
  const match = { ...REVENUE_MATCH, createdAt: range };

  const [daily, top, totals] = await Promise.all([
    salesByDay(match),
    Order.aggregate([
      { $match: match }, { $unwind: '$items' },
      { $group: { _id: { product: '$items.product', name: '$items.name' }, units: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
      { $sort: { revenue: -1 } }, { $limit: 10 },
      { $project: { _id: 0, productId: '$_id.product', name: '$_id.name', units: 1, revenue: 1 } },
    ]),
    Order.aggregate([{ $match: match }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' }, tax: { $sum: '$pricing.tax' }, discount: { $sum: '$pricing.discount' }, shipping: { $sum: '$pricing.shipping' } } }]),
  ]);
  const t = totals[0] || { orders: 0, revenue: 0, tax: 0, discount: 0, shipping: 0 };
  return { range: { from: isoDay(start), to: isoDay(end) }, totals: { orders: t.orders, revenue: t.revenue, tax: t.tax, discount: t.discount, shipping: t.shipping, averageOrderValue: t.orders ? Math.round(t.revenue / t.orders) : 0 }, daily, topProducts: top };
}

const sumOf = (rows) => (rows[0] ? rows[0].total : 0);
const countOf = (rows) => (rows[0] ? rows[0].count : 0);

/** Cross-checks orders against payments and against the report totals. `balanced` is true only if every check passes. */
async function reconciliation() {
  const [paidOrders, succeeded, refundedOrders, refundedPayments, paidWithoutPayment, cancelledNotRestored, badTotals, allDaily] = await Promise.all([
    Order.aggregate([{ $match: REVENUE_MATCH }, { $group: { _id: null, total: { $sum: '$pricing.total' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'SUCCEEDED' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { paymentStatus: 'REFUNDED' } }, { $group: { _id: null, total: { $sum: '$pricing.total' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'REFUNDED' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: REVENUE_MATCH },
      { $lookup: { from: 'payments', let: { id: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$order', '$$id'] }, status: 'SUCCEEDED' } }], as: 'p' } },
      { $match: { p: { $size: 0 } } }, { $count: 'count' },
    ]),
    Order.countDocuments({ status: 'CANCELLED', stockRestored: false }),
    Order.countDocuments({ $expr: { $ne: ['$pricing.total', { $add: [{ $subtract: ['$pricing.subtotal', '$pricing.discount'] }, '$pricing.tax', '$pricing.shipping'] }] } }),
    salesByDay(REVENUE_MATCH),
  ]);

  const reportRevenue = allDaily.reduce((s, d) => s + d.revenue, 0);
  const checks = [
    { name: 'Revenue from PAID orders equals sum of successful payments', expected: sumOf(paidOrders), actual: sumOf(succeeded) },
    { name: 'Number of PAID orders equals number of successful payments', expected: countOf(paidOrders), actual: countOf(succeeded) },
    { name: 'Refunded orders total equals sum of refunded payments', expected: sumOf(refundedOrders), actual: sumOf(refundedPayments) },
    { name: 'Sales report (daily) adds up to dashboard revenue', expected: sumOf(paidOrders), actual: reportRevenue },
    { name: 'PAID orders without a matching successful payment', expected: 0, actual: countOf(paidWithoutPayment) },
    { name: 'Cancelled orders whose stock was not restored', expected: 0, actual: cancelledNotRestored },
    { name: 'Orders whose total ≠ subtotal − discount + tax + shipping', expected: 0, actual: badTotals },
  ].map((c) => ({ ...c, ok: c.expected === c.actual }));
  return { balanced: checks.every((c) => c.ok), checks };
}

module.exports = { dashboard, salesReport, reconciliation, lowStock };
