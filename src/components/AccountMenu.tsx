"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { User } from "@phosphor-icons/react";

/**
 * Sign-in link when logged out; name/avatar + dropdown (Account, Sign out)
 * when logged in. `align` picks which edge the dropdown hangs from — it has
 * to match which side of the viewport the trigger button sits near, or the
 * fixed-width panel runs off-screen. The desktop header button sits at the
 * far right (align="right", the default); the mobile menu's copy sits at
 * the left instead, so it's rendered with align="left".
 */
export function AccountMenu({ align = "right" }: { align?: "left" | "right" }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (status === "loading") {
    return <div className="h-8 w-8 shrink-0 animate-pulse rounded-none bg-[var(--color-bg-subtle)]" aria-hidden="true" />;
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-none border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
      >
        Sign in
      </Link>
    );
  }

  const label = session.user?.name || session.user?.email || "Account";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-none border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
      >
        {session.user?.image ? (
          <Image src={session.user.image} alt="" width={32} height={32} className="h-full w-full object-cover" unoptimized />
        ) : (
          <User size={16} weight="bold" />
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-2 w-48 overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <p className="truncate border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-fg-muted)]">
            {label}
          </p>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]"
          >
            Account
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full cursor-pointer px-4 py-2 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
