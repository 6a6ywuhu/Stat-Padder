import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teams = await prisma.team.findMany({
    select: { id: true, city: true, name: true },
    orderBy: { city: "asc" },
  });
  return NextResponse.json({ teams });
}
