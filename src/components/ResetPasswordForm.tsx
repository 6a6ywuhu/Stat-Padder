"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { maybeSaveCredential } from "@/lib/save-credential";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't reset your password.");
        return;
      }

      const signInRes = await signIn("credentials", { email: data.email, password, redirect: false });
      if (signInRes?.error) {
        // Password was reset either way — just send them to sign in manually.
        router.push("/login");
        return;
      }
      maybeSaveCredential(data.email, password);
      router.push("/account");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-[var(--color-fg)]">Invalid link</h1>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
          This password reset link is missing its token. Request a new one below.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 font-medium text-[var(--color-fg)] underline-offset-2 hover:underline"
        >
          Request a reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="font-display text-2xl font-bold text-[var(--color-fg)]">Choose a new password</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        This link works once and expires an hour after it was sent.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min. 8 characters)"
          autoComplete="new-password"
          autoFocus
          className="w-full rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)]"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          className="w-full rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)]"
        />
        {error && <p className="text-sm text-[var(--color-negative)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting || password.length < 8 || !confirm}
          className="btn-pixel w-full cursor-pointer rounded-md border-2 border-[var(--color-accent)] bg-[var(--color-card)] px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--color-fg)] transition-colors hover:bg-[var(--color-accent)]/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Reset password"}
        </button>
      </form>
    </div>
  );
}
