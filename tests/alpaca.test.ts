import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { AlpacaMarkets, exchangeTime, marketSymbols } from "../server/alpaca";
import { createAlpacaRouter } from "../server/alpaca-routes";

const key = "PK-TEST-ALPACA-123456", secret = "test-alpaca-secret-123456789";
const dates = ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
const calendar = dates.map(date => ({ date, open: "09:30", close: "16:00", session_open: "0400", session_close: "2000" }));
const bar = (t: string, c: number) => ({ t, o: c, h: c + 1, l: c - 1, c, v: 100 });
const daily = dates.map((date, i) => bar(new Date(exchangeTime(date, "00:00")).toISOString(), 100 + i));
const intraday = dates.flatMap((date, i) => [bar(new Date(exchangeTime(date, "09:30")).toISOString(), 100 + i), bar(new Date(exchangeTime(date, "09:35")).toISOString(), 101 + i)]);
async function fixture(work: (env: string) => Promise<void>) {
  const prefix = path.join(tmpdir(), "receipt-alpaca-test-");
  const dir = await mkdtemp(prefix);
  try { await work(path.join(dir, ".env")); }
  finally { assert.ok(path.resolve(dir).startsWith(path.resolve(prefix))); await rm(dir, { recursive: true, force: true }); }
}
function upstream(requests: URL[], options: { paginate?: boolean; malformed?: boolean } = {}): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input)); requests.push(url);
    assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("APCA-API-KEY-ID"), key); assert.equal(headers.get("APCA-API-SECRET-KEY"), secret);
    assert.ok(!url.toString().includes(secret));
    if (url.pathname === "/v2/calendar") { assert.equal(url.origin, "https://paper-api.alpaca.markets"); return Response.json(calendar); }
    assert.equal(url.origin, "https://data.alpaca.markets");
    assert.equal(url.pathname, "/v2/stocks/bars"); assert.equal(url.searchParams.get("feed"), "iex"); assert.equal(url.searchParams.get("adjustment"), "split");
    const rows = (url.searchParams.get("timeframe") === "1Day" ? daily : intraday).filter(b => b.t <= url.searchParams.get("end")!);
    if (options.malformed) return Response.json({ bars: { TSLA: [bar("bad", 100)] } });
    const paged = options.paginate && url.searchParams.get("timeframe") === "5Min";
    return Response.json({ bars: { TSLA: paged ? url.searchParams.has("page_token") ? rows.slice(2) : rows.slice(0, 2) : rows }, next_page_token: paged && !url.searchParams.has("page_token") ? "next-page" : null });
  };
}

test("Alpaca verifies and persists both credentials, restores, caches and removes only its own keys", async () => {
  await fixture(async env => {
    await writeFile(env, "OPENAI_API_KEY=preserve-me\nGUARDIAN_API_KEY=also-preserve\n");
    const urls: URL[] = [], now = new Date("2026-11-05T14:40:00Z");
    const markets = new AlpacaMarkets(env, upstream(urls, { paginate: true }), () => now);
    assert.deepEqual(await markets.status(), { connected: false, feed: "iex" });
    assert.equal((await markets.collect(["TSLA"])).provenance.mode, "unavailable");
    assert.equal(urls.length, 0);
    assert.equal((await markets.connect(key, secret)).connected, true);
    const saved = await readFile(env, "utf8");
    assert.ok(saved.includes(key) && saved.includes(secret) && saved.includes("preserve-me"));
    assert.equal((await new AlpacaMarkets(env).status()).connected, true);
    const [a, b] = await Promise.all([markets.collect(["TSLA", "UNKNOWN"]), markets.collect(["TSLA", "UNKNOWN"])]);
    assert.deepEqual(a, b); assert.equal(urls.length, 6);
    assert.equal(a.provenance.mode, "live");
    assert.equal(a.marketStatus, "Open");
    const stock = a.items[0];
    assert.equal(stock.value, 108); assert.equal(stock.asOf, "2026-11-05T14:35:00.000Z");
    assert.ok(Math.abs(stock.change! - (108 / 106 - 1) * 100) < 0.0001);
    assert.equal(stock.dayHistory?.length, 2); assert.equal(stock.weekHistory?.length, 5);
    assert.ok(stock.weekChange! > 0);
    assert.equal(a.items[1].value, null);
    assert.deepEqual(a.items.map(item => item.symbol), ["TSLA", "UNKNOWN"]);
    assert.ok(!JSON.stringify(a).includes(secret) && !JSON.stringify(await markets.status()).includes(key));
    await markets.disconnect();
    const disconnected = await readFile(env, "utf8");
    assert.doesNotMatch(disconnected, /ALPACA_API/); assert.match(disconnected, /GUARDIAN_API_KEY=also-preserve/);
    assert.equal((await markets.collect(["TSLA"])).provenance.mode, "unavailable");
  });
});

