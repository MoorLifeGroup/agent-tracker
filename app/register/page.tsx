'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', display_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed');
        return;
      }
      router.push('/register/pending');
    } catch {
      setError('Network error — try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-bold text-slate-950">
            T
          </div>
          <h1 className="text-xl font-bold tracking-wide">
            AGENT<span className="text-amber-300">TRACKER</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Create your agent account</p>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="label" htmlFor="display_name">Full name</label>
            <input id="display_name" className="input" value={form.display_name}
              onChange={(e) => set('display_name', e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input id="username" className="input" autoComplete="username" value={form.username}
              onChange={(e) => set('username', e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" value={form.email}
              onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password (min 8 chars)</label>
            <input id="password" type="password" className="input" autoComplete="new-password" value={form.password}
              onChange={(e) => set('password', e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" className="input" autoComplete="new-password" value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)} required minLength={8} />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-amber-300 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
