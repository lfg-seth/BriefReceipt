# Plan a personal morning receipt briefing

Labels: wayfinder:map
Status: open

## Destination

A build-ready personal v1 plan for a configurable morning briefing printed at home: content and source choices, a block layout editor, AI execution, scheduled printing, physical controls, and a hardware shortlist within a $200 target using an existing Raspberry Pi 4 where useful.

## Notes

- Planning first. This map produces decisions and a route to implementation; it does not authorize hardware purchases, deployments, account connections, or public publication.
- Confirmed with the user: personal and work content; work information access remains TBD. A dedicated Proxmox VM is available and external hosting is acceptable. An existing Pi 4 is available at the printer.
- Hardware target: $200 for additional hardware. AI/service budget is undecided. The user reports an existing $100/month ChatGPT/Codex subscription and wants to know what it can cover.
- Content requested: today's weather forecast and a three-day outlook; news including Tesla and SpaceX company news; stocks/market information; project updates from GitHub and local Codex desktop; iCloud Calendar and, if possible, iCloud tasks.
- Printing should run on a schedule. Physical controls should support daily-brief reprint and programmable shortcuts; a small two-line OLED/menu display is a candidate. A shortcut should print a market snapshot for tracked instruments such as Tesla, SpaceX, the Dow, and the S&P, plus a daily market summary. Instrument availability and quote freshness require research.
- User is flexible about editor design and prefers an easier implementation; visual block ordering with preview is a candidate, not a selected design.
- Intend to open source the project and possibly document the process on social media. Keep public examples and personal/work data boundaries explicit in the relevant decision.
- Consult wayfinder when navigating this map; grilling and domain-modeling for human decisions; research for external facts; prototype for layout exploration; OpenAI Docs for OpenAI product guidance.
- Tracker operations: [local Markdown conventions](../../docs/agents/issue-tracker.md). Open tickets are discovered from child files rather than listed on this map.

## Decisions so far

<!-- Research findings and resolved decisions are indexed here by ticket name. -->

## Not yet specified

- The useful meaning of a project update across GitHub and desktop activity, including which evidence can support it and how to handle unavailable work context.
- Additional briefing types, blocks, shortcuts, and menu workflows as the daily routine becomes clearer.
- Enclosure appearance, accessibility, and how much of the build should be visible in demonstrations, beyond the initial hardware compatibility investigation.
- The final implementation sequence and acceptance scenarios after the component decisions settle.

## Out of scope

- Building and deploying the production system, purchasing hardware, and publishing the repository or social content during this planning effort.
- A commercial or multi-user hosted product. Open-source reproducibility belongs in this personal v1 plan.
