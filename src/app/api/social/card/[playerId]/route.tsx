import { ImageResponse } from "next/og";
import { getCardData } from "@/lib/social-card-data";
import { backCard, frontCard, STORY_H, storyFrame } from "@/lib/social-cards";
import { pixelProfileFor } from "@/lib/pixel-profiles";
import { CARD_H, CARD_W, loadCardFont, portraitDataUri, respondWithCard } from "@/lib/social-image";

export const runtime = "nodejs";

/**
 * Hockey-card slides for one player. ?slide=1 (default) is the front with the
 * community ratings, ?slide=2 the back with NHL stats and games played;
 * ?format=jpg returns JPEG, which Instagram requires; ?story=1 puts the slide on a 9:16 Story canvas. Public data only.
 */
export async function GET(req: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const url = new URL(req.url);
  const slide = url.searchParams.get("slide") === "2" ? 2 : 1;

  const [data, font] = await Promise.all([getCardData(playerId), loadCardFont()]);
  if (!data) return new Response("Player not found", { status: 404 });

  const s = data.snap;
  const portrait = await portraitDataUri(pixelProfileFor(s.firstName, s.lastName, s.position) ?? s.headshotUrl, url.origin);

  const story = url.searchParams.get("story") === "1";
  const card = slide === 2 ? backCard(data, portrait) : frontCard(data, portrait, story ? "POST" : "SWIPE");
  const image = new ImageResponse(story ? storyFrame(card) : card, {
    width: CARD_W,
    height: story ? STORY_H : CARD_H,
    fonts: [{ name: "Jersey 10", data: font, style: "normal", weight: 400 }],
  });
  return respondWithCard(image, url.searchParams.get("format") === "jpg");
}
