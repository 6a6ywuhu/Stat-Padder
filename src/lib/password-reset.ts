import { randomBytes, createHash } from "node:crypto";
import { prisma } from "./prisma";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 request per user per minute

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/**
 * Issues a fresh reset token for a user: invalidates any tokens still
 * outstanding for them, then creates one new one. Only the sha256 hash is
 * stored — the raw value (what goes in the emailed link) is never
 * persisted, same reasoning as not storing plaintext passwords.
 *
 * Returns null (and creates nothing) if the user requested another token
 * within the last minute, so the endpoint can't be used to spam an inbox.
 */
export async function issuePasswordResetToken(userId: string): Promise<string | null> {
  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) return null;

  const raw = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({
      data: { userId, token: hashToken(raw), expires: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);
  return raw;
}

/** Looks up the user for a raw (unhashed) token, honoring expiry. Does not consume it. */
export async function findUserForResetToken(raw: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { token: hashToken(raw) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!row || row.expires < new Date()) return null;
  return row.user;
}

/** Deletes every outstanding reset token for a user — call after a successful reset. */
export async function consumeResetTokensForUser(userId: string) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}
