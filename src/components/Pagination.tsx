import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
      <PageLink page={page - 1} disabled={page <= 1} hrefFor={hrefFor}>
        Previous
      </PageLink>
      <span className="text-sm tabular-nums text-[var(--color-fg-muted)]">
        Page {page} of {totalPages}
      </span>
      <PageLink page={page + 1} disabled={page >= totalPages} hrefFor={hrefFor}>
        Next
      </PageLink>
    </nav>
  );
}

function PageLink({
  page,
  disabled,
  hrefFor,
  children,
}: {
  page: number;
  disabled: boolean;
  hrefFor: (page: number) => string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-none border-2 border-[var(--color-border)] px-4 py-1.5 font-display text-sm font-semibold text-[var(--color-fg-faint)] opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={hrefFor(page)}
      replace
      className="rounded-none border-2 border-[var(--color-border-strong)] px-4 py-1.5 font-display text-sm font-semibold text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent-text)]"
    >
      {children}
    </Link>
  );
}
