# Define schedules, button actions, and print failure behavior

Type: grilling
Labels: wayfinder:grilling
Status: open
Assignee: none
Parent: ../map.md
Blocked by: 02, 04, 06

## Question

How should scheduled printing, daily-brief reprint, fresh generation, the market snapshot shortcut, and programmable actions behave through buttons and the candidate display/menu? Decide print times/timezone, missed schedules, market freshness, exact reprint versus regeneration, connectivity or printer failures, duplicate prevention, and the minimum useful menu/control set.

## Comments

2026-11-05: Carry forward the user's morning-market requirement from decision 05: generation before 06:30 America/Los_Angeles uses previous close; at/after 06:30 requests current/opening data with explicit as-of/freshness labels. The user accepts up to 15 minutes of intraday delay, clearly labeled; opening data may still be pending just after the cutoff. Exact reprint reuses the saved briefing. Shortcut behavior, exchange-closed fallback, and the actual scheduled print time remain to be settled; 06:30 is a market-data cutoff, not a selected print schedule.

2026-11-05 future-feature request: the market button should fetch current tracked quotes and print a daily chart. A second trigger should immediately print an event summary when a new invitation arrives for today. Both require shared single-message web settings and previews, with more types expected; see [planning 12](12-single-message-templates-and-triggers.md). Extend this decision to cover manual versus automatic invocation, persisted duplicate prevention, queued/failed/uncertain delivery, and physical-button mapping. Invitation detection latency and catch-up behavior remain design work; the request does not establish that a push feed or printer worker already exists.
