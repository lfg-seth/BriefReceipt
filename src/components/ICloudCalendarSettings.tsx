import { useEffect, useRef, useState } from "react";
import type { Config, ICloudStatus } from "../types";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/icloud/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "iCloud request failed.");
  return value as T;
}
export function ICloudCalendarSettings({ config, onChange, onRefresh }: { config: Config; onChange: (value: Config) => void; onRefresh: () => void }) {
  const [status, setStatus] = useState<ICloudStatus>({ connected: false, calendars: [] });
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(config);
  latest.current = config;
  useEffect(() => {
    let active = true;
    request<ICloudStatus>("status").then(value => { if (active) setStatus(value); })
      .catch(() => { if (active) setError("Could not check iCloud. Restart the local server and try again."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    // Clear the field immediately; credentials are never part of saved configuration.
    const credentials = { email, password };
    setPassword("");
    try {
      const next = await request<ICloudStatus>("connect", credentials);
      setStatus(next); setEmail("");
      const current = latest.current;
      onChange({ ...current, sources: { ...current.sources, calendarMode: "live", calendarIds: current.sources.calendarIds.filter(id => next.calendars.some(c => c.id === id)) } });
      onRefresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not connect to iCloud."); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setError("");
    try { setStatus(await request<ICloudStatus>("disconnect", {})); onRefresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not disconnect and remove the saved sign-in. Try again."); }
    finally { setBusy(false); }
  }
  async function refreshCalendar() {
    setBusy(true); setError("");
    try { setStatus(await request<ICloudStatus>("status")); onRefresh(); }
    catch { setError("Could not reach the local server. Restart it and reconnect."); }
    finally { setBusy(false); }
  }
  async function retrySaved() {
    setBusy(true); setError("");
    try { setStatus(await request<ICloudStatus>("retry", {})); onRefresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not restore the saved connection."); }
    finally { setBusy(false); }
  }
  return <div className="icloud-settings">
    <label className="editor-field"><span>Calendar source</span>
      <select aria-label="Calendar source" value={config.sources.calendarMode} onChange={e => onChange({ ...config, sources: { ...config.sources, calendarMode: e.target.value as "sample" | "live" } })}>
        <option value="sample">Sample calendars</option><option value="live">iCloud Calendar</option>
      </select>
    </label>
    <p className="editor-subheading">iCloud Calendar</p>
    <p className="editor-help">{checking ? "Checking saved connection…" : status.connected ? status.saved ? "Connected. Sign-in saved in .env and restored automatically after restart. Calendar access is read-only in this app." : "Connected. Calendar access is read-only in this app." : "Connect using your Apple Account email and dedicated app-specific password."}</p>
    {status.error && <p role="alert" className="editor-notice">{status.error}</p>}
    {!checking && !status.connected && status.saved && <button className="editor-secondary-button" type="button" onClick={retrySaved} disabled={busy}>Retry saved connection</button>}
    {!checking && !status.connected && <form onSubmit={connect}>
      <label className="editor-field"><span>Apple Account email</span><input aria-label="Apple Account email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} disabled={busy} /></label>
      <label className="editor-field"><span>App-specific password</span><input aria-label="App-specific password" type="password" autoComplete="off" spellCheck={false} value={password} onChange={e => setPassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" required disabled={busy} /></label>
      <p className="editor-help">Successful sign-ins save to this project’s Git-ignored .env and reconnect after restart. Excluded from browser storage and settings exports. Disconnecting removes the saved sign-in.</p>
      <button className="editor-secondary-button" type="submit" disabled={busy || !email || !password}>{busy ? "Connecting to iCloud…" : "Connect iCloud"}</button>
    </form>}
    {status.connected && <>
      {config.sources.calendarMode === "live" && <>
        <p className="editor-subheading">Choose calendars for your briefing</p>
        <div className="editor-option-list">{status.calendars.map(calendar => <label className="icloud-calendar-option" key={calendar.id}>
          <input type="checkbox" checked={config.sources.calendarIds.includes(calendar.id)} disabled={busy || (!config.sources.calendarIds.includes(calendar.id) && config.sources.calendarIds.length >= 30)} onChange={() => onChange({ ...config, sources: { ...config.sources, calendarIds: config.sources.calendarIds.includes(calendar.id) ? config.sources.calendarIds.filter(id => id !== calendar.id) : [...config.sources.calendarIds, calendar.id] } })} />
          <span>{calendar.name}</span>
        </label>)}</div>
        <p className="editor-help">{status.calendars.length ? "Only checked calendars are read. Includes today and the next four days in America/Los_Angeles, including all-day and recurring events. Items to include limits the total shown." : "No event calendars found. Check that your calendars are stored in this iCloud account."}</p>
      </>}
      <div className="icloud-actions"><button className="editor-secondary-button" type="button" onClick={refreshCalendar} disabled={busy}>Refresh calendar</button><button className="editor-secondary-button" type="button" onClick={disconnect} disabled={busy}>Disconnect iCloud</button></div>
    </>}
    {error && <p role="alert" className="editor-notice">{error}</p>}
    <p className="editor-help">Reminders uses a separate iPhone Shortcut connection in Tasks settings.</p>
  </div>;
}
