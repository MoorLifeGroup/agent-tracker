'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { SectionTitle, EmptyState } from '@/components/ui';
import { daysAgoISO, todayISO, fmtMoney, fmtPct, fmtNum, fmtTalk } from '@/lib/stats';

type Metric = 'ap' | 'sales' | 'efficiency' | 'dials';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'ap', label: 'AP' },
  { value: 'sales', label: 'Sales' },
  { value: 'efficiency', label: 'AP / dial' },
  { value: 'dials', label: 'Dials' },
];

interface Row {
  agentId: number; name: string; username: string;
  dials: number; pickups: number; quotes: number; talkMinutes: number;
  sales: number; ap: number; avgAp: number | null;
  dialedSales: number; warmSales: number;
  apPerDial: number | null; dialsPerClose: number | null; quoteToClosePct: number | null;
}

const RANGE_PRESETS = [
  { label: '7d', from: daysAgoISO(6) },
  { label: '30d', from: daysAgoISO(29) },
  { label: 'MTD', from: todayISO().slice(0, 7) + '-01' },
];

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [metric, setMetric] = useState<Metric>('ap');
  const [from, setFrom] = useState(daysAgoISO(6));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?from=${from}&to=${todayISO()}`)
      .then((r) => r.json())
      .then((d) => setRows(d.board ?? []))
      .finally(() => setLoading(false));
  }, [from]);

  const sorted = [...rows].sort((a, b) => {
    switch (metric) {
      case 'ap': return b.ap - a.ap;
      case 'sales': return b.sales - a.sales;
      case 'efficiency': return (b.apPerDial ?? -1) - (a.apPerDial ?? -1);
      case 'dials': return b.dials - a.dials;
    }
  });

  function medal(i: number) {
    return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-3 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Leaderboard</h1>
          <div className="flex gap-1">
            {RANGE_PRESETS.map((p) => (
              <button key={p.label}
                onClick={() => setFrom(p.from)}
                className={`tab ${from === p.from ? 'tab-active' : ''}`}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-6 flex gap-1 overflow-x-auto">
          {METRICS.map((m) => (
            <button key={m.value}
              onClick={() => setMetric(m.value)}
              className={`tab ${metric === m.value ? 'tab-active' : ''}`}>{m.label}</button>
          ))}
        </div>

        {loading && <div className="py-20 text-center text-slate-500">Loading…</div>}
        {!loading && sorted.length === 0 && <EmptyState message="No agents yet." />}

        <div className="space-y-2">
          {sorted.map((r, i) => (
            <div key={r.agentId} className={`card ${i === 0 ? '!border-amber-400/40' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg">{medal(i)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.name}</div>
                  <div className="text-xs text-slate-500">
                    {r.sales} sales · {r.dials} dials · {r.pickups} pickups · {r.quotes} quotes · {fmtTalk(r.talkMinutes)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-amber-300">
                    {metric === 'ap' && fmtMoney(r.ap)}
                    {metric === 'sales' && r.sales}
                    {metric === 'efficiency' && (r.apPerDial != null ? fmtMoney(r.apPerDial) : '—')}
                    {metric === 'dials' && r.dials}
                  </div>
                  <div className="text-xs text-slate-500">
                    {metric === 'ap' && `avg ${fmtMoney(r.avgAp)}`}
                    {metric === 'sales' && `${r.dialedSales} dialed · ${r.warmSales} warm`}
                    {metric === 'efficiency' && `${fmtNum(r.dialsPerClose, 0)} dials/close`}
                    {metric === 'dials' && `${fmtPct(r.quoteToClosePct)} q→c`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <SectionTitle>Efficiency detail</SectionTitle>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th className="table-th">Agent</th>
                  <th className="table-th text-right">AP/dial</th>
                  <th className="table-th text-right">Dials/close</th>
                  <th className="table-th text-right">Quote→close</th>
                  <th className="table-th text-right">AP</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => b.ap - a.ap).map((r) => (
                  <tr key={r.agentId}>
                    <td className="table-td font-medium">{r.name}</td>
                    <td className="table-td text-right">{r.apPerDial != null ? fmtMoney(r.apPerDial) : '—'}</td>
                    <td className="table-td text-right">{fmtNum(r.dialsPerClose, 0)}</td>
                    <td className="table-td text-right">{fmtPct(r.quoteToClosePct)}</td>
                    <td className="table-td text-right font-semibold text-amber-300">{fmtMoney(r.ap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
