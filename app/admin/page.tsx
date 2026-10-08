'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { SectionTitle, EmptyState, Badge } from '@/components/ui';

interface Agent {
  id: number; username: string; display_name: string;
  role: 'admin' | 'agent'; active: boolean; weekly_ap_target: number;
}

const WEBHOOKS = [
  { kind: 'sale', label: 'Sale logged', desc: 'Fires when anyone logs a sale → your sales channel' },
  { kind: 'activity', label: 'Daily activity', desc: 'Fires when anyone submits daily activity → your activity channel' },
  { kind: 'agent', label: 'New agent joined', desc: 'Fires when you create an agent account' },
  { kind: 'weekly', label: 'Weekly summary', desc: 'Monday-morning auto post with every agent\'s 7-day stats' },
] as const;

export default function AdminPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [webhooks, setWebhooks] = useState<Record<string, { configured: boolean; preview: string }>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string>('');
  const [msg, setMsg] = useState('');
  const [newAgent, setNewAgent] = useState({ username: '', password: '', display_name: '', weekly_ap_target: '' });
  const [resetPw, setResetPw] = useState<Record<number, string>>({});

  async function load() {
    const a = await fetch('/api/agents').then((r) => r.json());
    setAgents(a.agents ?? []);
    const s = await fetch('/api/settings').then((r) => r.json());
    setWebhooks(s.webhooks ?? {});
  }
  useEffect(() => { load(); }, []);

  async function createAgent() {
    setMsg('');
    const r = await fetch('/api/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAgent),
    });
    const d = await r.json();
    if (!r.ok) { setMsg(d.error ?? 'Failed'); return; }
    setMsg(`Agent @${d.agent.username} created — password sent to Discord.`);
    setNewAgent({ username: '', password: '', display_name: '', weekly_ap_target: '' });
    load();
  }

  async function patchAgent(id: number, body: Record<string, unknown>) {
    const r = await fetch(`/api/agents?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error ?? 'Failed');
    load();
  }

  async function saveWebhook(kind: string) {
    const r = await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, url: urls[kind] ?? '' }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg(d.error ?? 'Invalid URL'); return; }
    setUrls({ ...urls, [kind]: '' });
    setMsg(`${kind} webhook saved.`);
    load();
  }

  async function testWebhook(kind: string) {
    setTesting(kind);
    const r = await fetch('/api/settings/test', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    const d = await r.json();
    setTesting('');
    setMsg(d.ok ? `Test sent to ${kind} — check Discord.` : (d.error ?? 'Test failed.'));
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-3 py-6">
        <h1 className="mb-4 text-xl font-bold">Admin</h1>
        {msg && <div className="card mb-4 text-sm text-amber-200">{msg}</div>}

        {/* Agents */}
        <div className="card mb-6">
          <SectionTitle>Agents</SectionTitle>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label className="label">Username *</label>
              <input className="input" value={newAgent.username}
                onChange={(e) => setNewAgent({ ...newAgent, username: e.target.value })} placeholder="jdoe" />
            </div>
            <div>
              <label className="label">Password *</label>
              <input className="input" value={newAgent.password}
                onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })} placeholder="min 6 chars" />
            </div>
            <div>
              <label className="label">Display name</label>
              <input className="input" value={newAgent.display_name}
                onChange={(e) => setNewAgent({ ...newAgent, display_name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="label">Weekly AP target</label>
              <input type="number" min={0} className="input" value={newAgent.weekly_ap_target}
                onChange={(e) => setNewAgent({ ...newAgent, weekly_ap_target: e.target.value })} placeholder="5000" />
            </div>
            <div className="flex items-end">
              <button onClick={createAgent} className="btn-primary w-full">Create</button>
            </div>
          </div>

          {agents.length === 0 && <EmptyState message="No agents yet." />}
          <div className="space-y-2">
            {agents.map((a) => (
              <div key={a.id} className={`card !p-3 ${!a.active ? 'opacity-50' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{a.display_name}</span>
                  <span className="text-slate-500">@{a.username}</span>
                  {a.role === 'admin' ? <Badge tone="gold">ADMIN</Badge>
                    : !a.active ? <Badge tone="red">INACTIVE</Badge> : <Badge tone="green">AGENT</Badge>}
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      Target $
                      <input type="number" min={0} className="input !w-24 !py-1"
                        defaultValue={a.weekly_ap_target || ''}
                        onBlur={(e) => {
                          if (e.target.value !== String(a.weekly_ap_target || '')) {
                            patchAgent(a.id, { weekly_ap_target: e.target.value });
                          }
                        }} />
                    </label>
                    <input className="input !w-32 !py-1" placeholder="New password"
                      value={resetPw[a.id] ?? ''}
                      onChange={(e) => setResetPw({ ...resetPw, [a.id]: e.target.value })} />
                    <button className="btn-ghost !py-1 !text-xs"
                      onClick={() => {
                        if (resetPw[a.id]) { patchAgent(a.id, { password: resetPw[a.id] }); setResetPw({ ...resetPw, [a.id]: '' }); }
                      }}>
                      Reset pw
                    </button>
                    {a.role !== 'admin' && (
                      <button className="btn-ghost !py-1 !text-xs"
                        onClick={() => patchAgent(a.id, { active: !a.active })}>
                        {a.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Discord webhooks */}
        <div className="card">
          <SectionTitle>Discord webhooks</SectionTitle>
          <p className="mb-4 text-sm text-slate-400">
            In Discord: channel settings → Integrations → Webhooks → New Webhook → copy URL → paste below.
          </p>
          <div className="space-y-4">
            {WEBHOOKS.map((w) => (
              <div key={w.kind} className="rounded-lg border border-white/10 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">{w.label}</span>
                  {webhooks[w.kind]?.configured
                    ? <Badge tone="green">Connected {webhooks[w.kind].preview}</Badge>
                    : <Badge>Not set</Badge>}
                </div>
                <p className="mb-2 text-xs text-slate-500">{w.desc}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className="input flex-1" placeholder="https://discord.com/api/webhooks/…"
                    value={urls[w.kind] ?? ''}
                    onChange={(e) => setUrls({ ...urls, [w.kind]: e.target.value })} />
                  <div className="flex gap-2">
                    <button onClick={() => saveWebhook(w.kind)} className="btn-primary !py-2 text-sm">Save</button>
                    {webhooks[w.kind]?.configured && (
                      <button onClick={() => testWebhook(w.kind)} disabled={testing === w.kind}
                        className="btn-ghost !py-2 text-sm">
                        {testing === w.kind ? 'Sending…' : 'Send test'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Weekly summary posts automatically every Monday morning (Vercel Cron → /api/cron/weekly-summary).
          </p>
        </div>
      </main>
    </>
  );
}
