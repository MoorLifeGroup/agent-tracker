import Link from 'next/link';

export default function RegisterPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-bold text-slate-950">
          T
        </div>
        <h1 className="text-xl font-bold tracking-wide">
          AGENT<span className="text-amber-300">TRACKER</span>
        </h1>
        <div className="card mt-6 space-y-3">
          <p className="font-semibold text-green-300">Account created!</p>
          <p className="text-sm text-slate-400">
            Your account is pending approval. Tavon will activate it shortly —
            you&apos;ll be able to sign in once that&apos;s done.
          </p>
          <Link href="/login" className="btn-primary block w-full">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
