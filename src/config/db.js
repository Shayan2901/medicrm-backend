const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'medicrm',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
});

// Test connection on startup — warn but do NOT crash the server
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('⚠️  MySQL connection failed:', err.message);
    console.error('   → Check that MySQL is running and the "medicrm" database exists.');
    console.error('   → Server will keep running but DB queries will fail until MySQL is available.');
    // Removed process.exit(1) — server stays alive so you see proper API errors
    // instead of a silent "Failed to fetch" on the frontend.
  });

module.exports = pool;
