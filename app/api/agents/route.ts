import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';

function deny(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// GET /api/agents — list all users (admin)
export async function GET() {
  await ensureSchema();
  const session = await getSession();
  const d = deny(session);
  if (d) return d;
  const { rows } = await sql`
    SELECT id, username, display_name, email, role, active, weekly_ap_target, created_at
    FROM users ORDER BY role DESC, display_name`;
  return NextResponse.json({ agents: rows });
}

// POST /api/agents — create agent (admin)
export async function POST(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  const d = deny(session);
  if (d) return d;

  const body = await req.json();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.display_name || '').trim() || username;
  const role = body.role === 'admin' ? 'admin' : 'agent';

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3–32 chars: letters, numbers, . _ -' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await sql`
      INSERT INTO users (username, password_hash, display_name, role, weekly_ap_target)
      VALUES (${username}, ${hash}, ${displayName.slice(0, 80)}, ${role},
        ${body.weekly_ap_target ? Number(body.weekly_ap_target) : 0})
      RETURNING id, username, display_name, role`;
    // Discord: new agent joined
    sendWebhook('agent', `👋 **New agent joined:** ${displayName} (@${username})`).catch(() => {});
    return NextResponse.json({ ok: true, agent: rows[0] });
  } catch {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }
}

// PATCH /api/agents?id= — update (admin): display_name, role, active, weekly_ap_target, password reset
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  const d = deny(session);
  if (d) return d;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json();
  // Prevent deactivating/demoting yourself
  if (id === session!.userId && (body.active === false || body.role === 'agent')) {
    return NextResponse.json({ error: 'You cannot demote or deactivate yourself' }, { status: 400 });
  }

  if (body.password) {
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const hash = await bcrypt.hash(String(body.password), 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
  }
  if (body.display_name) {
    await sql`UPDATE users SET display_name = ${String(body.display_name).slice(0, 80)} WHERE id = ${id}`;
  }
  if (body.role === 'admin' || body.role === 'agent') {
    await sql`UPDATE users SET role = ${body.role} WHERE id = ${id}`;
  }
  if (typeof body.active === 'boolean') {
    await sql`UPDATE users SET active = ${body.active} WHERE id = ${id}`;
  }
  if (body.weekly_ap_target !== undefined && body.weekly_ap_target !== '') {
    await sql`UPDATE users SET weekly_ap_target = ${Number(body.weekly_ap_target)} WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}
