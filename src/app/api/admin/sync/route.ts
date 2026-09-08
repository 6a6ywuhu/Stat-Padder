import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { runSync } from "@/lib/sync-nhl-data";

// A full sync (32 rosters, ~1200 upserts) runs concurrently now, but still
// needs more than the default function budget on a cold DB.
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSync();
  return NextResponse.json(result);
}
