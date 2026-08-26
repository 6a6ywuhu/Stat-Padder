import Link from "next/link";
import { ArrowRight, ChartBar, Users, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/SearchBar";

export default function Home() {
  return (
    <div>
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--color-fg)] sm:text-6xl">
            Vote on what makes NHL players great.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[var(--color-fg-muted)] sm:text-lg">
            Rate skaters and goalies on the individual skills that matter — mobility,
            shooting, sense, and more. No account needed.
          </p>
          <div className="mx-auto mt-8 flex justify-center">
            <SearchBar variant="hero" />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/rankings"
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-fg)] px-5 py-2.5 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90"
            >
              See rankings
              <ArrowRight size={15} weight="bold" />
            </Link>
            <Link
              href="/teams"
              className="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
            >
              Browse teams
            </Link>
            <Link
              href="/player-stats"
              className="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
            >
              Player stats
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-2xl font-bold text-[var(--color-fg)]">How voting works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <HowStep
            icon={<Users size={22} weight="bold" />}
            title="Pick any player"
            body="Every skater and goalie has six votable attributes — no signup required to weigh in."
          />
          <HowStep
            icon={<ChartBar size={22} weight="bold" />}
            title="Vote + or −"
            body="Each attribute gets its own up/down vote. Green and red bars track positive and negative votes separately."
          />
          <HowStep
            icon={<ShieldCheck size={22} weight="bold" />}
            title="One vote a day"
            body="You can revote each attribute 24 hours after your last vote on it — tracked per browser, not per account."
          />
        </div>
      </section>

      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
          <h2 className="font-display text-xl font-bold text-[var(--color-fg)]">
            Skaters vs. goalies, own terms
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--color-fg-muted)]">
            Right wingers, left wingers, centers, and defensemen all share the same six
            attributes, so you can compare across those positions any time. Goalies vote
            on a separate set — mobility, blocker, glove, tracking, rebound control, and
            positioning — and are never mixed in with skaters.
          </p>
        </div>
      </section>
    </div>
  );
}

function HowStep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-fg)] text-[var(--color-bg)]">
        {icon}
      </div>
      <h3 className="mt-3 font-display text-lg font-bold text-[var(--color-fg)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{body}</p>
    </div>
  );
}
