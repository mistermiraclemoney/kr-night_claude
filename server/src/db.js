const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/krnight';

const pool = new Pool({
  connectionString,
  ssl: /railway|render|amazonaws|supabase|neon/.test(connectionString) ? { rejectUnauthorized: false } : false,
});

const q = (text, params) => pool.query(text, params);

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[db] schema ready');
}

module.exports = { pool, q, migrate };
