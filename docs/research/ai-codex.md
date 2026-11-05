# AI execution and Codex project context

Checked: 2026-11-05. Research for **Investigate subscription-backed AI and Codex project context**. Findings establish options; the user has not selected a provider or authorized account setup.

## The subscription can potentially cover this

Current official documentation provides three distinct routes. The user's reported price alone does not prove their plan, eligibility, activation, or remaining allowance.

| Route | What pays for inference | Fit for this project |
| --- | --- | --- |
| Responses API with a project API key | API organization balance, including eligible claimed subscription API credits | Recommended candidate for a small scheduled VM service |
| Sign in with ChatGPT in the app | Eligible user's ChatGPT plan allowance or available credits | Strong candidate for an eventual open-source/local app integration |
| Codex CLI/SDK signed in with ChatGPT | Signed-in Codex allowance | Technically usable for trusted personal jobs; more agent runtime and authentication management |

### Subscription API credits

Eligible **Pro $100 subscriptions can claim $100/month API credits**. Requirements include a paid subscription at least seven days old, ownership of the receiving API organization, and matching account email. Activation is through ChatGPT Settings → Billing or API Platform billing. Credits renew with eligibility, expire each billing cycle, and the initial grant is prorated. Responses and built-in tools are covered. **Codex usage authenticated with API keys is excluded**; these are separate from signed-in Codex limits. Requests consume free credits first, then purchased balance; with neither remaining, requests fail. Verify the actual billing benefit before budgeting it. [Official API credit benefit](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

### Sign in with ChatGPT

OpenAI now documents a supported OAuth integration for eligible Plus/Pro users to power AI features in open-source and local personal apps using their existing plan. Permission to use the plan is distinct from identity. It does **not** expose the user's ChatGPT conversation history. This replaces any need to improvise a private token-reuse scheme for the app. [Official integration walkthrough](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)

The plan-usage flow supports open-source and locally hosted apps. A registration belongs to one user/workspace; installations have distinct persistent host IDs. Paid or remotely hosted commercial apps have a separate interest/approval route. A homelab VM is explicitly documented as an agent host. [Plan-usage overview](https://developers.openai.com/siwc/token-sharing-open-source)

For a self-hosted VM, complete OAuth locally, securely transfer the selected registration's protected credentials, preserve the VM's distinct host ID, and let the VM own later refreshes. Host-specific attribution/revocation for transferred sessions remains incomplete. Initial browser login is a setup step; the docs do not require the desktop browser to remain running for VM inference. The latter is an inference from the documented VM refresh procedure. [Self-hosted VM procedure](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)

The preview route is narrower than ordinary API-key access: streaming and `store:false` are required; several fields and hosted tools are unsupported. Web search depends on model/account policy. App-server can use this flow, but the app must handle OAuth renewal and restart its child process with the replacement token. Verify model access with a successful request rather than assuming a model catalog entry is an entitlement. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [app-server token integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)

### Codex CLI and SDK jobs

`codex exec` is explicitly intended for scripts, scheduled jobs, release notes, and summaries. It reuses saved CLI authentication, can emit JSONL events or JSON-Schema-constrained final output, and defaults to a read-only sandbox. These features make a bounded summarization job feasible without a desktop UI. [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

Codex distinguishes ChatGPT subscription authentication from API-key usage billed at API rates. Headless hosts can use device-code login when enabled. Documentation recommends API keys for most automation; enterprise-specific access tokens are not a presumed benefit of a personal plan. [Authentication](https://learn.chatgpt.com/docs/auth)

OpenAI documents advanced managed-account automation on trusted private runners: keep a persistent credential store, let Codex refresh it, and serialize use of each copy. The guide explicitly excludes public/open-source repository CI from that cached-auth workflow. This restriction concerns that private-runner pattern; it does not contradict the separately documented OAuth flow for local open-source applications. Do not publish credentials or build public CI around a personal cached login. Refresh can still fail and require reseeding. [Managed authentication in CI/CD](https://learn.chatgpt.com/docs/auth/ci-cd-auth)

The SDK supports server-side application workflows: TypeScript requires Node 18+, and the Python SDK requires Python 3.10+ and controls a bundled/pinned local app-server runtime. SDK use is an integration mechanism, not an independent entitlement or source of free inference. [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)

Signed-in allowances vary with model, context, reasoning, retrieval, and tool use. Current pricing docs say Pro has no five-hour limit, but shared allowances and weekly limits can apply. Use the account's actual usage dashboard; a daily summary has no guaranteed fixed message cost. [Codex/Work usage](https://learn.chatgpt.com/docs/pricing)

## Incremental cost estimate

Illustrative API workload, **not a quote or a final model choice**: 30 briefings/month, each with 10,000 input tokens and 2,000 output tokens. Current Standard rates are $0.10/$0.50 per million input/output tokens for GPT-6 Luna and $2/$10 for GPT-6.1 Sol. Token arithmetic gives about **$0.06/month** or **$1.20/month**, respectively. Five web searches per briefing add **$1.50/month** at $10/1,000 calls, plus retrieved-content tokens. Total examples are roughly $1.56 or $2.70 before extra retrieved context, retries, reasoning overhead, and ad hoc runs. Large repository investigations cost more than summarizing collected records. A **$5/month initial application ceiling** is a reasonable recommendation to discuss, with metering and no automatic paid fallback. [Official API pricing](https://developers.openai.com/api/docs/pricing)

## Project updates from GitHub and desktop Codex

GitHub has supported REST endpoints for commits, issues, pull requests, and Actions data. A fine-grained personal token scoped to selected repositories and required read permissions is a straightforward personal integration; a GitHub App is another option. Private/organization access depends on permissions and organization approval. None of this depends on the user's desktop staying on. [REST authentication](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api), [available fine-grained-token endpoints](https://docs.github.com/en/rest/authentication/endpoints-available-for-fine-grained-personal-access-tokens)

Codex app-server exposes documented `thread/list`, `thread/read`, `thread/turns/list`, and `thread/items/list` methods. It can read stored history without resuming or generating a turn, and reports thread runtime status. These are preferable integration candidates to parsing undocumented SQLite tables or rollout JSON directly. Stdio is the conservative transport; WebSocket transport is currently marked experimental/unsupported. The exact CLI version and accessible thread store must be verified. **A new app-server on the VM is not documented as automatically synchronizing a different Windows desktop's project history.** [App-server interface](https://learn.chatgpt.com/docs/app-server)

Recommended design direction, pending the user's decision: GitHub is the always-on evidence source. An optional desktop-side collector uses documented local interfaces and exports a narrow timestamped project digest to the VM. Fresh local information requires that machine/collector to be available, but a previously exported digest can remain cached and explicitly dated. Whether the installed desktop's threads are visible through that interface needs a small later feasibility check. A thread being idle, or the model saying work is complete, is not proof of project completion: distinguish committed changes, PR/issue state, test results, and conversational claims.

## Decisions still needed

- Confirm the actual subscription and whether its API credit benefit is available/activated; no account was inspected or connected.
- Choose API-with-credits versus plan-usage OAuth versus private Codex execution; keep AI execution behind a provider interface if open-source flexibility warrants it.
- Set an application spending ceiling and behavior when credits, authentication, or allowance run out.
- Define which GitHub repositories and desktop project evidence may be included, what constitutes useful project status, and how old exported context may be.
- Validate local thread access against the installed app/CLI before promising full desktop status coverage.
