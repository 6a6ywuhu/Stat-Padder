/**
 * Resolves the libSQL connection config from the environment, shared by the
 * Prisma adapter (src/lib/prisma.ts) and the ops scripts.
 *
 * Values pasted into a hosting dashboard sometimes arrive wrapped in quotes
 * or with stray whitespace, which makes libSQL reject the first request
 * with an opaque 400 — so trim both.
 */
function clean(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const trimmed = v.trim().replace(/^['"]|['"]$/g, "").trim();
  return trimmed.length ? trimmed : undefined;
}

export function libsqlConfig(): { url: string; authToken?: string } {
  const url = clean(process.env.TURSO_DATABASE_URL) ?? "file:./prisma/dev.db";
  const authToken = clean(process.env.TURSO_AUTH_TOKEN);
  return { url, authToken };
}

/** One-line masked summary for build logs — never prints the token. */
export function libsqlConfigSummary(): string {
  const { url, authToken } = libsqlConfig();
  const host = url.startsWith("file:") ? url : url.replace(/^[a-z]+:\/\//, "").split("/")[0];
  return `libsql target: ${host} | auth token: ${authToken ? `${authToken.length} chars` : "none"}`;
}
