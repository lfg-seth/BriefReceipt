import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { CalendarAI, AI_MODEL, BRIEFING_AI_MODEL, BRIEFING_REASONING } from "../server/calendar-ai";
import { createAIRouter } from "../server/ai-routes";
import { createICloudRouter } from "../server/icloud-routes";
import { DotEnvICloudCredentials } from "../server/icloud-credentials";
import type { ICloudConnection } from "../server/icloud";
import type { CalendarItem } from "../src/types";

const key = "sk-test-" + "a".repeat(32);
const event: CalendarItem = { id: "appointment", title: "Appointment", time: "10:00 AM", calendar: "Personal", description: "Bring photo ID; use the east entrance. " + "Greetings and routine meeting boilerplate. ".repeat(10), invitees: [{ address: "test@example.com", participationStatus: "TENTATIVE" }] };
const summary = "Bring photo ID; use the east entrance.";

test("Headlines are excluded from all AI, including older clients and headline-only briefings", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    let calls = 0;
    const ai = new CalendarAI(env, dir, async (_url, options) => {
      calls++;
      const body = JSON.parse(String(options?.body));
      assert.doesNotMatch(JSON.stringify(body), /PUBLIC_NEWS/);
      const titles = JSON.parse(body.input).sections.map((section: { title: string }) => section.title);
      assert.deepEqual(titles, ["Calendar"]);
      return completedHighlights([], titles);
    });
    const news = { title: "Headlines", mode: "live", content: "PUBLIC_NEWS" };
    const app = express().use("/api/ai", createAIRouter(ai));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address(); assert.ok(address && typeof address === "object");
    const post = (sections: unknown[]) => fetch(`http://127.0.0.1:${address.port}/api/ai/briefing-summary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections }) });
    try {
      const onlyNews = await (await post([news])).json();
      assert.equal(onlyNews.provenance.mode, "unavailable");
      assert.equal(calls, 0);
      assert.equal((await post([news, { title: "Calendar", mode: "live", content: "Routine check-in" }])).status, 200);
      assert.equal(calls, 1);
      await assert.rejects(ai.summarizeBriefing([{ ...news, mode: "live" }]), /No briefing sources/);
      assert.equal(calls, 1);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
test("briefing highlights use reasoning, share the budget, deduplicate requests and persist across restarts", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    const text = "Tesla fell 12.4% in the latest reported session.";
    let calls = 0;
    const ai = new CalendarAI(env, dir, async (_url, options) => {
      calls++;
      const body = JSON.parse(options!.body as string);
      assert.equal(body.model, BRIEFING_AI_MODEL);
      assert.equal(body.reasoning.effort, BRIEFING_REASONING);
      assert.equal(body.max_output_tokens, 8192);
      assert.equal(body.store, false);
      assert.equal(body.text.format.schema.properties.assessments.minItems, 1);
      assert.equal(body.text.format.schema.properties.assessments.items.properties.highlights.maxItems, 1);
      return completedHighlights([{ text, source: "Markets", evidence: "-12.4" }]);
    });
    const sections = [{ title: "Markets", mode: "live" as const, content: "TSLA change -12.4 percent in latest reported session." }];
    const [first, second] = await Promise.all([ai.summarizeBriefing(sections), ai.summarizeBriefing(sections)]);
    assert.equal(first.text, text);
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
    assert.ok((await ai.status()).reservedUsd > 0);
    const restored = new CalendarAI(env, dir, async () => { throw new Error("Cache should be reused"); });
    assert.equal((await restored.summarizeBriefing(sections)).text, text);
    await ai.disconnect();
    await assert.rejects(ai.summarizeBriefing(sections), /Connect OpenAI/);
  });
});
function completedHighlights(highlights: { text: string; source: string; evidence: string }[], sources = highlights.length ? [...new Set(highlights.map(item => item.source))] : ["Calendar"]) {
  const assessments = sources.map(source => ({ source, highlights: highlights.filter(item => item.source === source).map(({ source: _source, ...highlight }) => ({ ...highlight, contextSources: [] })) }));
  return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ assessments }) }] }] });
}

test("quiet highlights are cached, unavailable sources and exhausted budgets never produce false quiet results", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    let calls = 0;
    const ai = new CalendarAI(env, dir, async () => { calls++; return completedHighlights([]); });
    const sections = [{ title: "Calendar", mode: "live" as const, content: "Routine weekly check-in." }];
    assert.equal((await ai.summarizeBriefing(sections)).text, "Nothing noteworthy in the available updates.");
    assert.equal((await ai.summarizeBriefing(sections)).text, "Nothing noteworthy in the available updates.");
    assert.equal(calls, 1);
    await assert.rejects(ai.summarizeBriefing([{ ...sections[0], mode: "unavailable" }]), /No briefing sources/);
    assert.equal(calls, 1);
    const state = JSON.parse(await readFile(path.join(dir, "state.json"), "utf8"));
    state.reservedMicroUsd = 20_000_000;
    await writeFile(path.join(dir, "state.json"), JSON.stringify(state));
    const restarted = new CalendarAI(env, dir, async () => { calls++; return completedHighlights([]); });
    await assert.rejects(restarted.summarizeBriefing([{ ...sections[0], content: "New input" }]), /allowance is exhausted/);
    assert.equal(calls, 1);
  });
});

test("old Luna briefing cache entries migrate without erasing monthly spend or calendar summaries", async () => {
  await fixture(async (env, dir) => {
    await mkdir(dir);
    await writeFile(path.join(dir, "state.json"), JSON.stringify({ month: "2026-11", reservedMicroUsd: 123456, summaries: {
      ["a".repeat(64)]: { text: "An old recap.", model: AI_MODEL, generatedAt: "2026-11-05T18:00:00Z", kind: "briefing" },
      ["b".repeat(64)]: { text: summary, model: AI_MODEL, generatedAt: "2026-11-05T18:00:00Z" },
    } }));
    const ai = new CalendarAI(env, dir, async () => completed(), () => new Date("2026-11-05T18:00:00Z"));
    const status = await ai.status();
    assert.equal(status.reservedUsd, 0.123456);
    assert.equal(status.error, undefined);
    assert.deepEqual(Object.keys(JSON.parse(await readFile(path.join(dir, "state.json"), "utf8")).summaries), ["b".repeat(64)]);
  });
});
function completed(text = summary) { return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ summary: text }) }] }] }); }
async function fixture(work: (env: string, directory: string) => Promise<void>) {
  const prefix = path.join(tmpdir(), "receipt-ai-test-");
  const dir = await mkdtemp(prefix);
  try { await work(path.join(dir, ".env"), path.join(dir, "ai")); }
  finally { assert.ok(path.resolve(dir).startsWith(path.resolve(prefix))); await rm(dir, { recursive: true, force: true }); }
}

test("connection verifies actual Responses access, stores only the key, and preserves iCloud settings", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, '# keep\nICLOUD_EMAIL="example@icloud.com"\nICLOUD_APP_PASSWORD="aaaa-bbbb-cccc-dddd"\n');
    const calls: Record<string, unknown>[] = [];
    const ai = new CalendarAI(env, dir, async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${key}`);
      assert.equal(options?.redirect, "error");
      calls.push(JSON.parse(String(options?.body)));
      return completed();
    });
    assert.equal((await ai.status()).connected, false);
    const status = await ai.connect(key);
    assert.equal(status.connected, true);
    assert.ok(status.reservedUsd > 0);
    assert.ok(!JSON.stringify(status).includes(key));
    assert.equal(calls[0].model, AI_MODEL);
    assert.equal(calls[0].store, false);
    assert.deepEqual(calls[0].reasoning, { effort: "none" });
    assert.ok(!JSON.stringify(calls[0]).includes("test@example.com"));
    const cloud = new DotEnvICloudCredentials(env);
    await Promise.all([cloud.save({ email: "new@icloud.com", password: "aaaa-bbbb-cccc-dddd" }), ai.disconnect()]);
    assert.deepEqual(await cloud.load(), { email: "new@icloud.com", password: "aaaa-bbbb-cccc-dddd" });
    assert.ok(!(await readFile(env, "utf8")).includes("OPENAI_API_KEY"));
    assert.equal((await ai.status()).connected, false);
    assert.ok((await ai.status()).reservedUsd > 0);
  });
});

