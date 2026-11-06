import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { envValues, updateEnv } from "./env-file";
import { calendarDescriptionSummaryRequest } from "./calendar-description-summary";
import { CALENDAR_DESCRIPTION_VERBATIM_LIMIT } from "../src/calendar-description";
import type { AIStatus, CalendarItem, SummaryCitation } from "../src/types";
import { assessedHighlights, briefingHighlightsText, briefingSummaryRequest, highlightSections, validBriefingSummary, type SummarySection } from "../src/briefing-summary";
import { BRIEFING_RESEARCH_MODEL, BRIEFING_RESEARCH_VERSION, briefingResearchRequest, publicResearchSections, readBriefingResearch, briefingCitations, type BriefingResearch } from "./briefing-research";

export const AI_MODEL = "gpt-5.6-luna";
export const BRIEFING_AI_MODEL = "gpt-6.1-sol";
export const BRIEFING_REASONING = "medium";
const MONTHLY_LIMIT_MICRO_USD = 20_000_000;
const MAX_OUTPUT_TOKENS = 512;
const BRIEFING_MAX_OUTPUT_TOKENS = 8192;
type Summary = NonNullable<CalendarItem["descriptionSummary"]> & { kind?: "briefing"; citations?: SummaryCitation[] };
type State = { month: string; reservedMicroUsd: number; summaries: Record<string, Summary> };
export class AIError extends Error {}
const validKey = (key: string) => /^sk-[A-Za-z0-9_-]{20,500}$/.test(key);
const validSummary = (value: unknown): value is string => typeof value === "string" && !!value.trim() && Array.from(value).length <= CALENDAR_DESCRIPTION_VERBATIM_LIMIT && !/[\r\n\x00-\x1f]/.test(value);
const supportedModel = (model: string) => model === AI_MODEL || model === BRIEFING_AI_MODEL;

