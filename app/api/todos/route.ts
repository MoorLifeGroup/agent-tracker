import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/todos?agent_id=&all=1&include_done=1
export async function GET(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const includeDone = sp.get('include_done') === '1';

  let agentId: number | null;
  if (session.role === 'admin') {
    agentId = sp.get('agent_id') ? Number(sp.get('agent_id')) : sp.get('all') === '1' ? null : session.userId;
  } else {
    agentId = session.userId;
  }

  let rows: Record<string, unknown>[];
  if (agentId !== null && includeDone) {
    ({ rows } = await sql`SELECT t.*, u.display_name AS agent_name FROM todos t JOIN users u ON u.id = t.agent_id WHERE t.agent_id = ${agentId} ORDER BY t.done, t.due_date NULLS LAST, t.created_at DESC LIMIT 200`);
  } else if (agentId !== null) {
    ({ rows } = await sql`SELECT t.*, u.display_name AS agent_name FROM todos t JOIN users u ON u.id = t.agent_id WHERE t.agent_id = ${agentId} AND t.done = false ORDER BY t.due_date NULLS LAST, t.created_at DESC LIMIT 200`);
  } else if (includeDone) {
    ({ rows } = await sql`SELECT t.*, u.display_name AS agent_name FROM todos t JOIN users u ON u.id = t.agent_id ORDER BY t.done, t.due_date NULLS LAST LIMIT 200`);
  } else {
    ({ rows } = await sql`SELECT t.*, u.display_name AS agent_name FROM todos t JOIN users u ON u.id = t.agent_id WHERE t.done = false ORDER BY t.due_date NULLS LAST LIMIT 200`);
  }
  return NextResponse.json({ todos: rows });
}

// POST /api/todos — agents create their own; admin can assign to anyone
export async function POST(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const title = String(body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const agentId = session.role === 'admin' && body.agent_id ? Number(body.agent_id) : session.userId;
  const due = body.due_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date)) ? String(body.due_date) : null;

  const { rows } = await sql`
    INSERT INTO todos (agent_id, created_by, title, due_date, notes)
    VALUES (${agentId}, ${session.userId}, ${title.slice(0, 200)}, ${due},
      ${body.notes ? String(body.notes).slice(0, 1000) : null})
    RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

// PATCH /api/todos?id= — toggle done / edit
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const body = await req.json();
  const ownId: number | null = session.role === 'admin' ? null : session.userId;

  if (typeof body.done === 'boolean' && Object.keys(body).length === 1) {
    await sql`UPDATE todos SET done = ${body.done} WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
    return NextResponse.json({ ok: true });
  }
  if (body.title) {
    await sql`UPDATE todos SET title = ${String(body.title).slice(0, 200)} WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (body.due_date !== undefined) {
    await sql`UPDATE todos SET due_date = ${body.due_date || null} WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (body.notes !== undefined) {
    await sql`UPDATE todos SET notes = ${body.notes ? String(body.notes).slice(0, 1000) : null} WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  if (typeof body.done === 'boolean') {
    await sql`UPDATE todos SET done = ${body.done} WHERE id = ${id} AND (${ownId} IS NULL OR agent_id = ${ownId})`;
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/todos?id=
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (session.role === 'admin') {
    await sql`DELETE FROM todos WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM todos WHERE id = ${id} AND agent_id = ${session.userId}`;
  }
  return NextResponse.json({ ok: true });
}
