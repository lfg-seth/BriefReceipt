import { useEffect, useState } from "react";

async function request(action: string, body?: unknown): Promise<{ connected: boolean }> {
  const response = await fetch(`/api/alpaca/${action}`, {
    method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Could not update Alpaca.");
  return value;
}

export function AlpacaSettings({ onConnected, onRefresh }: { onConnected: () => void; onRefresh: () => void }) {
  const [connected, setConnected] = useState(false);
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("status").then(value => { if (active) setConnected(value.connected); }).catch(() => { if (active) setError("Could not check Alpaca. Restart the local server and try again."); });
    return () => { active = false; };
  }, []);
  async function update(event?: React.FormEvent) {
    event?.preventDefault();
    const apiKey = key, secretKey = secret;
    setKey(""); setSecret(""); setBusy(true); setError("");
    try {
      const status = await request(event ? "connect" : "disconnect", event ? { apiKey, secretKey } : {});
      setConnected(status.connected);
      if (status.connected) onConnected();
      onRefresh();
    } catch (error) { setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Alpaca timed out. Try connecting again."); }
    finally { setBusy(false); }
  }
  return <div className="alpaca-settings">
    <p className="editor-subheading">Alpaca connection</p>
    <p className="editor-help">{connected ? "Alpaca is connected. Free IEX stock prices and chart history are ready to load." : "Connect your Paper Trading API credentials using the free Basic data plan."}</p>
    <form onSubmit={update}>
      <label className="editor-field"><span>Alpaca API key ID</span><input aria-label="Alpaca API key ID" type="password" autoComplete="off" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} maxLength={200} required disabled={busy} /></label>
      <label className="editor-field"><span>Alpaca secret key</span><input aria-label="Alpaca secret key" type="password" autoComplete="off" spellCheck={false} value={secret} onChange={event => setSecret(event.target.value)} maxLength={200} required disabled={busy} /></label>
      <p className="editor-help">Use the keys from your <a href="https://app.alpaca.markets/" target="_blank" rel="noreferrer">Alpaca Paper Trading dashboard</a>. Access is checked before both keys are saved locally. They stay out of browser storage and settings exports.</p>
      <button className="editor-secondary-button" type="submit" disabled={busy || !key || !secret}>{busy ? "Checking Alpaca…" : connected ? "Replace Alpaca keys" : "Connect Alpaca"}</button>
    </form>
    {connected && <button type="button" className="editor-secondary-button" disabled={busy} onClick={() => void update()}>Disconnect Alpaca</button>}
    {error && <p role="alert" className="editor-notice">{error}</p>}
  </div>;
}
