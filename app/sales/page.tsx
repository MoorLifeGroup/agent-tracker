'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { SectionTitle, EmptyState, Badge } from '@/components/ui';
import { todayISO, fmtMoney } from '@/lib/stats';
import { CARRIERS } from '@/lib/types';
import type { Sale } from '@/lib/types';

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [form, setForm] = useState({
    client_name: '', carrier: '', product: '', face_amount: '',
    monthly_premium: '', source: 'dialed', sale_date: todayISO(), notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [pendingDocId, setPendingDocId] = useState<number | null>(null);

  async function load() {
    const r = await fetch('/api/sales?limit=50');
    const d = await r.json();
    setSales(d.sales ?? []);
  }
  useEffect(() => { load(); }, []);

  async function scanDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    setScanMsg('Reading document…');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/documents', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) {
        setScanMsg(d.error ?? 'Scan failed');
        return;
      }
      const ex = d.document?.extracted;
      if (!ex) {
        setScanMsg('Uploaded, but AI extraction is not configured yet (missing API key).');
        setPendingDocId(d.document.id);
        return;
      }
      setForm((f) => ({
        ...f,
        client_name: ex.client_name ?? f.client_name,
        carrier: ex.carrier ?? f.carrier,
        product: ex.product ?? f.product,
        face_amount: ex.face_amount != null ? String(ex.face_amount) : f.face_amount,
        monthly_premium: ex.monthly_premium != null ? String(ex.monthly_premium) : f.monthly_premium,
        sale_date: ex.effective_date ?? f.sale_date,
        notes: [f.notes, ex.policy_number ? `Policy #: ${ex.policy_number}` : ''].filter(Boolean).join('\n'),
      }));
      setPendingDocId(d.document.id);
      setScanMsg(ex.confidence === 'low'
        ? 'Scanned — low confidence, please review every field.'
        : 'Scanned — review the pre-filled fields below.');
    } catch {
      setScanMsg('Scan failed — network error.');
    } finally {
      setScanning(false);
    }
  }

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const ap = form.monthly_premium ? Number(form.monthly_premium) * 12 : null;

  async function save() {
    if (!form.client_name.trim() || !form.carrier) {
      setMsg('Client name and carrier are required.');
      return;
    }
    setSaving(true);
    setMsg('');
    const r = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) {
      const d = await r.json();
      // Link any scanned document to this sale
      if (pendingDocId && d.id) {
        await fetch('/api/documents/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: pendingDocId, sale_id: d.id }),
        });
        setPendingDocId(null);
      }
      setMsg('Sale logged — posted to Discord.');
      setForm({ client_name: '', carrier: '', product: '', face_amount: '', monthly_premium: '', source: 'dialed', sale_date: todayISO(), notes: '' });
      setScanMsg('');
      load();
    } else {
      const d = await r.json();
      setMsg(d.error ?? 'Save failed.');
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this sale?')) return;
    await fetch(`/api/sales?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-3 py-6">
        <h1 className="mb-4 text-xl font-bold">Sales log</h1>

        <div className="card mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Log a sale</SectionTitle>
            <label className={`cursor-pointer rounded-lg border border-dashed px-3 py-1.5 text-sm transition ${scanning ? 'border-slate-600 text-slate-500' : 'border-amber-400/50 text-amber-300 hover:bg-amber-400/10'}`}>
              {scanning ? 'Scanning…' : '📄 Scan document'}
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic" className="hidden"
                disabled={scanning} onChange={scanDocument} />
            </label>
          </div>
          {scanMsg && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200">
              {scanMsg}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Client name *</label>
              <input className="input" value={form.client_name} onChange={(e) => set('client_name', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Carrier *</label>
              <select className="input" value={form.carrier} onChange={(e) => set('carrier', e.target.value)}>
                <option value="">Select carrier…</option>
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Product</label>
              <input className="input" value={form.product} onChange={(e) => set('product', e.target.value)} placeholder="e.g. Living Promise" />
            </div>
            <div>
              <label className="label">Face amount</label>
              <input type="number" min={0} inputMode="decimal" className="input" value={form.face_amount} onChange={(e) => set('face_amount', e.target.value)} placeholder="25000" />
            </div>
            <div>
              <label className="label">Monthly premium</label>
              <input type="number" min={0} step="0.01" inputMode="decimal" className="input" value={form.monthly_premium} onChange={(e) => set('monthly_premium', e.target.value)} placeholder="85.50" />
            </div>
            <div>
              <label className="label">Annualized (auto)</label>
              <input className="input opacity-60" readOnly value={ap != null ? `$${ap.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} />
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={form.source} onChange={(e) => set('source', e.target.value)}>
                <option value="dialed">Dialed</option>
                <option value="warm">Warm</option>
              </select>
            </div>
            <div>
              <label className="label">Sale date</label>
              <input type="date" className="input" value={form.sale_date} onChange={(e) => set('sale_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Log sale'}
            </button>
            {msg && <span className="text-sm text-slate-300">{msg}</span>}
          </div>
        </div>

        <SectionTitle>Recent sales</SectionTitle>
        {sales.length === 0 && <EmptyState message="No sales logged yet." />}
        <div className="space-y-2">
          {sales.map((s) => (
            <div key={s.id} className="card flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold">{s.client_name}</div>
                <div className="text-slate-400">
                  {s.carrier}{s.product ? ` · ${s.product}` : ''} · {String(s.sale_date).slice(0, 10)}
                  {s.agent_name && <span className="text-slate-500"> · {s.agent_name}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={s.source === 'warm' ? 'green' : 'blue'}>{s.source}</Badge>
                <span className="font-bold text-amber-300">{fmtMoney(s.annualized_premium)}</span>
                <button onClick={() => remove(s.id)} className="btn-danger">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
