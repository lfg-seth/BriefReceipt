import type { RequestHandler } from "express";

/** An explicit private editor origin can be enabled behind a loopback proxy. */
export function createLocalApi(configuredOrigin = process.env.RECEIPT_ORIGIN): RequestHandler {
  let deployed: URL | undefined;
  if (configuredOrigin) {
    deployed = new URL(configuredOrigin);
    if (!["http:", "https:"].includes(deployed.protocol) || deployed.username || deployed.password ||
        deployed.pathname !== "/" || deployed.search || deployed.hash) {
      throw new Error("RECEIPT_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment.");
    }
  }
  return (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const host = req.get("host") ?? "";
    const origin = req.get("origin");
    const site = req.get("sec-fetch-site");
    const expectedOrigin = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)
      ? new URL(`http://${host}`).origin
      : deployed && host === deployed.host ? deployed.origin : undefined;
    if (!expectedOrigin ||
        (origin !== undefined && origin !== expectedOrigin) ||
        (site !== undefined && site !== "same-origin" && site !== "none")) {
      res.status(403).json({ error: "Open BriefReceipt at its configured editor address to manage this connection." });
      return;
    }
    if (req.method === "POST" && !req.is("application/json")) {
      res.status(415).json({ error: "A JSON request is required." });
      return;
    }
    next();
  };
}

/** Editor controls are never exposed through the phone upload listener. */
export const localApi = createLocalApi();
