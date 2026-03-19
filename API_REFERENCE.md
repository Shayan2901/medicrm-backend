# MediCRM – Complete API Reference

Base URL: `http://localhost:5000/api`

All protected routes require:  
`Authorization: Bearer <token>`

---

## AUTH

| Method | Endpoint | Body | Access |
|--------|----------|------|--------|
| POST | `/auth/login` | `{ email, password }` | Public |
| POST | `/auth/register` | `{ name, email, password, role }` | Admin |
| GET | `/auth/me` | — | Any |

**Login response:**
```json
{
  "success": true,
  "token": "eyJ...",
  "user": { "id": 1, "name": "Rahul Chandra", "role": "admin" }
}
```

**Default credentials (from seed data):**
- Email: `rahul@medicrm.com` | Password: `admin123`
- Email: `ananya@medicrm.com` | Password: `admin123`

---

## LEADS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leads` | List leads with filters |
| GET | `/leads/:id` | Single lead with interactions + appointments |
| POST | `/leads` | Create lead + auto-upsert patient |
| PUT | `/leads/:id` | Update lead fields |
| PATCH | `/leads/:id/stage` | Update stage + substage only |
| PATCH | `/leads/:id/ai` | Save AI score data |
| DELETE | `/leads/:id` | Delete (admin/cxo only) |

**GET /leads query params:**
```
?stage=Interested
&source=Google Ads
&speciality_id=1
&facility_id=1
&doctor_id=1
&agent_id=2
&search=Priya
&from_date=2025-01-01
&to_date=2025-12-31
&page=1
&limit=50
```

**POST /leads body:**
```json
{
  "full_name": "Priya Sharma",
  "primary_phone": "9880001234",
  "email": "priya@email.com",
  "city": "Bengaluru",
  "patient_type": "new",
  "facility_id": 1,
  "speciality_id": 1,
  "doctor_id": 1,
  "assigned_to": 2,
  "enquiry_type": "appointment",
  "medical_concern": "Knee pain",
  "urgency": "medium",
  "followup_date": "2025-03-15",
  "stage": "Untouched",
  "substage": "Fresh Lead",
  "lead_source": "Google Ads",
  "lead_medium": "cpc",
  "campaign_name": "Knee Replacement LG",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "knee_lg_2025"
}
```

**PATCH /leads/:id/stage body:**
```json
{
  "stage": "Interested",
  "substage": "Hot – High Intent"
}
```

---

## INTERACTIONS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leads/:leadId/interactions` | All interactions for a lead |
| POST | `/leads/:leadId/interactions` | Log new interaction |
| DELETE | `/interactions/:id` | Delete (admin only) |

**POST body:**
```json
{
  "interaction_type": "call",
  "outcome": "Appointment booked for March 20",
  "notes": "Patient confirmed morning slot",
  "followup_date": "2025-03-20",
  "interaction_date": "2025-03-10",
  "agent_id": 2
}
```
interaction_type: `call | whatsapp | visit | email | sms | note`

---

## APPOINTMENTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/appointments` | List appointments |
| POST | `/appointments` | Book appointment (auto-updates lead stage) |
| PATCH | `/appointments/:id/status` | Update visit status |

**GET query params:**
```
?facility_id=1&doctor_id=1&status=scheduled&from_date=2025-03-01&to_date=2025-03-31
```

**POST body:**
```json
{
  "lead_id": 1,
  "patient_id": 1,
  "facility_id": 1,
  "doctor_id": 1,
  "appointment_date": "2025-03-20 10:30:00",
  "consult_type": "opd",
  "notes": "First consultation"
}
```

visit_status values: `scheduled | confirmed | visited | no_show | cancelled | rescheduled`

---

## REVENUE

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/revenue` | finance, cxo, admin |
| POST | `/revenue` | finance, admin |

**POST body:**
```json
{
  "appointment_id": 1,
  "lead_id": 1,
  "patient_id": 1,
  "consultation_value": 1500,
  "procedure_value": 42000,
  "package_value": 0,
  "payment_status": "paid",
  "billed_date": "2025-03-20",
  "notes": "Knee replacement procedure"
}
```

---

## DASHBOARDS

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/dashboard/summary` | All |
| GET | `/dashboard/marketing` | marketing, cxo, admin |
| GET | `/dashboard/cxo` | cxo, admin |
| GET | `/dashboard/finance` | finance, cxo, admin |

All accept `?from_date=&to_date=` filters.

---

## DIRECTORY

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/facilities` | All active facilities |
| POST | `/facilities` | Create (admin) |
| PUT | `/facilities/:id` | Update (admin) |
| GET | `/specialities` | All specialities |
| POST | `/specialities` | Create (admin) |
| GET | `/doctors` | All doctors (`?facility_id=&speciality_id=`) |
| POST | `/doctors` | Create (admin) |
| PUT | `/doctors/:id` | Update (admin) |
| GET | `/patients` | Patient list (`?search=&page=&limit=`) |
| GET | `/patients/:id` | Patient + lead history |
| GET | `/users` | All users (admin, cxo) |
| PUT | `/users/:id` | Update user (admin) |

---

## ROLES & ACCESS

| Role | Permissions |
|------|-------------|
| `admin` | Full access |
| `cxo` | Read all + dashboards |
| `marketing` | Leads (read) + marketing dashboard |
| `finance` | Revenue CRUD + finance dashboard |
| `call_center` | Leads CRUD + interactions |
| `agent` | Assigned leads + interactions |

---

## FRONTEND INTEGRATION (React)

Update your `src/App.jsx` to replace `callApi` logic:

```js
const API = 'http://localhost:5000/api';

// Login
const login = async () => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul@medicrm.com', password: 'admin123' })
  });
  const { token } = await res.json();
  localStorage.setItem('token', token);
};

// Get leads
const getLeads = async () => {
  const res = await fetch(`${API}/leads`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  return res.json();
};

// Create lead
const createLead = async (data) => {
  const res = await fetch(`${API}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  });
  return res.json();
};
```
