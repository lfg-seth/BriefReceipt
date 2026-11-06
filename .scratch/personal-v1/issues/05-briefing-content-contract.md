# Define the first briefing and its source boundaries

Type: grilling
Labels: wayfinder:grilling
Status: claimed
Assignee: codex
Parent: ../map.md
Blocked by: 01, 03, 10, 11

## Question

Which requested blocks belong in the first useful morning briefing, which source/account scope and time horizon does each use, and what does each block promise when inputs are fresh, missing, stale, or unsupported? Establish deterministic data versus AI synthesis, source attribution, market instrument identities and timestamps, paper-length expectations, and how to treat the still-unknown work-data source. Use the project-update definitions from the prerequisite decision without inventing access or progress.

## Comments

2026-11-05: Project-evidence decision 10 is resolved. Selected projects are configured by private folder paths; GitHub mapping is optional and desktop context requires validation. This unblocks the first-briefing contract. Runtime/fallback behavior follows decision 04.

Proposed content defaults for discussion, not yet selected:

- Weather: today plus the following three days. Print forecast values directly; any AI advice is optional. Location and preferred units are user inputs.
- Calendar: today's events from explicitly selected iCloud calendars, preserving event times, all-day status, and the configured local timezone. Selected calendar scope is a user choice; exact account/calendar identifiers are later setup inputs.
- Tasks: due-today and overdue incomplete items from selected lists, conditional on validating a usable Reminders integration. Tasks must not block the useful v1 briefing if unsupported. Task-list scope and priority rules remain to be chosen.
- News: at most five concise sourced headlines across general news and Tesla/SpaceX company news, covering the preceding 24 hours; deduplicate repeated stories. Publisher/feed selection is still required; no live feed is selected by this proposal.
- Markets: prefer previous-close data for the morning edition, clearly timestamped and labeled with the trading session. Keep shortcut freshness separate from the morning edition. Instrument identities, true indices versus any labeled proxies, provider coverage, and display rights must be settled before committing to a feed.
- Projects: changes since the last saved briefing using decision 10; initially cap at five changed projects with a remaining-count line. No additional work-data integration is assumed.
- Length: prioritize a concise morning read; propose a configurable paper-length cap and overflow count, with an initial target around 50 cm subject to receipt-width/layout preview validation. Do not truncate timestamps, attribution, or coverage warnings to hide overflow.
- Synthesis: calendar/task/forecast/quote values are deterministic source data. AI may condense sourced news and project evidence and add a sourced daily market narrative; preserve source references in the saved digital briefing and compact attribution/as-of labels on paper. AI failure uses the factual fallback from decision 04.

Open choices include block scope, weather location/units, calendar/task list scope, market freshness and index/proxy policy, news scope/sources, paper-length/overflow priorities, and source-specific stale/missing thresholds. [Content feasibility research](../../../docs/research/content-sources.md) supplies researched options; no accounts or feeds have been tested.

### Confirmed content choices (2026-11-05)

The user accepted the proposed first-briefing block set and initial length target: weather, today's calendar, due/overdue tasks if supported, at most five news headlines, a market snapshot, and up to five changed projects. Around 50 cm is a loose initial preview target. The later confirmed paper-length policy below supersedes the proposed cap and overflow handling.

Weather configuration is ZIP **89147**, **Fahrenheit**, with today's forecast and the following three days. Resolve forecast coordinates during source setup rather than assuming an exact address from the ZIP.

The user replaced the proposed always-previous-close morning rule with a time-dependent rule:

- Before **06:30 Pacific**, show the previous completed regular trading session's close.
- At or after **06:30 Pacific**, request the current regular-session quote/opening data. At the boundary, treat the current session as requested but opening data as pending until the provider supplies it.
- Evaluate the rule at generation time using **America/Los_Angeles**, preserving daylight-saving behavior. An exact reprint retains the saved values and timestamps rather than refreshing its market block; fresh generation is distinct from reprint.
- Always print the quote's observation/as-of time, session/date, and provider-declared freshness. The user subsequently accepted intraday quotes delayed by up to 15 minutes; label delayed quotes explicitly rather than calling them real-time.

