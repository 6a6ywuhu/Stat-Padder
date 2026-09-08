import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ players: [], teams: [] });
  }

  // Each whitespace token must match somewhere in the name; a single token
  // can land in either firstName or lastName, so "dylan larkin", "larkin",
  // and "dylan" all resolve to the same player.
  const tokens = q.split(/\s+/).filter(Boolean);
  const playerWhere = {
    AND: tokens.map((t) => ({
      OR: [{ firstName: { contains: t } }, { lastName: { contains: t } }],
    })),
  };

  const [playerMatches, teams] = await Promise.all([
    prisma.player.findMany({
      where: playerWhere,
      select: { id: true, firstName: true, lastName: true, position: true, teamId: true },
      take: 8,
    }),
    prisma.team.findMany({
      where: {
        OR: [{ name: { contains: q } }, { city: { contains: q } }],
      },
      select: { id: true, name: true, city: true },
      take: 5,
    }),
  ]);

  const players = playerMatches
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      position: p.position,
      teamId: p.teamId,
    }));

  return NextResponse.json({ players, teams });
}
