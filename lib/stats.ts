import type { DailyActivity, Sale } from './types';

/** Raw activity totals across a set of daily rows. */
export interface ActivityTotals {
  dials: number;
  pickups: number;
  screeners: number;
  quotes: number;
  talkMinutes: number;
  talkHours: number;
  appointmentsSet: number;
  callbacks: number;
  notInterested: number;
  badDnc: number;
  looking: number;
  days: number;
}

type ActivityRow = Pick<
  DailyActivity,
  'dials_auto' | 'dials_hand' | 'pickups' | 'screeners' | 'quotes' |
  'talk_minutes' | 'appointments_set' | 'callbacks' | 'not_interested' |
  'bad_dnc' | 'looking'
>;

export function sumActivity(rows: ActivityRow[] | Record<string, any>[]): ActivityTotals {
  const t: ActivityTotals = {
    dials: 0, pickups: 0, screeners: 0, quotes: 0, talkMinutes: 0,
    talkHours: 0, appointmentsSet: 0, callbacks: 0, notInterested: 0,
    badDnc: 0, looking: 0, days: rows.length,
  };
  for (const r of rows) {
    t.dials += r.dials_auto + r.dials_hand;
    t.pickups += r.pickups;
    t.screeners += r.screeners;
    t.quotes += r.quotes;
    t.talkMinutes += r.talk_minutes;
    t.appointmentsSet += r.appointments_set;
    t.callbacks += r.callbacks;
    t.notInterested += r.not_interested;
    t.badDnc += r.bad_dnc;
    t.looking += r.looking;
  }
  t.talkHours = t.talkMinutes / 60;
  return t;
}

/** Dial efficiency ratios — every ratio computed live from raw inputs. */
export interface Efficiency {
  dialsPerPickup: number | null;
  pickupToQuotePct: number | null;
  quoteToClosePct: number | null;
  dialsPerClose: number | null;
  pickupsPerClose: number | null;
  quotesPerClose: number | null;
  apPerDial: number | null;
  apPerHour: number | null;
}

export function efficiency(
  a: ActivityTotals,
  salesCount: number,
  totalAp: number
): Efficiency {
  const div = (n: number, d: number) => (d > 0 ? n / d : null);
  return {
    dialsPerPickup: div(a.dials, a.pickups),
    pickupToQuotePct: div(a.quotes, a.pickups) !== null ? (a.quotes / a.pickups) * 100 : null,
    quoteToClosePct: div(salesCount, a.quotes) !== null ? (salesCount / a.quotes) * 100 : null,
    dialsPerClose: div(a.dials, salesCount),
    pickupsPerClose: div(a.pickups, salesCount),
    quotesPerClose: div(a.quotes, salesCount),
    apPerDial: div(totalAp, a.dials),
    apPerHour: div(totalAp, a.talkHours),
  };
}

export interface SalesTotals {
  count: number;
  ap: number;
  avgAp: number | null;
  dialedCount: number;
  dialedAp: number;
  warmCount: number;
  warmAp: number;
}

type SaleRow = Pick<Sale, 'annualized_premium' | 'source'>;

export function sumSales(rows: SaleRow[] | Record<string, any>[]): SalesTotals {
  const s: SalesTotals = {
    count: rows.length, ap: 0, avgAp: null,
    dialedCount: 0, dialedAp: 0, warmCount: 0, warmAp: 0,
  };
  for (const r of rows) {
    const ap = Number(r.annualized_premium ?? 0);
    s.ap += ap;
    if (r.source === 'dialed') { s.dialedCount++; s.dialedAp += ap; }
    else { s.warmCount++; s.warmAp += ap; }
  }
  s.avgAp = s.count > 0 ? s.ap / s.count : null;
  return s;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(digits) + '%';
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits);
}

export function fmtTalk(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
