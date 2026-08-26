import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidVotableAttribute } from "@/lib/attributes";
import { voterTokenCookieOptions, readOrCreateVoterToken, voterHash } from "@/lib/voter";
import { getDailyVoteStatus, recordVoteAndCheckSpike } from "@/lib/votes";

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

  const status = await getDailyVoteStatus(token);
  if (status.remaining <= 0) {
    return NextResponse.json(
      { error: "You've used all your votes for today.", remaining: 0, resetAt: status.resetAt },
      { status: 429 }
    );
  }

  await recordVoteAndCheckSpike({
    playerId,
    attribute,
    value,
    voterToken: token,
    voterHash: voterHash(req),
  });

  const res = NextResponse.json({
    ok: true,
    remaining: status.remaining - 1,
    limit: status.limit,
  });

  if (isNew) {
    const opts = voterTokenCookieOptions();
    res.cookies.set(opts.name, token, opts);
  }

  return res;
}
