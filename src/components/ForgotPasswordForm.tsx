"use client";

import { useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-[var(--color-fg)]">Check your email</h1>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
          If an account exists for <span className="font-medium text-[var(--color-fg)]">{email}</span>, we&apos;ve
          sent a link to reset the password. It expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="mt-6 font-medium text-[var(--color-fg)] underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="font-display text-2xl font-bold text-[var(--color-fg)]">Reset your password</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Enter the email on your account and we&apos;ll send a link to reset your password.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          autoFocus
          className="w-full rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)]"
        />
        {error && <p className="text-sm text-[var(--color-negative)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !email}
          className="btn-pixel w-full cursor-pointer rounded-md border-2 border-[var(--color-accent)] bg-[var(--color-card)] px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--color-fg)] transition-colors hover:bg-[var(--color-accent)]/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
        <Link href="/login" className="font-medium text-[var(--color-fg)] underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
