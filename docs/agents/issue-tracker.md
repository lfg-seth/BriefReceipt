# Local Markdown issue tracker

The personal v1 effort uses `.scratch/personal-v1/map.md` as its canonical wayfinder map. Each child decision is a separate numbered Markdown file under `.scratch/personal-v1/issues/`.

Tickets record `Type`, `Labels`, `Status`, `Assignee`, `Parent`, and `Blocked by`. Status is `open`, `claimed`, or `resolved`. An open ticket with no assignee is unclaimed. To claim a ticket, assign the driver and set its status to `claimed` before starting work.

Blocking uses local ticket numbers because this tracker has no native dependency relationships. A ticket is unblocked when every ticket in `Blocked by` is resolved. The frontier is the open, unblocked, unclaimed children, ordered by ticket number.

Ticket bodies begin with `## Question`. Append findings and progress under `## Comments`. Resolve by appending `## Answer`, setting `Status: resolved`, and adding a named link and one-line gist to the map's Decisions so far. Link research assets from the answer. A map indexes decisions; their detail lives in tickets.

While charting, research tickets may resolve in parallel. Human decisions remain open for live discussion. Future sessions read the map first and choose one frontier ticket, unless the user names another.
