export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value mt-1 ${accent ? 'text-amber-300' : ''}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card py-8 text-center text-sm text-slate-500">{message}</div>
  );
}

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'gold' | 'green' | 'red' | 'blue' }) {
  const tones: Record<string, string> = {
    default: 'bg-white/10 text-slate-300',
    gold: 'bg-amber-400/15 text-amber-300',
    green: 'bg-emerald-400/15 text-emerald-300',
    red: 'bg-red-400/15 text-red-300',
    blue: 'bg-sky-400/15 text-sky-300',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
