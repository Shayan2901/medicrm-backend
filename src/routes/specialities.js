const router = require('express').Router();
const ctrl   = require('../controllers/specialitiesController');
const { verifyToken, auth } = require('../middleware/auth');

router.use(verifyToken);
router.get('/',  ctrl.getAll);
router.post('/', auth(['admin']), ctrl.create);
module.exports = router;
