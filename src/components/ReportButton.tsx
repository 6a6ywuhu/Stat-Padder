"use client";

import { useState } from "react";
import { Flag } from "@phosphor-icons/react";

export function ReportButton({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function submit() {
    if (message.trim().length < 3) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, message: message.trim() }),
      });
      if (res.ok) {
        setOpen(false);
        setMessage("");
        setToast("Report submitted");
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast("Couldn't submit report — try again.");
        setTimeout(() => setToast(null), 4000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-hero-chip cursor-pointer"
      >
        <Flag size={13} />
        Report
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-lg">
          <label htmlFor="report-message" className="mb-1 block text-xs font-medium text-[var(--color-fg-muted)]">
            What&apos;s wrong with this page?
          </label>
          <textarea
            id="report-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="e.g. wrong team, wrong stat, typo in name…"
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-fg)] outline-none focus-visible:border-[var(--color-ring)]"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-none px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || message.trim().length < 3}
              onClick={submit}
              className="cursor-pointer rounded-none bg-[var(--color-fg)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[3px] bg-[var(--color-fg)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
