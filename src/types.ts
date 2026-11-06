export type BlockId =
  "summary" | "weather" | "calendar" | "tasks" | "news" | "events" | "markets" | "projects";
export type Condition = "rain" | "clear" | "cloudy" | "storm" | "night";
export type NewsCategory = "general" | "technology" | "companies" | "local";
export interface BlockConfig {
  id: BlockId;
  enabled: boolean;
  density: "comfortable" | "compact";
  limit: number;
  note: string;
}
export interface ProjectFolder {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
}
export interface Config {
  version: 1;
  blocks: BlockConfig[];
  weather: {
    zip: string;
    units: "fahrenheit" | "celsius";
    mode: "sample" | "live";
    condition: Condition;
  };
  sources: {
    calendarMode: "sample" | "live";
    calendarIds: string[];
    calendarTravel: {
      localCity: string;
      localState: string;
      homeAddress: string;
      workAddress: string;
      homeMinutes: number;
      workMinutes: number;
    };
    calendars: string[];
    taskLists: string[];
    tasksMode: "sample" | "live";
    reminderLists: string[];
    newsMode: "sample" | "live";
    newsCategories: NewsCategory[];
    localArea: string;
    county: string;
    state: string;
    eventsDays: number;
    stocks: string[];
    marketsMode: "sample" | "live";
    projects: ProjectFolder[];
  };
  schedule: {
    enabled: boolean;
    time: string;
    timezone: string;
    days: number[];
  };
  printer: {
    paperWidth: number;
    contentWidth: number;
    fontSize: number;
    zoom: number;
    footer: string;
  };
}
export interface Provenance {
  mode: "sample" | "live" | "unavailable";
  source: string;
  retrievedAt: string;
  observedAt?: string;
  note?: string;
  url?: string;
}
export interface WeatherDay {
  date: string;
  label: string;
  condition: Condition;
  high: number;
  low: number;
  precipitation: number;
}
export interface WeatherData {
  provenance: Provenance;
  location: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  condition: Condition;
  days: WeatherDay[];
}
export interface CalendarInvitee {
  name?: string;
  address: string;
  participationStatus?: string;
}
export interface CalendarItem {
  id: string;
  title: string;
  time: string;
  end?: string;
  allDay?: boolean;
  calendar: string;
  calendarId?: string;
  startsAt?: string;
  date?: string;
  ongoing?: boolean;
  location?: string;
  description?: string;
  descriptionSummary?: { text: string; model: string; generatedAt: string };
  summaryUnavailable?: string;
  invitees?: CalendarInvitee[];
}
export interface ICloudCalendar { id: string; name: string }
export interface ICloudStatus { connected: boolean; calendars: ICloudCalendar[]; saved?: boolean; error?: string }
export interface AIStatus { connected: boolean; model: string; briefingModel?: string; briefingReasoning?: string; researchModel?: string; monthlyLimitUsd: number; reservedUsd: number; month: string; error?: string }
export interface RemindersStatus {
  paired: boolean;
  publicUrl: string;
  capturedAt?: string;
  receivedAt?: string;
  stale: boolean;
  maxAgeMinutes: number;
  lists: string[];
  count: number;
}
export interface TaskItem {
  id: string;
  title: string;
  list: string;
  overdue: boolean;
  dueStatus?: "overdue" | "today" | "upcoming";
  completed?: boolean;
  due: string;
}
export interface NewsItem {
  id: string;
  title: string;
  description?: string;
  publisher: string;
  byline?: string;
  copyright?: string;
  category: NewsCategory;
  publishedAt: string;
  url?: string;
  sample?: boolean;
}
export interface EventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  source: string;
  url?: string;
}
export interface MarketPoint { at: string; value: number }
export type MarketStatus = "Open" | "Pre-market" | "After-hours" | "Closed";
export interface MarketItem {
  symbol: string;
  name: string;
  value: number | null;
  change: number | null;
  kind: "stock" | "index";
  session: string;
  asOf: string;
  freshness: string;
  unavailable?: string;
  dayHistory?: MarketPoint[];
  weekHistory?: MarketPoint[];
  weekChange?: number | null;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
}
export interface ProjectItem {
  id: string;
  name: string;
  progress: string;
  next?: string;
  blocker?: string;
  evidence: string;
  asOf: string;
}
export interface SummaryCitation { url: string; title: string; end: number }
export interface BriefingData {
  summary: { provenance: Provenance; text: string; citations?: SummaryCitation[] };
  weather: WeatherData;
  calendar: { provenance: Provenance; items: CalendarItem[]; date?: string; throughDate?: string };
  tasks: { provenance: Provenance; items: TaskItem[]; capturedAt?: string };
  news: { provenance: Provenance; items: NewsItem[] };
  events: { provenance: Provenance; items: EventItem[] };
  markets: { provenance: Provenance; items: MarketItem[]; marketStatus?: MarketStatus };
  projects: { provenance: Provenance; items: ProjectItem[] };
}
export const BLOCK_META: Record<
  BlockId,
  { title: string; subtitle: string; icon: string }
> = {
  summary: {
    title: "AI summary",
    subtitle: "Only what deserves your attention",
    icon: "Sparkles",
  },
  weather: {
    title: "Weather",
    subtitle: "Today + a three-day outlook",
    icon: "CloudSun",
  },
  calendar: {
    title: "Calendar",
    subtitle: "Today + the next four days",
    icon: "CalendarDays",
  },
  tasks: {
    title: "Tasks",
    subtitle: "What needs your attention",
    icon: "CheckSquare",
  },
  news: {
    title: "Headlines",
    subtitle: "The world, in a few lines",
    icon: "Newspaper",
  },
  events: {
    title: "Around you",
    subtitle: "Good reasons to get outside",
    icon: "MapPin",
  },
  markets: {
    title: "Markets",
    subtitle: "A snapshot, with context",
    icon: "ChartNoAxesCombined",
  },
  projects: {
    title: "Projects",
    subtitle: "Small steps, moving forward",
    icon: "FolderGit2",
  },
};
