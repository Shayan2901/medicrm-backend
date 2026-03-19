const db = require('../config/db');

// GET /dashboard/summary
exports.getSummary = async (req, res) => {
  try {
    const [[stats]] = await db.query('SELECT * FROM v_dashboard_stats');
    const [bySource] = await db.query(
      'SELECT lead_source, COUNT(*) AS count FROM leads GROUP BY lead_source ORDER BY count DESC');
    const [bySpeciality] = await db.query(
      'SELECT sp.name AS speciality, COUNT(*) AS count FROM leads l JOIN specialities sp ON sp.id=l.speciality_id GROUP BY sp.name ORDER BY count DESC');
    const [[revSummary]] = await db.query(
      'SELECT COALESCE(SUM(total_value),0) AS total_revenue, COUNT(*) AS revenue_count FROM revenue');
    const [recentLeads] = await db.query(
      `SELECT l.id, l.lead_stage, l.lead_source, l.enquiry_date,
              p.full_name AS patient_name, sp.name AS speciality_name
       FROM leads l
       JOIN patients p ON p.id = l.patient_id
       LEFT JOIN specialities sp ON sp.id = l.speciality_id
       ORDER BY l.enquiry_date DESC LIMIT 10`);
    const [atRisk] = await db.query(
      `SELECT l.id, p.full_name, p.primary_phone, l.followup_date, sp.name AS speciality_name
       FROM leads l
       JOIN patients p ON p.id = l.patient_id
       JOIN specialities sp ON sp.id = l.speciality_id
       WHERE l.lead_stage = 'attempted'
         AND (l.followup_date IS NULL OR l.followup_date <= CURDATE())
       LIMIT 20`);
    res.json({ stats, bySource, bySpeciality, revenue: revSummary, recentLeads, atRisk });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /dashboard/marketing
exports.getMarketingStats = async (req, res) => {
  try {
    const [[stats]] = await db.query('SELECT * FROM v_dashboard_stats');
    const [bySource] = await db.query(
      `SELECT lead_source,
              COUNT(*) AS total_leads,
              SUM(lead_stage='customer') AS customers,
              ROUND(SUM(lead_stage='customer') / COUNT(*) * 100, 1) AS conversion_rate
       FROM leads GROUP BY lead_source ORDER BY total_leads DESC`);
    const [byCampaign] = await db.query(
      `SELECT campaign_name, COUNT(*) AS total_leads,
              SUM(lead_stage='customer') AS customers
       FROM leads WHERE campaign_name IS NOT NULL AND campaign_name != ''
       GROUP BY campaign_name ORDER BY total_leads DESC LIMIT 10`);
    res.json({ stats, bySource, byCampaign });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /dashboard/cxo
exports.getCXOStats = async (req, res) => {
  try {
    const [[stats]] = await db.query('SELECT * FROM v_dashboard_stats');

    // Revenue summary
    const [[revSummary]] = await db.query(
      'SELECT COALESCE(SUM(total_value),0) AS total_revenue, COUNT(*) AS revenue_count FROM revenue');

    // Acquisition: leads by channel with conversion
    const [byChannel] = await db.query(
      `SELECT lead_source AS channel,
              COUNT(*) AS total_leads,
              SUM(lead_stage='customer') AS customers,
              ROUND(SUM(lead_stage='customer') / COUNT(*) * 100, 1) AS conversion_rate
       FROM leads GROUP BY lead_source ORDER BY total_leads DESC`);

    // Conversion funnel
    const [[funnel]] = await db.query(
      `SELECT
        COUNT(*) AS total_leads,
        SUM(lead_stage != 'untouched') AS contacted,
        (SELECT COUNT(*) FROM appointments) AS total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE visit_status = 'visited') AS visited
       FROM leads`);

    // Clinical demand: leads by speciality
    const [bySpeciality] = await db.query(
      `SELECT sp.name AS speciality,
              COUNT(*) AS total_leads,
              SUM(l.lead_stage='customer') AS customers,
              ROUND(SUM(l.lead_stage='customer') / COUNT(*) * 100, 1) AS conversion_rate
       FROM leads l JOIN specialities sp ON sp.id = l.speciality_id
       GROUP BY sp.name ORDER BY total_leads DESC`);

    // Clinical demand: leads by doctor
    const [byDoctor] = await db.query(
      `SELECT d.name AS doctor, sp.name AS speciality,
              COUNT(*) AS total_leads,
              SUM(l.lead_stage='customer') AS customers
       FROM leads l
       JOIN doctors d ON d.id = l.doctor_id
       JOIN specialities sp ON sp.id = l.speciality_id
       GROUP BY d.name, sp.name ORDER BY total_leads DESC LIMIT 10`);

    // Facility performance
    const [byFacility] = await db.query(
      `SELECT f.name AS facility,
              COUNT(*) AS total_leads,
              SUM(l.lead_stage='customer') AS customers,
              ROUND(SUM(l.lead_stage='customer') / COUNT(*) * 100, 1) AS conversion_rate
       FROM leads l JOIN facilities f ON f.id = l.facility_id
       GROUP BY f.name ORDER BY total_leads DESC`);

    // Revenue by speciality
    const [revBySpeciality] = await db.query(
      `SELECT sp.name AS speciality,
              COALESCE(SUM(r.total_value),0) AS revenue,
              COUNT(r.id) AS count
       FROM leads l
       JOIN specialities sp ON sp.id = l.speciality_id
       LEFT JOIN revenue r ON r.lead_id = l.id
       GROUP BY sp.name ORDER BY revenue DESC`);

    // No-show rate
    const [[noShow]] = await db.query(
      `SELECT
        COUNT(*) AS total_appointments,
        SUM(visit_status='no_show') AS no_shows,
        SUM(visit_status='visited') AS visited,
        ROUND(SUM(visit_status='no_show') / COUNT(*) * 100, 1) AS no_show_rate
       FROM appointments`);

    // Demand Growth Trends — last 12 months
    const [leadsByMonth] = await db.query(
      `SELECT DATE_FORMAT(enquiry_date,'%Y-%m') AS month,
              COUNT(*) AS total_leads,
              SUM(lead_stage='customer') AS customers,
              ROUND(SUM(lead_stage='customer') / COUNT(*) * 100, 1) AS conversion_rate
       FROM leads
       WHERE enquiry_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`);

    // Speciality demand trend — top 5 specialities month by month
    const [specTrend] = await db.query(
      `SELECT DATE_FORMAT(l.enquiry_date,'%Y-%m') AS month,
              sp.name AS speciality,
              COUNT(*) AS total_leads
       FROM leads l
       JOIN specialities sp ON sp.id = l.speciality_id
       WHERE l.enquiry_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month, sp.name ORDER BY month ASC, total_leads DESC`);

    // Channel trend — leads by source month by month
    const [channelTrend] = await db.query(
      `SELECT DATE_FORMAT(enquiry_date,'%Y-%m') AS month,
              lead_source AS channel,
              COUNT(*) AS total_leads
       FROM leads
       WHERE enquiry_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month, lead_source ORDER BY month ASC`);

    res.json({
      stats, revenue: revSummary,
      byChannel, funnel, bySpeciality, byDoctor,
      byFacility, revBySpeciality, noShow,
      leadsByMonth, specTrend, channelTrend
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /dashboard/finance
exports.getFinanceStats = async (req, res) => {
  try {
    // Total revenue summary
    const [[revSummary]] = await db.query(
      `SELECT
        COALESCE(SUM(total_value),0)               AS total_revenue,
        COALESCE(SUM(consultation_value),0)        AS total_consultation,
        COALESCE(SUM(procedure_value),0)           AS total_procedure,
        COALESCE(SUM(package_value),0)             AS total_package,
        COUNT(*)                                   AS revenue_count,
        COALESCE(AVG(total_value),0)               AS avg_revenue
       FROM revenue`);

    // Revenue by month (last 12)
    const [byMonth] = await db.query(
      `SELECT DATE_FORMAT(billed_date,'%Y-%m') AS month,
              COALESCE(SUM(total_value),0)        AS revenue,
              COALESCE(SUM(consultation_value),0) AS consultation,
              COALESCE(SUM(procedure_value),0)    AS proc_value,
              COUNT(*)                            AS count
       FROM revenue
       GROUP BY month ORDER BY month ASC LIMIT 12`);

    // Revenue by channel (lead source)
    const [byChannel] = await db.query(
      `SELECT l.lead_source AS channel,
              COALESCE(SUM(r.total_value),0)  AS revenue,
              COUNT(r.id)                      AS count,
              ROUND(AVG(r.total_value),0)      AS avg_value
       FROM leads l
       LEFT JOIN revenue r ON r.lead_id = l.id
       WHERE r.id IS NOT NULL
       GROUP BY l.lead_source ORDER BY revenue DESC`);

    // Revenue by speciality
    const [bySpeciality] = await db.query(
      `SELECT sp.name AS speciality,
              COALESCE(SUM(r.total_value),0)  AS revenue,
              COUNT(r.id)                      AS count,
              ROUND(AVG(r.total_value),0)      AS avg_value
       FROM leads l
       JOIN specialities sp ON sp.id = l.speciality_id
       LEFT JOIN revenue r ON r.lead_id = l.id
       WHERE r.id IS NOT NULL
       GROUP BY sp.name ORDER BY revenue DESC`);

    // Revenue by facility
    const [byFacility] = await db.query(
      `SELECT f.name AS facility,
              COALESCE(SUM(r.total_value),0)  AS revenue,
              COUNT(r.id)                      AS count
       FROM leads l
       JOIN facilities f ON f.id = l.facility_id
       LEFT JOIN revenue r ON r.lead_id = l.id
       WHERE r.id IS NOT NULL
       GROUP BY f.name ORDER BY revenue DESC`);

    // High-value patients (top 20 by total revenue)
    const [highValue] = await db.query(
      `SELECT p.full_name, p.primary_phone, p.city,
              COALESCE(SUM(r.total_value),0)  AS total_revenue,
              COUNT(r.id)                      AS visit_count,
              MAX(r.billed_date)               AS last_visit
       FROM patients p
       JOIN revenue r ON r.patient_id = p.id
       GROUP BY p.id, p.full_name, p.primary_phone, p.city
       ORDER BY total_revenue DESC LIMIT 20`);

    // Payment status breakdown
    const [byPaymentStatus] = await db.query(
      `SELECT payment_status,
              COUNT(*) AS count,
              COALESCE(SUM(total_value),0) AS revenue
       FROM revenue GROUP BY payment_status`);

    res.json({
      summary: revSummary, byMonth, byChannel,
      bySpeciality, byFacility, highValue, byPaymentStatus
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
