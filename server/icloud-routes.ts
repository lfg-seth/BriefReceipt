import express from "express";
import { ICloudConnection, ICloudError } from "./icloud";
import { localApi } from "./local-api";
import type { ICloudCredentialStore } from "./icloud-credentials";
import type { CalendarItem } from "../src/types";

export function createICloudRouter(connect = (email: string, password: string) => new ICloudConnection(email, password), credentials?: ICloudCredentialStore, summarize?: (items: CalendarItem[]) => Promise<CalendarItem[]>) {
  const router = express.Router();
  let connection: ICloudConnection | undefined;
  let generation = 0;
  let connecting = false;
  let saved = false;
  let restoreError: string | undefined;
  let restorePromise: Promise<void> | undefined;
  const status = () => ({ ...(connection?.status() ?? { connected: false, calendars: [] }), ...(credentials ? { saved, error: restoreError } : {}) });
  function restore(): Promise<void> {
    if (!credentials) return Promise.resolve();
    if (restorePromise) return restorePromise;
    const version = generation;
    restorePromise = (async () => {
      try {
        const stored = await credentials.load();
        if (version !== generation || !stored) return;
        saved = true;
        connecting = true;
        const candidate = connect(stored.email, stored.password);
        await candidate.discover();
        if (version === generation) { connection = candidate; restoreError = undefined; }
      } catch (error) {
        if (version === generation) restoreError = error instanceof ICloudError ? error.message : "Could not restore the saved iCloud sign-in. Check .env or sign in again.";
      } finally { connecting = false; }
    })();
    return restorePromise;
  }
  router.use(localApi);
  router.use(express.json({ limit: "8kb" }));
  router.get("/status", async (_req, res) => { await restore(); res.json(status()); });
  router.post("/retry", async (_req, res) => {
    if (connecting) { res.status(409).json({ error: "A connection is already in progress." }); return; }
    if (!connection) { restorePromise = undefined; await restore(); }
    res.json(status());
  });
  router.post("/connect", async (req, res) => {
    await restore();
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password.replace(/\s/g, "") : "";
    if (!/^[^\s:@]+@[^\s@]+\.[^\s@]+$/.test(email) || /["'\\#]/.test(email) || email.length > 254 || !/^[a-z]{4}(?:-[a-z]{4}){3}$/i.test(password)) {
      res.status(400).json({ error: "Enter your Apple Account email and the app-specific password (xxxx-xxxx-xxxx-xxxx)." });
      return;
    }
    if (connecting) { res.status(409).json({ error: "A connection is already in progress." }); return; }
    connecting = true;
    const version = ++generation;
    try {
      const candidate = connect(email, password);
      await candidate.discover();
      if (version !== generation) { res.status(409).json({ error: "Connection cancelled." }); return; }
      if (credentials) {
        try { await credentials.save({ email, password }); }
        catch { throw new ICloudError("Apple accepted the sign-in, but credentials could not be saved to .env. Check that this project folder is writable and try again.", 500); }
        if (version !== generation) { res.status(409).json({ error: "Connection cancelled." }); return; }
        saved = true;
      }
      connection = candidate;
      restoreError = undefined;
      res.json(status());
    } catch (error) {
      res.status(error instanceof ICloudError ? error.status : 502).json({ error: error instanceof ICloudError ? error.message : "Could not reach iCloud. Check your connection and try again." });
    } finally { connecting = false; }
  });
  router.post("/disconnect", async (_req, res) => {
    generation++;
    connection = undefined;
    try { await credentials?.clear(); }
    catch { res.status(500).json({ error: "Disconnected for this session, but .env could not be updated. Remove ICLOUD_EMAIL and ICLOUD_APP_PASSWORD locally to prevent reconnection." }); return; }
    saved = false; restoreError = undefined;
    // Prevent a pending or later restore from undoing an explicit disconnect.
    restorePromise = Promise.resolve();
    res.json(status());
  });
  router.post("/events", async (req, res) => {
    await restore();
    const current = connection;
    const version = generation;
    if (!current) { res.status(401).json({ error: restoreError ?? "Connect iCloud in Sources. Successful sign-ins are saved for future restarts." }); return; }
    const ids: unknown = req.body?.calendarIds;
    if (!Array.isArray(ids) || ids.length > 30 || !ids.every(id => typeof id === "string" && /^[a-f0-9]{64}$/.test(id))) {
      res.status(400).json({ error: "Select up to 30 calendars from the connected account." }); return;
    }
    const summaryLimit = req.body?.summaryLimit ?? 5;
    if (!Number.isInteger(summaryLimit) || summaryLimit < 0 || summaryLimit > 20) {
      res.status(400).json({ error: "Choose between 0 and 20 calendar items to summarize." }); return;
    }
    try {
      const data = await current.upcoming(ids);
      if (generation !== version) { res.status(409).json({ error: "iCloud connection changed. Refresh the calendar." }); return; }
      if (summarize && summaryLimit > 0) {
        try { data.items = [...await summarize(data.items.slice(0, summaryLimit)), ...data.items.slice(summaryLimit)]; }
        catch { data.items = data.items.map((item, index) => index < summaryLimit ? { ...item, summaryUnavailable: "AI unavailable. Full notes are shown." } : item); }
      }
      if (generation !== version) { res.status(409).json({ error: "iCloud connection changed. Refresh the calendar." }); return; }
      res.json(data);
    } catch (error) {
      res.status(error instanceof ICloudError ? error.status : 502).json({ error: error instanceof ICloudError ? error.message : "Calendar unavailable. iCloud did not respond or supplied unsupported event data. Try again." });
    }
  });
  router.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Avoid Express's default error output, which can contain request details.
    res.status(400).json({ error: "The iCloud request could not be read." });
  });
  return router;
}
