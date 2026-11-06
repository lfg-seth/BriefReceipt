import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultConfig,
  loadConfig,
  normalizeConfig,
  saveConfig,
  STORAGE_KEY,
} from "../src/config";
test("persists order, toggles, source and paper settings without losing edits", () => {
  let value: string | null = null;
  const storage = {
    getItem: () => value,
    setItem: (key: string, next: string) => {
      assert.equal(key, STORAGE_KEY);
      value = next;
    },
  };
  const config = structuredClone(defaultConfig);
  config.blocks.reverse();
  config.blocks[0].enabled = false;
  config.weather.condition = "night";
  config.printer.paperWidth = 58;
  config.printer.contentWidth = 48;
  config.sources.calendars = [];
  assert.equal(saveConfig(storage, config), true);
  assert.deepEqual(loadConfig(storage), config);
});
test("damaged or incompatible storage recovers usable independent defaults", () => {
  assert.deepEqual(loadConfig({ getItem: () => "{bad" }), defaultConfig);
  assert.deepEqual(normalizeConfig({ version: 99 }), defaultConfig);
  const result = loadConfig({ getItem: () => null });
  result.sources.calendars.pop();
  assert.equal(defaultConfig.sources.calendars.length, 3);
});
test("restores missing blocks once and constrains dimensions and invalid values", () => {
  const config = normalizeConfig({
    version: 1,
    blocks: [{ id: "news", limit: 100 }, { id: "news" }, { id: "unknown" }],
    printer: { paperWidth: 58, contentWidth: 500, zoom: -1 },
    weather: { condition: "invalid" },
  });
  assert.equal(config.blocks.length, 8);
  assert.equal(config.blocks.find(block => block.id === "news")?.limit, 5);
  assert.equal(config.blocks[0].id, "summary");
  assert.equal(config.printer.contentWidth, 54);
  assert.equal(config.printer.zoom, 0.6);
  assert.equal(config.weather.condition, "rain");
});
test("storage restrictions are reported without crashing", () => {
  assert.equal(
    saveConfig(
      {
        setItem: () => {
          throw new Error("Quota exceeded");
        },
      },
      defaultConfig,
    ),
    false,
  );
  assert.deepEqual(
    loadConfig({
      getItem: () => {
        throw new Error("Disabled");
      },
    }),
    defaultConfig,
  );
});
test("rejects inherited block keys and clamps defaults to smaller paper", () => {
  const config = normalizeConfig({
    version: 1,
    blocks: [{ id: "__proto__" }, { id: "constructor" }],
    printer: { paperWidth: 58 },
  });
  assert.equal(config.blocks.length, 8);
  assert.equal(config.printer.contentWidth, 54);
});

test("calendar travel defaults migrate old settings and origins persist with validated sample minutes", () => {
  const migrated = normalizeConfig({ version: 1, sources: { calendarTravel: null } });
  assert.deepEqual(migrated.sources.calendarTravel, defaultConfig.sources.calendarTravel);
  const config = normalizeConfig({ version: 1, sources: { calendarTravel: {
    localCity: "Henderson", localState: "nv", homeAddress: "123 Example St", workAddress: "456 Example Ave",
    homeMinutes: -3, workMinutes: 999,
  } } });
  assert.equal(config.sources.calendarTravel.localState, "NV");
  assert.equal(config.sources.calendarTravel.homeMinutes, 1);
  assert.equal(config.sources.calendarTravel.workMinutes, 240);
  let value = "";
  saveConfig({ setItem: (_key, text) => { value = text; } }, config);
  assert.deepEqual(loadConfig({ getItem: () => value }).sources.calendarTravel, config.sources.calendarTravel);
});
