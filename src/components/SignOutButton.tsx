"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="shrink-0 cursor-pointer rounded-none border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-negative)] hover:text-[var(--color-negative)]"
    >
      Sign out
    </button>
  );
}
