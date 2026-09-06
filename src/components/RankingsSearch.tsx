"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

/**
 * Name filter for the rankings list. Writes a debounced `q` param and drops
 * `page`; the server component reads `q` and narrows the list while keeping
 * each player's true rank. Position filters ride alongside it via their own
 * params.
 */
export function RankingsSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const currentQ = searchParams.get("q") ?? "";

  useEffect(() => {
    if (value.trim() === currentQ) return; // in sync (incl. first render) — nothing to push
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }, 250);
    return () => clearTimeout(handle);
  }, [value, currentQ, pathname, router, searchParams]);

  return (
    <div className="w-full sm:max-w-xs">
      <div className="flex items-center gap-2 rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] px-2.5 py-1 transition-colors focus-within:border-[var(--color-accent)] sm:px-3 sm:py-1.5">
        <MagnifyingGlass size={14} className="shrink-0 text-[var(--color-fg-muted)] sm:size-4" aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Filter by player name…"
          aria-label="Filter rankings by player name"
          className="w-full bg-transparent text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-faint)] sm:text-sm"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear filter"
            onClick={() => setValue("")}
            className="cursor-pointer text-[var(--color-fg-faint)] hover:text-[var(--color-fg)]"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
