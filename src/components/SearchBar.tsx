"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

type SearchResult = {
  players: { id: string; name: string; position: string; teamId: string | null }[];
  teams: { id: string; name: string; city: string }[];
};

export function SearchBar({ variant = "header" }: { variant?: "header" | "hero" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard debounced-fetch loading flag
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const hasResults =
    results && (results.players.length > 0 || results.teams.length > 0);

  return (
    <div ref={containerRef} className={`relative ${variant === "hero" ? "w-full max-w-xl" : "w-full max-w-xs"}`}>
      <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2">
        <MagnifyingGlass size={16} className="text-[var(--color-fg-muted)] shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search players or teams…"
          aria-label="Search players or teams"
          className="w-full bg-transparent text-sm text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-faint)]"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setResults(null);
            }}
            className="cursor-pointer text-[var(--color-fg-faint)] hover:text-[var(--color-fg)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg">
          {loading && (
            <p className="px-4 py-3 text-sm text-[var(--color-fg-muted)]">Searching…</p>
          )}
          {!loading && !hasResults && (
            <p className="px-4 py-3 text-sm text-[var(--color-fg-muted)]">
              No players or teams found.
            </p>
          )}
          {!loading && results && results.players.length > 0 && (
            <div className="border-b border-[var(--color-border)] py-2">
              <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
                Players
              </p>
              {results.players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    router.push(`/players/${p.id}`);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-subtle)]"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-[var(--color-fg-faint)]">
                    {p.position}
                    {p.teamId ? ` · ${p.teamId}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!loading && results && results.teams.length > 0 && (
            <div className="py-2">
              <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
                Teams
              </p>
              {results.teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    router.push(`/teams/${t.id}`);
                  }}
                  className="flex w-full cursor-pointer items-center px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-subtle)]"
                >
                  {t.city} {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
