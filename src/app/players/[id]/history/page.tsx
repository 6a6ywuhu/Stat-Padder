import { redirect } from "next/navigation";

// The rating-history chart is disabled while the scoring model is being
// reworked — send any stale link back to the profile.
export default async function PlayerHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/players/${id}`);
}
