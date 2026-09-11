import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { findUserForResetToken, consumeResetTokensForUser } from "@/lib/password-reset";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const user = await findUserForResetToken(token);
  if (!user?.email) {
    return NextResponse.json({ error: "This link is invalid or has expired. Request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await consumeResetTokensForUser(user.id);

  // Returned so the client can auto sign-in right after — the password
  // itself never round-trips back, only the email to key the sign-in call.
  return NextResponse.json({ ok: true, email: user.email });
}
