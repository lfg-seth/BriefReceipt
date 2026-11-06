import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CircleHelp,
  FileSliders,
  Radio,
  ReceiptText,
  Settings2,
  SlidersHorizontal,
  Timer,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { defaultConfig, loadConfig, saveConfig } from "./config";
import type { BlockId, BriefingData, Config, WeatherData } from "./types";
import { createSampleData } from "./data/fixtures";
import { BlockEditor } from "./components/BlockEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { ReceiptPreview } from "./components/ReceiptPreview";
import { WeatherScene } from "./components/WeatherScene";
import { briefingSummarySections } from "./briefing-summary";
type Tab = "blocks" | "sources" | "schedule" | "printer";
const tabs = [
  { id: "blocks", label: "Compose", icon: SlidersHorizontal },
  { id: "sources", label: "Sources", icon: Radio },
  { id: "schedule", label: "Schedule", icon: Timer },
  { id: "printer", label: "Paper & printer", icon: Settings2 },
] as const;
async function getData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Source responded ${response.status}`);
  return response.json() as Promise<T>;
}
export default function App() {
  const [config, setConfig] = useState(() => {
    try {
      return loadConfig(localStorage);
    } catch {
      return structuredClone(defaultConfig);
    }
  });
  const [selected, setSelected] = useState<BlockId>("weather");
  const [tab, setTab] = useState<Tab>("blocks");
  const [saved, setSaved] = useState(true);
  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
  const [liveNews, setLiveNews] = useState<BriefingData["news"] | null>(null);
  const [liveMarkets, setLiveMarkets] = useState<BriefingData["markets"] | null>(null);
  const [marketRefresh, setMarketRefresh] = useState(0);
  const [liveCalendar, setLiveCalendar] = useState<BriefingData["calendar"] | null>(null);
  const [liveTasks, setLiveTasks] = useState<BriefingData["tasks"] | null>(null);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [calendarDay, setCalendarDay] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()));
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [help, setHelp] = useState(false);
  const [briefingSummary, setBriefingSummary] = useState<{ input: string; result: BriefingData["summary"] }>();
  const calendarBlock = config.blocks.find(block => block.id === "calendar")!;
  const summaryLimit = calendarBlock.enabled ? calendarBlock.limit : 0;
  const marketsEnabled = config.blocks.some(block => block.id === "markets" && block.enabled);
  const stockSymbols = JSON.stringify(config.sources.stocks);
  useEffect(() => {
    try {
      setSaved(saveConfig(localStorage, config));
    } catch {
      setSaved(false);
    }
  }, [config]);
  const sample = useMemo(
    () => createSampleData(config.weather.condition),
    [config.weather.condition],
  );
  useEffect(() => {
    const timer = setInterval(() => setCalendarDay(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date())), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setLiveCalendar(null);
    if (config.sources.calendarMode !== "live") return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);
    fetch("/api/icloud/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendarIds: config.sources.calendarIds, summaryLimit }), signal: controller.signal })
      .then(async response => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Calendar unavailable.");
        if (active) setLiveCalendar(value);
      })
      .catch(error => {
        if (active) setLiveCalendar({ provenance: { mode: "unavailable", source: "iCloud Calendar", retrievedAt: new Date().toISOString(), note: error.name === "AbortError" ? "Calendar request timed out. Refresh to try again." : error.message || "Calendar unavailable. Check your connection." }, items: [] });
      })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [config.sources.calendarMode, config.sources.calendarIds, calendarRefresh, calendarDay, summaryLimit]);
  useEffect(() => {
    setLiveTasks(null);
    if (config.sources.tasksMode !== "live") return;
    let active = true;
    const controllers = new Set<AbortController>();
    const collect = async () => {
      const controller = new AbortController(); controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/reminders/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lists: config.sources.reminderLists }), signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Reminders unavailable.");
        if (active) setLiveTasks(value);
      } catch {
        if (active) setLiveTasks({ provenance: { mode: "unavailable", source: "Apple Reminders Shortcut", retrievedAt: new Date().toISOString(), note: "Could not load Reminders. Check the local server and run the Shortcut again." }, items: [] });
      } finally { clearTimeout(timer); controllers.delete(controller); }
    };
    void collect();
    const poll = setInterval(() => { void collect(); }, 15000);
    return () => { active = false; clearInterval(poll); controllers.forEach(controller => controller.abort()); };
  }, [config.sources.tasksMode, config.sources.reminderLists]);
  useEffect(() => {
    setLiveWeather(null);
    if (config.weather.mode !== "live") {
      setWeatherLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    setWeatherLoading(true);
    getData<WeatherData>(
      `/api/weather?zip=${encodeURIComponent(config.weather.zip)}`,
      controller.signal,
    )
      .then((value) => {
        if (active) setLiveWeather(value);
      })
      .catch(() => {
        if (active)
          setLiveWeather({
            ...createSampleData(config.weather.condition).weather,
            provenance: {
              ...createSampleData().weather.provenance,
              note: "Live request failed or timed out. Showing synthetic demonstration data.",
            },
          });
      })
      .finally(() => {
        if (active) setWeatherLoading(false);
        clearTimeout(timer);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [config.weather.mode, config.weather.zip, refresh]);
  useEffect(() => {
    setLiveNews(null);
    if (config.sources.newsMode !== "live") {
      setNewsLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    setNewsLoading(true);
    getData<BriefingData["news"]>("/api/news", controller.signal)
      .then((value) => {
        if (active) setLiveNews(value);
      })
      .catch(() => {
        if (active)
          setLiveNews({
            provenance: {
              mode: "unavailable", source: "The Guardian", retrievedAt: new Date().toISOString(),
              note: "Live request failed or timed out. Refresh headlines to retry.",
            },
            items: [],
          });
      })
      .finally(() => {
        if (active) setNewsLoading(false);
        clearTimeout(timer);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [config.sources.newsMode, refresh]);
  useEffect(() => {
    setLiveMarkets(null);
    if (config.sources.marketsMode !== "live" || !marketsEnabled) return;
    let active = true;
    const controllers = new Set<AbortController>();
    const collect = async () => {
      const controller = new AbortController(); controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch("/api/alpaca/markets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbols: JSON.parse(stockSymbols) }), signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Markets unavailable.");
        if (active) setLiveMarkets(value);
      } catch (error) {
        if (active) setLiveMarkets({ provenance: { mode: "unavailable", source: "Alpaca · IEX", retrievedAt: new Date().toISOString(), note: error instanceof Error && error.name !== "AbortError" ? error.message : "Markets timed out. Refresh markets to retry." }, items: [] });
      } finally { clearTimeout(timer); controllers.delete(controller); }
    };
    // Coalesce edits to the comma-separated watchlist.
    const debounce = setTimeout(() => { void collect(); }, 450);
    const poll = setInterval(() => { void collect(); }, 60000);
    return () => { active = false; clearTimeout(debounce); clearInterval(poll); controllers.forEach(controller => controller.abort()); };
  }, [config.sources.marketsMode, stockSymbols, marketsEnabled, marketRefresh, refresh, calendarDay]);
  const data = useMemo<BriefingData>(
    () => ({
      ...sample,
      markets: config.sources.marketsMode === "live" ? liveMarkets ?? { provenance: { mode: "unavailable", source: "Alpaca · IEX", retrievedAt: new Date().toISOString(), note: "Loading market prices and history…" }, items: [] } : sample.markets,
      calendar: config.sources.calendarMode === "live" ? liveCalendar ?? { provenance: { mode: "unavailable", source: "iCloud Calendar", retrievedAt: new Date().toISOString(), note: "Loading today’s calendar…" }, items: [] } : sample.calendar,
      tasks: config.sources.tasksMode === "live" ? liveTasks ?? { provenance: { mode: "unavailable", source: "Apple Reminders Shortcut", retrievedAt: new Date().toISOString(), note: "Loading Reminders snapshot…" }, items: [] } : sample.tasks,
      weather:
        config.weather.mode === "live" && liveWeather
          ? liveWeather
          : sample.weather,
      news:
        config.sources.newsMode === "live" ? liveNews ?? { provenance: { mode: "unavailable", source: "The Guardian", retrievedAt: new Date().toISOString(), note: "Loading Guardian headlines…" }, items: [] } : sample.news,
    }),
    [
      sample,
      liveWeather,
      liveNews,
      liveMarkets,
      config.sources.marketsMode,
      liveCalendar,
      liveTasks,
      config.sources.tasksMode,
      config.sources.calendarMode,
      config.weather.mode,
      config.sources.newsMode,
    ],
  );
  const summaryEnabled = config.blocks.some(block => block.id === "summary" && block.enabled);
  const summaryInput = JSON.stringify(briefingSummarySections(config, data));
  const sourceLoading = config.blocks.some(block => block.enabled && (
    (block.id === "weather" && config.weather.mode === "live" && (!liveWeather || weatherLoading)) ||
    (block.id === "calendar" && config.sources.calendarMode === "live" && !liveCalendar) ||
    (block.id === "tasks" && config.sources.tasksMode === "live" && !liveTasks)
    || (block.id === "markets" && config.sources.marketsMode === "live" && !liveMarkets)
  ));
  useEffect(() => {
    setBriefingSummary(undefined);
    if (!summaryEnabled || sourceLoading) return;
    let active = true;
    const controller = new AbortController();
    // Coalesce quick selection and layout edits into a single request.
    const debounce = setTimeout(async () => {
      const timeout = setTimeout(() => controller.abort(), 95000);
      try {
        const response = await fetch("/api/ai/briefing-summary", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections: JSON.parse(summaryInput) }), signal: controller.signal,
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Briefing summary unavailable.");
        if (!value.provenance || typeof value.text !== "string") throw new Error("Briefing summary unavailable. Try refreshing.");
        if (active) setBriefingSummary({ input: summaryInput, result: value });
      } catch (error) {
        if (active) setBriefingSummary({ input: summaryInput, result: { text: "", provenance: {
          mode: "unavailable", source: "OpenAI", retrievedAt: new Date().toISOString(),
          note: error instanceof Error && error.name !== "AbortError" ? error.message : "Briefing summary timed out. Try refreshing.",
        } } });
      } finally { clearTimeout(timeout); }
    }, 700);
    return () => { active = false; clearTimeout(debounce); controller.abort(); };
  }, [summaryInput, summaryEnabled, sourceLoading, calendarRefresh]);
  const receiptData = { ...data, summary: !sourceLoading && briefingSummary?.input === summaryInput ? briefingSummary.result : data.summary };
  function change(next: Config) {
    setConfig(next);
  }
  function exportConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "receipt-summary.config.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const liveCount =
    Number(data.tasks.provenance.mode === "live") +
    Number(data.calendar.provenance.mode === "live") +
    Number(data.weather.provenance.mode === "live") +
    Number(data.news.provenance.mode === "live");
  const totalLiveCount = liveCount + Number(data.markets.provenance.mode === "live");
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("blocks");
          }}
        >
          <span className="brand-mark">
            <ReceiptText size={24} />
          </span>
          <span>
            Receipt Summary<small>YOUR MORNING, COMPOSED.</small>
          </span>
        </a>
        <nav aria-label="Workspace">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={tab === id ? "active" : ""}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <button
          className="help-button"
          title="About this workspace"
          onClick={() => setHelp(!help)}
        >
          <CircleHelp size={20} />
        </button>
      </header>
      {help && (
        <aside className="help-banner">
          <strong>A local workspace for your morning briefing.</strong>{" "}
          Configuration is saved in this browser. iCloud Calendar, Reminders snapshots, public weather
          Guardian headlines and Alpaca markets are optional live sources. Other blocks use synthetic
          samples. Folder scanning, scheduled jobs and physical printing do not run here.
          <button onClick={() => setHelp(false)}>Got it</button>
        </aside>
      )}
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              THE MORNING EDITION <span>/</span> WORKSPACE
            </div>
            <h1>
              A good day starts here<span>.</span>
            </h1>
            <p>Make a little space for what matters. We’ll put it on paper.</p>
          </div>
          <div className="heading-actions">
            <span className={`save-state ${saved ? "" : "save-error"}`}>
              <Check size={14} />
              {saved
                ? "Saved in this browser"
                : "Storage unavailable · export to keep"}
            </span>
            <button className="export-button" onClick={exportConfig}>
              <ArrowDownToLine size={15} />
              Export settings
            </button>
          </div>
        </div>
        <div className="demo-banner">
          <span className="demo-dot" />
          <strong>Demonstration workspace</strong>
          <span>
            Populated with synthetic sample data
            {totalLiveCount
              ? ` · ${totalLiveCount} source${totalLiveCount > 1 ? "s" : ""} live`
              : ""}
            . Every block carries its own provenance.
          </span>
          <button
            onClick={() => {
              setTab("sources");
            }}
          >
            Manage sources <span>↗</span>
          </button>
        </div>
        <div className="workspace">
          <aside className="block-column">
            <BlockEditor
              config={config}
              onChange={change}
              selected={selected}
              onSelect={(id) => {
                setSelected(id);
                setTab("blocks");
              }}
            />
            <div className="workspace-note">
              <FileSliders size={18} />
              <p>
                Your routine, your order.
                <br />
                <span>Everything here updates the receipt as you go.</span>
              </p>
            </div>
          </aside>
          <section className="configuration-column" aria-label="Configuration">
            {tab === "blocks" && selected === "weather" && (
              <WeatherScene
                config={config}
                data={data.weather}
                onChange={change}
                loading={weatherLoading}
              />
            )}
            <div className="settings-card">
              <SettingsPanel
                config={config}
                onChange={change}
                selected={selected}
                tab={tab}
                onCalendarRefresh={() => setCalendarRefresh(n => n + 1)}
                onNewsRefresh={() => setRefresh(n => n + 1)}
                onMarketsRefresh={() => setMarketRefresh(n => n + 1)}
              />
            </div>
            {tab === "sources" && (
              <div className="source-refresh">
                <button
                  className="export-button"
                  onClick={() => setRefresh((n) => n + 1)}
                  disabled={weatherLoading || newsLoading}
                >
                  <Radio size={15} />
                  {weatherLoading || newsLoading
                    ? "Contacting public sources…"
                    : "Refresh public sources"}
                </button>
                <p>
                  Only sources set to live are requested. Failed connections show
                  Unavailable; weather may use a labeled sample fallback.
                </p>
              </div>
            )}
            {data[selected].provenance.note &&
              tab === "blocks" &&
              (selected === "weather" || selected === "news" || selected === "markets") && (
                <p className="adapter-note">{data[selected].provenance.note}</p>
              )}
          </section>
          <section className="preview-column" aria-label="Live receipt preview">
            <div className="preview-toolbar">
              <div>
                <span className="eyebrow">RECEIPT PREVIEW</span>
                <span className="preview-live">
                  <span />
                  Updates as you edit
                </span>
              </div>
              <div className="zoom-control">
                <button
                  aria-label="Zoom out"
                  disabled={config.printer.zoom <= 0.6}
                  onClick={() =>
                    change({
                      ...config,
                      printer: {
                        ...config.printer,
                        zoom: Math.max(
                          0.6,
                          +(config.printer.zoom - 0.1).toFixed(2),
                        ),
                      },
                    })
                  }
                >
                  <ZoomOut size={15} />
                </button>
                <span>{Math.round(config.printer.zoom * 100)}%</span>
                <button
                  aria-label="Zoom in"
                  disabled={config.printer.zoom >= 1.6}
                  onClick={() =>
                    change({
                      ...config,
                      printer: {
                        ...config.printer,
                        zoom: Math.min(
                          1.6,
                          +(config.printer.zoom + 0.1).toFixed(2),
                        ),
                      },
                    })
                  }
                >
                  <ZoomIn size={15} />
                </button>
              </div>
            </div>
            <div className="preview-stage">
              <ReceiptPreview config={config} data={receiptData} />
            </div>
            <div className="preview-footnote">
              A preview of the paper, with room for the whole day.
              <br />
              Length is unrestricted. Physical printing comes later.
            </div>
          </section>
        </div>
        <footer className="app-footer">
          <span>
            RECEIPT SUMMARY <span>·</span> A LITTLE SIGNAL IN THE NOISE.
          </span>
          <span>
            LOCAL WORKSPACE <span>↗</span> V0.1
          </span>
        </footer>
      </main>
    </>
  );
}
