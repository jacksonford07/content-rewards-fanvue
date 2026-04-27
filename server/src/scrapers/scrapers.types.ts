export type Platform = "tiktok" | "instagram" | "youtube";

export interface ScrapeResult {
  viewCount: number | null;
  available: boolean;
  postedAt?: Date;
  platformUsername?: string;
  /** Direct CDN URL of the playable video file, if the API exposes it.
   * Used by AI verification to pull keyframes — usually short-lived. */
  videoUrl?: string;
}

export function detectPlatform(url: string): Platform | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("youtube.com") || host.includes("youtu.be"))
      return "youtube";
    return null;
  } catch {
    return null;
  }
}

export function extractTikTokVideoId(url: string): string | null {
  const m = url.match(/\/(?:video|photo)\/(\d+)/);
  return m?.[1] ?? null;
}

export function extractInstagramShortcode(url: string): string | null {
  const m = url.match(/\/(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // youtu.be/VIDEO_ID
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      // /watch?v=VIDEO_ID
      const v = parsed.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) return v;

      // /shorts/VIDEO_ID or /embed/VIDEO_ID or /live/VIDEO_ID
      const m = parsed.pathname.match(
        /\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,})/,
      );
      if (m) return m[1];
    }

    return null;
  } catch {
    return null;
  }
}

// Resolves TikTok mobile-share shortlinks (vm.tiktok.com, vt.tiktok.com,
// tiktok.com/t/...) to their canonical /@user/video/ID form by following
// the 302 redirect. Non-short URLs are returned unchanged.
export async function resolveShortUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const host = parsed.hostname.toLowerCase();
  const isTikTokShort =
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com" ||
    (host.endsWith("tiktok.com") && parsed.pathname.startsWith("/t/"));

  if (!isTikTokShort) return url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    const location = res.headers.get("location");
    return location ?? url;
  } catch {
    return url;
  } finally {
    clearTimeout(timeout);
  }
}
