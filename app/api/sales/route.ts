import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';

// GET /api/sales?agent_id=&from=&to=&limit=&all=1 (admin)
export async function GET(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const limit = Math.min(Number(sp.get('limit') ?? 100), 500);

  let agentId: number | null;
  if (session.role === 'admin') {
    agentId = sp.get('agent_id') ? Number(sp.get('agent_id')) : sp.get('all') === '1' ? null : session.userId;
  } else {
    agentId = session.userId;
  }

  const base = `SELECT s.*, u.display_name AS agent_name FROM sales s JOIN users u ON u.id = s.agent_id`;
  void base;
  let rows: Record<string, unknown>[];
  if (agentId !== null && from && to) {
    ({ rows } = await sql`
      SELECT s.*, u.display_name AS agent_name FROM sales s
      JOIN users u ON u.id = s.agent_id
      WHERE s.agent_id = ${agentId} AND s.sale_date >= ${from} AND s.sale_date <= ${to}
      ORDER BY s.sale_date DESC LIMIT ${limit}`);
  } else if (agentId !== null) {
    ({ rows } = await sql`
      SELECT s.*, u.display_name AS agent_name FROM sales s
      JOIN users u ON u.id = s.agent_id
      WHERE s.agent_id = ${agentId}
      ORDER BY s.sale_date DESC LIMIT ${limit}`);
  } else if (from && to) {
    ({ rows } = await sql`
      SELECT s.*, u.display_name AS agent_name FROM sales s
      JOIN users u ON u.id = s.agent_id
      WHERE s.sale_date >= ${from} AND s.sale_date <= ${to}
      ORDER BY s.sale_date DESC LIMIT ${limit}`);
  } else {
    ({ rows } = await sql`
      SELECT s.*, u.display_name AS agent_name FROM sales s
      JOIN users u ON u.id = s.agent_id
      ORDER BY s.sale_date DESC LIMIT ${limit}`);
  }
  return NextResponse.json({ sales: rows });
}

// POST /api/sales — log a sale (agents log their own; admin can log for anyone)
export async function POST(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const agentId =
    session.role === 'admin' && body.agent_id ? Number(body.agent_id) : session.userId;

  const clientName = String(body.client_name || '').trim();
  const carrier = String(body.carrier || '').trim();
  const saleDate = String(body.sale_date || '').slice(0, 10);
  if (!clientName || !carrier || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
    return NextResponse.json(
      { error: 'client_name, carrier, and sale_date (YYYY-MM-DD) are required' },
      { status: 400 }
    );
  }

  const monthly = body.monthly_premium === '' || body.monthly_premium == null
    ? null : Number(body.monthly_premium);
  const ap = monthly != null && Number.isFinite(monthly) ? monthly * 12 : null;
  const face = body.face_amount === '' || body.face_amount == null ? null : Number(body.face_amount);
  const source = body.source === 'warm' ? 'warm' : 'dialed';

  const { rows } = await sql`
    INSERT INTO sales
      (agent_id, client_name, carrier, product, face_amount, monthly_premium,
       annualized_premium, source, sale_date, notes)
    VALUES
      (${agentId}, ${clientName}, ${carrier},
       ${body.product ? String(body.product).slice(0, 120) : null},
       ${face}, ${monthly}, ${ap}, ${source}, ${saleDate},
       ${body.notes ? String(body.notes).slice(0, 1000) : null})
    RETURNING id
  `;

  // Discord: sale logged
  const { rows: urows } = await sql`SELECT display_name FROM users WHERE id = ${agentId}`;
  const name = urows[0]?.display_name ?? session.displayName;
  sendWebhook(
    'sale',
    `💰 **SALE — ${name}**\n` +
      `Client: **${clientName}** · Carrier: **${carrier}**${body.product ? ` (${body.product})` : ''}\n` +
      `AP: **$${ap != null ? ap.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}**/yr` +
      `${monthly != null ? ` ($${monthly}/mo)` : ''} · Source: **${source}**`
  ).catch(() => {});

  return NextResponse.json({ ok: true, id: rows[0].id });
}

// DELETE /api/sales?id= (owner or admin)
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (session.role === 'admin') {
    await sql`DELETE FROM sales WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM sales WHERE id = ${id} AND agent_id = ${session.userId}`;
  }
  return NextResponse.json({ ok: true });
}
