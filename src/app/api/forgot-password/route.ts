import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issuePasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail, sendNoPasswordAccountEmail } from "@/lib/mail";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
});

// Same message no matter what — whether the address has an account, has no
// password (Google-only), or was rate-limited from getting another email
// this minute. The only thing that varies is what (if anything) we send.
const GENERIC_OK = { ok: true, message: "If an account exists for that email, we've sent instructions." };

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true } });
  if (!user?.email) return NextResponse.json(GENERIC_OK);

  if (!user.passwordHash) {
    await sendNoPasswordAccountEmail(user.email);
    return NextResponse.json(GENERIC_OK);
  }

  const token = await issuePasswordResetToken(user.id);
  if (token) {
    const resetUrl = `${req.nextUrl.origin}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }
  // token === null means one was already issued in the last minute — say
  // nothing different; they already have a working link in their inbox.

  return NextResponse.json(GENERIC_OK);
}
