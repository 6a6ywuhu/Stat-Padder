import { prisma } from "@/lib/prisma";
import { TeamCard } from "@/components/TeamCard";

export const metadata = { title: "Teams — Stat Padder" };

const CONFERENCE_ORDER = ["Eastern", "Western"];
const DIVISION_ORDER: Record<string, string[]> = {
  Eastern: ["Atlantic", "Metropolitan"],
  Western: ["Central", "Pacific"],
};

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({ orderBy: [{ city: "asc" }] });

  const conferences = CONFERENCE_ORDER.map((conference) => ({
    conference,
    divisions: (DIVISION_ORDER[conference] ?? []).map((division) => ({
      division,
      teams: teams.filter((t) => t.conference === conference && t.division === division),
    })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Teams</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        All 32 NHL teams. Hover a card for a peek at team colors.
      </p>

      {conferences.map(({ conference, divisions }) => (
        <section key={conference} className="mt-10">
          <h2 className="font-display text-2xl font-bold text-[var(--color-fg)]">
            {conference} Conference
          </h2>

          {divisions.map(({ division, teams: divisionTeams }) => (
            <div key={division} className="mt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
                {division}
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {divisionTeams.map((t) => (
                  <TeamCard
                    key={t.id}
                    id={t.id}
                    name={t.name}
                    city={t.city}
                    primaryColor={t.primaryColor}
                    logoLight={t.logoLight}
                    logoDark={t.logoDark}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
