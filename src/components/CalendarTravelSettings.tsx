import type { Config } from "../types";

export function CalendarTravelSettings({ config, onChange }: { config: Config; onChange: (value: Config) => void }) {
  const travel = config.sources.calendarTravel;
  const update = (value: Partial<typeof travel>) => onChange({ ...config, sources: { ...config.sources, calendarTravel: { ...travel, ...value } } });
  return <div className="editor-source-section">
    <h4>Calendar locations & travel</h4>
    <div className="editor-field-grid">
      <label className="editor-field"><span>Local city</span><input aria-label="Local city" value={travel.localCity} maxLength={100} onChange={e => update({ localCity: e.target.value })} /></label>
      <label className="editor-field"><span>Local state</span><input aria-label="Local state" value={travel.localState} maxLength={2} onChange={e => update({ localState: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /></label>
    </div>
    <p className="editor-help">City for ZIP {config.weather.zip}. Update city/state when you change ZIP; automatic lookup is not connected. Matching addresses show only the street.</p>
    <label className="editor-field"><span>Home address</span><textarea aria-label="Home address" rows={2} value={travel.homeAddress} maxLength={500} onChange={e => update({ homeAddress: e.target.value })} placeholder="Street, city, state ZIP" /></label>
    <label className="editor-field"><span>Work address</span><textarea aria-label="Work address" rows={2} value={travel.workAddress} maxLength={500} onChange={e => update({ workAddress: e.target.value })} placeholder="Street, city, state ZIP" /></label>
    <div className="editor-field-grid">
      <label className="editor-field"><span>Sample home minutes</span><input aria-label="Sample home minutes" type="number" min={1} max={240} value={travel.homeMinutes} onChange={e => update({ homeMinutes: Math.min(240, Math.max(1, Math.round(Number(e.target.value) || 1))) })} /></label>
      <label className="editor-field"><span>Sample work minutes</span><input aria-label="Sample work minutes" type="number" min={1} max={240} value={travel.workMinutes} onChange={e => update({ workMinutes: Math.min(240, Math.max(1, Math.round(Number(e.target.value) || 1))) })} /></label>
    </div>
    <p className="editor-help">Sample travel only. Leave times subtract these sample minutes from the event start, with no traffic or arrival buffer. No maps API is connected and addresses are not sent anywhere. Saved in this browser and included in settings exports.</p>
  </div>;
}
