import { MarketSnapshot } from "./MarketSnapshot";
import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  CalendarDays,
  Check,
  CloudSun,
  FolderGit2,
  MapPin,
  Newspaper,
  TrendingUp,
  Scissors,
  Sparkles,
} from "lucide-react";
import type {
  BlockConfig,
  BlockId,
  BriefingData,
  Config,
} from "../types";
import { WeatherIcon } from "./WeatherIcon";
import { CalendarDetails } from "./CalendarDetails";
import { BriefingSummary } from "./BriefingSummary";
import { calendarDayLabel } from "../calendar-presentation";
import "./receipt.css";

const icons = {
  summary: Sparkles,
  weather: CloudSun,
  calendar: CalendarDays,
  tasks: Check,
  news: Newspaper,
  events: MapPin,
  markets: TrendingUp,
  projects: FolderGit2,
};
const titles: Record<BlockId, string> = {
  summary: "AI summary",
  weather: "The forecast",
  calendar: "On your calendar",
  tasks: "Reminders",
  news: "The headlines",
  events: "Around you",
  markets: "Market snapshot",
  projects: "Moving forward",
};
const conditions = {
  rain: "Rain",
  clear: "Clear skies",
  cloudy: "Cloudy",
  storm: "Thunderstorms",
  night: "Clear night",
};

function stamp(value: string | undefined) {
  if (!value) return "Time not supplied";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(date);
}

function dateLabel(value: string, weekday = false) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    ...(weekday ? { weekday: "long" as const } : {}),
    month: weekday ? "long" : "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="receipt-empty">{children}</p>;
}

