const router = require('express').Router();
const c = require('../controllers/catalogController');
const v = require('../validators/catalog');
const { validate } = require('../middleware/validate');

router.get('/products', validate({ query: v.listProducts }), c.list);
router.get('/products/:idOrSlug', c.getOne);
router.get('/categories', c.categories);

module.exports = router;