test("long notes use cached summaries across refreshes/restarts and all event context invalidates the cache", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return completed(); };
    const ai = new CalendarAI(env, dir, fetcher);
    const short = { ...event, id: "short", description: "  Exact wording.\nBring ID.  " };
    const [a, b] = await Promise.all([ai.summarize([event, short]), ai.summarize([event])]);
    assert.equal(calls, 1);
    assert.equal(a[0].descriptionSummary?.text, summary);
    assert.deepEqual(b[0], a[0]);
    assert.equal(a[0].description, event.description);
    assert.deepEqual(a[1], short);
    const reserved = (await ai.status()).reservedUsd;
    const restarted = new CalendarAI(env, dir, fetcher);
    assert.equal((await restarted.summarize([event]))[0].descriptionSummary?.text, summary);
    assert.equal((await restarted.status()).reservedUsd, reserved);
    assert.equal(calls, 1);
    for (const edit of [{ description: event.description + "Bring the checklist." }, { location: "Annex" }, { title: "Rescheduled appointment" }, { time: "11:00 AM" }, { invitees: [{ address: "test@example.com", participationStatus: "DECLINED" }] }]) {
      assert.equal((await restarted.summarize([{ ...event, ...edit }]))[0].descriptionSummary?.text, summary);
    }
    assert.equal(calls, 6);
    assert.ok(!(await readFile(path.join(dir, "state.json"), "utf8")).includes(key));
    assert.ok(!(await readFile(path.join(dir, "state.json"), "utf8")).includes("test@example.com"));
  });
});

