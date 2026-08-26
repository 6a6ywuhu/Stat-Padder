import { createHash } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "sp_admin";

function expectedSessionValue(): string {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  return createHash("sha256").update(`${password}::${secret}`).digest("hex");
}

export function checkAdminPassword(candidate: string): boolean {
  return candidate.length > 0 && candidate === process.env.ADMIN_PASSWORD;
}

export function adminSessionCookieValue(): string {
  return expectedSessionValue();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(ADMIN_SESSION_COOKIE)?.value;
  return !!value && value === expectedSessionValue();
}
