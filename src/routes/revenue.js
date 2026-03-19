const router = require('express').Router();
const ctrl   = require('../controllers/revenueController');
const { verifyToken, auth } = require('../middleware/auth');

router.use(verifyToken);
router.get('/',  auth(['admin','cxo','finance']), ctrl.getRevenue);
router.post('/', auth(['admin','finance']), ctrl.createRevenue);
module.exports = router;
