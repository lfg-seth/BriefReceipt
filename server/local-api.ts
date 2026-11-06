import type { RequestHandler } from "express";

/** Local editor controls are never exposed through the phone upload listener. */
export const localApi: RequestHandler = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const host = req.get("host") ?? "";
  const origin = req.get("origin");
  const site = req.get("sec-fetch-site");
  if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host) ||
      (origin !== undefined && origin !== `http://${host}`) ||
      (site !== undefined && site !== "same-origin" && site !== "none")) {
    res.status(403).json({ error: "Open Receipt Summary directly on localhost to manage this connection." });
    return;
  }
  if (req.method === "POST" && !req.is("application/json")) {
    res.status(415).json({ error: "A JSON request is required." });
    return;
  }
  next();
};
