import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  // Browser checks never send personal briefing data to the real provider.
  await page.route("**/api/ai/briefing-summary", route => route.fulfill({ json: {
    text: "Nothing noteworthy in the sample updates.",
    provenance: { mode: "sample", source: "OpenAI test fixture", retrievedAt: "2026-11-05T18:00:00Z" },
  } }));
});

test("researched briefing explanations have inline source links without disclosure prose", async ({ page }) => {
  const text = "ACME fell 10.8% after cutting its earnings outlook.\n\nHigh winds may disrupt local travel.";
  await page.route("**/api/ai/briefing-summary", route => route.fulfill({ json: {
    text, citations: [
      { end: text.indexOf("\n\n"), url: "https://example.com/company-outlook", title: "Company cuts outlook" },
      { end: text.length, url: "https://example.com/wind-alert", title: "Local wind alert" },
    ],
    provenance: { mode: "live", source: "OpenAI test fixture", retrievedAt: "2026-11-05T18:00:00Z" },
  } }));
  await page.goto("/");
  const summary = page.locator(".receipt-briefing-summary");
  await expect(summary).toContainText("ACME fell 10.8% after cutting its earnings outlook.");
  await expect(summary.getByRole("link", { name: "Source 1: Company cuts outlook" })).toHaveAttribute("href", "https://example.com/company-outlook");
  await expect(summary.getByRole("link", { name: "Source 2: Local wind alert" })).toHaveAttribute("href", "https://example.com/wind-alert");
  await expect(summary).not.toContainText(/coverage|IEX|based on/i);
  await expect(summary.locator("p")).toHaveCount(2);
  await expect(summary.locator("p").nth(0).getByRole("link")).toHaveAttribute("href", "https://example.com/company-outlook");
  await expect(summary.locator("p").nth(1).getByRole("link")).toHaveAttribute("href", "https://example.com/wind-alert");
  const first = await summary.locator("p").nth(0).boundingBox();
  const second = await summary.locator("p").nth(1).boundingBox();
  expect(first && second && second.y - first.y - first.height).toBeGreaterThan(5);
  await summary.screenshot({ path: ".local/summary-sentence-spacing.png" });
  await page.emulateMedia({ media: "print" });
  await expect(summary).toContainText("High winds may disrupt local travel.");
});

