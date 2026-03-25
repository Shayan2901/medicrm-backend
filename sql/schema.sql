-- ============================================================
--  MediCRM - Full MySQL Schema
--  Run this in MySQL Workbench:
--  File → Open SQL Script → Run (⚡)
-- ============================================================

CREATE DATABASE IF NOT EXISTS medicrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medicrm;

-- ─────────────────────────────────────────
-- 1. USERS (CRM Users / Agents / Admins)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role         ENUM('admin','cxo','marketing','finance','agent','calling_agent') NOT NULL DEFAULT 'agent',
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 2. FACILITIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name         VARCHAR(150) NOT NULL,
  type         ENUM('hospital','clinic','diagnostic_center') NOT NULL DEFAULT 'clinic',
  city         VARCHAR(100),
  region       VARCHAR(100),
  address      TEXT,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 3. SPECIALITIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS specialities (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name         VARCHAR(100) NOT NULL UNIQUE,
  description  TEXT,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 4. DOCTORS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name             VARCHAR(150) NOT NULL,
  speciality_id    VARCHAR(36)  NOT NULL,
  facility_id      VARCHAR(36)  NOT NULL,
  consult_type     SET('opd','surgery','tele','visiting') NOT NULL DEFAULT 'opd',
  availability     ENUM('available','unavailable','on_leave') NOT NULL DEFAULT 'available',
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (speciality_id) REFERENCES specialities(id),
  FOREIGN KEY (facility_id)   REFERENCES facilities(id)
);

-- ─────────────────────────────────────────
-- 5. PATIENTS (Master Identity)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  unique_pid     VARCHAR(20),
  full_name      VARCHAR(150) NOT NULL,
  primary_phone  VARCHAR(20)  NOT NULL UNIQUE,
  email          VARCHAR(150),
  city           VARCHAR(100),
  age            INT,
  gender         ENUM('male','female','other'),
  patient_type   ENUM('new','existing') NOT NULL DEFAULT 'new',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (primary_phone),
  INDEX idx_name  (full_name)
);

-- ─────────────────────────────────────────
-- 6. LEADS / ENQUIRIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  patient_id       VARCHAR(36)  NOT NULL,
  facility_id      VARCHAR(36)  NOT NULL,
  speciality_id    VARCHAR(36)  NOT NULL,
  doctor_id        VARCHAR(36),
  assigned_to      VARCHAR(36),

  -- Enquiry details
  enquiry_type     ENUM('appointment','consultation','procedure','package','emergency','teleconsult') NOT NULL DEFAULT 'appointment',
  medical_concern  TEXT,
  urgency          ENUM('low','medium','high','emergency') DEFAULT 'medium',

  -- Marketing Attribution
  lead_source      ENUM('google_ads','meta_ads','organic','direct','referral','walk_in','whatsapp','call','aggregator') NOT NULL DEFAULT 'direct',
  lead_medium      VARCHAR(100),
  campaign_name    VARCHAR(200),
  utm_source       VARCHAR(100),
  utm_medium       VARCHAR(100),
  utm_campaign     VARCHAR(200),
  utm_term         VARCHAR(200),
  utm_content      VARCHAR(200),

  -- Lead Stage Engine
  lead_stage       ENUM('untouched','attempted','interested','customer','not_interested') NOT NULL DEFAULT 'untouched',
  lead_substage    VARCHAR(100) NOT NULL DEFAULT 'Fresh Lead',

  -- Follow-up
  followup_date    DATE,
  attempt_count    INT          NOT NULL DEFAULT 0,

  -- AI
  ai_score         INT          DEFAULT 50,
  ai_priority      ENUM('high','medium','low') DEFAULT 'medium',
  ai_reason        TEXT,
  ai_next_action   TEXT,

  -- Timestamps
  enquiry_date     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id)    REFERENCES patients(id),
  FOREIGN KEY (facility_id)   REFERENCES facilities(id),
  FOREIGN KEY (speciality_id) REFERENCES specialities(id),
  FOREIGN KEY (doctor_id)     REFERENCES doctors(id),
  FOREIGN KEY (assigned_to)   REFERENCES users(id),

  INDEX idx_stage        (lead_stage),
  INDEX idx_source       (lead_source),
  INDEX idx_facility     (facility_id),
  INDEX idx_speciality   (speciality_id),
  INDEX idx_assigned     (assigned_to),
  INDEX idx_enquiry_date (enquiry_date)
);

