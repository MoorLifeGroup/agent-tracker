'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
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
          <p className="mt-1 text-sm text-slate-400">Reset your password</p>
        </div>
        <div className="card space-y-4">
          {sent ? (
            <>
              <p className="text-sm text-slate-300">
                If an account exists for <span className="font-semibold">{email}</span>, a reset
                link is on its way. Check your inbox (and spam folder).
              </p>
              <Link href="/login" className="btn-primary block w-full text-center">
                Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">Account email</label>
                <input id="email" type="email" className="input" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <p className="text-center text-sm text-slate-400">
                <Link href="/login" className="text-amber-300 hover:underline">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
