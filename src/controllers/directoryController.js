const db = require('../config/db');

// ─── FACILITIES ───────────────────────────────────────────────────────────────
const getFacilities = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM facilities WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createFacility = async (req, res) => {
  try {
    const { name, type, city, location, region } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const [r] = await db.query(
      'INSERT INTO facilities (name, type, city, location, region) VALUES (?,?,?,?,?)',
      [name, type || 'clinic', city || null, location || null, region || null]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateFacility = async (req, res) => {
  try {
    const { name, type, city, location, region, is_active } = req.body;
    await db.query(
      'UPDATE facilities SET name=?, type=?, city=?, location=?, region=?, is_active=? WHERE id=?',
      [name, type, city, location, region, is_active, req.params.id]
    );
    res.json({ success: true, message: 'Facility updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── SPECIALITIES ─────────────────────────────────────────────────────────────
const getSpecialities = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM specialities WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createSpeciality = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const [r] = await db.query('INSERT INTO specialities (name, description) VALUES (?,?)', [name, description || null]);
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── DOCTORS ──────────────────────────────────────────────────────────────────
const getDoctors = async (req, res) => {
  try {
    const { facility_id, speciality_id } = req.query;
    let where = ['d.is_available = 1'];
    let params = [];
    if (facility_id)   { where.push('d.facility_id = ?');   params.push(facility_id); }
    if (speciality_id) { where.push('d.speciality_id = ?'); params.push(speciality_id); }

    const [rows] = await db.query(
      `SELECT d.*, s.name AS speciality_name, f.name AS facility_name
       FROM doctors d
       JOIN specialities s ON s.id = d.speciality_id
       JOIN facilities f   ON f.id = d.facility_id
       WHERE ${where.join(' AND ')}
       ORDER BY d.name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createDoctor = async (req, res) => {
  try {
    const { name, speciality_id, facility_id, consult_type } = req.body;
    if (!name || !speciality_id || !facility_id)
      return res.status(400).json({ success: false, message: 'name, speciality_id, facility_id required' });
    const [r] = await db.query(
      'INSERT INTO doctors (name, speciality_id, facility_id, consult_type) VALUES (?,?,?,?)',
      [name, speciality_id, facility_id, consult_type || 'opd']
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateDoctor = async (req, res) => {
  try {
    const { name, speciality_id, facility_id, consult_type, is_available } = req.body;
    await db.query(
      'UPDATE doctors SET name=?, speciality_id=?, facility_id=?, consult_type=?, is_available=? WHERE id=?',
      [name, speciality_id, facility_id, consult_type, is_available, req.params.id]
    );
    res.json({ success: true, message: 'Doctor updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── PATIENTS ────────────────────────────────────────────────────────────────
const getPatients = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    let where = ['1=1'];
    let params = [];
    if (search) {
      where.push('(full_name LIKE ? OR primary_phone LIKE ? OR email LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [rows] = await db.query(
      `SELECT * FROM patients WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getPatientById = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Patient not found' });

    const [leads] = await db.query(
      `SELECT l.id, l.lead_stage, l.lead_substage, l.enquiry_date, l.lead_source,
              s.name AS speciality, d.name AS doctor, f.name AS facility
       FROM leads l
       JOIN specialities s ON s.id = l.speciality_id
       LEFT JOIN doctors d ON d.id = l.doctor_id
       JOIN facilities f ON f.id = l.facility_id
       WHERE l.patient_id = ? ORDER BY l.created_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], leads } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── USERS ────────────────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name'
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateUser = async (req, res) => {
  try {
    const { name, role, is_active } = req.body;
    await db.query('UPDATE users SET name=?, role=?, is_active=? WHERE id=?',
      [name, role, is_active, req.params.id]);
    res.json({ success: true, message: 'User updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── DUPLICATE DETECTION ─────────────────────────────────────────────────────
const getDuplicatePatients = async (req, res) => {
  try {
    // Find patients with same name (case-insensitive, trimmed)
    const [byName] = await db.query(
      `SELECT
        LOWER(TRIM(full_name)) AS norm_name,
        COUNT(*) AS count,
        GROUP_CONCAT(id ORDER BY created_at ASC) AS ids,
        GROUP_CONCAT(full_name ORDER BY created_at ASC SEPARATOR '|||') AS names,
        GROUP_CONCAT(primary_phone ORDER BY created_at ASC SEPARATOR '|||') AS phones,
        GROUP_CONCAT(created_at ORDER BY created_at ASC SEPARATOR '|||') AS dates
       FROM patients
       GROUP BY norm_name
       HAVING count > 1
       ORDER BY count DESC
       LIMIT 50`
    );

    // Find patients with very similar phone (last 8 digits match)
    const [byPhone] = await db.query(
      `SELECT
        RIGHT(REGEXP_REPLACE(primary_phone,'[^0-9]',''), 8) AS phone_suffix,
        COUNT(*) AS count,
        GROUP_CONCAT(id ORDER BY created_at ASC) AS ids,
        GROUP_CONCAT(full_name ORDER BY created_at ASC SEPARATOR '|||') AS names,
        GROUP_CONCAT(primary_phone ORDER BY created_at ASC SEPARATOR '|||') AS phones
       FROM patients
       GROUP BY phone_suffix
       HAVING count > 1
       ORDER BY count DESC
       LIMIT 50`
    );

    // Format results
    const formatGroup = (rows, type) => rows.map(r => ({
      type,
      count: r.count,
      ids:    r.ids.split(','),
      names:  r.names.split('|||'),
      phones: r.phones.split('|||'),
      dates:  r.dates ? r.dates.split('|||') : [],
      key:    type === 'name' ? r.norm_name : r.phone_suffix,
    }));

    const duplicates = [
      ...formatGroup(byName, 'name'),
      ...formatGroup(byPhone, 'phone'),
    ];

    // Deduplicate groups that appear in both
    const seen = new Set();
    const unique = duplicates.filter(d => {
      const key = d.ids.sort().join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({ success: true, data: unique, total: unique.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Merge patients: keep primary, reassign all leads from secondary, delete secondary
const mergePatients = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { primary_id, secondary_ids } = req.body;
    if (!primary_id || !secondary_ids?.length)
      return res.status(400).json({ success: false, message: 'primary_id and secondary_ids required' });

    for (const secId of secondary_ids) {
      // Reassign all leads to primary patient
      await conn.query('UPDATE leads SET patient_id = ? WHERE patient_id = ?', [primary_id, secId]);
      // Reassign appointments
      await conn.query('UPDATE appointments SET patient_id = ? WHERE patient_id = ?', [primary_id, secId]);
      // Reassign revenue
      await conn.query('UPDATE revenue SET patient_id = ? WHERE patient_id = ?', [primary_id, secId]);
      // Delete the duplicate patient
      await conn.query('DELETE FROM patients WHERE id = ?', [secId]);
    }

    await conn.commit();
    res.json({ success: true, message: `Merged ${secondary_ids.length} duplicate(s) into primary patient` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
};

module.exports = {
  getFacilities, createFacility, updateFacility,
  getSpecialities, createSpeciality,
  getDoctors, createDoctor, updateDoctor,
  getPatients, getPatientById,
  getDuplicatePatients, mergePatients,
  getUsers, updateUser,
};
