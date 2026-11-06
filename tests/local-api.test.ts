import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { request as httpRequest } from "node:http";
import { createLocalApi } from "../server/local-api";

test("private deployment origin allows its own requests while rejecting other hosts and origins", async () => {
  const app = express();
  app.use(createLocalApi("http://briefreceipt.internal.example"));
  app.use((_req, res) => { res.json({ ok: true }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  // Native HTTP preserves Host; fetch implementations can silently replace it.
  const request = (headers: Record<string, string> = {}, method = "GET") => new Promise<{ status: number }>((resolve, reject) => {
    const req = httpRequest({ hostname: "127.0.0.1", port, method, headers }, res => {
      res.resume();
      res.once("end", () => resolve({ status: res.statusCode! }));
    });
    req.on("error", reject);
    req.end();
  });
  const deployed = { Host: "briefreceipt.internal.example" };
  try {
    assert.equal((await request(deployed)).status, 200);
    assert.equal((await request({ ...deployed, Origin: "http://briefreceipt.internal.example", "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" }, "POST")).status, 200);
    assert.equal((await request({ ...deployed, Origin: "https://foreign.example" })).status, 403);
    assert.equal((await request({ ...deployed, Origin: "https://briefreceipt.internal.example" })).status, 403);
    assert.equal((await request({ ...deployed, "Sec-Fetch-Site": "same-site" })).status, 403);
    assert.equal((await request({ Host: "briefreceipt.internal.example.foreign.example" })).status, 403);
    assert.equal((await request({ Host: "foreign.example", "X-Forwarded-Host": deployed.Host })).status, 403);
    assert.equal((await request(deployed, "POST")).status, 415);
    assert.equal((await request()).status, 200, "SSH/loopback administration remains available");
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("deployment origins reject URLs containing credentials or paths", () => {
  for (const origin of ["*", "file:///tmp/editor", "https://user:password@example.com", "https://example.com/editor", "https://example.com?key=value", "https://example.com/#fragment"]) {
    assert.throws(() => createLocalApi(origin));
  }
});
