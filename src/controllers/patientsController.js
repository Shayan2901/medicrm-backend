const db = require('../config/db');

exports.getPatients = async (req, res) => {
  try {
    const { search, page=1, limit=50 } = req.query;
    let where = ['1=1'], params = [];
    if (search) { where.push('(full_name LIKE ? OR primary_phone LIKE ? OR email LIKE ?)'); params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    const whereStr = where.join(' AND ');
    const offset = (parseInt(page)-1)*parseInt(limit);
    const [[{total}]] = await db.query(`SELECT COUNT(*) AS total FROM patients WHERE ${whereStr}`, params);
    const [rows] = await db.query(`SELECT * FROM patients WHERE ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
    res.json({ data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPatientById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM patients WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
    const [leads] = await db.query(
      'SELECT l.id, l.lead_stage, l.enquiry_type, l.enquiry_date, sp.name AS speciality, d.name AS doctor FROM leads l JOIN specialities sp ON sp.id=l.speciality_id LEFT JOIN doctors d ON d.id=l.doctor_id WHERE l.patient_id=? ORDER BY l.enquiry_date DESC',
      [req.params.id]);
    res.json({ ...rows[0], leads });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updatePatient = async (req, res) => {
  try {
    const allowed = ['full_name','email','city','age','gender','patient_type'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k]!==undefined) updates[k]=req.body[k]; });
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
    const setClauses = Object.keys(updates).map(k=>`${k}=?`).join(', ');
    await db.query(`UPDATE patients SET ${setClauses} WHERE id=?`, [...Object.values(updates), req.params.id]);
    res.json({ message: 'Patient updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
