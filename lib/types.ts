export type Role = 'admin' | 'agent';

export type ClientStatus =
  | 'lead'
  | 'contacted'
  | 'appointment_set'
  | 'appointment_shown'
  | 'sold'
  | 'dead';

export type SaleSource = 'dialed' | 'warm';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  active: boolean;
  weekly_ap_target: number;
  created_at: string;
}

export interface Client {
  id: number;
  agent_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  status: ClientStatus;
  carrier: string | null;
  face_amount: number | null;
  premium: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  agent_name?: string;
}

export interface DailyActivity {
  id: number;
  agent_id: number;
  date: string;
  dials_auto: number;
  dials_hand: number;
  pickups: number;
  screeners: number;
  quotes: number;
  talk_minutes: number;
  appointments_set: number;
  callbacks: number;
  not_interested: number;
  bad_dnc: number;
  looking: number;
  notes: string | null;
  agent_name?: string;
}

export interface Sale {
  id: number;
  agent_id: number;
  client_name: string;
  carrier: string;
  product: string | null;
  face_amount: number | null;
  monthly_premium: number | null;
  annualized_premium: number | null;
  source: SaleSource;
  sale_date: string;
  notes: string | null;
  created_at: string;
  agent_name?: string;
}

export interface Todo {
  id: number;
  agent_id: number;
  created_by: number | null;
  title: string;
  due_date: string | null;
  done: boolean;
  notes: string | null;
  created_at: string;
  agent_name?: string;
}

export interface SessionPayload {
  userId: number;
  username: string;
  role: Role;
  displayName: string;
}

export const CARRIERS = [
  'Mutual of Omaha',
  'American Amicable',
  'Transamerica',
  'Aetna',
  'Royal Neighbors',
  'SBLI',
  'Gerber',
  'Baltimore Life',
  'Liberty Bankers',
  'Americo',
  'Aflac',
  'GTL',
  'AIG/Corebridge',
  'Kansas City Life',
  'National Life Group',
] as const;

export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'appointment_set', label: 'Appt Set' },
  { value: 'appointment_shown', label: 'Appt Shown' },
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Dead' },
];

export function statusLabel(status: ClientStatus): string {
  return CLIENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}
