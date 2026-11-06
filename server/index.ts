import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getWeather } from "./adapters";
import { createICloudRouter } from "./icloud-routes";
import { DotEnvICloudCredentials } from "./icloud-credentials";
import { readFile } from "node:fs/promises";
import { RemindersStore } from "./reminders";
import { remindersAdmin, remindersReceiver } from "./reminders-routes";
import { CalendarAI } from "./calendar-ai";
import { createAIRouter } from "./ai-routes";
import { GuardianNews } from "./guardian";
import { createGuardianRouter } from "./guardian-routes";
import { localApi } from "./local-api";
import { AlpacaMarkets } from "./alpaca";
import { createAlpacaRouter } from "./alpaca-routes";
import { runtimePaths } from "./runtime-paths";

const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = runtimePaths(root);
const ai = new CalendarAI(files.credentials, files.ai);
const guardian = new GuardianNews(files.credentials);
const markets = new AlpacaMarkets(files.credentials);
const reminders = new RemindersStore(files.reminders);
const phoneSetup = await readFile(path.join(root, "server", "reminders-setup.html"), "utf8");
const production = process.argv.includes("--production");
const cache = new Map<string, { expires: number; data: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();
async function cached(key: string, collect: () => Promise<unknown>) {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = collect()
    .then((data) => {
      cache.set(key, { expires: Date.now() + 600_000, data });
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
app.disable("x-powered-by");
app.use("/api/ai", createAIRouter(ai));
app.use("/api/guardian", createGuardianRouter(guardian));
app.use("/api/alpaca", createAlpacaRouter(markets));
app.use("/api/icloud", createICloudRouter(undefined, new DotEnvICloudCredentials(files.credentials), items => ai.summarize(items)));
app.use("/api/reminders", remindersAdmin(reminders, phoneSetup));
app.get("/api/weather", async (req, res) => {
  const zip =
    typeof req.query.zip === "string"
      ? req.query.zip.trim().slice(0, 10)
      : "89147";
  const offline = req.query.offline === "1";
  // Unsupported ZIPs are cheap, uncached sample responses; bound the public cache to supported sources.
  const data =
    zip === "89147" && !offline
      ? await cached("weather:89147", () => getWeather(zip))
      : await getWeather(zip, fetch, offline);
  res.set("Cache-Control", "no-store").json(data);
});
app.get("/api/news", localApi, async (req, res) => {
  const data = await guardian.collect(req.query.offline === "1");
  res.set("Cache-Control", "no-store").json(data);
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: production ? "production" : "development" });
});
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Unknown adapter endpoint" });
});
if (production) {
  app.use(express.static(path.join(root, "dist")));
  app.use((_req, res) => {
    res.sendFile(path.join(root, "dist/index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT ?? 5173);
app.listen(port, "127.0.0.1", () => {
  console.log(
    `Receipt Summary is ready at http://localhost:${port} (${production ? "production" : "development"})`,
  );
}).on("error", error => { console.error(`Could not start Receipt Summary: ${(error as NodeJS.ErrnoException).code ?? "listen failed"}`); process.exit(1); });
const receiverPort = Number(process.env.REMINDERS_PORT ?? 5180);
remindersReceiver(reminders, phoneSetup).listen(receiverPort, "127.0.0.1", () => {
  console.log(`Reminders upload receiver is ready on local port ${receiverPort}`);
}).on("error", error => { console.error(`Could not start Reminders receiver: ${(error as NodeJS.ErrnoException).code ?? "listen failed"}`); process.exit(1); });
