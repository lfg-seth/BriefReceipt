import { BLOCK_META, type BlockId, type Config } from "./types";
export const STORAGE_KEY = "receipt-summary:configuration:v1";
export const defaultConfig: Config = {
  version: 1,
  blocks: (Object.keys(BLOCK_META) as BlockId[]).map((id) => ({
    id,
    enabled: true,
    density: "comfortable",
    limit: id === "weather" ? 4 : id === "events" ? 3 : 5,
    note: "",
  })),
  weather: {
    zip: "89147",
    units: "fahrenheit",
    mode: "sample",
    condition: "rain",
  },
  sources: {
    calendarMode: "sample",
    calendarIds: [],
    calendarTravel: {
      localCity: "Las Vegas", localState: "NV",
      homeAddress: "", workAddress: "",
      homeMinutes: 20, workMinutes: 30,
    },
    calendars: ["Personal", "Work", "Household"],
    taskLists: ["Today", "Home", "Projects"],
    tasksMode: "sample",
    reminderLists: [],
    newsMode: "sample",
    newsCategories: ["general", "technology", "companies", "local"],
    localArea: "Spring Valley / Las Vegas Valley",
    county: "Clark County",
    state: "Nevada",
    eventsDays: 7,
    stocks: ["TSLA", "SPCX"],
    marketsMode: "sample",
    projects: [
      {
        id: "receipt-summary",
        name: "Receipt Summary",
        path: "~/Projects/receipt-summary",
        enabled: true,
      },
      {
        id: "home-dashboard",
        name: "Home dashboard",
        path: "~/Projects/home-dashboard",
        enabled: true,
      },
      {
        id: "garden-log",
        name: "Garden log",
        path: "~/Projects/garden-log",
        enabled: true,
      },
      {
        id: "budget-notes",
        name: "Budget notes",
        path: "~/Projects/budget-notes",
        enabled: true,
      },
      {
        id: "weekend-map",
        name: "Weekend map",
        path: "~/Projects/weekend-map",
        enabled: true,
      },
    ],
  },
  schedule: {
    enabled: false,
    time: "07:00",
    timezone: "America/Los_Angeles",
    days: [1, 2, 3, 4, 5],
  },
  printer: {
    paperWidth: 80,
    contentWidth: 72,
    fontSize: 12,
    zoom: 1.15,
    footer: "A little perspective. A fresh start.",
  },
};
const cloneDefaults = (): Config => structuredClone(defaultConfig);
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const num = (v: unknown, fallback: number, min: number, max: number) =>
  Math.min(
    max,
    Math.max(min, typeof v === "number" && Number.isFinite(v) ? v : fallback),
  );
const str = (v: unknown, fallback: string) =>
  typeof v === "string" ? v : fallback;