-- ─────────────────────────────────────────
-- 7. INTERACTIONS (Agent Activity Log)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  lead_id          VARCHAR(36)  NOT NULL,
  agent_id         VARCHAR(36),
  interaction_type ENUM('call','whatsapp','email','sms','visit','note') NOT NULL DEFAULT 'call',
  outcome          VARCHAR(255) NOT NULL,
  notes            TEXT,
  followup_date    DATE,
  duration_mins    INT,
  interaction_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lead_id)  REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES users(id),
  INDEX idx_lead    (lead_id),
  INDEX idx_agent   (agent_id),
  INDEX idx_idate   (interaction_date)
);

-- ─────────────────────────────────────────
-- 8. APPOINTMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  lead_id          VARCHAR(36)  NOT NULL,
  patient_id       VARCHAR(36)  NOT NULL,
  facility_id      VARCHAR(36)  NOT NULL,
  doctor_id        VARCHAR(36),
  appointment_date DATETIME     NOT NULL,
  consult_type     ENUM('opd','surgery','tele','visiting') NOT NULL DEFAULT 'opd',
  visit_status     ENUM('booked','confirmed','visited','no_show','cancelled','rescheduled') NOT NULL DEFAULT 'booked',
  notes            TEXT,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (lead_id)     REFERENCES leads(id),
  FOREIGN KEY (patient_id)  REFERENCES patients(id),
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (doctor_id)   REFERENCES doctors(id),
  INDEX idx_appt_date  (appointment_date),
  INDEX idx_appt_status (visit_status)
);

-- ─────────────────────────────────────────
-- 9. REVENUE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue (
  id                 VARCHAR(36)    PRIMARY KEY DEFAULT (UUID()),
  appointment_id     VARCHAR(36)    NOT NULL,
  lead_id            VARCHAR(36)    NOT NULL,
  patient_id         VARCHAR(36)    NOT NULL,
  consultation_value DECIMAL(12,2)  NOT NULL DEFAULT 0,
  procedure_value    DECIMAL(12,2)  NOT NULL DEFAULT 0,
  package_value      DECIMAL(12,2)  NOT NULL DEFAULT 0,
  total_value        DECIMAL(12,2)  GENERATED ALWAYS AS (consultation_value + procedure_value + package_value) STORED,
  payment_status     ENUM('pending','partial','paid','refunded') NOT NULL DEFAULT 'pending',
  notes              TEXT,
  billed_date        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (lead_id)        REFERENCES leads(id),
  FOREIGN KEY (patient_id)     REFERENCES patients(id),
  INDEX idx_billed_date (billed_date)
);

-- ─────────────────────────────────────────
-- 10. AUDIT LOG
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  user_id      VARCHAR(36),
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    VARCHAR(36)  NOT NULL,
  action       VARCHAR(50)  NOT NULL,
  old_values   JSON,
  new_values   JSON,
  ip_address   VARCHAR(45),
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user   (user_id)
);

-- ─────────────────────────────────────────
-- 11. SYSTEM SETTINGS (Email config etc.)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  setting_key   VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_by    VARCHAR(36),
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 12. WEBHOOKS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  event_type   VARCHAR(100) NOT NULL UNIQUE,
  url          TEXT         NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_by   VARCHAR(36),
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 13. AD SPEND
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_spend (
  id            VARCHAR(36)    PRIMARY KEY DEFAULT (UUID()),
  channel       VARCHAR(100)   NOT NULL,
  monthly_spend DECIMAL(12,2)  NOT NULL DEFAULT 0,
  month         VARCHAR(7)     NOT NULL,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_channel_month (channel, month)
);


