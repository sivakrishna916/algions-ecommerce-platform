const { api, setupDb, teardownDb } = require('./helpers');
const { makeCategory, makeProduct } = require('./factories');

let phones; let books;
beforeAll(async () => {
  await setupDb();
  phones = await makeCategory('Phones');
  books = await makeCategory('Books');
  await makeProduct(phones, { name: 'Nova X Phone', price: 2000000, soldCount: 50, tags: ['5g'] });
  await makeProduct(phones, { name: 'Nova Lite Phone', price: 1000000, soldCount: 90 });
  await makeProduct(books, { name: 'Learning Node', price: 49900, soldCount: 5, stock: 0 });
  await makeProduct(books, { name: 'Hidden Draft', price: 100, isActive: false });
  for (let i = 0; i < 14; i++) await makeProduct(books, { name: `Filler Book ${i}`, price: 10000 + i });
});
afterAll(teardownDb);

const names = (res) => res.body.data.products.map((p) => p.name);

describe('Catalogue', () => {
  test('lists active products only, with pagination meta', async () => {
    const res = await api().get('/api/catalog/products?limit=5&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(5);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5, total: 17, totalPages: 4 });
    const all = await api().get('/api/catalog/products?limit=60');
    expect(names(all)).not.toContain('Hidden Draft');
  });

  test('page 2 returns different items than page 1', async () => {
    const p1 = names(await api().get('/api/catalog/products?limit=5&page=1'));
    const p2 = names(await api().get('/api/catalog/products?limit=5&page=2'));
    expect(p1.filter((n) => p2.includes(n))).toHaveLength(0);
  });

  test('search is case-insensitive and matches tags', async () => {
    expect(names(await api().get('/api/catalog/products?q=nova'))).toEqual(expect.arrayContaining(['Nova X Phone', 'Nova Lite Phone']));
    expect(names(await api().get('/api/catalog/products?q=5G'))).toEqual(['Nova X Phone']);
  });

  test('search input is treated literally (no regex injection)', async () => {
    const res = await api().get('/api/catalog/products?q=' + encodeURIComponent('.*'));
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(0);
  });

  test('filters by category slug and price range', async () => {
    const byCat = await api().get('/api/catalog/products?category=phones');
    expect(names(byCat).sort()).toEqual(['Nova Lite Phone', 'Nova X Phone']);
    const byPrice = await api().get('/api/catalog/products?category=phones&minPrice=1500000');
    expect(names(byPrice)).toEqual(['Nova X Phone']);
  });

  test('sorts by price and popularity', async () => {
    const asc = names(await api().get('/api/catalog/products?category=phones&sort=price_asc'));
    expect(asc).toEqual(['Nova Lite Phone', 'Nova X Phone']);
    const desc = names(await api().get('/api/catalog/products?category=phones&sort=price_desc'));
    expect(desc).toEqual(['Nova X Phone', 'Nova Lite Phone']);
    const pop = names(await api().get('/api/catalog/products?category=phones&sort=popular'));
    expect(pop[0]).toBe('Nova Lite Phone');
  });

  test('inStock filter hides sold-out products', async () => {
    const res = await api().get('/api/catalog/products?q=Learning&inStock=true');
    expect(res.body.data.products).toHaveLength(0);
  });

  test('rejects invalid query parameters', async () => {
    expect((await api().get('/api/catalog/products?sort=bogus')).status).toBe(400);
    expect((await api().get('/api/catalog/products?minPrice=500&maxPrice=100')).status).toBe(400);
    expect((await api().get('/api/catalog/products?page=0')).status).toBe(400);
  });

  test('product detail by id and slug; hidden / unknown products give 404', async () => {
    const list = await api().get('/api/catalog/products?q=Nova X');
    const p = list.body.data.products[0];
    expect((await api().get(`/api/catalog/products/${p._id}`)).status).toBe(200);
    const bySlug = await api().get(`/api/catalog/products/${p.slug}`);
    expect(bySlug.body.data.product.variants[0].sku).toBeDefined();
    expect((await api().get('/api/catalog/products/does-not-exist')).status).toBe(404);
    const Product = require('../src/models/Product');
    const hidden = await Product.findOne({ name: 'Hidden Draft' });
    expect((await api().get(`/api/catalog/products/${hidden._id}`)).status).toBe(404);
  });

  test('categories include active product counts', async () => {
    const res = await api().get('/api/catalog/categories');
    const phonesCat = res.body.data.categories.find((c) => c.slug === 'phones');
    expect(phonesCat.productCount).toBe(2);
    expect(res.body.data.categories.find((c) => c.slug === 'books').productCount).toBe(15); // inactive excluded
  });
});
