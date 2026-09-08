import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ATTRIBUTE_LABELS, BOOSTER_ATTRIBUTE_LABELS } from "@/lib/attributes";
import { pixelProfileFor } from "@/lib/pixel-profiles";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Account — Stat Padder" };

function labelFor(attribute: string): string {
  return (
    (ATTRIBUTE_LABELS as Record<string, string>)[attribute] ??
    (BOOSTER_ATTRIBUTE_LABELS as Record<string, string>)[attribute] ??
    attribute
  );
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
      include: { player: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

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
        {votes.length === 0 ? (
          <p className="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-fg-muted)]">
            You haven&apos;t voted on anything yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)] rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-4">
            {votes.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/players/${v.playerId}`} className="font-medium text-[var(--color-fg)] hover:underline">
                    {v.player.firstName} {v.player.lastName}
                  </Link>
                  <span className="text-[var(--color-fg-muted)]"> · {labelFor(v.attribute)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`font-display font-bold tabular-nums ${
                      v.value > 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
                    }`}
                  >
                    {v.value > 0 ? "+1" : "−1"}
                  </span>
                  <span className="text-xs text-[var(--color-fg-faint)]">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
