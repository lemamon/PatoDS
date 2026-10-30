# design-sync

## DECISION
Build a private, tool-agnostic ports-and-adapters sync engine as a monorepo tooling package, `@<prefixo>/design-sync`. It is `private: true` and never published. It is TypeScript on the Node LTS line fixed by ENG-08, with ZERO runtime dependencies: only the Node built-ins fetch, crypto, fs and util.parseArgs.

Parts:
(1) Deterministic pure core:
- desired-state model read from a canonical sync manifest emitted by the tokens build;
- axis topology;
- diff/plan;
- canonical-JSON sync log;
- divergence fingerprints;
- ownership and deletion policy.
(2) Three ports, `DesignToolPort`, `TrackerPort` and `AlertPort`, with no repo-write operation.
(3) An `InMemoryDesignTool` fake with fault injection, plus a shared port contract suite.
(4) GitHub adapters for tracker and alert, using the ephemeral GITHUB_TOKEN, issue fields 'Owner' and 'Target date', and the sync-owner team taken from CODEOWNERS.
(5) Brand x mode is represented canonically as two orthogonal axes: the DTCG Resolver Module 2025.10 modifiers `brand` and `mode`. Each maps to its own collection or theme group in any tool.
(6) Triggers:
- a job downstream of promotion to the main dist-tag;
- a weekly cron;
- a workflow_dispatch gated by a protected environment (manual run until ENG-26 exists).
All three share one concurrency group.

The real tool adapter is written only after the requester chooses the tool. If Figma is chosen, its REST adapter uses `@figma/rest-api-spec` 0.4x (MIT, official) as a types-only devDependency, pinned in the lockfile under the repo's minimum-release-age rule.

## RATIONALE
WHY PORTS AND ADAPTERS NOW
The tool is an open requester decision (Assumptions: "Design tool and sync direction", due before Phase 1). Most of FR-025..FR-030 does not depend on the tool: diffing, logging, restoring manual edits, trackable items with owner and deadline, alerts, determinism. Building that part now against an in-memory fake satisfies QA-02 (unit tests for build/CI logic) without credentials. The tool decision then changes only one adapter, and the tool's constraints feed back into the plan, as the spec's Assumptions require.

PORT (operations the core needs from any tool)
- `capabilities()`: maxModesPerAxis; axisScope ('frame' | 'file'); aliases; hiddenVariables; codeSyntax; maxAtomicBatchBytes; write ('api' | 'manual'); publish ('api' | 'manual' | 'none').
- `checkAccess()`: auth, scopes, plan or seat, and credential expiry when the tool exposes it.
- `readSnapshot()`: normalized state. Axes and modes; variables with path segments, type, per-mode literal or alias-by-path, description, codeSyntax, hidden flag, scopes, and an opaque native ref. Local and published state are kept apart when the tool distinguishes them.
- `apply(plan, {dryRun})`: ordered, idempotent operations (collections, then modes, then variables, then values, then deletes), chunked to the adapter's atomic batch size.
- `requestPublish(release)`: returns 'published' or {manual: instructions}.

There is deliberately no operation that reads from the tool into the repo. This structurally guarantees FR-025 and US6 scenario 6. An ENG-01 layer rule plus an architecture test forbid design-sync from writing into the tokens source.

TrackerPort: `upsert(item{fingerprint, title, body, owner: RoleRef, due, labels})`, `resolve(fingerprint, note)`, `listOpen()`.
AlertPort: `raise({severity, runUrl, error, owner})`.

TOOL-INDEPENDENT CORE
(a) Model. A DesignModel is built from a deterministic `sync-manifest.json` emitted by the tokens build. It holds:
- path segments, layer, type and description;
- the CSS var name `--<prefixo>-*`;
- the literal or alias for each (brand, mode).
Built from the published tag, it is byte-identical by TOK-05.

(b) Topology. Tokens are classified by how they vary:
- brand- and mode-invariant: `primitives` axis-less group;
- varying only by brand: `brand` axis, with modes = brands;
- varying only by mode: `mode` axis, with modes light/dark;
- component tokens: their own group.
This maps 1:1 to:
- Figma: one collection per axis, with independent per-frame mode pickers (Modes help article);
- Penpot: theme groups `brand` and `mode`, each with one active theme;
- Tokens Studio: theme group to collection, theme to mode.
Names keep identical segments. Figma uses '/' because its names cannot contain '.' or '{}'; Penpot uses '.'. This satisfies DSN-04 with no helper variables, provided the token source keeps brand variance in a brand-keyed primitive layer with identical keys per brand, which matches the resolver's recommended orthogonal modifiers. Tokens that vary on both axes fall back to hidden helper aliases in a reserved namespace. Each fallback is listed in the log and the DSN-04 report as a declared exception.

(c) Diff and plan. All sorting uses code points (never localeCompare) and canonical JSON, and runs include a SHA-256 of the snapshot.
- Rename detection: the variable's codeSyntax/description carries the token key, so a hand-renamed variable is renamed back instead of deleted and recreated. This preserves designers' layer bindings.
- Type changes are flagged as recreate. Figma's resolvedType is immutable, so this is breaking and must appear in the log.
- Deletes come last and apply only inside managed collections. Extra variables there count as manual edits and are removed and logged (DSN-03).

