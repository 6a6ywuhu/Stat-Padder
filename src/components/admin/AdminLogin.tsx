"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="font-display text-2xl font-bold text-[var(--color-fg)]">Admin</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">Enter the admin password to continue.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-none border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-ring)]"
        />
        {error && <p className="text-sm text-[var(--color-negative)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="w-full cursor-pointer rounded-none bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
