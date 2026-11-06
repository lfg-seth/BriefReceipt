import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { BriefingData, RemindersStatus, TaskItem } from "../src/types";
import { dayBounds, localDate } from "./icloud";

export const REMINDERS_MAX_AGE = 2 * 60 * 60 * 1000;
type Reminder = { title: string; list: string; due: string | null; completed: boolean };
type Snapshot = { version: 1; capturedAt: string; reminders: Reminder[] };
type State = { version: 1; tokenHash?: string; publicUrl?: string; receivedAt?: string; snapshot?: Snapshot };
export class RemindersError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
}
function dueDate(value: unknown): value is string | null {
  if (value === null || value === "") return true;
  if (timestamp(value)) return true;
  return typeof value === "string" && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function validateSnapshot(value: unknown, now = new Date()): Snapshot {
  if (!record(value) || value.version !== 1 || !timestamp(value.capturedAt) || !Array.isArray(value.reminders) || value.reminders.length > 2000) {
    throw new RemindersError("Send version 1, an ISO capturedAt timestamp, and a reminders array (up to 2000 items).");
  }
  if (Date.parse(value.capturedAt) > now.valueOf() + 120000) throw new RemindersError("The snapshot is dated in the future. Check the phone's clock.");
  const reminders = value.reminders.map(item => {
    if (!record(item) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 1000 || typeof item.list !== "string" || !item.list.trim() || item.list.length > 200 || !dueDate(item.due) || (item.completed !== undefined && typeof item.completed !== "boolean" && item.completed !== "true" && item.completed !== "false")) {
      throw new RemindersError('Each reminder needs title, list, and due (YYYY-MM-DD, an ISO timestamp, or an empty value). completed may be a boolean or the text "true" or "false".');
    }
    return { title: item.title.trim(), list: item.list.trim(), due: item.due || null, completed: item.completed === true || item.completed === "true" } as Reminder;
  });
  // Keep only the agreed fields, never arbitrary data or a submitted token.
  return { version: 1, capturedAt: new Date(value.capturedAt).toISOString(), reminders };
}
export class RemindersStore {
  private state: State = { version: 1 };
  private ready: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory: string, private now = () => new Date()) {
    this.ready = this.load();
    void this.ready.catch(() => {}); // The API reports load failures without crashing unrelated blocks.
  }
  private async load() {
    try {
      const raw: unknown = JSON.parse(await readFile(path.join(this.directory, "state.json"), "utf8"));
      if (!record(raw) || raw.version !== 1 || (raw.tokenHash !== undefined && (typeof raw.tokenHash !== "string" || !/^[a-f0-9]{64}$/.test(raw.tokenHash)))) throw new Error("Invalid state");
      this.state = { version: 1, tokenHash: raw.tokenHash as string | undefined };
      if (typeof raw.publicUrl === "string") this.state.publicUrl = validatePublicUrl(raw.publicUrl);
      if (raw.snapshot !== undefined) this.state.snapshot = validateSnapshot(raw.snapshot, this.now());
      if (timestamp(raw.receivedAt)) this.state.receivedAt = raw.receivedAt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new RemindersError("Saved Reminders data could not be read. The source is unavailable.", 503);
    }
  }
  private async mutate<T>(change: () => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => { await this.ready; return change(); });
    this.queue = task.catch(() => {});
    return task;
  }
  private async save(next: State) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temp = path.join(this.directory, `state-${randomBytes(8).toString("hex")}.tmp`);
    try {
      await writeFile(temp, JSON.stringify(next), { encoding: "utf8", mode: 0o600, flag: "wx" });
      await rename(temp, path.join(this.directory, "state.json"));
      this.state = next;
    } finally { await unlink(temp).catch(() => {}); }
  }
  private stale() {
    const snapshot = this.state.snapshot;
    return !snapshot || this.now().valueOf() - Date.parse(snapshot.capturedAt) > REMINDERS_MAX_AGE;
  }
  async status(): Promise<RemindersStatus> {
    await this.ready;
    return { paired: !!this.state.tokenHash, publicUrl: this.state.publicUrl ?? "", capturedAt: this.state.snapshot?.capturedAt, receivedAt: this.state.receivedAt, stale: this.stale(), maxAgeMinutes: REMINDERS_MAX_AGE / 60000,
      lists: [...new Set(this.state.snapshot?.reminders.map(r => r.list) ?? [])].sort(), count: this.state.snapshot?.reminders.length ?? 0 };
  }
  async pair() {
    return this.mutate(async () => {
      const token = randomBytes(32).toString("base64url");
      await this.save({ ...this.state, tokenHash: hash(token) });
      return { token, ...await this.status() };
    });
  }
  async setAddress(value: unknown) {
    const publicUrl = validatePublicUrl(value);
    return this.mutate(async () => { await this.save({ ...this.state, publicUrl }); return this.status(); });
  }
  async revoke() {
    return this.mutate(async () => { await this.save({ version: 1, publicUrl: this.state.publicUrl }); return this.status(); });
  }
  async authorized(authorization: string | undefined): Promise<boolean> {
    await this.ready;
    if (!this.state.tokenHash || !authorization || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) return false;
    return timingSafeEqual(Buffer.from(hash(authorization.slice(7)), "hex"), Buffer.from(this.state.tokenHash, "hex"));
  }
  async upload(authorization: string | undefined, input: unknown) {
    return this.mutate(async () => {
      // Authenticate again inside the queue so rotating/revoking wins over an in-flight upload.
      if (!await this.authorized(authorization)) throw new RemindersError("Invalid upload token.", 401);
      const snapshot = validateSnapshot(input, this.now());
      if (this.state.snapshot && snapshot.capturedAt < this.state.snapshot.capturedAt) throw new RemindersError("A newer snapshot is already stored.", 409);
      await this.save({ ...this.state, snapshot, receivedAt: this.now().toISOString() });
      return { ok: true, received: snapshot.reminders.length, capturedAt: snapshot.capturedAt };
    });
  }
  async tasks(lists: string[]): Promise<BriefingData["tasks"]> {
    await this.ready;
    const snapshot = this.state.snapshot;
    const unavailable = (note: string): BriefingData["tasks"] => ({ provenance: { mode: "unavailable", source: "Apple Reminders Shortcut", retrievedAt: this.now().toISOString(), observedAt: snapshot?.capturedAt, note }, items: [] });
    if (!this.state.tokenHash) return unavailable("Connect your Reminders Shortcut in Tasks settings.");
    if (!snapshot) return unavailable("Waiting for the first iPhone upload. Run your Shortcut, then choose its lists.");
    if (this.stale()) return unavailable("Reminders snapshot is over two hours old. Run your Shortcut to refresh it.");
    const { date } = dayBounds(this.now());
    // Advance calendar dates, rather than elapsed hours, across Pacific DST changes.
    const lastDay = new Date(`${date}T12:00:00Z`);
    lastDay.setUTCDate(lastDay.getUTCDate() + 4);
    const throughDate = lastDay.toISOString().slice(0, 10);
    const items: TaskItem[] = [];
    snapshot.reminders.forEach((item, index) => {
      if (!item.due || !lists.includes(item.list)) return;
      const day = item.due.length === 10 ? item.due : localDate(new Date(item.due));
      if (day > throughDate || (item.completed && day < date)) return;
      items.push({ id: hash(`${index}:${item.list}:${item.title}:${item.due}`), title: item.title, list: item.list, overdue: day < date, completed: item.completed, dueStatus: day < date ? "overdue" : day === date ? "today" : "upcoming", due: day });
    });
    items.sort((a, b) => a.due.localeCompare(b.due) || Number(!!a.completed) - Number(!!b.completed) || a.title.localeCompare(b.title));
    return { provenance: { mode: "live", source: "Apple Reminders Shortcut", retrievedAt: this.state.receivedAt!, observedAt: snapshot.capturedAt, note: `Snapshot; ${date} · America/Los_Angeles. Overdue incomplete reminders and all items due ${date} through ${throughDate} (today + four days), including checked-off items.` }, items, capturedAt: snapshot.capturedAt };
  }
}
export function validatePublicUrl(value: unknown): string {
  if (typeof value !== "string") throw new RemindersError("Enter the private HTTPS address printed by Tailscale Serve.");
  let url: URL;
  try { url = new URL(value); } catch { throw new RemindersError("Enter a valid Tailscale HTTPS address."); }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/.test(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new RemindersError("Use a private https://device.tailnet.ts.net address, with its optional port and no path.");
  }
  return url.origin;
}
