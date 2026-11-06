import {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Check, FolderPlus, Info, Trash2 } from "lucide-react";
import {
  BLOCK_META,
  type BlockId,
  type Config,
  type NewsCategory,
} from "../types";
import "./editor.css";
import { ICloudCalendarSettings } from "./ICloudCalendarSettings";
import { RemindersSettings } from "./RemindersSettings";
import { CalendarTravelSettings } from "./CalendarTravelSettings";
import { AISettings } from "./AISettings";
import { GuardianSettings } from "./GuardianSettings";
import { AlpacaSettings } from "./AlpacaSettings";

type Props = {
  config: Config;
  onChange: (config: Config) => void;
  selected: BlockId;
  tab: "blocks" | "sources" | "schedule" | "printer";
  onCalendarRefresh: () => void;
  onNewsRefresh: () => void;
  onMarketsRefresh: () => void;
};
const categoryLabels: Record<NewsCategory, string> = {
  general: "General",
  technology: "Business & technology",
  companies: "Tesla & SpaceX",
  local: "City & state",
};
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
            "aria-label": label,
          })
        : children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="editor-notice">
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}
function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="settings-heading">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="editor-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="editor-check-box">
        <Check size={12} />
      </span>
      <span>{label}</span>
    </label>
  );
}
function OptionList({
  values,
  selected,
  onChange,
}: {
  values: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="editor-option-list">
      {values.map((value) => (
        <CheckOption
          key={value}
          label={value}
          checked={selected.includes(value)}
          onChange={() =>
            onChange(
              selected.includes(value)
                ? selected.filter((v) => v !== value)
                : [...selected, value],
            )
          }
        />
      ))}
    </div>
  );
}
function StockInput({
  values,
  onChange,
  "aria-label": ariaLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState(values.join(", "));
  return (
    <input
      aria-label={ariaLabel}
      value={draft}
      placeholder="TSLA, SPCX"
      onChange={(e) => {
        setDraft(e.target.value);
        onChange([
          ...new Set(
            e.target.value
              .toUpperCase()
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ]);
      }}
      onBlur={() => setDraft(values.join(", "))}
    />
  );
}

function PrintableWidthInput({
  value,
  max,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value, max]);
  return (
    <input
      type="number"
      min={40}
      max={max}
      aria-label={ariaLabel}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next) && next >= 40 && next <= max) onChange(next);
      }}
      onBlur={() => {
        const next = Math.max(40, Math.min(max, Number(draft) || value));
        setDraft(String(next));
        onChange(next);
      }}
    />
  );
}