test("a shorter cutoff drops old cached summaries while preserving usage history", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    await mkdir(dir);
    const file = path.join(dir, "state.json");
    await writeFile(file, JSON.stringify({ month: "2026-11", reservedMicroUsd: 123456, summaries: { ["a".repeat(64)]: { text: "x".repeat(120), model: AI_MODEL, generatedAt: "2026-11-05T18:00:00Z" } } }));
    const ai = new CalendarAI(env, dir, async () => completed(), () => new Date("2026-11-05T18:00:00Z"));
    const status = await ai.status();
    assert.equal(status.reservedUsd, 0.123456);
    assert.equal(status.error, undefined);
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")).summaries, {});
    assert.equal((await ai.summarize([event]))[0].descriptionSummary?.text, summary);
    assert.ok((await ai.status()).reservedUsd > status.reservedUsd);
  });
});

test("invalid, empty, overlong, incomplete, refused and failed output retains complete original notes", async () => {
  const cases = [() => completed(""), () => completed("x".repeat(91)), () => completed("Line one\nLine two"), () => Response.json({ status: "incomplete", output: [] }), () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }), () => new Response("PRIVATE KEY OR NOTES", { status: 401 }), () => new Response("PRIVATE KEY OR NOTES", { status: 429 }), () => new Response("PRIVATE KEY OR NOTES", { status: 404 }), () => new Response("invalid JSON"), () => { throw new Error("PRIVATE KEY OR NOTES"); }];
  for (const response of cases) await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    let calls = 0;
    const ai = new CalendarAI(env, dir, async () => { calls++; return response(); });
    const [item] = await ai.summarize([event]);
    assert.equal(item.description, event.description);
    assert.equal(item.descriptionSummary, undefined);
    assert.ok(item.summaryUnavailable);
    assert.doesNotMatch(item.summaryUnavailable, /PRIVATE/);
    await ai.summarize([event]);
    assert.equal(calls, 1, "failure cooldown prevents repeated charges");
    assert.ok((await ai.status()).reservedUsd > 0);
  });
});

test("missing key and oversized input make no provider request; rejected replacement preserves saved key", async () => {
  await fixture(async (env, dir) => {
    let calls = 0;
    const ai = new CalendarAI(env, dir, async () => { calls++; return new Response("PRIVATE", { status: 401 }); });
    assert.match((await ai.summarize([event]))[0].summaryUnavailable!, /connect OpenAI/);
    assert.equal(calls, 0);
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    const long = { ...event, description: "x".repeat(65000) };
    assert.match((await ai.summarize([long]))[0].summaryUnavailable!, /input limit/);
    assert.equal(calls, 0);
    await assert.rejects(ai.connect("sk-other-" + "b".repeat(32)), /rejected/);
    assert.ok((await readFile(env, "utf8")).includes(key));
    assert.equal(calls, 1);
  });
});

