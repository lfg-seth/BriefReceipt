import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import ical, { type Attendee } from "node-ical";
import type { BriefingData, CalendarInvitee, CalendarItem, ICloudCalendar, ICloudStatus } from "../src/types";

export const CALENDAR_TIMEZONE = "America/Los_Angeles";
const ROOT = "https://caldav.icloud.com/";
const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false, trimValues: false });
const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
type DavResponse = { href?: string; status?: string; propstat?: { status?: string; prop?: Record<string, any> } | { status?: string; prop?: Record<string, any> }[] };
export class ICloudError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export function appleUrl(value: string, base = ROOT): string {
  const url = new URL(value, base);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^(?:caldav\.icloud\.com|p\d+-caldav\.icloud\.com)$/.test(url.hostname)) {
    throw new ICloudError("iCloud returned an unexpected calendar server.");
  }
  return url.href;
}
function props(response: DavResponse): Record<string, any> {
  return Object.assign({}, ...array(response.propstat).filter(p => /\s200(?:\s|$)/.test(p.status ?? "")).map(p => p.prop ?? {}));
}
function propfind(properties: string) {
  return `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>${properties}</d:prop></d:propfind>`;
}
type Calendar = ICloudCalendar & { url: string; timezone: string };
export class ICloudConnection {
  private calendars: Calendar[] = [];
  private authorization: string;
  constructor(email: string, password: string, private transport: typeof fetch = fetch) {
    this.authorization = `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`;
  }
  private async request(url: string, method: "PROPFIND" | "REPORT", body: string, depth: "0" | "1", signal: AbortSignal): Promise<{ url: string; responses: DavResponse[] }> {
    let target = appleUrl(url);
    for (let redirects = 0; redirects < 5; redirects++) {
      const response = await this.transport(target, {
        method, body, redirect: "manual", signal,
        headers: { Authorization: this.authorization, "Content-Type": "application/xml; charset=utf-8", Depth: depth },
      });
      if ([301, 302, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new ICloudError("iCloud returned an incomplete redirect.");
        target = appleUrl(location, target);
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new ICloudError("Apple rejected the sign-in. Check your Apple Account email and app-specific password.", 401);
      }
      if (response.status !== 207) {
        await response.body?.cancel();
        throw new ICloudError("iCloud could not complete the calendar request. Try again shortly.");
      }
      // Bound private upstream data; never log or return raw responses.
      const reader = response.body?.getReader();
      if (!reader) throw new ICloudError("iCloud returned an empty response.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8_000_000) { await reader.cancel(); throw new ICloudError("This calendar response is too large to load."); }
        chunks.push(value);
      }
      const xml = Buffer.concat(chunks).toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ICloudError("iCloud returned invalid calendar data.");
      const parsed = parser.parse(xml);
      if (!Object.hasOwn(parsed, "multistatus")) throw new ICloudError("iCloud returned an unexpected response.");
      return { url: target, responses: array(parsed.multistatus?.response) };
    }
    throw new ICloudError("iCloud redirected too many times.");
  }
  async discover(signal = AbortSignal.timeout(30000)): Promise<ICloudStatus> {
    const principal = await this.request(ROOT, "PROPFIND", propfind("<d:current-user-principal/>"), "0", signal);
    const principalHref = principal.responses.map(props).find(p => p["current-user-principal"]?.href)?.["current-user-principal"].href;
    if (typeof principalHref !== "string") throw new ICloudError("Could not discover your iCloud account.");
    const home = await this.request(appleUrl(principalHref, principal.url), "PROPFIND", propfind("<c:calendar-home-set/>"), "0", signal);
    const homeHref = home.responses.map(props).find(p => p["calendar-home-set"]?.href)?.["calendar-home-set"].href;
    if (typeof homeHref !== "string") throw new ICloudError("Could not discover your iCloud calendars.");
    const found = await this.request(appleUrl(homeHref, home.url), "PROPFIND", propfind("<d:displayname/><d:resourcetype/><c:supported-calendar-component-set/><c:calendar-timezone/>"), "1", signal);
    const calendars: Calendar[] = [];
    for (const response of found.responses) {
      const p = props(response);
      if (!p.resourcetype || !Object.hasOwn(p.resourcetype, "calendar")) continue;
      const components = array(p["supported-calendar-component-set"]?.comp);
      if (components.length && !components.some(c => c["@_name"] === "VEVENT")) continue;
      if (typeof response.href !== "string") continue;
      const url = appleUrl(response.href, found.url);
      const timezone = typeof p["calendar-timezone"] === "string" ? p["calendar-timezone"].match(/(?:^|\n)TZID:([^\r\n]+)/)?.[1] : undefined;
      calendars.push({ id: createHash("sha256").update(url).digest("hex"), name: typeof p.displayname === "string" ? p.displayname.trim() || "Untitled calendar" : "Untitled calendar", url, timezone: timezone ?? CALENDAR_TIMEZONE });
    }
    this.calendars = [...new Map(calendars.map(c => [c.id, c])).values()];
    return this.status();
  }
  status(): ICloudStatus {
    return { connected: true, calendars: this.calendars.map(({ id, name }) => ({ id, name })) };
  }
  async upcoming(ids: string[], now = new Date()): Promise<BriefingData["calendar"]> {
    const selected = [...new Set(ids)].map(id => {
      const calendar = this.calendars.find(c => c.id === id);
      if (!calendar) throw new ICloudError("A selected calendar is no longer available. Reconnect and select it again.", 400);
      return calendar;
    });
    const { date, throughDate, start, end } = dayBounds(now, 5);
    // Broaden the server filter for floating DATE values; exact local-day filtering follows parsing.
    const davDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const from = davDate(new Date(start.valueOf() - 86400000)), to = davDate(new Date(end.valueOf() + 86400000));
    const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${from}" end="${to}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
    const signal = AbortSignal.timeout(30000);
    const items: CalendarItem[] = [];
    // Sequential requests keep Apple load bounded; any failed calendar makes the block unavailable.
    for (const calendar of selected) {
      const result = await this.request(calendar.url, "REPORT", body, "1", signal);
      for (const response of result.responses) {
        const data = props(response)["calendar-data"];
        if (typeof data !== "string") throw new ICloudError("Some calendar events could not be read. Try reconnecting.");
        items.push(...await calendarItems(data, calendar, now, 5));
      }
    }
    items.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || Number(!!b.allDay) - Number(!!a.allDay) || (a.startsAt ?? "").localeCompare(b.startsAt ?? "") || a.title.localeCompare(b.title));
    return { provenance: { mode: "live", source: "iCloud Calendar", retrievedAt: new Date().toISOString(), note: `${date} through ${throughDate} · ${CALENDAR_TIMEZONE}` }, date, throughDate, items: [...new Map(items.map(item => [item.id, item])).values()] };
  }
}
export function localDate(date: Date, timezone = CALENDAR_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function midnight(date: string): Date {
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CALENDAR_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const p = Object.fromEntries(parts.map(p => [p.type, p.value]));
    instant += target - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  }
  return new Date(instant);
}
export function dayBounds(now: Date, days = 1) {
  const date = localDate(now);
  const shift = (offset: number) => new Date(Date.parse(`${date}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  return { date, throughDate: shift(days - 1), start: midnight(date), end: midnight(shift(days)) };
}
const valueText = (value: unknown): string => typeof value === "string" ? value : value && typeof value === "object" && "val" in value ? String(value.val) : "";
function calendarInvitees(value: Attendee | Attendee[] | undefined): CalendarInvitee[] {
  return array(value).flatMap(attendee => {
    const params = typeof attendee === "object" ? attendee.params : undefined;
    const address = valueText(attendee).replace(/^mailto:/i, "").trim();
    const name = params?.CN?.trim() || undefined;
    if (!address && !name) return [];
    return [{ address, name, participationStatus: params?.PARTSTAT?.toUpperCase() }];
  });
}
const floatingDate = (value: Date): string => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
export async function calendarItems(data: string, calendar: ICloudCalendar & { timezone?: string }, now: Date, days = 1): Promise<CalendarItem[]> {
  if (!/^BEGIN:VCALENDAR\s*$/m.test(data) || !/^END:VCALENDAR\s*$/m.test(data)) throw new ICloudError("iCloud returned incomplete event data.");
  const { date, throughDate, start, end } = dayBounds(now, days);
  const timezone = calendar.timezone ?? CALENDAR_TIMEZONE;
  // Floating times use their calendar timezone, independent of the server's OS timezone.
  const normalized = data.replace(/^(DTSTART|DTEND|RECURRENCE-ID|EXDATE|RDATE)([^:\r\n]*):([^\r\n]+)$/gm, (line, key, params, value) =>
    !/TZID=|VALUE=DATE(?:;|$)/i.test(params) && /^\d{8}T\d{6}(?:,\d{8}T\d{6})*$/.test(value) ? `${key}${params};TZID=${timezone}:${value}` : line);
  const parsed = await ical.async.parseICS(normalized);
  const items: CalendarItem[] = [];
  const time = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: CALENDAR_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(d);
  for (const event of Object.values(parsed)) {
    if (event?.type !== "VEVENT") continue;
    if (!event.start || !Number.isFinite(event.start.valueOf())) throw new ICloudError("An event has an unsupported start date.");
    for (const instance of ical.expandRecurringEvent(event, { from: new Date(start.valueOf() - 86400000), to: end, expandOngoing: true })) {
      if (instance.event.status === "CANCELLED") continue;
      const allDay = instance.isFullDay;
      // node-ical represents DATE values using host-local calendar fields.
      const firstDay = allDay ? floatingDate(instance.start) : localDate(instance.start, instance.start.tz ?? "UTC");
      const lastDay = allDay ? floatingDate(instance.end) : localDate(instance.end, instance.end.tz ?? instance.start.tz ?? "UTC");
      const overlaps = allDay ? firstDay <= throughDate && (lastDay > date || (firstDay >= date && lastDay === firstDay)) : instance.start < end && (instance.end > start || (instance.start >= start && instance.end.valueOf() === instance.start.valueOf()));
      if (!overlaps) continue;
      const occurrenceDate = allDay ? firstDay : localDate(instance.start);
      items.push({
        id: `${calendar.id}:${event.uid}:${instance.start.toISOString()}`,
        title: valueText(instance.summary) || "Untitled event",
        calendar: calendar.name, calendarId: calendar.id, allDay,
        time: allDay ? "" : time(instance.start), end: allDay ? undefined : time(instance.end),
        startsAt: instance.start.toISOString(),
        date: occurrenceDate < date ? date : occurrenceDate,
        ongoing: occurrenceDate < date,
        location: valueText(instance.event.location ?? event.location) || undefined,
        description: valueText(instance.event.description ?? event.description) || undefined,
        invitees: calendarInvitees(instance.event.attendee ?? event.attendee),
      });
    }
  }
  return items;
}
