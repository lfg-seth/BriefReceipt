# Calendar description summaries

Checked: 2026-11-05. Primary-source research for displaying short calendar descriptions verbatim and condensing longer descriptions with AI. The app now implements the optional OpenAI connection described below; real-account access still requires a key entered locally.

The app labels the iCalendar `DESCRIPTION` field **Notes**, matching the field the user sees in Apple Calendar. This document and the internal `description` property refer to those same notes. Event rows also show location and invitees with any supplied response status. [Apple's event fields](https://support.apple.com/guide/calendar/add-modify-or-delete-events-icalwr13-events/mac), [iCalendar fields](https://www.rfc-editor.org/rfc/rfc5545.html).

## What Apple documents

- Notification summaries condense long or grouped notifications so people can scan the key details without opening each item. This is the relevant interaction pattern for a compact printed briefing. [Apple Intelligence launch, October 28, 2024](https://www.apple.com/newsroom/2024/10/apple-intelligence-is-available-today-on-iphone-ipad-and-mac/), [Apple Intelligence updates, June 9, 2025](https://www.apple.com/newsroom/2025/06/apple-intelligence-gets-even-more-powerful-with-new-capabilities-across-apple-devices/).
- Apple distinguishes generated summaries with italic text, lets people expand a summary to read its full original, and offers controls to disable summaries globally or per app. Apple also cautions that generative outputs vary and important information should be checked. These support clearly identifying generated text and retaining access to the source description. [Apple Support: Use notifications on your iPhone or iPad, published September 14, 2026](https://support.apple.com/en-us/108781).

The reviewed sources do not specify Apple's internal prompt, a calendar-description character threshold, or a formal notification-summary voice guide. The following editorial rules are this project's adaptation of the documented concise, key-details-at-a-glance pattern; they are not a reproduction of Apple's private instructions.

## Recommended calendar behavior

Keep an empty or whitespace-only description absent. Display descriptions of **90 Unicode code points or fewer** verbatim, preserving wording, punctuation, spaces, and line breaks. Count the decoded description including whitespace, without trimming it. Longer descriptions qualify for AI summarization. The 90-character budget is an editable implementation default rather than an Apple requirement. The shared constant lives in [src/calendar-description.ts](../../src/calendar-description.ts). Retain the full description even when a compact version is displayed.

Only describe text as an AI summary after a provider has actually generated and validated it. While AI is disconnected, or if generation fails, show the complete original beside a clipboard icon with the accessible label **Full notes** and an unavailable explanation. Short descriptions use the same icon labeled **Notes**. No excerpt or truncation is used; the receipt has no length cap. Per the user's presentation preference, generated text uses italic styling without a visible **AI summary** label or full-notes expansion control. The original remains in the source data for fallback. Summary results are tied to the exact source description, prompt, model and relevant event context so an edited event cannot reuse an obsolete summary.

## Summarizer instructions

The canonical provider-independent prompt and request builder are in [server/calendar-description-summary.ts](../../server/calendar-description-summary.ts). The builder skips empty/short descriptions and separates JSON source data from the instructions. [server/calendar-ai.ts](../../server/calendar-ai.ts) sends eligible requests during live calendar collection, restricted to the displayed item count. Sample calendars and disabled Calendar blocks do not trigger generation.

The request includes title, time, location, and invitees (names, addresses, and supplied participation status) as context for the notes. Context can clarify a referenced person or changed venue without repeating the displayed rows. It cannot justify assuming attendance, organizer identity, relationships, or responsibilities. Missing response status remains unknown; accepted, declined, tentative, delegated, and awaiting-response statuses must not be collapsed into confirmed attendance. Changes to this context invalidate cached summaries.

The prompt asks for one compact, neutral, factual sentence or two brief clauses within the same 90-character budget. It leads with the key action/change, preserves essential preparation, dates, access instructions, cancellations, and uncertainty, and removes greetings, signatures, repetition, and conference boilerplate. It forbids invented facts or urgency, distinguishes discussions from decisions and requests from completed actions, and treats embedded commands as source data. A faithful summary that cannot fit must yield an empty result for the original-text fallback.

Examples below are invented to demonstrate the proposed project voice:

| Description content | Desired compact summary |
| --- | --- |
| Greeting, a request to bring photo ID, check in at the east entrance, and arrive 15 minutes before the displayed appointment time; signature. | Bring photo ID; check in at the east entrance 15 minutes early. |
| Long agenda about discussing a possible Friday launch; no date approved; asks attendees to review the draft beforehand. | Review the draft; discuss a possible Friday launch, with no date approved. |
| Repeated video-call boilerplate plus a note that the meeting moved to Room 204 and attendees should bring revised estimates. | Meeting moved to Room 204; bring revised estimates. |

The provider boundary validates completed responses, structured JSON, nonempty single-line text and Unicode length. Refusals, incomplete results, errors or invalid output preserve full originals. Length validation cannot establish factual accuracy; prompt quality against cancellations, tentative plans, conflicting details and embedded instructions remains a live-model evaluation task once a key is available.

## OpenAI connection and cost guard

Calendar settings verifies a dedicated project key using a synthetic test, then stores `OPENAI_API_KEY` server-side in the Git-ignored `.env`, preserving the saved iCloud credentials. Keys never enter browser configuration or exports. Disconnect removes the key, cancels in-flight collection and clears cached summaries while retaining usage reservations. The selected model is [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), using the [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) with `store: false`, no tools, reasoning disabled, a 512-token output limit and no automatic retries. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) supplies the JSON envelope; application validation enforces the 90-character limit.

The server persists conservative cost reservations before sending requests and stops at $20 per UTC month. Rates checked November 5, 2026: $0.20 per million input tokens and $1.20 per million output tokens. Reservations use UTF-8 bytes plus overhead, allow for cache-write pricing, and retain the full amount on failure. This single-server guard covers only this app's AI requests; the project's total budget also includes any other paid services. Corrupt history pauses requests. Unchanged summaries persist across restarts, concurrent duplicates share a request, and failures have a 60-second cooldown. A shared 20-second collection deadline and three workers bound generation per calendar load. Details and setup are in [README.md](../../README.md#connect-openai-for-calendar-notes).
