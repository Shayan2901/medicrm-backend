const db = require('../config/db');

exports.getRevenue = async (req, res) => {
  try {
    const { facility_id, speciality_id, date_from, date_to, page=1, limit=50 } = req.query;
    let where = ['1=1'], params = [];
    if (facility_id)   { where.push('l.facility_id=?');   params.push(facility_id); }
    if (speciality_id) { where.push('l.speciality_id=?'); params.push(speciality_id); }
    if (date_from)     { where.push('r.billed_date>=?');   params.push(date_from); }
    if (date_to)       { where.push('r.billed_date<=?');   params.push(date_to); }
    const whereStr = where.join(' AND ');
    const offset = (parseInt(page)-1)*parseInt(limit);
    const [[{total}]] = await db.query(`SELECT COUNT(*) AS total FROM revenue r JOIN leads l ON l.id=r.lead_id WHERE ${whereStr}`, params);
    const [rows] = await db.query(
      `SELECT r.*, p.full_name AS patient_name, f.name AS facility_name, sp.name AS speciality_name, d.name AS doctor_name
       FROM revenue r
       JOIN leads l         ON l.id  = r.lead_id
       JOIN patients p      ON p.id  = r.patient_id
       JOIN facilities f    ON f.id  = l.facility_id
       JOIN specialities sp ON sp.id = l.speciality_id
       LEFT JOIN doctors d  ON d.id  = l.doctor_id
       WHERE ${whereStr} ORDER BY r.billed_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]);
    const [[summary]] = await db.query(
      `SELECT COALESCE(SUM(r.total_value),0) AS total, COUNT(*) AS count, COALESCE(AVG(r.total_value),0) AS avg
       FROM revenue r JOIN leads l ON l.id=r.lead_id WHERE ${whereStr}`, params);
    res.json({ data: rows, summary, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createRevenue = async (req, res) => {
  try {
    const { appointment_id, lead_id, patient_id, consultation_value=0, procedure_value=0, package_value=0, payment_status='pending', notes, billed_date } = req.body;
    if (!appointment_id||!lead_id||!patient_id) return res.status(400).json({ error: 'appointment_id, lead_id, patient_id required' });
    const [ins] = await db.query(
      'INSERT INTO revenue (appointment_id,lead_id,patient_id,consultation_value,procedure_value,package_value,payment_status,notes,billed_date) VALUES (?,?,?,?,?,?,?,?,?)',
      [appointment_id, lead_id, patient_id, consultation_value, procedure_value, package_value, payment_status, notes||null, billed_date||null]);
    await db.query("UPDATE leads SET stage='Customer', substage='Revenue Captured' WHERE id=?", [lead_id]);
    res.status(201).json({ message: 'Revenue recorded', id: ins.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
