import test from "node:test";
import assert from "node:assert/strict";
import {
  getWeather,
  getNews,
  marketRequestPolicy,
  parseNews,
  transformWeather,
  weatherCondition,
} from "../server/adapters";

test("weather codes share the same reusable condition model", () => {
  assert.equal(weatherCondition(63), "rain");
  assert.equal(weatherCondition(95), "storm");
  assert.equal(weatherCondition(3), "cloudy");
  assert.equal(weatherCondition(0, false), "night");
  assert.throws(() => weatherCondition(73), /snow/);
});
test("market cutoff uses Pacific time including daylight saving", () => {
  assert.equal(
    marketRequestPolicy(new Date("2026-11-05T14:29:59Z")),
    "previous-close",
  );
  assert.equal(
    marketRequestPolicy(new Date("2026-11-05T14:30:00Z")),
    "current-opening",
  );
  assert.equal(
    marketRequestPolicy(new Date("2026-07-05T13:29:59Z")),
    "previous-close",
  );
  assert.equal(
    marketRequestPolicy(new Date("2026-07-05T13:30:00Z")),
    "current-opening",
  );
});
test("weather failure and unsupported ZIP retain populated, explicitly sample content", async () => {
  const failure = (async () => {
    throw new Error("Network disconnected");
  }) as typeof fetch;
  const weather = await getWeather("89147", failure);
  assert.equal(weather.provenance.mode, "sample");
  assert.equal(weather.days.length, 4);
  assert.match(weather.provenance.note!, /Network disconnected/);
  const unknown = await getWeather("90210", failure);
  assert.match(unknown.provenance.note!, /89147 only/);
});
test("invalid provider values never become live weather", () => {
  assert.throws(() =>
    transformWeather(
      { current: {}, daily: { time: [1, 2, 3, 4] } },
      new Date().toISOString(),
    ),
  );
});
test("weather transformation preserves model time and exactly four local forecast dates", () => {
  const time = Date.parse("2026-11-05T08:00:00Z") / 1000;
  const data = transformWeather(
    {
      current: {
        time,
        temperature_2m: 64,
        apparent_temperature: 62,
        relative_humidity_2m: 45,
        wind_speed_10m: 8,
        weather_code: 0,
        is_day: 0,
      },
      daily: {
        time: [time, time + 86400, time + 172800, time + 259200],
        weather_code: [0, 3, 63, 95],
        temperature_2m_max: [70, 68, 62, 60],
        temperature_2m_min: [50, 48, 47, 46],
        precipitation_probability_max: [0, 5, 80, 95],
      },
    },
    "2026-11-05T08:05:00Z",
  );
  assert.equal(data.provenance.mode, "live");
  assert.equal(data.condition, "night");
  assert.equal(data.provenance.observedAt, "2026-11-05T08:00:00.000Z");
  assert.equal(data.days[0].date, "2026-11-05");
  assert.equal(data.days.length, 4);
  assert.equal(data.days[3].condition, "storm");
});
test("news retains original publication times, excludes old/future items and deduplicates", () => {
  const entry = (title: string, date: string, link: string) =>
    `<item><title>${title}</title><description><![CDATA[<p>Short source excerpt.</p>]]></description><pubDate>${date}</pubDate><link>${link}</link></item>`;
  const xml = `<rss><channel>${entry("A new instrument", "Thu, 05 Nov 2026 12:00:00 GMT", "https://www.nasa.gov/a/")}${entry("Duplicate", "Thu, 05 Nov 2026 12:00:00 GMT", "https://www.nasa.gov/a/")}${entry("Old", "Mon, 02 Nov 2026 12:00:00 GMT", "https://www.nasa.gov/old/")}${entry("Future", "Mon, 09 Nov 2026 12:00:00 GMT", "https://www.nasa.gov/future/")}</channel></rss>`;
  const items = parseNews(xml, new Date("2026-11-05T14:00:00Z"));
  assert.equal(items.length, 1);
  assert.equal(items[0].sample, false);
  assert.equal(items[0].publishedAt, "2026-11-05T12:00:00.000Z");
  assert.equal(items[0].description, "Short source excerpt.");
});
test("news network failure returns complete labeled fixtures", async () => {
  const data = await getNews((async () => {
    throw new Error("offline");
  }) as typeof fetch);
  assert.equal(data.provenance.mode, "sample");
  assert.equal(data.items.length, 5);
  assert.ok(data.items.every((item) => item.sample));
});
