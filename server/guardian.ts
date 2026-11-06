import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { BriefingData, NewsCategory, NewsItem } from "../src/types";
import { envValues, updateEnv } from "./env-file";

const API = "https://content.guardianapis.com/search";
const CACHE_MS = 20 * 60_000;
const DAY_MS = 86_400_000;
const queries: Record<NewsCategory, Record<string, string>> = {
  general: { section: "world|us-news|politics" },
  technology: { section: "business|technology|science" },
  companies: { q: "Tesla OR SpaceX" },
  local: { q: 'Nevada OR "Las Vegas" OR "Clark County" OR "Spring Valley"' },
};
export class GuardianError extends Error {}
const validKey = (key: string) => /^[A-Za-z0-9_-]{8,200}$/.test(key) && key !== "test";
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const excerptParser = new XMLParser({ htmlEntities: true, parseTagValue: false });
function excerpt(value: unknown): string {
  const plain = text(value)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[^>]*>/g, " ");
  if (!plain) return "";
  // Strip markup before entity decoding, then render only as React text.
  return text(excerptParser.parse(`<text>${plain}</text>`).text).replace(/\s+/g, " ").trim();
}

export function parseGuardian(raw: any, category: NewsCategory, now = new Date()): NewsItem[] {
  if (raw?.response?.status !== "ok" || !Array.isArray(raw.response.results))
    throw new GuardianError("Guardian returned an unreadable response.");
  const seen = new Set<string>();
  return raw.response.results.flatMap((entry: any): NewsItem[] => {
    const title = text(entry.fields?.headline) || text(entry.webTitle), url = text(entry.webUrl);
    const time = Date.parse(entry.webPublicationDate);
    if (entry.type !== "article" || !title || title.length > 4000 ||
        !/^https:\/\/www\.theguardian\.com\//.test(url) ||
        !Number.isFinite(time) || time > now.valueOf() || time < now.valueOf() - DAY_MS || seen.has(url)) return [];
    seen.add(url);
    return [{ id: url, title, url, publisher: "The Guardian", category,
      description: excerpt(entry.fields?.trailText) || excerpt(entry.fields?.standfirst) || undefined,
      byline: text(entry.fields?.byline) || undefined,
      copyright: text(entry.fields?.publication) || "The Guardian",
      publishedAt: new Date(time).toISOString(), sample: false }];
  });
}

// Fixed endpoint; original metadata and publisher excerpts only. No full bodies or AI processing.
export class GuardianNews {
  private queue: Promise<unknown> = Promise.resolve();
  private nextRequest = 0;
  private day = "";
  private calls = 0;
  private cache?: { key: string; expires: number; data: BriefingData["news"] };
  constructor(private envFile: string, private fetcher: typeof fetch = fetch,
    private now = () => new Date(), private pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(work);
    this.queue = pending.catch(() => {});
    return pending;
  }
  async status() { return { connected: validKey((await envValues(this.envFile)).GUARDIAN_API_KEY?.trim() ?? "") }; }
  private async request(key: string, parameters: Record<string, string>) {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) { this.day = today; this.calls = 0; }
    if (this.calls >= 480) throw new GuardianError("Guardian's local daily request allowance is exhausted. Try tomorrow.");
    const delay = this.nextRequest - this.now().valueOf();
    if (delay > 0) await this.pause(delay);
    this.nextRequest = this.now().valueOf() + 1100;
    this.calls++;
    const url = new URL(API);
    for (const [name, value] of Object.entries({ "api-key": key, "page-size": "50", "order-by": "newest", "show-fields": "headline,byline,publication,trailText,standfirst", ...parameters })) url.searchParams.set(name, value);
    let response: Response;
    try {
      response = await this.fetcher(url.toString(), { signal: AbortSignal.timeout(6000), redirect: "error", headers: { Accept: "application/json" } });
    } catch { throw new GuardianError("Guardian could not be reached or timed out. Refresh headlines to retry."); }
    if (!response.ok) throw new GuardianError(response.status === 401 || response.status === 403 ? "Guardian rejected the API key. Check your developer key." : response.status === 429 ? "Guardian's request limit was reached. Try later." : "Guardian is temporarily unavailable. Try later.");
    // Bound the streamed body as well as its declared length; never expose upstream URLs/errors (which contain the key).
    const reader = response.body?.getReader();
    if (!reader) throw new GuardianError("Guardian returned an empty response.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 2_000_000) { await reader.cancel(); throw new Error(); }
        chunks.push(value);
      }
      const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (raw?.response?.status !== "ok" || !Array.isArray(raw.response.results)) throw new Error();
      return raw;
    } catch { throw new GuardianError("Guardian returned an unreadable or oversized response."); }
    finally { reader.releaseLock(); }
  }
  connect(key: string) {
    return this.serial(async () => {
      if (!validKey(key)) throw new GuardianError("Enter your Guardian developer API key.");
      await this.request(key, { "page-size": "1" });
      await updateEnv(this.envFile, ["GUARDIAN_API_KEY"], { GUARDIAN_API_KEY: key });
      this.cache = undefined;
      return { connected: true };
    });
  }
  disconnect() {
    return this.serial(async () => {
      await updateEnv(this.envFile, ["GUARDIAN_API_KEY"]);
      this.cache = undefined;
      return { connected: false };
    });
  }
  collect(offline = false): Promise<BriefingData["news"]> {
    return this.serial(async () => {
      const now = this.now();
      const unavailable = (note: string): BriefingData["news"] => ({ provenance: { mode: "unavailable", source: "The Guardian", retrievedAt: now.toISOString(), note }, items: [] });
      try {
        if (offline) return unavailable("Offline test mode is enabled.");
        const key = (await envValues(this.envFile)).GUARDIAN_API_KEY?.trim() ?? "";
        if (!validKey(key)) return unavailable("Connect your Guardian developer key in Headlines or Sources → News.");
        const fingerprint = createHash("sha256").update(key).digest("hex");
        if (this.cache?.key === fingerprint && this.cache.expires > now.valueOf()) return {
          ...this.cache.data,
          items: this.cache.data.items.filter(item => Date.parse(item.publishedAt) >= now.valueOf() - DAY_MS),
        };
        const items = new Map<string, NewsItem>();
        // Specialized queries win category assignment when a story also appears in a broad section.
        for (const category of ["companies", "local", "technology", "general"] as NewsCategory[]) {
          const raw = await this.request(key, { ...queries[category], "from-date": new Date(now.valueOf() - DAY_MS).toISOString().slice(0, 10), "to-date": now.toISOString().slice(0, 10) });
          for (const item of parseGuardian(raw, category, now)) if (!items.has(item.id)) items.set(item.id, item);
        }
        const data: BriefingData["news"] = { provenance: {
          mode: "live", source: "The Guardian · Open Platform", retrievedAt: this.now().toISOString(), url: "https://www.theguardian.com/",
          note: "Original Guardian headlines and publisher excerpts from the preceding 24 hours. General, business/technology, Tesla/SpaceX and Nevada-area keyword searches; local coverage is partial. News is excluded from AI summary. No article bodies collected.",
        }, items: [...items.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) };
        this.cache = { key: fingerprint, expires: now.valueOf() + CACHE_MS, data };
        const entry = this.cache;
        setTimeout(() => { if (this.cache === entry) this.cache = undefined; }, CACHE_MS).unref();
        return data;
      } catch (error) {
        // Failed refreshes never substitute stale stories or invented samples.
        this.cache = undefined;
        return unavailable(error instanceof GuardianError ? error.message : "Could not load Guardian. Check the local connection and try again.");
      }
    });
  }
}
