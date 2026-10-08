/**
 * Transactional email via Resend. Requires RESEND_API_KEY env var.
 * If unset, sendEmail logs and returns false (password reset flow
 * degrades gracefully — admin can still reset passwords manually).
 */

const FROM = process.env.EMAIL_FROM ?? 'Agent Tracker <noreply@moorlifegroup.com>';

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping send to', to);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[email] Resend error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send failed:', err);
    return false;
  }
}

export function passwordResetHtml(displayName: string, resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset your Agent Tracker password</h2>
      <p>Hi ${displayName},</p>
      <p>Click the link below to set a new password. It expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="display:inline-block; padding: 12px 24px; background: #f5b301; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: bold;">Set new password</a></p>
      <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can ignore this email.</p>
    </div>
  `;
}
