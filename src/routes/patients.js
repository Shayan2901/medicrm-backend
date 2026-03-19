const router = require('express').Router();
const ctrl   = require('../controllers/patientsController');
const { verifyToken } = require('../middleware/auth');
router.use(verifyToken);
router.get('/',     ctrl.getPatients);
router.get('/:id',  ctrl.getPatientById);
router.put('/:id',  ctrl.updatePatient);
module.exports = router;
