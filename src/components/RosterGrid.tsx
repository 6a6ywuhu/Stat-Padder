"use client";

import { Children, useState } from "react";

/**
 * Shows only the first `initialCount` cards passed as children, with a "See
 * all" toggle to reveal the rest — the section's own <h2> stays outside
 * this component, so collapsing back down never hides the heading itself.
 */
export function RosterGrid({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const hiddenCount = items.length - initialCount;
  const visible = expanded ? items : items.slice(0, initialCount);

  return (
    <>
      <div className="grid items-start gap-2 sm:grid-cols-2 sm:gap-3">{visible}</div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-sm font-medium text-[var(--color-fg-muted)] underline-offset-2 transition-colors hover:text-[var(--color-fg)] hover:underline"
        >
          {expanded ? "See less" : "See all"}
        </button>
      )}
    </>
  );
}
