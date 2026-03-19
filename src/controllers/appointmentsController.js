const db = require('../config/db');

exports.getAppointments = async (req, res) => {
  try {
    const { status, facility_id, doctor_id, date_from, date_to, page=1, limit=50 } = req.query;
    let where = ['1=1'], params = [];
    if (status)      { where.push('a.visit_status=?');   params.push(status); }
    if (facility_id) { where.push('a.facility_id=?');    params.push(facility_id); }
    if (doctor_id)   { where.push('a.doctor_id=?');      params.push(doctor_id); }
    if (date_from)   { where.push('a.appointment_date>=?'); params.push(date_from); }
    if (date_to)     { where.push('a.appointment_date<=?'); params.push(date_to); }
    const whereStr = where.join(' AND ');
    const offset = (parseInt(page)-1)*parseInt(limit);
    const [[{total}]] = await db.query(`SELECT COUNT(*) AS total FROM appointments a WHERE ${whereStr}`, params);
    const [rows] = await db.query(
      `SELECT a.*, p.full_name AS patient_name, p.primary_phone, d.name AS doctor_name,
              f.name AS facility_name, sp.name AS speciality_name
       FROM appointments a
       JOIN patients p      ON p.id  = a.patient_id
       JOIN facilities f    ON f.id  = a.facility_id
       JOIN specialities sp ON sp.id = (SELECT speciality_id FROM leads WHERE id=a.lead_id LIMIT 1)
       LEFT JOIN doctors d  ON d.id  = a.doctor_id
       WHERE ${whereStr} ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]);
    res.json({ data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createAppointment = async (req, res) => {
  try {
    const { lead_id, patient_id, facility_id, doctor_id, appointment_date, consult_type='opd', notes } = req.body;
    if (!lead_id||!patient_id||!facility_id||!appointment_date) return res.status(400).json({ error: 'lead_id, patient_id, facility_id, appointment_date required' });
    const [ins] = await db.query(
      'INSERT INTO appointments (lead_id,patient_id,facility_id,doctor_id,appointment_date,consult_type,notes) VALUES (?,?,?,?,?,?,?)',
      [lead_id, patient_id, facility_id, doctor_id||null, appointment_date, consult_type, notes||null]);
    await db.query("UPDATE leads SET lead_stage='customer', lead_substage='Super Hot – Booked' WHERE id=?", [lead_id]);
    res.status(201).json({ message: 'Appointment created', id: ins.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { visit_status, notes } = req.body;
    if (!visit_status) return res.status(400).json({ error: 'visit_status required' });
    const [appt] = await db.query('SELECT * FROM appointments WHERE id=?', [req.params.id]);
    if (!appt.length) return res.status(404).json({ error: 'Appointment not found' });
    await db.query('UPDATE appointments SET visit_status=?, notes=COALESCE(?,notes) WHERE id=?', [visit_status, notes||null, req.params.id]);
    if (visit_status==='visited') {
      await db.query("UPDATE leads SET lead_stage='customer', lead_substage='Visited' WHERE id=?", [appt[0].lead_id]);
    }
    res.json({ message: 'Appointment updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
