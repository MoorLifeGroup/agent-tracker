import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sumActivity, sumSales, efficiency, daysAgoISO, todayISO } from '@/lib/stats';

export const dynamic = 'force-dynamic';

// GET /api/leaderboard?from=&to=&metric=ap|sales|efficiency
// Returns per-agent aggregates over the window (default: rolling 7 days).
export async function GET(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const to = sp.get('to') ?? todayISO();
  const from = sp.get('from') ?? daysAgoISO(6);

  const { rows: agents } = await sql`
    SELECT id, display_name, username, weekly_ap_target
    FROM users WHERE role = 'agent' AND active = true ORDER BY display_name`;

  const board = [];
  for (const a of agents) {
    const { rows: act } = await sql`
      SELECT * FROM daily_activity WHERE agent_id = ${a.id} AND date >= ${from} AND date <= ${to}`;
    const { rows: sales } = await sql`
      SELECT * FROM sales WHERE agent_id = ${a.id} AND sale_date >= ${from} AND sale_date <= ${to}`;
    const at = sumActivity(act);
    const st = sumSales(sales);
    const eff = efficiency(at, st.count, st.ap);
    board.push({
      agentId: a.id,
      name: a.display_name,
      username: a.username,
      weeklyApTarget: Number(a.weekly_ap_target ?? 0),
      dials: at.dials,
      pickups: at.pickups,
      quotes: at.quotes,
      talkMinutes: at.talkMinutes,
      sales: st.count,
      ap: st.ap,
      avgAp: st.avgAp,
      dialedSales: st.dialedCount,
      warmSales: st.warmCount,
      apPerDial: eff.apPerDial,
      dialsPerClose: eff.dialsPerClose,
      quoteToClosePct: eff.quoteToClosePct,
    });
  }

  return NextResponse.json({ from, to, board });
}
