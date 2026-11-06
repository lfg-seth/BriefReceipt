import express from "express";
import { localApi } from "./local-api";
import { RemindersError, RemindersStore } from "./reminders";

const errors: express.ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error instanceof RemindersError ? error.status : 400).json({ error: error instanceof RemindersError ? error.message : "The Reminders request could not be processed. Check the format and try again." });
};
export function remindersAdmin(store: RemindersStore, setupHtml = "") {
  const router = express.Router();
  router.use(localApi, express.json({ limit: "8kb" }));
  router.get("/status", async (_req, res) => { res.json(await store.status()); });
  router.get("/guide", (_req, res) => {
    res.set({ "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" }).type("html").send(setupHtml);
  });
  router.post("/pair", async (_req, res) => { res.json(await store.pair()); });
  router.post("/address", async (req, res) => { res.json(await store.setAddress(req.body?.publicUrl)); });
  router.post("/revoke", async (_req, res) => { res.json(await store.revoke()); });
  router.post("/tasks", async (req, res) => {
    const lists: unknown = req.body?.lists;
    if (!Array.isArray(lists) || lists.length > 100 || !lists.every(l => typeof l === "string" && l.length <= 200)) throw new RemindersError("Choose valid reminder lists.");
    res.json(await store.tasks(lists));
  });
  router.use(errors);
  return router;
}
/** Separate loopback listener, exposed only by private Tailscale Serve. No editor or read API. */
export function remindersReceiver(store: RemindersStore, setupHtml: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => { res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" }); next(); });
  app.get("/", (_req, res) => { res.type("html").send(setupHtml); });
  app.get("/health", (_req, res) => { res.json({ ok: true, service: "Receipt Summary Reminders upload" }); });
  app.post("/upload", async (req, res, next) => {
    if (!await store.authorized(req.get("authorization"))) { res.status(401).json({ error: "Invalid upload token." }); return; }
    if (!req.is("application/json")) { res.status(415).json({ error: "Send a JSON snapshot." }); return; }
    next();
  }, express.json({ limit: "1mb" }), async (req, res) => {
    res.json(await store.upload(req.get("authorization"), req.body));
  });
  app.use((_req, res) => { res.status(404).json({ error: "Upload endpoint only." }); });
  app.use(errors);
  return app;
}
