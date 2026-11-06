import test from "node:test";
import assert from "node:assert/strict";
import { briefingHighlightsText, briefingSummaryRequest, briefingSummarySections, QUIET_BRIEFING } from "../src/briefing-summary";
import { defaultConfig } from "../src/config";
import { createSampleData } from "../src/data/fixtures";

test("summary input respects enabled blocks, selected sources, limits and unavailable content", () => {
  const config = structuredClone(defaultConfig);
  const data = createSampleData();
  config.blocks.find(b => b.id === "weather")!.enabled = false;
  config.blocks.find(b => b.id === "news")!.limit = 1;
  config.sources.calendars = [];
  config.sources.taskLists = [];
  data.tasks.provenance = { ...data.tasks.provenance, mode: "unavailable", note: "Snapshot is stale." };
  const sections = briefingSummarySections(config, data);
  assert.ok(!sections.some(section => section.title === "AI summary" || section.title === "Weather"));
  assert.deepEqual(JSON.parse(sections.find(section => section.title === "Calendar")!.content).content, []);
  assert.ok(!sections.some(section => section.title === "Headlines"));
  assert.equal(JSON.parse(sections.find(section => section.title === "Tasks")!.content).unavailable, "Snapshot is stale.");
  assert.ok(!JSON.stringify(sections).includes(data.tasks.items[0].title));
  assert.equal(JSON.parse(briefingSummaryRequest(sections).input).sections.some((section: { mode: string }) => section.mode === "unavailable"), false);
});

test("importance assessment gets full calendar notes and excludes all news content", () => {
  const data = createSampleData();
  data.calendar.items[0].description = "Final approval before tomorrow's signing deadline. Missing approval cancels the contract.";
  data.calendar.items[0].descriptionSummary = { text: "Bring notes.", model: "test", generatedAt: "2026-11-05T18:00:00Z" };
  data.news.items[0].description = "Article excerpt establishing the event's consequences.";
  const sections = briefingSummarySections(defaultConfig, data);
  const calendar = sections.find(section => section.title === "Calendar")!;
  assert.ok(calendar.content.includes(data.calendar.items[0].description));
  assert.ok(!calendar.content.includes("Bring notes."));
  assert.ok(!sections.some(section => section.title === "Headlines"));
  const request = briefingSummaryRequest([...sections, { title: "Headlines", mode: "live", content: "PRIVATE_NEWS_SENTINEL" }]);
  assert.ok(!request.input.includes(data.news.items[0].title));
  assert.ok(!request.input.includes("PRIVATE_NEWS_SENTINEL"));
  const config = structuredClone(defaultConfig);
  config.sources.newsCategories = [];
  assert.ok(!briefingSummarySections(config, data).some(section => section.title === "Headlines"));
  config.blocks.find(block => block.id === "news")!.enabled = false;
  assert.ok(!briefingSummarySections(config, data).some(section => section.title === "Headlines"));
});

test("quiet decisions are normal, live highlights exclude samples, and every highlight needs matching evidence", () => {
  const sections = [
    { title: "Markets", mode: "sample" as const, content: "Tesla fell 12.4%." },
    { title: "Calendar", mode: "live" as const, content: "Final contract approval at 2 PM before tomorrow's signing deadline." },
    { title: "Tasks", mode: "unavailable" as const, content: "Snapshot is stale." },
  ];
  const input = JSON.parse(briefingSummaryRequest(sections, new Date("2026-11-06T02:00:00Z")).input);
  assert.deepEqual(input.sections.map((section: { title: string }) => section.title), ["Calendar"]);
  assert.deepEqual(input.unavailableSections, ["Tasks"]);
  assert.equal(input.date, "2026-11-05");
  const result = (highlights: unknown[], source = "Calendar") => ({ assessments: [{ source, highlights }] });
  assert.equal(briefingHighlightsText(result([]), sections), QUIET_BRIEFING);
  const highlight = { text: "Your 2 PM review is the final contract approval before tomorrow's signing deadline.", evidence: "Final contract approval", contextSources: [] };
  assert.equal(briefingHighlightsText(result([highlight]), sections), highlight.text);
  assert.equal(briefingHighlightsText(result([{ ...highlight, evidence: "Tesla fell 12.4%." }], "Markets"), sections), undefined);
  assert.equal(briefingHighlightsText(result([{ ...highlight, evidence: "Invented national emergency" }]), sections), undefined);
  assert.equal(briefingHighlightsText(result([{ ...highlight, text: " " }]), sections), undefined);
  assert.equal(briefingHighlightsText(result([highlight, highlight]), sections), undefined);
  assert.equal(briefingHighlightsText(result([{ ...highlight, text: "Approval is at 2 PM. The contract expires tomorrow." }]), sections), undefined);
  assert.equal(briefingHighlightsText({ summary: "Routine recap" }, sections), undefined);
  assert.equal(briefingHighlightsText(result([], "Markets"), [sections[0]]), "Nothing noteworthy in the sample updates.");
});

test("every module is assessed and independent noteworthy items have no shared count or length quota", () => {
  const developments = [
    ["Markets", "ACME fell 10.8% after cutting its outlook; OTHER dropped 9.1% amid the same sector selloff."],
    ["Calendar", "Your 2 PM contract approval is the final decision before tomorrow's signing deadline."],
    ["Weather", "Damaging 65 mph winds could disrupt travel and knock out power this afternoon."],
    ["Tasks", "Submit the insurance appeal by 5 PM today to preserve coverage for the scheduled procedure."],
    ["Around you", "The downtown evacuation closes the bridge on your planned route this evening."],
    ["Projects", "The production certificate expires tonight; renewal is blocked pending the required approval."],
  ];
  const sections = developments.map(([title, content]) => ({ title, content, mode: "live" as const }));
  const assessments = developments.map(([source, text]) => ({ source, highlights: [{ text, evidence: text, contextSources: [] }] }));
  const text = briefingHighlightsText({ assessments }, sections)!;
  assert.ok(text.length > 320);
  assert.equal(text, developments.map(([, text]) => text).join("\n\n"));
  assert.equal(text.split("\n\n").length, developments.length);
  assert.equal(briefingHighlightsText({ assessments: assessments.slice(0, -1) }, sections), undefined, "an unassessed module invalidates the result");
  assert.equal(briefingHighlightsText({ assessments: [...assessments.slice(0, -1), assessments[0]] }, sections), undefined, "duplicate module checks cannot hide an omission");
  assessments[2].highlights = [];
  assert.ok(!briefingHighlightsText({ assessments }, sections)!.includes("65 mph"));
  assert.ok(briefingHighlightsText({ assessments }, sections)!.includes("2 PM"));
  assert.equal(briefingHighlightsText({ assessments: sections.map(section => ({ source: section.title, highlights: [] })) }, sections), QUIET_BRIEFING);
});

test("routine retrieval timestamps and summary results do not change the input", () => {
  const data = createSampleData();
  const initial = briefingSummarySections(defaultConfig, data);
  data.tasks.provenance.retrievedAt = new Date().toISOString();
  data.summary.text = "An old summary that must never summarize itself.";
  assert.deepEqual(briefingSummarySections(defaultConfig, data), initial);
  data.news.items[0].title = "Updated news that must not regenerate the summary.";
  assert.deepEqual(briefingSummarySections(defaultConfig, data), initial);
});
