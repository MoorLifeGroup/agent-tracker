import { ensureSchema, sql } from './db';

export type WebhookKind = 'sale' | 'activity' | 'agent' | 'weekly';

const KEY_MAP: Record<WebhookKind, string> = {
  sale: 'discord_webhook_sale',
  activity: 'discord_webhook_activity',
  agent: 'discord_webhook_agent',
  weekly: 'discord_webhook_weekly',
};

export async function getSetting(key: string): Promise<string> {
  await ensureSchema();
  const { rows } = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? '';
}

export async function getWebhookUrl(kind: WebhookKind): Promise<string> {
  return getSetting(KEY_MAP[kind]);
}

/** POST a message to a Discord webhook. Skips silently if not configured. */
export async function sendWebhook(
  kind: WebhookKind,
  content: string,
  opts?: { username?: string }
): Promise<boolean> {
  const url = await getWebhookUrl(kind);
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.slice(0, 2000),
        username: opts?.username ?? 'Agent Tracker',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function testWebhook(kind: WebhookKind): Promise<boolean> {
  return sendWebhook(
    kind,
    `✅ Webhook test from Agent Tracker — ${kind} notifications are working.`
  );
}
