const router = require('express').Router();
const c = require('../controllers/cartController');
const v = require('../validators/shop');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('customer'));
router.get('/', c.get);
router.post('/items', validate({ body: v.addItem }), c.add);
router.patch('/items', validate({ body: v.setQuantity }), c.setQty);
router.delete('/items/:productId/:sku', validate({ params: v.itemParams }), c.remove);
router.delete('/', c.clear);
router.post('/coupon', validate({ body: v.coupon }), c.applyCoupon);
router.delete('/coupon', c.removeCoupon);

module.exports = router;
