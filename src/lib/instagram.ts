import { prisma } from "./prisma";

/**
 * Minimal Instagram API (with Instagram Login) client: refresh the long-lived
 * token, and publish one photo. Host and endpoints per Meta's docs —
 * graph.instagram.com, POST /<IG_ID>/media then POST /<IG_ID>/media_publish.
 */

const GRAPH = process.env.INSTAGRAM_GRAPH_HOST ?? "https://graph.instagram.com";
const VERSION = process.env.INSTAGRAM_GRAPH_VERSION ?? "v23.0";
const CHANNEL = "instagram";
const REFRESH_EVERY_MS = 7 * 24 * 3600 * 1000;

export class InstagramError extends Error {}

function igUserId(): string {
  const id = process.env.INSTAGRAM_USER_ID?.trim();
  if (!id) throw new InstagramError("INSTAGRAM_USER_ID is not set");
  return id;
}

async function graph<T>(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${path.startsWith("refresh_access_token") ? "" : VERSION + "/"}${path}`);
  let body: URLSearchParams | undefined;
  if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else body = new URLSearchParams(params);

  const res = await fetch(url, { method, body, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number } } & T;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new InstagramError(e ? `${e.message ?? "Instagram error"} (code ${e.code ?? "?"}${e.error_subcode ? `/${e.error_subcode}` : ""})` : `Instagram HTTP ${res.status}`);
  }
  return json;
}

/** The token to use: the stored one, seeded from the env var on first use. */
export async function getAccessToken(): Promise<string> {
  const row = await prisma.socialAuth.findUnique({ where: { channel: CHANNEL } });
  if (row) return row.accessToken;
  const seed = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!seed) throw new InstagramError("No Instagram token: set INSTAGRAM_ACCESS_TOKEN");
  await prisma.socialAuth.create({ data: { channel: CHANNEL, accessToken: seed } });
  return seed;
}

/**
 * Extends the token another 60 days. Meta requires it to be at least 24h old
 * and not yet expired, so this runs about weekly and a failure is reported,
 * not fatal — posting can continue until the token actually expires.
 */
export async function refreshTokenIfDue(): Promise<{ refreshed: boolean; note: string }> {
  const token = await getAccessToken();
  const row = await prisma.socialAuth.findUnique({ where: { channel: CHANNEL } });
  if (row?.refreshedAt && Date.now() - row.refreshedAt.getTime() < REFRESH_EVERY_MS) {
    return { refreshed: false, note: "not due" };
  }
  try {
    const r = await graph<{ access_token: string; expires_in: number }>("GET", "refresh_access_token", {
      grant_type: "ig_refresh_token",
      access_token: token,
    });
    await prisma.socialAuth.update({
      where: { channel: CHANNEL },
      data: {
        accessToken: r.access_token,
        refreshedAt: new Date(),
        expiresAt: new Date(Date.now() + r.expires_in * 1000),
      },
    });
    return { refreshed: true, note: `new token valid ${Math.round(r.expires_in / 86400)} days` };
  } catch (e) {
    return { refreshed: false, note: `refresh failed: ${(e as Error).message}` };
  }
}

async function waitUntilReady(containerId: string, token: string): Promise<void> {
  // Meta fetches the image itself; wait until it says it's ready.
  for (let i = 0; i < 20; i++) {
    const s = await graph<{ status_code?: string }>("GET", containerId, { fields: "status_code", access_token: token });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new InstagramError(`Instagram could not process the image (${s.status_code})`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new InstagramError("Instagram took too long to process the image");
}

/**
 * Publishes JPEG image(s) and returns Instagram's media id: a single photo for
 * one URL, a swipeable carousel (2–10) for several.
 */
export async function publishMedia(opts: { imageUrls: string[]; caption: string }): Promise<string> {
  const token = await getAccessToken();
  const user = igUserId();
  if (opts.imageUrls.length === 0) throw new InstagramError("No images to post");

  let creationId: string;
  if (opts.imageUrls.length === 1) {
    const c = await graph<{ id: string }>("POST", `${user}/media`, {
      image_url: opts.imageUrls[0],
      caption: opts.caption,
      access_token: token,
    });
    creationId = c.id;
  } else {
    const children: string[] = [];
    for (const imageUrl of opts.imageUrls) {
      const child = await graph<{ id: string }>("POST", `${user}/media`, {
        image_url: imageUrl,
        is_carousel_item: "true",
        access_token: token,
      });
      await waitUntilReady(child.id, token);
      children.push(child.id);
    }
    const parent = await graph<{ id: string }>("POST", `${user}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: opts.caption,
      access_token: token,
    });
    creationId = parent.id;
  }

  await waitUntilReady(creationId, token);
  const published = await graph<{ id: string }>("POST", `${user}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return published.id;
}

/** Publishes one 9:16 JPEG as an Instagram Story and returns its media id. (Stories take no caption.) */
export async function publishStory(imageUrl: string): Promise<string> {
  const token = await getAccessToken();
  const user = igUserId();
  const container = await graph<{ id: string }>("POST", `${user}/media`, {
    image_url: imageUrl,
    media_type: "STORIES",
    access_token: token,
  });
  await waitUntilReady(container.id, token);
  const published = await graph<{ id: string }>("POST", `${user}/media_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  return published.id;
}

/**
 * Read-only: who the stored token belongs to, and whether it matches
 * INSTAGRAM_USER_ID. Meta hands out two different numbers per account (the
 * app-scoped `id` and the publishing `user_id`); posting needs `user_id`.
 */
export async function verifyAccount(): Promise<{ username?: string; userId?: string; idMatchesEnv: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    const me = await graph<{ id?: string; user_id?: string; username?: string }>("GET", "me", {
      fields: "user_id,username",
      access_token: token,
    });
    const configured = process.env.INSTAGRAM_USER_ID?.trim();
    return { username: me.username, userId: me.user_id, idMatchesEnv: !!configured && configured === String(me.user_id ?? me.id) };
  } catch (e) {
    return { idMatchesEnv: false, error: (e as Error).message };
  }
}
