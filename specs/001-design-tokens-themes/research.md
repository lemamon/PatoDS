# Research: Design tokens and themes (Phase 0)

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-21

Method: six topics researched on the web by independent agents, each result re-verified by
a skeptical reviewer (versions, browser support, licenses, adherence to the spec, the constitution, and the
requirements). All six came back with corrections, all incorporated below. The cited versions were
checked in the npm registry and in the official sources on 2026-10-21.

Cross-cutting rules adopted in all decisions:

- Exact versions in the frozen lockfile (ENG-16); every pin has an age greater than or equal to the
  pnpm `minimumReleaseAge` (1440 min), recorded in the repository (D2).
- No new dependency without a license reviewed in the versioned ENG-21 policy, without an install script
  outside the ENG-24 allowlist, and without owner approval (ENG-25).
- No open decision of the requester is decided here: design tool, brands, prefix,
  TOK-12, browser list, and version floors follow the current premises (section "Questions for the
  requester").

## D1. Token build pipeline

**Decision**: `@terrazzo/parser` and `@terrazzo/token-tools` (`/css` subpath) used only as a
library, all `@terrazzo/*` at the same exact version via pnpm `overrides` (currently 2.9.0;
2.10.0 was released on 2026-10-21 and does not yet meet the minimum window). Schema validation with `ajv` (exact
version) against versioned copies, with sha256, of `format.json` and `resolver.json` of DTCG 2025.10.
PatoDS rules and formatters in a private package `tools/tokens-build`, which runs after
`parse()` over **all** brand × mode permutations (`resolver.listPermutations()` +
`resolver.apply()`), failing if the list comes back undefined. Custom deterministic writer: ordering
by code point, LF, no timestamp or absolute path.

**Rationale**:

- DTCG 2025.10 (Final Community Group Report of 2025-10-28) is the first stable version, with the
  Format, Color, and Resolver modules; there is no later stable version. The Resolver models brand and mode
  as orthogonal modifiers, without duplicating files (FR-009, FR-010).
- Terrazzo 2.x is the only mature JS parser with full support for 2025.10, including the Resolver,
  `$extends`, `$root`, and `$ref`; MIT license; light dependencies, no install scripts.
- The PatoDS requirements (three layers and alias direction, segments in a fixed order, key parity,
  one file per brand, nested scopes, manifests for lint and contrast, report) do not
  exist in any tool; they would be written anyway. As pure functions over an internal
  model, each rule has a unit test (QA-02).
- Reviewer finding: Terrazzo's `lint` hook only sees the default permutation, does not receive the resolver, and,
  in resolver mode, loses the per-file origin. That is why the rules run in the custom adapter, with an
  index id → file → line → layer built on the Ajv read.

**Safeguards**:

- `parse()` receives a custom `req` that rejects non-`file:` `$ref` (the default does `fetch()`).
- The official DTCG 2025.10 test suite (`design-tokens/community-group/test-suite`) and golden
  outputs are a gate on each Terrazzo upgrade.
- Terrazzo strips `.$root` from the ids and only accepts `$extends` as a string: the convention forbids `$root` and
  accepts `$extends` only with keys; fixtures cover both cases.
- The DTCG schemas are under the W3C Software and Document License: origin and license enter the third-party
  notices and the ENG-21 policy.
- Shared sets do not carry semantic values, so that parity (FR-011) is not masked
  by inheritance from a base set.
- Determinism compared between two builds and between the floor and latest Node of the matrix (ENG-08),
  because Terrazzo orders with an ICU-dependent collator.

**Rejected alternatives**:

- Style Dictionary 5.7.0: incomplete 2025.10 support (issue #1590 open; no Resolver, no
  `$extends`/`$ref`). It remains a swap via the adapter when the Resolver ships.
- Full Terrazzo (CLI + plugins): `plugin-css` requires `@terrazzo/cli` as a peer, which brings vite,
  vite-node, chokidar, escodegen, and prompts; `plugin-js` generates a runtime `resolver.apply()` instead of a
  static map (ENG-04).
- A 100% custom compiler: it would reimplement the most sensitive part of the DTCG spec with no gain.
- Style Dictionary + sd-transforms: coupled to the Tokens Studio format (an open tool).

**Risks**: Terrazzo bus factor (a single npm publisher) and fast release cadence. Mitigation:
a thin adapter, exact version, golden outputs, official test suite, MIT (viable fork).

**ADR**: [ADR-11](../../docs/adr/ADR-11-pipeline-build-tokens.md).

## D2. Monorepo: package manager, orchestrator, and toolchain

**Decision**:

- pnpm 11.28.x at an exact version (`packageManager`, `devEngines.packageManager` with
  `pmOnFail: error`), installed by an action pinned by SHA. `strictDepBuilds` + the `allowBuilds` map
  (ENG-24 allowlist), `--frozen-lockfile` (ENG-16), `catalog` with `catalogMode: strict`,
  `minimumReleaseAge: 1440`, `blockExoticSubdeps`, `trustPolicy: no-downgrade`.
- Turborepo 2.11.x at an exact version (respecting the minimum window), `--affected` with
  `TURBO_SCM_BASE`, `globalDependencies` + a scope step for a full run (ENG-02),
  `envMode: strict`, telemetry off.
- ENG-01 in three required checks: (a) `turbo boundaries` for the tag rules over the package
  graph; (b) import rules in ESLint that cover `.vue` via vue-eslint-parser
  (`turbo boundaries` ignores `.vue`, `.mts`, and `.cts`); (c) a pnpm manifest check that fails with
  a UI package in a tool's `--prod` closure, with a package without exactly one layer tag,
  and with `@boundaries-ignore` outside the exceptions registry. This feature delivers (a) and (c) with
  fixtures in `.ts` for the layers it creates; (b) and the fixtures in `.vue` arrive with the CI and
  governance feature, when Vue code exists (the ENG-01 acceptance is not claimed here).
- Repository toolchain: Node 24.x LTS (`.node-version`) and TypeScript 6.0.x as the single emission
  compiler. `engines` and ENG-08 matrix floor per the current premise ("Node on LTS"):
  Node 22 LTS; "latest": Node 26 LTS from 2026-10-28. TS 6.0 is the provisional value of the
  premise's `<version>`; the TS 7.0 axis runs only `tsc` (vue-tsc stays on 6.0 until the 7.1 API).

**Rationale**: pnpm 11 brings ready the supply-chain set that ENG-16, ENG-19 (`pnpm sbom`),
ENG-21 (`pnpm licenses`), and ENG-24 require; pnpm 12 (a Rust rewrite, GA on 2026-08-26) is still
stabilizing and its npm package has `preinstall`/`postinstall`. Turborepo gives execution of only the affected and
an open remote-cache protocol (OpenAPI), which allows a custom server with restricted writes.

**Remote cache (ENG-03)**: design recorded in the ADR, implementation in the CI feature.
Self-hosted ducktors/turborepo-remote-cache server (MIT, image pinned by digest) with `AUTH_MODE=jwt`
over GitHub OIDC: read for the repository, write only for the `job_workflow_ref` of the protected branch's
workflow, a dedicated `JWT_AUDIENCE`, immutable claims (`repository_id`). A local sidecar
renews the token on each request (OIDC tokens last about 5 min). Recurring test: a PUT from a
PR gets 403. Plan B: separate READ_ONLY and write instances, or a minimal server that
answers 409 for an existing key.

**Rejected alternatives**: Nx 23 (self-hosted cache deprecated by CVE-2025-36852; a package with
postinstall; the recommended path is proprietary SaaS); pnpm 12 (maturity and install
scripts); pnpm alone (no task cache in 11; no boundaries); moon 2 (unstable remote cache,
authentication by static secret); Rush (wraps pnpm, without a boundaries lint); Vercel
Remote Cache (OIDC without read/write distinction on the server); npm or Yarn workspaces (without the
native supply-chain set).

**Risks**: `turbo boundaries` is experimental (mitigated by checks b and c); maturity and bus factor
of the cache server (Plan B recorded); pnpm 11 may go out of maintenance (cheap migration).

**ADR**: [ADR-12](../../docs/adr/ADR-12-monorepo-toolchain.md).

## D3. CSS strategy for brand and mode scopes

**Decision**: pure CSS, with no new dependency, everything in `@layer <prefixo>.tokens`, with space
toggles. Distributed files:

- `base.css`, brand-neutral: declaration of the layer order, shared primitives in
  `:where(:root)`, private mode toggles (`--<prefixo>-_on-light` and `--<prefixo>-_on-dark`, with
  the literal value `initial` or empty) with a light default in `:where(:root)` and rules
  `[data-<prefixo>-mode="light"|"dark"]` (which also set `color-scheme`), and the resolver block
  `:where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode])`, which redeclares every public
  mode-axis or invariant semantic token and every component token.
- `brand-<id>.css`, one per brand: only `[data-<prefixo>-brand="<id>"]` selectors with the brand-axis
  tokens and the primitives exclusive to that brand; only the default brand's file adds
  `:where(:root)` to the selector.

A mode-axis token in the resolver, with no space between the toggles:
`var(--<prefixo>-_on-light, <light value>)var(--<prefixo>-_on-dark, <dark value>)`.

**Rationale**:

- The computed value of a custom property is the specified value with `var()` substituted, and it is what
  inherits (css-variables-1). Brand tokens come from the nearest brand scope; toggles come from the
  nearest mode scope; the resolver recomputes on every element that is a scope of any axis.
  Result: for each axis the nearest scope wins (FR-012), and "each scope redeclares the semantic
  tokens" (TOK-14) holds literally.
- An invalid value (`data-<prefixo>-brand="zzz"`, empty, mode "sepia", a brand not imported) matches only
  the resolver, which recomputes with the inherited inputs: it keeps the ancestor (FR-014).
- It works for any token type (color, shadow with several layers, opacity, dimension).
- It requires only what ADR-03 already requires (`@layer`). Proof: a harness on Chromium 156, Firefox 157, and WebKit
  26.4, 6 import configurations × 3 seeds, about 2,500 checks per pass with random mutations
  at runtime, zero failures with exact string comparison.
- Separating `base.css` from the brand files satisfies the literal reading of ENG-06 ("only that brand's
  selectors") and dispenses with a per-brand default-mode rule: the light default comes from `:root` in `base.css`.

**Safeguards**: always write the literal `initial` (WebKit bug 243247 with indirection through `var()`);
the generated-CSS lint guarantees the no-space form, the literal `initial`, and that every `var()` target is
declared; every public semantic or component token is declared only in the resolver or in the brand scope,
never outside (avoids a frozen value in a nested scope), and primitives, invariant by
definition, stay in `:where(:root)` of `base.css` or in the scope of the brand that uses them
exclusively; the private `_` segment stays out of the ESM, the `.d.ts`, the
DOM contract, and the API report.

**Operational definitions** (incorporated into the spec, see "Adjustments to the spec"): "variable without a value" is
a public token `--<prefixo>-*` (without the private `_` segment) that is empty or guaranteed invalid; the
private toggles are, by design, empty or `initial`.

**Rejected alternatives**: `light-dark()` + `color-scheme` (colors and images only; it ties the mode axis
to a property that apps and widgets also set); container style queries (the element evaluates the
ancestor container, so the scope itself does not receive its values; it failed in the harness); `@scope`
with proximity (correct, but Baseline only since 2026-03-24 and output 1.4 to 2.1 times larger; it would preempt
the browser-list decision); enumerated selector combinations (a descendant matches any ancestor, not the
nearest; hundreds of failures in the harness); `if()` (Chromium 137+ only; it remains a future
target without changing the API); a JS provider or CSS-in-JS (breaks SSR without JS and ADR-03).

**Risks and documentation**: an override on an element that is not a scope does not update component
aliases (document: override on the scope element, outside a layer); portals need both attributes
resolved from the origin (components feature, CMP-21); a size of about 5.6 KB gzip per brand
with 350 synthetic tokens, to be measured against the QA-07 budget.

**ADR**: [ADR-13](../../docs/adr/ADR-13-escopos-marca-modo-css.md).

## D4. Sync with the design tool

**Decision**: a private package `tools/design-sync`, with no runtime dependency (only Node's `fetch`, `crypto`,
`fs`, and `util.parseArgs`), in ports and adapters:

- A pure and deterministic core: desired state read from the `sync-manifest.json` generated by the token
  build; topology; diff and plan; log in canonical JSON with a separate envelope for the run's timestamp and URL;
  divergence classification against the previous and current version; divergence
  fingerprints.
- Ports `DesignToolPort`, `TrackerPort`, and `AlertPort`, **with no operation that reads from the
  tool into the repository** (guarantees FR-025 and US6 scenario 6 by construction).
- `InMemoryDesignTool` with fault injection and a shared contract suite, which runs against the
  fake on every PR and against the real adapter on a sandbox file nightly.
- Topology in the tool: a theme collection or group per axis (Primitives without modes; Brand with modes
  = brands; Mode with light/dark modes; Invariant semantics and Components without modes). **Zero
  auxiliary variables**: every brand × mode variation is expressed in the source as a mode-axis token that
  points to brand-axis tokens with the same keys (FR-033), so every tool variable
  corresponds to a real token (DSN-04).
- Triggers: after promotion to the main tag, weekly cron, and `workflow_dispatch` (until ENG-26
  exists), in the same concurrency group.
- Tracker and alert: GitHub adapters with a short-lived GitHub App installation token
  (Issues:write, org Members:read), because `GITHUB_TOKEN` does not notify teams. The App's private
  key enters the ENG-13 inventory as a justified static secret.
- The real tool adapter is only written after the requester's decision.

**Constraints recorded per tool** (for the requester's decision, without choosing):

- Figma: variables REST (GET and POST) only on the Enterprise plan, with a Full seat and the
  `file_variables:write` scope; atomic POST, body up to 4 MB, up to 40 modes and 5,000 variables per collection;
  no library-publishing endpoint (manual publishing, becomes a trackable item); mode
  limits: Professional 10, Organization 20; extended collections couple brand and mode (do not use as the
  default topology). On Professional and Organization, the write path would be the remote MCP server
  (`use_figma`, beta, OAuth tied to a user, no documented CI use): an unproven candidate,
  requires a spike. Credentials: PAT up to 90 days, a plan token up to 1 year (does not write variables).
- Penpot: MPL-2.0, self-hostable, native DTCG tokens; theme activation applies to the whole
  file (no per-frame scope as of 2026-07), which does not meet per-frame DSN-05; no documented headless
  API for tokens.
- Tokens Studio: themes and Git sync paid; manual export; modes above the limit are silently
  ignored; the plugin can push to Git (would require a block to respect DSN-01).
- No tool offers a federated credential: the tool credential is a static secret with the
  ENG-13 justification, an owner (the sync owner role), scope, and a rotation deadline.

**Rejected alternatives**: Tokens Studio as the mechanism (manual, paid, bidirectional); a Figma-only
script derived from the official example (assumes the tool, imports into the repository, does not remove
variables); an intermediary SaaS platform (a fourth source of facts, against Principle I and ADR-02);
Figma extended collections; a single collection with brand × mode modes (not independent axes and
overflows the mode limit); manual DTCG import; bidirectional sync (against the premise).

**ADR**: [ADR-14](../../docs/adr/ADR-14-sincronizacao-ferramenta-design.md).

## D5. Color engine and contrast check

**Decision**: `colorjs.io` 0.7.1 (MIT, no dependencies) at an exact version, wrapped in a leaf package
`tools/color` with no workspace dependencies. The CSS formatter and the contrast checker call the
same `toEmittedSrgb()` function.

- DTCG components are the source of truth: the 8-bit quantization of the components mapped
  to sRGB by the CSS Color 4 algorithm is emitted (`css` method, deltaEOK JND 0.02, always passed
  explicitly). A given `hex` that diverges from the components, for a color within the gamut, fails
  validation.
- A single alpha serialization (`rgb(r g b / a)` with fixed decimal places); the checker composites with the
  alpha read back from that string, so that the measured is the emitted.
- A custom WCAG 2.2 module: threshold 0.04045, coefficients 0.2126/0.7152/0.0722, ratio without
  rounding, passing with ≥ minimum.
- Source-over compositing in gamma-encoded sRGB over a background stack that ends in an opaque
  surface, or in a named surface set, expanded into one case per surface.
  The ratio is computed in floating point and in a variant that rounds to 8 bits at each blend
  (like axe-core); the smaller of the two applies.
- Inactive or disabled state pairs stay in the manifest and in the coverage check, with
  `exempt: "wcag-inactive"`: measured and reported, without failing the build (WCAG 2.2 AA exemption,
  A11Y-01 premise). A focus indicator that crosses the component border uses an "any-of" group
  (one side reaching 3:1 is enough, per Understanding 1.4.11).
- Minimums read from the QA-14 thresholds file per level (`WCAG22-AA`: text 4.5; non-text 3).
- FR-021: a custom Stylelint rule that groups declarations by subject and state and requires a background
  annotation when it is not on the same subject; non-resolvable expressions are an error. Backing in a
  real browser: samples of each pair rendered from the tarball, `getComputedStyle` equal to the emitted sRGB,
  plus axe (which requires painting the opaque stack on real ancestors).

**Rejected alternatives**: culori 4.0.2 (no release in 16 months; a second engine alongside
Terrazzo); @texel/color (without Lab, LCH, HSL, HWB; non-CSS Color 4 gamut); chroma-js (without several
DTCG spaces); color, tinycolor2, wcag-contrast (sRGB only); @csstools/css-color-parser (parses
CSS strings, not DTCG objects; MIT-0 would require a policy entry); APCA (not the WCAG
2.2 metric; restricted license); Terrazzo's `a11y/min-contrast` rule or `contrastWCAG21` (without alpha
compositing, without iterating permutations, luminance via XYZ matrix); compositing in linear
light (diverges from what the browser shows).

**ADR**: [ADR-15](../../docs/adr/ADR-15-cor-e-contraste.md).

## D6. Style lint and test stack

**Decision (lint)**: a custom Stylelint rule, `<prefixo>/design-tokens`, an ESM plugin over
stylelint 17.16.x, with `@csstools/css-tokenizer` and `@csstools/css-parser-algorithms` 4.x and
`postcss-selector-parser` 7.x, driven by the build's token manifest. Stable subcodes:
`primitive-token`, `brand-mode-source-token`, `unknown-token` (any `var()` outside the manifest's
semantic and component tokens, with or without a prefix), `literal-value`,
`var-fallback-literal`, `token-definition` (every custom-property declaration in component CSS
is governed), `control-height`, `control-height-missing`, and `unclassified-component`.

- Interactive controls come from a registry of selectors that size the control (root,
  size and state modifiers, attribute variants). In production the registry is derived from the
  DOM contract (CMP-14) or from the guidance file; this feature delivers only fixture registries.
- Fixtures compare multisets of {file, line, column, code}: 100% of the expected errors and
  zero false positives, and every code has at least one invalid fixture.
- Gate with `ignoreDisables`, `--max-warnings 0`, and a JSON report.
- Constraints recorded for the core feature: a ban on remapping custom properties in
  variants and a keyword allowlist (`transparent`, `currentcolor`, `0`, `auto`, `none`, and the CSS
  globals) as the reading of "literal value" from TOK-03.

**Decision (tests)**:

- Unit: Vitest 5.0.x with coverage-v8, Node environment only (QA-02); a script that fails when a logic
  module has no test file.
- Types: a consumer project that installs the tarball, strict `tsc --noEmit` with `moduleResolution`
  `bundler` and `nodenext`, in TS 6.0.x and 7.0.x, `expect-type` 1.4 for positive cases and
  `@ts-expect-error` for negatives (nonexistent token, brand, and mode name); `publint` on the tarball.
- Real browser: `@playwright/test` 1.64.x against a Vite 8 example app without a framework,
  built only from the tarball, served by `vite preview`, on the image
  `mcr.microsoft.com/playwright:v1.64.x-noble` pinned by digest, with no external network. Expected values
  come from the tarball's value map, never hand-written. Chromium on every PR; all the engines of the
  list nightly and before publishing.
- Determinism: two builds from two clean `git worktree`s, in different paths, `TZ`, and `LC_ALL`,
  with no task cache, packing with `pnpm pack`; compares sha256 per file and of the
  tarballs; nightly repetition between runners and between floor and latest Node.
- Drift: generated outputs stay in `.gitignore`; the check fails if `git ls-files` lists a generated
  file; artifacts versioned on purpose (the token API report) are regenerated and require
  `git diff --exit-code`.
- FR-001 scan: files from `git ls-files`; flags a custom-property declaration with a literal
  value, with any name, in CSS, SFC `<style>`, and HTML outside the token source, `--<prefixo>-` keys
  and `setProperty` in TS/JS/JSON and DTCG documents outside the source; a versioned allowlist
  with a justification; self-test fixtures.

**Transitive-tree licenses** (for the ENG-21 policy, written by the vendor with owner
approval): MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, MIT-0, CC0-1.0, and Python-2.0 (via
stylelint), MPL-2.0 only as an unmodified development dependency (lightningcss via Vite 8; axe-core)
and the W3C Software and Document License (the DTCG schema copy). `svg-tags` declares MIT only
through the legacy `licenses` field and needs a reviewed override. ENG-24 allowlist: `fsevents`
(optional, darwin) now; `esbuild` when Storybook enters.

**Rejected alternatives**: stylelint-declaration-strict-value (does not distinguish a primitive `var()` from a
semantic one); native rules with name regexes (couples to the still-open convention);
Primer or Carbon plugins (locked to their tokens; Carbon has a telemetry postinstall); @eslint/css (a smaller
ecosystem); Biome (JS plugins in unstable preview); comment annotation for controls (a silent false
negative); Vitest browser mode for the example app (does not test an app built from the tarball); Jest 30;
jsdom or happy-dom (forbidden by Principle VII); TSTyche 7 and tsd (depend on the TS API or a stale
fork); arethetypeswrong (pins TS 5.6 internally); diffoscope and Semgrep (GPL/LGPL and extra
binaries).

**ADR**: [ADR-16](../../docs/adr/ADR-16-lint-tokens-e-testes.md).

## D7. Token source model (consolidation of D1, D3, and D4)

**Decision**:

- A single file `packages/tokens/src/tokens.resolver.json` (DTCG Resolver 2025.10) with two
  orthogonal modifiers,
  `brand` (contexts = brands) and `mode` (`light`, `dark`), and sets per layer.
- Layer by source directory (`primitive/`, `semantic/`, `component/`), recorded in the adapter
  index. Only the primitive layer has a literal.
- Variation axis of each semantic token: invariant, brand axis, or mode axis. Variation on both
  axes is forbidden in a single token: it is expressed as a mode-axis token whose value in each mode is
  an alias to a brand-axis source token with the same keys across every brand (reserved mode
  suffix in the name). This gives, at the same time, the CSS toggle form (D3) and orthogonal collections
  without auxiliary variables in the tool (D4).
- Brand-axis source tokens with a mode suffix are not consumable by component styles (lint
  `brand-mode-source-token`), because they would ignore the mode scope.
- Primitives are invariant. Those referenced by more than one brand, or by tokens outside the brand
  axis, go to `base.css`; the ones exclusive to a brand go to that brand's file (ENG-06).
- Shared sets (primitives, invariants, components) have no brand- or mode-axis values;
  parity (FR-011) runs per context and per resolved permutation.

**Rationale**: it is the only form, among those studied, that satisfies FR-011, FR-012, FR-017, DSN-04, and
DSN-05 together without a self-declared exception.

## D8. Design closing decisions (Phase 1)

- **Layer order**: single source in `packages/tokens/src/layers.json`, maintained by the lowest
  layer; the core adds its layers in the same file (MIG-14).
- **Composite types**: only tokens with a single CSS value are publishable. Composite `typography` and
  `strokeStyle` as an object are rejected in the build; the `typography` category uses atomic tokens.
  Rationale: one token, one custom property, and one string in the value map (one-to-one correspondence
  with CSS, ESM, and the design tool).
- **API report and new-brand diff**: TOK-07 requires that adding a brand change "only
  token files". The token API report (`api/tokens.api.json`), derived and versioned
  as required by QA-08, is a token file; the diff check accepts the source and that report
  regenerated and rejects any other file (spec, Clarifications).
- **Manifest format**: single owner in
  [contracts/build-manifests.md](contracts/build-manifests.md).

## Adjustments to the spec resulting from the research

Recorded in [spec.md](spec.md), Clarifications section, session 2026-10-21:

1. FR-013, FR-014, FR-017, and SC-006: distribution in a neutral `base.css` plus one file per brand;
   operational definition of "variable without a value" (public tokens; private toggles excluded).
2. FR-020: exemption of inactive state pairs (`exempt: "wcag-inactive"`, measured and reported) and
   "any-of" groups for a focus indicator that crosses the border, both derived from the premise's WCAG 2.2 AA
   level (A11Y-01).
3. New FR-033: mandatory form of brand × mode variation (D7), which sustains FR-011, FR-012, DSN-04,
   and DSN-05.
4. FR-009, SC-005, and US3 scenario 1: "only token files" (source and regenerated API
   report), as in TOK-07 (D8).

## Questions for the requester

Decisions only the requester can make. Until the answer, the indicated premises apply.

| Topic | Premise used in the plan | Impact |
| --- | --- | --- |
| Browser list and TypeScript floor (ENG-08) | The CSS mechanism requires only `@layer` (already required by ADR-03); TS 6.0 provisional | Color output and the engines of the nightly tests |
| Node floor (ENG-08) | Node 22 LTS (current premise); proposal: move up to 24 (22 EOL on 2027-04-30) | `engines` and matrix; moving up later forces a major |
| Repository and CI platform | GitHub and GitHub Actions (inferred from ENG-18) and a plan with environments | OIDC, cache, tracker, alerts |
| Remote cache hosting (ENG-03) | Account and region to be indicated (CI feature) | Proof of ENG-03 |
| Design tool, plan, and service account (DSN-01) | None chosen; fake adapter | Figma requires Enterprise for automatic writing via REST; manual library publishing |
| Static tool credential (ENG-13) | Accepted with justification, owner, and rotation | No tool offers federation |
| ENG-06 acceptance interpretation | "Variable without a value" = public token; private toggles excluded | Phase 1 acceptance evidence |
| Wide-gamut color palettes | Deterministic mapping to sRGB | Brand appearance |
| Brands, values, default brand, prefix, TOK-12 | Already pending in the spec | Source content and names |

## Main sources

- DTCG 2025.10: https://www.designtokens.org/tr/2025.10/ (Format, Color, Resolver) and
  https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- Terrazzo: https://terrazzo.app/docs/reference/js-api/ and the `@terrazzo/parser` 2.10.0 code at
  https://unpkg.com/@terrazzo/parser@2.10.0/dist/
- Style Dictionary #1590: https://github.com/style-dictionary/style-dictionary/issues/1590
- pnpm 11: https://github.com/pnpm/pnpm/releases/tag/v11.0.0 and https://pnpm.io/supply-chain-security
- Turborepo: https://turborepo.dev/docs/reference/boundaries and
  https://turborepo.dev/docs/core-concepts/remote-caching
- Nx CVE-2025-36852: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages
- Node release schedule: https://github.com/nodejs/Release
- TypeScript 7.0: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- css-variables-1: https://drafts.csswg.org/css-variables-1/; space toggle:
  https://lea.verou.me/blog/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property/;
  WebKit 243247: https://bugs.webkit.org/show_bug.cgi?id=243247
- Baseline: https://web-platform-dx.github.io/web-features-explorer/ (cascade-layers, scope,
  container-style-queries, light-dark, if)
- Figma Variables REST: https://developers.figma.com/docs/rest-api/variables/; MCP write:
  https://developers.figma.com/docs/figma-mcp-server/write-to-canvas
- Penpot tokens: https://help.penpot.app/user-guide/design-tokens/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ and Understanding 1.4.3 and 1.4.11
- colorjs.io: https://colorjs.io/docs/gamut-mapping; axe-core color:
  https://github.com/dequelabs/axe-core/tree/develop/lib/commons/color
- Stylelint 17: https://stylelint.io/developer-guide/plugins; Vitest 5:
  https://vitest.dev/blog/vitest-5; Playwright Docker: https://playwright.dev/docs/docker

Complete reports of each topic, with all sources and the skeptical reviewer's re-verification:
[research/](research/) (one file per topic).

Deeper scientific and standards backing, with primary-source citations per decision (and a
contested-evidence section covering, e.g., WCAG2 contrast vs APCA and the `0.04045`/`0.03928`
threshold): [../../docs/research/foundations.md](../../docs/research/foundations.md).
