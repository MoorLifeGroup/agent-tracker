'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { SectionTitle, EmptyState, Badge } from '@/components/ui';
import { todayISO } from '@/lib/stats';
import type { Todo } from '@/lib/types';

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [agents, setAgents] = useState<{ id: number; display_name: string }[]>([]);
  const [assignTo, setAssignTo] = useState('');

  async function load() {
    const me = await fetch('/api/auth/me').then((r) => r.json());
    setIsAdmin(me.user?.role === 'admin');
    if (me.user?.role === 'admin') {
      const a = await fetch('/api/agents').then((r) => r.json());
      setAgents(a.agents ?? []);
    }
    const r = await fetch(`/api/todos?all=1&include_done=${showDone ? 1 : 0}`);
    const d = await r.json();
    setTodos(d.todos ?? []);
  }
  useEffect(() => { load(); }, [showDone]);

  async function add() {
    if (!title.trim()) return;
    await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, due_date: due || undefined,
        agent_id: assignTo ? Number(assignTo) : undefined,
      }),
    });
    setTitle('');
    setDue('');
    setAssignTo('');
    load();
  }

  async function toggle(t: Todo) {
    await fetch(`/api/todos?id=${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !t.done }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm('Delete this to-do?')) return;
    await fetch(`/api/todos?id=${id}`, { method: 'DELETE' });
    load();
  }

  const today = todayISO();
  const overdue = todos.filter((t) => !t.done && t.due_date && String(t.due_date).slice(0, 10) < today);
  const open = todos.filter((t) => !t.done && !(t.due_date && String(t.due_date).slice(0, 10) < today));
  const done = todos.filter((t) => t.done);

  function row(t: Todo, isOverdue: boolean) {
    return (
      <div key={t.id}
        className={`card flex items-center gap-3 text-sm ${isOverdue ? '!border-red-500/50' : ''}`}>
        <button
          onClick={() => toggle(t)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${
            t.done ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300'
                   : 'border-white/25 text-transparent hover:border-amber-400'
          }`}>
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className={t.done ? 'text-slate-500 line-through' : 'font-medium'}>{t.title}</div>
          <div className="text-xs text-slate-500">
            {t.due_date && (
              <span className={isOverdue ? 'font-semibold text-red-300' : ''}>
                Due {String(t.due_date).slice(0, 10)}{isOverdue ? ' · OVERDUE' : ''}
              </span>
            )}
            {t.agent_name && <span> · {t.agent_name}</span>}
          </div>
        </div>
        {isOverdue && <Badge tone="red">Overdue</Badge>}
        <button onClick={() => remove(t.id)} className="btn-danger shrink-0">✕</button>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-3 py-6">
        <h1 className="mb-4 text-xl font-bold">To-dos</h1>

        <div className="card mb-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input className="input flex-1" placeholder="New to-do…"
              value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
            <input type="date" className="input sm:!w-40" value={due} onChange={(e) => setDue(e.target.value)} />
            {isAdmin && (
              <select className="input sm:!w-44" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">Assign: me</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              </select>
            )}
            <button onClick={add} className="btn-primary shrink-0">Add</button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Open ({overdue.length + open.length})</SectionTitle>
          <button onClick={() => setShowDone(!showDone)} className="btn-ghost !py-1.5 !text-xs">
            {showDone ? 'Hide done' : 'Show done'}
          </button>
        </div>

        {overdue.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">
              Overdue ({overdue.length})
            </div>
            <div className="space-y-2">{overdue.map((t) => row(t, true))}</div>
          </div>
        )}
        {open.length === 0 && overdue.length === 0 && (
          <EmptyState message="Nothing open. Enjoy it while it lasts." />
        )}
        <div className="space-y-2">{open.map((t) => row(t, false))}</div>

        {showDone && done.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Done ({done.length})
            </div>
            <div className="space-y-2">{done.map((t) => row(t, false))}</div>
          </div>
        )}
      </main>
    </>
  );
}