function Content({
  block,
  config,
  data,
}: {
  block: BlockConfig;
  config: Config;
  data: BriefingData;
}) {
  const limit = Math.max(0, Math.floor(block.limit));
  const temperature = (f: number) =>
    Math.round(config.weather.units === "celsius" ? ((f - 32) * 5) / 9 : f);
  const unit = config.weather.units === "celsius" ? "C" : "F";
  switch (block.id) {
    case "summary":
      return data.summary.text
        ? <BriefingSummary summary={data.summary} />
        : <Empty>{data.summary.provenance.note || "Summary unavailable. Connect OpenAI in AI summary settings."}</Empty>;
    case "weather": {
      const w = data.weather;
      const days = w.days.slice(0, Math.min(4, limit));
      return (
        <>
          <div className="receipt-weather-location">{w.location}</div>
          <div className="receipt-weather-current">
            <WeatherIcon condition={w.condition} size={43} />
            <div>
              <strong>
                {temperature(w.temperature)}°{unit}
              </strong>
              <span>{conditions[w.condition]}</span>
            </div>
          </div>
          <div className="receipt-weather-details">
            Feels {temperature(w.feelsLike)}° · Wind{" "}
            {config.weather.units === "celsius"
              ? `${Math.round(w.wind * 1.60934)} km/h`
              : `${Math.round(w.wind)} mph`}
            <br />
            Humidity {w.humidity}%
            {w.provenance.mode === "live" && <>
              <br />
              As of {stamp(w.provenance.observedAt || w.provenance.retrievedAt)} · <a href={w.provenance.url} target="_blank" rel="noreferrer">Open-Meteo</a>
            </>}
          </div>
          <table className="receipt-forecast">
            <thead>
              <tr>
                <th>Day</th>
                <th aria-label="Conditions"></th>
                <th>Hi / Lo</th>
                <th>Rain</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{day.label}</th>
                  <td>
                    <WeatherIcon condition={day.condition} size={19} />
                  </td>
                  <td>
                    {temperature(day.high)}° / {temperature(day.low)}°
                  </td>
                  <td>{day.precipitation}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }
    case "calendar": {
      if (data.calendar.provenance.mode === "unavailable") return <Empty>{data.calendar.provenance.note || "Calendar unavailable."}</Empty>;
      const live = data.calendar.provenance.mode === "live";
      const matching = data.calendar.items
        .filter((item) => live ? config.sources.calendarIds.includes(item.calendarId ?? "") : config.sources.calendars.includes(item.calendar));
      const items = matching.slice(0, limit);
      const today = data.calendar.date ?? data.weather.days[0]?.date ?? data.calendar.provenance.retrievedAt.slice(0, 10);
      const itemDate = (item: typeof items[number]) => item.date ?? today;
      return items.length ? (
        <div className="receipt-agenda">
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {(index === 0 || itemDate(items[index - 1]) !== itemDate(item)) && <div className="receipt-agenda-day">{calendarDayLabel(itemDate(item), today)}</div>}
              <div className="receipt-agenda-item">
                <div className="receipt-time">
                  {item.allDay ? "ALL DAY" : item.time}
                  {!item.allDay && item.end && <span>{item.end}</span>}
                  {item.ongoing && <span>ONGOING</span>}
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <CalendarDetails item={item} travel={config.sources.calendarTravel} />
                </div>
              </div>
            </Fragment>
          ))}
          {matching.length > items.length && <p className="receipt-detail">{matching.length - items.length} more {matching.length - items.length === 1 ? "event" : "events"} in this window. Increase Items to include to show them.</p>}
        </div>
      ) : (
        <Empty>{live ? config.sources.calendarIds.length ? "No appointments today through the next four days in the selected calendars." : "Choose calendars in Sources to include today and the next four days." : "No sample appointments in the selected calendars."}</Empty>
      );
    }
    case "tasks": {
      if (data.tasks.provenance.mode === "unavailable") return <><Empty>{data.tasks.provenance.note || "Reminders unavailable."}</Empty>{data.tasks.provenance.observedAt && <p className="receipt-detail">Last snapshot: {stamp(data.tasks.provenance.observedAt)}</p>}</>;
      const live = data.tasks.provenance.mode === "live";
      const matching = data.tasks.items
        .filter((item) => (live ? config.sources.reminderLists : config.sources.taskLists).includes(item.list));
      const items = matching.slice(0, limit);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const tomorrowDate = new Date(`${today}T12:00:00Z`);
      tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
      const tomorrow = tomorrowDate.toISOString().slice(0, 10);
      const weekday = (day: string) => new Intl.DateTimeFormat("en-US", {
        weekday: "long", timeZone: "UTC",
      }).format(new Date(`${day}T12:00:00Z`)).toUpperCase();
      return <>
        {live && <p className="receipt-detail">Snapshot: {stamp(data.tasks.capturedAt ?? data.tasks.provenance.observedAt)}</p>}
        {live && <p className="receipt-detail">Overdue · Today · Next 4 days</p>}
        {items.length ? (
        <ul className="receipt-tasks">
          {items.map((item) => (
            <li key={item.id} className={item.completed ? "receipt-task-completed" : undefined}>
              <span className="receipt-checkbox" role="img" aria-label={item.completed ? "Completed reminder" : "Incomplete reminder"}>{item.completed && <Check size={9} strokeWidth={3} aria-hidden="true" />}</span>
              <div>
                <strong>{item.title}</strong>
                <div className="receipt-detail">
                  {item.completed && "COMPLETED · "}
                  {item.dueStatus === "upcoming" ? item.due === tomorrow ? "TOMORROW" : weekday(item.due) : item.overdue ? "OVERDUE" : "DUE TODAY"} · {item.due} ·{" "}
                  {item.list}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{live ? config.sources.reminderLists.length ? "No overdue reminders or items due today through the next four days in the selected lists." : "Choose reminder lists in Tasks settings after uploading." : "No sample tasks in the selected lists."}</Empty>
      )}
      {matching.length > items.length && <p className="receipt-detail">{matching.length - items.length} more reminders in this window. Increase Items to include to show them.</p>}
      </>;
    }
    case "news": {
      if (data.news.provenance.mode === "unavailable") return <Empty>Unavailable. {data.news.provenance.note}</Empty>;
      const items = data.news.items
        .filter((item) => config.sources.newsCategories.includes(item.category))
        .slice(0, Math.min(5, limit));
      return items.length ? (
        <ol className="receipt-headlines">
          {items.map((item) => (
            <li key={item.id}>
              <strong>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </strong>
              {item.description && <p className="receipt-news-excerpt">{item.description}</p>}
              <div className="receipt-detail receipt-news-date">{stamp(item.publishedAt)}</div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>No headlines in the selected categories.</Empty>
      );
    }
    case "events": {
      const anchor =
        data.events.provenance.observedAt || data.events.provenance.retrievedAt;
      const start = anchor.slice(0, 10);
      const endDate = new Date(`${start}T12:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + config.sources.eventsDays);
      const end = endDate.toISOString().slice(0, 10);
      const items = data.events.items
        .filter(
          (item) =>
            item.date.slice(0, 10) >= start && item.date.slice(0, 10) < end,
        )
        .slice(0, limit);
      return (
        <>
          <p className="receipt-local-area">
            {config.sources.localArea}
            <br />
            {config.sources.county}, {config.sources.state} · next{" "}
            {config.sources.eventsDays} days
          </p>
          {items.length ? (
            <div className="receipt-events">
              {items.map((item) => (
                <div className="receipt-event" key={item.id}>
                  <div className="receipt-detail receipt-event-date">
                    {dateLabel(item.date)} · {item.time}
                  </div>
                  <strong>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </strong>
                  <div className="receipt-detail">
                    {item.venue}
                    <br />
                    {item.source}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No sample events in this window.</Empty>
          )}
        </>
      );
    }
    case "markets": {
      if (data.markets.provenance.mode === "unavailable") return <Empty>Unavailable</Empty>;
      const selected = config.sources.stocks.map((symbol) =>
        symbol.toUpperCase(),
      );
      const items = data.markets.items.filter(
        (item) =>
          item.kind === "stock" && selected.includes(item.symbol.toUpperCase()),
      );
      return <MarketSnapshot items={items} />;
    }
    case "projects": {
      const folders = config.sources.projects.filter(
        (folder) => folder.enabled,
      );
      const items = data.projects.items
        .filter((item) => folders.some((folder) => folder.id === item.id))
        .slice(0, Math.min(5, limit));
      const unknown = folders.filter(
        (folder) => !data.projects.items.some((item) => item.id === folder.id),
      );
      return (
        <>
          <p className="receipt-detail">
            Synthetic activity · preceding 24 hours.
            <br />
            Configured folders are not scanned.
          </p>
          {items.length ? (
            <div className="receipt-projects">
              {items.map((item) => (
                <div className="receipt-project" key={item.id}>
                  <strong>
                    {folders.find((folder) => folder.id === item.id)?.name ||
                      item.name}
                  </strong>
                  <p>{item.progress}</p>
                  {item.next && (
                    <p>
                      <b>Next:</b> {item.next}
                    </p>
                  )}
                  {item.blocker && (
                    <p>
                      <b>Blocker:</b> {item.blocker}
                    </p>
                  )}
                  <div className="receipt-detail">
                    {item.evidence} · {stamp(item.asOf)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No matching sample projects selected.</Empty>
          )}
          {unknown.map((folder) => (
            <p className="receipt-detail" key={folder.id}>
              {folder.name} · Configured; no synthetic activity fixture.
            </p>
          ))}
        </>
      );
    }
  }
}

function ReceiptDate({ date }: { date: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = heading.current!;
    const label = text.current!;
    const fit = () => {
      element.style.fontSize = "";
      const available = element.clientWidth - 1;
      if (available > 0 && label.offsetWidth > available) {
        const fontSize = parseFloat(getComputedStyle(element).fontSize);
        element.style.fontSize = `${fontSize * available / label.offsetWidth}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [date]);
  return <h2 ref={heading}><span ref={text}>{date}</span></h2>;
}

export function ReceiptPreview({
  config,
  data,
}: {
  config: Config;
  data: BriefingData;
}) {
  const paper = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = paper.current;
    if (!element) return;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const zoom = Math.min(2, Math.max(0.5, config.printer.zoom));
  const widthPx = (config.printer.paperWidth * 96) / 25.4;
  const editionDate =
    (config.sources.calendarMode === "live" ? data.calendar.date : undefined) ||
    data.weather.days[0]?.date ||
    data.weather.provenance.retrievedAt.slice(0, 10);
  const enabled = config.blocks.filter((block) => block.enabled);
  const newsBlock = enabled.find(block => block.id === "news");
  const guardianCopyright = newsBlock && data.news.provenance.mode === "live"
    ? [...new Set(data.news.items.filter(item => config.sources.newsCategories.includes(item.category))
      .slice(0, Math.min(5, newsBlock.limit)).filter(item => item.publisher === "The Guardian")
      .map(item => item.copyright || item.publisher))].join(" / ")
    : "";
  const style = {
    "--receipt-paper-width": `${config.printer.paperWidth}mm`,
    "--receipt-content-width": `${Math.min(config.printer.contentWidth, config.printer.paperWidth - 4)}mm`,
    "--receipt-font-size": `${config.printer.fontSize}px`,
  } as CSSProperties;
  return (
    <div className="receipt-preview" style={style}>
      <div className="receipt-measure-label">
        <span>{config.printer.paperWidth} mm paper</span>
        <span>{config.printer.contentWidth} mm printable</span>
      </div>
      <div
        className="receipt-scale-space"
        style={{
          width: widthPx * zoom,
          height: height ? height * zoom : undefined,
        }}
      >
        <article
          aria-label="Live receipt preview"
          className="receipt-paper"
          ref={paper}
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="receipt-content">
            <header className="receipt-header">
              <ReceiptDate date={dateLabel(editionDate, true)} />
              <div className="receipt-rule-heavy" />
            </header>
            {enabled.length === 0 && (
              <p className="receipt-empty">
                Your page is clear. Enable a block to compose your briefing.
              </p>
            )}
            {enabled.map((block) => {
              const Icon = icons[block.id];
              return (
                <section
                  className={`receipt-block receipt-density-${block.density}`}
                  data-receipt-block={block.id}
                  key={block.id}
                >
                  <h3>
                    <Icon size={15} strokeWidth={2} />
                    {titles[block.id]}
                    <span className="receipt-data-mode" title={[
                      data[block.id].provenance.source,
                      `Retrieved: ${stamp(data[block.id].provenance.retrievedAt)}`,
                      data[block.id].provenance.observedAt ? `As of: ${stamp(data[block.id].provenance.observedAt)}` : '',
                      data[block.id].provenance.note,
                    ].filter(Boolean).join('\n')}>{data[block.id].provenance.mode === "sample" ? "Sample" : block.id === "markets" ? data.markets.marketStatus ?? "Unknown" : data[block.id].provenance.mode === "unavailable" ? "Unavailable" : "Live"}</span>
                  </h3>
                  <Content block={block} config={config} data={data} />
                  {block.note && (
                    <p className="receipt-block-note">{block.note}</p>
                  )}
                </section>
              );
            })}
            <footer className="receipt-footer">
              <div className="receipt-rule-heavy" />
              <p>
                {config.printer.footer || "Make a little room for a good day."}
              </p>
              <span>RECEIPT SUMMARY</span>
              {guardianCopyright && <p className="receipt-guardian-credit">News © <a href="https://www.theguardian.com/" target="_blank" rel="noreferrer">{guardianCopyright}</a></p>}
              <div className="receipt-cut">
                <Scissors size={13} />
                <span />
              </div>
            </footer>
          </div>
        </article>
      </div>
      <div className="receipt-length" aria-live="polite">
        ≈ {((height * 25.4) / 96 / 10).toFixed(1)} cm of paper{" "}
        <span>· no length limit</span>
      </div>
    </div>
  );
}
