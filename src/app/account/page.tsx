import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pixelProfileFor } from "@/lib/pixel-profiles";
import { SignOutButton } from "@/components/SignOutButton";
import type { Player, Team } from "@prisma/client";

export const metadata = { title: "Account — Stat Padder" };

type PlayerVoteSummary = {
  player: Player & { team: Team | null };
  /** Distinct Submit actions on this player — same "N ratings" count used on player profiles. */
  ratingCount: number;
  lastVotedAt: Date;
};

/** One row per player instead of one per attribute vote — a single rating
 * session touches up to 9 attributes at once, which flooded this list. */
function groupByPlayer(
  votes: { playerId: string; submissionId: string; createdAt: Date; player: Player & { team: Team | null } }[]
): PlayerVoteSummary[] {
  const byPlayer = new Map<string, { player: Player & { team: Team | null }; submissions: Set<string>; lastVotedAt: Date }>();
  for (const v of votes) {
    const existing = byPlayer.get(v.playerId);
    if (existing) {
      existing.submissions.add(v.submissionId);
      if (v.createdAt > existing.lastVotedAt) existing.lastVotedAt = v.createdAt;
    } else {
      byPlayer.set(v.playerId, { player: v.player, submissions: new Set([v.submissionId]), lastVotedAt: v.createdAt });
    }
  }
  return [...byPlayer.values()]
    .map((v) => ({ player: v.player, ratingCount: v.submissions.size, lastVotedAt: v.lastVotedAt }))
    .sort((a, b) => b.lastVotedAt.getTime() - a.lastVotedAt.getTime());
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const [favorites, votes] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { player: { include: { team: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attributeVote.findMany({
      where: { userId: session.user.id },
      select: { playerId: true, submissionId: true, createdAt: true, player: { include: { team: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const playerVotes = groupByPlayer(votes);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
          {session.user.image && (
            <Image src={session.user.image} alt="" fill unoptimized className="object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-[var(--color-fg)]">
            {session.user.name || "Your account"}
          </h1>
          {session.user.email && (
            <p className="truncate text-sm text-[var(--color-fg-muted)]">{session.user.email}</p>
          )}
        </div>
        <SignOutButton />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold text-[var(--color-fg)]">
          Favorite players {favorites.length > 0 && `(${favorites.length})`}
        </h2>
        {favorites.length === 0 ? (
          <p className="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-fg-muted)]">
            Star a player from their profile to save it here.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {favorites.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/players/${f.player.id}`}
                  className="flex items-center gap-3 rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)]"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
                    {(() => {
                      const portrait =
                        pixelProfileFor(f.player.firstName, f.player.lastName, f.player.position) ??
                        f.player.headshotUrl;
                      return (
                        portrait && (
                          <Image src={portrait} alt="" fill unoptimized className="object-cover" />
                        )
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                      {f.player.firstName} {f.player.lastName}
                    </p>
                    <p className="truncate text-xs text-[var(--color-fg-muted)]">
                      {f.player.position}
                      {f.player.team ? ` · ${f.player.team.id}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 font-display text-lg font-bold text-[var(--color-fg)]">Your vote history</h2>
        <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
          Private to you — votes never show who cast them anywhere else on the site.
        </p>
        {playerVotes.length === 0 ? (
          <p className="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-fg-muted)]">
            You haven&apos;t voted on anything yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)] rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-4">
            {playerVotes.map((pv) => {
              const portrait =
                pixelProfileFor(pv.player.firstName, pv.player.lastName, pv.player.position) ??
                pv.player.headshotUrl;
              return (
                <Link
                  key={pv.player.id}
                  href={`/players/${pv.player.id}`}
                  className="-mx-4 flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--color-bg-subtle)]"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
                    {portrait && <Image src={portrait} alt="" fill unoptimized className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--color-fg)]">
                      {pv.player.firstName} {pv.player.lastName}
                    </p>
                    <p className="truncate text-xs text-[var(--color-fg-muted)]">
                      {pv.player.position}
                      {pv.player.team ? ` · ${pv.player.team.id}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-xs font-medium text-[var(--color-fg-muted)]">
                      {pv.ratingCount} {pv.ratingCount === 1 ? "rating" : "ratings"}
                    </span>
                    <span className="text-xs text-[var(--color-fg-faint)]">
                      {pv.lastVotedAt.toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
