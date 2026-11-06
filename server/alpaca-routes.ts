import express from "express";
import { AlpacaError, AlpacaMarkets } from "./alpaca";
import { localApi } from "./local-api";

export function createAlpacaRouter(markets: AlpacaMarkets) {
  const router = express.Router();
  router.use(localApi);
  router.use(express.json({ limit: "4kb" }));
  router.get("/status", async (_req, res) => {
    try { res.json(await markets.status()); }
    catch { res.status(500).json({ error: "Could not read the saved Alpaca connection." }); }
  });
  for (const action of ["connect", "disconnect", "markets"] as const) router.post(`/${action}`, async (req, res) => {
    try {
      if (action === "markets") { res.json(await markets.collect(req.body?.symbols, req.body?.offline === true)); return; }
      res.json(action === "connect" ? await markets.connect(typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "", typeof req.body?.secretKey === "string" ? req.body.secretKey.trim() : "") : await markets.disconnect());
    } catch (error) {
      res.status(error instanceof AlpacaError ? 400 : 500).json({ error: error instanceof AlpacaError ? error.message : "Could not update the Alpaca connection. Check the local server and project folder." });
    }
  });
  router.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: "The Alpaca request could not be read." }); });
  return router;
}
