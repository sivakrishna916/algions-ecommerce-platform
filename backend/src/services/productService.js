const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { escapeRegex, pageMeta } = require('../utils/helpers');
const { notFound } = require('../utils/AppError');

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { minPrice: 1, _id: 1 },
  price_desc: { minPrice: -1, _id: 1 },
  popular: { soldCount: -1, _id: 1 },
};

async function resolveCategory(value) {
  if (mongoose.isValidObjectId(value)) return value;
  const cat = await Category.findOne({ slug: value.toLowerCase() }).select('_id');
  return cat ? cat._id : null;
}

/** Public catalogue query: search + filters + sort + pagination. Inactive products/categories are never returned. */
async function list(params) {
  const { q, category, minPrice, maxPrice, inStock, sort, page, limit } = params;
  const filter = { isActive: true };

  const activeCats = await Category.find({ isActive: true }).select('_id');
  filter.category = { $in: activeCats.map((c) => c._id) };

  if (category) {
    const id = await resolveCategory(category);
    if (!id) return { items: [], meta: pageMeta(page, limit, 0) };
    filter.category = id;
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i'); // input is escaped: no regex injection
    filter.$or = [{ name: rx }, { brand: rx }, { tags: rx }, { description: rx }];
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.minPrice = {};
    if (minPrice !== undefined) filter.minPrice.$gte = minPrice;
    if (maxPrice !== undefined) filter.minPrice.$lte = maxPrice;
  }
  if (inStock === 'true') filter.variants = { $elemMatch: { stock: { $gt: 0 } } };

  const [items, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort(SORTS[sort]).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

async function getOne(idOrSlug) {
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
  const product = await Product.findOne({ ...query, isActive: true }).populate('category', 'name slug isActive');
  if (!product || !product.category || !product.category.isActive) throw notFound('Product');
  return product;
}

async function listCategories() {
  const cats = await Category.find({ isActive: true }).sort({ name: 1 });
  const counts = await Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return cats.map((c) => ({ ...c.toObject(), productCount: map.get(String(c._id)) || 0 }));
}

module.exports = { list, getOne, listCategories };
