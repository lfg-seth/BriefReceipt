import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import express from "express";
import { RemindersStore, validateSnapshot, validatePublicUrl } from "../server/reminders";
import { remindersAdmin, remindersReceiver } from "../server/reminders-routes";
import { defaultConfig, normalizeConfig } from "../src/config";

const initialNow = "2026-11-05T18:00:00Z";
const snapshot = (reminders: unknown[] = []) => ({ version: 1, capturedAt: initialNow, reminders });
const due = (title: string, date: string | null, list = "Home", completed = false) => ({ title, list, due: date, completed });
async function withStore(work: (store: RemindersStore, dir: string, advance: (date: string) => void) => Promise<void>) {
  const prefix = path.join(tmpdir(), "receipt-reminders-test-");
  const dir = await mkdtemp(prefix);
  let now = new Date(initialNow);
  try { await work(new RemindersStore(dir, () => now), dir, date => { now = new Date(date); }); }
  finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(prefix)));
    await rm(dir, { recursive: true, force: true });
  }
}
test("Reminders snapshots validate every item before replacement and accept honest empty lists", () => {
  assert.deepEqual(validateSnapshot(snapshot(), new Date(initialNow)).reminders, []);
  for (const input of [null, {}, { ...snapshot(), version: 2 }, { ...snapshot(), capturedAt: "2026-11-05" }, snapshot([due("", "2026-11-05")]), snapshot([due("Bad date", "2026-02-30")]), snapshot([due("Bad date", "2026-99-99")]), snapshot([due("Bad type", 123 as any)]), snapshot(new Array(2001).fill(due("Too many", null))), { ...snapshot(), capturedAt: "2026-11-06T18:00:00Z" }]) {
    assert.throws(() => validateSnapshot(input, new Date(initialNow)));
  }
  const safe = validateSnapshot({ ...snapshot([{ ...due(" No notes ", ""), notes: "PRIVATE", token: "PRIVATE" }]), extra: "PRIVATE" }, new Date(initialNow));
  assert.equal(safe.reminders[0].title, "No notes");
  assert.equal(safe.reminders[0].due, null);
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE/);
  const completion = validateSnapshot(snapshot([
    { ...due("Checked", "2026-11-05"), completed: "true" },
    { ...due("Not checked", "2026-11-05"), completed: "false" },
    { title: "Older Shortcut", list: "Home", due: "2026-11-05" },
  ]), new Date(initialNow));
  assert.deepEqual(completion.reminders.map(item => item.completed), [true, false, false]);
  for (const completed of ["yes", "no", "TRUE", 1, null]) assert.throws(() => validateSnapshot(snapshot([{ ...due("Invalid flag", "2026-11-05"), completed }]), new Date(initialNow)));
});

test("scoped read-only snapshots persist without raw tokens; due-day filtering respects Pacific time", async () => {
  await withStore(async (store, dir, advance) => {
    assert.equal((await store.tasks(["Home"])).provenance.mode, "unavailable");
    const { token } = await store.pair();
    assert.equal((await store.tasks(["Home"])).provenance.mode, "unavailable");
    const authorization = `Bearer ${token}`;
    await store.upload(authorization, snapshot([
      due("Today", "2026-11-05"), due("Overdue", "2026-11-04"), due("Tomorrow", "2026-11-06"),
      due("Completed", "2026-11-05", "Home", true), due("Completed overdue", "2026-11-04", "Home", true), due("Undated", null), due("Other list", "2026-11-05", "Work"),
      due("UTC next day but Pacific today", "2026-11-06T02:00:00Z"),
    ]));
    const tasks = await store.tasks(["Home"]);
    assert.equal(tasks.provenance.mode, "live");
    assert.deepEqual(tasks.items.map(i => i.title), ["Overdue", "Today", "UTC next day but Pacific today", "Completed", "Tomorrow"]);
    assert.equal(tasks.items[0].overdue, true);
    assert.equal(tasks.items[1].overdue, false);
    assert.deepEqual(tasks.items.map(i => i.dueStatus), ["overdue", "today", "today", "today", "upcoming"]);
    assert.deepEqual(tasks.items.map(i => i.completed), [false, false, false, true, false]);
    assert.deepEqual((await store.tasks([])).items, []);
    assert.deepEqual((await store.status()).lists, ["Home", "Work"]);
    const file = await readFile(path.join(dir, "state.json"), "utf8");
    assert.ok(!file.includes(token));
    assert.match(file, /tokenHash/);
    const reloaded = new RemindersStore(dir, () => new Date(initialNow));
    assert.equal(await reloaded.authorized(authorization), true);
    assert.equal((await reloaded.tasks(["Home"])).items.length, 5);
    advance("2026-11-05T20:00:01Z");
    const stale = await store.tasks(["Home"]);
    assert.equal(stale.provenance.mode, "unavailable");
    assert.deepEqual(stale.items, []);
    assert.equal(stale.provenance.observedAt, new Date(initialNow).toISOString());
  });
});

