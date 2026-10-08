import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureSchema, sql } from '@/lib/db';
import { sendWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';

// POST /api/auth/register — self-registration. Creates an INACTIVE agent
// account; an admin must activate it before the user can log in.
export async function POST(req: NextRequest) {
  await ensureSchema();
  const { username, display_name, email, password } = await req.json();

  const cleanUsername = String(username ?? '').trim().toLowerCase();
  const cleanName = String(display_name ?? '').trim();
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
    return NextResponse.json(
      { error: 'Username must be 3–24 chars: letters, numbers, underscores' },
      { status: 400 }
    );
  }
  if (cleanName.length < 2) {
    return NextResponse.json({ error: 'Please enter your name' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }
  if (String(password ?? '').length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const { rows: taken } = await sql`
    SELECT id FROM users WHERE username = ${cleanUsername} OR email = ${cleanEmail} LIMIT 1
  `;
  if (taken.length > 0) {
    return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
  }

  const hash = await bcrypt.hash(String(password), 12);
  const { rows } = await sql`
    INSERT INTO users (username, password_hash, display_name, email, role, active)
    VALUES (${cleanUsername}, ${hash}, ${cleanName}, ${cleanEmail}, 'agent', false)
    RETURNING id, username, display_name
  `;
  const user = rows[0];

  // Notify admin via Discord so approvals don't sit unseen
  sendWebhook('agent', `🆕 New agent registration: **${user.display_name}** (@${user.username}) — awaiting approval in Admin.`).catch(() => {});

  return NextResponse.json({ ok: true, username: user.username });
}
