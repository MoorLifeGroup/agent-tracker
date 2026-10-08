'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { StatCard, SectionTitle, EmptyState } from '@/components/ui';
import { fmtMoney, fmtPct, fmtNum, fmtTalk } from '@/lib/stats';

interface DashboardData {
  agent: { id: number; name: string; weeklyApTarget: number };
  week: {
    from: string; to: string;
    activity: { dials: number; pickups: number; quotes: number; talkMinutes: number; appointmentsSet: number };
    sales: { count: number; ap: number; avgAp: number | null; dialedCount: number; dialedAp: number; warmCount: number; warmAp: number };
    efficiency: Record<string, number | null>;
    byDay: Record<string, { activity: any; sales: any[] }>;
  };
  mtd: {
    from: string; to: string;
    sales: { count: number; ap: number; avgAp: number | null; dialedCount: number; dialedAp: number; warmCount: number; warmAp: number };
    efficiency: Record<string, number | null>;
  };
}

function EffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-3 py-6">
        {loading && <div className="py-20 text-center text-slate-500">Loading…</div>}
        {data && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">Hey, {data.agent.name}</h1>
                <p className="text-sm text-slate-400">
                  Rolling 7 days · {data.week.from} → {data.week.to}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/activity" className="btn-primary !py-2 text-sm">Log activity</Link>
                <Link href="/sales" className="btn-ghost !py-2 text-sm">Log sale</Link>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="AP (7d)" value={fmtMoney(data.week.sales.ap)} accent
                sub={data.agent.weeklyApTarget > 0
                  ? `Target ${fmtMoney(data.agent.weeklyApTarget)} · ${Math.round((data.week.sales.ap / data.agent.weeklyApTarget) * 100)}%`
                  : `${data.week.sales.count} sales`} />
              <StatCard label="Sales (7d)" value={String(data.week.sales.count)}
                sub={`Avg AP ${fmtMoney(data.week.sales.avgAp)}`} />
              <StatCard label="Dials (7d)" value={String(data.week.activity.dials)}
                sub={`${data.week.activity.pickups} pickups · ${data.week.activity.quotes} quotes`} />
              <StatCard label="Talk time (7d)" value={fmtTalk(data.week.activity.talkMinutes)}
                sub={`${data.week.activity.appointmentsSet} appts set`} />
            </div>

            <div className="card mb-6">
              <SectionTitle>Dialed vs Warm (7d)</SectionTitle>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="stat-label">Dialed</div>
                  <div className="text-lg font-bold text-sky-300">{data.week.sales.dialedCount} sales</div>
                  <div className="text-slate-400">{fmtMoney(data.week.sales.dialedAp)} AP</div>
                </div>
                <div>
                  <div className="stat-label">Warm</div>
                  <div className="text-lg font-bold text-emerald-300">{data.week.sales.warmCount} sales</div>
                  <div className="text-slate-400">{fmtMoney(data.week.sales.warmAp)} AP</div>
                </div>
              </div>
            </div>

            <div className="card mb-6">
              <SectionTitle>Dial efficiency (7d)</SectionTitle>
              <div className="grid gap-x-8 md:grid-cols-2">
                <div>
                  <EffRow label="Dials / close" value={fmtNum(data.week.efficiency.dialsPerClose, 0)} />
                  <EffRow label="Pickups / close" value={fmtNum(data.week.efficiency.pickupsPerClose, 0)} />
                  <EffRow label="Quotes / close" value={fmtNum(data.week.efficiency.quotesPerClose, 1)} />
                  <EffRow label="Dials / pickup" value={fmtNum(data.week.efficiency.dialsPerPickup, 1)} />
                </div>
                <div>
                  <EffRow label="Pickup → quote" value={fmtPct(data.week.efficiency.pickupToQuotePct)} />
                  <EffRow label="Quote → close" value={fmtPct(data.week.efficiency.quoteToClosePct)} />
                  <EffRow label="AP / dial" value={fmtMoney(data.week.efficiency.apPerDial)} />
                  <EffRow label="AP / hour" value={fmtMoney(data.week.efficiency.apPerHour)} />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <SectionTitle>Month to date ({data.mtd.from} → {data.mtd.to})</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="AP" value={fmtMoney(data.mtd.sales.ap)} accent />
                <StatCard label="Sales" value={String(data.mtd.sales.count)}
                  sub={`Avg ${fmtMoney(data.mtd.sales.avgAp)}`} />
                <StatCard label="Dialed" value={`${data.mtd.sales.dialedCount} / ${fmtMoney(data.mtd.sales.dialedAp)}`} sub="sales / AP" />
                <StatCard label="Warm" value={`${data.mtd.sales.warmCount} / ${fmtMoney(data.mtd.sales.warmAp)}`} sub="sales / AP" />
              </div>
            </div>

            <div className="card overflow-x-auto">
              <SectionTitle>Per-day breakdown</SectionTitle>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Dials</th>
                    <th className="table-th text-right">Pickups</th>
                    <th className="table-th text-right">Quotes</th>
                    <th className="table-th text-right">Talk</th>
                    <th className="table-th text-right">Appts</th>
                    <th className="table-th text-right">Sales</th>
                    <th className="table-th text-right">AP</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.week.byDay).map(([date, d]) => {
                    const a = d.activity;
                    const dials = a ? a.dials_auto + a.dials_hand : 0;
                    const ap = d.sales.reduce((s: number, x: any) => s + Number(x.annualized_premium ?? 0), 0);
                    return (
                      <tr key={date}>
                        <td className="table-td font-medium">{date.slice(5)}</td>
                        <td className="table-td text-right">{dials || '—'}</td>
                        <td className="table-td text-right">{a?.pickups || '—'}</td>
                        <td className="table-td text-right">{a?.quotes || '—'}</td>
                        <td className="table-td text-right">{a ? fmtTalk(a.talk_minutes) : '—'}</td>
                        <td className="table-td text-right">{a?.appointments_set || '—'}</td>
                        <td className="table-td text-right">{d.sales.length || '—'}</td>
                        <td className="table-td text-right font-semibold text-amber-300">
                          {ap > 0 ? fmtMoney(ap) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.keys(data.week.byDay).length === 0 && <EmptyState message="No data yet this week." />}
            </div>
          </>
        )}
      </main>
    </>
  );
}
