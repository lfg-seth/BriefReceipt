import type { BriefingData, Condition, Provenance } from "../types";

export const SAMPLE_AS_OF = "2026-11-05T06:15:00-08:00";
const sample = (source: string, note?: string): Provenance => ({
  mode: "sample",
  source,
  retrievedAt: SAMPLE_AS_OF,
  observedAt: SAMPLE_AS_OF,
  note: note ?? "Synthetic demonstration. Not a current observation.",
});

export function createSampleData(condition: Condition = "rain"): BriefingData {
  const temperatures: Record<Condition, number> = {
    rain: 58,
    clear: 72,
    cloudy: 64,
    storm: 55,
    night: 51,
  };
  return {
    summary: {
      provenance: { mode: "unavailable", source: "OpenAI", retrievedAt: SAMPLE_AS_OF, note: "Preparing your briefing summary…" },
      text: "",
    },
    weather: {
      provenance: sample(
        "Receipt Summary weather studio",
        "Simulated conditions for 5 Nov 2026. Values are synthetic, not a forecast.",
      ),
      location: "Spring Valley · 89147",
      temperature: temperatures[condition],
      feelsLike: temperatures[condition] - 2,
      humidity: condition === "rain" ? 82 : condition === "storm" ? 88 : 28,
      wind: condition === "storm" ? 22 : 8,
      condition,
      days: [
        {
          date: "2026-11-05",
          label: "Today",
          condition,
          high: temperatures[condition] + 5,
          low: temperatures[condition] - 10,
          precipitation:
            condition === "rain" ? 85 : condition === "storm" ? 95 : 5,
        },
        {
          date: "2026-11-06",
          label: "Fri",
          condition: "cloudy",
          high: 66,
          low: 48,
          precipitation: 20,
        },
        {
          date: "2026-11-07",
          label: "Sat",
          condition: "clear",
          high: 71,
          low: 49,
          precipitation: 0,
        },
        {
          date: "2026-11-08",
          label: "Sun",
          condition: "clear",
          high: 73,
          low: 50,
          precipitation: 0,
        },
      ],
    },
    calendar: {
      provenance: sample("Sample calendars · read-only"),
      date: "2026-11-05",
      throughDate: "2026-11-09",
      items: [
        {
          id: "cal-1",
          date: "2026-11-05",
          title: "A little room to think",
          time: "All day",
          allDay: true,
          calendar: "Personal",
          location: "Protect a little breathing space",
        },
        {
          id: "cal-2",
          date: "2026-11-05",
          title: "Morning project check-in",
          time: "09:00",
          end: "09:30",
          calendar: "Work",
          location: "Video call",
          description: "Bring the updated timeline. Confirm the next milestone and any blockers.",
          invitees: [
            { name: "Alex Morgan", address: "alex@example.com", participationStatus: "ACCEPTED" },
            { name: "Jordan Lee", address: "jordan@example.com", participationStatus: "TENTATIVE" },
          ],
        },
        {
          id: "cal-3",
          date: "2026-11-05",
          title: "Lunch & a walk",
          time: "12:30",
          end: "13:15",
          calendar: "Personal",
          location: "Neighborhood loop",
        },
        {
          id: "cal-4",
          date: "2026-11-05",
          title: "Pick up the weekly groceries",
          time: "17:30",
          end: "18:00",
          calendar: "Household",
          location: "Local market",
        },
        { id: "cal-5", date: "2026-11-06", title: "Review next week's plans", time: "10:00", calendar: "Personal" },
        { id: "cal-6", date: "2026-11-09", title: "Weekly planning", time: "09:00", calendar: "Work" },
      ],
    },
    tasks: {
      provenance: sample("Sample task lists"),
      items: [
        {
          id: "task-1",
          title: "Send the revised project notes",
          list: "Today",
          overdue: true,
          due: "2026-11-04",
        },
        {
          id: "task-2",
          title: "Replace the hallway light bulb",
          list: "Home",
          overdue: true,
          due: "2026-11-03",
        },
        {
          id: "task-3",
          title: "Review the receipt layout at 80 mm",
          list: "Projects",
          overdue: false,
          due: "2026-11-05",
        },
        {
          id: "task-4",
          title: "Book the annual service appointment",
          list: "Today",
          overdue: false,
          due: "2026-11-05",
        },
      ],
    },
    news: {
      provenance: sample(
        "Synthetic newsroom",
        "Invented headlines for layout evaluation; no factual news claims.",
      ),
      items: [
        {
          id: "news-1",
          title:
            "A quieter commute: cities explore more neighborhood walking routes",
          publisher: "Sample Daily",
          category: "general",
          publishedAt: "2026-11-05T05:30:00-08:00",
          sample: true,
        },
        {
          id: "news-2",
          title: "Small teams make room for simpler, more focused software",
          publisher: "Sample Technology Review",
          category: "technology",
          publishedAt: "2026-11-05T04:45:00-08:00",
          sample: true,
        },
        {
          id: "news-3",
          title: "Tesla and SpaceX: a demonstration slot for company updates",
          publisher: "Sample Company Desk",
          category: "companies",
          publishedAt: "2026-11-05T03:40:00-08:00",
          sample: true,
        },
        {
          id: "news-4",
          title: "Valley community groups plan a season of outdoor gatherings",
          publisher: "Sample Nevada Journal",
          category: "local",
          publishedAt: "2026-11-04T18:15:00-08:00",
          sample: true,
        },
        {
          id: "news-5",
          title: "Independent shops find new ways to bring neighbors together",
          publisher: "Sample Business Post",
          category: "technology",
          publishedAt: "2026-11-04T17:00:00-08:00",
          sample: true,
        },
      ],
    },
    events: {
      provenance: sample(
        "Sample community calendar",
        "Fictional events and venues; do not use as an attendance guide.",
      ),
      items: [
        {
          id: "event-1",
          title: "Neighborhood makers morning",
          date: "2026-11-07",
          time: "10:00",
          venue: "Sample community studio · Spring Valley",
          source: "Sample community calendar",
        },
        {
          id: "event-2",
          title: "An evening under the desert sky",
          date: "2026-11-08",
          time: "18:30",
          venue: "Sample park · Las Vegas Valley",
          source: "Sample parks calendar",
        },
        {
          id: "event-3",
          title: "Community book exchange",
          date: "2026-11-10",
          time: "All day",
          venue: "Sample reading room · Clark County",
          source: "Sample library calendar",
        },
      ],
    },
    markets: {
      provenance: sample(
        "Synthetic market fixture",
        "Illustrative sample stock prices only, not observations from a quote provider.",
      ),
      items: [
        {
          symbol: "TSLA",
          name: "Tesla",
          value: 284.16,
          change: 1.24,
          kind: "stock",
          session: "2026-11-04 regular close · sample",
          asOf: "2026-11-04T13:00:00-08:00",
          freshness: "Synthetic previous close",
        },
        {
          symbol: "SPCX",
          name: "SpaceX",
          value: 112.34,
          change: -0.62,
          kind: "stock",
          session: "2026-11-04 regular close · sample",
          asOf: "2026-11-04T13:00:00-08:00",
          freshness: "Synthetic previous close",
        },
      ],
    },
    projects: {
      provenance: sample(
        "Synthetic project evidence",
        "Example activity covering the previous 24 hours. No folders or repositories have been read.",
      ),
      items: [
        {
          id: "receipt-summary",
          name: "Receipt Summary",
          progress: "Configured seven briefing blocks and a paper-width study.",
          next: "Compare the two type sizes on paper.",
          evidence: "Sample commit a1b2c3 · layout notes",
          asOf: "2026-11-04T18:10:00-08:00",
        },
        {
          id: "home-dashboard",
          name: "Home Dashboard",
          progress: "Added a room-temperature card and clearer device status.",
          blocker: "Waiting for the sample sensor bridge.",
          evidence: "Sample PR #12 · dated design note",
          asOf: "2026-11-04T17:30:00-08:00",
        },
        {
          id: "garden-log",
          name: "Garden Log",
          progress: "Recorded watering history and a weekly planting view.",
          next: "Review the date filter with a full week.",
          evidence: "Sample commit d4e5f6 · passing sample check",
          asOf: "2026-11-04T16:00:00-08:00",
        },
        {
          id: "budget-notes",
          name: "Budget Notes",
          progress: "Grouped recurring expenses into a monthly view.",
          next: "Check the fictional annual renewal dates.",
          evidence: "Sample issue #8 · dated work note",
          asOf: "2026-11-04T15:20:00-08:00",
        },
        {
          id: "weekend-map",
          name: "Weekend Map",
          progress: "Added a saved-places list with printable directions.",
          blocker: "Sample trail data needs review.",
          evidence: "Sample PR #3 · dated blocker note",
          asOf: "2026-11-04T14:00:00-08:00",
        },
      ],
    },
  };
}
