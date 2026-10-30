# Implementation Plan: Design tokens and themes

**Branch**: `001-design-tokens-themes` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-design-tokens-themes/spec.md`

## Summary

Deliver the PatoDS single token source in DTCG 2025.10, with three layers, brand and mode as
orthogonal modifiers of the Resolver, full CI validation, deterministic outputs (CSS per
brand with nested scopes, typed ESM, manifests, report), contrast check across all
combinations, manifest-driven style lint, and sync with the design tool in ports
and adapters, without choosing the tool.

Technical approach ([research.md](research.md)):

- Build on `@terrazzo/parser` as a library, with custom rules and formatters running over
  all brand × mode permutations (D1).
- pnpm 11 + Turborepo 2 monorepo, Node 24 LTS in the toolchain (D2).
- Pure CSS with space toggles, a brand-neutral `base.css`, and one file per brand, `@layer
  <prefixo>.tokens` (D3).
- Sync in ports and adapters with an in-memory fake; a real adapter only after the requester's
  decision (D4).
- colorjs.io behind a single adapter, custom WCAG 2.2, alpha compositing over an opaque stack (D5).
- Custom Stylelint rule, Vitest, tsc over the tarball, Playwright in a real browser (D6).
- A source model that satisfies FR-011, FR-012, FR-017, DSN-04, and DSN-05 together (D7, FR-033).

Decisions recorded as ADR-11 to ADR-16 ([docs/adr/](../../docs/adr/README.md)), status
Proposed until owner approval (GOV-07, GOV-09).

## Technical Context

**Language/Version**: TypeScript 6.0.x (single emission compiler) over Node.js 24.x LTS
(`.node-version`). `engines` floor and the ENG-08 matrix per the current premise: Node 22 LTS;
"latest": Node 26 LTS from 2026-10-28. TS 7.0.x axis only for `tsc` in the type tests.

**Primary Dependencies**: `@terrazzo/parser` and `@terrazzo/token-tools` 2.9.0 (exact, via
`overrides`), `ajv` 8.x exact, `colorjs.io` 0.7.1, `stylelint` 17.16.x with `@csstools/*` 4.x and
`postcss-selector-parser` 7.x. All as devDependencies of `tools/*` packages; the published package
`@<prefixo>/tokens` has no runtime dependency.

**Storage**: versioned files (DTCG source, manifests, configurations in `quality/`); outputs
generated in `dist/` outside version control; sync log as a release asset.

**Testing**: Vitest 5.0.x (unit, Node environment), `tsc --noEmit` + `expect-type` in a tarball-consuming
project (TS 6.0.x and 7.0.x), `publint`, `@playwright/test` 1.64.x on the official image
pinned by digest, custom determinism, drift, scan, and layer scripts. TS 7.0.x enters only
in the type-consumer project, via a pnpm named catalog (`catalogs.typescript7`), without conflict
with the toolchain's TS 6.0 `catalogMode: strict`.

**Target Platform**: browsers from the versioned list (ENG-08 premise, values pending); the
CSS mechanism requires only `@layer`, already required by ADR-03. CI on GitHub Actions (premise to
confirm).

**Project Type**: library (token package) + build and CI tools in a monorepo.

**Performance Goals**: build and validation short enough for the pipeline to fit within the QA-11 limit
if it is contracted (Desirable; premise: median of 15 min for the whole PR); token CSS measured against the QA-07 bundle budget (about
5.6 KB gzip per brand with 350 synthetic tokens).

**Constraints**: byte-for-byte identical output between builds, paths, time zones, locales, runners, and Node
floor/latest (FR-015, SC-002); no network in the build (remote `$ref` blocked); no token
outside the source (FR-001); frozen lockfile and no install script outside the allowlist (ENG-16,
ENG-24); no routine imports variables from the tool into the repository (FR-025).

**Scale/Scope**: N brands × 2 modes (N pending with the requester); 11 categories; on the order of hundreds
of tokens; 1 published package and 6 private tool packages.

No open technical NEEDS CLARIFICATION: all resolved in [research.md](research.md). Items
that only the requester decides follow current premises (research.md, "Questions for the requester").

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Initial assessment (before research) and reassessment after design (Phase 1). All answers
"yes"; no violation.

| # | Question (Constitution, Spec Kit Flow) | Initial | Post-design | Evidence in the design |
| --- | --- | --- | --- | --- |
| 1 | Does all component or token data come from the three sources and does every consumer obtain it from the derived output, without a hand copy? (I) | Yes | Yes | Single DTCG source; CSS, ESM, manifests, and sync-manifest derived; the tests' expected values come from the generated map; FR-001 scan |
| 2 | Do styles consume only semantics or components, and does the sync follow the current direction with divergences detected? (II) | Yes | Yes | Lint `primitive-token`, `literal-value`, `brand-mode-source-token`; port with no tool → repository operation; weekly and per-version detection |
| 3 | Framework packages without CSS, core without a headless primitive selector, interactives over headless? (III) | Yes | Yes | Does not apply directly (no components); token CSS stays in the token package, in `@layer`, with a prefix |
| 4 | API, DOM, and React/Vue behavior parity maintained? (IV) | Yes | Yes | Tokens are framework-neutral; React/Vue nested-theme tests stay in the components feature |
| 5 | Coverage of rules engine, keyboard, focus, reflow, target, contrast, declaration, and exceptions? (V) | Yes | Yes | Contrast of all pairs in all permutations (FR-019 to FR-021); the rest are component items |
| 6 | SSR, RSC, CSP, i18n, and provider-less use valid? (VI) | Yes | Yes | Pure CSS by attributes, with no JS and no injected style; default combination without a provider (FR-013) |
| 7 | Tests in a real browser, engine matrix, thresholds from the QA-14 file? (VII) | Yes | Yes | Playwright on Chromium/Firefox/WebKit; contrast minimums in `quality/thresholds.json`; the example app consumes the tarball |
| 8 | Data for catalog agents, read-only tools? (VIII) | Yes | Yes | Does not apply (catalog and MCP in other features); token manifests will be a catalog input |
| 9 | Dependencies, secrets, publishing, and assets follow the supply chain? (IX) | Yes | Yes | Exact pins, `minimumReleaseAge`, `allowBuilds`, license policy, actions by SHA, credentials in environments, static secrets justified |
| 10 | SemVer, stage, and deprecation respected? (X) | Yes | Yes | Removing or renaming a token = major; versioned token API report |
| 11 | Layer boundaries valid? (XI) | Yes | Yes | Tags `tokens`, `tools`, `apps` in `turbo.json`; tools only as devDependency; `tools/color` a leaf |
| 12 | Coexistence with legacy without conflict? (XII) | Yes | Yes | Prefix in variables and attributes; `@layer <prefixo>.tokens`; single-source layer order (MIG-14) |
| 13 | Does documentation cover React and Vue, generated from the catalog, examples, README, links? (XIII) | Yes | Yes | README of the token package (DOC-08) and name convention; site and fundamentals in the docs feature |
| 14 | Within scope and the Inventory, priority respected, premises cited? (Constraints) | Yes | Yes | TOK-12 conditional; premises cited in spec, research, and ADRs; no requester decision taken |

## Project Structure

### Documentation (this feature)

```text
specs/001-design-tokens-themes/
├── plan.md              # This file
├── research.md          # Phase 0: decisions D1 to D7
├── research/            # Raw reports by topic, with re-verification
├── data-model.md        # Phase 1: entities and rules V-01 to V-16
├── quickstart.md        # Phase 1: validation guide
├── contracts/           # Phase 1
│   ├── token-source.md
│   ├── css-output.md
│   ├── esm-output.md
│   ├── contrast-manifest.md
│   ├── lint-rules.md
│   ├── build-manifests.md
│   ├── design-sync.md
│   └── tools-cli.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)

docs/adr/                # ADR-11 to ADR-16 (Proposed)
```

### Source Code (repository root)

```text
package.json                 # root scripts via turbo; packageManager pnpm 11 exact
pnpm-workspace.yaml          # workspaces, catalog strict, allowBuilds, minimumReleaseAge
stylelint.config.mjs         # style lint gate (fixtures in this feature)
turbo.json                   # tasks, globalDependencies, boundaries.tags (layer file)
.node-version                # 24.x
.gitattributes               # LF
quality/
├── thresholds.json          # QA-14 (contrast section in this feature)
├── license-policy.json      # ENG-21
└── scan-allowlist.json      # FR-001 scan
packages/
└── tokens/                  # @<prefixo>/tokens (published)
    ├── src/
    │   ├── tokens.resolver.json
    │   ├── layers.json         # single source of the @layer order
    │   ├── primitive/*.tokens.json
    │   ├── semantic/invariant.tokens.json
    │   ├── semantic/brand/<id>.tokens.json
    │   ├── semantic/mode/{light,dark}.tokens.json
    │   └── component/*.tokens.json
    ├── contrast/{manifest.json,surfaces.json,manifest.schema.json,surfaces.schema.json}
    ├── schemas/dtcg-2025.10/  # versioned copies + SHA256SUMS + W3C license
    ├── api/tokens.api.json    # versioned API report
    └── dist/                  # generated, outside git
tools/
├── tokens-build/            # parser adapter, validators, formatters, writer
├── color/                   # leaf: toEmittedSrgb, WCAG, compositing
├── tokens-contrast/         # contrast-manifest checker
├── stylelint-plugin/        # <prefixo>/design-tokens and <prefixo>/contrast-pairs + fixtures
├── design-sync/             # core, ports, in-memory fake, GitHub adapters; design-sync.config.json (SLA)
└── repo-checks/             # determinism, drift, FR-001 scan, layers
apps/
└── tokens-example/          # Vite 8 without a framework, installs the tarball; Playwright tests
tests/
└── types-consumer/          # strict tsc over the tarball (TS 6.0 and 7.0)
docs/
├── adr/
└── tokens/convencao-de-nomes.md
.github/
├── CODEOWNERS               # owners by area, including the sync owner role (DSN-02)
└── workflows/
    ├── tokens-ci.yml        # validation, build, tests, checks (PR, nightly)
    └── design-sync.yml      # post-promotion, weekly cron, manual dispatch
```

**Structure Decision**: the ADR-09 monorepo with three layers in this feature: `tokens` (published
package), `tools` (private, devDependency only), and `apps` (tarball consumers). This is the
first feature, so it creates the monorepo skeleton (workspace, turbo, toolchain, layer file
with the tags it uses). The full ENG-01 checks (fixtures in `.vue`, import rules in
ESLint) and the ENG-03 remote cache stay in the CI and governance feature, which reuses this
base. Until the requester delivers the brands, `packages/tokens/src` uses placeholder brands (`a`,
default, and `b`) with synthetic values; they are not published to the registry.

## Phase 0: Research (completed)

[research.md](research.md): seven decisions (D1 to D7), alternatives, risks, adjustments to the spec, and
questions for the requester. Each topic was researched on the web and re-verified by a skeptical reviewer; raw
reports in [research/](research/).

## Phase 1: Design & Contracts (completed)

- [data-model.md](data-model.md): spec entities, fields, rules V-01 to V-16, states of the
  sync and the divergence.
- [contracts/](contracts/): DTCG source and convention, generated CSS, generated ESM, manifests and the build
  report, contrast manifest, lint rules, sync, and CLIs.
- [quickstart.md](quickstart.md): validation scenarios per user story, with commands and expected
  results.
- ADR-11 to ADR-16 in [docs/adr/](../../docs/adr/README.md).
- Spec adjusted with the clarifications from research and design (Clarifications section; FR-009, FR-013,
  FR-017, FR-020, SC-005, SC-006, and new FR-033).
- Closing decisions (research.md, D8): layer order in `src/layers.json`; only atomic tokens
  publishable (no composite `typography`); the regenerated API report counts as a token
  file in the new-brand diff.

## Implementation Strategy (input for /speckit-tasks)

Suggested order, aligned to the user story priorities:

1. **Foundation** (blocks everything): `git init`, the monorepo skeleton (pnpm, turbo, toolchain,
   `quality/`, layer file), minimal CI with actions by SHA, copies of the DTCG schemas.
2. **US1 (P1)**: `tools/tokens-build validate` with a source index, rules V-01 to V-13, report;
   initial source with placeholder brands; FR-001 scan.
3. **US2 (P2)**: CSS formatters (`base.css`, `brand-<id>.css`) and ESM; manifests; determinism and
   drift; tarball example app with the real-browser cases; type tests.
4. **US3 (P3)**: additional brand (C) test with a diff restricted to the source; runtime switching.
5. **US4 (P4)**: `tools/color`, contrast manifest, `tools/tokens-contrast`, real-browser samples with axe.
6. **US5 (P5)**: `tools/stylelint-plugin` with fixtures and gate.
7. **US6 (P6)**: `tools/design-sync` (core, ports, fake, contract suite, GitHub adapters),
   workflow with triggers; real adapter after the requester's decision.
8. **Closing**: entries in the traceability matrix (FR-031), package README, name
   convention, constitution conformance review.

Parallelizable after the foundation: US4 (`tools/color`) and US6 (`tools/design-sync`) do not touch the
US2 and US3 files until the manifest integration.

## Main risks

| Risk | Mitigation |
| --- | --- |
| Terrazzo bus factor and cadence | Thin adapter, exact version, golden outputs, official DTCG test suite, Style Dictionary as a swap |
| `turbo boundaries` experimental | pnpm manifest check and import rules in ESLint as required checks |
| Interpretation of "variable without a value" in the ENG-06 acceptance | Operational definition in the spec, confirmation with the acceptor |
| Design tool without automatic writing in the contracted plan | `manual` and `agent-mcp` capabilities create a trackable item; decision and eventual change request with the requester |
| Determinism across Node and ICU versions | Custom code-point ordering; comparison between floor and latest Node |
| Transitive licenses outside MIT/Apache/BSD | ENG-21 policy with the real set (MPL-2.0 dev only, MIT-0, CC0, Python-2.0, W3C) and reviewed `svg-tags` override |

## Complexity Tracking

No constitution violation to justify.
