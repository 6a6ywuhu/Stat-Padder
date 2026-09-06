export function StatusBadge({ status }: { status: "ACTIVE" | "RETIRED" | "INJURED" }) {
  if (status === "ACTIVE") return null;
  const label = status === "RETIRED" ? "Retired" : "Injured";
  return (
    <span className="rounded-none border-2 border-[var(--color-border-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
      {label}
    </span>
  );
}
