# Choose the block editor through a receipt preview prototype

Type: prototype
Labels: wayfinder:prototype
Status: claimed
Assignee: codex
Parent: ../map.md
Blocked by: 02, 05

## Question

What is the simplest block-based configuration and receipt-preview experience that meets the user's layout needs at the chosen paper width? Use a throwaway prototype to decide block ordering, per-block options, typography, and whether multiple named layouts are necessary. Preview the full receipt with flexible length: around 50 cm is a loose target, with no total length cap or automatic overflow truncation in the initial version. Render Unavailable for missing block/item data. Compare an ordered block editor with a free-positioned canvas only as far as needed for the user's reaction.

## Comments

### Accepted build direction (2026-11-05)

The user accepted the proposed defaults and requested a handoff prompt for a one-shot build by 6.1 Sol Ultra using subagents. This authorizes the local configuration-interface/receipt-preview foundation and supersedes the earlier throwaway-only proposal for this work. The build has not started in this session; claim this ticket when implementation starts.

- Build a working interface with saved configuration, realistic sample data, and live receipt preview.
- Include block ordering, enable/disable controls, per-block options, source selection, private project-folder settings, and sections for schedule/printer settings. Unsettled settings remain editable proposals rather than falsely confirmed operational decisions.
- Use reorderable blocks and adjacent block settings/preview as the starting editor design.
- Target desktop only for now. The interface remains a locally run browser UI in the planned private VM architecture; mobile adaptation is deferred.
- Start with adjustable 80 mm paper, crisp monochrome receipt typography, compact tables, and minimal receipt graphics. Around 50 cm is a loose target, with unrestricted total receipt length.
- Use placeholders for this build wherever live data is absent; attempt weather/news sources if practical. Label sample provenance and provide explicit live/sample state. This supersedes the prototype question's Unavailable rendering for the demonstration mode.
- Make weather visually expressive in the configuration UI with licensed reusable icons and condition-specific atmosphere, especially rain. Retain a printable monochrome weather treatment in the receipt.
- Keep the overall configuration workspace clean and practical. The weather section may be more visually elaborate.

Related content and production fallback rules remain in [decision 05](05-briefing-content-contract.md). Live account connections, production deployment, purchases, and publication remain later work.


2026-11-05 implementation: Claimed by Codex for the authorized persistent desktop configuration workspace and receipt preview. Shared TypeScript contracts precede parallel UI, receipt, and public-adapter work. Design choices remain implementation proposals pending user review.

### Working foundation delivered (2026-11-05)

Implemented the authorized persistent desktop application with React/TypeScript/Vite and a small local Express adapter. Three subagents owned workspace controls/settings, receipt rendering, and fixtures/public adapters/icons; the lead established shared contracts, integrated design and persistence, reviewed their work, and verified the running application personally.

- Seven ordered blocks support drag reordering, move arrows, enable switches, density, item limits where applicable, notes, and source allowlists. Separate Sources, Schedule, and Paper & printer settings include private folder-path identifiers without scanning.
- The receipt has monochrome vector icons and tables, independent paper/content widths (80/72 mm initially), font sizing, zoom, approximate physical length, and unrestricted wrapping/height. The fully populated default sample is about 99 cm with detailed provenance; the loose 50 cm reference is not enforced. Item selection and compact density can shorten it.
- Weather has rain/glass motion and clouds, warm clear light, overcast depth, storm light, and night sky treatments. A five-condition simulation selector always switches to explicitly labeled sample weather. Reduced-motion preferences disable animation. Lucide vectors and bundled fonts retain their licenses.
- Open-Meteo weather for approximate ZIP 89147 coordinates and NASA RSS headlines worked through the actual server and browser. Public requests time out and return clearly labeled populated samples on failure. NASA coverage is explicitly partial; general/business/local reporting, personal calendars/tasks, community events, market quotes and project evidence remain sample-backed. All fixtures are visibly synthetic and dated 2026-11-05. Other saved ZIPs have no live lookup yet.
- Configuration persists in browser storage with schema recovery, and can be exported as JSON. Schedule/printer preferences are saved settings only; no jobs, physical printing, account connections, filesystem collection, or production deployment were added.

Verification: 12 focused Node tests passed; a real Microsoft Edge browser check passed for drag/move order, toggles, density/notes, calendar selection, narrow-paper reflow, long untruncated content, typing widths, reload persistence, five weather conditions, reduced motion and failed-network fallback. The lead inspected the workspace at 1440 and 1180 px, the full receipt and condition screenshots, and verified the production server served the built application and adapter fallback. `npm run build` passed. Launch with `npm ci` then `npm run dev`; [README](../../../README.md) and [source/asset documentation](../../../docs/data-sources.md) describe reproducibility and limits.

Implementation is complete within the authorized build scope. This ticket remains claimed for user design review: the ordered editor, visual treatments, sample sources, schedule defaults and typography are implemented proposals, not newly user-validated decisions. Remaining production integrations and open content policies stay in their existing tickets; this build does not resolve them.

2026-11-05 future UI scope: add reusable configuration and receipt previews for individual messages, initially a market snapshot with daily charts and an automatic same-day invitation summary. Track this extension separately in [planning 12](12-single-message-templates-and-triggers.md); it should reuse paper/rendering infrastructure without making the user reconfigure the morning briefing for each message. This is future work, not part of the delivered foundation above.
