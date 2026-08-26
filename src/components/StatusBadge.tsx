export function StatusBadge({ status }: { status: "ACTIVE" | "RETIRED" | "INJURED" }) {
  if (status === "ACTIVE") return null;
  const label = status === "RETIRED" ? "Retired" : "Injured";
  return (
    <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-fg-faint)]">
      {label}
    </span>
  );
}
