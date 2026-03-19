const db = require('../config/db');

// Helper: get email config from DB
async function getEmailConfig() {
  const [rows] = await db.query("SELECT setting_value FROM system_settings WHERE setting_key='email_config' LIMIT 1");
  if (!rows.length) return null;
  return JSON.parse(rows[0].setting_value);
}

// Helper: send email via SendGrid
async function sendViaSendGrid(config, { to, subject, html }) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.sendgrid_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.from_email, name: config.from_name || 'MediCRM' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  return res.status;
}

// POST /api/settings/email — save config
exports.saveEmailConfig = async (req, res) => {
  try {
    const { sendgrid_key, from_email, from_name } = req.body;
    if (!sendgrid_key || !from_email) return res.status(400).json({ success:false, message:'API key and from email required' });
    await db.query(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES ('email_config', ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
      [JSON.stringify({ sendgrid_key, from_email, from_name: from_name||'MediCRM' })]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// POST /api/settings/email/test — send test email
exports.testEmail = async (req, res) => {
  try {
    const config = await getEmailConfig();
    if (!config) return res.status(400).json({ success:false, message:'Email not configured. Save config first.' });
    const { to } = req.body;
    if (!to) return res.status(400).json({ success:false, message:'Recipient email required' });
    const status = await sendViaSendGrid(config, {
      to,
      subject: 'MediCRM — Test Email',
      html: `<div style="font-family:sans-serif;padding:24px;background:#f5f7fa;border-radius:8px">
        <h2 style="color:#0066ff">✅ MediCRM Email Integration Working</h2>
        <p>This is a test email from your MediCRM system.</p>
        <p style="color:#64748b;font-size:12px">Sent via SendGrid · MediCRM Healthcare Platform</p>
      </div>`,
    });
    if (status >= 200 && status < 300) {
      res.json({ success:true, message:`Test email sent (HTTP ${status})` });
    } else {
      res.status(400).json({ success:false, message:`SendGrid returned HTTP ${status}` });
    }
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// POST /api/email/send — send any email from MediCRM
exports.sendEmail = async (req, res) => {
  try {
    const config = await getEmailConfig();
    if (!config) return res.status(400).json({ success:false, message:'Email not configured' });
    const { to, subject, html, lead_id } = req.body;
    const status = await sendViaSendGrid(config, { to, subject, html });
    // Log as interaction if lead_id provided
    if (lead_id && status < 300) {
      await db.query(
        'INSERT INTO interactions (lead_id, agent_id, interaction_type, outcome, notes, interaction_date) VALUES (?,?,?,?,?,NOW())',
        [lead_id, req.user.id, 'email', 'Email sent', `Subject: ${subject}`]
      );
    }
    res.json({ success: status < 300, status });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

module.exports = exports;
