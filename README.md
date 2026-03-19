<<<<<<< HEAD
# MediCRM – Backend API

Node.js + Express + MySQL backend for the MediCRM Healthcare CRM.

---

## Quick Setup (5 steps)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up MySQL database
- Open **MySQL Workbench**
- Connect to your local MySQL server
- Open `database/schema.sql`
- Run the entire file (Ctrl+Shift+Enter)
- This creates the `medicrm` database with all tables + seed data

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and set:
```
DB_PASSWORD=your_mysql_root_password
JWT_SECRET=any_long_random_string_here
ANTHROPIC_API_KEY=sk-ant-your-key  # optional, only for AI features
```

### 4. Start the server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 5. Test it's working
```
GET http://localhost:5000/health
```
Should return: `{ "status": "ok", "service": "MediCRM API" }`

---

## Project Structure

```
medicrm-backend/
├── server.js                    # Entry point
├── .env.example                 # Environment template
├── package.json
├── API_REFERENCE.md             # Full API docs
├── database/
│   └── schema.sql               # MySQL schema + seed data
└── src/
    ├── config/
    │   └── db.js                # MySQL connection pool
    ├── middleware/
    │   └── auth.js              # JWT auth middleware
    ├── controllers/
    │   ├── authController.js    # Login / register
    │   ├── leadsController.js   # Full lead CRUD
    │   ├── interactionsController.js
    │   ├── appointmentsController.js
    │   ├── dashboardController.js
    │   └── directoryController.js
    └── routes/
        └── index.js             # All routes
```

---

## Test with curl

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rahul@medicrm.com","password":"admin123"}'

# 2. Get leads (replace TOKEN)
curl http://localhost:5000/api/leads \
  -H "Authorization: Bearer TOKEN"

# 3. Create a lead
curl -X POST http://localhost:5000/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"full_name":"Test Patient","primary_phone":"9999999999","facility_id":1,"speciality_id":1}'
```

---

## Default Users (password: `admin123` for all)

| Email | Role |
|-------|------|
| rahul@medicrm.com | admin |
| ananya@medicrm.com | call_center |
| ravi@medicrm.com | call_center |
| deepa@medicrm.com | agent |
| preet@medicrm.com | marketing |
| sonal@medicrm.com | finance |
=======
# medicrm-backend
>>>>>>> 957c5e697a8060094021f953dde1558dd91f28d1
