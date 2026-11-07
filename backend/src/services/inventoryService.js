const Product = require('../models/Product');
const { conflict, unprocessable } = require('../utils/AppError');

/**
 * Atomic reservation. The stock check and the decrement happen in ONE database operation:
 * the filter requires `stock >= qty`, so two concurrent buyers can never both take the last unit
 * and stock can never go negative. Returns true if reserved.
 */
async function reserve(productId, sku, qty) {
  const res = await Product.updateOne(
    { _id: productId, isActive: true, variants: { $elemMatch: { sku, stock: { $gte: qty } } } },
    { $inc: { 'variants.$.stock': -qty, soldCount: qty } }
  );
  return res.modifiedCount === 1;
}

async function release(productId, sku, qty) {
  await Product.updateOne({ _id: productId, 'variants.sku': sku }, { $inc: { 'variants.$.stock': qty, soldCount: -qty } });
}

/** Reserve every line or none (compensating rollback of the lines already taken). */
async function reserveAll(lines) {
  const taken = [];
  for (const l of lines) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await reserve(l.product, l.sku, l.quantity);
    if (!ok) {
      await Promise.all(taken.map((t) => release(t.product, t.sku, t.quantity)));
      throw conflict('INSUFFICIENT_STOCK', `Not enough stock for "${l.name}"`, [{ sku: l.sku, name: l.name, requested: l.quantity }]);
    }
    taken.push(l);
  }
  return taken;
}

async function releaseAll(lines) {
  await Promise.all(lines.map((l) => release(l.product, l.sku, l.quantity)));
}

/** Admin stock adjustment by delta. Guarded so the result can never be negative. */
async function adjust(productId, sku, delta) {
  if (!Number.isInteger(delta) || delta === 0) throw unprocessable('INVALID_DELTA', 'Adjustment must be a non-zero integer');
  const res = await Product.findOneAndUpdate(
    { _id: productId, variants: { $elemMatch: { sku, ...(delta < 0 ? { stock: { $gte: -delta } } : {}) } } },
    { $inc: { 'variants.$.stock': delta } },
    { new: true }
  );
  if (!res) {
    const exists = await Product.exists({ _id: productId, 'variants.sku': sku });
    if (!exists) return null;
    throw conflict('INSUFFICIENT_STOCK', 'Adjustment would make stock negative');
  }
  return res;
}

module.exports = { reserve, release, reserveAll, releaseAll, adjust };