test("connects Alpaca, prints daily and weekly charts, and keeps credentials out of saved settings", async ({ page }) => {
  const apiKey = "PK-BROWSER-TEST-123456", secretKey = "browser-test-secret-123456789";
  let connected = false, fail = false;
  let marketStatus = "Open";
  const points = Array.from({ length: 24 }, (_, i) => ({ at: new Date(Date.parse("2026-11-05T14:30:00Z") + i * 300000).toISOString(), value: 280 + i / 3 + Math.sin(i) * 2 }));
  await page.route("**/api/alpaca/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "connect") { expect(route.request().postDataJSON()).toEqual({ apiKey, secretKey }); connected = true; }
    if (action === "disconnect") connected = false;
    if (action === "markets") {
      expect(route.request().postDataJSON()).toEqual({ symbols: ["TSLA", "SPCX"] });
      await route.fulfill({ json: connected && !fail ? {
        marketStatus,
        provenance: { mode: "live", source: "Alpaca · IEX", retrievedAt: "2026-11-05T16:30:00Z", note: "IEX only; no ETF substitutions." },
        items: [
          { symbol: "TSLA", name: "TSLA", kind: "stock", value: 284.16, change: 1.24, weekChange: -2.36, session: "2026-11-05 regular session", asOf: "2026-11-05T16:25:00Z", freshness: "IEX only · limited market coverage", dayHistory: points, weekHistory: points.slice().reverse() },
          { symbol: "SPCX", name: "SPCX", kind: "stock", value: 123.57, change: -9.05, weekChange: -14.09, session: "2026-11-05 regular session", asOf: "2026-11-05T16:25:00Z", freshness: "IEX only", dayHistory: points.map((p, i) => ({ ...p, value: 130 - i * 0.28 + Math.sin(i) })), weekHistory: points.map((p, i) => ({ ...p, value: 142 - i * 0.8 + Math.sin(i) })) },
          ...[{ symbol: "DJI", name: "Dow Jones Industrial Average", kind: "index" }, { symbol: "SPX", name: "S&P 500", kind: "index" }].map(item => ({ ...item, value: null, change: null, session: "", asOf: "", freshness: "Unavailable", unavailable: "This instrument is not available from IEX." })),
        ],
      } : { provenance: { mode: "unavailable", source: "Alpaca · IEX", retrievedAt: "2026-11-05T16:30:00Z", note: "Alpaca unavailable." }, items: [] } });
      return;
    }
    await route.fulfill({ json: { connected, feed: "iex" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Configure Markets", exact: true }).click();
  await page.getByLabel("Alpaca API key ID", { exact: true }).fill(apiKey);
  await page.getByLabel("Alpaca secret key", { exact: true }).fill(secretKey);
  await page.getByRole("button", { name: "Connect Alpaca", exact: true }).click();
  await expect(page.getByLabel("Market source")).toHaveValue("live");
  await expect(page.getByLabel("Alpaca API key ID", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Alpaca secret key", { exact: true })).toHaveValue("");
  const receipt = page.locator('[data-receipt-block="markets"]');
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Open");
  await expect(receipt).toContainText("$284.16");
  await expect(receipt).not.toContainText("As of");
  await expect(receipt).not.toContainText("Stock · USD");
  await expect(receipt).not.toContainText("limited market coverage");
  await expect(receipt).not.toContainText("Dow Jones");
  await expect(receipt).not.toContainText("S&P 500");
  await expect(receipt.locator("table")).toHaveCount(0);
  await expect(receipt.locator(".receipt-stock")).toHaveCount(2);
  const tesla = receipt.getByRole("region", { name: "TSLA performance" });
  await expect(tesla.getByLabel("Up 1.24 percent", { exact: true })).toBeVisible();
  await expect(tesla.getByLabel("Down 2.36 percent", { exact: true })).toBeVisible();
  await expect(tesla.locator('[data-period="day"] .receipt-stock-dollars')).toHaveText("+$3.48");
  await expect(tesla.locator('[data-period="week"] .receipt-stock-dollars')).toHaveText("−$6.87");
  const charts = tesla.locator(".receipt-stock-period");
  const firstChart = await charts.nth(0).boundingBox(), secondChart = await charts.nth(1).boundingBox();
  expect(secondChart!.y).toBeGreaterThanOrEqual(firstChart!.y + firstChart!.height);
  await expect(receipt).not.toContainText("1W ·");
  await expect(receipt).not.toContainText("1D ·");
  await expect(receipt.getByRole("img", { name: "TSLA 1D price trend", exact: true })).toBeVisible();
  await expect(receipt.getByRole("img", { name: "TSLA 1W price trend", exact: true })).toBeVisible();
  await expect(receipt.getByRole("region", { name: "SPCX performance" })).toContainText("$123.57");
  await expect(receipt.getByLabel("Down 9.05 percent", { exact: true })).toBeVisible();
  await expect(receipt).not.toContainText("42,518.32");
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain(apiKey); expect(stored).not.toContain(secretKey);
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export settings", exact: true }).click();
  const exported = await readFile((await (await downloadReady).path())!, "utf8");
  expect(exported).not.toContain(apiKey); expect(exported).not.toContain(secretKey);
  await receipt.screenshot({ path: ".local/alpaca-markets.png" });
  await page.locator(".receipt-preview").evaluate(element => {
    (element as HTMLElement).style.setProperty("--receipt-content-width", "48mm");
  });
  const overflow = await receipt.locator(".receipt-stock-heading, .receipt-stock-performance").evaluateAll(elements => elements.some(element => element.scrollWidth > element.clientWidth + 1));
  expect(overflow).toBe(false);
  await receipt.screenshot({ path: ".local/alpaca-markets-narrow.png" });
  await page.emulateMedia({ media: "print" });
  await expect(receipt.getByRole("img", { name: "TSLA 1D price trend", exact: true })).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.reload();
  await page.getByRole("button", { name: "Configure Markets", exact: true }).click();
  await expect(receipt).toContainText("$284.16");
  await expect(page.getByRole("button", { name: "Disconnect Alpaca", exact: true })).toBeVisible();
  for (const phase of ["Pre-market", "After-hours", "Closed"]) {
    marketStatus = phase;
    await page.getByRole("button", { name: "Refresh markets", exact: true }).click();
    await expect(receipt.locator(".receipt-data-mode")).toHaveText(phase);
  }
  fail = true;
  await page.getByRole("button", { name: "Refresh markets", exact: true }).click();
  await expect(receipt).toContainText("Unavailable");
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Unknown");
  await expect(receipt).not.toContainText("$284.16");
  await expect(receipt.locator("svg.receipt-sparkline")).toHaveCount(0);
  await page.getByRole("button", { name: "Disconnect Alpaca", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect Alpaca", exact: true })).toBeVisible();
});

test("connects Guardian, excludes news from AI, and keeps credentials out of settings exports", async ({ page }) => {
  const apiKey = "guardian-browser-test-123456";
  const title = "Guardian browser fixture: original headline";
  const excerpt = "The publisher’s own summary & continuation, supplied by the API.";
  let connected = false;
  const aiInputs: string[] = [];
  await page.route("**/api/guardian/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "connect") { expect(route.request().postDataJSON()).toEqual({ apiKey }); connected = true; }
    if (action === "disconnect") connected = false;
    await route.fulfill({ json: { connected } });
  });
  await page.route("**/api/news", route => route.fulfill({ json: connected ? {
    provenance: { mode: "live", source: "The Guardian", retrievedAt: "2026-11-05T18:00:00Z" },
    items: [
      { id: "guardian-fixture", title, description: excerpt, publisher: "The Guardian", byline: "Test Reporter", copyright: "The Guardian", publishedAt: "2026-11-05T17:00:00Z", category: "general", url: "https://www.theguardian.com/us-news/test", sample: false },
      { id: "guardian-fixture-2", title: "A second headline without an excerpt", publisher: "The Guardian", byline: "Another Reporter", copyright: "The Guardian", publishedAt: "2026-11-05T16:00:00Z", category: "general", sample: false },
    ],
  } : { provenance: { mode: "unavailable", source: "The Guardian", retrievedAt: "2026-11-05T18:00:00Z", note: "Connect Guardian." }, items: [] } }));
  await page.route("**/api/ai/briefing-summary", async route => {
    aiInputs.push(route.request().postData()!);
    await route.fulfill({ json: { text: "Nothing noteworthy in the sample updates.", provenance: { mode: "sample", source: "OpenAI test fixture", retrievedAt: "2026-11-05T18:00:00Z" } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Configure Headlines", exact: true }).click();
  await page.getByLabel("Guardian API key", { exact: true }).fill(apiKey);
  await page.getByRole("button", { name: "Connect Guardian", exact: true }).click();
  await expect(page.getByLabel("Guardian API key", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Headline source")).toHaveValue("live");
  const news = page.locator('[data-receipt-block="news"]');
  await expect(news).toContainText(title);
  await expect(news).toContainText(excerpt);
  await expect(news).not.toContainText("Test Reporter");
  await expect(news).not.toContainText("Another Reporter");
  await expect(news).not.toContainText("The Guardian");
  await expect(news).not.toContainText("GENERAL");
  await expect(news.locator(".receipt-news-date").first()).toContainText("Nov 5, 9:00 AM PST");
  await expect(news.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", "https://www.theguardian.com/us-news/test");
  const credit = page.locator(".receipt-guardian-credit");
  await expect(credit).toHaveCount(1);
  await expect(credit).toHaveText("News © The Guardian");
  await expect(page.locator(".receipt-footer .receipt-guardian-credit")).toHaveCount(1);
  await expect(page.locator(".receipt-paper img")).toHaveCount(0);
  await expect.poll(() => aiInputs.length).toBeGreaterThan(0);
  expect(aiInputs.every(input => !input.includes(title) && !input.includes(excerpt) && !input.includes('"Headlines"') && !input.includes(apiKey))).toBe(true);
  const stored = await page.evaluate(() => localStorage.getItem("receipt-summary:configuration:v1"));
  expect(stored).not.toContain(apiKey);
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export settings", exact: true }).click();
  const download = await downloadReady;
  expect(await readFile((await download.path())!, "utf8")).not.toContain(apiKey);
  await page.emulateMedia({ media: "print" });
  await expect(news).toContainText(title);
  await expect(news).toContainText(excerpt);
  await expect(credit).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await news.screenshot({ path: ".local/guardian-headlines.png" });
  await page.locator(".receipt-footer").screenshot({ path: ".local/guardian-footer.png" });
  await page.getByRole("checkbox", { name: "General", exact: true }).uncheck();
  await expect(news).toContainText("No headlines in the selected categories.");
  await expect(credit).toHaveCount(0);
  await page.getByRole("checkbox", { name: "General", exact: true }).check();
  await expect(news).toContainText(title);
  await page.getByRole("button", { name: "Disconnect Guardian", exact: true }).click();
  await expect(news).toContainText("Unavailable");
  await expect(news).not.toContainText(title);
});

test("shows a long-date heading and a configurable AI summary of included content", async ({ page }) => {
  const requests: { title: string; mode: string; content: string }[][] = [];
  await page.route("**/api/ai/briefing-summary", async route => {
    const sections = route.request().postDataJSON().sections;
    requests.push(sections);
    await route.fulfill({ json: { text: "Nothing noteworthy in the sample updates.", provenance: { mode: "sample", source: "OpenAI test fixture", retrievedAt: "2026-11-05T18:00:00Z" } } });
  });
  await page.goto("/");
  await expect(page.locator(".receipt-header h2")).toHaveText("Thursday, November 5, 2026");
  await expect(page.locator(".receipt-header")).not.toContainText(/A MOMENT BEFORE|MORNING EDITION|PREVIEW EDITION|THE DAILY BRIEFING/);
  const summary = page.locator('[data-receipt-block="summary"]');
  await expect(summary).toContainText("Nothing noteworthy");
  expect(requests.at(-1)?.map(section => section.title)).toEqual(["Weather", "Calendar", "Tasks", "Around you", "Markets", "Projects"]);
  await page.getByRole("switch", { name: "Enable Tasks", exact: true }).click();
  await expect.poll(() => requests.at(-1)?.some(section => section.title === "Tasks")).toBe(false);
  await page.getByRole("button", { name: "Configure AI summary", exact: true }).click();
  await expect(page.getByLabel("Items to include", { exact: true })).toHaveCount(0);
  await page.getByRole("switch", { name: "Enable AI summary", exact: true }).click();
  await expect(summary).toHaveCount(0);
  await page.getByRole("switch", { name: "Enable AI summary", exact: true }).click();
  await expect(summary).toContainText("Nothing noteworthy");
  await page.emulateMedia({ media: "print" });
  await expect(summary).toContainText("Nothing noteworthy");
  await page.emulateMedia({ media: "screen" });
  await page.locator(".receipt-header").screenshot({ path: ".local/briefing-date-header.png" });
  await summary.screenshot({ path: ".local/briefing-summary.png" });
});

test("connects OpenAI for calendar notes, keeps summaries italicized and excludes the key from saved settings", async ({ page }) => {
  const id = "a".repeat(64);
  const key = "sk-browser-test-" + "a".repeat(32);
  const original = "Bring photo ID; use the east entrance. " + "Greetings, repeated meeting details and routine boilerplate. ".repeat(8);
  const summary = "Bring photo ID; use the east entrance.";
  let connected = false;
  let eventRequests = 0;
  await page.route("**/api/ai/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.split("/").at(-1);
    if (endpoint === "connect") { expect(route.request().postDataJSON()).toEqual({ apiKey: key }); connected = true; }
    if (endpoint === "disconnect") connected = false;
    await route.fulfill({ json: { connected, model: "gpt-5.6-luna", reservedUsd: 0.001, monthlyLimitUsd: 20, month: "2026-11" } });
  });
  await page.route("**/api/icloud/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.split("/").at(-1);
    if (endpoint === "events") {
      eventRequests++;
      expect(route.request().postDataJSON().summaryLimit).toBe(5);
      await route.fulfill({ json: { provenance: { mode: "live", source: "iCloud Calendar", retrievedAt: "2026-11-05T18:00:00Z" }, date: "2026-11-05", items: [{ id: "one", title: "Appointment", time: "10:00 AM", calendar: "Personal", calendarId: id, description: original, ...(connected ? { descriptionSummary: { text: summary, model: "gpt-5.6-luna", generatedAt: "2026-11-05T18:00:00Z" } } : { summaryUnavailable: "AI unavailable: connect OpenAI in Calendar settings. Full notes are shown." }) }] } });
    } else await route.fulfill({ json: { connected: true, saved: true, calendars: [{ id, name: "Personal" }] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Configure Calendar", exact: true }).click();
  await page.getByLabel("Calendar source").selectOption("live");
  await page.getByRole("checkbox", { name: "Personal", exact: true }).check();
  const receipt = page.locator('[data-receipt-block="calendar"]');
  await expect(receipt).toContainText(original);
  await page.getByLabel("OpenAI API key").fill(key);
  await page.getByRole("button", { name: "Connect OpenAI", exact: true }).click();
  await expect(page.getByLabel("OpenAI API key")).toHaveValue("");
  await expect(receipt.getByRole("img", { name: "AI summary", exact: true })).toBeVisible();
  await expect(receipt.locator(".receipt-ai-summary")).toHaveText(summary);
  await expect(receipt.locator(".receipt-ai-summary")).toHaveCSS("font-style", "italic");
  await expect(receipt).not.toContainText("AI summary");
  await expect(receipt.getByText("Show full notes", { exact: true })).toHaveCount(0);
  await expect(receipt).not.toContainText(original);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(key);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export settings", exact: true }).click();
  expect(await readFile((await (await downloadPromise).path())!, "utf8")).not.toContain(key);
  await receipt.screenshot({ path: ".local/calendar-ai-summary.png" });
  await page.emulateMedia({ media: "print" });
  await expect(receipt.locator(".receipt-ai-summary")).toHaveText(summary);
  await expect(receipt.locator(".receipt-ai-summary")).toHaveCSS("font-style", "italic");
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Disconnect OpenAI", exact: true }).click();
  await expect(receipt.locator(".receipt-ai-summary")).toHaveCount(0);
  await expect(receipt).toContainText(original);
  await expect(receipt).toContainText("AI unavailable");
  await page.getByLabel("Calendar source").selectOption("sample");
  const previous = eventRequests;
  await page.getByRole("button", { name: "Refresh calendar", exact: true }).click();
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Sample");
  expect(eventRequests).toBe(previous);
});

test("pairs a Reminders Shortcut, renders selected snapshot lists and labels stale data", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-05T18:00:00Z"));
  const token = "t".repeat(43);
  let paired = false, received = false, stale = false;
  const capturedAt = "2026-11-05T18:00:00Z";
  const status = () => ({ paired, publicUrl: "https://desktop.tailtest.ts.net:8443", capturedAt: received ? capturedAt : undefined, receivedAt: received ? capturedAt : undefined, stale, maxAgeMinutes: 120, lists: received ? ["Home"] : [], count: received ? 5 : 0 });
  await page.route("**/api/reminders/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.split("/").at(-1);
    if (endpoint === "pair") { paired = true; await route.fulfill({ json: { ...status(), token } }); return; }
    if (endpoint === "revoke") { paired = false; received = false; }
    if (endpoint === "tasks") {
      const lists = route.request().postDataJSON().lists;
      await route.fulfill({ json: { capturedAt, provenance: { mode: !paired || stale || !received ? "unavailable" : "live", source: "Apple Reminders Shortcut", retrievedAt: capturedAt, observedAt: capturedAt, note: stale ? "Reminders snapshot is over two hours old. Run your Shortcut to refresh it." : "Waiting for the first iPhone upload." }, items: paired && received && !stale && lists.includes("Home") ? [{ id: "task1", title: "Pick up groceries", list: "Home", overdue: false, completed: true, dueStatus: "today", due: "2026-11-05" }, { id: "task2", title: "Pay the water bill", list: "Home", overdue: true, completed: false, dueStatus: "overdue", due: "2026-11-04" }, { id: "task3", title: "Prepare for Monday", list: "Home", overdue: false, completed: false, dueStatus: "upcoming", due: "2026-11-09" }, { id: "task4", title: "Tomorrow appointment", list: "Home", overdue: false, completed: false, dueStatus: "upcoming", due: "2026-11-06" }, { id: "task5", title: "Weekend shopping", list: "Home", overdue: false, completed: true, dueStatus: "upcoming", due: "2026-11-07" }] : [] } });
      return;
    }
    await route.fulfill({ json: status() });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Configure Tasks", exact: true }).click();
  await expect(page.getByLabel("Phone server address")).toHaveValue("https://desktop.tailtest.ts.net:8443");
  await page.getByRole("button", { name: "Create upload token", exact: true }).click();
  await expect(page.getByLabel("Task source")).toHaveValue("live");
  await expect(page.getByRole("img", { name: "Private Reminders pairing QR code" })).toBeVisible();
  await expect(page.getByLabel("Reminders authorization header")).toHaveValue(`Bearer ${token}`);
  await page.screenshot({ path: ".local/reminders-pairing.png", fullPage: true });
  await expect(page.getByRole("link", { name: "Open Shortcut instructions", exact: true })).toHaveAttribute("href", `/api/reminders/guide?uploadBase=${encodeURIComponent("https://desktop.tailtest.ts.net:8443")}#token=${token}`);
  const receipt = page.locator('[data-receipt-block="tasks"]');
  await expect(receipt.locator("h3")).toContainText("Reminders");
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Unavailable");
  received = true;
  await page.getByRole("button", { name: "Configure Calendar", exact: true }).click();
  await page.getByRole("button", { name: "Configure Tasks", exact: true }).click();
  await page.getByRole("checkbox", { name: "Home", exact: true }).check();
  await expect(receipt).toContainText("Pick up groceries");
  await expect(receipt).toContainText("OVERDUE");
  const upcoming = receipt.getByRole("listitem").filter({ hasText: "Prepare for Monday" });
  await expect(upcoming).toContainText("MONDAY");
  await expect(upcoming).toContainText("2026-11-09");
  await expect(upcoming).not.toContainText("DUE TODAY");
  await expect(receipt.getByRole("listitem").filter({ hasText: "Tomorrow appointment" })).toContainText("TOMORROW");
  await expect(receipt.getByRole("listitem").filter({ hasText: "Weekend shopping" })).toContainText("SATURDAY");
  const checkedToday = receipt.getByRole("listitem").filter({ hasText: "Pick up groceries" });
  await expect(checkedToday.getByRole("img", { name: "Completed reminder", exact: true })).toBeVisible();
  await expect(checkedToday).toContainText("COMPLETED");
  expect(await checkedToday.locator("strong").evaluate(node => getComputedStyle(node).textDecorationLine)).toContain("line-through");
  await expect(receipt.getByRole("listitem").filter({ hasText: "Weekend shopping" }).getByRole("img", { name: "Completed reminder", exact: true })).toBeVisible();
  await expect(receipt.getByRole("listitem").filter({ hasText: "Pay the water bill" }).getByRole("img", { name: "Incomplete reminder", exact: true })).toBeVisible();
  await receipt.screenshot({ path: ".local/reminders-completed.png" });
  await expect(receipt).not.toContainText("UPCOMING");
  await expect(receipt.getByRole("listitem").filter({ hasText: "Pick up groceries" })).toContainText("DUE TODAY");
  await page.getByLabel("Items to include", { exact: true }).selectOption("1");
  await expect(receipt).toContainText("4 more reminders in this window");
  await page.getByLabel("Items to include", { exact: true }).selectOption("5");
  await expect(receipt).toContainText("Snapshot:");
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Live");
  expect(await page.evaluate(() => localStorage.getItem("receipt-summary:configuration:v1"))).not.toContain(token);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export settings", exact: true }).click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).not.toContain(token);
  stale = true;
  await page.getByLabel("Task source").selectOption("sample");
  await page.getByLabel("Task source").selectOption("live");
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Unavailable");
  await expect(receipt).toContainText("over two hours old");
  await expect(receipt).not.toContainText("Pick up groceries");
  await page.getByRole("button", { name: "Disconnect Reminders", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create upload token", exact: true })).toBeVisible();
});

test("phone setup keeps the upload token out of network requests and clears its fragment", async ({ page }) => {
  const token = "p".repeat(43);
  const setup = await readFile("server/reminders-setup.html", "utf8");
  await page.route("**/phone-setup-test*", route => route.fulfill({ contentType: "text/html", body: setup }));
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/phone-setup-test?uploadBase=${encodeURIComponent("https://desktop.tailtest.ts.net:8443")}#token=${token}`);
  await expect(page.locator("#authorization")).toHaveText(`Bearer ${token}`);
  expect(new URL(page.url()).hash).toBe("");
  expect(requests.every(url => !url.includes(token))).toBe(true);
  await expect(page.locator("#url")).toHaveText("https://desktop.tailtest.ts.net:8443/upload");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".local/reminders-phone-guide.png", fullPage: true });
});
test("connects iCloud locally, selects real calendars and never saves credentials", async ({ page }) => {
  const id = "a".repeat(64);
  const shortDescription = "  Bring photo ID.\nUse <b>east entrance</b>; arrive 15 minutes early.  ";
  const longDescription = "Review the revised estimates before the workshop. ".repeat(8) + "Bring the signed checklist.";
  let connected = false;
  let fail = false;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/icloud/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.split("/").at(-1);
    if (endpoint === "connect") {
      expect(route.request().postDataJSON()).toEqual({ email: "example@icloud.com", password: "aaaa-bbbb-cccc-dddd" });
      connected = true;
    }
    if (endpoint === "disconnect") connected = false;
    if (endpoint === "events") {
      const ids = route.request().postDataJSON().calendarIds;
      await route.fulfill({ status: !connected ? 401 : fail ? 502 : 200, json: !connected ? { error: "Connect iCloud in Sources." } : fail ? { error: "Calendar unavailable. Try again." } : { date: "2026-11-05", provenance: { mode: "live", source: "iCloud Calendar", retrievedAt: "2026-11-05T18:00:00Z" }, items: ids.includes(id) ? [
        { id: "real", calendarId: id, calendar: "My actual calendar", title: "Dentist appointment", time: "10:00 AM", end: "11:00 AM", description: shortDescription, location: "123 Main Street\nSuite 204\nLas Vegas NV 89104\nUnited States", invitees: [
          { name: "Alex Morgan", address: "alex@example.com", participationStatus: "ACCEPTED" },
          { name: "alex morgan", address: "alex2@example.com" },
          { address: "pending@example.com", participationStatus: "TENTATIVE" },
          { name: "Sam", address: "sam@example.com", participationStatus: "DECLINED" },
          { name: "Casey", address: "casey@example.com", participationStatus: "NEEDS-ACTION" },
          { name: "Taylor", address: "taylor@example.com" },
        ] },
        { id: "long", calendarId: id, calendar: "My actual calendar", title: "Workshop", time: "1:00 PM", description: longDescription },
        { id: "blank", calendarId: id, calendar: "My actual calendar", title: "No notes", time: "3:00 PM", description: " \n\t" },
        { id: "dinner", calendarId: id, calendar: "My actual calendar", title: "Evening dinner", time: "6:00 PM", description: "Test notes", location: "456 Example Road, Henderson, Nevada 89014, United States" },
        { id: "tomorrow", calendarId: id, calendar: "My actual calendar", date: "2026-11-06", title: "Tomorrow review", time: "9:00 AM" },
        { id: "fourth", calendarId: id, calendar: "My actual calendar", date: "2026-11-09", title: "Monday appointment", time: "11:00 PM" },
      ] : [] } });
      return;
    }
    await route.fulfill({ json: { connected, calendars: connected ? [{ id, name: "My actual calendar" }] : [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await page.getByLabel("Apple Account email", { exact: true }).fill("example@icloud.com");
  await page.getByLabel("App-specific password", { exact: true }).fill("aaaa-bbbb-cccc-dddd");
  await page.getByRole("button", { name: "Connect iCloud", exact: true }).click();
  await expect(page.getByLabel("Calendar source")).toHaveValue("live");
  const receipt = page.locator('[data-receipt-block="calendar"]');
  await expect(receipt).toContainText("Choose calendars in Sources");
  await page.getByRole("checkbox", { name: "My actual calendar" }).check();
  await expect(receipt).toContainText("Dentist appointment");
  await expect(receipt).toContainText("1 more event in this window");
  await page.getByRole("button", { name: "Configure Calendar", exact: true }).click();
  await page.getByLabel("Items to include", { exact: true }).selectOption("8");
  await expect(receipt.locator(".receipt-agenda-day")).toHaveText(["Today · Thu, Nov 5", "Tomorrow · Fri, Nov 6", "Mon, Nov 9"]);
  await expect(receipt).toContainText("Monday appointment");
  await expect(receipt).not.toContainText("more events in this window");
  const descriptions = receipt.locator(".receipt-calendar-description p");
  await expect(descriptions).toHaveCount(3);
  expect(await descriptions.nth(0).textContent()).toBe(shortDescription);
  expect(await descriptions.nth(1).textContent()).toBe(longDescription);
  await expect(descriptions.nth(0).locator("b")).toHaveCount(0);
  expect(await descriptions.nth(0).evaluate(node => getComputedStyle(node).whiteSpace)).toBe("pre-wrap");
  await expect(receipt.getByRole("img", { name: "Notes", exact: true })).toHaveCount(2);
  await expect(receipt.getByRole("img", { name: "Full notes", exact: true })).toHaveCount(1);
  await expect(receipt).not.toContainText("Notes:");
  await expect(receipt).not.toContainText("Invitees:");
  await expect(receipt.locator(".receipt-agenda-item").filter({ hasText: "Evening dinner" })).toContainText("Test notes");
  await expect(receipt).not.toContainText("My actual calendar");
  await expect(receipt).not.toContainText("Location:");
  await expect(receipt.locator(".receipt-calendar-location")).toHaveText(["123 Main Street\nSuite 204", "456 Example Road\nHenderson, NV 89014"]);
  await expect(receipt.getByRole("img", { name: "Location", exact: true })).toHaveCount(2);
  const invitees = receipt.locator(".receipt-calendar-invitees");
  await expect(invitees.getByRole("listitem")).toHaveText(["Alex Morgan", "pending@example.com", "Sam", "Casey", "Taylor"]);
  await expect(invitees.getByRole("img", { name: "Accepted", exact: true })).toBeVisible();
  await expect(invitees.getByRole("img", { name: "Declined", exact: true })).toBeVisible();
  await expect(invitees).not.toContainText("alex@example.com");
  await expect(receipt).not.toContainText("AI summary");
  const appointment = receipt.locator(".receipt-agenda-item").first();
  expect(await appointment.locator("strong").evaluate(node => [...node.parentElement!.children].map(child => child.tagName === "STRONG" ? "title" : child.classList.contains("receipt-calendar-description") ? "notes" : child.classList.contains("receipt-calendar-invitees") ? "invitees" : child.classList.contains("receipt-calendar-location") ? "location" : "travel"))).toEqual(["title", "notes", "invitees", "location", "travel"]);
  await page.getByLabel("Home address", { exact: true }).fill("100 Example Street, Las Vegas NV 89147");
  await page.getByLabel("Work address", { exact: true }).fill("200 Example Avenue, Las Vegas NV 89101");
  await page.getByLabel("Sample home minutes", { exact: true }).fill("25");
  await page.getByLabel("Sample work minutes", { exact: true }).fill("35");
  await expect(appointment.locator(".receipt-travel-row")).toHaveText(["25 min·leave 9:35 AM", "35 min·leave 9:25 AM"]);
  await expect(appointment).not.toContainText("Sample travel");
  await receipt.screenshot({ path: ".local/calendar-descriptions.png" });
  await page.getByRole("button", { name: "Paper & printer", exact: true }).click();
  await page.getByLabel("Paper width", { exact: true }).selectOption("58");
  expect(await receipt.locator(".receipt-travel-row").evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth + 1))).toBe(true);
  await receipt.screenshot({ path: ".local/calendar-descriptions-narrow.png" });
  await page.getByLabel("Paper width", { exact: true }).selectOption("80");
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Live");
  const stored = await page.evaluate(() => localStorage.getItem("receipt-summary:configuration:v1"));
  expect(stored).toContain(id);
  expect(stored).not.toMatch(/aaaa-bbbb|example@icloud|password/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export settings", exact: true }).click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).not.toMatch(/aaaa-bbbb|example@icloud|password/);
  await page.reload();
  await expect(receipt).toContainText("Dentist appointment");
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(page.getByLabel("Home address", { exact: true })).toHaveValue("100 Example Street, Las Vegas NV 89147");
  await expect(page.getByLabel("Sample work minutes", { exact: true })).toHaveValue("35");
  fail = true;
  await page.getByRole("button", { name: "Refresh calendar", exact: true }).click();
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Unavailable");
  await expect(receipt).not.toContainText("Dentist appointment");
  await expect(receipt).toContainText("Calendar unavailable");
  fail = false;
  await page.getByRole("button", { name: "Disconnect iCloud", exact: true }).click();
  await expect(page.getByLabel("App-specific password", { exact: true })).toHaveValue("");
  await expect(receipt).toContainText("Connect iCloud in Sources");
  await page.getByLabel("Calendar source").selectOption("sample");
  await expect(receipt.locator(".receipt-data-mode")).toHaveText("Sample");
  expect(errors).toEqual([]);
});
test("composes, persists, reflows, and remains useful offline in a real browser", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("[data-receipt-block]")).toHaveCount(8);
  await expect(page.locator('.receipt-source')).toHaveCount(0);
  await page.screenshot({ path: ".local/workspace.png" });
  const receiptOrder = () =>
    page
      .locator("[data-receipt-block]")
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("data-receipt-block")),
      );
  await page
    .getByRole("button", { name: "Move Weather down", exact: true })
    .click();
  expect((await receiptOrder()).slice(0, 3)).toEqual(["summary", "calendar", "weather"]);
  await page
    .locator(".block-row")
    .filter({
      has: page.getByRole("button", {
        name: "Configure Projects",
        exact: true,
      }),
    })
    .dragTo(page.locator(".block-row").first());
  expect((await receiptOrder())[0]).toBe("projects");
  await page.getByRole("switch", { name: "Enable Tasks", exact: true }).click();
  await expect(page.locator('[data-receipt-block="tasks"]')).toHaveCount(0);
  const colors = new Set<string>();
  for (const condition of ["rain", "clear", "cloudy", "storm", "night"]) {
    await page.getByTitle(`Simulate ${condition}`).click();
    await expect(page.locator(`.scene-${condition}`)).toBeVisible();
    colors.add(
      await page
        .locator(".weather-scene")
        .evaluate((n) => getComputedStyle(n).backgroundImage),
    );
  }
  expect(colors.size).toBe(5);
  await page.getByTitle("Simulate rain").click();
  await page.getByLabel("Units", { exact: true }).selectOption("celsius");
  await expect(page.locator(".receipt-weather-current")).toContainText("14°C");
  const note = page.getByLabel("A note for this block", { exact: false });
  const normalHeight = await page
    .locator(".receipt-paper")
    .evaluate((n) => n.getBoundingClientRect().height);
  const longNote =
    "Natural wrapping keeps every detail visible. ".repeat(70) +
    "END_OF_LONG_NOTE";
  await note.fill(longNote);
  await expect(page.locator(".receipt-block-note")).toContainText(
    "END_OF_LONG_NOTE",
  );
  const longHeight = await page
    .locator(".receipt-paper")
    .evaluate((n) => n.getBoundingClientRect().height);
  expect(longHeight).toBeGreaterThan(normalHeight + 300);
  expect(
    await page
      .locator(".receipt-paper")
      .evaluate((n) => n.scrollHeight <= n.clientHeight + 5),
  ).toBe(true); // 3 px decorative tear edge
  await note.fill("Take the morning at your own pace.");
  await page.getByLabel("Content density").selectOption("compact");
  await expect(page.locator('[data-receipt-block="weather"]')).toHaveClass(
    /receipt-density-compact/,
  );
  await page
    .getByRole("button", { name: "Configure Calendar", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Work", exact: true }).uncheck();
  await expect(page.locator(".receipt-agenda")).not.toContainText(
    "Morning project check-in",
  );
  await page
    .getByRole("button", { name: "Paper & printer", exact: true })
    .click();
  const wideHeight = await page
    .locator(".receipt-paper")
    .evaluate((n) => n.clientHeight);
  await page.getByLabel("Paper width", { exact: true }).selectOption("58");
  await expect(
    page.getByLabel("Printable width", { exact: false }),
  ).toHaveValue("54");
  const dimensions = await page
    .locator(".receipt-paper")
    .evaluate((n) => ({ width: n.clientWidth, height: n.clientHeight }));
  expect(dimensions.width).toBeGreaterThan(215);
  expect(dimensions.width).toBeLessThan(225);
  expect(dimensions.height).toBeGreaterThan(wideHeight);
  await page.getByLabel("Printable width", { exact: false }).fill("");
  await page
    .getByLabel("Printable width", { exact: false })
    .pressSequentially("46");
  await expect(page.getByLabel("Printable width", { exact: true })).toHaveValue(
    "46",
  );
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page.getByRole("checkbox", { name: "Enable morning schedule" }).check();
  await page.getByLabel("Briefing time").fill("06:45");
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("receipt-summary:configuration:v1")!),
  );
  expect(stored.blocks[0].id).toBe("projects");
  expect(
    stored.blocks.find((b: { id: string }) => b.id === "tasks").enabled,
  ).toBe(false);
  expect(stored.weather.units).toBe("celsius");
  expect(stored.printer.contentWidth).toBe(46);
  expect(stored.schedule.time).toBe("06:45");
  expect(stored.schedule.enabled).toBe(true);
  await page.route("**/api/weather?*", (route) => route.abort("failed"));
  await page.route("**/api/news", (route) => route.abort("failed"));
  await page.getByLabel("Weather source").selectOption("live");
  await expect(page.locator('.adapter-note')).toContainText(
    "Live request failed",
  );
  await expect(page.locator('[data-receipt-block="weather"] .receipt-data-mode')).toHaveText(
    "Sample",
  );
  await page
    .getByRole("button", { name: "Configure Headlines", exact: true })
    .click();
  await page.getByLabel("Headline source").selectOption("live");
  await expect(page.locator('[data-receipt-block="news"]')).toContainText("Unavailable");
  await expect(page.locator(".receipt-headlines li")).toHaveCount(0);
  await expect(page.locator('.adapter-note')).toContainText(
    "Live request failed",
  );
  await page
    .getByRole("button", { name: "Configure Weather", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".weather-rain i")
      .first()
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
  expect(errors).toEqual([]);
});
