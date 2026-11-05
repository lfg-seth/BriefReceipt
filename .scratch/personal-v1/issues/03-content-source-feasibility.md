# Investigate iCloud, weather, news, and market data sources

Type: research
Labels: wayfinder:research
Status: resolved
Assignee: codex-content-research
Parent: ../map.md
Blocked by: none

## Question

Which practical source integrations can supply today's weather plus a three-day outlook, iCloud Calendar and tasks, general and Tesla/SpaceX company news, and market snapshots/daily summaries for Tesla, SpaceX, the Dow, and the S&P? Verify current SpaceX public-trading/ticker availability rather than assuming it. Distinguish direct indices, proxies, private-company news, real-time and delayed quotes, as-of timestamps, market hours, licensing, authentication, recurring costs, and iCloud Calendar versus modern Reminders compatibility. Recommend feasible paths and identify unsupported or uncertain integrations from primary sources; do not connect accounts.

## Comments

Research context: branch `research/content-sources`, worktree `.research-worktrees/content-sources`, planned asset `docs/research/content-sources.md`. Claimed before investigation; root session records the resolution after reviewing findings.

## Answer

Resolved by primary-source integration and licensing research on 2026-11-05. [Feasibility matrix, caveats, and source citations](../../../docs/research/content-sources.md).

Weather and iCloud Calendar have practical integration paths. Modern iCloud Reminders must be validated separately: an unofficial Linux adapter or an Apple-device export are candidates, with different authentication and reliability costs. Company announcements and selected publisher feeds can ground AI news summaries; specific working feeds remain to be selected.

Current official SpaceX/SEC sources establish the SPCX instrument. The stock shortcut must distinguish actual index values from ETF proxies and identify quote freshness and as-of times. Free end-of-day data and intraday data have different entitlements; printed-display rights and exact instrument coverage must be confirmed before selecting a provider. No account integration or quote feed was tested, and no recurring data plan was chosen.
