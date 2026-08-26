import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  playerId: z.string().min(1),
  message: z.string().min(3).max(500),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please include a short description of the issue." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: parsed.data.playerId } });
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  await prisma.report.create({
    data: {
      type: "DATA_ISSUE",
      playerId: parsed.data.playerId,
      message: parsed.data.message,
    },
  });

  return NextResponse.json({ ok: true });
}
