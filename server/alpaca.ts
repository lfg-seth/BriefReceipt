import { createHash } from "node:crypto";
import type { BriefingData, MarketItem, MarketPoint, MarketStatus } from "../src/types";
import { envValues, updateEnv } from "./env-file";

const ENV_NAMES = ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY"];
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
const validCredential = (value: string) => /^[A-Za-z0-9_-]{8,200}$/.test(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
export class AlpacaError extends Error {}
type Credentials = { key: string; secret: string };
type Session = { date: string; open: number; close: number; extendedOpen: number; extendedClose: number };
type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
const excludedIndices = ["DJI", "SPX"];

export function marketSymbols(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(s => typeof s !== "string" || !/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(s)))
    throw new AlpacaError("Enter up to 20 stock symbols, using letters, numbers, dots or hyphens.");
  return [...new Set(value)].filter(symbol => !excludedIndices.includes(symbol));
}

// Calendar times are exchange-local (New York), including early closes and DST.
export function exchangeTime(date: string, time: string): number {
  const target = Date.parse(`${date}T${time.slice(0, 5)}:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time) || !Number.isFinite(target)) throw new AlpacaError("Alpaca returned an unreadable trading calendar.");
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  let result = target;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map(part => [part.type, part.value]));
    const local = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    result += target - local;
  }
  return result;
}

function unavailableItem(symbol: string, note: string, kind: "stock" | "index" = "stock", name = symbol): MarketItem {
  return { symbol, name, kind, value: null, change: null, session: "", asOf: "", freshness: "Unavailable", unavailable: note };
}

export class AlpacaMarkets {
  private queue: Promise<unknown> = Promise.resolve();
  private cache?: { key: string; expires: number; data: BriefingData["markets"] };
  constructor(private envFile: string, private fetcher: typeof fetch = fetch, private now = () => new Date()) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(work);
    this.queue = pending.catch(() => {});
    return pending;
  }
  private async credentials(): Promise<Credentials> {
    const env = await envValues(this.envFile);
    return { key: env.ALPACA_API_KEY_ID?.trim() ?? "", secret: env.ALPACA_API_SECRET_KEY?.trim() ?? "" };
  }
  async status() {
    const { key, secret } = await this.credentials();
    return { connected: validCredential(key) && validCredential(secret), feed: "iex" };
  }
  private async request(credentials: Credentials, endpoint: "calendar" | "bars", params: Record<string, string>, signal: AbortSignal) {
    const url = new URL(endpoint === "calendar" ? "https://paper-api.alpaca.markets/v2/calendar" : "https://data.alpaca.markets/v2/stocks/bars");
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    let response: Response;
    try {
      response = await this.fetcher(url, { method: "GET", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), headers: {
        Accept: "application/json", "APCA-API-KEY-ID": credentials.key, "APCA-API-SECRET-KEY": credentials.secret,
      } });
    } catch { throw new AlpacaError("Alpaca could not be reached or timed out. Refresh markets to retry."); }
    if (!response.ok) throw new AlpacaError(response.status === 401 || response.status === 403
      ? "Alpaca rejected the credentials or IEX access. Use your Paper Trading key ID and secret."
      : response.status === 429 ? "Alpaca's request limit was reached. Try later." : "Alpaca is temporarily unavailable. Try later.");
    const reader = response.body?.getReader();
    if (!reader) throw new AlpacaError("Alpaca returned an empty response.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 3_000_000) { await reader.cancel(); throw new Error(); }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch { throw new AlpacaError("Alpaca returned an unreadable or oversized response."); }
    finally { reader.releaseLock(); }
  }
  private async calendar(credentials: Credentials, now: Date, signal: AbortSignal): Promise<Session[]> {
    const raw = await this.request(credentials, "calendar", { start: day.format(new Date(now.valueOf() - 45 * 86_400_000)), end: day.format(now) }, signal);
    if (!Array.isArray(raw) || raw.length > 46 || raw.length < 6) throw new AlpacaError("Alpaca returned an incomplete trading calendar.");
    const sessions = raw.map((entry: any) => {
      if (typeof entry?.date !== "string" || typeof entry.open !== "string" || typeof entry.close !== "string") throw new AlpacaError("Alpaca returned an unreadable trading calendar.");
      const open = exchangeTime(entry.date, entry.open), close = exchangeTime(entry.date, entry.close);
      const extendedTime = (value: unknown, fallback: string) => {
        if (value == null) return exchangeTime(entry.date, fallback);
        if (typeof value !== "string") throw new AlpacaError("Alpaca returned unreadable extended trading hours.");
        return exchangeTime(entry.date, value.replace(/^(\d{2})(\d{2})$/, "$1:$2"));
      };
      return { date: entry.date, open, close, extendedOpen: extendedTime(entry.session_open, "04:00"),
        // On early-close days, require the provider's extended close instead of assuming 20:00.
        extendedClose: extendedTime(entry.session_close, entry.close === "16:00" || entry.close === "16:00:00" ? "20:00" : entry.close) };
    }).sort((a, b) => a.open - b.open);
    if (sessions.some((s, i) => s.extendedOpen > s.open || s.open >= s.close || s.close > s.extendedClose || s.date > day.format(now) || (i > 0 && s.date === sessions[i - 1].date))) throw new AlpacaError("Alpaca returned an unreadable trading calendar.");
    return sessions;
  }
  private async bars(credentials: Credentials, symbols: string[], timeframe: string, start: number, now: Date, signal: AbortSignal): Promise<Record<string, Bar[]>> {
    const result: Record<string, Bar[]> = Object.fromEntries(symbols.map(symbol => [symbol, []]));
    let token = "";
    const seen = new Set<string>();
    for (let page = 0; page < 8; page++) {
      const raw = await this.request(credentials, "bars", { symbols: symbols.join(","), timeframe, start: new Date(start).toISOString(), end: now.toISOString(), feed: "iex", adjustment: "split", sort: "asc", limit: "10000", ...(token ? { page_token: token } : {}) }, signal);
      if (!raw?.bars || typeof raw.bars !== "object" || Array.isArray(raw.bars)) throw new AlpacaError("Alpaca returned unreadable price history.");
      for (const symbol of symbols) {
        const entries = raw.bars[symbol] ?? [];
        if (!Array.isArray(entries)) throw new AlpacaError("Alpaca returned unreadable price history.");
        for (const bar of entries) {
          if (!bar || typeof bar.t !== "string" || !Number.isFinite(Date.parse(bar.t)) || Date.parse(bar.t) > now.valueOf() || ![bar.o, bar.h, bar.l, bar.c].every(positive) || typeof bar.v !== "number" || !Number.isFinite(bar.v) || bar.v < 0) throw new AlpacaError("Alpaca returned unreadable price history.");
          result[symbol].push({ t: bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v });
        }
      }
      if (!raw.next_page_token) {
        for (const symbol of symbols) result[symbol] = [...new Map(result[symbol].map(bar => [bar.t, bar])).values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
        return result;
      }
      if (typeof raw.next_page_token !== "string" || raw.next_page_token.length > 2000 || seen.has(raw.next_page_token)) break;
      token = raw.next_page_token; seen.add(token);
    }
    throw new AlpacaError("Alpaca price history was incomplete. Try fewer tracked stocks.");
  }
  connect(key: string, secret: string) {
    return this.serial(async () => {
      if (!validCredential(key) || !validCredential(secret)) throw new AlpacaError("Enter your Alpaca Paper Trading API key ID and secret key.");
      const credentials = { key, secret }, now = this.now(), signal = AbortSignal.timeout(25000);
      const sessions = await this.calendar(credentials, now, signal);
      const data = await this.bars(credentials, ["TSLA"], "1Day", sessions.at(-6)!.open - 12 * 3_600_000, now, signal);
      if (!data.TSLA.length) throw new AlpacaError("Alpaca accepted the request but returned no test price history. Check IEX data access.");
      await updateEnv(this.envFile, ENV_NAMES, { ALPACA_API_KEY_ID: key, ALPACA_API_SECRET_KEY: secret });
      this.cache = undefined;
      return { connected: true, feed: "iex" };
    });
  }
  disconnect() {
    return this.serial(async () => {
      await updateEnv(this.envFile, ENV_NAMES);
      this.cache = undefined;
      return { connected: false, feed: "iex" };
    });
  }
  collect(input: unknown, offline = false): Promise<BriefingData["markets"]> {
    const symbols = marketSymbols(input);
    return this.serial(async () => {
      const now = this.now();
      let marketStatus: MarketStatus | undefined;
      const unavailable = (note: string): BriefingData["markets"] => ({ provenance: { mode: "unavailable", source: "Alpaca · IEX", retrievedAt: now.toISOString(), note }, items: [], ...(marketStatus ? { marketStatus } : {}) });
      try {
        if (offline) return unavailable("Offline test mode is enabled.");
        const credentials = await this.credentials();
        if (!validCredential(credentials.key) || !validCredential(credentials.secret)) return unavailable("Connect your Alpaca Paper Trading key ID and secret in Markets or Sources → Markets.");
        const fingerprint = createHash("sha256").update(JSON.stringify([credentials, symbols])).digest("hex");
        if (this.cache?.key === fingerprint && this.cache.expires > now.valueOf()) return this.cache.data;
        const signal = AbortSignal.timeout(25000);
        const sessions = await this.calendar(credentials, now, signal);
        const tradingDay = sessions.find(session => session.date === day.format(now));
        marketStatus = !tradingDay || now.valueOf() < tradingDay.extendedOpen || now.valueOf() >= tradingDay.extendedClose ? "Closed"
          : now.valueOf() < tradingDay.open ? "Pre-market" : now.valueOf() < tradingDay.close ? "Open" : "After-hours";
        const current = sessions.find(session => now.valueOf() >= session.open && now.valueOf() < session.close);
        const target = current ?? sessions.filter(session => session.close <= now.valueOf()).at(-1);
        if (!target) throw new AlpacaError("The latest trading session could not be determined.");
        const targetIndex = sessions.indexOf(target), previous = sessions[targetIndex - 1];
        const weekSessions = sessions.slice(Math.max(0, targetIndex - 4), targetIndex + 1);
        const baseline = sessions[targetIndex - 5];
        const daily = symbols.length ? await this.bars(credentials, symbols, "1Day", sessions[Math.max(0, sessions.length - 15)].open - 12 * 3_600_000, now, signal) : {};
        const history = symbols.length ? await this.bars(credentials, symbols, "5Min", weekSessions[0].open, now, signal) : {};
        const items = symbols.map((symbol): MarketItem => {
          const closes = new Map(daily[symbol].map(bar => [day.format(new Date(bar.t)), bar]));
          const regular = history[symbol].filter(bar => weekSessions.some(s => Date.parse(bar.t) >= s.open && Date.parse(bar.t) < s.close));
          const today = regular.filter(bar => Date.parse(bar.t) >= target.open && Date.parse(bar.t) < target.close);
          const latest = today.at(-1);
          const close = closes.get(target.date), prior = previous && closes.get(previous.date);
          const value = current ? latest?.c : close?.c;
          if (!value || (current && (!latest || now.valueOf() - Date.parse(latest.t) > 15 * 60_000)))
            return unavailableItem(symbol, current ? "Current regular-session IEX data is unavailable or more than 15 minutes old." : "No IEX close is available for the latest completed session. This symbol may be unsupported.");
          const week = new Map<number, MarketPoint>();
          for (const bar of regular) week.set(Math.floor(Date.parse(bar.t) / 1_800_000), { at: bar.t, value: bar.c });
          const base = baseline && closes.get(baseline.date)?.c;
          return { symbol, name: symbol, kind: "stock", value, change: prior ? (value / prior.c - 1) * 100 : null,
            session: `${target.date} ${current ? "regular session" : "regular close · market closed"}`,
            asOf: current ? latest!.t : new Date(target.close).toISOString(), freshness: "IEX only · limited market coverage",
            dayHistory: today.map(bar => ({ at: bar.t, value: bar.c })), weekHistory: [...week.values()],
            weekChange: base ? (value / base - 1) * 100 : null,
            dayHigh: current && today.length ? Math.max(...today.map(bar => bar.h)) : close?.h,
            dayLow: current && today.length ? Math.min(...today.map(bar => bar.l)) : close?.l,
            volume: current ? today.reduce((sum, bar) => sum + bar.v, 0) : close?.v,
          };
        });
        const data: BriefingData["markets"] = { marketStatus, provenance: { mode: "live", source: "Alpaca · IEX", retrievedAt: this.now().toISOString(), url: "https://alpaca.markets/", note: "Free IEX stock data only, not consolidated market prices or volume. Regular-session history is split-adjusted. 1D uses five-minute prices; 1W uses thirty-minute samples across five trading sessions." }, items };
        // Never cache across an opening/closing boundary; retain original retrieval/as-of times.
        const boundary = sessions.flatMap(session => [session.extendedOpen, session.open, session.close, session.extendedClose]).find(time => time > now.valueOf()) ?? Infinity;
        const freshnessDeadline = current ? Math.min(...items.filter(item => item.value != null).map(item => Date.parse(item.asOf) + 15 * 60_000)) : Infinity;
        this.cache = { key: fingerprint, expires: Math.min(now.valueOf() + 60_000, boundary, freshnessDeadline), data };
        return data;
      } catch (error) {
        this.cache = undefined;
        return unavailable(error instanceof AlpacaError ? error.message : "Could not load Alpaca markets. Check the local connection and try again.");
      }
    });
  }
}
