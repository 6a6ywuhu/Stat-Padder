import { Resend } from "resend";

// Lazily constructed: importing this module must never crash a build or a
// route that doesn't end up sending mail just because the env var isn't
// set yet in this environment (local dev, preview branches, ...).
let client: Resend | null = null;
function resendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

// Resend's shared onboarding domain works with no setup and can send to
// any address, not just your own — good enough until statpadder.ca is
// verified as a sender in the Resend dashboard. Swap RESEND_FROM_EMAIL to
// e.g. "Stat Padder <noreply@statpadder.ca>" once that's done.
const FROM = process.env.RESEND_FROM_EMAIL || "Stat Padder <onboarding@resend.dev>";

export const emailEnabled = Boolean(process.env.RESEND_API_KEY);

/**
 * Sends the "reset your password" email. Returns true on success. Never
 * throws — a delivery failure shouldn't turn into a 500 that also leaks
 * "this email exists" through response timing/shape; callers just log it.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const resend = resendClient();
  if (!resend) {
    console.warn(`[mail] RESEND_API_KEY not set — reset link for ${to}: ${resetUrl}`);
    return false;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Stat Padder password",
    text: `Reset your Stat Padder password by opening this link (expires in 1 hour):\n\n${resetUrl}\n\nDidn't request this? Ignore this email — your password is unchanged.`,
    html: resetPasswordHtml(resetUrl),
  });
  if (error) {
    console.error("[mail] failed to send password reset email:", error);
    return false;
  }
  return true;
}

/** Sent instead, to the same address, when the account has no password to reset (Google-only). */
export async function sendNoPasswordAccountEmail(to: string): Promise<boolean> {
  const resend = resendClient();
  if (!resend) {
    console.warn(`[mail] RESEND_API_KEY not set — would have told ${to} to use Google sign-in`);
    return false;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "About your Stat Padder sign-in",
    text: `Someone (hopefully you) asked to reset the password on this Stat Padder account, but it doesn't have one — you signed up with Google. Use the "Continue with Google" button to sign in instead.`,
    html: `<p>Someone (hopefully you) asked to reset the password on this Stat Padder account — but it doesn't have one, since it was created with Google sign-in.</p><p>Use the <strong>Continue with Google</strong> button on the sign-in page instead.</p>`,
  });
  if (error) {
    console.error("[mail] failed to send no-password-account email:", error);
    return false;
  }
  return true;
}

function resetPasswordHtml(resetUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f1f6f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d7e5e0;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4c625d;">Stat Padder</p>
        <h1 style="margin:12px 0 0;font-size:20px;color:#10201d;">Reset your password</h1>
      </td></tr>
      <tr><td style="padding:8px 28px 0;">
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4c625d;">
          Click the button below to choose a new password. This link expires in 1 hour and can only be used once.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#10201d;color:#f1f6f4;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:6px;">Reset password</a>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#83968f;">
          Didn't request this? You can ignore this email — your password is unchanged.
        </p>
      </td></tr>
      <tr><td style="padding:24px 28px 28px;">
        <p style="margin:0;font-size:11px;color:#83968f;word-break:break-all;">${resetUrl}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
