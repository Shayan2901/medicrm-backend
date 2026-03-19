-- ============================================================
--  MediCRM – MySQL Schema
--  Run this entire file in MySQL Workbench once to set up DB
-- ============================================================

CREATE DATABASE IF NOT EXISTS medicrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medicrm;

-- ─── USERS (Agents / Staff / CXO) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('agent','call_center','marketing','finance','cxo','admin') NOT NULL DEFAULT 'agent',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── FACILITIES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150)  NOT NULL,
  type        ENUM('hospital','clinic','diagnostic_center') NOT NULL DEFAULT 'clinic',
  city        VARCHAR(100),
  location    VARCHAR(255),
  region      VARCHAR(100),
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── SPECIALITIES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS specialities (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── DOCTORS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150)  NOT NULL,
  speciality_id   INT           NOT NULL,
  facility_id     INT           NOT NULL,
  consult_type    SET('opd','surgery','teleconsult','visiting') NOT NULL DEFAULT 'opd',
  is_available    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (speciality_id) REFERENCES specialities(id),
  FOREIGN KEY (facility_id)   REFERENCES facilities(id)
);

-- ─── PATIENTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  unique_pid    VARCHAR(20)   NOT NULL UNIQUE,   -- e.g. PAT-00001
  full_name     VARCHAR(150)  NOT NULL,
  primary_phone VARCHAR(15)   NOT NULL UNIQUE,   -- dedup key
  email         VARCHAR(150),
  city          VARCHAR(100),
  age           TINYINT UNSIGNED,
  gender        ENUM('male','female','other'),
  patient_type  ENUM('new','existing') NOT NULL DEFAULT 'new',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (primary_phone),
  INDEX idx_name  (full_name)
);

-- ─── LEADS / ENQUIRIES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT           NOT NULL,
  facility_id     INT           NOT NULL,
  speciality_id   INT           NOT NULL,
  doctor_id       INT,
  assigned_to     INT,                           -- FK → users.id

  -- Enquiry details
  enquiry_type    ENUM('appointment','consultation','procedure','package','emergency','teleconsult') NOT NULL DEFAULT 'appointment',
  medical_concern TEXT,
  urgency         ENUM('low','medium','high','emergency') DEFAULT 'medium',
  enquiry_date    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  followup_date   DATE,

  -- Lead stage
  stage           ENUM('Untouched','Attempted','Interested','Customer','Not Interested') NOT NULL DEFAULT 'Untouched',
  substage        VARCHAR(100)  NOT NULL DEFAULT 'Fresh Lead',

  -- Marketing attribution
  lead_source     ENUM('Google Ads','Meta Ads','Organic Search','Direct','Referral','Walk-in','Call','WhatsApp','Aggregator') NOT NULL DEFAULT 'Direct',
  lead_medium     VARCHAR(100),
  campaign_name   VARCHAR(200),
  utm_source      VARCHAR(100),
  utm_medium      VARCHAR(100),
  utm_campaign    VARCHAR(200),
  utm_term        VARCHAR(200),
  utm_content     VARCHAR(200),

  -- AI
  ai_score        TINYINT UNSIGNED DEFAULT 50,
  ai_priority     ENUM('High','Medium','Low') DEFAULT 'Medium',
  ai_reason       TEXT,
  ai_next_action  TEXT,

  -- Timestamps
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id)    REFERENCES patients(id),
  FOREIGN KEY (facility_id)   REFERENCES facilities(id),
  FOREIGN KEY (speciality_id) REFERENCES specialities(id),
  FOREIGN KEY (doctor_id)     REFERENCES doctors(id),
  FOREIGN KEY (assigned_to)   REFERENCES users(id),
  INDEX idx_stage       (stage),
  INDEX idx_source      (lead_source),
  INDEX idx_assigned    (assigned_to),
  INDEX idx_enquiry_date (enquiry_date)
);

-- ─── INTERACTIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  lead_id         INT           NOT NULL,
  agent_id        INT           NOT NULL,
  interaction_type ENUM('call','whatsapp','visit','email','sms','note') NOT NULL DEFAULT 'call',
  outcome         VARCHAR(200)  NOT NULL,
  notes           TEXT,
  followup_date   DATE,
  interaction_date TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id)   REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id)  REFERENCES users(id),
  INDEX idx_lead_id (lead_id)
);

-- ─── APPOINTMENTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  lead_id         INT           NOT NULL,
  patient_id      INT           NOT NULL,
  facility_id     INT           NOT NULL,
  doctor_id       INT           NOT NULL,
  appointment_date DATETIME     NOT NULL,
  consult_type    ENUM('opd','surgery','teleconsult','visiting') DEFAULT 'opd',
  visit_status    ENUM('scheduled','confirmed','visited','no_show','cancelled','rescheduled') NOT NULL DEFAULT 'scheduled',
  notes           TEXT,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id)     REFERENCES leads(id),
  FOREIGN KEY (patient_id)  REFERENCES patients(id),
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (doctor_id)   REFERENCES doctors(id),
  INDEX idx_appt_date (appointment_date)
);

