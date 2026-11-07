/**
 * Repeatable seed.
 *   npm run seed            → upsert categories, products, demo users; (re)create demo orders only if none exist
 *   npm run seed -- --reset → drop ALL collections first, then seed from scratch
 * Credentials come from env (dummy demo values in .env.example).
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const Cart = require('../models/Cart');
const { hashPassword } = require('../services/authService');
const { computePricing } = require('../services/pricingService');
const { slugify, generateOrderNumber } = require('../utils/helpers');
const { categories, products } = require('./seedData');

const env = (k, d) => process.env[k] || d;
const DAY = 86400000;

async function seedUsers() {
  const specs = [
    { name: 'Demo Admin', email: env('SEED_ADMIN_EMAIL', 'admin@demo.test'), password: env('SEED_ADMIN_PASSWORD', 'Admin@12345'), role: 'admin' },
    { name: 'Demo Customer', email: env('SEED_CUSTOMER_EMAIL', 'customer@demo.test'), password: env('SEED_CUSTOMER_PASSWORD', 'Customer@12345'), role: 'customer' },
    { name: 'Riya Sharma', email: 'riya@demo.test', password: 'Customer@12345', role: 'customer' },
    { name: 'Arjun Mehta', email: 'arjun@demo.test', password: 'Customer@12345', role: 'customer' },
  ];
  const out = {};
  for (const s of specs) {
    let u = await User.findOne({ email: s.email });
    if (!u) {
      u = await User.create({ name: s.name, email: s.email, role: s.role, passwordHash: await hashPassword(s.password), phone: '9876500000',
        addresses: s.role === 'customer' ? [{ label: 'Home', fullName: s.name, phone: '9876500000', line1: '221 Park Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', isDefault: true }] : [] });
    }
    out[s.email] = u;
  }
  return Object.values(out);
}

async function seedCatalogue() {
  const catByName = {};
  for (const c of categories) {
    catByName[c.name] = await Category.findOneAndUpdate({ slug: slugify(c.name) }, { $set: { name: c.name, description: c.description, isActive: true, slug: slugify(c.name) } }, { upsert: true, new: true });
  }
  for (const p of products) {
    const slug = slugify(p.name);
    const existing = await Product.findOne({ slug });
    if (existing) continue; // never overwrite live stock on re-seed
    await Product.create({ name: p.name, slug, description: p.description, brand: p.brand, category: catByName[p.category]._id, tags: p.tags,
      images: [`/products/${slug}.svg`], variants: p.variants, soldCount: p.sold || 0 });
  }
}

/** Demo orders are built to be internally consistent: totals, payments, stock and statuses all agree. */
async function seedOrders(users) {
  if (await Order.countDocuments()) return console.log('Orders already exist — skipping demo orders');
  const customers = users.filter((u) => u.role === 'customer');
  const all = await Product.find({ isActive: true });
  const plan = [ // [daysAgo, status, lines]
    [13, 'DELIVERED', 2], [12, 'DELIVERED', 1], [10, 'DELIVERED', 3], [9, 'SHIPPED', 2], [8, 'DELIVERED', 1], [7, 'CANCELLED', 2],
    [6, 'PACKED', 1], [5, 'SHIPPED', 2], [4, 'PAID', 1], [3, 'PAID', 3], [2, 'PLACED', 1], [2, 'PAID', 2], [1, 'PAID', 1], [1, 'DELIVERED', 2], [0, 'PAID', 2], [0, 'PLACED', 1],
  ];
  let i = 0;
  for (const [daysAgo, status, nLines] of plan) {
    const user = customers[i % customers.length];
    const picks = [];
    for (let k = 0; k < nLines; k += 1) {
      const p = all[(i * 3 + k * 5) % all.length];
      const variant = p.variants.find((x) => x.stock > 5);
      if (variant && !picks.some((x) => x.p._id.equals(p._id))) picks.push({ p, variant, qty: 1 + ((i + k) % 2) });
    }
    if (!picks.length) { i += 1; continue; }
    const lines = picks.map(({ p, variant, qty }) => ({ product: p._id, sku: variant.sku, name: p.name, variantLabel: variant.label, image: p.images[0], unitPrice: variant.price, quantity: qty, lineTotal: variant.price * qty }));
    const pricing = computePricing(lines, null);
    const at = new Date(Date.now() - daysAgo * DAY - i * 3600000);
    const paid = status !== 'PLACED' && status !== 'CANCELLED';
    const history = [{ status: 'PLACED', at }];
    const path = ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED'];
    if (status === 'CANCELLED') history.push({ status: 'CANCELLED', at: new Date(at.getTime() + 3600000), note: 'Cancelled by customer' });
    else if (status !== 'PLACED') path.slice(0, path.indexOf(status) + 1).forEach((s, n) => history.push({ status: s, at: new Date(at.getTime() + (n + 1) * 7200000) }));

    const order = new Order({
      orderNumber: generateOrderNumber(), user: user._id, idempotencyKey: `seed-${Date.now()}-${i}`, items: lines,
      shippingAddress: (({ _id, createdAt, updatedAt, ...a }) => a)(user.addresses[0].toObject()),
      pricing: { subtotal: pricing.subtotal, discount: 0, tax: pricing.tax, shipping: pricing.shipping, total: pricing.total },
      status, paymentStatus: paid ? 'PAID' : status === 'CANCELLED' ? 'REFUNDED' : 'UNPAID', statusHistory: history,
      stockRestored: status === 'CANCELLED', cancelReason: status === 'CANCELLED' ? 'Changed my mind' : undefined, cancelledBy: status === 'CANCELLED' ? 'customer' : undefined,
      createdAt: at, updatedAt: at,
    });
    await order.save({ timestamps: false });

    if (paid || status === 'CANCELLED') {
      await Payment.create({ order: order._id, user: user._id, amount: pricing.total, method: 'card', instrument: '•••• 4242', status: paid ? 'SUCCEEDED' : 'REFUNDED', providerRef: `sim_seed_${i}`, refundedAt: status === 'CANCELLED' ? at : undefined });
    }
    if (status !== 'CANCELLED') { // reserved stock for every non-cancelled order
      for (const l of lines) await Product.updateOne({ _id: l.product, 'variants.sku': l.sku }, { $inc: { 'variants.$.stock': -l.quantity, soldCount: l.quantity } });
    }
    await AuditLog.create({ actor: user._id, actorRole: 'customer', actorEmail: user.email, action: 'order.placed', entityType: 'Order', entityId: String(order._id), summary: `Order ${order.orderNumber} placed (seed)`, createdAt: at });
    i += 1;
  }
}

(async () => {
  await connectDB();
  if (process.argv.includes('--reset')) {
    await mongoose.connection.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    console.log('Database dropped.');
  } else {
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  }
  const users = await seedUsers();
  await seedCatalogue();
  await seedOrders(users);
  await Cart.deleteMany({});
  console.log(`Seed complete: ${await Category.countDocuments()} categories, ${await Product.countDocuments()} products, ${await User.countDocuments()} users, ${await Order.countDocuments()} orders.`);
  console.log(`Admin:    ${env('SEED_ADMIN_EMAIL', 'admin@demo.test')} / ${env('SEED_ADMIN_PASSWORD', 'Admin@12345')}`);
  console.log(`Customer: ${env('SEED_CUSTOMER_EMAIL', 'customer@demo.test')} / ${env('SEED_CUSTOMER_PASSWORD', 'Customer@12345')}`);
  await mongoose.disconnect();
})().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
