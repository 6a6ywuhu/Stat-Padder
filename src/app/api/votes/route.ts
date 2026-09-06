import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidVotableAttribute } from "@/lib/attributes";
import { voterTokenCookieOptions, readOrCreateVoterToken, voterHash } from "@/lib/voter";
import { recordVoteAndCheckSpike } from "@/lib/votes";
import { auth } from "@/lib/auth";

const bodySchema = z.object({
  playerId: z.string().min(1),
  attribute: z.string().min(1),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { playerId, attribute, value } = parsed.data;

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }
  if (!isValidVotableAttribute(attribute, player.position)) {
    return NextResponse.json(
      { error: "That attribute doesn't apply to this player's position." },
      { status: 400 }
    );
  }

  const { token, isNew } = readOrCreateVoterToken(req);
  const session = await auth();

  await recordVoteAndCheckSpike({
    playerId,
    attribute,
    value,
    voterToken: token,
    voterHash: voterHash(req),
    userId: session?.user?.id,
  });

  // Rebuild the static rankings snapshot so the new vote shows up on the
  // next load rather than waiting out the 60s revalidate window. ("max" is
  // Next 16's "invalidate now" — the old single-arg behaviour.)
  revalidateTag("rankings", "max");

  const res = NextResponse.json({ ok: true });

  if (isNew) {
    const opts = voterTokenCookieOptions();
    res.cookies.set(opts.name, token, opts);
  }

  return res;
}
