import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Config, RemindersStatus } from "../types";

async function request<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/reminders/${endpoint}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "The Reminders connection is unavailable.");
  return value;
}
export function RemindersSettings({ config, onChange }: { config: Config; onChange: (next: Config) => void }) {
  const [status, setStatus] = useState<RemindersStatus | null>(null);
  const [address, setAddress] = useState("");
  const [token, setToken] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const latest = useRef(config); latest.current = config;
  useEffect(() => {
    let active = true;
    const refresh = async (initial = false) => {
      try {
        const next = await request<RemindersStatus>("status");
        if (active) { setStatus(next); if (initial) setAddress(next.publicUrl); setError(""); }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Could not check Reminders."); }
    };
    void refresh(true);
    const timer = setInterval(() => { void refresh(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const setupUrl = token && status?.publicUrl ? `${status.publicUrl}/#token=${encodeURIComponent(token)}` : "";
  useEffect(() => {
    let active = true; setQr("");
    if (setupUrl) QRCode.toDataURL(setupUrl, { width: 260, margin: 2, errorCorrectionLevel: "M" }).then(value => { if (active) setQr(value); }).catch(() => {});
    return () => { active = false; };
  }, [setupUrl]);
  async function action(endpoint: string, body: unknown = {}) {
    setBusy(true); setError(""); setCopyMessage("");
    try {
      const next = await request<RemindersStatus & { token?: string }>(endpoint, body);
      setStatus(next);
      if (endpoint === "pair") {
        setToken(next.token ?? "");
        const current = latest.current;
        onChange({ ...current, sources: { ...current.sources, tasksMode: "live" } });
      }
      if (endpoint === "revoke") setToken("");
    } catch (error) { setError(error instanceof Error ? error.message : "Reminders setup failed."); }
    finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopyMessage("Copied. Keep the upload token private."); }
    catch { setCopyMessage("Clipboard unavailable. Select and copy the value shown below."); }
  }
  return <div className="reminders-settings">
    <label className="editor-field"><span>Task source</span><select aria-label="Task source" value={config.sources.tasksMode} onChange={e => onChange({ ...config, sources: { ...config.sources, tasksMode: e.target.value as "sample" | "live" } })}><option value="sample">Sample task lists</option><option value="live">Apple Reminders Shortcut</option></select></label>
    <p className="editor-subheading">Connect your iPhone Shortcut</p>
    <p className="editor-help">Send reminders and their completion status from chosen lists. The briefing shows overdue incomplete items plus today and the next four days, including checked-off items, using Pacific dates. No Apple password is needed.</p>
    <label className="editor-field"><span>Phone server address</span><input aria-label="Phone server address" type="url" placeholder="https://your-pc.your-tailnet.ts.net:8443" value={address} onChange={e => setAddress(e.target.value)} disabled={busy} /></label>
    <button className="editor-secondary-button" disabled={busy || !address || address === status?.publicUrl} onClick={() => { void action("address", { publicUrl: address }); }}>Save phone address</button>
    <p className="editor-help">Private Tailscale HTTPS address for the upload receiver. Both devices need Tailscale; this computer must be awake with the app running.</p>
    {status && <>
      <div className="icloud-actions"><button className="editor-secondary-button" disabled={busy || !status.publicUrl} onClick={() => { void action("pair"); }}>{status.paired ? "Create replacement upload token" : "Create upload token"}</button>
      {status.paired && <button className="editor-secondary-button" disabled={busy} onClick={() => { void action("revoke"); }}>Disconnect Reminders</button>}</div>
      {status.paired && !token && <p className="editor-help">Upload token active. It survives server restarts. Create a replacement if you need to pair again; the previous token stops working.</p>}
      {token && <div className="reminders-pairing">
        <p className="editor-subheading">Scan with your iPhone camera</p>
        {qr && <img className="reminders-qr" src={qr} width={260} height={260} alt="Private Reminders pairing QR code" />}
        <p className="editor-help">The QR opens a phone-friendly setup guide with your upload values. Keep it private. The raw token is shown only during this setup.</p>
        <a href={`/api/reminders/guide?uploadBase=${encodeURIComponent(status.publicUrl)}#token=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer">Open Shortcut instructions</a>
        <label className="editor-field"><span>Upload URL</span><input aria-label="Reminders upload URL" readOnly value={`${status.publicUrl}/upload`} /></label>
        <button className="editor-secondary-button" onClick={() => { void copy(`${status.publicUrl}/upload`); }}>Copy upload URL</button>
        <label className="editor-field"><span>Authorization header</span><input aria-label="Reminders authorization header" type="password" readOnly value={`Bearer ${token}`} autoComplete="off" /></label>
        <button className="editor-secondary-button" onClick={() => { void copy(`Bearer ${token}`); }}>Copy authorization header</button>
        {copyMessage && <p role="status" className="editor-help">{copyMessage}</p>}
      </div>}
      <p className="editor-help" role="status">{!status.paired ? "No Shortcut paired." : !status.capturedAt ? "Waiting for your first upload. Run the Shortcut once on your iPhone." : `${status.count} reminders received. Captured ${new Date(status.capturedAt).toLocaleString()}. ${status.stale ? "Snapshot is stale; run the Shortcut again." : "Snapshot is fresh."}`}</p>
      {config.sources.tasksMode === "live" && status.capturedAt && <>
        <p className="editor-subheading">Reminder lists to include</p>
        <div className="editor-option-list">{status.lists.map(list => <label className="icloud-calendar-option" key={list}><input type="checkbox" checked={config.sources.reminderLists.includes(list)} onChange={() => onChange({ ...config, sources: { ...config.sources, reminderLists: config.sources.reminderLists.includes(list) ? config.sources.reminderLists.filter(value => value !== list) : [...config.sources.reminderLists, list] } })} /><span>{list}</span></label>)}</div>
        {!status.lists.length && <p className="editor-help">The last upload was empty. That is valid; lists will appear when they contain exported reminders.</p>}
      </>}
      {status.publicUrl && !token && <p className="editor-help"><a href={`/api/reminders/guide?uploadBase=${encodeURIComponent(status.publicUrl)}`} target="_blank" rel="noreferrer">Shortcut instructions</a> (create a token above to pair a new phone).</p>}
    </>}
    {error && <p role="alert" className="editor-notice">{error}</p>}
    <p className="editor-help">Snapshot expires after two hours. The latest snapshot and a hash of the token stay in private local app data; neither is included in settings exports. This connection never changes reminders.</p>
  </div>;
}
