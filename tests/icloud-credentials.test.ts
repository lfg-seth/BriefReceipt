import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import express from "express";
import { DotEnvICloudCredentials } from "../server/icloud-credentials";
import { createICloudRouter } from "../server/icloud-routes";
import { ICloudConnection, ICloudError } from "../server/icloud";

const sample = { email: "example@icloud.com", password: "aaaa-bbbb-cccc-dddd" };
async function withEnv(work: (file: string) => Promise<void>) {
  const prefix = path.join(tmpdir(), "receipt-icloud-env-test-");
  const dir = await mkdtemp(prefix);
  try { await work(path.join(dir, ".env")); }
  finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(prefix)));
    await rm(dir, { recursive: true, force: true });
  }
}
async function serve(router: express.Router) {
  const app = express(); app.use("/api/icloud", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address === "object");
  return { root: `http://127.0.0.1:${address.port}/api/icloud`, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
const post = (root: string, endpoint: string, body: unknown = {}) => fetch(`${root}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function fakeConnection(discover = async () => ({ connected: true, calendars: [] })) {
  return { discover, status: () => ({ connected: true, calendars: [] }), upcoming: async () => ({ provenance: { mode: "live", source: "iCloud Calendar", retrievedAt: new Date().toISOString() }, items: [] }) } as unknown as ICloudConnection;
}

test(".env saves and replaces iCloud credentials while preserving unrelated settings and comments", async () => {
  await withEnv(async file => {
    const store = new DotEnvICloudCredentials(file);
    assert.equal(await store.load(), null);
    await writeFile(file, '# Local settings\r\nOTHER_SETTING="keep me"\r\nICLOUD_EMAIL="old@example.com"\r\nICLOUD_APP_PASSWORD="old\r\nmultiline value"\r\nAFTER=preserved\r\n');
    await store.save(sample);
    assert.deepEqual(await new DotEnvICloudCredentials(file).load(), sample);
    const content = await readFile(file, "utf8");
    assert.match(content, /^# Local settings\r\nOTHER_SETTING="keep me"\r\nAFTER=preserved\r\n/);
    assert.doesNotMatch(content, /old@example|multiline value/);
    assert.equal((content.match(/^ICLOUD_EMAIL=/gm) ?? []).length, 1);
    await store.clear();
    assert.equal(await store.load(), null);
    assert.equal(await readFile(file, "utf8"), '# Local settings\r\nOTHER_SETTING="keep me"\r\nAFTER=preserved\r\n');
  });
});

test("sign-in persists to .env, a fresh server restores once, and disconnect forgets credentials", async () => {
  await withEnv(async file => {
    const seen: { email: string; password: string }[] = [];
    const factory = (email: string, password: string) => { seen.push({ email, password }); return fakeConnection(); };
    const first = await serve(createICloudRouter(factory, new DotEnvICloudCredentials(file)));
    try {
      const response = await post(first.root, "connect", sample);
      assert.equal(response.status, 200);
      const status = await response.json();
      assert.equal(status.connected, true); assert.equal(status.saved, true);
      assert.doesNotMatch(JSON.stringify(status), /example@icloud|aaaa-bbbb|password/i);
    } finally { await first.close(); }
    assert.deepEqual(await new DotEnvICloudCredentials(file).load(), sample);
    const second = await serve(createICloudRouter(factory, new DotEnvICloudCredentials(file)));
    try {
      const [statusResponse, eventsResponse] = await Promise.all([fetch(`${second.root}/status`), post(second.root, "events", { calendarIds: [] })]);
      const status = await statusResponse.json();
      assert.equal(status.connected, true); assert.equal(status.saved, true);
      assert.equal(eventsResponse.status, 200);
      assert.deepEqual(seen, [sample, sample]);
      assert.equal((await post(second.root, "disconnect")).status, 200);
      assert.equal(await new DotEnvICloudCredentials(file).load(), null);
      assert.equal((await (await fetch(`${second.root}/status`)).json()).connected, false);
    } finally { await second.close(); }
    const third = await serve(createICloudRouter(factory, new DotEnvICloudCredentials(file)));
    try { assert.equal((await (await fetch(`${third.root}/status`)).json()).connected, false); assert.equal(seen.length, 2); }
    finally { await third.close(); }
  });
});

test("a failed restore retains saved credentials for retry and a rejected new password is never persisted", async () => {
  await withEnv(async file => {
    const store = new DotEnvICloudCredentials(file); await store.save(sample);
    let available = false;
    const factory = (_email: string, password: string) => fakeConnection(async () => {
      if (!available || password !== sample.password) throw new ICloudError("Apple rejected the sign-in.", 401);
      return { connected: true, calendars: [] };
    });
    const server = await serve(createICloudRouter(factory, store));
    try {
      const failed = await (await fetch(`${server.root}/status`)).json();
      assert.equal(failed.connected, false); assert.equal(failed.saved, true); assert.match(failed.error, /Apple rejected/);
      assert.deepEqual(await store.load(), sample);
      available = true;
      assert.equal((await (await post(server.root, "retry")).json()).connected, true);
      assert.equal((await post(server.root, "connect", { ...sample, password: "xxxx-yyyy-zzzz-aaaa" })).status, 401);
      assert.deepEqual(await store.load(), sample);
    } finally { await server.close(); }
  });
});
