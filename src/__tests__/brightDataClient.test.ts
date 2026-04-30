import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrightDataClient } from "@/integrations/brightdata/brightDataClient";
import { BrightDataError, BrightDataTimeoutError } from "@/integrations/brightdata/brightDataErrors";
import type { BrightDataConfig } from "@/integrations/brightdata/brightDataTypes";

const BASE_CONFIG: BrightDataConfig = {
  apiKey: "test-api-key",
  webUnlockerZone: "zone-web",
  serpZone: "zone-serp",
  browserZone: "zone-browser",
  timeoutMs: 5000,
  maxRetries: 2,
};

describe("BrightDataClient.fetchUrl", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("returns body on successful fetch", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "<html>content</html>",
      headers: { forEach: vi.fn() },
    });

    const client = new BrightDataClient(BASE_CONFIG);
    const result = await client.fetchUrl("https://example.com");

    expect(result.url).toBe("https://example.com");
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("<html>content</html>");
  });

  it("sets Proxy-Authorization header", async () => {
    let capturedHeaders: Record<string, string> = {};
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce((_url: string, opts: RequestInit) => {
      capturedHeaders = opts.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => "",
        headers: { forEach: vi.fn() },
      });
    });

    const client = new BrightDataClient(BASE_CONFIG);
    await client.fetchUrl("https://example.com");

    expect(capturedHeaders["Proxy-Authorization"]).toBeTruthy();
    expect(capturedHeaders["Proxy-Authorization"]).toContain("Basic ");
  });

  it("throws on non-ok response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { forEach: vi.fn() },
    });

    const client = new BrightDataClient(BASE_CONFIG);
    await expect(client.fetchUrl("https://example.com")).rejects.toThrow();
  });

  it("throws BrightDataTimeoutError on AbortError", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );

    const client = new BrightDataClient({ ...BASE_CONFIG, maxRetries: 0 });
    await expect(client.fetchUrl("https://slow.example.com")).rejects.toBeInstanceOf(BrightDataTimeoutError);
  });

  it("retries on retryable errors up to maxRetries", async () => {
    const retryableErr = new BrightDataError("rate limited", "RATE_LIMIT", true, 429);
    const mockFetch = (fetch as ReturnType<typeof vi.fn>);
    mockFetch
      .mockRejectedValueOnce(retryableErr)
      .mockRejectedValueOnce(retryableErr)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "ok",
        headers: { forEach: vi.fn() },
      });

    const client = new BrightDataClient({ ...BASE_CONFIG, maxRetries: 2 });
    const result = await client.fetchUrl("https://example.com");
    expect(result.body).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe("BrightDataClient.browserScrape", () => {
  it("extracts links from HTML", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '<html><a href="/about">About</a><a href="https://other.com/page">Other</a></html>',
      headers: { forEach: vi.fn() },
    });

    const client = new BrightDataClient(BASE_CONFIG);
    const result = await client.browserScrape({ url: "https://example.com" });

    expect(result.links).toContain("https://example.com/about");
    expect(result.links).toContain("https://other.com/page");
    expect(result.text).not.toContain("<");
  });

  it("strips HTML tags from text", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "<p>Hello <strong>world</strong></p>",
      headers: { forEach: vi.fn() },
    });

    const client = new BrightDataClient(BASE_CONFIG);
    const result = await client.browserScrape({ url: "https://example.com" });
    expect(result.text).toContain("Hello world");
  });
});
