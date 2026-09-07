import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidVotableAttribute } from "@/lib/attributes";
import type { Position } from "@/lib/attributes";
import { voterTokenCookieOptions, readOrCreateVoterToken, voterHash } from "@/lib/voter";
import { recordVote, checkVoteSpike } from "@/lib/votes";
import type { Attribute, BoosterAttribute } from "@/lib/attributes";

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

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { position: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }
  if (!isValidVotableAttribute(attribute, player.position as Position)) {
    return NextResponse.json(
      { error: "That attribute doesn't apply to this player's position." },
      { status: 400 }
    );
  }

  const { token, isNew } = readOrCreateVoterToken(req);

  await recordVote({
    playerId,
    attribute: attribute as Attribute | BoosterAttribute,
    value,
    voterToken: token,
    voterHash: voterHash(req),
  });

  // Drop the cached scores on the request path, not in after() — on
  // Netlify the function context can be torn down before an after()
  // callback's revalidation reaches the cache, so the voter's own reload
  // kept showing the pre-vote page. Costs a few ms; worth it.
  revalidateTag("rankings", "max");

  // The abuse-guard query is slow and nobody's waiting on it.
  after(async () => {
    try {
      await checkVoteSpike(playerId, attribute as Attribute | BoosterAttribute);
    } catch {
      // best-effort abuse guard
    }
  });

  const res = NextResponse.json({ ok: true });

  if (isNew) {
    const opts = voterTokenCookieOptions();
    res.cookies.set(opts.name, token, opts);
  }

  return res;
}
