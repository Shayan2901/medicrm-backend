require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');

const authRoutes         = require('./routes/auth');
const leadsRoutes        = require('./routes/leads');
const patientsRoutes     = require('./routes/patients');
const facilitiesRoutes   = require('./routes/facilities');
const doctorsRoutes      = require('./routes/doctors');
const specialitiesRoutes = require('./routes/specialities');
const appointmentsRoutes = require('./routes/appointments');
const revenueRoutes      = require('./routes/revenue');
const dashboardRoutes    = require('./routes/dashboard');
const aiRoutes           = require('./routes/ai');
const usersRoutes        = require('./routes/users');

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Health Check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MediCRM API', timestamp: new Date() });
});

// ─── API Routes ───────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/leads',        leadsRoutes);
app.use('/api/patients',     patientsRoutes);
app.use('/api/facilities',   facilitiesRoutes);
app.use('/api/doctors',      doctorsRoutes);
app.use('/api/specialities', specialitiesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/revenue',      revenueRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/users',        usersRoutes);

// ─── 404 ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 MediCRM API running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints: http://localhost:${PORT}/health\n`);
});
