const router = require('express').Router();
const ctrl   = require('../controllers/facilitiesController');
const { verifyToken, auth } = require('../middleware/auth');

router.use(verifyToken);
router.get('/',    ctrl.getAll);
router.post('/',   auth(['admin']), ctrl.create);
router.put('/:id', auth(['admin']), ctrl.update);
module.exports = router;