const bool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;
const strings = (v: unknown, fallback: string[]) =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? v : fallback;
export function normalizeConfig(value: unknown): Config {
  const base = cloneDefaults(),
    raw = record(value);
  if (raw.version !== 1) return base;
  const weather = record(raw.weather),
    sources = record(raw.sources),
    schedule = record(raw.schedule),
    printer = record(raw.printer);
  const inputBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const seen = new Set<BlockId>();
  base.blocks = inputBlocks.flatMap((item) => {
    const b = record(item),
      id = b.id as BlockId;
    if (!Object.hasOwn(BLOCK_META, String(id)) || seen.has(id)) return [];
    seen.add(id);
    return [
      {
        id,
        enabled: bool(b.enabled, true),
        density:
          b.density === "compact"
            ? ("compact" as const)
            : ("comfortable" as const),
        limit: Math.round(
          num(
            b.limit,
            5,
            1,
            id === "weather" ? 4 : id === "news" || id === "projects" ? 5 : 20,
          ),
        ),
        note: str(b.note, ""),
      },
    ];
  });
  base.blocks.push(
    ...defaultConfig.blocks
      .filter((b) => !seen.has(b.id))
      .map((b) => ({ ...b })),
  );
  // Put the new overview first when migrating an existing layout.
  if (!seen.has("summary")) {
    base.blocks.unshift(base.blocks.splice(base.blocks.findIndex(b => b.id === "summary"), 1)[0]);
  }
  base.weather = {
    zip: str(weather.zip, base.weather.zip),
    units: weather.units === "celsius" ? "celsius" : "fahrenheit",
    mode: weather.mode === "live" ? "live" : "sample",
    condition: ["rain", "clear", "cloudy", "storm", "night"].includes(
      String(weather.condition),
    )
      ? (weather.condition as Config["weather"]["condition"])
      : "rain",
  };
  base.sources = {
    ...base.sources,
    calendarMode: sources.calendarMode === "live" ? "live" : "sample",
    calendarIds: strings(sources.calendarIds, []).filter(id => /^[a-f0-9]{64}$/.test(id)).slice(0, 30),
    calendarTravel: (() => {
      const travel = record(sources.calendarTravel), defaults = base.sources.calendarTravel;
      return {
        localCity: str(travel.localCity, defaults.localCity).slice(0, 100),
        localState: str(travel.localState, defaults.localState).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
        homeAddress: str(travel.homeAddress, "").slice(0, 500),
        workAddress: str(travel.workAddress, "").slice(0, 500),
        homeMinutes: Math.round(num(travel.homeMinutes, defaults.homeMinutes, 1, 240)),
        workMinutes: Math.round(num(travel.workMinutes, defaults.workMinutes, 1, 240)),
      };
    })(),
    calendars: strings(sources.calendars, base.sources.calendars),
    taskLists: strings(sources.taskLists, base.sources.taskLists),
    tasksMode: sources.tasksMode === "live" ? "live" : "sample",
    reminderLists: strings(sources.reminderLists, []).filter(s => s.length > 0 && s.length <= 200).slice(0, 100),
    newsMode: sources.newsMode === "live" ? "live" : "sample",
    newsCategories: strings(
      sources.newsCategories,
      base.sources.newsCategories,
    ).filter((c) =>
      ["general", "technology", "companies", "local"].includes(c),
    ) as Config["sources"]["newsCategories"],
    localArea: str(sources.localArea, base.sources.localArea),
    county: str(sources.county, base.sources.county),
    state: str(sources.state, base.sources.state),
    eventsDays: Math.round(num(sources.eventsDays, 7, 1, 30)),
    stocks: strings(sources.stocks, base.sources.stocks),
    marketsMode: sources.marketsMode === "live" ? "live" : "sample",
    projects: Array.isArray(sources.projects)
      ? sources.projects
          .filter((p) => typeof p === "object" && p !== null)
          .map((p, i) => ({
            id: str(p.id, `custom-${i}`),
            name: str(p.name, "Untitled project"),
            path: str(p.path, ""),
            enabled: bool(p.enabled, true),
          }))
      : base.sources.projects,
  };
  base.schedule = {
    enabled: bool(schedule.enabled, false),
    time:
      typeof schedule.time === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)
        ? schedule.time
        : "07:00",
    timezone: str(schedule.timezone, "America/Los_Angeles"),
    days: Array.isArray(schedule.days)
      ? [
          ...new Set(
            schedule.days.filter(
              (d) => Number.isInteger(d) && d >= 0 && d <= 6,
            ),
          ),
        ]
      : base.schedule.days,
  };
  const paperWidth = num(printer.paperWidth, 80, 58, 112);
  base.printer = {
    paperWidth,
    contentWidth: num(printer.contentWidth, 72, 40, paperWidth - 4),
    fontSize: num(printer.fontSize, 12, 9, 16),
    zoom: num(printer.zoom, 1.15, 0.6, 1.6),
    footer: str(printer.footer, base.printer.footer),
  };
  return base;
}
export function loadConfig(storage: Pick<Storage, "getItem">): Config {
  try {
    return normalizeConfig(JSON.parse(storage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return cloneDefaults();
  }
}
export function saveConfig(
  storage: Pick<Storage, "setItem">,
  config: Config,
): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}
