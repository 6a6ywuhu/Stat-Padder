const shimmer = "animate-pulse rounded-md bg-[var(--color-bg-subtle)]";

export default function PlayerProfileLoading() {
  return (
    <div>
      <div className="border-b-2 border-[var(--color-border)] bg-[var(--color-bg-subtle)]/40">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <div className={`h-4 w-16 ${shimmer}`} />
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className={`h-28 w-28 shrink-0 ${shimmer}`} />
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className={`mx-auto h-9 w-64 sm:mx-0 ${shimmer}`} />
              <div className={`mx-auto h-4 w-40 sm:mx-0 ${shimmer}`} />
            </div>
            <div className="flex gap-2">
              <div className={`h-8 w-20 ${shimmer}`} />
              <div className={`h-8 w-20 ${shimmer}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`h-16 ${shimmer}`} />
          ))}
        </div>
        <div className="space-y-3">
          <div className={`h-6 w-40 ${shimmer}`} />
          <div className={`h-20 w-full ${shimmer}`} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-10 w-full ${shimmer}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
