import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { ClientStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: ClientStatus[] = [
  'lead', 'contacted', 'appointment_set', 'appointment_shown', 'sold', 'dead',
];

function scopeAgent(session: { role: string; userId: number }, bodyAgent?: unknown): number {
  return session.role === 'admin' && bodyAgent ? Number(bodyAgent) : session.userId;
}

// GET /api/clients?agent_id=&status=&q=&all=1
export async function GET(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const q = sp.get('q')?.trim();

  let agentId: number | null;
  if (session.role === 'admin') {
    agentId = sp.get('agent_id') ? Number(sp.get('agent_id')) : sp.get('all') === '1' ? null : session.userId;
  } else {
    agentId = session.userId;
  }

  // Keep queries explicit for the sql tag (no dynamic interpolation of clauses)
  let rows: Record<string, unknown>[];
  const like = q ? `%${q}%` : null;
  if (agentId !== null && status && like) {
    ({ rows } = await sql`SELECT c.*, u.display_name AS agent_name FROM clients c JOIN users u ON u.id = c.agent_id WHERE c.agent_id = ${agentId} AND c.status = ${status} AND (c.name ILIKE ${like} OR c.phone ILIKE ${like}) ORDER BY c.updated_at DESC LIMIT 200`);
  } else if (agentId !== null && status) {
    ({ rows } = await sql`SELECT c.*, u.display_name AS agent_name FROM clients c JOIN users u ON u.id = c.agent_id WHERE c.agent_id = ${agentId} AND c.status = ${status} ORDER BY c.updated_at DESC LIMIT 200`);
  } else if (agentId !== null && like) {
    ({ rows } = await sql`SELECT c.*, u.display_name AS agent_name FROM clients c JOIN users u ON u.id = c.agent_id WHERE c.agent_id = ${agentId} AND (c.name ILIKE ${like} OR c.phone ILIKE ${like}) ORDER BY c.updated_at DESC LIMIT 200`);
  } else if (agentId !== null) {
    ({ rows } = await sql`SELECT c.*, u.display_name AS agent_name FROM clients c JOIN users u ON u.id = c.agent_id WHERE c.agent_id = ${agentId} ORDER BY c.updated_at DESC LIMIT 200`);
  } else if (like) {
    ({ rows } = await sql`SELECT c.*, u.display_name AS agent_name FROM clients c JOIN users u ON u.id = c.agent_id WHERE (c.name ILIKE ${like} OR c.phone ILIKE ${like}) ORDER BY c.updated_at DESC LIMIT 200`);
  } else {
    ({ rows } = await sql`SELECT c.*, u.display_name AS agent_name FROM clients c JOIN users u ON u.id = c.agent_id ORDER BY c.updated_at DESC LIMIT 200`);
  }
  return NextResponse.json({ clients: rows });
}

// POST /api/clients
export async function POST(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const status: ClientStatus = STATUSES.includes(body.status) ? body.status : 'lead';

  const { rows } = await sql`
    INSERT INTO clients (agent_id, name, phone, email, status, carrier, face_amount, premium, notes)
    VALUES (${scopeAgent(session, body.agent_id)}, ${name},
      ${body.phone ? String(body.phone).slice(0, 40) : null},
      ${body.email ? String(body.email).slice(0, 120) : null},
      ${status},
      ${body.carrier ? String(body.carrier).slice(0, 80) : null},
      ${body.face_amount === '' || body.face_amount == null ? null : Number(body.face_amount)},
      ${body.premium === '' || body.premium == null ? null : Number(body.premium)},
      ${body.notes ? String(body.notes).slice(0, 2000) : null})
    RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

// PATCH /api/clients?id= — update fields / move status
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json();
  // Admins can touch any row; agents only their own. NULL ownId = no restriction.
  const ownId: number | null = session.role === 'admin' ? null : session.userId;

  // Status-only fast path (kanban moves)
  if (body.status && STATUSES.includes(body.status) && Object.keys(body).length <= 2) {
    await sql`UPDATE clients SET status = ${body.status}, updated_at = NOW() WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
    return NextResponse.json({ ok: true });
  }

  if (body.name) {
    await sql`UPDATE clients SET name = ${String(body.name).slice(0, 160)}, updated_at = NOW() WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (body.phone !== undefined) {
    await sql`UPDATE clients SET phone = ${body.phone ? String(body.phone).slice(0, 40) : null}, updated_at = NOW() WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (body.email !== undefined) {
    await sql`UPDATE clients SET email = ${body.email ? String(body.email).slice(0, 120) : null}, updated_at = NOW() WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (body.status && STATUSES.includes(body.status)) {
    await sql`UPDATE clients SET status = ${body.status}, updated_at = NOW() WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (body.carrier !== undefined) {
    await sql`UPDATE clients SET carrier = ${body.carrier ? String(body.carrier).slice(0, 80) : null}, updated_at = NOW() WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (body.notes !== undefined) {
    await sql`UPDATE clients SET notes = ${body.notes ? String(body.notes).slice(0, 2000) : null}, updated_at = NOW() WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/clients?id=
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (session.role === 'admin') {
    await sql`DELETE FROM clients WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM clients WHERE id = ${id} AND agent_id = ${session.userId}`;
  }
  return NextResponse.json({ ok: true });
}
