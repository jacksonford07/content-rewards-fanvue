import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { ScrapersService } from "../scrapers/scrapers.service.js";
import { FrameExtractorService } from "./frame-extractor.service.js";
import { detectPlatform } from "../scrapers/scrapers.types.js";

export type AiReviewResult = "clean" | "flagged";

export interface AiVerificationOutcome {
  result: AiReviewResult;
  notes: string;
}

export interface AiVerificationContext {
  clipUrl: string;
  campaign: {
    id: string;
    title: string;
    description: string;
    requirementsText?: string | null;
    sourceContentUrl?: string | null;
    sourceThumbnailUrl?: string | null;
  };
}

// Sonnet 4.6 — Jackson asked for one Sonnet call for face-likeness; it's a
// lot more reliable than Haiku at recognising "is this the same person".
const MODEL = "claude-sonnet-4-6";
const FIRST_SECONDS = 25; // Jackson: first 20–30s of the clip
const CLIP_FRAME_INTERVAL_SECONDS = 5; // ~5 frames per clip
const SOURCE_NUM_FRAMES = 4; // 4 evenly-spaced frames in the first 20s of source
const CLIP_FRAME_MAX_SIDE = 768; // Claude vision sweet spot for the clipper's reel
const SOURCE_FRAME_MAX_SIDE = 512; // smaller for source — face match doesn't need higher

@Injectable()
export class AiVerificationService {
  private readonly logger = new Logger(AiVerificationService.name);
  private readonly client: Anthropic | null;

  constructor(
    @Inject(DB) private db: Database,
    private config: ConfigService,
    private scrapers: ScrapersService,
    private frames: FrameExtractorService,
  ) {
    const key = this.config.get<string>("ANTHROPIC_API_KEY");
    this.client = key ? new Anthropic({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn(
        "ANTHROPIC_API_KEY not set — AI verification will be skipped.",
      );
    }
  }

  /**
   * Full pipeline: scrape video URL from the platform → extract keyframes
   * with ffmpeg → ask Claude to compare against the campaign's source +
   * requirements. Returns null on transient infrastructure problems so the
   * caller leaves the submission in the "not yet verified" state.
   */
  async verify(
    ctx: AiVerificationContext,
  ): Promise<AiVerificationOutcome | null> {
    if (!this.client) return null;

    const platform = detectPlatform(ctx.clipUrl);
    if (!platform) {
      return {
        result: "flagged",
        notes: "Unrecognized platform URL — cannot fetch the clip.",
      };
    }

    let videoUrl: string | null = null;
    try {
      videoUrl = await this.scrapers.getMediaUrl(ctx.clipUrl);
    } catch (err) {
      this.logger.error(`Media URL lookup failed: ${String(err)}`);
      return null;
    }

    if (!videoUrl) {
      // No direct media URL available (downloader API failed, quota hit,
      // or platform unsupported). Tag for human review.
      return this.verifyFromThumbnail(ctx);
    }

    const frames = await this.frames.extractFromUrl(videoUrl, {
      durationSeconds: FIRST_SECONDS,
      intervalSeconds: CLIP_FRAME_INTERVAL_SECONDS,
      maxSide: CLIP_FRAME_MAX_SIDE,
    });

    if (frames.length === 0) {
      this.logger.warn(
        `No frames extracted from ${ctx.clipUrl} — falling back to thumbnail.`,
      );
      return this.verifyFromThumbnail(ctx);
    }

    const sourceFrames = await this.getSourceFrames(ctx.campaign);

    return this.askClaude(
      ctx,
      sourceFrames.map((f) => ({
        base64: f.base64,
        label: `Source @ ${f.atSeconds.toFixed(0)}s`,
      })),
      frames.map((f) => ({
        base64: f.base64,
        label: `Clip @ ${f.atSeconds.toFixed(0)}s`,
      })),
    );
  }

  /**
   * Pull keyframes from the campaign's source video so Claude can compare
   * the clipper's footage against it. The first verification for a given
   * campaign downloads a video prefix from Drive, runs ffmpeg, and writes
   * the resulting frames to `campaigns.source_keyframes`. Every subsequent
   * verification just reads the JSONB column — Drive is hit at most once
   * per campaign, surviving server restarts.
   *
   * If the column is already populated (and matches the current source
   * URL), we trust it. If the creator changes `sourceContentUrl` later,
   * the caller is responsible for nulling the column back out.
   */
  private async getSourceFrames(
    campaign: AiVerificationContext["campaign"],
  ): Promise<{ base64: string; atSeconds: number }[]> {
    if (!campaign.sourceContentUrl) return [];

    // Read what's already cached on the campaign row.
    const [row] = await this.db
      .select({
        sourceContentUrl: schema.campaigns.sourceContentUrl,
        sourceKeyframes: schema.campaigns.sourceKeyframes,
      })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaign.id))
      .limit(1);

    if (row?.sourceKeyframes && row.sourceKeyframes.length > 0) {
      return row.sourceKeyframes;
    }

    const driveKey = this.config.get<string>("YOUTUBE_API_KEY"); // same GCP project, Drive API enabled on it too
    const normalized = normalizeDriveUrl(campaign.sourceContentUrl, driveKey);

