/**
 * Seed script — creates the admin user.
 *
 *   ADMIN_PASSWORD=yourpassword npm run seed
 *
 * Requires POSTGRES_URL (or POSTGRES_URL_NON_POOLING) in the environment.
 * Safe to re-run: does nothing if the admin already exists.
 */
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

const USERNAME = 'tavon';

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.error('Set ADMIN_PASSWORD (min 8 chars) in the environment first.');
    process.exit(1);
  }

  // Ensure tables exist (same DDL as lib/db.ts)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
      active BOOLEAN NOT NULL DEFAULT true,
      weekly_ap_target NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_ap_target NUMERIC NOT NULL DEFAULT 0;`;
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, phone TEXT, email TEXT,
      status TEXT NOT NULL DEFAULT 'lead'
        CHECK (status IN ('lead','contacted','appointment_set','appointment_shown','sold','dead')),
      carrier TEXT, face_amount NUMERIC, premium NUMERIC, notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS daily_activity (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      dials_auto INTEGER NOT NULL DEFAULT 0, dials_hand INTEGER NOT NULL DEFAULT 0,
      pickups INTEGER NOT NULL DEFAULT 0, screeners INTEGER NOT NULL DEFAULT 0,
      quotes INTEGER NOT NULL DEFAULT 0, talk_minutes INTEGER NOT NULL DEFAULT 0,
      appointments_set INTEGER NOT NULL DEFAULT 0, callbacks INTEGER NOT NULL DEFAULT 0,
      not_interested INTEGER NOT NULL DEFAULT 0, bad_dnc INTEGER NOT NULL DEFAULT 0,
      looking INTEGER NOT NULL DEFAULT 0, notes TEXT,
      UNIQUE (agent_id, date)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL, carrier TEXT NOT NULL, product TEXT,
      face_amount NUMERIC, monthly_premium NUMERIC, annualized_premium NUMERIC,
      source TEXT NOT NULL DEFAULT 'dialed' CHECK (source IN ('dialed','warm')),
      sale_date DATE NOT NULL, notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL, due_date DATE, done BOOLEAN NOT NULL DEFAULT false,
      notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');`;

  const existing = await sql`SELECT id FROM users WHERE username = ${USERNAME}`;
  if (existing.rows.length > 0) {
    console.log(`Admin user "${USERNAME}" already exists — nothing to do.`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO users (username, password_hash, display_name, role)
    VALUES (${USERNAME}, ${hash}, 'Tavon Pettway', 'admin')
  `;
  console.log(`Admin user "${USERNAME}" created. Log in at /login.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
