const db   = require('../config/db');
const https = require('https');

function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY,
                 'anthropic-version':'2023-06-01', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text || '');
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// POST /api/ai/score/:leadId
exports.scoreLead = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT l.*, p.full_name, p.primary_phone, sp.name AS speciality, d.name AS doctor FROM leads l JOIN patients p ON p.id=l.patient_id JOIN specialities sp ON sp.id=l.speciality_id LEFT JOIN doctors d ON d.id=l.doctor_id WHERE l.id=?',
      [req.params.leadId]);
    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
    const l = rows[0];
    const [[{ interactions }]] = await db.query('SELECT COUNT(*) AS interactions FROM interactions WHERE lead_id=?', [l.id]);
    const systemPrompt = 'You are a healthcare CRM AI. Score leads 0-100 based on medical urgency, engagement level, enquiry type, and source quality. Respond ONLY with valid JSON: {"score":number,"reason":"short reason","priority":"High|Medium|Low","nextAction":"specific action"}';
    const userMessage = `Lead: ${l.full_name}, Concern: ${l.medical_concern}, Stage: ${l.lead_stage}, Substage: ${l.lead_substage}, Source: ${l.lead_source}, Speciality: ${l.speciality}, Interactions: ${interactions}, Urgency: ${l.urgency}`;
    const text = await callClaude(systemPrompt, userMessage);
    let result;
    try { result = JSON.parse(text.replace(/```json|```/g,'')); } catch { result = { score:50, reason:'Parse error', priority:'Medium', nextAction:'Follow up' }; }
    await db.query('UPDATE leads SET ai_score=?,ai_priority=?,ai_reason=?,ai_next_action=? WHERE id=?',
      [result.score, result.priority?.toLowerCase()||'medium', result.reason, result.nextAction, l.id]);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/ai/followup/:leadId
exports.getFollowUp = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT l.*, p.full_name, sp.name AS speciality, d.name AS doctor FROM leads l JOIN patients p ON p.id=l.patient_id JOIN specialities sp ON sp.id=l.speciality_id LEFT JOIN doctors d ON d.id=l.doctor_id WHERE l.id=?',
      [req.params.leadId]);
    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
    const l = rows[0];
    const systemPrompt = 'You are a healthcare CRM assistant. Given patient context, write a 2-3 sentence empathetic follow-up call script for a call center agent. Be specific and medically appropriate.';
    const userMessage = `Patient: ${l.full_name}, Concern: ${l.medical_concern}, Stage: ${l.lead_stage} (${l.lead_substage}), Speciality: ${l.speciality}, Doctor: ${l.doctor||'Not assigned'}`;
    const script = await callClaude(systemPrompt, userMessage);
    res.json({ script });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/ai/insight/:leadId
exports.getInsight = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT l.*, p.full_name, sp.name AS speciality FROM leads l JOIN patients p ON p.id=l.patient_id JOIN specialities sp ON sp.id=l.speciality_id WHERE l.id=?',
      [req.params.leadId]);
    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
    const l = rows[0];
    const systemPrompt = 'You are a senior healthcare CRM analyst. Give 3 bullet-point insights about: conversion probability, risk factors, and recommended action. Use • bullets. Be concise.';
    const userMessage = `Patient: ${l.full_name}, Concern: ${l.medical_concern}, Stage: ${l.lead_stage}, Substage: ${l.lead_substage}, Source: ${l.lead_source}, AI Score: ${l.ai_score}, Interactions: ${l.attempt_count}`;
    const insight = await callClaude(systemPrompt, userMessage);
    res.json({ insight });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/ai/cxo-insights
exports.getCxoInsights = async (req, res) => {
  try {
    const [[stats]]      = await db.query('SELECT * FROM v_dashboard_stats');
    const [bySource]     = await db.query('SELECT lead_source, COUNT(*) AS count FROM leads GROUP BY lead_source');
    const [[revenue]]    = await db.query('SELECT COALESCE(SUM(total_revenue),0) AS total FROM revenue');
    const [byFacility]   = await db.query('SELECT f.name, COUNT(*) AS leads, SUM(l.lead_stage="customer") AS customers FROM leads l JOIN facilities f ON f.id=l.facility_id GROUP BY f.name');
    const summary = { ...stats, revenue: revenue.total, bySource, byFacility };
    const systemPrompt = 'You are a CXO-level healthcare business intelligence AI. Analyze CRM data and provide 4 strategic insights with emojis. Focus on growth opportunities, risks, and actionable recommendations. Be direct and executive-friendly.';
    const insight = await callClaude(systemPrompt, `CRM Data: ${JSON.stringify(summary)}`);
    res.json({ insight });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
