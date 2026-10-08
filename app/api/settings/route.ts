import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { testWebhook, type WebhookKind } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const KINDS: WebhookKind[] = ['sale', 'activity', 'agent', 'weekly'];
const KEY_MAP: Record<WebhookKind, string> = {
  sale: 'discord_webhook_sale',
  activity: 'discord_webhook_activity',
  agent: 'discord_webhook_agent',
  weekly: 'discord_webhook_weekly',
};

// GET /api/settings — admin reads webhook URLs (masked state, not raw values to non-admin)
export async function GET() {
  await ensureSchema();
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { rows } = await sql`SELECT key, value FROM settings`;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  const webhooks: Record<string, { configured: boolean; preview: string }> = {};
  for (const k of KINDS) {
    const v: string = map[KEY_MAP[k]] ?? '';
    webhooks[k] = { configured: v.length > 10, preview: v ? `…${v.slice(-12)}` : '' };
  }
  return NextResponse.json({ webhooks });
}

// POST /api/settings — admin saves webhook URLs { kind: url } (empty string clears)
export async function POST(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const kind = body.kind as WebhookKind;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  const url = String(body.url || '').trim().slice(0, 500);
  if (url && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
    return NextResponse.json({ error: 'Must be a valid Discord webhook URL' }, { status: 400 });
  }
  await sql`
    INSERT INTO settings (key, value) VALUES (${KEY_MAP[kind]}, ${url})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return NextResponse.json({ ok: true });
}

// POST /api/settings/test — { kind } sends a test message
export async function PUT(req: NextRequest) {
  await ensureSchema();
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const kind = body.kind as WebhookKind;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  const ok = await testWebhook(kind);
  return NextResponse.json({ ok, error: ok ? undefined : 'Send failed — check the URL' });
}
