import express from "express";
import { CalendarAI, AIError } from "./calendar-ai";
import { localApi } from "./local-api";
import { BLOCK_META } from "../src/types";
import { highlightSections, type SummarySection } from "../src/briefing-summary";

export function createAIRouter(ai: CalendarAI) {
  const router = express.Router();
  router.use(localApi);
  router.use(express.json({ limit: "160kb" }));
  router.post("/briefing-summary", async (req, res) => {
    const input: unknown = req.body?.sections;
    const sections = Array.isArray(input) ? input.filter(section => section?.title !== BLOCK_META.news.title) : input;
    const titles = Object.entries(BLOCK_META).filter(([id]) => id !== "summary").map(([, meta]) => meta.title);
    if (!Array.isArray(sections) || sections.length > 7 || sections.some(section => !section || !titles.includes(section.title) || !["sample", "live", "unavailable"].includes(section.mode) || typeof section.content !== "string" || section.content.length > 128000) || new Set(sections.map(section => section.title)).size !== sections.length) {
      res.status(400).json({ error: "The briefing sections could not be read." }); return;
    }
    if (!sections.length) {
      res.json({ text: "Enable a block other than Headlines to assess noteworthy updates.", provenance: { mode: "unavailable", source: "OpenAI", retrievedAt: new Date().toISOString() } }); return;
    }
    try {
      const summary = await ai.summarizeBriefing(sections as SummarySection[]);
      res.set("Cache-Control", "no-store").json({ text: summary.text, ...(summary.citations?.length ? { citations: summary.citations } : {}), provenance: {
        mode: highlightSections(sections).every(section => section.mode === "sample") ? "sample" : "live",
        source: `OpenAI · ${summary.model}`, retrievedAt: summary.generatedAt,
        note: sections.some(section => section.mode === "live")
          ? "Every available live module is assessed independently, with targeted public research when relevant. Sample and unavailable sections cannot supply live highlights."
          : "Every available sample module is assessed independently. Updates are synthetic.",
      } });
    } catch (error) {
      res.status(503).json({ error: error instanceof AIError ? error.message : "Briefing summary unavailable. Check the OpenAI connection and try again." });
    }
  });
  router.get("/status", async (_req, res) => {
    try { res.json(await ai.status()); }
    catch { res.status(500).json({ error: "Could not read the saved OpenAI connection." }); }
  });
  for (const action of ["connect", "disconnect"] as const) router.post(`/${action}`, async (req, res) => {
    try {
      const key = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
      res.json(action === "connect" ? await ai.connect(key) : await ai.disconnect());
    } catch (error) { res.status(error instanceof AIError ? 400 : 500).json({ error: error instanceof AIError ? error.message : "Could not update the local OpenAI connection. Check that this project folder is writable." }); }
  });
  router.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: "The OpenAI request could not be read." }); });
  return router;
}
