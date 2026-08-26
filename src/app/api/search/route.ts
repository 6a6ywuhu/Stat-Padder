import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ players: [], teams: [] });
  }

  const [firstNameMatches, lastNameMatches, teams] = await Promise.all([
    prisma.player.findMany({
      where: { firstName: { contains: q } },
      select: { id: true, firstName: true, lastName: true, position: true, teamId: true },
      take: 8,
    }),
    prisma.player.findMany({
      where: { lastName: { contains: q } },
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

  const seen = new Set<string>();
  const players = [...firstNameMatches, ...lastNameMatches]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      position: p.position,
      teamId: p.teamId,
    }));

  return NextResponse.json({ players, teams });
}
