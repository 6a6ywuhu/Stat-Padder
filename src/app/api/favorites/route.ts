import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ playerId: z.string().min(1) });

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ favorited: false });

  const playerId = req.nextUrl.searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const fav = await prisma.favorite.findUnique({
    where: { userId_playerId: { userId: session.user.id, playerId } },
  });
  return NextResponse.json({ favorited: Boolean(fav) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to favorite players." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { playerId } = parsed.data;

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_playerId: { userId: session.user.id, playerId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  await prisma.favorite.create({ data: { userId: session.user.id, playerId } });
  return NextResponse.json({ favorited: true });
}
