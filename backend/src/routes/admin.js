const router = require('express').Router();
const c = require('../controllers/adminController');
const v = require('../validators/admin');
const { idParam } = require('../validators/auth');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

// EVERY admin route is protected on the server: valid token + role === 'admin'.
router.use(authenticate, requireRole('admin'));

router.get('/dashboard', c.dashboard);
router.get('/reports/sales', validate({ query: v.salesQuery }), c.sales);
router.get('/reports/reconciliation', c.reconciliation);

router.get('/products', validate({ query: v.productList }), c.listProducts);
router.post('/products', validate({ body: v.createProduct }), c.createProduct);
router.get('/products/:id', validate({ params: idParam }), c.getProduct);
router.put('/products/:id', validate({ params: idParam, body: v.updateProduct }), c.updateProduct);
router.delete('/products/:id', validate({ params: idParam }), c.deleteProduct);
router.post('/products/:id/stock', validate({ params: idParam, body: v.adjustStock }), c.adjustStock);

router.get('/categories', c.listCategories);
router.post('/categories', validate({ body: v.category }), c.createCategory);
router.put('/categories/:id', validate({ params: idParam, body: v.category.partial() }), c.updateCategory);
router.delete('/categories/:id', validate({ params: idParam }), c.deleteCategory);

router.get('/orders', validate({ query: v.orderList }), c.listOrders);
router.get('/orders/:id', validate({ params: idParam }), c.getOrder);
router.patch('/orders/:id/status', validate({ params: idParam, body: v.orderStatus }), c.setOrderStatus);

router.get('/customers', validate({ query: v.customerList }), c.listCustomers);
router.patch('/customers/:id/status', validate({ params: idParam, body: v.customerStatus }), c.setCustomerStatus);
router.get('/audit-logs', validate({ query: v.auditQuery }), c.auditLogs);

module.exports = router;
