const db = require('../config/db');

// GET /api/leads/:leadId/interactions
const getInteractions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.*, u.name AS agent_name
       FROM interactions i
       JOIN users u ON u.id = i.agent_id
       WHERE i.lead_id = ?
       ORDER BY i.interaction_date DESC`,
      [req.params.leadId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads/:leadId/interactions
const createInteraction = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { interaction_type, outcome, notes, followup_date, interaction_date, agent_id, objection_category } = req.body;

    if (!outcome) return res.status(400).json({ success: false, message: 'outcome is required' });

    const agentId = agent_id || req.user.id;
    const type    = interaction_type || 'call';

    const [result] = await db.query(
      `INSERT INTO interactions (lead_id, agent_id, interaction_type, outcome, notes, followup_date, interaction_date)
       VALUES (?,?,?,?,?,?,?)`,
      [leadId, agentId, type, outcome, notes || null,
       followup_date || null, interaction_date || new Date()]
    );

    // Auto-update lead followup date if provided
    if (followup_date) {
      await db.query('UPDATE leads SET followup_date = ? WHERE id = ?', [followup_date, leadId]);
    }

    // ── AGENT WORKFLOW RULES ──
    const isContactAttempt = ['call', 'whatsapp', 'sms'].includes(type);
    if (isContactAttempt) {
      // Get current lead state
      const [[lead]] = await db.query(
        'SELECT lead_stage, attempt_count FROM leads WHERE id = ?', [leadId]);

      if (lead) {
        const newCount = (lead.attempt_count || 0) + 1;

        // Increment attempt counter
        await db.query('UPDATE leads SET attempt_count = ? WHERE id = ?', [newCount, leadId]);

        // Auto-transition: after 3 failed attempts with no response → unanswered
        const noResponseOutcomes = ['no answer', 'no response', 'not reachable', 'busy', 'switched off'];
        const isNoResponse = noResponseOutcomes.some(o => outcome.toLowerCase().includes(o));

        if (isNoResponse && newCount >= 3 &&
            ['untouched', 'attempted', 'unanswered'].includes(lead.lead_stage)) {
          await db.query(
            "UPDATE leads SET lead_stage='unanswered', lead_substage='Stale – No Response After 3 Attempts' WHERE id = ?",
            [leadId]);
        } else if (lead.lead_stage === 'untouched') {
          // First contact attempt → move to attempted
          await db.query(
            "UPDATE leads SET lead_stage='attempted', lead_substage=? WHERE id = ?",
            [`Attempt ${newCount} – Follow-up Scheduled`, leadId]);
        } else if (lead.lead_stage === 'attempted' && newCount < 3) {
          // Update substage to reflect attempt number
          await db.query(
            "UPDATE leads SET lead_substage=? WHERE id = ?",
            [`Attempt ${newCount} – Follow-up Scheduled`, leadId]);
        }
      }
    }

    const [created] = await db.query(
      `SELECT i.*, u.name AS agent_name FROM interactions i LEFT JOIN users u ON u.id = i.agent_id WHERE i.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/interactions/:id
const deleteInteraction = async (req, res) => {
  try {
    await db.query('DELETE FROM interactions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Interaction deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getInteractions, createInteraction, deleteInteraction };
