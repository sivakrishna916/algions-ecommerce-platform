const productService = require('../services/productService');
const { asyncHandler, send } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await productService.list(req.query);
  send(res, 200, { products: items }, meta);
});
exports.getOne = asyncHandler(async (req, res) => send(res, 200, { product: await productService.getOne(req.params.idOrSlug) }));
exports.categories = asyncHandler(async (_req, res) => send(res, 200, { categories: await productService.listCategories() }));