export class CalendarAI {
  private state?: State;
  private queue: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, Promise<Summary>>();
  private failures = new Map<string, { until: number; message: string }>();
  private generation = 0;
  private connectionController = new AbortController();
  private error?: string;
  private changing = false;
  constructor(private envFile: string, private directory: string, private fetcher: typeof fetch = fetch, private now = () => new Date()) {}
  private month() { return this.now().toISOString().slice(0, 7); }
  private async transaction<T>(work: (state: State) => T): Promise<T> {
    const task = this.queue.then(async () => {
      if (!this.state) {
        try {
          const value = JSON.parse(await readFile(path.join(this.directory, "state.json"), "utf8"));
          if (!/^\d{4}-\d{2}$/.test(value.month) || !Number.isSafeInteger(value.reservedMicroUsd) || value.reservedMicroUsd < 0 || !value.summaries || typeof value.summaries !== "object" || Array.isArray(value.summaries) || Object.entries(value.summaries).some(([key, entry]) => !/^[a-f0-9]{64}$/.test(key) || !entry || typeof (entry as Summary).text !== "string" || !supportedModel((entry as Summary).model) || !Number.isFinite(Date.parse((entry as Summary).generatedAt)))) throw new Error("Invalid AI state");
          this.state = value;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new AIError("AI usage history could not be read. Restore .local/ai/state.json before making more requests.");
          this.state = { month: this.month(), reservedMicroUsd: 0, summaries: {} };
        }
      }
      const next = structuredClone(this.state!);
      // A shorter display limit invalidates old summaries, never usage history.
      for (const [key, summary] of Object.entries(next.summaries)) if (!(summary.kind === "briefing" ? summary.model === BRIEFING_AI_MODEL && validBriefingSummary(summary.text) : summary.model === AI_MODEL && validSummary(summary.text))) delete next.summaries[key];
      if (next.month !== this.month()) { next.month = this.month(); next.reservedMicroUsd = 0; }
      const result = work(next);
      if (JSON.stringify(next) !== JSON.stringify(this.state)) {
        await mkdir(this.directory, { recursive: true });
        const file = path.join(this.directory, "state.json");
        const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
        try {
          await writeFile(temporary, JSON.stringify(next), { mode: 0o600, flag: "wx" });
          await rename(temporary, file);
        } finally { await unlink(temporary).catch(() => {}); }
        this.state = next;
      }
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  private async key() { return (await envValues(this.envFile)).OPENAI_API_KEY?.trim() ?? ""; }
  async status(): Promise<AIStatus> {
    const connected = validKey(await this.key());
    try {
      return await this.transaction(state => ({ connected, model: AI_MODEL, briefingModel: BRIEFING_AI_MODEL, briefingReasoning: BRIEFING_REASONING, researchModel: BRIEFING_RESEARCH_MODEL, monthlyLimitUsd: 20, reservedUsd: state.reservedMicroUsd / 1_000_000, month: state.month, error: this.error }));
    } catch (error) {
      return { connected, model: AI_MODEL, briefingModel: BRIEFING_AI_MODEL, briefingReasoning: BRIEFING_REASONING, researchModel: BRIEFING_RESEARCH_MODEL, monthlyLimitUsd: 20, reservedUsd: 20, month: this.month(), error: error instanceof AIError ? error.message : "AI usage history is unavailable; requests are paused." };
    }
  }
  private async research(key: string, sections: SummarySection[], signal: AbortSignal): Promise<BriefingResearch | undefined> {
    const publicSections = publicResearchSections(sections);
    if (!publicSections.length) return;
    // Covers three full-context Luna passes at long-context rates, two search
    // calls, and the output cap. Settle down only on reported successful usage.
    const reserve = 700_000;
    const month = this.month();
    const reserved = await this.transaction(state => {
      // Leave room for the final summary even when research cannot fit.
      if (state.reservedMicroUsd + reserve + 500_000 > MONTHLY_LIMIT_MICRO_USD) return false;
      state.reservedMicroUsd += reserve;
      return true;
    });
    if (!reserved) return;
    try {
      signal.throwIfAborted();
      const response = await this.fetcher("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(briefingResearchRequest(publicSections, this.now())),
        signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]), redirect: "error",
      });
      if (!response.ok) return;
      const data = await response.json();
      const usage = data.usage;
      if (data.status === "completed" && Number.isSafeInteger(usage?.input_tokens) && usage.input_tokens >= 0 && Number.isSafeInteger(usage?.output_tokens) && usage.output_tokens >= 0 && Array.isArray(data.output)) {
        const calls = data.output.filter((item: { type: string }) => item.type === "web_search_call").length;
        // No cache discount; use Luna's higher long-context token rates.
        const charged = Math.ceil(usage.input_tokens * 0.2 + usage.output_tokens * 0.75 + calls * 10000);
        await this.transaction(state => { if (state.month === month) state.reservedMicroUsd += charged - reserve; });
      }
      return readBriefingResearch(data);
    } catch {
      // Context is optional. Failed/uncertain research retains its reservation;
      // the final briefing can still report the supplied observations.
      return;
    }
  }
  private async generate(key: string, request: { instructions: string; input: string; kind?: "briefing" }, signal: AbortSignal): Promise<Summary> {
    const briefing = request.kind === "briefing";
    const model = briefing ? BRIEFING_AI_MODEL : AI_MODEL;
    const maxOutputTokens = briefing ? BRIEFING_MAX_OUTPUT_TOKENS : MAX_OUTPUT_TOKENS;
    const sections: SummarySection[] = briefing ? JSON.parse(request.input).sections : [];
    const research = briefing ? await this.research(key, sections, signal) : undefined;
    signal.throwIfAborted();
    const schema = briefing ? {
      type: "object", properties: { assessments: { type: "array", minItems: sections.length, maxItems: sections.length, items: {
        type: "object", properties: {
          source: { type: "string", enum: sections.map(section => section.title) },
          highlights: { type: "array", minItems: 0, maxItems: 1, items: {
            type: "object", properties: { text: { type: "string" }, evidence: { type: "string" }, contextSources: { type: "array", items: { type: "string" } } },
            required: ["text", "evidence", "contextSources"], additionalProperties: false,
          } },
        }, required: ["source", "highlights"], additionalProperties: false,
      } } }, required: ["assessments"], additionalProperties: false,
    } : { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false };
    const body = JSON.stringify({
      model, store: false, service_tier: "default", reasoning: { effort: briefing ? BRIEFING_REASONING : "none" }, max_output_tokens: maxOutputTokens,
      instructions: request.instructions + (briefing ? "\nReturn the required assessments JSON object, covering every supplied module." : '\nReturn the result in the summary field of the required JSON object.'),
      input: research ? JSON.stringify({ ...JSON.parse(request.input), research }) : request.input,
      text: { format: { type: "json_schema", name: briefing ? "briefing_highlights" : "calendar_notes", strict: true, schema } },
    });
    // Conservative upper bound: UTF-8 bytes plus protocol overhead, no cache discount.
    // Rates checked 2026-11-05: Luna $0.20/$1.20; Sol $2/$10 per M input/output.
    // The output cap includes reasoning tokens for the briefing model.
    // Keep the full reservation, even on timeout, since upstream may have billed it.
    const reserve = Math.ceil((Buffer.byteLength(body, "utf8") + 4096) * (briefing ? 2 : 0.2) * 1.25 + maxOutputTokens * (briefing ? 10 : 1.2));
    await this.transaction(state => {
      if (state.reservedMicroUsd + reserve > MONTHLY_LIMIT_MICRO_USD) throw new AIError("The $20 monthly AI allowance is exhausted. Full notes are shown.");
      state.reservedMicroUsd += reserve;
    });
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await this.fetcher("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal, redirect: "error" });
    } catch { throw new AIError("OpenAI could not be reached or timed out. Full notes are shown."); }
    if (!response.ok) {
      throw new AIError(response.status === 401 ? "OpenAI rejected the API key. Reconnect with a valid project key." : response.status === 429 ? "OpenAI quota or rate limit reached. Check API billing and credits, then refresh." : response.status === 403 || response.status === 404 ? `This API project cannot use ${model}. Check model access and key permissions.` : "OpenAI is temporarily unavailable. Full notes are shown.");
    }
    let data;
    try { data = await response.json(); } catch { throw new AIError("OpenAI returned an unreadable response. Full notes are shown."); }
    if (data.status !== "completed" || !Array.isArray(data.output)) throw new AIError("OpenAI did not finish the summary. Full notes are shown.");
    const content = data.output.filter((item: { type: string }) => item.type === "message").flatMap((item: { content: unknown[] }) => item.content ?? []);
    if (content.some((item: { type: string }) => item.type === "refusal")) throw new AIError("OpenAI could not summarize these notes. Full notes are shown.");
    const text = content.filter((item: { type: string }) => item.type === "output_text").map((item: { text: string }) => item.text).join("");
    let summary;
    let citations: SummaryCitation[] | undefined;
    try {
      const parsed = JSON.parse(text);
      summary = briefing ? briefingHighlightsText(parsed, sections) : parsed.summary;
      if (briefing && research) {
        citations = briefingCitations(assessedHighlights(parsed, sections), research);
        if (!citations) summary = undefined;
      }
    } catch { /* Fall through to validation. */ }
    if (!(request.kind === "briefing" ? validBriefingSummary(summary) : validSummary(summary))) throw new AIError(request.kind === "briefing" ? "OpenAI did not return a complete, concise briefing summary." : `No complete summary fit the ${CALENDAR_DESCRIPTION_VERBATIM_LIMIT}-character limit. Full notes are shown.`);
    return { text: summary.trim(), model, generatedAt: this.now().toISOString(), ...(request.kind ? { kind: request.kind } : {}), ...(citations?.length ? { citations } : {}) };
  }
  async summarizeBriefing(sections: SummarySection[]): Promise<Summary> {
    if (!highlightSections(sections).length) throw new AIError("No briefing sources are available to assess noteworthy updates.");
    const key = await this.key();
    if (!validKey(key)) throw new AIError("Connect OpenAI in AI summary settings to generate your briefing highlights.");
    const request = briefingSummaryRequest(sections, this.now());
    if (Buffer.byteLength(request.input, "utf8") > 128000) throw new AIError("This briefing exceeds the AI input limit. Reduce the included items or notes.");
    const version = this.generation;
    const hash = createHash("sha256").update(JSON.stringify({ model: BRIEFING_AI_MODEL, reasoning: BRIEFING_REASONING, research: [BRIEFING_RESEARCH_MODEL, BRIEFING_RESEARCH_VERSION], ...request })).digest("hex");
    const cached = await this.transaction(state => state.summaries[hash]);
    if (version !== this.generation) throw new AIError("AI connection changed. Refresh the summary to try again.");
    if (cached && (!publicResearchSections(sections).length || this.now().valueOf() - Date.parse(cached.generatedAt) < 30 * 60_000)) return cached;
    const failed = this.failures.get(hash);
    if (failed && failed.until > this.now().valueOf()) throw new AIError(failed.message);
    let pending = this.pending.get(hash);
    if (!pending) {
      const signal = AbortSignal.any([AbortSignal.timeout(90000), this.connectionController.signal]);
      pending = this.generate(key, request, signal).then(async summary => {
        if (version !== this.generation) throw new AIError("AI connection changed. Refresh the summary to try again.");
        await this.transaction(state => {
          if (version !== this.generation) return;
          state.summaries[hash] = summary;
          for (const old of Object.keys(state.summaries).slice(0, -500)) delete state.summaries[old];
        });
        if (version !== this.generation) throw new AIError("AI connection changed. Refresh the summary to try again.");
        return summary;
      }).catch(error => {
        const message = error instanceof AIError ? error.message.replace(/Full notes are shown\./g, "").trim() : "Briefing summary unavailable. Try refreshing.";
        if (version === this.generation) {
          if (this.failures.size >= 500) this.failures.delete(this.failures.keys().next().value!);
          this.failures.set(hash, { until: this.now().valueOf() + 60000, message });
        }
        throw new AIError(message);
      }).finally(() => { if (this.pending.get(hash) === pending) this.pending.delete(hash); });
      this.pending.set(hash, pending);
    }
    return pending;
  }
  async connect(key: string) {
    if (!validKey(key)) throw new AIError("Enter an OpenAI API project key beginning with sk-.");
    if (this.changing) throw new AIError("An AI connection change is already in progress.");
    this.changing = true;
    try {
      // Test actual model access using synthetic notes before saving a replacement key.
      await this.generate(key, calendarDescriptionSummaryRequest({ id: "connection-test", title: "Test appointment", time: "10:00 AM", calendar: "Test", description: "Please bring photo ID and use the east entrance. " + "This is a synthetic connection test with no personal calendar information. ".repeat(5) })!, AbortSignal.timeout(20000));
      await updateEnv(this.envFile, ["OPENAI_API_KEY"], { OPENAI_API_KEY: key });
      this.generation++;
      this.connectionController.abort();
      this.connectionController = new AbortController();
      this.pending.clear();
      this.error = undefined;
      this.failures.clear();
      return this.status();
    } finally { this.changing = false; }
  }
  async disconnect() {
    if (this.changing) throw new AIError("An AI connection change is already in progress.");
    this.changing = true;
    try {
      await updateEnv(this.envFile, ["OPENAI_API_KEY"]);
      this.generation++;
      this.connectionController.abort();
      this.connectionController = new AbortController();
      this.pending.clear();
      this.error = undefined;
      this.failures.clear();
      await this.transaction(state => { state.summaries = {}; });
      return this.status();
    } finally { this.changing = false; }
  }
  async summarize(items: CalendarItem[]): Promise<CalendarItem[]> {
    let key: string;
    try { key = await this.key(); } catch { key = ""; }
    const version = this.generation;
    const signal = AbortSignal.any([AbortSignal.timeout(20000), this.connectionController.signal]);
    const result = [...items];
    let index = 0;
    const worker = async () => {
      while (index < items.length) {
        const i = index++;
        const { descriptionSummary: _oldSummary, summaryUnavailable: _oldError, ...item } = items[i];
        result[i] = item;
        const request = calendarDescriptionSummaryRequest(item);
        if (!request) continue;
        if (!validKey(key)) { result[i] = { ...item, summaryUnavailable: "AI unavailable: connect OpenAI in Calendar settings. Full notes are shown." }; continue; }
        try {
          if (Buffer.byteLength(request.input, "utf8") > 64000) throw new AIError("These notes exceed the AI input limit. Full notes are shown.");
          const hash = createHash("sha256").update(JSON.stringify({ model: AI_MODEL, ...request })).digest("hex");
          const cached = await this.transaction(state => state.summaries[hash]);
          if (cached) { if (version === this.generation) result[i] = { ...item, descriptionSummary: cached }; continue; }
          const failed = this.failures.get(hash);
          if (failed && failed.until > this.now().valueOf()) throw new AIError(failed.message);
          if (signal.aborted || version !== this.generation) throw new AIError("AI summary collection timed out or the connection changed. Full notes are shown.");
          let pending = this.pending.get(hash);
          if (!pending) {
            pending = this.generate(key, request, signal).then(async summary => {
              if (version === this.generation) await this.transaction(state => {
                if (version !== this.generation) return;
                state.summaries[hash] = summary;
                for (const old of Object.keys(state.summaries).slice(0, -500)) delete state.summaries[old];
              });
              return summary;
            }).catch(error => {
              const message = error instanceof AIError ? error.message : "AI summary unavailable. Full notes are shown.";
              if (version === this.generation) {
                if (this.failures.size >= 500) this.failures.delete(this.failures.keys().next().value!);
                this.failures.set(hash, { until: this.now().valueOf() + 60000, message });
              }
              throw new AIError(message);
            }).finally(() => { if (this.pending.get(hash) === pending) this.pending.delete(hash); });
            this.pending.set(hash, pending);
          }
          const summary = await pending;
          if (version === this.generation) { result[i] = { ...item, descriptionSummary: summary }; this.error = undefined; }
        } catch (error) {
          const message = error instanceof AIError ? error.message : "AI summary unavailable. Full notes are shown.";
          result[i] = { ...item, summaryUnavailable: message };
          if (version === this.generation) this.error = message;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
    if (version !== this.generation) return items.map(({ descriptionSummary: _summary, summaryUnavailable: _error, ...item }) => ({ ...item, summaryUnavailable: "AI connection changed. Refresh the calendar to try again." }));
    return result;
  }
}
