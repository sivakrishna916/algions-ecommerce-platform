const Product = require('../models/Product');
const Category = require('../models/Category');
const inventory = require('./inventoryService');
const audit = require('./auditService');
const { slugify, randomCode, escapeRegex, pageMeta } = require('../utils/helpers');
const { notFound, conflict, unprocessable } = require('../utils/AppError');
const env = require('../config/env');

async function uniqueSlug(Model, base) {
  let slug = slugify(base) || 'item';
  if (await Model.exists({ slug })) slug = `${slug}-${randomCode(4).toLowerCase()}`;
  return slug;
}

/* ---------- products ---------- */

async function listProducts({ q, category, status, lowStock, page, limit }) {
  const filter = {};
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (category) filter.category = category;
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { brand: rx }, { 'variants.sku': rx }]; }
  if (lowStock === 'true') filter.variants = { $elemMatch: { stock: { $lte: env.lowStockThreshold } } };
  const [items, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

async function getProduct(id) {
  const p = await Product.findById(id).populate('category', 'name slug');
  if (!p) throw notFound('Product');
  return p;
}

async function assertCategory(id) {
  if (!(await Category.exists({ _id: id }))) throw unprocessable('CATEGORY_NOT_FOUND', 'Category does not exist');
}

async function createProduct(admin, data) {
  await assertCategory(data.category);
  const product = new Product({ ...data, slug: await uniqueSlug(Product, data.name) });
  await product.save();
  await audit.record(admin, 'product.created', 'Product', product._id, `Created product "${product.name}"`, { skus: product.variants.map((v) => v.sku) });
  return product;
}

/**
 * Update. STOCK IS NEVER OVERWRITTEN HERE: for SKUs that already exist the stored stock is kept
 * (stock changes go through the atomic /stock endpoint), so an edit form cannot clobber stock that
 * changed because of orders placed while the admin was editing. New SKUs start with the supplied stock.
 */
async function updateProduct(admin, id, patch) {
  const current = await Product.findById(id);
  if (!current) throw notFound('Product');
  if (patch.category) await assertCategory(patch.category);

  const before = { name: current.name, isActive: current.isActive };
  let product;

  if (patch.variants) {
    // Use a single atomic update pipeline. Existing SKU stock is read from the
    // document at write time, not from the potentially stale document loaded
    // above. Inventory $inc operations therefore cannot be overwritten by an
    // admin edit that was opened before a customer placed an order.
    const incomingVariants = patch.variants.map((variant) => ({
      ...variant,
      sku: variant.sku.toUpperCase(),
    }));
    const fields = Object.fromEntries(
      Object.entries(patch)
        .filter(([key]) => key !== 'variants')
        .map(([key, value]) => [key, { $literal: value }]),
    );

    product = await Product.findOneAndUpdate(
      { _id: id },
      [
        {
          $set: {
            ...fields,
            variants: {
              $map: {
                input: { $literal: incomingVariants },
                as: 'incoming',
                in: {
                  $let: {
                    vars: {
                      existing: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: { $ifNull: ['$variants', []] },
                              as: 'stored',
                              cond: { $eq: ['$$stored.sku', '$$incoming.sku'] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: {
                      $mergeObjects: [
                        '$$incoming',
                        { stock: { $ifNull: ['$$existing.stock', '$$incoming.stock'] } },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        {
          $set: {
            minPrice: {
              $min: { $map: { input: '$variants', as: 'variant', in: '$$variant.price' } },
            },
          },
        },
      ],
      { new: true },
    );
  } else {
    // Non-variant edits do not write the variants array and cannot overwrite stock.
    product = await Product.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  }

  if (!product) throw notFound('Product');
  const changed = Object.keys(patch);
  await audit.record(admin, 'product.updated', 'Product', product._id, `Updated product "${product.name}" (${changed.join(', ')})`, { changed, before });
  return product;
}

/** Soft delete: order history keeps referencing the product, but it disappears from the storefront. */
async function deleteProduct(admin, id) {
  const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!product) throw notFound('Product');
  await audit.record(admin, 'product.deleted', 'Product', product._id, `Deactivated product "${product.name}"`);
  return product;
}

async function adjustStock(admin, id, { sku, delta, reason }) {
  const updated = await inventory.adjust(id, sku.toUpperCase(), delta);
  if (!updated) throw notFound('Product or variant');
  const variant = updated.variants.find((v) => v.sku === sku.toUpperCase());
  await audit.record(admin, 'inventory.adjusted', 'Product', id, `Stock ${delta > 0 ? '+' : ''}${delta} for ${variant.sku} → ${variant.stock}`, { sku: variant.sku, delta, reason, newStock: variant.stock });
  return updated;
}

/* ---------- categories ---------- */

async function listCategories() {
  const cats = await Category.find().sort({ name: 1 });
  const counts = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return cats.map((c) => ({ ...c.toObject(), productCount: map.get(String(c._id)) || 0 }));
}

async function createCategory(admin, data) {
  const cat = await Category.create({ ...data, slug: await uniqueSlug(Category, data.name) });
  await audit.record(admin, 'category.created', 'Category', cat._id, `Created category "${cat.name}"`);
  return cat;
}

async function updateCategory(admin, id, data) {
  const cat = await Category.findById(id);
  if (!cat) throw notFound('Category');
  cat.set(data);
  await cat.save();
  await audit.record(admin, 'category.updated', 'Category', cat._id, `Updated category "${cat.name}"`, { changed: Object.keys(data) });
  return cat;
}

async function deleteCategory(admin, id) {
  const cat = await Category.findById(id);
  if (!cat) throw notFound('Category');
  const used = await Product.countDocuments({ category: id });
  if (used > 0) throw conflict('CATEGORY_IN_USE', `Cannot delete: ${used} product(s) still use this category. Move or remove them first, or deactivate the category.`, { products: used });
  await cat.deleteOne();
  await audit.record(admin, 'category.deleted', 'Category', id, `Deleted category "${cat.name}"`);
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct, adjustStock, listCategories, createCategory, updateCategory, deleteCategory };
