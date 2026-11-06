import express from "express";
import { GuardianError, GuardianNews } from "./guardian";
import { localApi } from "./local-api";

export function createGuardianRouter(news: GuardianNews) {
  const router = express.Router();
  router.use(localApi);
  router.use(express.json({ limit: "2kb" }));
  router.get("/status", async (_req, res) => {
    try { res.json(await news.status()); }
    catch { res.status(500).json({ error: "Could not read the saved Guardian connection." }); }
  });
  for (const action of ["connect", "disconnect"] as const) router.post(`/${action}`, async (req, res) => {
    try {
      const key = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
      res.json(action === "connect" ? await news.connect(key) : await news.disconnect());
    } catch (error) {
      res.status(error instanceof GuardianError ? 400 : 500).json({ error: error instanceof GuardianError ? error.message : "Could not save the Guardian connection. Check that the project folder is writable." });
    }
  });
  router.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: "The Guardian request could not be read." }); });
  return router;
}
