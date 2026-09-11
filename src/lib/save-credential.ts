"use client";

/**
 * Explicitly hands the browser's own password manager the credential the
 * user just signed in / signed up / reset with, so Chrome/Edge/Safari show
 * their native "Save password?" prompt. Without this, a JS-driven sign-in
 * (no real form submit + full navigation) often doesn't trigger it on its
 * own — this is the standards-based way to ask for it directly.
 *
 * Best-effort only: unsupported browsers (Firefox, older Safari) silently
 * no-op, and a rejected/dismissed prompt throws, which we swallow — none
 * of that should ever block the sign-in flow itself.
 */
export function maybeSaveCredential(email: string, password: string): void {
  if (typeof window === "undefined") return;
  if (typeof PasswordCredential === "undefined") return;
  if (!navigator.credentials?.store) return;
  try {
    // .store() can both throw synchronously and return a rejecting promise
    // depending on the browser/environment — swallow both. The feature
    // test above only rules out browsers with no support at all; this
    // covers "supported but this particular request failed" (no
    // credential service available, prompt dismissed, etc).
    navigator.credentials.store(new PasswordCredential({ id: email, password, name: email })).catch(() => {});
  } catch {
    // Best-effort — never let this interrupt sign-in.
  }
}
