'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { SectionTitle, EmptyState, Badge } from '@/components/ui';
import { CLIENT_STATUSES, type Client, type ClientStatus } from '@/lib/types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', carrier: '', notes: '' });

  async function load() {
    const r = await fetch(`/api/clients?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setClients(d.clients ?? []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [q]);

  async function add() {
    if (!form.name.trim()) return;
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', phone: '', email: '', carrier: '', notes: '' });
    setShowAdd(false);
    load();
  }

  async function move(id: number, status: ClientStatus) {
    await fetch(`/api/clients?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm('Delete this client?')) return;
    await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
    load();
  }

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-3 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Client pipeline</h1>
          <div className="flex gap-2">
            <input className="input !w-48" placeholder="Search name or phone…"
              value={q} onChange={(e) => setQ(e.target.value)} />
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary !py-2 text-sm">
              + Add client
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="card mb-6 grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="label">Carrier</label>
              <input className="input" value={form.carrier} onChange={(e) => set('carrier', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
            <div className="col-span-2">
              <button onClick={add} className="btn-primary">Add client</button>
            </div>
          </div>
        )}

        {clients.length === 0 && <EmptyState message="No clients yet. Add your first one above." />}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CLIENT_STATUSES.map((s) => {
            const list = clients.filter((c) => c.status === s.value);
            if (list.length === 0) return null;
            return (
              <div key={s.value} className="card">
                <SectionTitle>
                  <span>{s.label} <span className="text-slate-500">({list.length})</span></span>
                </SectionTitle>
                <div className="space-y-2">
                  {list.map((c) => (
                    <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{c.name}</div>
                          {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                          {c.carrier && <div className="mt-1"><Badge>{c.carrier}</Badge></div>}
                          {c.agent_name && <div className="mt-1 text-xs text-slate-500">{c.agent_name}</div>}
                        </div>
                        <button onClick={() => remove(c.id)} className="btn-danger shrink-0">✕</button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {CLIENT_STATUSES.filter((x) => x.value !== c.status).map((x) => (
                          <button
                            key={x.value}
                            onClick={() => move(c.id, x.value)}
                            className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-slate-400 hover:border-amber-400/50 hover:text-amber-300"
                          >
                            → {x.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