-- ============================================================
--  SEED DATA
-- ============================================================

-- Specialities
INSERT IGNORE INTO specialities (id, name) VALUES
  ('sp-ortho',  'Orthopedics'),
  ('sp-cardio', 'Cardiology'),
  ('sp-derm',   'Dermatology'),
  ('sp-onco',   'Oncology'),
  ('sp-peds',   'Pediatrics'),
  ('sp-neuro',  'Neurology');

-- Facilities
INSERT IGNORE INTO facilities (id, name, type, city, region) VALUES
  ('fac-apollo',    'Apollo Clinic – Indiranagar',   'clinic',    'Bengaluru', 'South'),
  ('fac-medicare',  'MediCare Hospital – Whitefield', 'hospital',  'Bengaluru', 'East'),
  ('fac-hf',        'HealthFirst – Koramangala',      'clinic',    'Bengaluru', 'South');

-- Doctors
INSERT IGNORE INTO doctors (id, name, speciality_id, facility_id, consult_type) VALUES
  ('doc-mehta',  'Dr. Arjun Mehta',  'sp-ortho',  'fac-apollo',   'opd,surgery'),
  ('doc-singh',  'Dr. Kavya Singh',  'sp-cardio', 'fac-medicare', 'opd,tele'),
  ('doc-patel',  'Dr. Rohit Patel',  'sp-derm',   'fac-hf',       'opd'),
  ('doc-rao',    'Dr. Sunita Rao',   'sp-onco',   'fac-medicare', 'opd'),
  ('doc-nair',   'Dr. Vivek Nair',   'sp-peds',   'fac-apollo',   'opd,tele'),
  ('doc-kumar',  'Dr. Amit Kumar',   'sp-neuro',  'fac-medicare', 'opd');

