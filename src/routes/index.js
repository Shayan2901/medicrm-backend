const express      = require('express');
const router       = express.Router();

const { auth }     = require('../middleware/auth');

const authCtrl     = require('../controllers/authController');
const leadsCtrl    = require('../controllers/leadsController');
const webhookCtrl  = require('../controllers/webhooksController');
const emailCtrl    = require('../controllers/emailController');
const interactCtrl = require('../controllers/interactionsController');
const appointCtrl  = require('../controllers/appointmentsController');
const revenueCtrl  = require('../controllers/revenueController');
const dashCtrl     = require('../controllers/dashboardController');
const dirCtrl      = require('../controllers/directoryController');

// ─── AUTH ────────────────────────────────────────────────────────────────────
router.post('/auth/login',    authCtrl.login);
router.post('/auth/register', auth(['admin']), authCtrl.register);
router.get ('/auth/me',       auth(), authCtrl.me);

// ─── LEADS ───────────────────────────────────────────────────────────────────
router.get   ('/leads',           auth(), leadsCtrl.getLeads);
router.get   ('/leads/:id',       auth(), leadsCtrl.getLeadById);
router.post  ('/leads',           auth(), leadsCtrl.createLead);
router.put   ('/leads/:id',       auth(), leadsCtrl.updateLead);
router.patch ('/leads/:id/stage', auth(), leadsCtrl.updateStage);
router.patch ('/leads/:id/ai',    auth(), leadsCtrl.updateAI);
router.delete('/leads/:id',       auth(['admin','cxo']), leadsCtrl.deleteLead);

// ─── INTERACTIONS ────────────────────────────────────────────────────────────
router.get   ('/leads/:leadId/interactions', auth(), interactCtrl.getInteractions);
router.post  ('/leads/:leadId/interactions', auth(), interactCtrl.createInteraction);
router.delete('/interactions/:id',           auth(['admin']), interactCtrl.deleteInteraction);

// ─── APPOINTMENTS ────────────────────────────────────────────────────────────
router.get   ('/appointments',            auth(), appointCtrl.getAppointments);
router.post  ('/appointments',            auth(), appointCtrl.createAppointment);
router.patch ('/appointments/:id/status', auth(), appointCtrl.updateAppointmentStatus);

// ─── REVENUE ─────────────────────────────────────────────────────────────────
router.get ('/revenue', auth(['finance','cxo','admin']), revenueCtrl.getRevenue);
router.post('/revenue', auth(['finance','admin']),        revenueCtrl.createRevenue);

// ─── DASHBOARDS ──────────────────────────────────────────────────────────────
router.get('/dashboard/summary',   auth(), dashCtrl.getSummary);
router.get('/dashboard/marketing', auth(['marketing','cxo','admin']), dashCtrl.getMarketingStats);
router.get('/dashboard/cxo',       auth(['cxo','admin']),             dashCtrl.getCXOStats);
router.get('/dashboard/finance',   auth(['finance','cxo','admin']),   dashCtrl.getFinanceStats);

// ─── DIRECTORY ───────────────────────────────────────────────────────────────
router.get ('/facilities',     auth(), dirCtrl.getFacilities);
router.post('/facilities',     auth(['admin']), dirCtrl.createFacility);
router.put ('/facilities/:id', auth(['admin']), dirCtrl.updateFacility);

router.get ('/specialities',   auth(), dirCtrl.getSpecialities);
router.post('/specialities',   auth(['admin']), dirCtrl.createSpeciality);

router.get ('/doctors',        auth(), dirCtrl.getDoctors);
router.post('/doctors',        auth(['admin']), dirCtrl.createDoctor);
router.put ('/doctors/:id',    auth(['admin']), dirCtrl.updateDoctor);

// ─── EMAIL ───────────────────────────────────────────────────────────────────
router.post('/settings/email',       auth(['admin']),        emailCtrl.saveEmailConfig);
router.post('/settings/email/test',  auth(['admin','cxo']),  emailCtrl.testEmail);
router.post('/email/send',           auth(),                 emailCtrl.sendEmail);