Proposed edge-case policy for confirmation: use the instrument's exchange calendar/session state for weekends, holidays, early closes, and after-hours. When regular trading is closed, show the last completed session close with a closed-market label. If an open-session quote is missing, show opening/current data unavailable and optionally a distinctly labeled previous close; never relabel that fallback as current. The official [NYSE hours/calendar](https://www.nyse.com/trade/hours-calendars) documents regular hours, holidays, and early closes; implementation must validate the relevant exchange calendar for each instrument.

The morning policy does not select a quote provider or establish intraday coverage within the $20/month budget. The market shortcut should reuse the same explicit freshness/session semantics if adopted in decision 07; its actions remain to be decided there.

2026-11-05 follow-up: The user accepted the recommendation allowing **up to 15 minutes of intraday delay**, subject to a suitable provider within the existing $20/month total project budget. This is a freshness tolerance, not a provider selection or authorization for additional spending. At/after 06:30, a delayed feed may not yet contain observations from the new session; show current/opening data pending, with any previous-close fallback separately labeled. An older cached observation or end-of-day-only feed does not become acceptable current-session data merely because delayed quotes are allowed.

Still open: true-index versus labeled-proxy policy, selected calendar/task source scope, news-source scope, and detailed stale/missing/overflow rules. Exact private account identifiers, calendar/list IDs, and project paths can be supplied through configuration during setup.

Next-round proposed defaults:

- Use actual requested Dow/S&P index values when covered by the selected provider. If unavailable, mark them unavailable rather than automatically substituting ETF prices. Any proxy would require explicit selection and labeling.
- Calendar/task scope is an explicit allowlist selected in the private editor during setup, with no automatic inclusion of every calendar or list. Keep calendar collection read-only in application behavior; tasks remain optional pending integration validation.
- News scope is general, business/technology, and Tesla/SpaceX company news, at most five deduplicated sourced headlines from the preceding 24 hours. Ask for any topic/publisher preferences or exclusions before choosing and validating feeds.
- For all blocks, distinguish a successfully empty source from unavailable collection; render compact coverage notices. Any retained source data keeps its collection/as-of timestamp and stale label, never an invented refresh time. Exact cache thresholds and overflow priorities remain to be recorded in the final contract.

### Accepted source-selection defaults and added local coverage (2026-11-05)

The user accepted actual index values with unavailable labels rather than automatic ETF substitutions, and explicit calendar/reminder-list selection in the private settings editor with read-only collection. Exact selected sources/accounts remain setup configuration.

The user accepted general/business/technology and Tesla/SpaceX news, and expanded the desired scope to **local city/state news and upcoming local events**. Local news shares the existing cap of five news headlines rather than adding five per category. No publisher exclusions or favorite event categories have been specified.

Working local-area default: center coverage on ZIP 89147 using Spring Valley / Las Vegas Valley, Clark County, and Nevada as the initial area, supported by research 11. Keep local area/state configurable and do not treat the ZIP as proof of a particular municipality. Exact street location is unnecessary for this content proposal.

Starting events defaults, editable rather than a separately confirmed preference: a distinct optional local-events block, next seven local calendar days including today, up to three upcoming events. Print event title, occurrence date/time, venue/area, and compact source attribution; distinguish all-day or time-TBD listings from timed events. Preserve source/organizer links in the digital briefing, deduplicate repeated listings, and distinguish events from personal calendar appointments. Category and distance filters can be added to settings; do not infer interests, free admission, availability, or booking status from missing fields.

Local news/events source feasibility is tracked in [research 11](11-local-news-and-events-feasibility.md). This expansion does not authorize account connections, ticket purchases, or a recurring source subscription, and remains within the accepted paper-length and project-budget targets.

