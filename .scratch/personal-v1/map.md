# Plan a personal morning receipt briefing

Labels: wayfinder:map
Status: open

## Destination

A build-ready personal v1 plan for a configurable morning briefing printed at home: content and source choices, a block layout editor, AI execution, scheduled printing, physical controls, and a hardware shortlist within a $200 target using an existing Raspberry Pi 4 where useful.

## Notes

- Planning first. This map produces decisions and a route to implementation; it does not authorize hardware purchases, deployments, account connections, or public publication.
- Subsequent authorization: build the local configuration-interface and receipt-preview foundation with subagents, saved settings, and sample content; attempt public weather/news integration where practical. The accepted desktop-only build direction in [decision 06](issues/06-block-layout-prototype.md) supersedes its earlier throwaway-only proposal. Other production implementation remains later work.
- Confirmed with the user: personal and work content; work information access remains TBD. A Proxmox VM, existing Pi 4, and optional desktop collector divide responsibilities as recorded in [the resolved runtime decision](issues/04-runtime-and-ai-choice.md). Private configuration access uses the LAN and the user's existing Tailscale setup.
- Hardware target: $200 for additional hardware. Reported OpenAI credits, the $20/month project usage budget, selected API route, and AI fallback policy are recorded in [the runtime decision](issues/04-runtime-and-ai-choice.md).
- Content requested: today's weather forecast and a three-day outlook; general/business/technology news, Tesla/SpaceX company news, local city/state news, and upcoming local events; stocks/market information; project updates from GitHub and local Codex desktop; iCloud Calendar and, if possible, iCloud tasks.
- First-briefing scope is accepted, with weather for ZIP 89147 in Fahrenheit. Markets use previous close before 06:30 Pacific and request current/opening data at or after that time, allowing up to 15 minutes of explicitly labeled delay. Remaining content policies are tracked in [the content contract](issues/05-briefing-content-contract.md). The cutoff does not set the print schedule.
- Missing data prints as Unavailable for the affected block/item. Initial receipts have no total length cap or automatic overflow truncation; around 50 cm is only a loose preview target. Revisit length after actual use if needed, as recorded in [the content contract](issues/05-briefing-content-contract.md).
- Printing should run on a schedule. Physical controls should support daily-brief reprint and programmable shortcuts; a small two-line OLED/menu display is a candidate. A shortcut should print a market snapshot for tracked instruments such as Tesla, SpaceX, the Dow, and the S&P, plus a daily market summary. Instrument availability and quote freshness require research.
- Requested future single messages: a button-triggered current-market snapshot with daily charts, and an immediate summary print when a new invitation arrives for an event today. Each needs web configuration and a receipt preview, using a shared foundation for more message types. Requirements and proposed behavior are tracked in [single-message planning 12](issues/12-single-message-templates-and-triggers.md); live monitoring, market charts, and delivery are not implemented.
- Calendar travel: configurable home/work origins and sample travel/leave-by rows are in the preview. Live routing, ZIP-to-city resolution and traffic behavior are pinned in [travel planning 13](issues/13-calendar-travel-times.md).
- User is flexible about editor design and prefers an easier implementation; visual block ordering with preview is a candidate, not a selected design.
- Intend to open source the project and possibly document the process on social media. Keep public examples and personal/work data boundaries explicit in the relevant decision.
- Consult wayfinder when navigating this map; grilling and domain-modeling for human decisions; research for external facts; prototype for layout exploration; OpenAI Docs for OpenAI product guidance.
- Tracker operations: [local Markdown conventions](../../docs/agents/issue-tracker.md). Open tickets are discovered from child files rather than listed on this map.

## Decisions so far

- [Investigate local news and upcoming event sources](issues/11-local-news-and-events-feasibility.md) — Spring Valley/Las Vegas Valley, Clark County, and Nevada are the starting area; official civic/community sources are candidates, with feed/adapter validation and independent local reporting still needed.
- [Define useful project updates from GitHub and Codex evidence](issues/10-project-status-evidence.md) — Select projects by a private folder-path list; print changes since the last saved briefing with supported blockers/next actions, using GitHub and optional local context up to 24 hours old.
- [Choose the runtime architecture and AI execution path](issues/04-runtime-and-ai-choice.md) — VM runs collection/generation/configuration/scheduling using OpenAI API; Pi handles printing/controls; LAN/Tailscale access and factual-only AI fallback within a $20/month project budget.
- [Investigate subscription-backed AI and Codex project context](issues/01-ai-and-codex-feasibility.md) — Supported subscription/API paths exist; account eligibility and desktop-history visibility need validation before execution is chosen.
- [Find a compatible receipt printer and physical controls within budget](issues/02-hardware-feasibility.md) — An 80mm cutter-equipped station can plausibly fit $200 with the owned Pi, conditional on included power and accessories.
- [Investigate iCloud, weather, news, and market data sources](issues/03-content-source-feasibility.md) — Calendar and weather are practical; Reminders needs validation, and market freshness/display rights determine provider fit.

## Not yet specified

- Work information beyond GitHub and local Codex project activity; its sources and useful role remain unknown.
- Further message types, blocks, shortcuts, and menu workflows beyond the two requested in [single-message planning 12](issues/12-single-message-templates-and-triggers.md), plus whether those two belong in personal v1.
- Enclosure appearance, accessibility, and how much of the build should be visible in demonstrations, beyond the initial hardware compatibility investigation.

## Out of scope

- Building and deploying the production system, purchasing hardware, and publishing the repository or social content during this planning effort.
- A commercial or multi-user hosted product. Open-source reproducibility belongs in this personal v1 plan.
