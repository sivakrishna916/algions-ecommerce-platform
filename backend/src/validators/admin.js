const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const paise = z.number().int('Must be a whole number of paise').min(1, 'Must be at least 1 paisa').max(100000000);
const imageRef = z.string().trim().max(500).refine((s) => /^(https?:\/\/|\/)/.test(s), 'Image must be an http(s) URL or a /path');

const variant = z.object({
  sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9\-_.]+$/, 'SKU may contain letters, digits, - _ .'),
  label: z.string().trim().min(1).max(60),
  price: paise,
  mrp: paise.optional(),
  stock: z.number().int().min(0).max(1000000).default(0),
}).refine((v) => v.mrp === undefined || v.mrp >= v.price, { message: 'MRP cannot be lower than price', path: ['mrp'] });

const uniqueSkus = (vs) => new Set(vs.map((v) => v.sku.toUpperCase())).size === vs.length;

const productBase = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(4000).default(''),
  brand: z.string().trim().max(60).optional(),
  category: objectId,
  images: z.array(imageRef).max(8).default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
  variants: z.array(variant).min(1, 'At least one variant is required').max(30).refine(uniqueSkus, 'Variant SKUs must be unique'),
  isActive: z.boolean().default(true),
});
const createProduct = productBase;
const updateProduct = productBase.partial();

const adjustStock = z.object({
  sku: z.string().trim().min(1).max(40),
  delta: z.number().int('Adjustment must be a whole number').refine((n) => n !== 0, 'Adjustment cannot be zero').refine((n) => Math.abs(n) <= 100000, 'Adjustment too large'),
  reason: z.string().trim().max(200).optional(),
});

const category = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).optional(), isActive: z.boolean().optional() });

const pageQuery = { page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) };
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const productList = z.object({
  q: z.string().trim().max(80).optional(), category: objectId.optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  lowStock: z.enum(['true', 'false']).optional(), ...pageQuery,
});
const orderList = z.object({
  status: z.enum(['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  q: z.string().trim().max(60).optional(), from: dateStr.optional(), to: dateStr.optional(), ...pageQuery,
});
const customerList = z.object({ q: z.string().trim().max(80).optional(), ...pageQuery });
const orderStatus = z.object({ status: z.enum(['PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']), note: z.string().trim().max(200).optional() });
const customerStatus = z.object({ isActive: z.boolean() });
const salesQuery = z.object({ from: dateStr.optional(), to: dateStr.optional() });
const auditQuery = z.object({
  action: z.string().trim().max(60).optional(), entityType: z.string().trim().max(30).optional(), entityId: z.string().trim().max(40).optional(),
  from: dateStr.optional(), to: dateStr.optional(), ...pageQuery,
});

module.exports = { createProduct, updateProduct, adjustStock, category, productList, orderList, customerList, orderStatus, customerStatus, salesQuery, auditQuery };
