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
  // incremental migrations (기존 DB 안전 업그레이드)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_until TIMESTAMPTZ`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vip_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    status TEXT NOT NULL,
    toss_payment_key TEXT,
    order_id TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  console.log('[db] schema ready');
}

module.exports = { pool, q, migrate };
