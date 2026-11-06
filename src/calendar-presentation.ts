import type { CalendarInvitee, CalendarItem } from "./types";

export function calendarDayLabel(date: string, today: string) {
  const day = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(day.valueOf())) return date;
  const offset = (day.valueOf() - Date.parse(`${today}T12:00:00Z`)) / 86400000;
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(day);
  return `${offset === 0 ? "Today · " : offset === 1 ? "Tomorrow · " : ""}${label}`;
}

const normalizedName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

export function uniqueInvitees(invitees: CalendarInvitee[] = []) {
  const people = new Map<string, { name: string; statuses: string[] }>();
  for (const invitee of invitees) {
    const name = invitee.name?.trim().replace(/\s+/g, " ") || invitee.address;
    if (!name) continue;
    const key = normalizedName(name);
    const person = people.get(key) ?? { name, statuses: [] };
    const status = invitee.participationStatus?.toUpperCase();
    if (status && !person.statuses.includes(status)) person.statuses.push(status);
    people.set(key, person);
  }
  return [...people.values()];
}

const stateNames = "Alabama:AL|Alaska:AK|Arizona:AZ|Arkansas:AR|California:CA|Colorado:CO|Connecticut:CT|Delaware:DE|District of Columbia:DC|Florida:FL|Georgia:GA|Hawaii:HI|Idaho:ID|Illinois:IL|Indiana:IN|Iowa:IA|Kansas:KS|Kentucky:KY|Louisiana:LA|Maine:ME|Maryland:MD|Massachusetts:MA|Michigan:MI|Minnesota:MN|Mississippi:MS|Missouri:MO|Montana:MT|Nebraska:NE|Nevada:NV|New Hampshire:NH|New Jersey:NJ|New Mexico:NM|New York:NY|North Carolina:NC|North Dakota:ND|Ohio:OH|Oklahoma:OK|Oregon:OR|Pennsylvania:PA|Rhode Island:RI|South Carolina:SC|South Dakota:SD|Tennessee:TN|Texas:TX|Utah:UT|Vermont:VT|Virginia:VA|Washington:WA|West Virginia:WV|Wisconsin:WI|Wyoming:WY";
const states = new Map(stateNames.split("|").map(pair => { const [name, code] = pair.split(":"); return [name.toLowerCase(), code]; }));
const stateCode = (value: string) => states.get(value.toLowerCase()) ?? (/^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : undefined);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Formatting only: no geocoding or guessed city boundaries. Unrecognized venue
// text stays intact. US locality lines support Apple multiline and comma forms.
export function calendarLocation(location: string, localCity: string, localState: string) {
  const clean = location.trim().replace(/(?:[,\n]\s*|\s+)(?:United States(?: of America)?|USA|U\.S\.A\.?|US)\.?\s*$/i, "").trim();
  const parts = clean.split(/\r?\n|,/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) return { text: "", isAddress: false };
  const tail = parts.at(-1)!;
  // A city and state may be together (Las Vegas NV 89104) or separate
  // (Las Vegas, NV 89104). Full state names are normalized to postal codes.
  const statePattern = [...states.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const match = tail.match(new RegExp(`^(?:(.+?)\\s+)?(${statePattern}|[A-Za-z]{2})\\s+(\\d{5}(?:-\\d{4})?)$`, "i"));
  let city = match?.[1], state = match && stateCode(match[2]), zip = match?.[3];
  let street = parts.slice(0, -1);
  if (match && !city && parts.length >= 3) { city = street.pop(); }
  // Also handle unpunctuated local addresses when the configured city is known.
  if (match && city && !street.length && localCity.trim()) {
    const local = city.match(new RegExp(`^(.+?)\\s+(${escapeRegex(localCity.trim())})$`, "i"));
    if (local) { street = [local[1]]; city = local[2]; }
  }
  if (!city || !state || !zip || !street.length) return { text: clean, isAddress: false };
  const local = normalizedName(city) === normalizedName(localCity) && state === localState.toUpperCase();
  return { text: [...street, ...(local ? [] : [`${city}, ${state} ${zip}`])].join("\n"), isAddress: true };
}

export function sampleDeparture(item: CalendarItem, minutes: number): string | undefined {
  if (item.allDay || item.ongoing) return undefined;
  if (item.startsAt && Number.isFinite(Date.parse(item.startsAt))) {
    const start = new Date(item.startsAt), departure = new Date(start.valueOf() - minutes * 60000);
    const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit",
      ...(day(start) !== day(departure) ? { month: "short" as const, day: "numeric" as const } : {}),
    }).format(departure);
  }
  const match = item.time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  if (Number(match[2]) > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return undefined;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  const offset = hour * 60 + Number(match[2]) - minutes;
  const clock = (offset % 1440 + 1440) % 1440;
  return `${Math.floor(clock / 60) % 12 || 12}:${String(clock % 60).padStart(2, "0")} ${clock < 720 ? "AM" : "PM"}${offset < 0 ? " (prev. day)" : ""}`;
}
