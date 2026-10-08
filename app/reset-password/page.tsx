'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Reset failed');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('Network error — try again');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-sm text-red-300">This reset link is missing its token.</p>
        <Link href="/forgot-password" className="text-amber-300 hover:underline text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {done ? (
        <p className="text-center text-sm text-green-300">
          Password updated! Redirecting you to sign in…
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="label" htmlFor="password">New password (min 8 chars)</label>
            <input id="password" type="password" className="input" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm new password</label>
            <input id="confirm" type="password" className="input" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
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
          <p className="mt-1 text-sm text-slate-400">Choose a new password</p>
        </div>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
