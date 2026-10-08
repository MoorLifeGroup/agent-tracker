import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/auth/reset-password — { token, password } → validates the
// token (unused, unexpired) and sets the new password.
export async function POST(req: NextRequest) {
  await ensureSchema();
  const { token, password } = await req.json();

  if (!token || String(password ?? '').length < 8) {
    return NextResponse.json({ error: 'Invalid token or password too short (min 8 chars)' }, { status: 400 });
  }

  const tokenHash = createHash('sha256').update(String(token)).digest('hex');
  const { rows } = await sql`
    SELECT pr.id, pr.user_id, u.active
    FROM password_resets pr
    JOIN users u ON u.id = pr.user_id
    WHERE pr.token_hash = ${tokenHash}
      AND pr.used = false
      AND pr.expires_at > NOW()
    LIMIT 1
  `;
  const reset = rows[0];
  if (!reset || !reset.active) {
    return NextResponse.json({ error: 'This reset link is invalid or expired' }, { status: 400 });
  }

  const hash = await bcrypt.hash(String(password), 12);
  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${reset.user_id}`;
  await sql`UPDATE password_resets SET used = true WHERE id = ${reset.id}`;
  // Invalidate any other outstanding tokens for this user
  await sql`UPDATE password_resets SET used = true WHERE user_id = ${reset.user_id} AND used = false`;

  return NextResponse.json({ ok: true });
}
