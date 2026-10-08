import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sumActivity, sumSales, efficiency, daysAgoISO, todayISO } from '@/lib/stats';

export const dynamic = 'force-dynamic';

// GET /api/dashboard?agent_id= — rolling 7-day + month-to-date aggregates
export async function GET(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const agentId =
    session.role === 'admin' && sp.get('agent_id') ? Number(sp.get('agent_id')) : session.userId;

  const to = todayISO();
  const weekFrom = daysAgoISO(6);
  const monthFrom = to.slice(0, 7) + '-01';

  const { rows: weekAct } = await sql`
    SELECT * FROM daily_activity WHERE agent_id = ${agentId}
    AND date >= ${weekFrom} AND date <= ${to} ORDER BY date ASC`;
  const { rows: weekSales } = await sql`
    SELECT * FROM sales WHERE agent_id = ${agentId}
    AND sale_date >= ${weekFrom} AND sale_date <= ${to} ORDER BY sale_date ASC`;
  const { rows: mtdSales } = await sql`
    SELECT * FROM sales WHERE agent_id = ${agentId}
    AND sale_date >= ${monthFrom} AND sale_date <= ${to}`;
  const { rows: mtdAct } = await sql`
    SELECT * FROM daily_activity WHERE agent_id = ${agentId}
    AND date >= ${monthFrom} AND date <= ${to}`;
  const { rows: urows } = await sql`
    SELECT display_name, weekly_ap_target FROM users WHERE id = ${agentId}`;

  const wAct = sumActivity(weekAct);
  const wSales = sumSales(weekSales);
  const mSales = sumSales(mtdSales);
  const mAct = sumActivity(mtdAct);

  // Per-day breakdown (last 7 days, including days with no activity)
  const byDay: Record<string, { activity: (typeof weekAct)[number] | null; sales: typeof weekSales }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoISO(i);
    byDay[d] = { activity: null, sales: [] };
  }
  for (const a of weekAct) {
    const d = String(a.date).slice(0, 10);
    if (byDay[d]) byDay[d].activity = a;
  }
  for (const s of weekSales) {
    const d = String(s.sale_date).slice(0, 10);
    if (byDay[d]) byDay[d].sales.push(s);
  }

  return NextResponse.json({
    agent: {
      id: agentId,
      name: urows[0]?.display_name,
      weeklyApTarget: Number(urows[0]?.weekly_ap_target ?? 0),
    },
    week: {
      from: weekFrom, to,
      activity: wAct,
      sales: wSales,
      efficiency: efficiency(wAct, wSales.count, wSales.ap),
      byDay,
    },
    mtd: {
      from: monthFrom, to,
      sales: mSales,
      activity: mAct,
      efficiency: efficiency(mAct, mSales.count, mSales.ap),
    },
  });
}
