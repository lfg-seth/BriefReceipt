# Choose the runtime architecture and AI execution path

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Assignee: codex
Parent: ../map.md
Blocked by: 01, 02, 03

## Question

Given the feasibility findings, how should the Proxmox VM, existing Pi 4, printer, and any desktop-side integration divide responsibilities, and which AI execution path and monthly cost ceiling should personal v1 use? Resolve credentials, private data access, always-on dependencies, and configuration ownership at the level needed to choose an implementation route.

## Comments

2026-11-05: The user reports apparently having $100/month in OpenAI credits and is comfortable spending $20/month on this project. Account credit availability has not been independently checked. The $20/month figure supersedes the research's proposed $5/month ceiling.

Working budget interpretation: cap total recurring project usage at $20/month, including credit-covered AI usage and any paid content services. Whether the user instead means $20 in additional cash spending remains open; do not treat the reported credits as an extra project allocation.

Recommended AI route, pending the user's runtime decision: OpenAI Responses API from the Proxmox VM, with a project service-account key stored server-side. Official documentation recommends Responses for new projects and a service account for deployed applications and scheduled jobs: [Responses guidance](https://developers.openai.com/api/docs/guides/migrate-to-responses), [API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys). This recommendation does not select a model, connect an account, or authorize deployment.

2026-11-05: The user accepted the proposed runtime split:

- Proxmox VM owns source collection, briefing generation, configuration/layouts, and scheduled print dispatch.
- Existing Pi 4 operates the printer, physical buttons, and optional display.
- An optional desktop collector exports timestamped local project evidence. Scheduled briefing generation does not depend on the desktop being online. Desktop evidence availability still requires validation and stale/unavailable labeling.

The Responses API remains the recommended AI execution path alongside that split. The user's confirmation specifically answered the runtime-split question; it did not select a model or authorize account connections or deployment. Keep the conservative $20/month total-usage budget interpretation unless corrected.

Remaining runtime choices for the next discussion:

- Configuration access: recommend a private web interface hosted on the VM, reachable on the home network. VM holds canonical configuration and source/API credentials; Pi holds only the credentials required for its print/control connection. Exact source/account scope belongs to decisions 05 and 10; public demonstration boundaries belong to decision 08.
- AI failure/budget behavior: recommend reserving estimated request cost before generation, bounded retries within the budget, and stopping AI calls at the application ceiling. If AI credentials, allowance, or service are unavailable, print available factual blocks with an explicit AI-unavailable notice; reprints reuse the saved briefing without a new AI request. Source-specific stale/missing promises belong to decision 05 and printer/connectivity behavior to decision 07.

Do not resolve this ticket until the AI route, configuration-access approach, and runtime fallback policy have been agreed.

## Answer

2026-11-05: The user accepted the recommended API/fallback and configuration-access policies, and confirmed an existing Tailscale setup. This resolves the outstanding choices above.

- Runtime: Proxmox VM owns source collection, briefing generation, canonical configuration/layouts, and scheduled print dispatch. Pi 4 owns the printer, physical buttons, and optional display. Desktop collection is optional and exports timestamped evidence; the daily service must run with the desktop off.
- AI: use OpenAI Responses API from the VM with a dedicated project service-account key kept server-side. The user reports apparently having $100/month in OpenAI credits; account entitlement and usable balance remain setup checks. A specific model will be selected and checked against the budget during implementation planning.
- Budget: plan for at most $20/month total recurring project usage, including credit-covered inference and any paid content services, using the stated conservative interpretation. Track estimated/reserved cost and bounded retries in the application; stop new AI requests at the application ceiling. Do not allocate the full reported credit balance to this project.
- AI fallback: when the API fails, authentication/allowance is unavailable, or the application budget is exhausted, print available factual blocks with an explicit AI-unavailable notice. Reprints reuse the saved briefing without another AI call. Exact source freshness and print/connectivity policies are deferred to decisions 05 and 07.
- Configuration: a private web editor on the VM, accessible on the LAN and through the user's existing Tailscale access. Public hosting is unnecessary for v1. VM owns source/API credentials and canonical settings; Pi receives only the credentials needed for its print/control connection. Tailscale routing and access rules have not been inspected or changed.
- Data scope: connect only the sources/accounts/projects explicitly chosen in decisions 05 and 10. Other work access remains TBD; public demonstration boundaries belong to decision 08.

Supporting research: [AI and Codex feasibility](../../../docs/research/ai-codex.md), [hardware feasibility](../../../docs/research/hardware.md), [content-source feasibility](../../../docs/research/content-sources.md). These choices complete the runtime plan; account setup, hardware purchases, deployment, and publication remain later work.
