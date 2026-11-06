import { XMLParser } from "fast-xml-parser";
import { createSampleData } from "../src/data/fixtures";
import type {
  BriefingData,
  Condition,
  NewsItem,
  WeatherData,
} from "../src/types";

type Fetcher = typeof fetch;
const TIMEOUT_MS = 6000;
export const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=36.11&longitude=-115.28&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles&timeformat=unixtime&forecast_days=4";
export const NEWS_URL = "https://www.nasa.gov/feed/";

export function weatherCondition(code: number, isDay = true): Condition {
  if ([71, 73, 75, 77, 85, 86].includes(code))
    throw new Error(
      "The provider reports snow; this first weather studio does not support a snow treatment yet.",
    );
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  if (code >= 2) return "cloudy";
  return isDay ? "clear" : "night";
}

function finite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Invalid provider field: ${name}`);
  return value;
}

/** Generation-time policy only; exchange holidays/closures require a future provider calendar. */
export function marketRequestPolicy(
  at: Date,
): "previous-close" | "current-opening" {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return hour * 60 + minute < 390 ? "previous-close" : "current-opening";
}

async function request(url: string, fetcher: Fetcher) {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent": "ReceiptSummary/0.1 (personal local briefing prototype)",
      Accept:
        url === NEWS_URL
          ? "application/rss+xml, application/xml, text/xml"
          : "application/json",
    },
  });
  if (!response.ok)
    throw new Error(`Provider returned HTTP ${response.status}`);
  return response;
}

function fallbackReason(error: unknown) {
  return error instanceof Error && error.name === "TimeoutError"
    ? "Public source timed out after six seconds."
    : error instanceof Error
      ? error.message
      : "Public source could not be reached.";
}

export function transformWeather(raw: any, retrievedAt: string): WeatherData {
  const c = raw.current,
    d = raw.daily;
  if (!c || !d || !Array.isArray(d.time) || d.time.length < 4)
    throw new Error("Forecast did not include four days.");
  const dateLabel = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  return {
    provenance: {
      mode: "live",
      source: "Open-Meteo · CC BY 4.0",
      url: "https://open-meteo.com/",
      retrievedAt,
      observedAt: new Date(finite(c.time, "current.time") * 1000).toISOString(),
      note: "Model-derived conditions and forecast. Approximate ZIP 89147 area (36.11, −115.28), not a street-level observation.",
    },
    location: "Spring Valley area · 89147",
    temperature: finite(c.temperature_2m, "temperature"),
    feelsLike: finite(c.apparent_temperature, "apparent_temperature"),
    humidity: finite(c.relative_humidity_2m, "humidity"),
    wind: finite(c.wind_speed_10m, "wind"),
    condition: weatherCondition(
      finite(c.weather_code, "weather_code"),
      c.is_day === 1,
    ),
    days: d.time.slice(0, 4).map((time: unknown, i: number) => {
      const date = new Date(finite(time, "daily.time") * 1000);
      return {
        date: dateLabel(date),
        label:
          i === 0
            ? "Today"
            : new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                timeZone: "America/Los_Angeles",
              }).format(date),
        condition: weatherCondition(
          finite(d.weather_code?.[i], "daily.weather_code"),
        ),
        high: finite(d.temperature_2m_max?.[i], "high"),
        low: finite(d.temperature_2m_min?.[i], "low"),
        precipitation: finite(
          d.precipitation_probability_max?.[i],
          "precipitation",
        ),
      };
    }),
  };
}

export async function getWeather(
  zip = "89147",
  fetcher: Fetcher = fetch,
  offline = false,
): Promise<WeatherData> {
  try {
    if (offline) throw new Error("Offline test mode is enabled.");
    if (zip !== "89147")
      throw new Error(
        "Live ZIP lookup is not connected yet. Live coverage currently supports 89147 only.",
      );
    return transformWeather(
      await (await request(WEATHER_URL, fetcher)).json(),
      new Date().toISOString(),
    );
  } catch (error) {
    const data = createSampleData().weather;
    data.provenance.note = `${fallbackReason(error)} Showing synthetic 89147 demonstration, not weather for the requested ZIP.`;
    return data;
  }
}

export function parseNews(xml: string, now = new Date()): NewsItem[] {
  if (xml.length > 2_000_000)
    throw new Error("News feed exceeded the size limit.");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
  }).parse(xml);
  const entries = parsed?.rss?.channel?.item;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  const seen = new Set<string>();
  return list
    .flatMap((entry: any): NewsItem[] => {
      const title =
        typeof entry.title === "string"
          ? entry.title.replace(/<[^>]*>/g, "").trim()
          : "";
      const link = typeof entry.link === "string" ? entry.link : "";
      const time = new Date(entry.pubDate).getTime();
      // A new retrieval must never turn an old or future-dated item into fresh news.
      if (
        !title ||
        !/^https:\/\/(www\.)?(nasa\.gov|science\.nasa\.gov)\//.test(link) ||
        !Number.isFinite(time) ||
        time > now.getTime() ||
        time < now.getTime() - 86_400_000 ||
        seen.has(link)
      )
        return [];
      seen.add(link);
      return [
        {
          id: link,
          title,
          description: typeof entry.description === "string" ? entry.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200) : undefined,
          publisher: "NASA · official announcement",
          category: /spacex|tesla/i.test(title) ? "companies" : "technology",
          publishedAt: new Date(time).toISOString(),
          url: link,
          sample: false,
        },
      ];
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 5);
}

export async function getNews(
  fetcher: Fetcher = fetch,
  offline = false,
): Promise<BriefingData["news"]> {
  try {
    if (offline) throw new Error("Offline test mode is enabled.");
    const xml = await (await request(NEWS_URL, fetcher)).text();
    const now = new Date();
    const items = parseNews(xml, now);
    if (!items.length)
      throw new Error(
        "NASA feed had no usable headlines from the preceding 24 hours.",
      );
    return {
      provenance: {
        mode: "live",
        source: "NASA RSS · official announcements",
        retrievedAt: now.toISOString(),
        url: "https://www.nasa.gov/rss-feeds/",
        note: "Partial news coverage: NASA technology/space announcements only. General, business, Tesla and local reporting are not connected. Headlines, original links and short RSS excerpts only; full articles are not collected.",
      },
      items,
    };
  } catch (error) {
    const data = createSampleData().news;
    data.provenance.note = `${fallbackReason(error)} Showing invented demonstration headlines, not live reporting.`;
    return data;
  }
}