-- Admin user (password: Admin@123)
INSERT IGNORE INTO users (id, name, email, password_hash, role) VALUES
  ('usr-admin',     'Rahul Chandra',   'admin@medicrm.com',     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
  ('usr-agent1',    'Ananya Sharma',   'ananya@medicrm.com',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'calling_agent'),
  ('usr-agent2',    'Ravi Patel',      'ravi@medicrm.com',      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'calling_agent'),
  ('usr-agent3',    'Deepa Nair',      'deepa@medicrm.com',     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent'),
  ('usr-marketing', 'Priya Marketing', 'marketing@medicrm.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'marketing'),
  ('usr-finance',   'Arun Finance',    'finance@medicrm.com',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'finance'),
  ('usr-cxo',       'Sanjay CXO',      'cxo@medicrm.com',       '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cxo');

-- Sample Patients
INSERT IGNORE INTO patients (id, unique_pid, full_name, primary_phone, email, city, patient_type) VALUES
  ('pat-001', 'PAT-00001', 'Priya Sharma',  '9880001234', 'priya@email.com',  'Bengaluru', 'new'),
  ('pat-002', 'PAT-00002', 'Raj Kumar',     '9870005678', 'raj@email.com',    'Bengaluru', 'new'),
  ('pat-003', 'PAT-00003', 'Sunita Reddy',  '9860009012', 'sunita@email.com', 'Bengaluru', 'existing'),
  ('pat-004', 'PAT-00004', 'Arjun Das',     '9850003456', 'arjun@email.com',  'Bengaluru', 'new'),
  ('pat-005', 'PAT-00005', 'Meena Joshi',   '9840007890', 'meena@email.com',  'Bengaluru', 'new');

-- Sample Leads
INSERT IGNORE INTO leads (id, patient_id, facility_id, speciality_id, doctor_id, assigned_to, enquiry_type, medical_concern, lead_source, lead_medium, campaign_name, lead_stage, lead_substage, ai_score) VALUES
  ('lead-001', 'pat-001', 'fac-apollo',   'sp-ortho',  'doc-mehta', 'usr-agent1', 'appointment',  'Knee pain and difficulty walking',          'google_ads',  'cpc',         'Knee Replacement LG', 'customer',      'Super Hot – Booked',       92),
  ('lead-002', 'pat-002', 'fac-medicare', 'sp-cardio', 'doc-singh', 'usr-agent2', 'consultation', 'Chest pain and shortness of breath',        'meta_ads',    'paid_social', 'Cardio Awareness',    'attempted',     'Attempt 2',                68),
  ('lead-003', 'pat-003', 'fac-hf',       'sp-derm',   'doc-patel', 'usr-agent3', 'procedure',    'Acne scarring treatment',                   'whatsapp',    'msg',         'Skin Clinic Drive',   'interested',    'Hot – High Intent',        79),
  ('lead-004', 'pat-004', 'fac-apollo',   'sp-onco',   'doc-rao',   'usr-agent1', 'procedure',    'Cancer screening and second opinion',       'referral',    'direct',      '',                    'customer',      'Visited',                  85),
  ('lead-005', 'pat-005', 'fac-medicare', 'sp-cardio', 'doc-singh', 'usr-agent2', 'appointment',  'Palpitations and high BP',                  'organic',     'organic',     '',                    'attempted',     'No Response',              41);

-- ============================================================
--  VIEWS for reporting
-- ============================================================

CREATE OR REPLACE VIEW v_leads_full AS
SELECT
  l.id                AS lead_id,
  l.lead_stage,
  l.lead_substage,
  l.lead_source,
  l.campaign_name,
  l.enquiry_type,
  l.medical_concern,
  l.followup_date,
  l.attempt_count,
  l.ai_score,
  l.ai_priority,
  l.enquiry_date,
  p.id                AS patient_id,
  p.full_name         AS patient_name,
  p.primary_phone,
  p.email,
  p.city,
  p.patient_type,
  f.id                AS facility_id,
  f.name              AS facility_name,
  f.type              AS facility_type,
  sp.id               AS speciality_id,
  sp.name             AS speciality_name,
  d.id                AS doctor_id,
  d.name              AS doctor_name,
  u.id                AS agent_id,
  u.name              AS agent_name,
  u.role              AS agent_role
FROM leads l
JOIN patients    p  ON p.id  = l.patient_id
JOIN facilities  f  ON f.id  = l.facility_id
JOIN specialities sp ON sp.id = l.speciality_id
LEFT JOIN doctors d ON d.id  = l.doctor_id
LEFT JOIN users   u ON u.id  = l.assigned_to;


CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
  COUNT(*)                                                    AS total_leads,
  SUM(lead_stage = 'customer')                                AS total_customers,
  SUM(lead_stage = 'interested')                              AS total_interested,
  SUM(lead_stage = 'untouched')                               AS total_untouched,
  SUM(lead_stage = 'attempted')                               AS total_attempted,
  SUM(lead_stage = 'not_interested')                          AS total_lost,
  ROUND(SUM(lead_stage='customer') / COUNT(*) * 100, 1)       AS conversion_rate,
  ROUND(AVG(ai_score), 1)                                     AS avg_ai_score,
  SUM(lead_stage='attempted' AND attempt_count = 0)           AS at_risk_leads
FROM leads;


CREATE OR REPLACE VIEW v_revenue_summary AS
SELECT
  COALESCE(SUM(r.total_value), 0)       AS total_revenue,
  COALESCE(AVG(r.total_value), 0)       AS avg_revenue_per_lead,
  COUNT(r.id)                           AS paid_leads,
  sp.name                               AS speciality,
  f.name                                AS facility
FROM revenue r
JOIN leads      l   ON l.id  = r.lead_id
JOIN facilities f   ON f.id  = l.facility_id
JOIN specialities sp ON sp.id = l.speciality_id
GROUP BY sp.name, f.name;