test("persistent monthly guard blocks requests before charging, survives disconnect, resets in a new UTC month and fails closed on corrupt history", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    await mkdir(dir);
    const file = path.join(dir, "state.json");
    await writeFile(file, JSON.stringify({ month: "2026-11", reservedMicroUsd: 20_000_000, summaries: {} }));
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls++; return completed(); };
    const ai = new CalendarAI(env, dir, fetcher, () => new Date("2026-11-05T18:00:00Z"));
    assert.match((await ai.summarize([event]))[0].summaryUnavailable!, /allowance is exhausted/);
    assert.equal(calls, 0);
    await ai.disconnect();
    assert.equal((await ai.status()).reservedUsd, 20);
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    const december = new CalendarAI(env, dir, fetcher, () => new Date("2026-12-01T00:00:00Z"));
    assert.ok((await december.summarize([event]))[0].descriptionSummary);
    assert.equal(calls, 1);
    await writeFile(file, "corrupt");
    const broken = new CalendarAI(env, dir, fetcher);
    assert.match((await broken.summarize([event]))[0].summaryUnavailable!, /history could not be read/);
    assert.equal(calls, 1);
  });
});

test("disconnect cancels in-flight generation and never publishes or recaches an obsolete summary", async () => {
  await fixture(async (env, dir) => {
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const ai = new CalendarAI(env, dir, async (_url, options) => {
      started();
      return new Promise<Response>((_resolve, reject) => {
        options!.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    });
    const pending = ai.summarize([event]);
    await ready;
    await ai.disconnect();
    const [result] = await pending;
    assert.equal(result.description, event.description);
    assert.equal(result.descriptionSummary, undefined);
    assert.equal((await ai.status()).connected, false);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, "state.json"), "utf8")).summaries, {});
  });
});

test("local API protects credentials and live calendar collection applies summaries only to the included items", async () => {
  await fixture(async (env, dir) => {
    const ai = new CalendarAI(env, dir, async () => completed());
    const calendarId = "a".repeat(64);
    const app = express();
    app.use("/api/ai", createAIRouter(ai));
    const seen: CalendarItem[][] = [];
    app.use("/api/icloud", createICloudRouter(() => ({ discover: async () => {}, status: () => ({ connected: true, calendars: [] }), upcoming: async () => ({ provenance: { mode: "live", source: "Test", retrievedAt: new Date().toISOString() }, items: [event, { ...event, id: "second" }] }) }) as unknown as ICloudConnection, undefined, async items => { seen.push(items); return ai.summarize(items); }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address(); assert.ok(address && typeof address === "object");
    const root = `http://127.0.0.1:${address.port}/api`;
    const post = (endpoint: string, body: unknown, extra = {}) => fetch(`${root}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
    try {
      assert.equal((await post("ai/connect", { apiKey: key }, { Origin: "https://evil.test" })).status, 403);
      assert.equal((await post("ai/connect", { apiKey: key })).status, 200);
      const status = await (await fetch(`${root}/ai/status`)).text();
      assert.ok(!status.includes(key));
      await post("icloud/connect", { email: "example@icloud.com", password: "aaaa-bbbb-cccc-dddd" });
      const data = await (await post("icloud/events", { calendarIds: [calendarId], summaryLimit: 1 })).json();
      assert.equal(seen[0].length, 1);
      assert.equal(data.items[0].descriptionSummary.text, summary);
      assert.equal(data.items[1].descriptionSummary, undefined);
      assert.equal((await post("icloud/events", { calendarIds: [calendarId], summaryLimit: 50 })).status, 400);
      const malformed = await fetch(`${root}/ai/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"apiKey":"PRIVATE"' });
      assert.doesNotMatch(await malformed.text(), /PRIVATE/);
      await post("ai/disconnect", {});
      assert.equal((await (await fetch(`${root}/ai/status`)).json()).connected, false);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
