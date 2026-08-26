import { NextRequest, NextResponse } from "next/server";
import { getDailyVoteStatus } from "@/lib/votes";
import { VOTER_TOKEN_COOKIE } from "@/lib/voter";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(VOTER_TOKEN_COOKIE)?.value;
  const status = await getDailyVoteStatus(token);
  return NextResponse.json(status);
}
