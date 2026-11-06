# BriefReceipt

A local desktop workspace for composing a personal morning briefing for a thermal receipt printer. Reorder eight configurable blocks beside a live, unbounded receipt preview. This is the first working application foundation; editable design defaults await user review.

## Run locally

Use **Node.js 22.12+** and npm (verified with Node 25.6). For first setup or a dependency reinstall, stop this project's running dev/build processes, then install:

```sh
npm ci
```

For normal launches after setup, run:

```sh
npm run dev
```

Open **http://localhost:5173**. The one development command starts Vite and the public-source adapters. It watches server source changes and automatically restarts the collector; after a restart, refresh Calendar to collect updated fields. The server binds to loopback only. Sample mode and public sources need no credentials; optional OpenAI summaries use a paid API project.

On Windows, `EPERM` while unlinking `esbuild.exe` can mean a running dev/build process still holds the executable. Stop that process with **Ctrl+C** in its terminal, wait for it to exit, and rerun `npm ci`. Administrator access is not needed to resolve this file lock. If an install was interrupted, finish `npm ci` before launching again.

For a reproducible production build using the committed lockfile:

```sh
npm ci
npm run build
npm start
```

`npm start` serves `dist/` and the same adapters on port 5173. Set `PORT` to override it. Stop the dev server before starting production on the same port.

## Linux VM deployment

Use the [Linux deployment guide](docs/linux-deployment.md) and [systemd service](deploy/briefreceipt.service) for a private always-on instance with Node.js 24 LTS, automatic restart and boot startup. The editor stays on loopback and is accessed through SSH; iPhone uploads use the separate private Tailscale receiver. `RECEIPT_DATA_DIR` moves credentials, the AI budget ledger and Reminders state outside the checkout. The guide includes state migration, health checks, backups, updates and rollback. Scheduled printing and physical printer delivery remain future work.

## What works

- Drag blocks or use their move arrows; enable or disable them independently. Edit density, item counts, source selections, and printable block notes. Changes immediately update the receipt.
- Lead with **AI summary**: every enabled, available module except News is assessed independently. Each module contributes zero or one concise sentence, with a blank line between ideas. Quiet modules add no text; a quiet day says **Nothing noteworthy in the available updates.** Related facts, useful numbers and supported explanations fit within that module's single sentence. News content is excluded from summary generation and research; targeted research can still explain market, weather and public-event observations. Feed and coverage disclosures stay in the source block. The receipt heading is the full date, without an edition tagline, custom title or preview notice.
- Select calendars, task lists, headline categories, tracked stocks, an editable local area, and project-folder paths. Paths are identifiers only: **no folders are scanned or uploaded**.
- Connect iCloud Calendar using a dedicated app-specific password, select discovered calendars, and load events for today and the next four days read-only. Day headings distinguish Today, Tomorrow and later dates; the item limit applies across the full window with omitted events disclosed. Below each title: notes, deduplicated invitees with response icons, location, and sample home/work travel rows. Notes up to 90 characters appear verbatim. Connect OpenAI in Calendar settings to summarize longer notes, shown in italics; failures retain complete notes. Sources and Calendar settings configure local city/state, home/work addresses and placeholder minutes. Travel remains synthetic until [routing ticket 13](.scratch/personal-v1/issues/13-calendar-travel-times.md) is implemented. Successful connections save to Git-ignored `.env` and restore automatically after server restarts.
- Pair an iPhone Shortcut using a locally generated QR code. Upload Reminders snapshots with completion status through a separate private Tailscale receiver. Show overdue incomplete reminders plus all items due today and the following four days, including checked-off items. Snapshots expire after two hours.
- Save schedule time, timezone, weekdays, and enabled state. Jobs and printer delivery do not run yet. The initial disabled 07:00 weekday schedule is an implementation default, not a user-approved operational schedule.
- Start with 80 mm paper and 72 mm printable width. Change them independently, adjust typography and zoom, and inspect approximate length. Content wraps naturally with **no length cap, automatic truncation, or overflow suppression**. Centimeters use browser CSS units, not calibrated printer output.
- Explore rainy, clear, cloudy, stormy, and nighttime weather. Rain, clouds, lighting and glass effects stay on screen; the receipt stays monochrome. Reduced-motion preferences disable animation.
- Settings save automatically in this browser and survive reloads. **Export settings** downloads JSON, including configured private paths. Settings do not synchronize between browsers; there is no import UI.