// ─── WEBHOOKS ────────────────────────────────────────────────────────────────
router.get('/webhooks',              auth(['admin','cxo']),  webhookCtrl.getWebhooks);
router.post('/webhooks',             auth(['admin']),         webhookCtrl.saveWebhooks);
router.delete('/webhooks/:event_type', auth(['admin']),       webhookCtrl.deleteWebhook);
router.post('/webhooks/test/:event_type', auth(['admin','cxo']), webhookCtrl.testWebhook);

// ─── AD SPEND ────────────────────────────────────────────────────────────────
router.get('/ad-spend', auth(['admin','cxo','marketing']), async (req, res) => {
  try {
    const db = require('../config/db');
    const { month } = req.query;
    const m = month || new Date().toISOString().slice(0,7);
    const [rows] = await db.query(
      'SELECT channel, monthly_spend FROM ad_spend WHERE month = ?', [m]);
    res.json({ success: true, data: rows, month: m });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ad-spend', auth(['admin','cxo','marketing']), async (req, res) => {
  try {
    const db = require('../config/db');
    const { spends, month } = req.body; // spends: [{channel, monthly_spend}]
    const m = month || new Date().toISOString().slice(0,7);
    for (const s of spends) {
      await db.query(
        `INSERT INTO ad_spend (channel, monthly_spend, month)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE monthly_spend = VALUES(monthly_spend)`,
        [s.channel, parseFloat(s.monthly_spend)||0, m]
      );
    }
    res.json({ success: true, message: 'Ad spend saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/leads/:id/audit',     auth(), async (req, res) => {
  try {
    const db = require('../config/db');
    const [logs] = await db.query(
      `SELECT al.*, u.name AS user_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_type = 'lead' AND al.entity_id = ?
       ORDER BY al.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json({ success: true, data: logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/patients',           auth(), dirCtrl.getPatients);
router.post('/patients',          auth(), async (req, res) => {
  try {
    const db = require('../config/db');
    const { full_name, primary_phone, email, city, patient_type } = req.body;
    if (!full_name || !primary_phone) return res.status(400).json({ success:false, message:'Name and phone required' });
    const [[existing]] = await db.query('SELECT id FROM patients WHERE primary_phone=?', [primary_phone]);
    if (existing) return res.status(409).json({ success:false, message:'Patient with this phone already exists' });
    const [[cnt]] = await db.query('SELECT COUNT(*) AS c FROM patients');
    const unique_pid = `PAT-${String(cnt.c+1).padStart(5,'0')}`;
    const [result] = await db.query(
      'INSERT INTO patients (unique_pid,full_name,primary_phone,email,city,patient_type) VALUES (?,?,?,?,?,?)',
      [unique_pid, full_name, primary_phone, email||null, city||null, patient_type||'new']);
    res.status(201).json({ success:true, id:result.insertId, unique_pid });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});
router.get('/patients/:id',       auth(), dirCtrl.getPatientById);
router.get('/patients/duplicates/scan', auth(['admin','cxo']), dirCtrl.getDuplicatePatients);
router.delete('/patients/:id',        auth(['admin']),        async (req, res) => {
  try {
    const db = require('../config/db');
    const [existing] = await db.query('SELECT id FROM patients WHERE id=?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success:false, message:'Patient not found' });
    await db.query('DELETE FROM leads WHERE patient_id=?', [req.params.id]);
    await db.query('DELETE FROM patients WHERE id=?', [req.params.id]);
    res.json({ success:true, message:'Patient deleted' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});
router.post('/patients/merge',    auth(['admin','cxo']), dirCtrl.mergePatients);

router.get('/users',           auth(['admin','cxo']), dirCtrl.getUsers);
router.put('/users/:id',       auth(['admin']),        dirCtrl.updateUser);
router.post('/users',          auth(['admin']),        async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const db = require('../config/db');
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, is_active) VALUES (?,?,?,?,1)',
      [name, email, hash, role || 'agent']);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
