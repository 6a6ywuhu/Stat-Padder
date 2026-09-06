import { Suspense } from "react";
import { getRankingsAll } from "@/lib/rankings-snapshot";
import { RankingsClient } from "@/components/RankingsClient";

export const metadata = { title: "Rankings — Stat Padder" };

// Fully static: the page ships the default-window snapshot and does all
// filtering client-side, so the first visit is a CDN edge read anywhere.
// The snapshot cache refreshes every 60s and is busted immediately on a
// vote via revalidateTag("rankings").
export const revalidate = 60;

export default async function RankingsPage() {
  const initial = await getRankingsAll();
  return (
    <Suspense fallback={<div className="mx-auto min-h-[60vh] max-w-4xl px-4 py-10 sm:px-6" />}>
      <RankingsClient initial={initial} />
    </Suspense>
  );
}
