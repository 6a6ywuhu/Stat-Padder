"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--color-fg)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
        That page hit an error on our end. Try again — if it keeps happening, it&apos;s usually a
        temporary blip with a data source.
      </p>
      <button
        type="button"
        onClick={reset}
        className="btn-pixel mt-6 cursor-pointer border-2 border-[var(--color-accent)] bg-[var(--color-card)] px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-[var(--color-fg)] transition-colors hover:bg-[var(--color-accent)]/15"
      >
        Try again
      </button>
    </div>
  );
}
