"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "@phosphor-icons/react";

const PANEL_WIDTH = 288; // w-72
const GAP = 8;

export function ReportButton({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(
      GAP,
      Math.min(r.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - GAP)
    );
    setPos({ top: r.bottom + GAP, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <div className="inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-hero-chip cursor-pointer"
        aria-expanded={open}
      >
        <Flag size={13} />
        Report
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: PANEL_WIDTH,
              visibility: pos ? "visible" : "hidden",
            }}
            className="z-[100] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-lg"
          >
            <label
              htmlFor="report-message"
              className="mb-1 block text-xs font-medium text-[var(--color-fg-muted)]"
            >
              What&apos;s wrong with this page?
            </label>
            <textarea
              id="report-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              autoFocus
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
          </div>,
          document.body
        )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-[3px] bg-[var(--color-fg)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