test("Reminders include the full fourth future Pacific day and exclude the fifth across DST and year changes", async () => {
  await withStore(async (store, _dir, advance) => {
    const { token } = await store.pair();
    for (const window of [
      { now: "2026-10-30T18:00:00Z", today: "2026-10-30", fourth: "2026-11-03", fifth: "2026-11-04", lastMinute: "2026-11-04T07:59:59Z", midnight: "2026-11-04T08:00:00Z" },
      { now: "2026-12-30T18:00:00Z", today: "2026-12-30", fourth: "2027-01-03", fifth: "2027-01-04", lastMinute: "2027-01-04T07:59:59Z", midnight: "2027-01-04T08:00:00Z" },
    ]) {
      advance(window.now);
      await store.upload(`Bearer ${token}`, { version: 1, capturedAt: window.now, reminders: [
        due("Old overdue", "2026-01-01"), due("Today", window.today), due("Fourth day", window.fourth),
        due("Fourth day late", window.lastMinute), due("Fifth day", window.fifth), due("Fifth day midnight", window.midnight),
        due("Completed future", window.fourth, "Home", true), due("Completed beyond window", window.fifth, "Home", true), due("Undated", null), due("Other list", window.fourth, "Work"),
      ] });
      const tasks = await store.tasks(["Home"]);
      assert.deepEqual(tasks.items.map(i => i.title), ["Old overdue", "Today", "Fourth day", "Fourth day late", "Completed future"]);
      assert.deepEqual(tasks.items.map(i => i.dueStatus), ["overdue", "today", "upcoming", "upcoming", "upcoming"]);
      assert.equal(tasks.items.at(-1)?.completed, true);
      assert.equal(tasks.items.at(-1)?.due, window.fourth);
    }
  });
});

test("invalid, unauthorized and older uploads preserve the last good snapshot; rotation revokes previous tokens", async () => {
  await withStore(async store => {
    const { token } = await store.pair();
    await store.upload(`Bearer ${token}`, snapshot([due("Keep", "2026-11-05")]));
    await assert.rejects(store.upload("Bearer wrong", snapshot()), /Invalid upload token/);
    await assert.rejects(store.upload(`Bearer ${token}`, snapshot([due("Invalid", "broken")])), /Each reminder/);
    await assert.rejects(store.upload(`Bearer ${token}`, { ...snapshot(), capturedAt: "2026-11-05T17:59:59Z" }), /newer snapshot/);
    assert.equal((await store.tasks(["Home"])).items[0].title, "Keep");
    const replacement = await store.pair();
    assert.notEqual(replacement.token, token);
    assert.equal(await store.authorized(`Bearer ${token}`), false);
    await store.upload(`Bearer ${replacement.token}`, snapshot());
    assert.equal((await store.tasks(["Home"])).provenance.mode, "live");
    assert.deepEqual((await store.tasks(["Home"])).items, []);
    await store.revoke();
    assert.equal(await store.authorized(`Bearer ${replacement.token}`), false);
    assert.equal((await store.status()).capturedAt, undefined);
    assert.equal((await store.status()).paired, false);
  });
});

test("phone address must be private Tailscale HTTPS and never contains a token", () => {
  assert.equal(validatePublicUrl("https://device.tailabc.ts.net:8443/"), "https://device.tailabc.ts.net:8443");
  for (const url of ["http://device.tailabc.ts.net/", "https://example.com", "https://device.tailabc.ts.net.evil.test", "https://device.tailabc.ts.net/?token=abc", "https://device.tailabc.ts.net/#token=abc", "https://secret@device.tailabc.ts.net/", "https://device.tailabc.ts.net/upload"]) assert.throws(() => validatePublicUrl(url));
});

