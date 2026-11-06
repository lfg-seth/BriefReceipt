# Configure and preview single messages with manual and automatic triggers

Type: planning
Labels: wayfinder:planning
Status: open
Assignee: none
Parent: ../map.md
Blocked by: none

## Question

How should the web workspace configure and preview individual printable messages, starting with a market button and a same-day calendar invitation alert, while making additional message types straightforward to add?

## Comments

### Requested future features (2026-11-05)

The user requested these as future features. This ticket records the requirements; it does not mark them implemented or choose an operating schedule, provider, or hardware button layout.

- **Market button:** press a button to fetch current quotes for configured tickers and print a market message with a daily chart. Expose the action in the web workspace and plan a mapping to a programmable physical control through [decision 07](07-print-schedule-and-controls.md). The daily chart adds a requirement for intraday series data beyond the existing quote rows.
- **New invitation for today:** when a new calendar invitation arrives for an event occurring today, immediately print a concise event summary. Use explicitly selected calendars and the configured local day, initially America/Los_Angeles. This is an automatic message separate from the morning briefing.
- **Shared web configuration and previews:** each message type needs its own settings and receipt preview. Expect many more types; treat this as a reusable capability rather than two isolated screens.

### Proposed implementation direction

Keep the full morning briefing editor and add a single-message workspace. Start with two explicit message types sharing a small contract: type, enabled state, source selections/options, trigger settings, printable content, and a receipt renderer. Add future types through the same configuration/preview path; a general-purpose workflow builder is unnecessary for these first cases.

Use the existing source adapters and paper/typography controls where practical. Each message owns its content options; it should not require disabling all other blocks in the morning layout. Separate source collection, message composition, triggering, and print delivery so both the web button and physical button can invoke the same action.

Preview and printing should use the same composed message and renderer. Clearly label synthetic preview fixtures. Previewing a message must not enqueue a print. A saved message retains its source/as-of timestamps; reprinting it is distinct from requesting a fresh market snapshot. Configuration should persist, and source errors should show Unavailable under the existing content policy.

### Market message requirements

- Select tracked symbols/instruments, with the existing explicit identities for stocks and indices; no silent ETF substitutions.
- Print quote values, changes, session/date, source, observation time, and freshness alongside monochrome daily charts suitable for the configured receipt width. Start with a proposed chart per selected instrument; chart arrangement remains a preview/design choice.
- Request fresh data on activation within the existing accepted tolerance of up to 15 minutes of clearly labeled delay. Preserve pending/unavailable states when the feed cannot supply usable observations. A successful refresh cannot turn old observations into current data.
- Define the daily chart's session window, timezone, sampling, gaps, and closed-market behavior before implementation. Do not invent missing chart points or draw synthetic samples as live data. Provider coverage, intraday history, actual index data, and budget fit still need validation through [source feasibility 03](03-content-source-feasibility.md).

### Calendar invitation message requirements

- Detect a newly received invitation for today, rather than printing every event returned by a calendar refresh. Preserve event/recurrence identity and enough invitation/change metadata to support that distinction. The current today's-events adapter is an input, not an established invitation notification feed.
- Print the event title, local date/time or all-day status, location when supplied, organizer/invitee context when available, and a concise summary of useful notes. Preserve supplied attendance status; an invitation is not acceptance. Reuse the existing [calendar notes policy](05-briefing-content-contract.md) and [summary research](../../../docs/research/calendar-description-summaries.md); AI summaries remain future integration work.
- Trigger delivery as soon as a qualifying invitation is detected. Research a supported detection mechanism and make its actual latency visible; polling, if required, cannot promise zero-delay delivery. Monitoring must run independently of an open browser tab.
- Proposed duplicate policy: establish a baseline on first enable/reconnect without printing all existing appointments, then persist handled invitation identities across polls and restarts. Repeated observations of the same invitation should not enqueue additional messages. Define print acknowledgment and uncertain-delivery retry behavior with decision 07.
- Decide how to handle updates/cancellations, recurring invitations, an event moved into today, an invitation discovered after its start, disconnected catch-up, and midnight rollover. These are open behavior choices, not additional accepted automatic-print triggers.

### Observable completion scenarios for a future build

1. Choose a message type, edit its options, and see only that message rendered at the selected receipt width; reload preserves its configuration.
2. Preview both populated synthetic content and Unavailable states without causing a print.
3. Activate the market action and get one fresh message with quote timestamps and a daily chart, or explicit Unavailable content where data is missing. Exact reprint preserves the original chart/data.
4. Introduce a qualifying new invitation for today and enqueue one summary without keeping the web editor open. Repeated collection and a monitor restart do not enqueue it again.
5. Invitations outside the configured calendars or local day do not trigger this rule. Existing appointments at initial enable do not print under the proposed baseline policy.
6. A third message type can reuse settings persistence, preview, trigger invocation, and delivery without duplicating those systems.

Dependencies for delivery: production monitoring/runtime from [04](04-runtime-and-ai-choice.md), live quote/chart source validation from [03](03-content-source-feasibility.md), and printer/queue/button semantics from [07](07-print-schedule-and-controls.md). Those do not block further design or a clearly labeled sample preview; actual live collection and printing remain separate implementation work. Whether either message belongs in personal v1 is still a readiness decision.
