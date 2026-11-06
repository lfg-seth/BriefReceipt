# Connect calendar travel times from home and work

Type: planning
Labels: wayfinder:planning
Status: open
Assignee: none
Parent: ../map.md
Blocked by: none

## Question

Which maps/routing API should provide travel duration and leave-by time from configured home and work addresses to each calendar event?

## Comments

### Requested behavior and placeholder implementation (2026-11-05)

The user requested two compact lines below an event's location: a home icon, travel minutes and time to leave, followed by the equivalent briefcase/work row. Home/work origin addresses must be configurable in Sources and Calendar settings. This ticket pins live routing for later; no maps API is connected or authorized for paid usage by the preview work.

The preview currently saves home/work addresses locally and offers editable sample durations (initially 20 and 30 minutes). The user subsequently requested removing the Sample travel heading from the receipt; settings continue to explain that the values are placeholders. Sample leave time subtracts the chosen duration from the event start in America/Los_Angeles; all-day or missing start times show a dash. Rows appear for recognized US destination addresses, not virtual calls or arbitrary venue names. Sample durations do not depend on the origin/destination or current traffic. Browser settings exports include the saved addresses; the preview makes no geocoding/routing requests.

### Requirements for the future API integration

- Research provider coverage, geocoding, licensing, traffic/departure-time support, retention, quotas and cost against the existing project budget. Select the provider separately; keep its key server-side and out of settings exports.
- Resolve configured ZIP to a user-reviewable local city/state. Current formatting uses editable city/state, initially Las Vegas, NV for 89147. Avoid silently retaining the wrong city when ZIP changes.
- Route independently from both origins to the event's complete original destination, preserving the raw source address even when the receipt omits local city/state/ZIP/country. Resolve venue-only text when supported; detect virtual events and don't invent a driving route.
- Keep route mode, traffic assumptions, retrieval time and freshness explicit. Do not treat the daily placeholder duration as a live route. Decide arrival/parking buffer, departure-time calculation and how traffic-dependent duration should be evaluated before enabling reliable leave-by guidance.
- Handle all-day events, unknown starts, previous-day departures, DST, past events, ambiguous/unroutable addresses and multiple origins without inventing times. Missing origins or failed routes must show Unavailable independently for that row, without substituting a fictional duration.
- Address source changes, event moves, edits, cancellations and stale route invalidation. Keep originals out of logs and send only necessary location fields to the selected routing provider; AI note summarization does not need home/work addresses.

### Completion scenarios

1. Set home/work addresses in Sources; reload preserves both and Calendar settings expose the same values.
2. For a timed event with an address, both rows display independently sourced minutes and leave-by times, with live/sample provenance clear.
3. Change an origin or event destination/start and invalidate the affected routes. A route failure doesn't hide the event or the other usable row.
4. Confirm city/state/ZIP display rules and midnight/DST behavior against test fixtures, then verify with an actual selected provider without committing private origins or credentials.
