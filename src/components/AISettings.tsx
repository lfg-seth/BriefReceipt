import { useEffect, useState } from "react";
import type { AIStatus } from "../types";
import { CALENDAR_DESCRIPTION_VERBATIM_LIMIT } from "../calendar-description";

async function request(path: string, body?: unknown): Promise<AIStatus> {
  const response = await fetch(`/api/ai/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "The OpenAI connection could not be checked.");
  return value;
}
export function AISettings({ onRefresh }: { onRefresh: () => void }) {
  const [status, setStatus] = useState<AIStatus>();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("status").then(value => { if (active) setStatus(value); }).catch(() => { if (active) setError("Could not check OpenAI. Restart the local server and try again."); });
    return () => { active = false; };
  }, []);
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    const apiKey = key;
    setKey(""); setBusy(true); setError("");
    try { setStatus(await request("connect", { apiKey })); onRefresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not connect OpenAI."); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setError("");
    try { setStatus(await request("disconnect", {})); onRefresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not disconnect OpenAI."); }
    finally { setBusy(false); }
  }
  return <div className="ai-settings">
    <p className="editor-subheading">OpenAI connection</p>
    <p className="editor-help">{status?.connected ? `OpenAI connected. Highlights use ${status.briefingModel || "gpt-6.1-sol"} with ${status.briefingReasoning || "medium"} reasoning. Calendar notes use ${status.model}; notes longer than ${CALENDAR_DESCRIPTION_VERBATIM_LIMIT} characters are condensed automatically.` : "Connect OpenAI for selective briefing highlights and condensed calendar notes. Full calendar notes appear whenever a summary is unavailable."}</p>
    <p className="editor-help">AI summary checks enabled modules other than News, using full calendar notes and source context sent to OpenAI. Each noteworthy module gets at most one sentence, separated by a blank line. It can research public market moves, weather and local events, with source links. News content and personal calendar notes, tasks and project details are excluded from web research. Quiet modules add nothing.</p>
    <form onSubmit={connect}>
      <label className="editor-field"><span>OpenAI API key</span><input aria-label="OpenAI API key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="sk-…" required maxLength={503} disabled={busy} /></label>
      <p className="editor-help">Use a dedicated project key with Responses access from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI API keys</a>. A small test request checks access before the key is saved in this project’s Git-ignored .env. It stays out of browser storage and settings exports.</p>
      <button className="editor-secondary-button" type="submit" disabled={busy || !key}>{busy ? "Checking OpenAI…" : status?.connected ? "Replace OpenAI key" : "Connect OpenAI"}</button>
    </form>
    {status?.connected && <button type="button" className="editor-secondary-button" onClick={disconnect} disabled={busy}>Disconnect OpenAI</button>}
    {status && <p className="editor-help">Monthly AI allowance: ${status.reservedUsd.toFixed(4)} reserved / ${status.monthlyLimitUsd} ({status.month}, UTC). Conservative reservations include failed requests. Cached summaries cost nothing to reuse. This local guard covers this app’s AI calls; other services and API usage are separate.</p>}
    {(error || status?.error) && <p role="alert" className="editor-notice">{error || status?.error}</p>}
  </div>;
}