Desktop only: 1180 px minimum workspace, 1440 px or wider recommended. Long settings panels scroll independently. Scroll the page to inspect the entire receipt. Fonts are bundled locally with no font-service request.

## Demonstration and live sources

The initial edition contains **synthetic sample data dated November 5, 2026**. Headlines, prices, events, and project evidence are invented, never current factual observations. Compact Sample/Live labels sit in block headings; hover a label for source metadata. Weather observation time, news publication times and market-session times remain inline. Repeated disclosure footers are omitted from the receipt; collection notes remain in the editor.

Switch weather, headlines or markets to live in block settings or **Sources**. **Refresh public sources** requests enabled public adapters (subject to cache).

| Block | Source behavior |
| --- | --- |
| Weather | Open-Meteo, today plus three days, Fahrenheit or Celsius. Live support uses approximate Spring Valley coordinates for **ZIP 89147 only**, not a home address. Other saved ZIPs explicitly fall back to labeled 89147 samples. |
| Headlines | Optional Guardian developer API connection: up to five original headlines across selected categories from the past 24 hours. General, business/technology, Tesla/SpaceX and Nevada-area keyword searches; local coverage is partial. Publisher excerpts, publication times and original links are shown, with small text attribution once in the footer. News is excluded from AI summary. Missing keys and failed collection show **Unavailable**. |
| Calendar | Optional read-only iCloud CalDAV connection. Selected calendars, today plus the next four Pacific days, all-day events, recurrences, exclusions and rescheduled/cancelled instances. Grouped by day; ongoing multi-day occurrences appear once. Live errors show **Unavailable**, without sample substitution. |
| Tasks | Optional iPhone Shortcut snapshots. Overdue incomplete reminders plus all items due today and the following four Pacific calendar days from selected lists. Completed items in that current/future window show a checkmark, struck-through title and completed label. Rows retain due-day labels. Missing/stale snapshots show **Unavailable**. |
| Markets | Optional Alpaca Paper Trading connection, using the free IEX feed for stock prices and regular-session 1D/1W sparklines. Only tracked stocks are included; unsupported symbols show Unavailable. |
| Local events, projects | Synthetic fixtures with editable selections. No local collector or live event feed is connected. |

Weather previously returned live data during implementation. Guardian is implemented and tested with synthetic API responses; real account access awaits a developer key. Both use six-second upstream timeouts. Weather uses a ten-minute memory cache and labeled sample fallbacks. Guardian uses a twenty-minute memory cache with original retrieval times, and shows **Unavailable** on failure. The frontend also times out requests. `GET /api/weather?offline=1` exercises weather fallback; `/api/news?offline=1` returns unavailable headlines. A successful live news selection without matching categories is honestly empty. [Source terms and behavior](docs/data-sources.md).

The future production missing-data policy remains **Unavailable** for the affected block/item. Preview fixtures are a separate mode.

## Connect Alpaca markets

