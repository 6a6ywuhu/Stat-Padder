"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (res?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="font-display text-2xl font-bold text-[var(--color-fg)]">Sign in</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Sign in to save favorite players and see your own vote history. Voting itself never
        requires an account.
      </p>

      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="mt-6 w-full cursor-pointer rounded-md border-2 border-[var(--color-border-strong)] px-3 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)]"
          >
            Continue with Google
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-fg-faint)]">
            <span className="h-px flex-1 bg-[var(--color-border)]" />
            or
            <span className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={`space-y-3 ${googleEnabled ? "" : "mt-6"}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          autoFocus
          className="w-full rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-accent)]"
        />
        {error && <p className="text-sm text-[var(--color-negative)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !email || !password}
          className="btn-pixel w-full cursor-pointer rounded-md border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--color-accent-fg)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-[var(--color-fg)] underline-offset-2 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
