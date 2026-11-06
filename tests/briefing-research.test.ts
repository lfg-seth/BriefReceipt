import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CalendarAI, BRIEFING_AI_MODEL } from "../server/calendar-ai";
import { BRIEFING_RESEARCH_MODEL, briefingCitations, publicResearchSections, readBriefingResearch } from "../server/briefing-research";
import type { SummarySection } from "../src/briefing-summary";

const key = "sk-test-" + "a".repeat(32);
const source = { url: "https://example.com/company-outlook", title: "Company cuts outlook" };
const quote = { symbol: "ACME", kind: "stock", change: -10.8, session: "2026-11-05 regular close", asOf: "2026-11-05T21:00:00Z" };
const market: SummarySection = { title: "Markets", mode: "live", content: JSON.stringify({ content: [quote], note: "PRIVATE_BLOCK_NOTE" }) };
const notes: SummarySection = { title: "Calendar", mode: "live", content: "PRIVATE_APPOINTMENT_AND_INVITEES" };
const explanation = "ACME fell 10.8% after cutting its earnings outlook.";
const observation = "ACME fell 10.8%.";
const finalResponse = (text: string, contextSources: string[] = [], sources = ["Markets"]) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ assessments: sources.map(source => ({ source, highlights: source === "Markets" ? [{ text, evidence: '"change":-10.8', contextSources }] : [] })) }) }] }] });
const researchData = () => ({ status: "completed", usage: { input_tokens: 1000, output_tokens: 200 }, output: [
  { type: "web_search_call", action: { type: "search", sources: [source] } },
  { type: "message", content: [{ type: "output_text", text: "ACME fell on November 5 after cutting its earnings outlook.", annotations: [{ type: "url_citation", ...source }] }] },
] });

async function fixture(work: (env: string, dir: string) => Promise<void>) {
  const prefix = path.join(tmpdir(), "receipt-research-test-");
  const dir = await mkdtemp(prefix);
  try {
    const env = path.join(dir, ".env");
    await writeFile(env, `OPENAI_API_KEY=${key}\n`);
    await work(env, path.join(dir, "ai"));
  } finally { assert.ok(path.resolve(dir).startsWith(path.resolve(prefix))); await rm(dir, { recursive: true, force: true }); }
}

test("research receives public observations across sections, without private metadata or samples", () => {
  const weather: SummarySection = { title: "Weather", mode: "live", content: JSON.stringify({ content: { location: "Las Vegas, NV", condition: "storm", wind: 50, notes: "PRIVATE_WEATHER_NOTE", days: [{ date: "2026-11-05", high: 70, private: "PRIVATE_DAY" }] } }) };
  const events: SummarySection = { title: "Around you", mode: "live", content: JSON.stringify({ content: [{ title: "Public parade", date: "2026-11-05", venue: "City Hall", notes: "PRIVATE_EVENT_NOTE" }] }) };
  const news: SummarySection = { title: "Headlines", mode: "live", content: JSON.stringify({ content: [{ title: "Regional airport closure", description: "A power failure grounded flights.", publishedAt: "2026-11-05", byline: "PRIVATE_NEWS_BYLINE" }], note: "PRIVATE_NEWS_NOTE" }) };
  const result = publicResearchSections([market, notes, weather, events, news, { title: "Tasks", mode: "live", content: "PRIVATE_TASK" }, { title: "Projects", mode: "live", content: "PRIVATE_PATH" }, { ...market, mode: "sample" }]);
  assert.deepEqual(result.map(item => item.title), ["Markets", "Weather", "Around you"]);
  assert.ok(!JSON.stringify(result).includes("Regional airport closure"));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  assert.deepEqual(publicResearchSections([{ ...market, mode: "sample" }, { ...market, mode: "unavailable" }, notes]), []);
  assert.deepEqual(publicResearchSections([{ ...market, content: JSON.stringify({ content: [{ ...quote, change: -0.8 }] }) }]), []);
});

test("uncited, refused and unsafe research never becomes explanatory context", () => {
  const data = researchData();
  assert.equal(readBriefingResearch(data)?.sources[0].url, source.url);
  assert.deepEqual(briefingCitations([
    { source: "Markets", text: observation, evidence: "-10.8", contextSources: [source.url] },
    { source: "Calendar", text: "Approval is due today.", evidence: "Approval", contextSources: [source.url] },
  ], { text: "Grounded notes.", sources: [source] }), [
    { ...source, end: observation.length },
    { ...source, end: observation.length + 2 + "Approval is due today.".length },
  ]);
  const message = data.output[1] as any;
  message.content[0].annotations = [];
  assert.equal(readBriefingResearch(data), undefined);
  message.content[0].annotations = [{ type: "url_citation", url: "javascript:alert(1)", title: "Bad source" }];
  assert.equal(readBriefingResearch(data), undefined);
  assert.equal(readBriefingResearch({ ...data, status: "incomplete" }), undefined);
});

