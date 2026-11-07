const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { slugify } = require('../src/utils/helpers');

let n = 0;
async function makeCategory(name = `Category ${++n}`) {
  return Category.create({ name, slug: slugify(name) });
}
async function makeProduct(category, over = {}) {
  n += 1;
  const name = over.name || `Product ${n}`;
  return Product.create({
    name, slug: slugify(name) + '-' + n, category: category._id, brand: over.brand || 'Acme',
    description: over.description || 'A test product', tags: over.tags || [],
    variants: over.variants || [{ sku: `SKU-${n}`, label: 'Default', price: over.price || 50000, stock: over.stock ?? 10 }],
    soldCount: over.soldCount || 0, isActive: over.isActive ?? true,
  });
}
module.exports = { makeCategory, makeProduct };
