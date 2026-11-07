const Cart = require('../models/Cart');
const Product = require('../models/Product');
const env = require('../config/env');
const coupons = require('../config/coupons');
const { computePricing } = require('./pricingService');
const { conflict, notFound, unprocessable } = require('../utils/AppError');

async function getOrCreate(userId) {
  return Cart.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId, items: [] } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

/**
 * Turns stored cart rows into priced lines using CURRENT database prices/stock.
 * Client-supplied prices are never trusted. `issue` flags rows that cannot be bought as-is.
 */
async function resolveLines(cart) {
  const ids = [...new Set(cart.items.map((i) => String(i.product)))];
  const products = await Product.find({ _id: { $in: ids } }).populate('category', 'isActive');
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return cart.items.map((it) => {
    const p = byId.get(String(it.product));
    const v = p && p.variants.find((x) => x.sku === it.sku);
    const unavailable = !p || !p.isActive || !p.category || !p.category.isActive || !v;
    const base = { product: it.product, sku: it.sku, quantity: it.quantity };
    if (unavailable) return { ...base, name: p ? p.name : 'Unavailable product', unitPrice: 0, stock: 0, issue: 'UNAVAILABLE' };
    return {
      ...base, name: p.name, slug: p.slug, variantLabel: v.label, image: p.images[0],
      unitPrice: v.price, stock: v.stock, issue: it.quantity > v.stock ? (v.stock === 0 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_STOCK') : null,
    };
  });
}

async function view(userId) {
  const cart = await getOrCreate(userId);
  const lines = await resolveLines(cart);
  const priced = lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity }));
  const pricing = computePricing(priced, cart.couponCode);
  return {
    items: priced,
    couponCode: pricing.couponError ? null : cart.couponCode || null,
    couponError: pricing.couponError,
    pricing: { subtotal: pricing.subtotal, discount: pricing.discount, tax: pricing.tax, shipping: pricing.shipping, total: pricing.total },
    itemCount: priced.reduce((s, l) => s + l.quantity, 0),
    hasIssues: priced.some((l) => l.issue),
  };
}

async function loadSellable(productId, sku) {
  const p = await Product.findOne({ _id: productId, isActive: true }).populate('category', 'isActive');
  if (!p || !p.category.isActive) throw notFound('Product');
  const v = p.variants.find((x) => x.sku === sku.toUpperCase());
  if (!v) throw notFound('Product variant');
  return { p, v };
}

function assertQty(name, qty, stock) {
  if (stock <= 0) throw conflict('OUT_OF_STOCK', `"${name}" is out of stock`, { available: 0 });
  if (qty > env.maxQtyPerLine) throw unprocessable('QUANTITY_LIMIT', `You can buy at most ${env.maxQtyPerLine} units of an item per order`);
  if (qty > stock) throw conflict('INSUFFICIENT_STOCK', `Only ${stock} unit(s) of "${name}" available`, { available: stock });
}

async function addItem(userId, { productId, sku, quantity }) {
  const { p, v } = await loadSellable(productId, sku);
  const cart = await getOrCreate(userId);
  const existing = cart.items.find((i) => String(i.product) === String(p._id) && i.sku === v.sku);
  const newQty = (existing ? existing.quantity : 0) + quantity;
  assertQty(p.name, newQty, v.stock);
  if (existing) existing.quantity = newQty; else cart.items.push({ product: p._id, sku: v.sku, quantity });
  await cart.save();
  return view(userId);
}

async function setQuantity(userId, { productId, sku, quantity }) {
  const cart = await getOrCreate(userId);
  const item = cart.items.find((i) => String(i.product) === String(productId) && i.sku === sku.toUpperCase());
  if (!item) throw notFound('Cart item');
  const { p, v } = await loadSellable(productId, sku);
  assertQty(p.name, quantity, v.stock);
  item.quantity = quantity;
  await cart.save();
  return view(userId);
}

async function removeItem(userId, productId, sku) {
  await Cart.updateOne({ user: userId }, { $pull: { items: { product: productId, sku: sku.toUpperCase() } } });
  return view(userId);
}

async function clear(userId) {
  await Cart.updateOne({ user: userId }, { $set: { items: [] }, $unset: { couponCode: 1 } });
  return view(userId);
}

async function applyCoupon(userId, code) {
  const key = code.toUpperCase();
  if (!coupons[key]) throw unprocessable('INVALID_COUPON', 'Invalid coupon code');
  const cart = await getOrCreate(userId);
  cart.couponCode = key;
  await cart.save();
  const v = await view(userId);
  if (v.couponError) {
    await Cart.updateOne({ user: userId }, { $unset: { couponCode: 1 } });
    throw unprocessable('COUPON_NOT_APPLICABLE', v.couponError);
  }
  return v;
}

async function removeCoupon(userId) {
  await Cart.updateOne({ user: userId }, { $unset: { couponCode: 1 } });
  return view(userId);
}

module.exports = { view, addItem, setQuantity, removeItem, clear, applyCoupon, removeCoupon, resolveLines };