(d) Drift classification. Comparing actual state with desired(previous version) and desired(this version) separates 'release change' from 'manual edit restored' (FR-027).

(e) Apply, verify, log.
- Apply retries on 429, honoring Retry-After.
- Verify re-reads the tool; the diff must be empty or the run fails. An interrupted multi-chunk run converges on the next run.
- The log is canonical JSON plus Markdown: version, changelog link (GOV-03), changes sorted by token path, manual edits restored, declared exceptions, and source and snapshot digests. Timestamps and run URL live in a separate envelope, so log content is byte-identical for the same inputs.
- The log is attached as a release asset (retained evidence for ACE-02/FR-031) and as a workflow artifact.

(f) Detection (FR-030). Weekly cron plus after each sync. Each divergence gets a fingerprint = sha256(kind | path | mode | tool) and is deduplicated: opened or updated as a tracked item with owner = the sync-owner role read from CODEOWNERS (DSN-02) and Target date = detection + SLA (SLA lives in a versioned config). Items close automatically when the next sync or detect run sees zero diff.

(g) Failure alerts. GitHub notifies the workflow actor (for cron, whoever last edited it), not a role. So AlertPort opens or updates a `design-sync:failure` issue that @mentions the CODEOWNERS team and sets the Owner field. The job also fails (red check).

(h) Manual publish step. If `requestPublish` returns manual (Figma has no library-publish API), the core opens a 'publish library vX.Y.Z' item for the sync owner with a deadline and a ready-to-paste publish description (version plus changelog excerpt). The next detect run closes it once the published variables match.

FAKE AND TESTS
`InMemoryDesignTool` implements the port with:
- configurable capabilities (mode caps 10/20/40, file vs frame axis scope, atomic vs chunked);
- fault injection: fail after N operations, 429 with Retry-After, 403, expired credential;
- helpers `simulateManualEdit`, `simulateRename`, `simulateExtraVariable`, `simulatePartialApply`.
Plus `InMemoryTracker`, `InMemoryAlert` and a FakeClock. Synthetic brands A/B only (QA-15).
`describeDesignToolPortContract(factory)` runs against the fake on every PR. The same suite runs against the real adapter on a sandbox file nightly and on demand (protected branch only), so the fake cannot silently drift from the real API. A determinism test runs the core twice and asserts byte equality.

CI AND CREDENTIALS (ENG-13/14/18)
- Jobs never run on pull_request or pull_request_target with secrets. On fork PRs only GITHUB_TOKEN is passed, and it is read-only.
- Tracker and alert use the ephemeral GITHUB_TOKEN with job-level `permissions: issues: write` (and `contents: write` only in the job that attaches the release asset). There is no fixed GitHub secret.
- No candidate tool offers OIDC/federation:
  - Figma: PAT (max 90 days, user-bound), OAuth app, or plan access token.
  - Penpot: access tokens with expiry Never/30/60/90/180 days.
  So the tool credential is a fixed secret with the ENG-13 justification ('provider offers no federated credential'), an owner (sync-owner role), a scope and a rotation deadline.
- Separate environments `design-sync-write` (sync) and `design-sync-read` (detect), with deployment-branch policy limited to the default branch and release tags.
- Read and write credentials are split where the tool allows it. On Figma, a plan access token (GA 2026-07-23, max 1 year, not user-bound) cannot call file_variables:write but is not excluded from read endpoints, so it is the read candidate (a spike must confirm). Writes need a Full-seat Enterprise PAT or OAuth token.
- If the requester has a cloud secret manager, the runner can fetch the tool secret through GitHub OIDC. Access to the vault is then federated, though the tool credential itself stays fixed.
- Third-party actions are pinned by SHA.
- The package has zero runtime dependencies, which removes ENG-07/21/24 exposure. The only addition is the MIT types package in the eventual Figma adapter.

PER-TOOL CONSTRAINTS RECORDED FOR THE REQUESTER (the tool is not picked here)

Figma:
- Variables REST: GET and POST are Enterprise-only. POST needs a Full seat or admin with edit access and scope file_variables:write.
- POST is atomic per request, 4 MB body cap, max 40 modes per collection, 5000 variables per collection, mode names up to 40 characters.
- Remote (library) variables cannot be written; only the library file itself.
- Rate tiers since 2025-11-17, Dev/Full seats: GET Tier 2 at 25/50/100 per minute, POST Tier 3 at 50/100/150 per minute. A sync takes about 2 GETs plus a few POSTs.
- After a REST update, variables must be published before other files see them. There is no publish endpoint, so publishing is manual.
- Mode caps: Professional 10, Organization 20; no modes on Starter.
- Extended collections: Enterprise-only, cannot add variables or modes. Community reports say brand and mode become one coupled choice and accepting library updates resets modes. They are therefore not the default topology for DSN-05; the two-collection axis topology is.
- On Pro/Org, writing is possible only through a plugin run by a person. That is not 'automatic' for DSN-01.
- Figma's own variables-github-action-example is MIT but is example code, Figma-only and bidirectional. Reference only.

