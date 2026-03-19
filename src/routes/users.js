const router = require('express').Router();
const ctrl   = require('../controllers/usersController');
const { verifyToken, auth } = require('../middleware/auth');

router.use(verifyToken);
router.get('/',    auth(['admin','cxo']), ctrl.getAll);
router.put('/:id', auth(['admin']), ctrl.update);
module.exports = router;
