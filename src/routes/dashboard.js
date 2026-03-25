const router = require('express').Router();
const ctrl   = require('../controllers/dashboardController');
const { auth } = require('../middleware/auth');
router.use(auth());
router.get('/summary', ctrl.getSummary);
router.get('/marketing', ctrl.getMarketingStats);
router.get('/cxo', ctrl.getCXOStats);
router.get('/finance', ctrl.getFinanceStats);
module.exports = router;
