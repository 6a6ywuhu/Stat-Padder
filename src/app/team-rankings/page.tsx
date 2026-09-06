import { Suspense } from "react";
import { getTeamRankingsSnapshot } from "@/lib/team-rankings-snapshot";
import { TeamRankingsClient } from "@/components/TeamRankingsClient";

export const metadata = { title: "Team Rankings — Stat Padder" };

// Fully static: all three windows ship with the page, the toggle is
// instant client-side. Snapshot refreshes every 60s; busted on a vote via
// revalidateTag("rankings").
export const revalidate = 60;

export default async function TeamRankingsPage() {
  const snapshot = await getTeamRankingsSnapshot();
  return (
    <Suspense fallback={<div className="mx-auto min-h-[60vh] max-w-4xl px-4 py-10 sm:px-6" />}>
      <TeamRankingsClient snapshot={snapshot} />
    </Suspense>
  );
}
