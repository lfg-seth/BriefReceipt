# Investigate subscription-backed AI and Codex project context

Type: research
Labels: wayfinder:research
Status: resolved
Assignee: codex-ai-research
Parent: ../map.md
Blocked by: none

## Question

What supported AI execution paths can generate unattended daily briefings using the user's existing ChatGPT/Codex subscription versus separately billed API usage, and what supported interfaces can expose GitHub and local Codex project context to a Proxmox-hosted service? Establish authentication, usage limits, approximate incremental costs, desktop-online dependencies, and support boundaries using current official documentation. Separate subscription-backed Codex CLI/SDK feasibility from general API billing; do not infer account entitlements from the reported price.

## Comments

Research context: branch `research/ai-codex`, worktree `.research-worktrees/ai-codex`, planned asset `docs/research/ai-codex.md`. Claimed before investigation; root session records the resolution after reviewing findings.

## Answer

Resolved by primary-source documentation research on 2026-11-05. [Findings and source citations](../../../docs/research/ai-codex.md).

Three viable paths are documented: Responses API usage with eligible claimed subscription API credits, a supported Sign in with ChatGPT flow including self-hosted VMs, and private Codex CLI/SDK execution with saved ChatGPT authentication. The reported subscription price does not establish the user's actual entitlement; verify the benefit before depending on it. The research includes a small-workload cost model and a proposed $5/month application ceiling, not a selected budget or model.

GitHub provides an always-on evidence source. Codex app-server documents local history interfaces, but VM access does not imply synchronized desktop history. Validate any desktop collector against the installed version and expose timestamped coverage. Runtime selection and the meaning of project status remain human decisions.
