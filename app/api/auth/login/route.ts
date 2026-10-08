import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureSchema, sql } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT id, username, password_hash, display_name, role, active
    FROM users WHERE username = ${String(username).toLowerCase()}
  `;
  const user = rows[0];
  if (!user || !user.active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
  });
  setSessionCookie(token);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role },
  });
}
