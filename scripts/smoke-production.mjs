import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";

// Isolated state, no credentials and no provider requests, including on developer machines.
async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

const state = await mkdtemp(path.join(tmpdir(), "briefreceipt-smoke-"));
const port = await freePort();
let receiverPort = await freePort();
while (receiverPort === port) receiverPort = await freePort();
const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts", "--production"], {
  env: { ...process.env, PORT: String(port), REMINDERS_PORT: String(receiverPort), RECEIPT_DATA_DIR: state },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", chunk => { output += chunk; });
child.stderr.on("data", chunk => { output += chunk; });
const exited = once(child, "exit");
const base = `http://127.0.0.1:${port}`;
async function request(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(3000) });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Production server exited: ${output}`);
    try {
      const health = await request(`${base}/api/health`);
      assert.deepEqual(await health.json(), { ok: true, mode: "production" });
      const receiver = await request(`http://127.0.0.1:${receiverPort}/health`);
      assert.equal((await receiver.json()).ok, true);
      ready = true;
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, `Production server did not become ready: ${output}`);
  const page = await request(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  const asset = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(asset, "Built page must reference its JavaScript bundle");
  assert.equal((await request(`${base}${asset}`)).status, 200);
  assert.equal((await request(`${base}/api/unknown`)).status, 404);
  assert.equal((await request(`${base}/api/reminders/status`, { headers: { Origin: "https://example.com" } })).status, 403);
  const receiver = `http://127.0.0.1:${receiverPort}`;
  assert.equal((await request(`${receiver}/api/reminders/status`)).status, 404);
  assert.equal((await request(`${receiver}/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
  const pair = await request(`${base}/api/reminders/pair`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(pair.status, 200);
  assert.ok((await readdir(path.join(state, "reminders"))).includes("state.json"), "Pairing must persist in the external state directory");
  console.log("Production smoke passed: built assets, both listeners, access checks and external state persistence.");
} finally {
  if (child.exitCode === null) { child.kill("SIGTERM"); await exited; }
  await rm(state, { recursive: true, force: true });
}
