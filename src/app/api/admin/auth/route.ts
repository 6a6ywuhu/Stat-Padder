import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, adminSessionCookieValue, checkAdminPassword } from "@/lib/admin-auth";

const bodySchema = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !checkAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, adminSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  return res;
}
