'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Me {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'agent';
}

const LINKS = [
  { href: '/', label: 'Dashboard', admin: false },
  { href: '/activity', label: 'Activity', admin: false },
  { href: '/sales', label: 'Sales', admin: false },
  { href: '/clients', label: 'Clients', admin: false },
  { href: '/todos', label: 'To-Dos', admin: false },
  { href: '/leaderboard', label: 'Board', admin: false },
  { href: '/admin', label: 'Admin', admin: true },
];

export default function Nav() {
  const [me, setMe] = useState<Me | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null))
      .catch(() => setMe(null));
  }, [pathname]);

  if (!me) return null;

  const links = LINKS.filter((l) => !l.admin || me.role === 'admin');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060d1a]/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3">
        <div className="flex h-14 items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 font-bold text-slate-950">
              T
            </span>
            <span className="hidden text-sm font-bold tracking-wide sm:block">
              AGENT<span className="text-amber-300">TRACKER</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-400 md:block">
              {me.displayName}
              {me.role === 'admin' && (
                <span className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  ADMIN
                </span>
              )}
            </span>
            <button onClick={logout} className="btn-ghost !px-3 !py-1.5 !text-xs">
              Log out
            </button>
          </div>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`tab ${pathname === l.href ? 'tab-active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
