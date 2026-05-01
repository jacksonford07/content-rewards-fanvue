import { ConfigService } from "@nestjs/config";
import { InstagramScraperService } from "./instagram-scraper.service.js";

type MockRes = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function mockFetch(response: MockRes | Error) {
  return jest.fn().mockImplementation(() => {
    if (response instanceof Error) return Promise.reject(response);
    return Promise.resolve(response);
  });
}

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string | undefined> = {
    RAPIDAPI_INSTAGRAM_HOST: "instagram-scraper-stable-api.p.rapidapi.com",
    RAPIDAPI_KEY: "test-key",
  };
  const env = { ...defaults, ...overrides };
  return {
    get: (k: string, fallback?: unknown) => env[k] ?? fallback,
  } as unknown as ConfigService;
}

describe("InstagramScraperService", () => {
  const reelUrl = "https://www.instagram.com/reel/DXXoEA5j8Om/";
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns unavailable when RAPIDAPI_KEY is missing", async () => {
    const service = new InstagramScraperService(
      makeConfig({ RAPIDAPI_KEY: undefined }),
    );
    global.fetch = mockFetch({ ok: true, status: 200, json: async () => ({}) });

    const result = await service.scrape(reelUrl);

    expect(result).toEqual({ viewCount: null, available: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when URL has no shortcode", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({ ok: true, status: 200, json: async () => ({}) });

    const result = await service.scrape("https://www.instagram.com/");

    expect(result).toEqual({ viewCount: null, available: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hits the stable-api endpoint with the shortcode and rapidapi headers", async () => {
    const service = new InstagramScraperService(makeConfig());
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        is_published: true,
        video_view_count: 1100,
        video_play_count: 3991,
      }),
    });
    global.fetch = fetchMock;

    await service.scrape(reelUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe(
      "https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data_v2.php?media_code=DXXoEA5j8Om",
    );
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      "x-rapidapi-host": "instagram-scraper-stable-api.p.rapidapi.com",
      "x-rapidapi-key": "test-key",
    });
  });

  it("prefers video_play_count over video_view_count", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        is_published: true,
        video_view_count: 1100,
        video_play_count: 3991,
        owner: { username: "hasanxfilms" },
        video_url: "https://cdn.example.com/video.mp4",
      }),
    });

    const result = await service.scrape(reelUrl);

    expect(result).toEqual({
      viewCount: 3991,
      available: true,
      platformUsername: "hasanxfilms",
      videoUrl: "https://cdn.example.com/video.mp4",
    });
  });

  it("falls back to video_view_count when video_play_count is missing", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        is_published: true,
        video_view_count: 1100,
        video_play_count: null,
      }),
    });

    const result = await service.scrape(reelUrl);

    expect(result.viewCount).toBe(1100);
    expect(result.available).toBe(true);
  });

  it("returns null view count when both counters are absent", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ is_published: true }),
    });

    const result = await service.scrape(reelUrl);

    expect(result.viewCount).toBeNull();
    expect(result.available).toBe(true);
  });

  it("treats 404 as unavailable", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const result = await service.scrape(reelUrl);

    expect(result).toEqual({ viewCount: null, available: false });
  });

  it("treats is_published=false as unavailable (deleted post)", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ is_published: false, video_view_count: 100 }),
    });

    const result = await service.scrape(reelUrl);

    expect(result).toEqual({ viewCount: null, available: false });
  });

  it("treats non-2xx HTTP as unavailable", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const result = await service.scrape(reelUrl);

    expect(result).toEqual({ viewCount: null, available: false });
  });

  it("treats network errors as unavailable", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch(new Error("connection refused"));

    const result = await service.scrape(reelUrl);

    expect(result).toEqual({ viewCount: null, available: false });
  });

  it("supports both /reel/ and /reels/ URL forms", async () => {
    const service = new InstagramScraperService(makeConfig());
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ is_published: true, video_view_count: 42 }),
    });
    global.fetch = fetchMock;

    await service.scrape("https://www.instagram.com/reels/DXkpQKpgMZc/");
    await service.scrape("https://www.instagram.com/reel/DXkpQKpgMZc/");
    await service.scrape("https://www.instagram.com/p/DXkpQKpgMZc/");

    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    for (const url of calls) {
      expect(url).toContain("media_code=DXkpQKpgMZc");
    }
  });

  it("coerces numeric strings from the API", async () => {
    const service = new InstagramScraperService(makeConfig());
    global.fetch = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        is_published: true,
        video_play_count: "329957",
      }),
    });

    const result = await service.scrape(reelUrl);

    expect(result.viewCount).toBe(329957);
  });
});
