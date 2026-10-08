import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { ensureSchema, sql } from '@/lib/db';
import { sendEmail, passwordResetHtml } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/auth/forgot-password — { email } → generates a 1-hour token
// and emails a reset link. Always returns ok (no account enumeration).
export async function POST(req: NextRequest) {
  await ensureSchema();
  const { email } = await req.json();
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  if (cleanEmail) {
    const { rows } = await sql`
      SELECT id, display_name, email FROM users WHERE email = ${cleanEmail} AND active = true LIMIT 1
    `;
    const user = rows[0];
    if (user) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await sql`
        INSERT INTO password_resets (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, ${expires.toISOString()})
      `;

      const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agent-tracker-wheat.vercel.app';
      const resetUrl = `${base}/reset-password?token=${token}`;
      await sendEmail(user.email, 'Reset your Agent Tracker password', passwordResetHtml(user.display_name, resetUrl));
    }
  }

  // Always ok — don't reveal whether the email exists
  return NextResponse.json({ ok: true });
}
