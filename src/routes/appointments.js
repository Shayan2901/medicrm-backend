const router = require('express').Router();
const ctrl   = require('../controllers/appointmentsController');
const { verifyToken } = require('../middleware/auth');
router.use(verifyToken);
router.get('/',             ctrl.getAppointments);
router.post('/',            ctrl.createAppointment);
router.patch('/:id/status', ctrl.updateAppointmentStatus);
module.exports = router;
