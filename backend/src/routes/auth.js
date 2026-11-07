const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../validators/auth');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

router.post('/register', validate({ body: v.register }), c.register);
router.post('/login', validate({ body: v.login }), c.login);

router.use(authenticate);
router.get('/me', c.me);
router.patch('/me', validate({ body: v.updateProfile }), c.updateMe);
router.post('/change-password', validate({ body: v.changePassword }), c.changePassword);
router.get('/me/addresses', c.listAddresses);
router.post('/me/addresses', validate({ body: v.address }), c.addAddress);
router.put('/me/addresses/:id', validate({ params: v.idParam, body: v.address.partial() }), c.updateAddress);
router.delete('/me/addresses/:id', validate({ params: v.idParam }), c.deleteAddress);

module.exports = router;