-- ─── REVENUE ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id      INT           NOT NULL,
  lead_id             INT           NOT NULL,
  patient_id          INT           NOT NULL,
  consultation_value  DECIMAL(10,2) DEFAULT 0,
  procedure_value     DECIMAL(10,2) DEFAULT 0,
  package_value       DECIMAL(10,2) DEFAULT 0,
  total_value         DECIMAL(10,2) GENERATED ALWAYS AS (consultation_value + procedure_value + package_value) STORED,
  payment_status      ENUM('pending','partial','paid') DEFAULT 'pending',
  notes               TEXT,
  billed_date         DATE,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (lead_id)        REFERENCES leads(id),
  FOREIGN KEY (patient_id)     REFERENCES patients(id)
);

-- ─── AUDIT LOG ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  entity_type VARCHAR(50)   NOT NULL,   -- 'lead','patient','appointment' etc
  entity_id   INT           NOT NULL,
  action      VARCHAR(50)   NOT NULL,   -- 'create','update','delete','stage_change'
  old_value   JSON,
  new_value   JSON,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_entity (entity_type, entity_id)
);

-- ============================================================
--  SEED DATA
-- ============================================================

-- Users
INSERT INTO users (name, email, password_hash, role) VALUES
('Rahul Chandra',  'rahul@medicrm.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'admin'),   -- pass: admin123
('Ananya Sharma',  'ananya@medicrm.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'call_center'),
('Ravi Patel',     'ravi@medicrm.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'call_center'),
('Deepa Nair',     'deepa@medicrm.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'agent'),
('Preet Kapoor',   'preet@medicrm.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'marketing'),
('Sonal Mehta',    'sonal@medicrm.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi', 'finance');

-- Facilities
INSERT INTO facilities (name, type, city, location, region) VALUES
('Apollo Clinic',     'clinic',     'Bengaluru', 'Indiranagar, Bengaluru', 'South'),
('MediCare Hospital', 'hospital',   'Bengaluru', 'Whitefield, Bengaluru',  'East'),
('HealthFirst',       'clinic',     'Bengaluru', 'Koramangala, Bengaluru', 'South');

-- Specialities
INSERT INTO specialities (name) VALUES
('Orthopedics'), ('Cardiology'), ('Dermatology'),
('Oncology'), ('Pediatrics'), ('Neurology');

-- Doctors
INSERT INTO doctors (name, speciality_id, facility_id, consult_type) VALUES
('Dr. Arjun Mehta',  1, 1, 'opd,surgery'),
('Dr. Kavya Singh',  2, 2, 'opd,teleconsult'),
('Dr. Rohit Patel',  3, 3, 'opd'),
('Dr. Sunita Rao',   4, 2, 'opd'),
('Dr. Vivek Nair',   5, 1, 'opd,teleconsult'),
('Dr. Amit Kumar',   6, 1, 'opd');

-- Patients (sample)
INSERT INTO patients (unique_pid, full_name, primary_phone, email, city, patient_type) VALUES
('PAT-00001', 'Priya Sharma',  '9880001234', 'priya@email.com',  'Bengaluru', 'new'),
('PAT-00002', 'Raj Kumar',     '9870005678', 'raj@email.com',    'Bengaluru', 'new'),
('PAT-00003', 'Sunita Reddy',  '9860009012', 'sunita@email.com', 'Bengaluru', 'existing'),
('PAT-00004', 'Arjun Das',     '9850003456', 'arjun@email.com',  'Bengaluru', 'new'),
('PAT-00005', 'Meena Joshi',   '9840007890', 'meena@email.com',  'Bengaluru', 'new');

-- Leads (sample)
INSERT INTO leads (patient_id, facility_id, speciality_id, doctor_id, assigned_to, enquiry_type, medical_concern, stage, substage, lead_source, campaign_name, ai_score, ai_priority) VALUES
(1, 1, 1, 1, 2, 'appointment',   'Knee pain and difficulty walking',    'Customer',      'Super Hot – Booked',      'Google Ads', 'Knee Replacement LG', 92, 'High'),
(2, 2, 2, 2, 3, 'consultation',  'Chest pain and shortness of breath',  'Attempted',     'Attempt 2',               'Meta Ads',   'Cardio Awareness',    68, 'Medium'),
(3, 3, 3, 3, 4, 'procedure',     'Acne scarring treatment',             'Interested',    'Hot – High Intent',       'WhatsApp',   'Skin Clinic Drive',   79, 'Medium'),
(4, 1, 4, 4, 2, 'procedure',     'Cancer screening and second opinion', 'Customer',      'Visited',                 'Referral',   NULL,                  85, 'High'),
(5, 2, 2, 2, 3, 'appointment',   'Palpitations and high BP',            'Attempted',     'No Response',             'Organic Search', NULL,              41, 'Low');