test("phone receiver exposes upload only; editor pairing and read controls stay local", async () => {
  await withStore(async store => {
    const setupHtml = await readFile(path.resolve("server/reminders-setup.html"), "utf8");
    const admin = express(); admin.use("/api/reminders", remindersAdmin(store, setupHtml));
    const phone = remindersReceiver(store, setupHtml);
    const adminServer = admin.listen(0, "127.0.0.1"), phoneServer = phone.listen(0, "127.0.0.1");
    await Promise.all([once(adminServer, "listening"), once(phoneServer, "listening")]);
    const adminAddress = adminServer.address(), phoneAddress = phoneServer.address();
    assert.ok(adminAddress && typeof adminAddress === "object"); assert.ok(phoneAddress && typeof phoneAddress === "object");
    const a = `http://127.0.0.1:${adminAddress.port}/api/reminders`, p = `http://127.0.0.1:${phoneAddress.port}`;
    const post = (url: string, body: unknown, extra = {}) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
    try {
      assert.equal((await post(`${a}/pair`, {}, { Origin: "https://evil.test" })).status, 403);
      const pair = await post(`${a}/pair`, {});
      assert.equal(pair.status, 200);
      const { token } = await pair.json();
      const localGuide = await fetch(`${a}/guide`);
      assert.equal(localGuide.status, 200);
      assert.match(await localGuide.text(), /Send Reminders to Receipt/);
      for (const route of ["/api/reminders/status", "/api/reminders/pair", "/api/icloud/status", "/tasks", "/status"]) assert.equal((await fetch(p + route)).status, 404);
      assert.equal((await post(`${p}/upload`, snapshot())).status, 401);
      const response = await post(`${p}/upload`, snapshot([due("PRIVATE TITLE", "2026-11-05")]), { Authorization: `Bearer ${token}` });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.doesNotMatch(await response.text(), /PRIVATE TITLE/);
      const read = await post(`${a}/tasks`, { lists: ["Home"] });
      assert.equal((await read.json()).items[0].title, "PRIVATE TITLE");
      assert.ok(!(await (await fetch(`${a}/status`)).text()).includes(token));
      const page = await fetch(p);
      assert.match(page.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
      const html = await page.text();
      assert.ok(!html.includes(token)); assert.ok(!html.includes("PRIVATE TITLE"));
      // The revised phone recipe serializes each Dictionary inside Repeat, combines
      // those JSON texts with commas, then places them inside an outer Text template.
      // Exercise actual uploaded bytes for empty/single/multiple lists and escaping.
      for (const reminders of [[], [due('A "quoted" reminder', "2026-11-05")], [due("Line one\nLine two", "2026-11-05"), due("Braces { } and café 🛒", "2026-11-05")]]) {
        const combinedText = reminders.map(item => JSON.stringify(item)).join(",");
        const body = `{\n"version": 1,\n"capturedAt": "${initialNow}",\n"reminders": [${combinedText}]\n}`;
        const uploaded = await fetch(`${p}/upload`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body });
        assert.equal(uploaded.status, 200);
        assert.equal((await uploaded.json()).received, reminders.length);
        assert.deepEqual((await store.tasks(["Home"])).items.map(item => item.title).sort(), reminders.map(item => item.title).sort());
      }
      const malformed = await fetch(`${p}/upload`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: '{"title":"PRIVATE TITLE"' });
      assert.equal(malformed.status, 400); assert.doesNotMatch(await malformed.text(), /PRIVATE TITLE/);
    } finally {
      adminServer.closeAllConnections(); phoneServer.closeAllConnections();
      await Promise.all([new Promise<void>(resolve => adminServer.close(() => resolve())), new Promise<void>(resolve => phoneServer.close(() => resolve()))]);
    }
  });
});

test("old settings gain a sample task mode without inheriting token fields", () => {
  const raw = structuredClone(defaultConfig) as any;
  delete raw.sources.tasksMode; delete raw.sources.reminderLists;
  raw.sources.uploadToken = "PRIVATE_TOKEN";
  const normalized = normalizeConfig(raw);
  assert.equal(normalized.sources.tasksMode, "sample");
  assert.deepEqual(normalized.sources.reminderLists, []);
  assert.doesNotMatch(JSON.stringify(normalized), /PRIVATE_TOKEN|uploadToken/);
});