    try {
      const frames = await this.frames.extractSourceFirst20s(normalized, {
        numFrames: SOURCE_NUM_FRAMES,
        maxSide: SOURCE_FRAME_MAX_SIDE,
      });
      if (frames.length === 0) {
        this.logger.warn(
          `Could not extract frames from source video: ${campaign.sourceContentUrl}`,
        );
        return [];
      }
      // Persist so we never have to fetch this source again.
      await this.db
        .update(schema.campaigns)
        .set({ sourceKeyframes: frames, updatedAt: new Date() })
        .where(eq(schema.campaigns.id, campaign.id));
      return frames;
    } catch (err) {
      this.logger.error(`Source frame extraction failed: ${String(err)}`);
      return [];
    }
  }

  private async verifyFromThumbnail(
    ctx: AiVerificationContext,
  ): Promise<AiVerificationOutcome | null> {
    // We have nothing of the clip to send — tag for human review rather than
    // bias the verdict either way.
    return {
      result: "flagged",
      notes:
        "AI couldn't fetch the clip media (platform did not expose a direct video URL). Please review manually.",
    };
  }

  private async askClaude(
    ctx: AiVerificationContext,
    sourceFrames: { base64: string; label: string }[],
    clipFrames: { base64: string; label: string }[],
  ): Promise<AiVerificationOutcome | null> {
    if (!this.client) return null;

    const sourceDescription = sourceFrames.length
      ? `${sourceFrames.length} keyframe(s) from the campaign's SOURCE video (labelled "Source @ Ns") followed by ${clipFrames.length} keyframe(s) from the CLIPPER's submitted clip (labelled "Clip @ Ns").`
      : `No source-video frames are available for this verification — only ${clipFrames.length} keyframe(s) from the CLIPPER's clip. Treat this as a "no comparison reference" case and flag for human review unless the clip itself is obviously off-brand.`;

    // Face-likeness prompt per Jackson: the source video may be much longer
    // than the clip and they may not share opening seconds, so we anchor on
    // the *people* shown rather than the timeline. Compare faces across both
    // sets and ask whether they are the same person(s).
    const prompt = [
      "You are verifying that a short-form video clip is genuinely derived from a creator's source content.",
      "The campaign's source video can be long (a stream, vlog, podcast). The clipper's submission is a short reel — the timestamps will not line up.",
      "Anchor your judgement on FACE / PERSON likeness, not on scene composition or background.",
      "",
      `I will show you ${sourceDescription}`,
      "",
      "Decide: is the main person/people in the clip the same person(s) shown in the source? Allow for different camera angles, makeup, filters, captions, zooms, and crops.",
      "",
      'Reply with strictly valid JSON of the form: {"verdict": "clean" | "flagged", "reason": "one short sentence"}',
      'Use "clean" only when you are reasonably confident the same person appears in both source and clip.',
      'Use "flagged" if the people differ, no clear face is visible to compare, or you are not confident — these go to the creator for manual approval.',
    ].join("\n");

    const content: Anthropic.Messages.ContentBlockParam[] = [];

    // Source first, so Claude has the reference before it sees the clip.
    // (We deliberately don't fall back to the campaign thumbnail by URL —
    // Anthropic's image-by-URL fetcher refuses Drive's robots.txt-restricted
    // thumbnail endpoints. Without source frames we hand the case to the
    // creator; the prompt below tells Claude to flag accordingly.)
    for (const img of sourceFrames) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: img.base64,
        },
      });
      content.push({ type: "text", text: `↑ ${img.label}` });
    }

    for (const img of clipFrames) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: img.base64,
        },
      });
      content.push({ type: "text", text: `↑ ${img.label}` });
    }
    content.push({ type: "text", text: prompt });

    try {
      const res = await this.client.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content }],
      });

      const text = res.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      return parseVerdict(text);
    } catch (err) {
      this.logger.error(`Claude verification failed: ${String(err)}`);
      return null;
    }
  }
}

/**
 * Convert a Google Drive view URL like
 *   https://drive.google.com/file/d/<ID>/view?usp=sharing
 * into a direct Drive API v3 download URL ffmpeg can stream:
 *   https://www.googleapis.com/drive/v3/files/<ID>?alt=media&key=<KEY>
 *
 * The web Drive endpoints (uc?export=download / drive.usercontent.google.com)
 * impose ~2MB chunk caps and serve an HTML "virus scan" page for open-ended
 * Range requests, which ffmpeg's HTTP demuxer trips over. The Drive API
 * endpoint is built for programmatic access and just returns the bytes.
 *
 * Requires Drive API enabled on the GCP project and the API key allowed for
 * Drive API (we reuse the YouTube key — same project). File must be public
 * ("Anyone with link can view").
 */
function normalizeDriveUrl(url: string, apiKey?: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return url;
    const m = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!m?.[1] || !apiKey) return url;
    return `https://www.googleapis.com/drive/v3/files/${m[1]}?alt=media&key=${apiKey}`;
  } catch {
    return url;
  }
}

function parseVerdict(raw: string): AiVerificationOutcome {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as {
        verdict?: string;
        reason?: string;
      };
      const verdict =
        obj.verdict === "clean" || obj.verdict === "flagged"
          ? obj.verdict
          : "flagged";
      const reason =
        typeof obj.reason === "string" && obj.reason.trim()
          ? obj.reason.trim().slice(0, 280)
          : "";
      return { result: verdict, notes: reason };
    } catch {
      // fall through
    }
  }
  // Couldn't parse — be cautious and flag for human review.
  return {
    result: "flagged",
    notes: `AI returned an unparseable response: ${raw.slice(0, 200)}`,
  };
}
