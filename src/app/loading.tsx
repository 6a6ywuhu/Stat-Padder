const shimmer = "animate-pulse rounded-md bg-[var(--color-bg-subtle)]";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col items-center gap-6">
        <div className={`h-6 w-40 ${shimmer}`} />
        <div className={`h-24 w-full max-w-[420px] ${shimmer} sm:h-40 sm:max-w-[760px]`} />
        <div className={`h-5 w-72 ${shimmer}`} />
        <div className={`h-11 w-full max-w-xl ${shimmer}`} />
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className={`h-5 w-56 ${shimmer}`} />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className={`h-12 w-full ${shimmer}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
