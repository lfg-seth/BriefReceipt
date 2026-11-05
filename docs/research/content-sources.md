# Content source feasibility

Researched 2026-11-05 for [Investigate iCloud, weather, news, and market data sources](../../.scratch/personal-v1/issues/03-content-source-feasibility.md). Documentation investigation only: no accounts connected, credentials inspected, quote requests authenticated, or live personal-data compatibility tests performed.

## Feasibility matrix

| Requested block | Feasible path | Cost and limitation | Readiness |
| --- | --- | --- | --- |
| Today's weather plus three-day outlook | Open-Meteo daily/hourly forecast; NWS alternative for a US location | Open-Meteo free for personal noncommercial use with attribution; NWS free open data | Straightforward; location and units still needed |
| iCloud Calendar | CalDAV from the VM, with a dedicated app-specific password | Requires Apple Account 2FA; application-enforced read-only access and calendar allowlist | Feasible; validate selected calendars, recurrence, timezone and all-day events against actual account |
| iCloud tasks | Apple-device Shortcut/EventKit export; evaluate current PyiCloud as an optional Linux adapter | Direct modern Reminders access differs from Calendar; unofficial web API carries auth/compatibility maintenance | Keep conditional until a read-only account test or bridge prototype succeeds |
| Tesla and SpaceX company news | Company IR updates and filings, plus selected publisher feeds | Primary announcements are company statements, not a full independent news roundup; feed availability and publisher reuse terms need checking | Feasible with explicit source selection |
| Stock snapshot and daily market summary | Quote/history provider for TSLA and SPCX; index provider or explicitly named ETF proxies for broad markets | Freshness, display rights, index entitlement and recurring costs vary | Feasible; provider and acceptable freshness remain decisions |

## Weather

Open-Meteo's forecast API accepts coordinates, hourly/daily variables, timezone and forecast length. A four-day request can provide today plus the following three days; whether the user means three days including today remains a content decision. Useful deterministic values include weather code, high/low, precipitation probability and wind. Render these directly; AI can add optional prose. [Open-Meteo forecast documentation](https://open-meteo.com/en/docs)

