'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { SectionTitle, EmptyState } from '@/components/ui';
import { todayISO, fmtTalk } from '@/lib/stats';
import type { DailyActivity } from '@/lib/types';

const FIELDS: { key: keyof DailyActivity; label: string }[] = [
  { key: 'dials_auto', label: 'Auto dials' },
  { key: 'dials_hand', label: 'Hand dials' },
  { key: 'pickups', label: 'Pickups' },
  { key: 'screeners', label: 'Screeners' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'talk_minutes', label: 'Talk minutes' },
  { key: 'appointments_set', label: 'Appointments set' },
  { key: 'callbacks', label: 'Callbacks' },
  { key: 'not_interested', label: 'Not interested' },
  { key: 'bad_dnc', label: 'Bad / DNC' },
  { key: 'looking', label: 'Looking' },
];

export default function ActivityPage() {
  const [date, setDate] = useState(todayISO());
  const [vals, setVals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<DailyActivity[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/activity?limit=14');
    const d = await r.json();
    setHistory(d.activity ?? []);
    const today = (d.activity ?? []).find((a: DailyActivity) => String(a.date).slice(0, 10) === date);
    if (today) {
      const v: Record<string, string> = {};
      for (const f of FIELDS) v[f.key] = String(today[f.key] ?? '');
      setVals(v);
      setNotes(today.notes ?? '');
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const row = history.find((a) => String(a.date).slice(0, 10) === date);
    if (row) {
      const v: Record<string, string> = {};
      for (const f of FIELDS) v[f.key] = String(row[f.key] ?? '');
      setVals(v);
      setNotes(row.notes ?? '');
    } else {
      setVals({});
      setNotes('');
    }
  }, [date]);

  async function save() {
    setSaving(true);
    setMsg('');
    const body: Record<string, unknown> = { date, notes };
    for (const f of FIELDS) body[f.key] = vals[f.key] === '' ? 0 : Number(vals[f.key]);
    const r = await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (r.ok) {
      setMsg('Saved — posted to Discord.');
      load();
    } else {
      setMsg('Save failed — try again.');
    }
  }

  const dials = (Number(vals.dials_auto) || 0) + (Number(vals.dials_hand) || 0);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-3 py-6">
        <h1 className="mb-4 text-xl font-bold">Daily activity</h1>

        <div className="card mb-4">
          <div className="mb-4">
            <label className="label">Date</label>
            <input type="date" className="input max-w-xs" value={date}
              onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input
                  type="number" min={0} inputMode="numeric" className="input"
                  value={vals[f.key] ?? ''}
                  onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save day'}
            </button>
            <span className="text-sm text-slate-400">
              Total dials: <strong className="text-white">{dials}</strong>
            </span>
            {msg && <span className="text-sm text-emerald-300">{msg}</span>}
          </div>
        </div>

        <SectionTitle>Recent days</SectionTitle>
        {history.length === 0 && <EmptyState message="No activity logged yet." />}
        <div className="space-y-2">
          {history.map((h) => {
            const d = h.dials_auto + h.dials_hand;
            return (
              <button key={h.id} onClick={() => setDate(String(h.date).slice(0, 10))}
                className="card flex w-full items-center justify-between text-left text-sm hover:border-amber-400/40">
                <span className="font-medium">{String(h.date).slice(0, 10)}</span>
                <span className="text-slate-400">
                  {d} dials · {h.pickups} pickups · {h.quotes} quotes · {fmtTalk(h.talk_minutes)}
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}