Research 11 is now resolved with [local-source findings](../../../docs/research/local-content.md). County/city/state announcements and library/civic calendars are candidates; several calendar pages are dynamic or inaccessible to the research fetch, and no working machine feed is established. Keep independent local reporting distinct from government announcements. Source/adapter validation and broader publisher/organizer selection remain readiness work; do not promise complete local coverage or invent events when collection is unavailable. Event occurrence dates, timezone/all-day handling, cancellations, and organizer attribution must survive condensation and receipt overflow.

### Confirmed unavailable-data and paper-length policies (2026-11-05)

The user chose a simple unavailable-data policy: show **Unavailable** for the affected block or item when its data cannot be obtained, and continue with the rest of the briefing. A successful query with no events, tasks, or changes remains an empty result rather than a collection failure. Do not substitute cached values for unavailable data by default. Existing explicit observation/session timestamps, accepted market delay, and project-context freshness rules still define usable data; exact reprints continue to reuse the saved briefing. For missing current/opening market data, show Unavailable rather than adding the previously proposed optional previous-close fallback.

The user accepted unrestricted paper length for the initial version. Around **50 cm** may remain a loose design target, but there is **no total receipt-length cap**, automatic truncation, or overflow suppression. Print the selected content even when it exceeds that target. Revisit length controls only if actual use feels too long. Existing per-block item counts remain content defaults, separate from total receipt length.

These policies supersede earlier cap/overflow proposals and unavailable-data fallback proposals in this ticket. Local-event count/window remain editable proposed defaults; source/provider selection and validation remain setup/readiness work.

### Configuration-interface build data (2026-11-05)

Calendar window follow-up: include today and the next four full calendar days in America/Los_Angeles, matching the Reminders lookahead. Group events by Today, Tomorrow and dated weekday headings. Sort by local day before all-day/time ordering, retain recurrence overrides/exclusions/cancellations, and show overlapping multi-day occurrences once with an Ongoing marker. The configured item limit remains shared across this window, with an explicit omitted-event count and Calendar settings offering up to 20 items. This supersedes the earlier today-only calendar scope.

Calendar notes follow-up: collect the iCalendar DESCRIPTION field, labeled Notes in Apple Calendar, and show notes of up to 240 Unicode code points verbatim, preserving their text and line breaks. Longer notes should receive concise AI summaries using the [Apple-inspired research and instructions](../../../docs/research/calendar-description-summaries.md) when AI is connected. Until then, retain the complete original with a Full notes label; do not truncate or imply AI generated it. Display location and invitees with supplied response status, and include those fields as context for the future AI summary. An invitation does not establish attendance. Deterministic event title/time/location and invitees remain source data. The numeric cutoff is an implementation default. Provider integration remains the next separate task.

For the forthcoming configuration interface and receipt preview, the user explicitly requests content placeholders instead of Unavailable so every block can be evaluated visually. Use synthetic sample content with clear demo/sample provenance; keep live and sample data distinguishable. Attempt public weather/news integration where practical, with sample content available when integration cannot run. The daily production missing-data policy above remains Unavailable; preview fixtures are a separate presentation mode.

Weather deserves an expressive visual treatment with a reusable weather icon set and condition-specific atmosphere: rain should feel rainy, with comparable treatment for other conditions. Provide a way to preview conditions using sample weather. Keep the thermal receipt rendering legible in monochrome.

### Guardian headline selection (2026-11-05)

The user selected Guardian and then explicitly excluded its news from AI synthesis while requesting original-headline printing for personal accessibility use. This supersedes the earlier proposal to synthesize sourced news in the AI summary. All Headlines content is now excluded from AI requests on both client and server, including sample headlines. Other briefing blocks remain eligible.

The Guardian developer-key connection, metadata-only adapter, attributed receipt rendering and Unavailable failure behavior are implemented. General, business/technology, Tesla/SpaceX and fixed Nevada/Las Vegas keyword queries supply up to five selected headlines from the preceding 24 hours. Local coverage remains partial. Real account access awaits the user's developer key, entered in Headlines or Sources → News. [Implementation, source notes and setup](../../../docs/data-sources.md#news).
