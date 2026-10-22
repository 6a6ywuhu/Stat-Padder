import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

/** Shared pieces for the 1080×1350 Instagram card routes. */

export const CARD_W = 1080;
export const CARD_H = 1350;

export const CARD_COLORS = {
  ink: "#10201d",
  muted: "#4c625d",
  line: "#bdd1ca",
  bg: "#f1f6f4",
  red: "#e11d16",
  green: "#157a3d",
};

export function loadCardFont(): Promise<Buffer> {
  return readFile(join(process.cwd(), "src", "assets", "Jersey10-Regular.ttf"));
}

/** Fetches an image (site-relative path or full URL) as a data URI; null on any failure. */
export async function portraitDataUri(src: string | null, origin: string): Promise<string | null> {
  if (!src) return null;
  try {
    const url = src.startsWith("http") ? src : `${origin}${src}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Instagram's publishing API accepts JPEG only, so cards can be returned as JPEG. */
export async function respondWithCard(image: Response, wantJpeg: boolean): Promise<Response> {
  if (!wantJpeg) return image;
  const png = Buffer.from(await image.arrayBuffer());
  const jpg = await sharp(png).flatten({ background: CARD_COLORS.bg }).jpeg({ quality: 92 }).toBuffer();
  return new Response(new Uint8Array(jpg), {
    headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
  });
}