test("researched reasons reach the final summary and citations survive caching and restart", async () => {
  await fixture(async (env, dir) => {
    const calls: any[] = [];
    let now = new Date("2026-11-05T22:00:00Z");
    const fetcher: typeof fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      calls.push(body);
      if (body.model === BRIEFING_RESEARCH_MODEL) {
        assert.doesNotMatch(body.input, /PRIVATE/);
        assert.deepEqual(body.tools, [{ type: "web_search", search_context_size: "low" }]);
        assert.equal(body.max_tool_calls, 2);
        assert.equal(body.store, false);
        return Response.json(researchData());
      }
      assert.equal(body.model, BRIEFING_AI_MODEL);
      const input = JSON.parse(body.input);
      assert.equal(input.sections.find((item: SummarySection) => item.title === "Calendar").content, notes.content);
      assert.match(input.research.text, /earnings outlook/);
      assert.deepEqual(input.research.sources, [source]);
      return finalResponse(explanation, [source.url], ["Markets", "Calendar"]);
    };
    const ai = new CalendarAI(env, dir, fetcher, () => now);
    const [first, concurrent] = await Promise.all([ai.summarizeBriefing([market, notes]), ai.summarizeBriefing([market, notes])]);
    assert.equal(first.text, explanation);
    assert.deepEqual(first.citations, [{ ...source, end: explanation.length }]);
    assert.deepEqual(concurrent, first);
    assert.equal(calls.length, 2);
    assert.ok((await ai.status()).reservedUsd < 0.2, "successful research releases the unused worst-case reservation");
    const restarted = new CalendarAI(env, dir, fetcher, () => now);
    assert.deepEqual(await restarted.summarizeBriefing([market, notes]), first);
    assert.equal(calls.length, 2);
    now = new Date("2026-11-05T22:31:00Z");
    await restarted.summarizeBriefing([market, notes]);
    assert.equal(calls.length, 4, "public context is refreshed after 30 minutes even for unchanged observations");
    const saved = await readFile(path.join(dir, "state.json"), "utf8");
    assert.doesNotMatch(saved, /PRIVATE|sk-test/);
  });
});

test("research failure falls back to observations, retaining uncertain usage", async () => {
  await fixture(async (env, dir) => {
    let calls = 0;
    const ai = new CalendarAI(env, dir, async (_url, options) => {
      calls++;
      const body = JSON.parse(String(options?.body));
      if (body.model === BRIEFING_RESEARCH_MODEL) return new Response("PRIVATE_PROVIDER_ERROR", { status: 503 });
      assert.equal(JSON.parse(body.input).research, undefined);
      return finalResponse(observation);
    });
    const result = await ai.summarizeBriefing([market]);
    assert.equal(result.text, observation);
    assert.equal(result.citations, undefined);
    assert.equal(calls, 2);
    assert.ok((await ai.status()).reservedUsd >= 0.7);
  });
});

test("public weather research supplies practical context beyond market explanations", async () => {
  await fixture(async (env, dir) => {
    const weather: SummarySection = { title: "Weather", mode: "live", content: JSON.stringify({ content: { location: "Las Vegas, NV", condition: "storm", wind: 50 } }) };
    const text = "50 mph winds could disrupt travel as a cold front crosses the valley.";
    const ai = new CalendarAI(env, dir, async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      if (body.model === BRIEFING_RESEARCH_MODEL) {
        assert.match(body.input, /Las Vegas/);
        const data = researchData();
        (data.output[1] as any).content[0].text = "A cold front is bringing high winds and travel disruption to Las Vegas on November 5.";
        return Response.json(data);
      }
      assert.match(JSON.parse(body.input).research.text, /cold front/);
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ assessments: [{ source: "Weather", highlights: [{ text, evidence: '"wind":50', contextSources: [source.url] }] }] }) }] }] });
    });
    assert.equal((await ai.summarizeBriefing([weather])).text, text);
  });
});

test("research that cannot fit the allowance leaves room for the final briefing", async () => {
  await fixture(async (env, dir) => {
    let researchCalls = 0;
    const fetcher: typeof fetch = async (_url, options) => {
      if (JSON.parse(String(options?.body)).model === BRIEFING_RESEARCH_MODEL) researchCalls++;
      return finalResponse(observation);
    };
    await mkdir(dir, { recursive: true });
    const state = { month: new Date().toISOString().slice(0, 7), reservedMicroUsd: 19_000_000, summaries: {} };
    await writeFile(path.join(dir, "state.json"), JSON.stringify(state));
    const restarted = new CalendarAI(env, dir, fetcher);
    assert.equal((await restarted.summarizeBriefing([market])).text, observation);
    assert.equal(researchCalls, 0);
    assert.ok((await restarted.status()).reservedUsd < 20);
  });
});

test("sample-only briefings skip research and fabricated source links are rejected", async () => {
  await fixture(async (env, dir) => {
    const ai = new CalendarAI(env, dir, async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.model, BRIEFING_AI_MODEL);
      assert.equal(body.tools, undefined);
      return finalResponse(observation);
    });
    assert.equal((await ai.summarizeBriefing([{ ...market, mode: "sample" }])).text, `Sample: ${observation}`);
  });
  await fixture(async (env, dir) => {
    const ai = new CalendarAI(env, dir, async (_url, options) => JSON.parse(String(options?.body)).model === BRIEFING_RESEARCH_MODEL ? Response.json(researchData()) : finalResponse(explanation, ["https://example.com/invented"]));
    await assert.rejects(ai.summarizeBriefing([market]), /complete, concise briefing/);
  });
});
