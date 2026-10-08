import { sql } from '@vercel/postgres';

let schemaReady = false;

/**
 * Creates tables if they don't exist. Safe to call on every request —
 * uses a module-level flag so it only runs once per serverless instance.
 */
export async function ensureSchema() {
  if (schemaReady) return;

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
  // weekly_ap_target added after initial rollout — backfill safe
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_ap_target NUMERIC NOT NULL DEFAULT 0;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'lead'
        CHECK (status IN ('lead','contacted','appointment_set','appointment_shown','sold','dead')),
      carrier TEXT,
      face_amount NUMERIC,
      premium NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_activity (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      dials_auto INTEGER NOT NULL DEFAULT 0,
      dials_hand INTEGER NOT NULL DEFAULT 0,
      pickups INTEGER NOT NULL DEFAULT 0,
      screeners INTEGER NOT NULL DEFAULT 0,
      quotes INTEGER NOT NULL DEFAULT 0,
      talk_minutes INTEGER NOT NULL DEFAULT 0,
      appointments_set INTEGER NOT NULL DEFAULT 0,
      callbacks INTEGER NOT NULL DEFAULT 0,
      not_interested INTEGER NOT NULL DEFAULT 0,
      bad_dnc INTEGER NOT NULL DEFAULT 0,
      looking INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      UNIQUE (agent_id, date)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL,
      carrier TEXT NOT NULL,
      product TEXT,
      face_amount NUMERIC,
      monthly_premium NUMERIC,
      annualized_premium NUMERIC,
      source TEXT NOT NULL DEFAULT 'dialed' CHECK (source IN ('dialed','warm')),
      sale_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      due_date DATE,
      done BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `;

  schemaReady = true;
}

export { sql };