export function SettingsPanel({ config, onChange, selected, tab, onCalendarRefresh, onNewsRefresh, onMarketsRefresh }: Props) {
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const block = config.blocks.find((b) => b.id === selected)!;
  const setSources = (patch: Partial<Config["sources"]>) =>
    onChange({ ...config, sources: { ...config.sources, ...patch } });
  const setWeather = (patch: Partial<Config["weather"]>) =>
    onChange({ ...config, weather: { ...config.weather, ...patch } });
  const setPrinter = (patch: Partial<Config["printer"]>) =>
    onChange({ ...config, printer: { ...config.printer, ...patch } });
  const setSchedule = (patch: Partial<Config["schedule"]>) =>
    onChange({ ...config, schedule: { ...config.schedule, ...patch } });
  const setBlock = (patch: Partial<typeof block>) =>
    onChange({
      ...config,
      blocks: config.blocks.map((b) =>
        b.id === selected ? { ...b, ...patch } : b,
      ),
    });
  const calendarOptions = (
    <>
      <ICloudCalendarSettings config={config} onChange={onChange} onRefresh={onCalendarRefresh} />
      <AISettings onRefresh={onCalendarRefresh} />
      {config.sources.calendarMode === "sample" && <>
      <p className="editor-subheading">Selected calendars</p>
      <OptionList
        values={["Personal", "Work", "Household"]}
        selected={config.sources.calendars}
        onChange={(calendars) => setSources({ calendars })}
      />
      <p className="editor-help">
        Sample calendars. Switch the calendar source to iCloud Calendar for live events.
      </p>
      </>}
    </>
  );
  const taskOptions = (
    <>
      <RemindersSettings config={config} onChange={onChange} />
      {config.sources.tasksMode === "sample" && <>
      <p className="editor-subheading">Selected task lists</p>
      <OptionList
        values={["Today", "Home", "Projects"]}
        selected={config.sources.taskLists}
        onChange={(taskLists) => setSources({ taskLists })}
      />
      <p className="editor-help">
        Sample lists · examples of due-today and overdue incomplete items. The live source also includes the next four days.
      </p>
      </>}
    </>
  );
  const weatherOptions = (
    <>
      <div className="editor-field-grid">
        <Field label="Weather ZIP">
          <input
            aria-label="Weather ZIP"
            value={config.weather.zip}
            maxLength={5}
            inputMode="numeric"
            pattern="[0-9]{5}"
            onChange={(e) =>
              setWeather({ zip: e.target.value.replace(/\D/g, "") })
            }
          />
        </Field>
        <Field label="Units">
          <select
            value={config.weather.units}
            onChange={(e) =>
              setWeather({
                units: e.target.value as Config["weather"]["units"],
              })
            }
          >
            <option value="fahrenheit">Fahrenheit · °F</option>
            <option value="celsius">Celsius · °C</option>
          </select>
        </Field>
      </div>
      <Field label="Weather source">
        <select
          value={config.weather.mode}
          onChange={(e) =>
            setWeather({ mode: e.target.value as Config["weather"]["mode"] })
          }
        >
          <option value="sample">Sample weather · simulation</option>
          <option value="live">Live public forecast</option>
        </select>
      </Field>
      <p className="editor-help">
        Today and the following three days. Live collection falls back to
        visibly labeled samples in this demonstration.
      </p>
    </>
  );
  const newsOptions = (
    <>
      <Field label="Headline source">
        <select
          value={config.sources.newsMode}
          onChange={(e) =>
            setSources({
              newsMode: e.target.value as Config["sources"]["newsMode"],
            })
          }
        >
          <option value="sample">Sample headlines</option>
          <option value="live">The Guardian</option>
        </select>
      </Field>
      <p className="editor-subheading">Coverage</p>
      <div className="editor-option-list">
        {(Object.keys(categoryLabels) as NewsCategory[]).map((category) => (
          <CheckOption
            key={category}
            label={categoryLabels[category]}
            checked={config.sources.newsCategories.includes(category)}
            onChange={() =>
              setSources({
                newsCategories: config.sources.newsCategories.includes(category)
                  ? config.sources.newsCategories.filter((c) => c !== category)
                  : [...config.sources.newsCategories, category],
              })
            }
          />
        ))}
      </div>
      <p className="editor-help">
        Five original headlines total from the past 24 hours. City &amp; state searches cover Nevada and the Las Vegas area; coverage is partial. News is excluded from AI summary. Samples are synthetic.
      </p>
      <button className="editor-secondary-button" onClick={onNewsRefresh}>Refresh headlines</button>
      <GuardianSettings onConnected={() => setSources({ newsMode: "live" })} onRefresh={onNewsRefresh} />
    </>
  );
  const localOptions = (
    <>
      <Field label="Local area">
        <input
          value={config.sources.localArea}
          onChange={(e) => setSources({ localArea: e.target.value })}
        />
      </Field>
      <div className="editor-field-grid">
        <Field label="County">
          <input
            value={config.sources.county}
            onChange={(e) => setSources({ county: e.target.value })}
          />
        </Field>
        <Field label="State">
          <input
            value={config.sources.state}
            onChange={(e) => setSources({ state: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Look ahead">
        <select
          value={config.sources.eventsDays}
          onChange={(e) => setSources({ eventsDays: Number(e.target.value) })}
        >
          {[3, 7, 14, 30].map((n) => (
            <option key={n} value={n}>
              Next {n} days
            </option>
          ))}
        </select>
      </Field>
      <p className="editor-help">
        Synthetic community events. Area settings identify your intended
        coverage; no live local calendar is connected.
      </p>
    </>
  );
  const marketOptions = (
    <>
      <Field label="Market source">
        <select value={config.sources.marketsMode} onChange={event => setSources({ marketsMode: event.target.value as Config["sources"]["marketsMode"] })}>
          <option value="sample">Sample markets</option>
          <option value="live">Alpaca · IEX</option>
        </select>
      </Field>
      <Field
        label="Tracked stocks"
        hint="Up to 20 comma-separated stock symbols."
      >
        <StockInput
          values={config.sources.stocks}
          onChange={(stocks) => setSources({ stocks })}
        />
      </Field>
      <Notice>
        IEX covers one exchange. Prices and volume can differ from the full market.
        Before opening and on closed days: the last regular close. During trading:
        current data, or Unavailable if more than 15 minutes old. 1D and 1W charts
        use regular trading hours.
      </Notice>
      <button className="editor-secondary-button" onClick={onMarketsRefresh}>Refresh markets</button>
      <AlpacaSettings onConnected={() => setSources({ marketsMode: "live" })} onRefresh={onMarketsRefresh} />
    </>
  );
  const projectOptions = (
    <>
      <p className="editor-subheading">Configured folders</p>
      <div className="editor-project-list">
        {config.sources.projects.map((project) => (
          <div className="editor-project" key={project.id}>
            <div className="editor-project-top">
              <CheckOption
                label={project.name || "Untitled project"}
                checked={project.enabled}
                onChange={() =>
                  setSources({
                    projects: config.sources.projects.map((p) =>
                      p.id === project.id ? { ...p, enabled: !p.enabled } : p,
                    ),
                  })
                }
              />
              <button
                className="editor-icon-button"
                aria-label={`Remove ${project.name}`}
                onClick={() =>
                  setSources({
                    projects: config.sources.projects.filter(
                      (p) => p.id !== project.id,
                    ),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
            <input
              aria-label={`${project.name} folder path`}
              value={project.path}
              placeholder="C:\Projects\my-project"
              onChange={(e) =>
                setSources({
                  projects: config.sources.projects.map((p) =>
                    p.id === project.id ? { ...p, path: e.target.value } : p,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="editor-add-project">
        <Field label="Project name">
          <input
            value={newProjectName}
            placeholder="A project of your own"
            onChange={(e) => setNewProjectName(e.target.value)}
          />
        </Field>
        <Field label="Folder path">
          <input
            value={newProjectPath}
            placeholder="C:\Projects\my-project"
            onChange={(e) => setNewProjectPath(e.target.value)}
          />
        </Field>
        <button
          className="editor-secondary-button"
          disabled={!newProjectName.trim() || !newProjectPath.trim()}
          onClick={() => {
            setSources({
              projects: [
                ...config.sources.projects,
                {
                  id: crypto.randomUUID(),
                  name: newProjectName.trim(),
                  path: newProjectPath.trim(),
                  enabled: true,
                },
              ],
            });
            setNewProjectName("");
            setNewProjectPath("");
          }}
        >
          <FolderPlus size={15} /> Add folder
        </button>
      </div>
      <Notice>
        Paths identify selected projects. Saving a path never scans folders or
        uploads files. Project progress and evidence are synthetic samples.
      </Notice>
    </>
  );

  if (tab === "schedule")
    return (
      <section className="settings-panel">
        <Heading
          title="A morning ritual"
          description="Choose when your briefing will be prepared."
        />
        <Notice>
          Schedule preferences are saved locally. Running scheduled jobs and
          printer delivery are future integrations.
        </Notice>
        <CheckOption
          label="Enable morning schedule"
          checked={config.schedule.enabled}
          onChange={() => setSchedule({ enabled: !config.schedule.enabled })}
        />
        <div className="editor-field-grid">
          <Field label="Briefing time">
            <input
              type="time"
              value={config.schedule.time}
              onChange={(e) => setSchedule({ time: e.target.value })}
            />
          </Field>
          <Field label="Time zone">
            <select
              value={config.schedule.timezone}
              onChange={(e) => setSchedule({ timezone: e.target.value })}
            >
              {[
                "America/Los_Angeles",
                "America/Denver",
                "America/Chicago",
                "America/New_York",
                "UTC",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="editor-subheading">Days of the week</p>
        <div className="editor-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
            <button
              key={day}
              aria-pressed={config.schedule.days.includes(i)}
              onClick={() =>
                setSchedule({
                  days: config.schedule.days.includes(i)
                    ? config.schedule.days.filter((d) => d !== i)
                    : [...config.schedule.days, i],
                })
              }
            >
              {day}
            </button>
          ))}
        </div>
        <p className="editor-help">
          The 06:30 Pacific market cutoff is independent of your chosen briefing
          time. Schedule behavior during missed runs and delivery failures
          remains to be designed.
        </p>
      </section>
    );
  if (tab === "printer")
    return (
      <section className="settings-panel">
        <Heading
          title="Made for paper"
          description="Fine-tune the receipt before a printer is connected."
        />
        <div className="editor-field-grid">
          <Field label="Paper width">
            <select
              value={config.printer.paperWidth}
              onChange={(e) => {
                const paperWidth = Number(e.target.value);
                setPrinter({
                  paperWidth,
                  contentWidth: Math.min(
                    config.printer.contentWidth,
                    paperWidth - 4,
                  ),
                });
              }}
            >
              <option value={58}>58 mm</option>
              <option value={80}>80 mm</option>
              <option value={112}>112 mm</option>
            </select>
          </Field>
          <Field
            label="Printable width"
            hint={`Leave room for margins · up to ${config.printer.paperWidth - 4} mm`}
          >
            <PrintableWidthInput
              max={config.printer.paperWidth - 4}
              value={config.printer.contentWidth}
              onChange={(contentWidth) => setPrinter({ contentWidth })}
            />
          </Field>
        </div>
        <Field label={`Receipt type size · ${config.printer.fontSize} px`}>
          <input
            type="range"
            min={10}
            max={16}
            step={1}
            value={config.printer.fontSize}
            onChange={(e) => setPrinter({ fontSize: Number(e.target.value) })}
          />
        </Field>
        <Field label="Closing line">
          <textarea
            rows={3}
            value={config.printer.footer}
            onChange={(e) => setPrinter({ footer: e.target.value })}
          />
        </Field>
        <Notice>
          Paper width and printable content width are separate. Receipt length
          is unrestricted; the preview never cuts off content. Physical printing
          is not connected.
        </Notice>
      </section>
    );
  if (tab === "sources")
    return (
      <section className="settings-panel">
        <Heading
          title="Your sources"
          description="Choose the information that shapes your morning."
        />
        <Notice>
          iCloud Calendar, Reminders snapshots, weather and public headlines can be connected live.
          Other blocks use samples; each block keeps its own provenance.
        </Notice>
        <div className="editor-source-section">
          <h4>Weather</h4>
          {weatherOptions}
        </div>
        <div className="editor-source-section">
          <h4>Calendar & tasks</h4>
          {calendarOptions}
          <CalendarTravelSettings config={config} onChange={onChange} />
          {taskOptions}
        </div>
        <div className="editor-source-section">
          <h4>News</h4>
          {newsOptions}
        </div>
        <div className="editor-source-section">
          <h4>Local coverage</h4>
          {localOptions}
        </div>
        <div className="editor-source-section">
          <h4>Markets</h4>
          {marketOptions}
        </div>
        <div className="editor-source-section">
          <h4>Projects</h4>
          {projectOptions}
        </div>
      </section>
    );
  return (
    <section className="settings-panel">
      <Heading
        title={BLOCK_META[selected].title}
        description={BLOCK_META[selected].subtitle}
      />
      <div className="editor-field-grid">
        <Field label="Content density">
          <select
            value={block.density}
            onChange={(e) =>
              setBlock({ density: e.target.value as typeof block.density })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </Field>
        {selected !== "markets" && selected !== "summary" && (
          <Field
            label={
              selected === "weather" ? "Forecast days" : "Items to include"
            }
          >
            <select
              value={block.limit}
              onChange={(e) => setBlock({ limit: Number(e.target.value) })}
            >
              {Array.from(
                {
                  length:
                    selected === "weather"
                      ? 4
                      : selected === "calendar"
                        ? 20
                      : selected === "news" || selected === "projects"
                        ? 5
                        : 8,
                },
                (_, i) => i + 1,
              ).map((n) => (
                <option key={n} value={n}>
                  {n}
                  {selected === "weather"
                    ? n === 1
                      ? " day"
                      : " days"
                    : n === 1
                      ? " item"
                      : " items"}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="editor-divider" />
      {selected === "summary" && <>
        <p className="editor-help">Checks every enabled module except News independently. Each noteworthy module gets at most one concise sentence, with a blank line between ideas. Quiet modules add nothing; “Nothing noteworthy” is a valid result.</p>
        <p className="editor-help">Includes useful numbers and relevant explanations, researching public developments when needed. Full calendar notes and source timestamps inform importance; personal details stay out of web research. In a mixed briefing, only live sections can supply highlights.</p>
        <button className="editor-secondary-button" onClick={onCalendarRefresh}>Refresh AI summary</button>
        <AISettings onRefresh={onCalendarRefresh} />
      </>}
      {selected === "weather" && weatherOptions}
      {selected === "calendar" && <>{calendarOptions}<CalendarTravelSettings config={config} onChange={onChange} /></>}
      {selected === "tasks" && taskOptions}
      {selected === "news" && newsOptions}
      {selected === "events" && localOptions}
      {selected === "markets" && marketOptions}
      {selected === "projects" && projectOptions}
      <div className="editor-divider" />
      <Field
        label="A note for this block"
        hint="Optional. Appears on your receipt."
      >
        <textarea
          rows={2}
          value={block.note}
          placeholder="Make it yours…"
          onChange={(e) => setBlock({ note: e.target.value })}
        />
      </Field>
    </section>
  );
}
