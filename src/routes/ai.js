const router = require('express').Router();
const ctrl   = require('../controllers/aiController');
const { verifyToken } = require('../middleware/auth');
router.use(verifyToken);
router.post('/score/:leadId',    ctrl.scoreLead);
router.post('/followup/:leadId', ctrl.getFollowUp);
router.post('/insight/:leadId',  ctrl.getInsight);
router.post('/cxo-insights',     ctrl.getCxoInsights);
module.exports = router;
