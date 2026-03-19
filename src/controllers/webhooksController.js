const db = require('../config/db');

// GET /api/webhooks — list all configured webhooks
exports.getWebhooks = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM webhooks ORDER BY event_type');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/webhooks — upsert webhooks
exports.saveWebhooks = async (req, res) => {
  try {
    const { webhooks } = req.body;
    if (!Array.isArray(webhooks)) return res.status(400).json({ success: false, message: 'webhooks array required' });
    for (const w of webhooks) {
      if (!w.event_type || !w.url) continue;
      await db.query(
        `INSERT INTO webhooks (event_type, url, is_active, created_by)
         VALUES (?,?,1,?)
         ON DUPLICATE KEY UPDATE url=VALUES(url), is_active=1, updated_at=NOW()`,
        [w.event_type, w.url, req.user.id]
      );
    }
    res.json({ success: true, message: 'Webhooks saved' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/webhooks/:event_type — disable a webhook
exports.deleteWebhook = async (req, res) => {
  try {
    await db.query('UPDATE webhooks SET is_active=0 WHERE event_type=?', [req.params.event_type]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/webhooks/test/:event_type — send test payload
exports.testWebhook = async (req, res) => {
  try {
    const [hooks] = await db.query(
      'SELECT url FROM webhooks WHERE event_type=? AND is_active=1', [req.params.event_type]);
    if (!hooks.length) return res.status(404).json({ success: false, message: 'No webhook configured for this event' });

    const testPayload = {
      event:     req.params.event_type,
      timestamp: new Date().toISOString(),
      source:    'MediCRM',
      test:      true,
      data: {
        id: 999, full_name: "Test Patient", primary_phone: "+971500000000",
        lead_stage: "interested", lead_source: "Google Ads",
        facility_name: "Test Clinic", speciality_name: "General Medicine",
        enquiry_date: new Date().toISOString(),
      }
    };

    const response = await fetch(hooks[0].url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    res.json({ success: true, status: response.status, message: `Test sent to Zapier (HTTP ${response.status})` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