1. Open **Markets** in Compose, or **Sources → Markets**. Enter the **API key ID** and **secret key** from your [Alpaca Paper Trading dashboard](https://app.alpaca.markets/) and click **Connect Alpaca**. Keep the free Basic data plan. The app verifies the paper-account trading calendar and IEX price-history access before saving both credentials in the Git-ignored `.env`. A rejected replacement preserves the existing credentials.
2. Successful connection selects **Alpaca · IEX**. Set up to 20 comma-separated stock symbols. The server uses only read-only calendar and market-data requests; it never places orders. There is no subscription purchase or automatic paid-feed upgrade.
3. The market heading shows **Open**, **Pre-market**, **After-hours** or **Closed** instead of a Live badge, using the exchange calendar; if status cannot be determined it shows **Unknown**. Sample mode stays labeled Sample. Each stock has a prominent ticker and current price, followed by separate **DAY** and **WEEK** performance rows. A bold percentage and up/down marker show direction; the dollar gain or loss sits beside it. Each row is paired with a full-width monochrome sparkline and a marked endpoint. The old table, chart-axis values and printed disclosures are omitted; full source/session metadata remains in the data and editor. **DAY** uses five-minute prices from the current regular session, or the latest completed session when closed. **WEEK** uses thirty-minute samples across the last five trading sessions; its percentage compares the latest value with the close preceding that window. Missing changes show Unavailable; insufficient history omits the chart. Split-adjusted open/high/low/close/volume history remains available for later views; chart arrays are excluded from AI highlight requests.
4. Alpaca's exchange calendar handles weekends, holidays, early closes and daylight saving. Before opening or when closed, prices use the latest completed regular-session IEX close. During trading, missing observations or observations older than 15 minutes show Unavailable. IEX is one exchange, so prices and volume differ from consolidated market data. Dow and S&P 500 rows are omitted from both live and sample markets. Unsupported symbols retain their entered identities and show Unavailable.
5. Enabled live markets refresh once per minute and share a one-minute server cache. Cache entries retain original timestamps and expire at session boundaries or when an observation becomes stale. Failed collection shows Unavailable. Switch **Market source** to **Sample markets** explicitly to return to fixtures.
6. **Disconnect Alpaca** removes only `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY`, preserving other `.env` settings. Saved keys restore after server restarts. Credentials stay on the local server after submission and never enter browser storage, settings exports, client bundles or status responses. They are stored as plaintext in the local `.env`, following the project's existing connection pattern. Connection and collection endpoints are protected by same-origin loopback checks.

Validated with synthetic API fixtures and browser tests for connection, persistence, chart rendering, print visibility, export privacy and failure behavior. A real-account collection on November 5, 2026 successfully returned TSLA prices, 78 daily-chart points and 65 weekly-chart points using the saved connection. If an older server is already running, restart it once to load `/api/alpaca` routes. [Source details](docs/data-sources.md#markets-and-other-sources).

## Connect Guardian headlines

1. Get a personal developer key from [Guardian Open Platform](https://open-platform.theguardian.com/access/).
2. Open **Headlines**, or **Sources → News**. Enter the key and click **Connect Guardian**. The server verifies access before saving `GUARDIAN_API_KEY` in the Git-ignored `.env`, preserving other credentials. You can also set it locally using [.env.example](.env.example).
3. A successful connection selects **The Guardian**. Choose coverage categories and **Items to include** (up to five total). **Refresh headlines** respects the twenty-minute cache. The app searches general reporting, business/technology, Tesla/SpaceX and Nevada/Las Vegas keywords; local-area settings do not change these fixed news queries yet. Local coverage is partial, and fifty newest candidates per category can omit older stories on busy days.
4. Each item shows its original headline, the publisher's excerpt when supplied, and its publication date/time. The API's `trailText` is preferred, with `standfirst` as a fallback; markup is removed and entities decoded, without AI rewriting in the Headlines block. No full article bodies are requested. Small text attribution and copyright appear once at the bottom of the receipt. **News is excluded from AI summary and its research**; the Headlines block continues to display original headlines and excerpts. Successful empty results stay empty; connection/provider failures show **Unavailable**. Samples are available only by explicitly selecting sample mode.
5. **Disconnect Guardian** removes its key and clears the server's headline cache. Connection controls are loopback-only; keys never enter browser storage, client bundles, settings exports or status responses. The receipt workflow follows the user's requested personal accessibility use; [source notes](docs/data-sources.md#news) record the unresolved terms interpretation. Physical printer transport remains unimplemented.

The free developer tier currently allows 500 requests/day and one request/second. Collection serializes four metadata searches at least 1.1 seconds apart and caches results for twenty minutes. A conservative 480-call UTC-day guard is in memory; it resets on server restart and does not account for other applications using the key. Provider limits still apply. No subscription is purchased. Real account access awaits a developer key; synthetic API and browser tests verify the implemented workflow.

## Connect iCloud Calendar

1. Start the app with `npm run dev` and open **http://localhost:5173**. After updating an already running installation, restart its server once to load the new API routes.
2. Open **Sources → Calendar & tasks**, or click **Calendar** in the left column.
3. Enter your Apple Account email and dedicated app-specific password in the local form, then click **Connect iCloud**. Do not enter your main Apple Account password. [Apple's password setup instructions](https://support.apple.com/en-us/102654).
4. The calendar source switches to **iCloud Calendar**. Check the calendars to include. None are selected automatically on a new account. Events for today and the next four days load with date headings; an empty successful result means no appointments in that window, while an error is explicitly **Unavailable**. In Calendar settings, increase **Items to include** (up to 20) when the receipt reports omitted events.
5. Use **Refresh calendar** for changes. Successful sign-ins save `ICLOUD_EMAIL` and `ICLOUD_APP_PASSWORD` in this project's Git-ignored `.env`; the server restores the connection when Calendar is first requested after a restart. You can also fill in those values locally using [.env.example](.env.example). Existing in-memory sign-ins from older versions require one more local sign-in to populate the file. **Disconnect iCloud** clears the connection and removes those two variables while preserving unrelated `.env` settings. If saved authentication fails, use **Retry saved connection** or sign in again; a failed attempt does not overwrite valid saved credentials.

The password is stored as plaintext in `.env`, as requested, and read only by the local server. It never enters browser configuration, settings exports, API status responses or logs. Never use a `VITE_` prefix for secret variables. The server sends credentials only to allowed Apple CalDAV HTTPS hosts. Requests use read-only `PROPFIND` and `REPORT` methods; Apple's password itself is not restricted to read-only access. The editor endpoint is loopback-only and checks request host/origin. Discovery and collection each have a 30-second upstream deadline. Events use **America/Los_Angeles**, independent of the server's timezone, and refresh when the Pacific date changes. User calendar names and selected IDs remain private configuration in settings exports.

Reminders uses the separate Shortcut integration below. Connecting Calendar does not connect task lists. The Calendar integration has been verified against synthetic DAV responses and a mocked account in Edge; actual account compatibility is established by your first local connection.

## Connect OpenAI for briefing highlights and calendar notes

1. Open **AI summary** or **Calendar** in Compose, or **Sources → Calendar & tasks**. Under **OpenAI connection**, enter a dedicated [OpenAI API project key](https://platform.openai.com/api-keys) with Responses access and click **Connect OpenAI**. The app makes a small synthetic test request to verify model access before saving `OPENAI_API_KEY` in the Git-ignored `.env`. It does not use personal calendar data for that test. Existing keys can be replaced in the same form; a failed test preserves the previously saved key. You can also set `OPENAI_API_KEY` locally using `.env.example`.
2. With **AI summary** enabled, every included module except News is assessed independently for significance, respecting source selections and item limits. It receives full calendar notes rather than their condensed display summaries, named invitees, market percentages/session context, source coverage and observation dates. Completed reminders and the entire News/Headlines module are excluded. Highlights use [**gpt-6.1-sol**](https://developers.openai.com/api/docs/models/gpt-6.1-sol) with **medium reasoning** and an 8192-token reasoning/output safety cap. Each module contributes at most one short sentence, separated from other modules by a blank line; quiet modules add no sentence. The combined research and summary deadline is 90 seconds (95 seconds in the browser). The structured response must contain exactly one assessment per available module, including `highlights: []` for quiet modules; missing, duplicate and unknown assessments, multiple highlights, and multiple sentences per module are rejected. Every printed highlight requires a matching evidence excerpt. These grounding fields and quiet assessments are not printed. Missing sources or provider failures never become a false quiet result. With any live sections, sample sections cannot supply highlights. All-sample briefings are labeled Sample. Disable the module to stop these requests, or use **Refresh AI summary** to retry.

   Before writing, a separate [**gpt-6-luna**](https://developers.openai.com/api/docs/models/gpt-6-luna) request can use [web search](https://developers.openai.com/api/docs/guides/tools-web-search) to find relevant reasons and practical implications for public developments. Only whitelisted live market observations (stock moves of at least 5%, indices at least 2%), city-level weather and public event details enter this request. The News module, calendar notes, invitees, tasks, project details and custom block notes never enter web research. Research considers each supplied public module, uses low reasoning, at most two web calls, 2048 output/reasoning tokens, and 35 seconds. It skips routine public updates and requires cited explanations matching the observation's subject and date. The final writer includes useful magnitude and context, distinguishing reported concerns from confirmed causes. Inline numbered source links are validated against URLs actually retrieved and cited during research. No provider or coverage disclosures appear in highlight prose. Failed, uncited or unavailable research falls back to the supplied observations without guessing a cause. This applies across public update types rather than encoding a particular stock narrative.

   For calendar notes, select **iCloud Calendar** and the calendars to include. Long notes for the first **Items to include** events are sent with title, time, location and invitees; disabled Calendar blocks and sample calendars skip this separate notes-processing step. Calendar-note compression retains **gpt-5.6-luna** with reasoning disabled. All requests use the [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) with storage disabled and no automatic retries, sharing one monthly allowance. Only the public research request has web tools. The connection test verifies calendar-model access; the first highlights request verifies Sol access and reports a model-access error if necessary. Public research is optional when model access or search is unavailable.
3. Generated notes are italicized and limited to 90 Unicode code points, without a visible AI label or a full-notes expansion control. Missing keys, network errors, insufficient quota, refused/incomplete output and invalid or overlong summaries preserve the complete original, with an AI-unavailable explanation. Calendar collection allows 30 seconds, followed by a shared 20-second AI deadline; the browser allows 65 seconds for the combined request.
4. **Disconnect OpenAI** removes only its key and clears cached summaries, preserving iCloud credentials and AI usage history. The key never enters browser storage, settings exports, API status output or logs. Local server checks restrict these controls to same-origin loopback access. Summary results and conservative monthly reservations persist in ignored `.local/ai/state.json`; that local file contains summaries and source/context hashes, not keys or raw event inputs. These local files are not encrypted by the app.

Unchanged event text and context reuse cached summaries across refreshes and restarts, without another API call. Editing notes, title, time, location or invitees invalidates the corresponding cache entry. Highlights also include the Pacific date, prompt, model, reasoning settings and research version in their cache key. Briefings eligible for public research expire after 30 minutes so unchanged observations can gain newly reported context. Other briefings retain their existing persistent cache behavior. Old recap entries are discarded without erasing usage history or calendar summaries. Concurrent duplicate requests share both research and writing, with at most three calendar-note generations per collection. Failure results have a 60-second cooldown. The cache retains up to 500 summaries.

Before each request, the app persists a conservative cost reservation using UTF-8 input bytes plus overhead, the output-token limit (including reasoning), and the documented prices checked November 5, 2026: [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) $0.20/$1.20 and [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) $2/$10 per million input/output tokens. It retains the reservation even on failure, stops before exceeding **$20 per UTC month**, and fails closed if usage history cannot be read. This is a local single-server AI guard, not an OpenAI account spending limit or a tracker for other paid services. Other recurring project costs must still fit the agreed $20 total budget. Reservations intentionally overstate actual token usage; billing and credits remain in your OpenAI account. Run one server instance per project state directory.

Public research reserves $0.70 before its request, covering three full-context GPT-6 Luna passes at conservative long-context rates ($0.20/$0.75 per million input/output tokens), its output cap, and two [web calls at $0.01 each](https://developers.openai.com/api/docs/pricing). Successful responses with valid usage settle down to reported token usage at those conservative rates plus tool fees; uncertain or failed requests retain the reservation. Research is skipped when its reservation would leave less than $0.50 for writing. It shares the same $20 monthly ledger; calendar-note and final-writing reservations retain their existing behavior.

## Connect Apple Reminders with an iPhone Shortcut

The app starts two loopback services: the desktop editor on **5173** and a limited upload receiver on **5180** (`REMINDERS_PORT` overrides it). The upload service exposes only the phone setup guide, `/health`, and authenticated `POST /upload`. It cannot read tasks, serve the editor, or reach Calendar credentials. The app must be running and the computer awake for uploads; this desktop trial is not yet the planned always-on VM deployment.

1. On the host, use private [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve), not Funnel. Check `tailscale serve status` before adding a listener so you do not replace another service. This task configured an unused HTTPS port **8443** to forward to the upload receiver:

   ```powershell
   tailscale serve --bg --https=8443 http://127.0.0.1:5180
   ```

   On Windows this may need an administrator terminal. Follow Tailscale's HTTPS setup if prompted. The endpoint resembles `https://your-pc.your-tailnet.ts.net:8443`; its actual value stays in ignored local app state. Keep Tailscale connected on both devices and **Use Tailscale DNS** enabled on the phone. No firewall opening or public tunnel is needed. To remove this mapping, run `tailscale serve --https=8443 off`.

2. Open **Tasks** in the desktop app. Save the phone server address if not already filled in, then choose **Create upload token**. This switches Tasks to the Shortcut source. Scan the QR with your iPhone camera to open the setup guide with your upload URL and authorization value. **Open Shortcut instructions** also opens a local desktop copy, even when the desktop does not use Tailscale DNS.
3. Build **Send Reminders to Receipt** in Apple Shortcuts using the action-by-action guide. Find both incomplete and completed reminders from your chosen lists; export title, list name, due day and completion status. For an existing Shortcut, remove **Is Completed is false** from Find Reminders. Inside Repeat, read **Is Completed** from Repeat Item; an If action outputs Text `true` or `false`, saved as **Completed Flag**. Add a Text field named `completed` to the reminder Dictionary using that variable. Keep your existing date fields. Serialize each Dictionary with **Get Text from Input**, combine Repeat Results using a custom comma, and insert Combined Text into the outer JSON Text template. Send the named JSON text as a file body with the existing URL, authorization and JSON content-type headers. No Apple password, notes or attachments are requested. Due dates remain `yyyy-MM-dd`; keep the phone timezone on Pacific. Empty snapshots and undated reminders are valid.
4. Run the updated Shortcut manually and check for `"ok":true`. Within about 15 seconds, the desktop shows the upload. Check the received lists to include in the receipt; the server includes overdue incomplete reminders plus all items due today and the following four Pacific calendar days, including completed ones. Completed overdue items stay hidden. Rows sort by due date, with incomplete items first within each date. Checked-off rows show a checkmark and struck-through title; future labels remain **Tomorrow** or the subsequent weekday. Existing item-count settings still apply, with omitted rows disclosed. Older uploads lacking completion status remain compatible but cannot show checked-off items until the updated Shortcut sends them.
5. Once manual delivery works, remove **Show Result** and set a Time of Day personal automation to run the Shortcut before the briefing, without asking. Test while the phone is locked. Browser verification does not establish iOS action compatibility, permissions, background delivery or phone connectivity. This app still does not schedule print jobs.

Pairing generates a 256-bit bearer token shown only during setup. Its **SHA-256 hash**, the server address and latest snapshot persist in ignored `.local/reminders/state.json`. The raw token is excluded from files, browser storage and settings exports. The QR carries it in a URL fragment; the guide removes the fragment from history immediately and loads no external assets. Creating a replacement revokes the previous token; **Disconnect Reminders** revokes it and clears the snapshot. Invalid/unauthorized/older uploads do not replace valid data. Snapshots older than **two hours** show Unavailable with their last capture time. The local snapshot file is not encrypted by this app.

Markets show synthetic stock values and actual Dow/S&P **index identities with fictional point values**, never silent ETF substitutions. Every row carries session, as-of time and freshness. The tested generation-time policy uses `America/Los_Angeles`: before 06:30 requests previous completed close; at/after 06:30 requests current/opening data. A future provider must enforce the explicitly labeled delay of at most 15 minutes, exchange calendars and opening-pending behavior. Sample quotes retain their fixture session regardless of the wall clock.

## Verification

```sh
npm test
npm run test:browser
npm run build
npm run test:production
```

Focused tests cover persistence recovery, malformed settings, weather/RSS adapters, market cutoffs, iCloud discovery/read-only methods/recurrence/DST, OpenAI connection validation, grounded/quiet highlight output, model routing, cache migration/monthly reservations, and Reminders upload validation, persistence, filtering, stale/empty behavior, token rotation and receiver isolation. Nine browser checks in installed **Microsoft Edge** cover the existing workspace, mocked Calendar, OpenAI and Shortcut connections, credential exclusion from settings/exports, quiet highlights, italic calendar-note presentation, QR generation and the mobile guide. Screenshots and output go into ignored `.local/`. Automated unit and browser tests use synthetic provider responses.

`npm run eval:highlights` is an optional **paid** check against the running local server and saved OpenAI connection. It sends only synthetic scenarios through the same cache and cost guard. Use `npm run eval:highlights -- --filter="researched context"` for the focused November 5 market-context regression, or `--filter="Independent module"` to check coverage across modules. The module regression retained five important module sentences, with blank lines between them, while excluding News and omitting the routine local event. Other cases cover quiet days, full calendar notes, excluded Headlines, sample isolation and unsupported importance labels. These cases check editorial behavior, not comprehensive model accuracy; model output and web results vary.

For another installed Playwright browser, set `BROWSER_CHANNEL` (for example `chrome`). To use Playwright Chromium, run `npx playwright install chromium` and set `BROWSER_CHANNEL=chromium`. In PowerShell set `$env:BROWSER_CHANNEL = 'chromium'` before running the check.

## Assets and structure

Weather/workspace SVG icons: [Lucide](https://lucide.dev/), ISC with inherited Feather MIT notices in [the bundled license](public/weather/LICENSE). The weather set uses CloudRain, Sun, Cloud, CloudLightning and MoonStar; atmospheric CSS is original. [DM Sans](https://github.com/googlefonts/dm-fonts) and [Manrope](https://github.com/sharanda/manrope) are bundled via Fontsource under SIL OFL 1.1, with [font licenses](public/fonts). Open-Meteo data is attributed under CC BY 4.0. Guardian headlines and publisher excerpts retain original wording and links. Attribution appears as small footer text; no full article bodies or news imagery are collected. [Detailed source documentation](docs/data-sources.md).

- `src/types.ts`: shared configuration/data contract.
- `src/config.ts`: validation and browser persistence.
- `src/components/`: block editor, settings, weather scene, independent receipt renderer.
- `src/data/fixtures.ts`: all synthetic content.
- `server/`: public adapters and development/static serving.

React, TypeScript, Vite and Express keep the stack explicit. Actual iPhone/background Shortcut validation, local project collection, additional local news providers, scheduled jobs, printer transport/calibration, mobile editor layout and deployment to the target VM remain future work.

Existing planning/research: [personal v1 map](.scratch/personal-v1/map.md), [content contract](.scratch/personal-v1/issues/05-briefing-content-contract.md), [build ticket 06](.scratch/personal-v1/issues/06-block-layout-prototype.md), [domain language](CONTEXT.md), [tracker conventions](docs/agents/issue-tracker.md).
