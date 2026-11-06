import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { GuardianNews, parseGuardian } from "../server/guardian";
import { createGuardianRouter } from "../server/guardian-routes";

const now = new Date("2026-11-05T18:00:00Z");
const key = "guardian-test-key-12345678";
const article = (overrides = {}) => ({ type: "article", webTitle: "An original headline & punctuation", webUrl: "https://www.theguardian.com/us-news/2026/nov/05/test", webPublicationDate: "2026-11-05T17:00:00Z", fields: { byline: "Test Reporter", publication: "The Guardian" }, ...overrides });
const payload = (results = [article()]) => ({ response: { status: "ok", results } });
async function fixture(work: (env: string) => Promise<void>) {
  const prefix = path.join(tmpdir(), "receipt-guardian-test-");
  const dir = await mkdtemp(prefix);
  try { await work(path.join(dir, ".env")); }
  finally { assert.ok(path.resolve(dir).startsWith(path.resolve(prefix))); await rm(dir, { recursive: true, force: true }); }
}

test("Guardian preserves original metadata, rejects unsafe/old/future/non-article records and deduplicates", () => {
  const items = parseGuardian(payload([
    article(), article(), article({ webPublicationDate: "2026-11-04T17:59:59Z" }),
    article({ webPublicationDate: "2026-11-05T18:00:01Z" }), article({ webPublicationDate: "invalid" }),
    article({ webUrl: "https://www.theguardian.com.evil.test/story" }), article({ type: "liveblog" }),
  ]), "general", now);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, article().webTitle);
  assert.equal(items[0].byline, "Test Reporter");
  assert.equal(items[0].publisher, "The Guardian");
  assert.equal(items[0].publishedAt, "2026-11-05T17:00:00.000Z");
  assert.equal(items[0].description, undefined);
  assert.equal(parseGuardian(payload([article({ fields: { headline: "The complete original headline" } })]), "general", now)[0].title, "The complete original headline");
  const summary = parseGuardian(payload([article({ fields: { trailText: '<p>Original <strong>summary</strong> &amp; context&#8217;s detail.&nbsp;<script>doNotRender()</script></p>', standfirst: "Unused fallback" } })]), "general", now)[0].description;
  assert.equal(summary, "Original summary & context’s detail.");
  assert.equal(parseGuardian(payload([article({ fields: { trailText: "<p> </p>", standfirst: "<p>Publisher continuation.</p>" } })]), "general", now)[0].description, "Publisher continuation.");
  assert.throws(() => parseGuardian({ response: { status: "error" } }, "general", now));
});

test("Guardian verifies before saving, restores, caches concurrent collections, spaces calls and removes only its key", async () => {
  await fixture(async env => {
    await writeFile(env, "OPENAI_API_KEY=keep-me\nICLOUD_EMAIL=keep@example.test\n");
    let clock = now.valueOf();
    const starts: number[] = [], urls: URL[] = [];
    const fetcher: typeof fetch = async (input, options) => {
      const url = new URL(String(input)); urls.push(url); starts.push(clock);
      assert.equal(url.origin, "https://content.guardianapis.com");
      assert.equal(url.searchParams.get("api-key"), key);
      assert.equal(url.searchParams.get("show-fields"), "headline,byline,publication,trailText,standfirst");
      assert.equal(options?.redirect, "error");
      return Response.json(payload());
    };
    const news = new GuardianNews(env, fetcher, () => new Date(clock), async ms => { clock += ms; });
    assert.deepEqual(await news.status(), { connected: false });
    assert.equal((await news.collect()).provenance.mode, "unavailable");
    assert.equal(starts.length, 0);
    assert.deepEqual(await news.connect(key), { connected: true });
    assert.match(await readFile(env, "utf8"), /OPENAI_API_KEY=keep-me/);
    const [a, b] = await Promise.all([news.collect(), news.collect()]);
    assert.deepEqual(a, b);
    assert.equal(a.provenance.mode, "live");
    assert.equal(a.items.length, 1);
    assert.equal(a.items[0].category, "companies");
    assert.equal(starts.length, 5);
    assert.ok(starts.slice(1).every((start, index) => start - starts[index] >= 1100));
    assert.equal(urls[1].searchParams.get("from-date"), "2026-11-04");
    assert.equal(urls[4].searchParams.get("section"), "world|us-news|politics");
    assert.ok(!JSON.stringify(a).includes(key));
    assert.ok((await new GuardianNews(env).status()).connected);
    clock += 21 * 60_000;
    await news.collect();
    assert.equal(starts.length, 9);
    await news.disconnect();
    const saved = await readFile(env, "utf8");
    assert.doesNotMatch(saved, /GUARDIAN_API_KEY/);
    assert.match(saved, /ICLOUD_EMAIL=keep@example.test/);
    assert.equal((await news.collect()).provenance.mode, "unavailable");
  });
});

test("Guardian sanitizes failures, preserves a valid saved key and distinguishes an empty result", async () => {
  await fixture(async env => {
    await writeFile(env, `GUARDIAN_API_KEY=${key}\n`);
    const failed = new GuardianNews(env, async () => { throw new Error(`SECRET https://provider/?api-key=${key}`); }, () => now, async () => {});
    await assert.rejects(failed.connect("replacement-key-12345"), /could not be reached/);
    assert.match(await readFile(env, "utf8"), new RegExp(key));
    const unavailable = await failed.collect();
    assert.equal(unavailable.provenance.mode, "unavailable");
    assert.deepEqual(unavailable.items, []);
    assert.doesNotMatch(JSON.stringify(unavailable), /SECRET|api-key|guardian-test-key/);
    const empty = new GuardianNews(env, async () => Response.json(payload([])), () => now, async () => {});
    assert.equal((await empty.collect()).provenance.mode, "live");
    assert.deepEqual((await empty.collect()).items, []);
    assert.equal((await empty.collect(true)).provenance.mode, "unavailable");
    const rejected = new GuardianNews(env, async () => new Response("do not echo this", { status: 403 }), () => now);
    assert.match((await rejected.collect()).provenance.note!, /rejected the API key/);
    const oversized = new GuardianNews(env, async () => new Response(" ".repeat(2_000_001)), () => now);
    assert.match((await oversized.collect()).provenance.note!, /oversized/);
  });
});

test("Guardian local controls reject foreign origins and never return the key", async () => {
  await fixture(async env => {
    const news = new GuardianNews(env, async () => Response.json(payload()), () => now, async () => {});
    const app = express().use("/api/guardian", createGuardianRouter(news));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address === "object");
    const root = `http://127.0.0.1:${address.port}/api/guardian`;
    try {
      const post = (action: string, body: unknown, extra = {}) => fetch(`${root}/${action}`, { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
      assert.equal((await post("connect", { apiKey: key }, { Origin: "https://evil.test" })).status, 403);
      const response = await post("connect", { apiKey: key });
      assert.deepEqual(await response.json(), { connected: true });
      assert.doesNotMatch(await (await fetch(`${root}/status`)).text(), new RegExp(key));
      assert.deepEqual(await (await post("disconnect", {})).json(), { connected: false });
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
