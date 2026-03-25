const db = require('../config/db');
const { fireWebhook } = require('./webhookDispatcher');

async function auditLog(userId, entityType, entityId, action, oldVal, newVal, ip) {
  try {
    await db.query(
      'INSERT INTO audit_logs (user_id,entity_type,entity_id,action,old_values,new_values,ip_address) VALUES (?,?,?,?,?,?,?)',
      [userId, entityType, entityId, action,
       oldVal ? JSON.stringify(oldVal) : null,
       newVal ? JSON.stringify(newVal) : null, ip]
    );
  } catch (_) {}
}

exports.getLeads = async (req, res) => {
  try {
    const { stage, source, speciality_id, facility_id, doctor_id, assigned_to,
            search, page = 1, limit = 50, sort_by = 'enquiry_date', sort_dir = 'DESC',
            date_from, date_to } = req.query;
    // Map frontend sort keys to DB columns
    const sortMap = {
      name: 'p.full_name', phone: 'p.primary_phone', date: 'l.enquiry_date',
      ai_score: 'l.ai_score', stage: 'l.lead_stage', 'follow-up': 'l.followup_date',
      source: 'l.lead_source', facility: 'f.name', speciality: 'sp.name', doctor: 'd.name'
    };
    const orderBy = sortMap[sort_by] || 'l.enquiry_date';
    const dir = sort_dir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    let where = ['1=1'], params = [];
    if (stage)         { where.push('l.lead_stage=?');    params.push(stage); }
    if (source)        { where.push('l.lead_source=?');   params.push(source); }
    if (speciality_id) { where.push('l.speciality_id=?'); params.push(speciality_id); }
    if (facility_id)   { where.push('l.facility_id=?');   params.push(facility_id); }
    if (doctor_id)     { where.push('l.doctor_id=?');     params.push(doctor_id); }
    if (assigned_to)   { where.push('l.assigned_to=?');   params.push(assigned_to); }
    if (date_from)     { where.push('DATE(l.enquiry_date) >= ?'); params.push(date_from); }
    if (date_to)       { where.push('DATE(l.enquiry_date) <= ?'); params.push(date_to); }
    if (search) {
      where.push('(p.full_name LIKE ? OR p.primary_phone LIKE ? OR p.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (['agent','calling_agent'].includes(req.user.role)) {
      where.push('l.assigned_to=?'); params.push(req.user.id);
    }
    const whereStr = where.join(' AND ');
    const safeLimit = Math.min(parseInt(limit) || 50, 500);
    const offset   = (parseInt(page) - 1) * safeLimit;
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leads l JOIN patients p ON p.id=l.patient_id WHERE ${whereStr}`, params);
    const [rows] = await db.query(
      `SELECT l.id, l.lead_stage, l.lead_substage, l.lead_source, l.lead_medium,
              l.campaign_name, l.enquiry_type, l.medical_concern, l.urgency,
              l.followup_date, l.ai_score, l.ai_priority,
              l.ai_reason, l.ai_next_action, l.enquiry_date, l.created_at,
              p.id AS patient_id, p.full_name AS patient_name, p.primary_phone,
              p.email AS patient_email, p.city, p.patient_type,
              f.id AS facility_id, f.name AS facility_name,
              sp.id AS speciality_id, sp.name AS speciality_name,
              d.id AS doctor_id, d.name AS doctor_name,
              u.id AS agent_id, u.name AS agent_name
       FROM leads l
       JOIN patients p      ON p.id  = l.patient_id
       JOIN facilities f    ON f.id  = l.facility_id
       JOIN specialities sp ON sp.id = l.speciality_id
       LEFT JOIN doctors d  ON d.id  = l.doctor_id
       LEFT JOIN users u    ON u.id  = l.assigned_to
       WHERE ${whereStr} ORDER BY ${orderBy} ${dir} LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]);
    res.json({ data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getLeadById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.*, p.full_name AS patient_name, p.primary_phone, p.email AS patient_email,
              p.city, p.patient_type, f.name AS facility_name, sp.name AS speciality_name,
              d.name AS doctor_name, u.name AS agent_name
       FROM leads l
       JOIN patients p      ON p.id  = l.patient_id
       JOIN facilities f    ON f.id  = l.facility_id
       JOIN specialities sp ON sp.id = l.speciality_id
       LEFT JOIN doctors d  ON d.id  = l.doctor_id
       LEFT JOIN users u    ON u.id  = l.assigned_to
       WHERE l.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });
    const [interactions] = await db.query(
      'SELECT i.*, u.name AS agent_name FROM interactions i LEFT JOIN users u ON u.id=i.agent_id WHERE i.lead_id=? ORDER BY i.interaction_date DESC', [req.params.id]);
    const [appointments] = await db.query(
      'SELECT a.*, d.name AS doctor_name, f.name AS facility_name FROM appointments a LEFT JOIN doctors d ON d.id=a.doctor_id LEFT JOIN facilities f ON f.id=a.facility_id WHERE a.lead_id=? ORDER BY a.appointment_date DESC', [req.params.id]);
    const [revenue] = await db.query('SELECT * FROM revenue WHERE lead_id=? ORDER BY billed_date DESC', [req.params.id]);
    res.json({ ...rows[0], interactions, appointments, revenue });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createLead = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { full_name, primary_phone, email, city, patient_type='new',
            facility_id, speciality_id, doctor_id, assigned_to,
            enquiry_type='appointment', medical_concern, urgency='medium',
            lead_source, lead_medium, campaign_name,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            stage='Untouched', substage='Fresh Lead', followup_date } = req.body;
    if (!full_name||!primary_phone||!facility_id||!speciality_id||!lead_source)
      return res.status(400).json({ error: 'full_name, primary_phone, facility_id, speciality_id, lead_source required' });
    const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM patients');
    const unique_pid = `PAT-${String(count + 1).padStart(5, '0')}`;
    let patientId;
    const [existing] = await conn.query('SELECT id FROM patients WHERE primary_phone=?', [primary_phone]);
    if (existing.length) {
      patientId = existing[0].id;
    } else {
      const [ins] = await conn.query(
        'INSERT INTO patients (unique_pid, full_name, primary_phone, email, city, patient_type) VALUES (?,?,?,?,?,?)',
        [unique_pid, full_name, primary_phone, email||null, city||null, patient_type]);
      patientId = ins.insertId;
    }
    const [leadIns] = await conn.query(
      `INSERT INTO leads (patient_id,facility_id,speciality_id,doctor_id,assigned_to,
        enquiry_type,medical_concern,urgency,lead_source,lead_medium,campaign_name,
        utm_source,utm_medium,utm_campaign,utm_term,utm_content,lead_stage,lead_substage,followup_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [patientId,facility_id,speciality_id,doctor_id||null,assigned_to||null,
       enquiry_type,medical_concern||null,urgency,lead_source,lead_medium||null,campaign_name||null,
       utm_source||null,utm_medium||null,utm_campaign||null,utm_term||null,utm_content||null,
       stage,substage,followup_date||null]);
    await conn.commit();
    await auditLog(req.user.id,'lead',leadIns.insertId,'CREATE',null,req.body,req.ip);
    fireWebhook('lead_created', { id: leadIns.insertId, ...req.body });
    res.status(201).json({ message: 'Lead created', id: leadIns.insertId });
  } catch (err) { await conn.rollback(); res.status(500).json({ error: err.message }); }
  finally { conn.release(); }
};

exports.updateLead = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM leads WHERE id=?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Lead not found' });
    const allowed = ['facility_id','speciality_id','doctor_id','assigned_to','enquiry_type',
                     'medical_concern','urgency','lead_source','lead_medium','campaign_name',
                     'utm_source','utm_medium','utm_campaign','utm_term','utm_content','followup_date'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k]!==undefined) updates[k]=req.body[k]; });
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update' });
    const setClauses = Object.keys(updates).map(k=>`${k}=?`).join(', ');
    await db.query(`UPDATE leads SET ${setClauses} WHERE id=?`, [...Object.values(updates), req.params.id]);
    await auditLog(req.user.id,'lead',req.params.id,'UPDATE',existing[0],updates,req.ip);
    res.json({ message: 'Lead updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateStage = async (req, res) => {
  try {
    const { stage, substage } = req.body;
    if (!stage) return res.status(400).json({ error: 'stage required' });
    const VALID = ['untouched','attempted','interested','customer','not_interested','ineligible','invalid','unanswered','potential'];
    if (!VALID.includes(stage)) return res.status(400).json({ error: 'Invalid stage: ' + stage });
    const [existing] = await db.query('SELECT lead_stage FROM leads WHERE id=?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Lead not found' });
    await db.query('UPDATE leads SET lead_stage=?, lead_substage=? WHERE id=?', [stage, substage||stage, req.params.id]);
    fireWebhook('lead_stage_changed', { id: req.params.id, lead_stage: stage, lead_substage: substage, changed_by: req.user.id });
    await auditLog(req.user.id,'lead',req.params.id,'STAGE_CHANGE',{lead_stage:existing[0].lead_stage},{lead_stage:stage,lead_substage:substage},req.ip);
    res.json({ message: 'Stage updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateAI = async (req, res) => {
  try {
    const { ai_score, ai_priority, ai_reason, ai_next_action } = req.body;
    await db.query('UPDATE leads SET ai_score=?,ai_priority=?,ai_reason=?,ai_next_action=? WHERE id=?',
      [ai_score, ai_priority||'Medium', ai_reason||null, ai_next_action||null, req.params.id]);
    res.json({ message: 'AI score updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteLead = async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM leads WHERE id=?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Lead not found' });
    await db.query('DELETE FROM leads WHERE id=?', [req.params.id]);
    await auditLog(req.user.id,'lead',req.params.id,'DELETE',existing[0],null,req.ip);
    res.json({ message: 'Lead deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
