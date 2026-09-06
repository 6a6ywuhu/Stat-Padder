import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  playerId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first.").max(500, "Keep it under 500 characters."),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid comment." }, { status: 400 });
  }
  const { playerId, body } = parsed.data;

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { playerId, body, userId: session.user.id },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  return NextResponse.json({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: comment.user.name || comment.user.email || "Someone",
    authorImage: comment.user.image,
  });
}
