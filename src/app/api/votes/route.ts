import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { attributesForPosition, BOOSTER_ATTRIBUTES, Position } from "@/lib/attributes";
import { voterTokenCookieOptions, readOrCreateVoterToken, voterHash } from "@/lib/voter";
import { auth } from "@/lib/auth";
import { getVoterState, recordSubmission, type VoterIdentity } from "@/lib/votes";

const localDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bodySchema = z.object({
  playerId: z.string().min(1),
  localDay: localDaySchema,
  values: z.record(z.string(), z.number().int().min(-100).max(100)),
});

const NO_VOTE_MESSAGE: Record<NonNullable<Awaited<ReturnType<typeof getVoterState>>["reason"]>, string> = {
  "anon-already-voted": "You've already voted on this player. Make an account to change your vote.",
  "anon-limit": "You've voted on 10 players. Make an account to vote on more.",
  "voted-today": "You already voted on this player today. Come back tomorrow to change it.",
};

async function identityFrom(req: NextRequest): Promise<{ identity: VoterIdentity; isNewToken: boolean; token: string }> {
  const { token, isNew } = readOrCreateVoterToken(req);
  const session = await auth();
  return {
    identity: { voterToken: token, voterHash: voterHash(req), userId: session?.user?.id ?? null },
    isNewToken: isNew,
    token,
  };
}

/** Voting eligibility for the profile's vote toggle. */
export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  const localDay = req.nextUrl.searchParams.get("localDay");
  if (!playerId || !localDaySchema.safeParse(localDay).success) {
    return NextResponse.json({ error: "playerId and localDay required." }, { status: 400 });
  }

  const { identity, isNewToken, token } = await identityFrom(req);
  const state = await getVoterState(playerId, identity, localDay!);

  const res = NextResponse.json(state);
  if (isNewToken) {
    const opts = voterTokenCookieOptions();
    res.cookies.set(opts.name, token, opts);
  }
  return res;
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { playerId, localDay, values } = parsed.data;

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true } });
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const allowed = new Set<string>([
    ...attributesForPosition(player.position as Position),
    ...BOOSTER_ATTRIBUTES,
  ]);
  const submitted = Object.keys(values);
  if (submitted.length === 0 || submitted.some((a) => !allowed.has(a))) {
    return NextResponse.json({ error: "One or more attributes don't apply to this player." }, { status: 400 });
  }

  const { identity, isNewToken, token } = await identityFrom(req);

  const state = await getVoterState(playerId, identity, localDay);
  if (!state.canVote) {
    return NextResponse.json(
      { error: state.reason ? NO_VOTE_MESSAGE[state.reason] : "You can't vote on this player right now.", state },
      { status: 409 }
    );
  }

  await recordSubmission({ playerId, values, identity, localDay });

  // On the request path — a serverless function can be torn down before an
  // after() callback's revalidation lands.
  revalidateTag("rankings", "max");

  const res = NextResponse.json({ ok: true });
  if (isNewToken) {
    const opts = voterTokenCookieOptions();
    res.cookies.set(opts.name, token, opts);
  }
  return res;
}
