import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const FIELDS = [
  'dials_auto', 'dials_hand', 'pickups', 'screeners', 'quotes',
  'talk_minutes', 'appointments_set', 'callbacks', 'not_interested',
  'bad_dnc', 'looking',
] as const;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// GET /api/activity?agent_id=&from=&to=&limit=
export async function GET(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const agentId =
    session.role === 'admin' && sp.get('agent_id')
      ? Number(sp.get('agent_id'))
      : session.userId;
  const from = sp.get('from');
  const to = sp.get('to');
  const limit = Math.min(Number(sp.get('limit') ?? 60), 365);

  let rows;
  if (from && to) {
    ({ rows } = await sql`
      SELECT a.*, u.display_name AS agent_name
      FROM daily_activity a JOIN users u ON u.id = a.agent_id
      WHERE a.agent_id = ${agentId} AND a.date >= ${from} AND a.date <= ${to}
      ORDER BY a.date DESC
    `);
  } else {
    ({ rows } = await sql`
      SELECT a.*, u.display_name AS agent_name
      FROM daily_activity a JOIN users u ON u.id = a.agent_id
      WHERE a.agent_id = ${agentId}
      ORDER BY a.date DESC LIMIT ${limit}
    `);
  }
  return NextResponse.json({ activity: rows });
}

// POST /api/activity — upsert one day (agents log their own; admin can log for anyone)
export async function POST(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const agentId =
    session.role === 'admin' && body.agent_id ? Number(body.agent_id) : session.userId;
  const date = String(body.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Valid date required (YYYY-MM-DD)' }, { status: 400 });
  }

  const vals = FIELDS.map((f) => num(body[f]));
  const notes = body.notes ? String(body.notes).slice(0, 1000) : null;

  await sql`
    INSERT INTO daily_activity
      (agent_id, date, dials_auto, dials_hand, pickups, screeners, quotes,
       talk_minutes, appointments_set, callbacks, not_interested, bad_dnc, looking, notes)
    VALUES
      (${agentId}, ${date}, ${vals[0]}, ${vals[1]}, ${vals[2]}, ${vals[3]}, ${vals[4]},
       ${vals[5]}, ${vals[6]}, ${vals[7]}, ${vals[8]}, ${vals[9]}, ${vals[10]}, ${notes})
    ON CONFLICT (agent_id, date) DO UPDATE SET
      dials_auto = EXCLUDED.dials_auto, dials_hand = EXCLUDED.dials_hand,
      pickups = EXCLUDED.pickups, screeners = EXCLUDED.screeners,
      quotes = EXCLUDED.quotes, talk_minutes = EXCLUDED.talk_minutes,
      appointments_set = EXCLUDED.appointments_set, callbacks = EXCLUDED.callbacks,
      not_interested = EXCLUDED.not_interested, bad_dnc = EXCLUDED.bad_dnc,
      looking = EXCLUDED.looking, notes = EXCLUDED.notes
  `;

  // Discord: daily activity submitted
  const dials = vals[0] + vals[1];
  const { rows: urows } = await sql`SELECT display_name FROM users WHERE id = ${agentId}`;
  const name = urows[0]?.display_name ?? session.displayName;
  sendWebhook(
    'activity',
    `📞 **Daily activity — ${name}** (${date})\n` +
      `Dials: **${dials}** (${vals[0]} auto / ${vals[1]} hand) · Pickups: **${vals[2]}** · Quotes: **${vals[4]}**\n` +
      `Talk: **${vals[5]} min** · Appts set: **${vals[6]}** · Callbacks: **${vals[7]}**`
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
