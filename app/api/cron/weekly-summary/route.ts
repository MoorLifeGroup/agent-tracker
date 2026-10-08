import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { sendWebhook } from '@/lib/discord';
import { sumActivity, sumSales, daysAgoISO, todayISO, fmtMoney } from '@/lib/stats';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/weekly-summary
 * Protected by CRON_SECRET (Vercel Cron sends it as Authorization: Bearer <secret>).
 * Posts each agent's rolling 7-day stats to the weekly Discord webhook.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSchema();
  const to = todayISO();
  const from = daysAgoISO(6);

  const { rows: agents } = await sql`
    SELECT id, display_name, weekly_ap_target FROM users
    WHERE role = 'agent' AND active = true ORDER BY display_name`;

  const lines: string[] = [];
  for (const a of agents) {
    const { rows: act } = await sql`
      SELECT * FROM daily_activity WHERE agent_id = ${a.id} AND date >= ${from} AND date <= ${to}`;
    const { rows: sales } = await sql`
      SELECT * FROM sales WHERE agent_id = ${a.id} AND sale_date >= ${from} AND sale_date <= ${to}`;
    const at = sumActivity(act);
    const st = sumSales(sales);
    const target = Number(a.weekly_ap_target ?? 0);
    const targetLine = target > 0
      ? ` (target ${fmtMoney(target)} — ${Math.round((st.ap / target) * 100)}%)`
      : '';
    lines.push(
      `**${a.display_name}** — AP **${fmtMoney(st.ap)}**${targetLine} · ` +
      `Sales **${st.count}** · Dials **${at.dials}** · Pickups **${at.pickups}** · ` +
      `Quotes **${at.quotes}** · Talk **${at.talkMinutes}m**`
    );
  }

  const msg =
    `📊 **Weekly Summary** (${from} → ${to})\n\n` +
    (lines.length ? lines.join('\n') : '_No active agents._');

  const sent = await sendWebhook('weekly', msg, { username: 'Agent Tracker' });
  return NextResponse.json({ ok: sent, agents: agents.length });
}