Penpot:
- MPL-2.0, self-hostable. Native DTCG tokens with multi-file import/export ($themes/$metadata). Import replaces all tokens.
- Themes are multidimensional: groups such as Brand and Mode each have one active theme.
- Theme activation is file-wide. Per-board scoping is 'not prioritized' as of July 2026, so DSN-05 at frame level cannot be met today.
- Tokens are in the Plugins API since 2.14 (PR #7756, Feb 2026). The official MCP needs an open browser tab with the plugin.
- The RPC API has no documented token endpoints. Headless CI writes would need a scripted browser driving the plugin, or undocumented RPC.

Tokens Studio (Figma plugin):
- MIT plugin code, but themes and Git sync are paid (Team plan, €39 per editor per month).
- Theme group maps to collection and theme to mode, so brand x mode works as two groups.
- Export is a manual button in the plugin. Modes beyond the plan cap are silently skipped. The plugin can push to Git, so it would have to be locked read-only to respect DSN-01.

Because of these constraints, the core encodes 'write: manual' and 'publish: manual' as first-class capability outcomes that create tracked items, rather than failing silently.

## ALTERNATIVES
- Tokens Studio for Figma plugin as the sync mechanism (Git provider sync plus 'Export to Figma' from themes): Not automatic: a person clicks export inside the plugin, so DSN-01 'on each published version, automatically' is not met. The plugin can push to Git, so the premise of no import routine would need policing. Themes and Git sync are paid (Team plan). Modes beyond the plan cap are silently skipped, which hides DSN-05 limits. It also adds a second token format ($themes, Tokens Studio JSON) to keep in step. It stays usable as a manual fallback fed by files the core generates.
- Hard-code a Figma-only script, e.g. a fork of figma/variables-github-action-example: The tool has not been chosen, and coding to Figma now presumes the requester's decision. The example ships a Figma-to-tokens workflow, which is forbidden under the current premise. It never deletes removed variables, so DSN-03 restoration is incomplete. It matches by name only and cannot detect renames, and it needs Enterprise. Useful only as reference for the eventual Figma adapter.
- SaaS token-management platform as intermediary (token manager with Figma/Penpot sync): Adds a hosted intermediate store, which is close to a fourth source of token facts (Principle I) and often uses a proprietary format (ADR-02 rejects proprietary token formats). It also adds another vendor credential and licence cost, and still depends on the same tool APIs and plan limits for the final write.
- Figma extended collections as the brand x mode topology (parent collection light/dark, one extension per brand): Enterprise-only. Extensions cannot add variables or modes. Community reports describe brand and mode as one coupled picker (picking a brand forces a mode), which conflicts with DSN-05 'switch only the brand or only the mode'. Accepting library updates removes previously set modes. Kept as a capability-gated option to re-test in a spike, not as the default.
- Single collection whose modes are brand x mode combinations (A-light, A-dark, B-light...): Not two independent axes, so DSN-05 fails. Mode count is brands x 2, which hits the plan caps (10/20/40) twice as fast.
- Manual native DTCG import into the tool by the sync owner on each release: Manual, with no guaranteed restoration or verification, and no reliable log of what changed. Native Figma DTCG import is documented, but rollout of export was still being reported in late 2025. Kept only as a fallback path, using files the core generates, when a tool has no write API.
- Bidirectional sync, or the tool as source: Contradicts the current premise: the repo is the source and no routine imports variables (DSN-01, FR-025, constitution II). Changing that needs a change request.
- Off-the-shelf HTTP and GitHub client libraries (Octokit, axios, retry libraries) in the core: Native fetch plus small typed wrappers cover the few endpoints needed. Each extra dependency adds ENG-07/ENG-21/ENG-24/ENG-25 surface for no functional gain. @octokit/rest 22 (MIT) remains an acceptable fallback for the GitHub adapter if pagination needs grow.

## REQUIREMENT FIT
- DSN-01 / FR-025: A versioned workflow job runs after promotion to the main dist-tag, plus workflow_dispatch while ENG-26 is missing. It syncs desired state from the tag's deterministic manifest and attaches a per-version log listing changed variables, with a changelog link, as a release asset. The port has no tool-to-repo operation, and an architecture/ENG-01 rule forbids writes to the tokens source, which is how US6 scenario 6 is proven. Where the tool cannot write or publish by API (Figma Pro/Org; library publish on any Figma plan), capabilities return 'manual' and the core opens a tracked item.
- DSN-02 / FR-026: The sync-owner role is a team entry in CODEOWNERS, and the core reads it as RoleRef. Every failure (non-zero exit, verify mismatch, 4xx/5xx, expired credential from checkAccess) calls AlertPort. The GitHub adapter opens or updates a 'design-sync:failure' issue that @mentions the team and sets the Owner field, and the check also fails.
- DSN-03 / FR-027: Full desired-state reconciliation inside managed collections. Value, alias, rename, description and extra-variable drift is restored, and each restoration is logged as 'manual edit restored', told apart from release changes by comparing against desired(previous version). Proven by a contract test with simulateManualEdit on the fake, and by a deliberate edit in the sandbox file whose evidence is kept in the log.
- DSN-04 / FR-028: Path segments map 1:1 to tool names ('/' in Figma, '.' in Penpot). The detect report counts name and hierarchy diffs and must show zero after each sync. Helper variables exist only in the declared fallback and are listed as exceptions. Rename detection works through the token key stored in codeSyntax/description.
- DSN-05 / FR-029: Canonical orthogonal axes `brand` and `mode` become separate collections or theme groups, so either can be switched alone. Figma gives independent per-frame pickers per collection; Penpot switches theme groups file-wide only, which is a recorded limitation. capabilities.maxModesPerAxis is checked against the brand count, and plan caps (Figma Pro 10, Org 20, REST max 40) plus the adopted topology go into the ADR and the run report.
- DSN-11 (tokens) / FR-030: Weekly cron plus a detect run after every sync. Comparing build tokens with tool variables, local and published, yields fingerprinted, deduplicated tracked items with owner = sync-owner role and Target date = detection + SLA, closed automatically on convergence. Cron runs only on the default branch and can be delayed, so the post-release run also covers 'on each published version'.
- ENG-13: Tracker and alert use only the ephemeral GITHUB_TOKEN. The tool credential is listed in the inventory as fixed, with the justification that no candidate tool offers OIDC/federation, plus owner, scope and rotation (Figma PAT at most 90 days, plan token at most 1 year, Penpot token at most 180 days or never). Read and write credentials are split; a vault reached through GitHub OIDC is optional.
- ENG-14: Tool secrets live only in environments `design-sync-read` and `design-sync-write`, limited to the default branch and release tags. No pull_request or pull_request_target trigger touches them, and fork PRs receive no secrets. Secret scanning stays on.
- ENG-01 / ADR-09 / XI: design-sync is a tooling layer added to the layer file. It consumes the tokens build manifest as an artifact or devDependency, adapters depend only on core, and nothing published depends on it. A deliberate forbidden edge fails CI.
- ENG-07 / ENG-16 / ENG-21 / ENG-24 / ENG-25: Zero runtime dependencies (Node built-ins). The only planned addition is the MIT types-only @figma/rest-api-spec (no install scripts), and only if Figma is chosen. Frozen lockfile and owner approval apply.
- ENG-18: All actions in design-sync workflows are pinned by SHA.
- QA-02 / QA-15: The core is pure and unit-tested against the in-memory fake, with fault injection for partial applies, 429, 403 and expiry. The shared contract suite also runs against the real adapter on a sandbox file. Tests use synthetic brands A/B only.
- TOK-05 / Principle I: Code-point sorting, canonical JSON, injected clock and an envelope split make plan and log content byte-identical for the same inputs, asserted by a double-run test. Tool variables and logs are derived artifacts, never sources.
- FR-031 / ACE-02: Each DSN ID maps to a CI check (contract tests, detect job) or retained evidence (release-asset logs, sandbox manual-edit proof) in the traceability matrix.
- GOV-07: The architecture and the topology/plan-limit record are written in an ADR before implementation. The tool-specific adapter choice is added to that ADR, or a new one, after the requester decides.
- Edge case: interrupted sync: Apply is idempotent and planned from a fresh snapshot. Figma POST is atomic per request but chunked at 4 MB, so verify fails and alerts on a partial result, and the next run converges and logs the repaired items.

## RISKS
- Figma REST write is Enterprise-only and needs a Full seat with edit access. Plan access tokens cannot use file_variables:write. A write-capable credential is therefore a user-bound PAT (max 90 days, mandatory rotation) or an OAuth app token (publishing flow required since Nov 2025). This brings bus-factor and rotation burden; mitigation is a dedicated service seat if the requester provides one.
- Figma has no library-publish API. 'Automatic' sync stops at the library file, and consumers see changes only after a manual publish, tracked as an item with a deadline. Accepting library updates with extended collections resets modes on designs.
- Figma extended collections may couple brand and mode into one picker (community reports, Dec 2025 to Jan 2026, no staff answer). The default two-collection topology avoids this, but a spike on the target plan must confirm independent per-frame pickers when brand-axis variables are hidden from publishing.
- Mode caps limit the brand axis: Figma Professional 10, Organization 20, REST max 40 per collection, no modes on Starter. Tokens Studio silently skips modes over the cap. The brand count is still an open requester decision.
- Penpot: theme activation is file-wide (no per-board scope as of July 2026), so DSN-05 at frame level is not met. There is no documented headless token-write API: tokens are in the Plugins API since 2.14, the MCP needs an open browser tab, and the RPC is undocumented. Automation would rely on a scripted browser or unstable internals.
- If the token source does not keep brand variance in a brand-keyed primitive layer (orthogonal resolver modifiers), helper variables appear. That creates declared DSN-04 exceptions and more variables, so it needs coordinating with the token-source structure decision.
- Deleting or recreating variables (token removal, or a type change since Figma resolvedType is immutable) breaks designers' layer bindings. Mitigations: rename-by-key, recreate flags in the log, and removals only in SemVer-major releases (GOV-01).
- The 4 MB per-request cap forces chunking, so atomicity is per chunk only. Mitigated by verify-after-apply, alerting and idempotent convergence.
- The fake can drift from real tool behavior. Mitigated by running the same contract suite against a sandbox file nightly, which itself needs a sandbox file and credential.
- GitHub schedule runs can be delayed and run only on the default branch (they are also disabled after 60 days of inactivity in public repos). The post-release detect run covers per-version detection.
- Tool APIs evolve (for example, Figma VariableComposedColor added 2026-09-17; rate-limit model changed 2025-11-17). The adapter needs version pinning of @figma/rest-api-spec and the contract suite to catch breakage.
- Not yet verified: whether a Figma plan access token can call GET local/published variables (file_variables:read). It is not on the exclusion list, but a spike must confirm before relying on it for the read-only detect credential.

## OPEN QUESTIONS
- Which design tool, and on which plan tier? This is the existing open decision. For Figma, automatic writes need the Enterprise plan and a Full seat. On Professional or Organization only a manual plugin run is possible, which would need a change request against 'automatic' in DSN-01. How many brands go in v1.0? The brand axis must fit the plan's modes per collection (Figma Pro 10, Org 20, Enterprise/REST 40).
- Will the requester provide a dedicated service account or seat in the chosen tool for the sync credential, with library-publish rights in the design library file for the sync-owner role? And do they accept a fixed, non-federated, rotated credential under ENG-13, given that none of the candidate tools offers OIDC?
- If Penpot is chosen: does the requester accept file-wide (not per-board) brand and mode switching as a DSN-05 deviation through a change request? Will Penpot be cloud or self-hosted, and if self-hosted, can CI runners reach it?
- If Figma is chosen: does the requester accept that library publishing stays a manual step, done by the sync owner and tracked as an item with a deadline after each automatic variable sync, since Figma has no publish API?

## ADR
ADR-0XX: Token-to-design-tool sync, tool-agnostic (ports and adapters, orthogonal brand × mode axes, scheduled divergence detection)

## SOURCES
- https://developers.figma.com/docs/rest-api/variables/ — Variables REST GET and POST require the Enterprise plan; POST needs a Full seat or admin with edit access and scope file_variables:write; variables updated via REST must be published before other files can use them.
- https://developers.figma.com/docs/rest-api/variables-endpoints — POST variables is atomic (400 on any failure, nothing persisted); 4 MB body cap; max 40 modes per collection, 5000 variables per collection, mode names up to 40 characters, no '.{}' in names; remote variables cannot be written; extended-collection constraints; POST is Tier 3, GETs are Tier 2.
- https://developers.figma.com/docs/rest-api/variables-types — codeSyntax (WEB/ANDROID/iOS), scopes and hiddenFromPublishing fields; extended collections via REST only for local collections (isExtension, parentVariableCollectionId, variableOverrides).
- https://developers.figma.com/docs/rest-api/rate-limits/ — Tiered rate limits by seat and plan in effect since 2025-11-17 (Tier 2 25/50/100 per minute, Tier 3 50/100/150 per minute for Dev/Full seats); 429 with Retry-After; OAuth, PAT and plan-token budgets tracked separately.
- https://developers.figma.com/docs/rest-api/plan-access-tokens/ — Plan access tokens (Org/Enterprise, admin-managed, not user-bound, max 1 year) cannot be used with endpoints requiring file_variables:write.
- https://developers.figma.com/docs/rest-api/changelog — Plan access tokens GA 2026-07-23; VariableComposedColor added 2026-09-17; extended collections documented 2025-11-18; OAuth app publishing flow required by 2025-11-17.
- https://forum.figma.com/suggest-a-feature-11/extended-no-expiration-personal-access-tokens-40595 — Non-expiring Figma PATs were removed in 2025; maximum PAT expiration is 90 days.
- https://developers.figma.com/docs/rest-api/authentication/ — Figma auth options are PAT, OAuth apps and plan access tokens; no OIDC or federation is described.
- https://www.figma.com/blog/schema-2025-design-systems-recap/ — Mode limit raised to 10 on Professional and 20 on Organization; extended collections for multi-brand; native DTCG variable import/export announced.
- https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection — Extended collections are Enterprise-only, cannot add variables or modes, and accepting library updates removes previously set variable modes.
- https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables — Explicit modes can be set per collection on frames, sections and pages, with Auto inheritance from the parent and fallback to the collection's default mode.
- https://forum.figma.com/share-your-feedback-26/extended-collections-doesn-t-respect-mode-hierarchy-48123 — Community report (Dec 2025): choosing a brand from an extended collection forces a mode, and instances do not inherit the parent's mode; no staff reply.
- https://forum.figma.com/suggest-a-feature-11/auto-publishing-and-updating-of-libraries-45271 — Sept 2025 request noting the Figma REST API lacks library publish and update functions; no staff response.
- https://github.com/figma/variables-github-action-example — Figma's official example (MIT): Enterprise plus PAT, bidirectional workflows, no deletion of removed variables, name-based matching.
- https://help.penpot.app/user-guide/design-tokens/ — Penpot tokens: sets, multidimensional themes with groups (one active theme per group, e.g. Brand and Mode), DTCG single and multi-file import/export with $themes/$metadata; import replaces existing tokens; plugin token access noted.
- https://community.penpot.app/t/apply-different-tokens-sets-in-different-boards/9771 — Per-board or page theme scoping has not shipped; Penpot developer (July 2026) says it is not prioritized yet.
- https://penpot.app/release-notes/2-14-come-together — Penpot 2.14 exposes design tokens through the Plugins API, used by AI clients and Penpot MCP.
- https://github.com/penpot/penpot/issues/7916 — Plugin API for tokens, sets and themes merged via PR #7756 on 2026-02-09.
- https://help.penpot.app/mcp/ — Official Penpot MCP requires the MCP plugin running in an open Penpot browser tab; interactive, not headless.
- https://help.penpot.app/technical-guide/integration/ — Penpot RPC API has no formal reference (backend source docs); access tokens expire Never/30/60/90/180 days; no token endpoints documented.
- https://github.com/penpot/penpot — Penpot is licensed MPL-2.0.
- https://docs.tokens.studio/figma/export/themes — Tokens Studio maps each theme group to a Figma variable collection and each theme to a mode; export is a manual action and a Pro feature.
- https://docs.tokens.studio/figma/export/variables-skipped — Tokens Studio creates as many modes as the Figma plan allows and skips the rest; at most 5000 variables per collection.
- https://tokens.studio/pricing — Paid plugin features (multi-dimensional theming, Git sync) are on the Team plan (€39 per editor per month); the free plan excludes plugin Pro.
- https://github.com/tokens-studio/figma-plugin — Tokens Studio for Figma plugin source is MIT-licensed.
- https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/ — DTCG Resolver Module 2025.10 (stable CG final report) defines sets, modifiers and contexts and recommends orthogonal modifiers (e.g. brand vs mode).
- https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/ — DTCG Format Module 2025.10 is the stable token format.
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows — Scheduled workflows run only on the default branch, can be delayed, and are disabled after 60 days of inactivity in public repos; fork PRs get no secrets other than a read-only GITHUB_TOKEN.
- https://docs.github.com/en/actions/concepts/security/openid-connect — GitHub OIDC issues short-lived, job-scoped tokens to cloud providers, avoiding long-lived secrets.
- https://github.blog/changelog/2026-07-02-issue-fields-are-now-generally-available — GitHub issue fields (including date fields and default Target date) GA on 2026-07-02, usable for owner and deadline on tracked items.
- https://www.npmjs.com/package/@figma/rest-api-spec — Official Figma REST API types package, MIT, actively released (0.43.0 2026-09-24, 0.44.0 2026-10-07, 0.45.0 2026-10-16; verified via npm view).


# VERIFICATION: needs_changes
- [major] CLAIM: On Pro/Org, writing is possible only through a plugin run by a person. Open question 1: on Professional or Organization only a manual plugin run is possible, which would need a change request against 'automatic' in DSN-01.
  PROBLEM: This is out of date. Figma's remote MCP server has had 'write to canvas' since early 2026. Its `use_figma` tool runs Plugin API code in the file and can create and update variables. It works without the desktop app on Professional, Education, Organization and Enterprise plans, with a Full seat for files outside drafts. It is in beta, free during beta and will later become usage-based paid. Only clients in the Figma MCP catalog can connect (e.g. VS Code, Cursor, Claude Code), auth is user-bound OAuth, each call returns at most 20 KB, and no CI or non-interactive use is documented. The result leaves this path out of the per-tool constraints, the alternatives and the capability model. So the main question put to the requester (plan tier, and whether a change request is needed) rests on a wrong premise. The path also matters for reading: REST GET variables is Enterprise-only, so detection and verify on Pro/Org would also have to go through MCP or a plugin.
  CORRECTION: Record the Figma remote MCP write path among the Figma constraints and alternatives. Write it as a candidate for Pro/Org that has not been proven. Its caveats: beta and pricing will change; clients limited to the catalog; user-bound OAuth refresh (ENG-13 rotation, bus factor); an AI client and model credential in CI; no documented headless use; Figma rate limits and terms. Determinism holds only if the agent passes generated Plugin API code through unchanged and a read-back verify follows. Add a spike to the plan. Rephrase open question 1: Enterprise gives the supported REST path; Pro/Org would depend on a beta MCP path, plus a manual-plugin fallback if the spike fails. Allow `capabilities.write` to take a value such as 'agent-mcp' next to 'api' and 'manual'.
- [major] CLAIM: AlertPort opens or updates a `design-sync:failure` issue that @mentions the CODEOWNERS team and sets the Owner field. Tracker and alert use the ephemeral GITHUB_TOKEN with `permissions: issues: write`; there is no fixed GitHub secret.
  PROBLEM: GITHUB_TOKEN has no organization Members/teams permission. Community reports say team @mentions posted with it show as plain text and do not notify; they start working with a GitHub App that has org Members:read, or with a PAT. So the DSN-02/FR-026 alert may never reach the role, and the only other signal is a red check, which notifies a person (the actor or the last cron editor), not the role. Also, GitHub's issue-field-values REST docs say 'only users with push access to the repository can set issue field values', so `issues: write` alone may be refused. The claim that no fixed GitHub secret is needed is unproven.
  CORRECTION: Mint a short-lived GitHub App installation token in the job (actions/create-github-app-token, pinned by SHA) with Issues:write and org Members:read, plus push access if field writes need it. Record the App private key in the ENG-13 inventory as a fixed secret with justification, owner, scope and rotation. As a fallback, resolve team members through the App and assign them individually. Add a CI contract test, plus a one-time sandbox proof kept as evidence for DSN-02, showing the team is actually notified. Keep the failing check as a second signal.
- [major] CLAIM: Tokens that vary on both axes fall back to hidden helper aliases in a reserved namespace. Each fallback is listed in the log and the DSN-04 report as a declared exception.
  PROBLEM: DSN-04, FR-028 and SC-010 require every tool variable to have a name and hierarchy identical to a token, and the report to show zero differences. They allow no exceptions. Helper variables have no matching token, so self-declared exceptions relax an acceptance criterion without a change request (constitution: plans must not set a different value without a change request). In real multi-brand systems this is not a rare case: whenever a semantic token maps to different brand keys per mode, two-collection Figma needs an intermediate variable.
  CORRECTION: Make zero helper variables the rule, enforced on the token side. The tokens build validation (coordinated with the token-build/resolver topic) fails when a token's brand-by-mode variance cannot be expressed as a mode-axis alias to a brand-axis token with identical keys in every brand. Such intermediates must then be authored as real tokens in the source, so they are also published and diffed. Have the sync core refuse to create unmanaged helpers. If brand data makes this impossible, raise it as an item for the requester or a change request, not as an exception declared in the DSN-04 report. Record the solution adopted under FR-029.
- [minor] CLAIM: @figma/rest-api-spec 0.4x (MIT, official) as a types-only devDependency.
  PROBLEM: Confirmed: 0.45.0 published 2026-10-16, official. But the npm `license` field is the non-SPDX string 'MIT License' (`npm view @figma/rest-api-spec license`). An SPDX-based ENG-21 checker treats unknown licenses as failures, so it will reject the package. The README also says the spec 'is currently in beta', and minor bumps arrive every 1-3 weeks with breaking 0.x semantics.
  CORRECTION: Pin an exact version, and add a reviewed license-text alias ('MIT License' → MIT, checked against the repo LICENSE) to the versioned license policy, approved by the owner (ENG-25). Note the beta status in the ADR. Alternatively, generate types from the OpenAPI file in the repo so the dependency is not needed.
- [minor] CLAIM: pinned in the lockfile under the repo's minimum-release-age rule
  PROBLEM: Neither the constitution nor docs/requisitos.md contains a minimum-release-age rule (grep finds nothing). The result cites a governance rule that does not exist in the governing documents.
  CORRECTION: Cite the ADR or research topic that sets it, or reword as frozen lockfile (ENG-16) plus owner approval (ENG-25).
- [minor] CLAIM: DTCG Resolver Module 2025.10 (stable CG final report) ... brand and mode modifiers.
  PROBLEM: The document is headed 'Final Community Group Report' (28 Oct 2025). However, its status section says it was published 'as a Candidate Recommendation', and its version value is internally inconsistent ('2025-10-01' in the root properties table vs '2025-11-01' in §4.1.2). It recommends orthogonal modifiers but does not require them. The sync design should not hard-wire a resolver version string that the token-build topic may handle differently.
  CORRECTION: Have the sync core depend only on the tokens build's versioned `sync-manifest.json` contract (axes, per-context values), not on resolver syntax. Leave the choice of resolver adoption and version to the token-build ADR.
- [minor] CLAIM: Issue fields 'Owner' and 'Target date' (GA 2026-07-02) hold owner and deadline.
  PROBLEM: GA is confirmed, but issue fields are organization-level. The defaults are Priority, Effort, Start date and Target date; 'Owner' would be a custom field that an org admin must create. Setting values needs push access, and use of GITHUB_TOKEN is not documented. Org admin rights and field setup in the requester's org are dependencies the result does not mention.
  CORRECTION: Record that an org admin must set up the 'Owner' field, or fall back to a role label plus an owner line in the issue body and keep Target date. Cover both in the TrackerPort contract tests.
- [minor] CLAIM: workflow_dispatch gated by a protected environment; environments design-sync-write/read with deployment-branch policy.
  PROBLEM: In private repos (expected, given the proprietary licence premise), environment secrets and deployment-branch policies require GitHub Pro, Team or Enterprise. Required reviewers on private repos are not available on Free, Pro or Team. If 'protected' means reviewers, that depends on the requester's GitHub plan.
  CORRECTION: State the plan dependency. Rely on deployment-branch/tag policies, plus restricting workflow_dispatch to the sync-owner team through CODEOWNERS on the workflow file. Use reviewers only if the plan allows them.
- [minor] CLAIM: GitHub adapters for tracker and alert; GitHub Actions triggers.
  PROBLEM: The requirements and constitution never name GitHub (only 'e.g. CODEOWNERS'). The result takes the CI and issue platform as given without saying which decision or feature fixes it.
  CORRECTION: Name the dependency on the CI-platform decision from the CI/publication feature. The ports already keep the core independent of the platform.
- [minor] CLAIM: Names keep identical segments; Figma uses '/', Penpot '.'. This satisfies DSN-04.
  PROBLEM: Whether 'identical name' holds across a separator change depends on interpretation. If the naming convention does not define the mapping, the DSN-04 report has no objective rule to apply.
  CORRECTION: Define the segment-to-tool separator mapping, and where the collection or theme group sits relative to the token path, in the TOK-04 naming convention. Have the divergence report compare normalized segment arrays.
- [minor] CLAIM: Rate tiers since 2025-11-17, Dev/Full seats: GET Tier 2 at 25/50/100 per minute, POST Tier 3 at 50/100/150 per minute.
  PROBLEM: The rate-limits page gives three values per tier across four plans. The Variables API is Enterprise-only, so the figures quoted do not clearly correspond to the only plan that can call it.
  CORRECTION: Say the Enterprise figure is not shown and is irrelevant at about 2 GETs plus a few POSTs per run. Keep the Retry-After handling.

## REVISED DECISION
Keep the core architecture: a private, zero-runtime-dependency `@<prefixo>/design-sync` tooling package. It has a deterministic pure core (manifest-driven desired state, code-point-sorted canonical-JSON plan/log with a separate timestamp envelope, drift classification against the previous and current version, fingerprinted divergences), the ports DesignToolPort, TrackerPort and AlertPort with no tool-to-repo operation, an InMemoryDesignTool with fault injection plus a shared contract suite, and an ENG-01 layer entry with a deliberate forbidden edge. Triggers: after promotion to the main dist-tag, a weekly cron, and workflow_dispatch until ENG-26 exists, all in one concurrency group. Brand and mode become two orthogonal tool axes.

Changes:

(1) Alerts and tracking. The GitHub adapters use a short-lived GitHub App installation token minted in the job (actions/create-github-app-token, SHA-pinned) with Issues:write and org Members:read, plus push access if issue-field writes need it. The App private key goes in the ENG-13 inventory as a fixed secret with justification, owner, scope and rotation. A sandbox proof that the sync-owner team is notified is kept as evidence for DSN-02. The 'Owner' issue field depends on an org admin setting it up; the fallback is a role label plus Target date.

(2) DSN-04. No helper variables. The tokens build validation, coordinated with the token-build/resolver ADR, fails when a token's brand-by-mode variance cannot be expressed as a mode-axis alias to a brand-axis token with identical keys in every brand. The core never creates unmanaged variables. Any case that cannot be met goes to the requester or a change request, not to a self-declared exception. Define the separator and collection mapping in the TOK-04 naming convention, and have the report compare normalized segment arrays.

(3) Tool constraints for the requester. Add Figma's remote MCP 'write to canvas' (`use_figma`): beta; Professional, Education, Organization and Enterprise with a Full seat; catalog clients only; user-bound OAuth; future usage-based pricing; no documented CI use. Record it as an unproven Pro/Org path that needs a spike. Add a capability value such as 'agent-mcp'. Rephrase open question 1: Enterprise is the supported REST path for both write and read; Pro/Org would depend on the beta MCP path, falling back to a manual plugin plus a change request only if the spike fails.

(4) Supply chain. Pin @figma/rest-api-spec exactly (beta spec, frequent 0.x bumps). Add a reviewed alias for its non-SPDX license string 'MIT License' to the ENG-21 policy, or generate the types from the OpenAPI file instead. Drop the reference to a 'minimum-release-age rule' unless an ADR establishes one.

(5) Name the dependencies on the CI-platform decision (GitHub) and on the GitHub plan: environment secrets and branch policies need Pro, Team or Enterprise in private repos, and required reviewers are not available on Free, Pro or Team. Have the core consume only the versioned sync-manifest contract, not resolver syntax. The Resolver 2025.10 text is internally inconsistent: its status says Candidate Recommendation and its version string says 2025-10-01 in one place and 2025-11-01 in another.

Keep open questions 2 to 4 as they are.

## EXTRA SOURCES
- https://help.figma.com/hc/en-us/articles/39216419318551 — Figma MCP server: 'Writing to the canvas is available on Professional, Education, Organization, and Enterprise plans'; a Full seat is required outside drafts; free during beta, later usage-based paid; only Figma MCP catalog clients (VS Code, Cursor, Claude Code); agents can create and update variables; the desktop server cannot write.
- https://developers.figma.com/docs/figma-mcp-server/write-to-canvas — The `use_figma` tool runs code in the Figma file through the Plugin API; remote server only; beta; 20 KB output limit per call; no CI or non-interactive use documented.
- https://developers.figma.com/docs/figma-mcp-server/ — The remote MCP server works without the desktop app; new MCP clients must join a waitlist, so client access is gated.
- https://github.community/t/team-mention-from-bot-not-working/144323 — Community report: the default GITHUB_TOKEN cannot read organization teams, so team @mentions from Actions are not linked or notified; a GitHub App with org Members:read or a PAT fixes it.
- https://docs.github.com/en/rest/issues/issue-field-values — Issue field values are set via POST/PUT /repos/{owner}/{repo}/issues/{n}/issue-field-values; 'Only users with push access to the repository can set issue field values.'
- https://github.blog/changelog/2026-07-02-issue-fields-are-now-generally-available — Issue fields are organization-level; the defaults are Priority, Effort, Start date and Target date; there is no default 'Owner' field.
- https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments — Required reviewers are only available for public repos on Free, Pro and Team; environment secrets and deployment branch policies in private repos need Pro, Team or Enterprise.
- https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/ — The Resolver 2025.10 report is labelled Final CG Report, but its status text says Candidate Recommendation and its version value is inconsistent (2025-10-01 vs 2025-11-01); orthogonal modifiers are recommended, not required.
- https://www.npmjs.com/package/@figma/rest-api-spec — `npm view` shows license field 'MIT License' (not the SPDX id 'MIT'); 0.45.0 published 2026-10-16; the README says the spec is in beta.
- https://forum.figma.com/suggest-a-feature-11/launched-all-plans-should-offer-more-than-4-variable-modes-13979/index9.html — Figma staff announcement: mode limits raised to 10 on Professional and 20 on Organization.
