import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ players: [] });

  const players = await prisma.player.findMany({
    where: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] },
    select: { id: true, firstName: true, lastName: true, position: true, teamId: true, status: true },
    take: 15,
  });
  return NextResponse.json({ players });
}