The free service permits noncommercial usage up to 10,000 calls/day, requires attribution and has no uptime guarantee. Its data license and hosted-service terms are separate concerns: an open-source personal tool can use the personal tier, while a future commercial service must revisit terms. [Open-Meteo pricing](https://open-meteo.com/en/pricing), [Open-Meteo terms](https://open-meteo.com/en/terms)

For a US location, the NWS API offers forecasts and alerts as free open data. Discover forecast URLs through the points endpoint and provide an identifying User-Agent. Its rate limit is unpublished; use caching and retry handling. This is an alternative, not an assumed location choice. [NWS API documentation](https://www.weather.gov/documentation/services-web-api)

## iCloud Calendar

Apple documents app-specific passwords for third-party calendar access, requiring 2FA. Individual passwords can be revoked; changing the main Apple Account password revokes all app-specific passwords. These are credentials, not a read-only permission scope: read-only behavior should be enforced by the briefing adapter. [Apple app-specific passwords](https://support.apple.com/en-us/102654)

The vdirsyncer project's own documentation says it regularly tests iCloud and uses `https://caldav.icloud.com/` with app-specific passwords. This establishes a practical Linux integration path, not an Apple guarantee for this application or account. Perform discovery rather than hardcoding an account's server shard. [vdirsyncer iCloud documentation](https://vdirsyncer.pimutils.org/en/stable/tutorials/icloud.html)

## Reminders: distinguish supported bridges from unofficial cloud access

Do not infer modern iCloud Reminders support from successful Calendar access. A current CalDAV Reminders adapter documents that upgraded lists use CloudKit and only legacy, non-upgraded lists may remain accessible via CalDAV; some accounts expose none. That is the adapter maintainer's compatibility statement, not an Apple support guarantee. A read-only discovery check would establish whether the user's lists are present without modifying tasks. [iCloud Reminders adapter documentation](https://github.com/Lingnik/icloud-reminders-mcp/blob/main/README.md)

There is a current Linux candidate worth testing: PyiCloud documents typed Reminders lists and snapshot reads, including due and completion fields. Its maintainers explicitly state that it uses undocumented Apple web services and cannot guarantee endpoint, account or authentication continuity. Its authentication uses Apple Account login and potentially interactive 2FA/trusted sessions, unlike the simpler CalDAV app-password route. Treat it as an optional integration with a visible stale/error state. [PyiCloud Reminders](https://pyicloud.readthedocs.io/en/latest/services/reminders/), [compatibility guarantees](https://pyicloud.readthedocs.io/en/latest/guides/compatibility/), [authentication](https://pyicloud.readthedocs.io/en/latest/guides/authentication/)

An Apple-device bridge is a supported-building-block alternative: Shortcuts offers Find Reminders, and Get Contents of URL can send POST request bodies to the VM. EventKit also documents fetching incomplete reminders. Combining them into a scoped JSON export is a proposed design, not a tested solution; confirm which Apple device can reliably run it and how old a snapshot may be. A manually exported task list is a fallback. [Apple Find/Filter actions](https://support.apple.com/en-ph/guide/shortcuts/apd3c845e881/ios), [Apple Shortcuts API requests](https://support.apple.com/en-lamr/guide/shortcuts/apd58d46713f/ios), [Apple EventKit retrieval](https://developer.apple.com/documentation/eventkit/retrieving-events-and-reminders)

## News

Tesla maintains a press-release page; SpaceX has investor updates, alerts and SEC filings. These can anchor company-news blocks. Automated feed extraction still needs validation: the historically circulated Tesla RSS URL was inaccessible in this investigation, so it is not a verified working feed. SpaceX's IR pages return sparse JavaScript-rendered content to simple retrieval. [Tesla press releases](https://ir.tesla.com/press?page=0), [SpaceX investor updates](https://ir.spacex.com/updates/)

NASA publishes first-party RSS feeds useful for space coverage, though they are not a substitute for independent Tesla/SpaceX reporting. Select a small, explicit publisher feed list for general news and check each publisher's terms before full-text collection or public redistribution. [NASA RSS directory](https://www.nasa.gov/rss-feeds/)

Recommended behavior: fetch and deduplicate source items first; pass title, publisher, publication time, URL and permitted excerpts to AI. Require each generated claim to point to a fetched item. Print publisher names and short reference IDs, with links in the saved digital briefing. If nothing new is found, say so. This is a product recommendation, not a claim that the feeds authorize unrestricted reuse.

## Market instruments and current SpaceX status

SpaceX is publicly traded as of this research date. Its official IR FAQ reports a June 12, 2026 IPO and ticker **SPCX** on Nasdaq Global Select Market and Nasdaq Texas. Its SEC-filed earnings release independently identifies it as Nasdaq: SPCX and confirms trading began June 12. Do not use old assumptions that SpaceX is private, and validate the provider's instrument identity because ticker strings can be reused. [SpaceX IR FAQ](https://ir.spacex.com/faqs-and-contact/), [SpaceX earnings release filed with SEC](https://www.sec.gov/Archives/edgar/data/1181412/000162828026052515/earningsreleaseq22608042.htm)

The Dow and S&P are indices, not stock tickers. If index access is costly, DIA and SPY are possible separately labeled ETF proxies. They have dollar share prices and tracking differences; never label their prices as index point values. The exchange operator confirms DIA and SPY fund identities. [NYSE/ICE fund announcement](https://ir.theice.com/press/news-details/2026/NYSE-and-PDR-Services-LLC-Announce-Name-Change-for-Three-Exchange-Traded-Funds/default.aspx)

## Quote-provider tradeoffs

Alpha Vantage's free service offers 25 API requests/day; its default stock quote is updated at the end of the trading day. Real-time and 15-minute delayed US stock quotes require premium entitlement. It documents premium daily/weekly/monthly Dow and S&P index data. This is a plausible previous-close morning summary path, not a verified free intraday stock-button path. [Alpha Vantage support](https://www.alphavantage.co/support/), [API documentation](https://www.alphavantage.co/documentation/), [premium entitlements](https://www.alphavantage.co/premium/)

Twelve Data lists Basic at $0 with 8 credits/minute and 800/day but describes its usage as **internal non-display**; Grow lists **internal display** at $79/month billed monthly. Do not promise that a printed receipt fits the free license without clarification. Its default real-time US feed represents approximately 5% of total trading activity rather than consolidated full-market volume; paid-plan display permissions and redistribution conditions are documented separately. Exact index availability and SPCX coverage must be checked with the chosen plan. [Twelve Data personal pricing](https://twelvedata.com/pricing), [US data coverage/licensing](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data)

Quote responses expose exchange, currency, datetime, timestamp, last-quote time, previous close and change; fields have distinct semantics, so do not treat an interval-open timestamp as an exact last-trade time. Extended-hours data is plan-dependent. A button press should print **latest available as of [provider timestamp]**, identifying real-time/delayed/EOD and market state. Cache each instrument independently; a closed market should show the last valid session rather than an invented current trade. [Twelve Data quote schema](https://twelvedata.com/docs/market-data/quote)

## Decisions and validation still required

- Choose whether the first stock shortcut may use previous-close/delayed data, or whether intraday quotes justify recurring data fees. Do not silently substitute one freshness tier for another.
- Choose true Dow/S&P index values versus clearly named ETF proxies; confirm quote provider display rights and exact instrument coverage before selecting a paid plan.
- Test read-only iCloud Calendar discovery and the user's actual Reminders store/bridge before making tasks essential to the first briefing.
- Select publisher sources, company-news scope, time horizons and permitted excerpt collection. Keep example receipts synthetic when sharing the build.
- Store source/as-of timestamps and errors with each block so a failed integration cannot turn into an unsupported AI assertion.