test("Alpaca respects opening, stale observations, closed days, early closes and DST", async () => {
  assert.equal(new Date(exchangeTime("2026-10-30", "09:30")).toISOString(), "2026-10-30T13:30:00.000Z");
  assert.equal(new Date(exchangeTime("2026-11-05", "09:30")).toISOString(), "2026-11-05T14:30:00.000Z");
  await fixture(async env => {
    await writeFile(env, `ALPACA_API_KEY_ID=${key}\nALPACA_API_SECRET_KEY=${secret}\n`);
    let clock = new Date("2026-11-05T14:29:59Z");
    const urls: URL[] = [];
    const markets = new AlpacaMarkets(env, upstream(urls), () => clock);
    const before = await markets.collect(["TSLA"]);
    assert.equal(before.marketStatus, "Pre-market");
    assert.equal(before.items[0].value, 106); assert.match(before.items[0].session, /2026-11-04 regular close/);
    clock = new Date("2026-11-05T14:30:00Z");
    const open = await markets.collect(["TSLA"]);
    assert.equal(open.marketStatus, "Open");
    assert.match(open.items[0].session, /2026-11-05 regular session/);
    assert.ok(urls.length >= 6, "opening bypasses a prior-close cache");
    clock = new Date("2026-11-05T14:51:00Z");
    const stale = await markets.collect(["TSLA"]);
    assert.equal(stale.marketStatus, "Open");
    assert.equal(stale.items[0].value, null); assert.match(stale.items[0].unavailable!, /15 minutes/);
    clock = new Date("2026-11-07T15:00:00Z");
    const weekend = await markets.collect(["TSLA"]);
    assert.equal(weekend.marketStatus, "Closed");
    assert.equal(weekend.items[0].value, 107); assert.match(weekend.items[0].session, /2026-11-05 regular close/);
    const early: typeof fetch = async (input, init) => new URL(String(input)).pathname === "/v2/calendar"
      ? Response.json(calendar.map(s => ({ ...s, ...(s.date === "2026-11-05" ? { close: "13:00", session_close: "1700" } : {}) }))) : upstream([])(input, init);
    const closed = await new AlpacaMarkets(env, early, () => new Date("2026-11-05T18:01:00Z")).collect(["TSLA"]);
    assert.equal(closed.items[0].value, 107); assert.equal(closed.items[0].asOf, "2026-11-05T18:00:00.000Z");
    assert.equal(closed.marketStatus, "After-hours");
    assert.equal((await new AlpacaMarkets(env, early, () => new Date("2026-11-05T22:00:00Z")).collect([])).marketStatus, "Closed");
  });
});

