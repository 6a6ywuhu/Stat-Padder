import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { isKnownVotableAttribute } from "@/lib/attributes";
import { voterTokenCookieOptions, readOrCreateVoterToken, voterHash } from "@/lib/voter";
import { recordVote, checkVoteSpike, VoteValue } from "@/lib/votes";
import type { Attribute, BoosterAttribute } from "@/lib/attributes";

const bodySchema = z.object({
  playerId: z.string().min(1),
  attribute: z.string().min(1),
  value: z.union([z.literal(-5), z.literal(-1), z.literal(1), z.literal(5)]),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { playerId, attribute, value } = parsed.data;

  if (!isKnownVotableAttribute(attribute)) {
    return NextResponse.json({ error: "Unknown attribute." }, { status: 400 });
  }

  const { token, isNew } = readOrCreateVoterToken(req);

  // One write, nothing else on the blocking path — the DB is a region away,
  // so the old "look the player up to validate position" round trip was
  // most of the wait. A forged attribute now just makes a row that scoring
  // ignores (it only reads a position's known attributes).
  await recordVote({
    playerId,
    attribute: attribute as Attribute | BoosterAttribute,
    value: value as VoteValue,
    voterToken: token,
    voterHash: voterHash(req),
  });

  // Spike check + rankings-cache invalidation run after the response is
  // flushed, so they never add to the voter's wait.
  after(async () => {
    try {
      await checkVoteSpike(playerId, attribute as Attribute | BoosterAttribute);
    } catch {
      // best-effort abuse guard
    }
    revalidateTag("rankings", "max");
  });

  const res = NextResponse.json({ ok: true });

  if (isNew) {
    const opts = voterTokenCookieOptions();
    res.cookies.set(opts.name, token, opts);
  }

  return res;
}
