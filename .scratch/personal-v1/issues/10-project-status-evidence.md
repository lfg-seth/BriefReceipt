# Define useful project updates from GitHub and Codex evidence

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Assignee: codex
Parent: ../map.md
Blocked by: 01

## Question

What counts as a project and a useful project update in the printed briefing, and which GitHub facts and optional desktop Codex context may support it? Decide repository-to-project mapping, the update window, progress versus plans or conversational claims, useful next actions/blockers, and how old or unavailable desktop evidence is presented. Establish whether a desktop collector is worth validating before promising local project coverage.

## Comments

2026-11-05: Taking this decision next to unblock the first-briefing content contract (05). Runtime decision 04 is resolved: GitHub collection can run on the VM while optional local context comes from a desktop collector. No desktop-history visibility has been validated.

Proposed defaults for discussion, not yet selected:

- Scope: an explicit project/repository allowlist, starting with one repository per named project; support grouping repositories only when needed. Include local-only projects only after the collector validation establishes usable evidence.
- Window and presentation: changes since the last successful briefing, or the preceding 24 hours on first use; show the covered interval. For each changed project, print a short progress line and any evidenced blocker or next action. Collapse unchanged projects into a count and cap the project block length in decision 05.
- Evidence: distinguish GitHub commits/PR/issue/check activity from desktop notes and proposed next steps. Claims in conversations are not verified completion. Preserve timestamps and source references; do not invent blockers or next actions when none are supported.
- Desktop context: validate the optional collector for v1; if usable, include explicitly dated local context up to 24 hours old. Show older or unavailable desktop context as such and use available GitHub evidence without blocking the briefing. An empty successful query differs from an unavailable source.

Open preferences: initial project scope, update format/window, and whether to validate the desktop collector for v1 with the proposed freshness rule. Supporting feasibility: [AI and Codex research](../../../docs/research/ai-codex.md).

## Answer

2026-11-05: The user chose a list of folder paths for project selection and accepted the recommended update presentation and optional desktop-collector validation/freshness policy.

- Selection: maintain an explicit private list of local project folders, initially one folder per named project. Folder paths are interpreted on their owning desktop, not assumed accessible from the VM. The actual initial paths are setup inputs, not an automatic selection of every folder or repository.
- Repository mapping: associate each selected folder with its matching GitHub repository when available. Cache the established mapping on the VM so GitHub collection can continue with the desktop offline. A missing remote, non-GitHub remote, inaccessible repository, or unavailable folder must remain an explicit coverage state. Multi-repository grouping can be added when needed.
- Coverage: folder selection identifies a project; it does not authorize uploading its entire contents. Collect the scoped activity/context needed for the briefing. GitHub evidence requires selected-repository read access; local-only project coverage remains conditional on collector validation. Exact source permissions will be configured during setup.
- Window: changes since the last successfully generated and saved briefing; preceding 24 hours on first use. Show the covered interval. Failed generation does not advance the window and reprinting does not create a new window. Print delivery failures and duplicate prevention remain decision 07.
- Presentation: for each changed project, print a short progress line plus supported blockers or next actions. Collapse unchanged projects into a count; distinguish no new activity from failed/unavailable collection. Decision 05 sets the project block's size limit.
- Evidence: preserve timestamps and source references. Distinguish commits, PR/issue state, and check results from desktop notes or suggested actions. Conversational completion claims alone do not prove completion; omit unsupported blockers/actions rather than inventing them.
- Desktop context: validate the optional collector for v1 against the installed interfaces before promising coverage. If validation succeeds, include explicitly dated local context up to 24 hours old. Mark older/unavailable context and use available GitHub evidence without blocking the daily briefing. Stale local context must not be presented as fresh progress.
- Validation outcome: if local history cannot be read reliably, retain the configured project list and available GitHub updates; record the missing local coverage as a known v1 limitation. Account connections and collector implementation remain later work.

Supporting research: [AI and Codex feasibility](../../../docs/research/ai-codex.md). These are content/coverage decisions, not a claim that folder access, account access, or local history has been tested.