test("market status follows pre-market and after-hours boundaries, holidays and quote failures", async () => {
  await fixture(async env => {
    await writeFile(env, `ALPACA_API_KEY_ID=${key}\nALPACA_API_SECRET_KEY=${secret}\n`);
    let clock = new Date("2026-11-05T08:59:59Z");
    const markets = new AlpacaMarkets(env, upstream([]), () => clock);
    for (const [time, expected] of [
      ["2026-11-05T08:59:59Z", "Closed"], ["2026-11-05T09:00:00Z", "Pre-market"],
      ["2026-11-05T14:30:00Z", "Open"], ["2026-11-05T21:00:00Z", "After-hours"],
      ["2026-11-06T00:59:59Z", "After-hours"], ["2026-11-06T01:00:00Z", "Closed"],
    ]) {
      clock = new Date(time);
      assert.equal((await markets.collect([])).marketStatus, expected, time);
    }
    const holiday: typeof fetch = async () => Response.json(calendar.filter(s => s.date !== "2026-11-05"));
    assert.equal((await new AlpacaMarkets(env, holiday, () => new Date("2026-11-05T16:00:00Z")).collect([])).marketStatus, "Closed");
    const quoteFailure: typeof fetch = async (input, init) => new URL(String(input)).pathname === "/v2/calendar"
      ? upstream([])(input, init) : new Response("unavailable", { status: 503 });
    const failed = await new AlpacaMarkets(env, quoteFailure, () => new Date("2026-11-05T16:00:00Z")).collect(["TSLA"]);
    assert.equal(failed.provenance.mode, "unavailable"); assert.equal(failed.marketStatus, "Open");
    const unknown = await new AlpacaMarkets(env, async () => new Response("unavailable", { status: 503 })).collect([]);
    assert.equal(unknown.marketStatus, undefined);
  });
});

test("Alpaca failures preserve saved credentials, never echo provider errors, and never substitute samples", async () => {
  await fixture(async env => {
    const saved = `ALPACA_API_KEY_ID=${key}\nALPACA_API_SECRET_KEY=${secret}\n`;
    await writeFile(env, saved);
    const failed = new AlpacaMarkets(env, async () => { throw new Error(`sensitive ${secret}`); });
    await assert.rejects(failed.connect(key, secret), /could not be reached/);
    assert.equal(await readFile(env, "utf8"), saved);
    const result = await failed.collect(["TSLA"]);
    assert.equal(result.provenance.mode, "unavailable"); assert.deepEqual(result.items, []);
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.equal((await failed.collect(["TSLA"], true)).provenance.mode, "unavailable");
    const rejected = new AlpacaMarkets(env, async () => new Response(secret, { status: 403 }));
    assert.match((await rejected.collect(["TSLA"])).provenance.note!, /rejected the credentials/);
    const malformed = new AlpacaMarkets(env, upstream([], { malformed: true }), () => new Date("2026-11-05T14:40:00Z"));
    assert.match((await malformed.collect(["TSLA"])).provenance.note!, /unreadable price history/);
    const looped: typeof fetch = async (input, init) => {
      const response = await upstream([])(input, init);
      return new URL(String(input)).pathname.endsWith("bars") ? Response.json({ ...await response.json(), next_page_token: "repeated" }) : response;
    };
    assert.match((await new AlpacaMarkets(env, looped, () => new Date("2026-11-05T14:40:00Z")).collect(["TSLA"])).provenance.note!, /incomplete/);
  });
  assert.deepEqual(marketSymbols(["TSLA", "TSLA", "DJI"]), ["TSLA"]);
  assert.throws(() => marketSymbols(["https://evil.test"]));
  assert.throws(() => marketSymbols(Array(21).fill("TSLA")));
});

test("Alpaca local routes block foreign origins and never disclose saved keys", async () => {
  await fixture(async env => {
    const markets = new AlpacaMarkets(env, upstream([]), () => new Date("2026-11-05T14:40:00Z"));
    const app = express().use("/api/alpaca", createAlpacaRouter(markets));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address === "object");
    const root = `http://127.0.0.1:${address.port}/api/alpaca`;
    const post = (action: string, body: unknown, extra = {}) => fetch(`${root}/${action}`, { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
    try {
      assert.equal((await post("connect", { apiKey: key, secretKey: secret }, { Origin: "https://evil.test" })).status, 403);
      assert.equal((await post("connect", { apiKey: key, secretKey: secret })).status, 200);
      const status = await (await fetch(`${root}/status`)).text(); assert.ok(!status.includes(key) && !status.includes(secret));
      assert.equal((await post("markets", { symbols: ["invalid/url"] })).status, 400);
      assert.equal((await post("markets", { symbols: ["TSLA"] })).status, 200);
      assert.equal((await post("disconnect", {})).status, 200);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
