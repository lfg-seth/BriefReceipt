# Investigate local news and upcoming event sources

Type: research
Labels: wayfinder:research
Status: resolved
Assignee: codex-local-research
Parent: ../map.md
Blocked by: none

## Question

Which usable public first-party sources can supply city/state news and upcoming local events near the configured ZIP 89147? Verify the practical geographic scope without equating a ZIP with a municipal boundary. Identify a small candidate source set, supported feed/API/calendar or page retrieval paths, source dates/event times and timezone handling, collection/reuse caveats, and graceful behavior when sources cannot be fetched. Do not connect accounts, purchase access, or claim that a static page is a tested feed.

## Comments

2026-11-05: Added after the user requested local city/state news and upcoming local events alongside general/business/technology and Tesla/SpaceX coverage. Research asset: `docs/research/local-content.md`. News remains capped at five total headlines; the initial events proposal is a separate configurable block, up to three events in the next seven days.

## Answer

Resolved by public first-party page research on 2026-11-05. [Findings and source citations](../../../docs/research/local-content.md).

County sources support Spring Valley / Las Vegas Valley, Clark County, and Nevada as the initial configurable coverage area around ZIP 89147. A ZIP does not establish incorporated-city jurisdiction; City of Las Vegas sources provide neighboring metro coverage.

Candidate sources are Clark County Communications/news/calendar, City of Las Vegas news/events, Nevada Governor's newsroom, and Library District events. State-news discovery and individual county notices were readable; the Spring Valley Town Advisory Board page provides a narrow civic-event supplement with dates, venue, times, and cancellation notices. Several calendar pages exposed dynamic shells or access errors, so no dependable RSS/ICS/API or complete event-discovery integration is established.

Official releases supply civic announcements, not independent local reporting. Broader local journalism and entertainment listings still need selected publisher/organizer sources. Validate discovery, detail retrieval, dates/timezones, recurrence/cancellations, and collection/reuse terms before promising coverage. Use original attribution/links and visible empty/stale/unavailable states. This resolves source investigation, not adapter implementation or account setup.
