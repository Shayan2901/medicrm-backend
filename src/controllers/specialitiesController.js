const db = require('../config/db');
exports.getAll = async (req,res) => { try { const [r] = await db.query('SELECT * FROM specialities WHERE is_active=1 ORDER BY name'); res.json(r); } catch(e){res.status(500).json({error:e.message});} };
exports.create = async (req,res) => { try { const {name,description}=req.body; if(!name) return res.status(400).json({error:'name required'}); await db.query('INSERT INTO specialities (name,description) VALUES (?,?)',[name,description||null]); res.status(201).json({message:'Speciality created'}); } catch(e){res.status(500).json({error:e.message});} };
