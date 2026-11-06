import { useEffect, useState } from "react";

async function request(action: string, body?: unknown): Promise<{ connected: boolean }> {
  const response = await fetch(`/api/guardian/${action}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Could not update Guardian.");
  return value;
}
export function GuardianSettings({ onConnected, onRefresh }: { onConnected: () => void; onRefresh: () => void }) {
  const [connected, setConnected] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("status").then(value => { if (active) setConnected(value.connected); }).catch(() => { if (active) setError("Could not check Guardian. Restart the local server and try again."); });
    return () => { active = false; };
  }, []);
  async function update(event?: React.FormEvent) {
    event?.preventDefault();
    const apiKey = key;
    setKey(""); setBusy(true); setError("");
    try {
      const status = await request(event ? "connect" : "disconnect", event ? { apiKey } : {});
      setConnected(status.connected);
      if (status.connected) onConnected();
      onRefresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update Guardian."); }
    finally { setBusy(false); }
  }
  return <div className="guardian-settings">
    <p className="editor-subheading">Guardian connection</p>
    <p className="editor-help">{connected ? "Guardian is connected. Original headlines are ready to load." : "Connect a free Guardian developer key for personal, noncommercial use."} Headlines stay out of AI requests.</p>
    <form onSubmit={update}>
      <label className="editor-field"><span>Guardian API key</span><input aria-label="Guardian API key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} maxLength={200} required disabled={busy} /></label>
      <p className="editor-help">Get your key from <a href="https://open-platform.theguardian.com/access/" target="_blank" rel="noreferrer">Guardian developer access</a>. A test checks access before saving it in this project’s Git-ignored .env. It stays out of browser storage and settings exports.</p>
      <button className="editor-secondary-button" type="submit" disabled={busy || !key}>{busy ? "Checking Guardian…" : connected ? "Replace Guardian key" : "Connect Guardian"}</button>
    </form>
    {connected && <button type="button" className="editor-secondary-button" disabled={busy} onClick={() => void update()}>Disconnect Guardian</button>}
    {error && <p role="alert" className="editor-notice">{error}</p>}
  </div>;
}
