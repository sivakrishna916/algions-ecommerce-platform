const router = require('express').Router();
const c = require('../controllers/orderController');
const v = require('../validators/shop');
const { idParam } = require('../validators/auth');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('customer'));
router.post('/checkout', validate({ body: v.checkout }), c.checkout);
router.get('/', validate({ query: v.orderList }), c.list);
router.get('/:id', validate({ params: idParam }), c.get);
router.post('/:id/pay', validate({ params: idParam, body: v.pay }), c.pay);
router.post('/:id/cancel', validate({ params: idParam, body: v.cancel }), c.cancel);

module.exports = router;
