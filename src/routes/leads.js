const router = require('express').Router();
const ctrl   = require('../controllers/leadsController');
const { verifyToken, auth } = require('../middleware/auth');

router.use(verifyToken);
router.get('/',              ctrl.getLeads);
router.get('/:id',           ctrl.getLeadById);
router.post('/',             ctrl.createLead);
router.put('/:id',           ctrl.updateLead);
router.patch('/:id/stage',   ctrl.updateStage);
router.patch('/:id/ai',      auth(['admin','cxo']), ctrl.updateAI);
router.delete('/:id',        auth(['admin','cxo']), ctrl.deleteLead);
module.exports = router;
