const catalog = require('../services/adminCatalogService');
const data = require('../services/adminDataService');
const reports = require('../services/reportService');
const orders = require('../services/orderService');
const { asyncHandler, send } = require('../utils/helpers');

const list = (key, fn) => asyncHandler(async (req, res) => { const { items, meta } = await fn(req.query); send(res, 200, { [key]: items }, meta); });

exports.dashboard = asyncHandler(async (_req, res) => send(res, 200, await reports.dashboard()));
exports.sales = asyncHandler(async (req, res) => send(res, 200, await reports.salesReport(req.query)));
exports.reconciliation = asyncHandler(async (_req, res) => send(res, 200, await reports.reconciliation()));

exports.listProducts = list('products', catalog.listProducts);
exports.getProduct = asyncHandler(async (req, res) => send(res, 200, { product: await catalog.getProduct(req.params.id) }));
exports.createProduct = asyncHandler(async (req, res) => send(res, 201, { product: await catalog.createProduct(req.user, req.body) }));
exports.updateProduct = asyncHandler(async (req, res) => send(res, 200, { product: await catalog.updateProduct(req.user, req.params.id, req.body) }));
exports.deleteProduct = asyncHandler(async (req, res) => send(res, 200, { product: await catalog.deleteProduct(req.user, req.params.id) }));
exports.adjustStock = asyncHandler(async (req, res) => send(res, 200, { product: await catalog.adjustStock(req.user, req.params.id, req.body) }));

exports.listCategories = asyncHandler(async (_req, res) => send(res, 200, { categories: await catalog.listCategories() }));
exports.createCategory = asyncHandler(async (req, res) => send(res, 201, { category: await catalog.createCategory(req.user, req.body) }));
exports.updateCategory = asyncHandler(async (req, res) => send(res, 200, { category: await catalog.updateCategory(req.user, req.params.id, req.body) }));
exports.deleteCategory = asyncHandler(async (req, res) => { await catalog.deleteCategory(req.user, req.params.id); send(res, 200, { message: 'Category deleted' }); });

exports.listOrders = list('orders', data.listOrders);
exports.getOrder = asyncHandler(async (req, res) => send(res, 200, await data.getOrder(req.params.id)));
exports.setOrderStatus = asyncHandler(async (req, res) => send(res, 200, { order: await orders.adminSetStatus(req.user, req.params.id, req.body.status, req.body.note) }));

exports.listCustomers = list('customers', data.listCustomers);
exports.setCustomerStatus = asyncHandler(async (req, res) => send(res, 200, { customer: await data.setCustomerActive(req.user, req.params.id, req.body.isActive) }));
exports.auditLogs = list('logs', data.listAuditLogs);
