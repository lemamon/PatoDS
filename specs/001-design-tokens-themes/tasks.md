---
description: "Task list for feature 001 — Design tokens and themes"
---

# Tasks: Design tokens and themes

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: mandatory in this feature. Constitution Principle VII and requirements QA-01,
QA-02, QA-08, and FR-024 require unit tests, type tests, real-browser tests, and lint fixtures with
intentional violations. Each story's test tasks are in the story body.

**`<prefixo>` marker**: constitution marker (TODO(PREFIXO)). **Brands** `a` (default) and `b`
are synthetic until the real brands are delivered (QA-15). Paths and names follow [plan.md](plan.md) and
the contracts.

## Format: `[ID] [P?] [Story] Description with path`

- **[P]**: can run in parallel (different files, no pending dependency).
- **[Story]**: US1 to US6; Setup, Foundational, and Polish carry no label.

---

## Phase 1: Setup (monorepo skeleton)

**Objective**: initialize the monorepo and the shared configuration (ADR-09, ADR-12).

- [x] T001 Run `git init`, create `.gitignore` (ignore `node_modules/`, `**/dist/`, `.turbo/`,
  `*.tsbuildinfo`) and set `main` as the branch at the root `/`
- [x] T002 Create `package.json` at the root with `"packageManager": "pnpm@11.28.x"` (exact version),
  `devEngines.packageManager` with `pmOnFail: "error"`, `private: true`, and scripts that delegate to
  turbo (`tokens:validate`, `tokens:build`, `contrast:check`, `lint:styles`, `test`, `test:types`,
  `test:e2e`, `check:determinism`, `check:drift`, `check:scan`, `check:layers`, `design-sync`)
- [x] T003 [P] Create `pnpm-workspace.yaml` with `packages`, `tools`, `apps`, `tests`; `catalog` with
  exact versions (terrazzo 2.9.0, ajv, colorjs.io 0.7.1, stylelint 17.16.x, vitest 5.0.x,
  @playwright/test 1.64.x, typescript 6.0.x and the named catalog `typescript7` for 7.0.x);
  `catalogMode: strict`; `allowBuilds` (ENG-24 allowlist, only `fsevents`); `minimumReleaseAge:
  1440`; `blockExoticSubdeps: true`; `trustPolicy: no-downgrade`
- [x] T004 [P] Create `.node-version` (24.x) and `.gitattributes` forcing `* text=auto eol=lf`
- [x] T005 [P] Create a strict `tsconfig.base.json` (`strict`, `moduleResolution: "bundler"`,
  `verbatimModuleSyntax`, `noEmit` by default), with a target compatible with TS 6.0
- [x] T006 Create `turbo.json` with the T002 tasks, `envMode: "strict"`, `globalDependencies`
  (`.node-version`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig.base.json`,
  `.github/**`), telemetry off, and the `boundaries.tags` skeleton (filled in T022)
- [x] T007 [P] Create `quality/thresholds.json` (QA-14) with the contrast section
  `{ "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }` and room for the QA-07 bundle budget
  (value pending with the requester)
- [x] T008 [P] Create `quality/license-policy.json` (ENG-21) with the allowed licenses (MIT, ISC,
  Apache-2.0, BSD-2-Clause, BSD-3-Clause, MIT-0, CC0-1.0, Python-2.0), MPL-2.0 only as an unmodified
  development dependency, W3C for the DTCG schema copy, and a reviewed override of
  `svg-tags` (MIT via the legacy field)
- [x] T009 [P] Create `quality/scan-allowlist.json` (FR-001 scan) with the token source and the
  scanner fixtures, each entry with a justification
- [x] T010 [P] Create `.github/CODEOWNERS` with owners by area, including the sync
  owner role (DSN-02) and the accessibility owner of the contrast manifest (GOV-09)
- [x] T011 [P] Create `stylelint.config.mjs` at the root (gate skeleton: `ignoreDisables: true`,
  plugin path, filled in the US5 T0)
- [x] T012 [P] Create `.github/workflows/tokens-ci.yml` (skeleton): `pnpm install --frozen-lockfile`,
  all actions pinned by SHA digest (ENG-18), matrix of floor Node (22 LTS) and latest,
  `TURBO_TELEMETRY_DISABLED=1`, separation of PR (Chromium) and nightly (all engines)

**Checkpoint**: the monorepo installs with a frozen lockfile and `turbo run` resolves the empty tasks.

---

## Phase 2: Foundational (blocking prerequisites)

**Objective**: token package, schemas, internal build model, color engine, repo checks, and
layer boundaries. **No story starts before this.**

- [x] T013 Create `packages/tokens/package.json` (`@<prefixo>/tokens`): `exports` `"."` →
  `dist/esm/index.js` (types `index.d.ts`), `"./values"` → `dist/esm/values.js`, `"./css/base.css"`,
  `"./css/brand-*.css"`, `"./meta/*"`; `sideEffects: ["**/*.css"]`; `files` allowlist (ENG-17);
  **zero runtime dependencies**; `license` `UNLICENSED` (marker, ENG-22)
- [x] T014 [P] Copy `format.json` and `resolver.json` from DTCG 2025.10 to
  `packages/tokens/schemas/dtcg-2025.10/`, with `SHA256SUMS` and `LICENSE-W3C.md`; record the origin and
  W3C license in `quality/license-policy.json` and in the third-party notices
  — done: vendored the two official DTCG 2025.10 schemas from designtokens.org (each a self-contained
  bundle — the sub-schema URLs 404 as standalone files; 18/22 `$id`s embedded, zero dangling), canonical
  2-space/LF for determinism; `SHA256SUMS`, `SOURCE.md` (provenance + fetch date), `LICENSE-W3C.md`
  (W3C Document License); the `W3C` entry already in `quality/license-policy.json` (T008), not shipped in
  the tarball
- [x] T015 [P] Create `packages/tokens/src/layers.json` in the form `{ "order": ["<prefixo>.tokens"] }`
  (single source of the @layer order, css-output L-03)
- [x] T016 Create the scaffold of `tools/tokens-build` (`@<prefixo>/tokens-build`, `private: true`):
  `package.json` with devDependency `@terrazzo/parser` and `@terrazzo/token-tools` 2.9.0 (aligned by
  pnpm `overrides`), exact `ajv`, and `@<prefixo>/color`; `bin` `tokens-build` with subcommands
  `validate` and `build`; exit codes 0 ok, 1 violation, 2 usage/config, 3 internal; flag `--json`
  (tools-cli.md §1)
- [x] T017 Implement in `tools/tokens-build/src/model.ts` the internal token model (data-model,
  "Token": `path`, `cssName`, `layer`, `category`, `type`, `axis`, `role`, `values`, `source`) and the
  reader with Ajv that validates against the versioned DTCG schemas (V-01) and builds the index
  `id → file:line:column` used in every error message
  — done: V-01 Ajv schema validation lives in `tools/tokens-build/src/schema.ts` (`validateSchema`) —
  compiles the two vendored bundles in separate Ajv instances (strict:false, logger:false), validates
  `tokens.resolver.json` + every `*.tokens.json`, and maps each error's JSON pointer to file:line:column
  via momoa, emitting `TKN-SCHEMA` (rule V-01) with the conditional-wrapper cascade filtered; wired into
  the CLI before the model rules (validate + build). The real source passes; a bad `$type`/missing
  `resolutionOrder` is caught with position (schema.test.ts). Model-rule findings (V-02..V-13) now also
  carry the token position (filled in validateModel from the momoa-captured `sourceLine/sourceColumn`)
- [x] T018 Implement in `tools/tokens-build/src/resolver.ts` the loading via `@terrazzo/parser`
  with a custom `req` that rejects non-`file:` `$ref` (no network); expose `listPermutations()` and
  `apply()`; fail (code 1) if the permutation list comes back undefined or incomplete
- [x] T019 [P] Create `tools/color` (`@<prefixo>/color`, a leaf, with no workspace dependencies) with
  `toEmittedSrgb()` (CSS Color 4 `css` method mapping, 8-bit sRGB; alpha `rgb(r g b / a)` with
  three places), WCAG 2.2 module (threshold 0.04045; coefficients 0.2126/0.7152/0.0722; no
  rounding; passes with ≥) and source-over compositing in gamma sRGB, a float variant and a variant that
  rounds to 8 bits at each blend; unit tests with golden vectors (#767676/#fff = 4.54 passes,
  #777777/#fff = 4.48 fails, black/white = 21) — ADR-15, FR-020, QA-02
- [x] T020 [P] Create the scaffold of `tools/repo-checks` (`@<prefixo>/repo-checks`, with no workspace
  dependencies): `bin` `repo-checks` with `determinism`, `drift`, `scan-tokens`, `layers`; exit
  codes 0–3; `--json`
- [x] T021 Implement the `tools/repo-checks` `layers` subcommand: pnpm manifest check
  (`pnpm ls -r --prod --json`) that fails with a UI package in a `tools` package's `--prod` closure,
  with a package without exactly one layer tag, and with `@boundaries-ignore` outside a versioned registry;
  plus an intentional-violation fixture in `.ts` for a forbidden edge (ENG-01, ADR-12 check c)
- [x] T022 Fill `turbo.json` `boundaries.tags`: tags `tokens`, `tools`, `apps` and the allowed
  edges from the plan (`tokens -(dev)-> tools/tokens-build, tools/color`; `tools/tokens-build ->
  tools/color`; `apps -> tokens only via tarball`); `tools/color` and `tools/repo-checks` with no workspace
  dependency (ADR-12 check a)
- [x] T023 Wire into `.github/workflows/tokens-ci.yml` the `install --frozen-lockfile` and
  `check:layers` jobs (turbo boundaries + `repo-checks layers`), with the T021 violation fixture proving
  the block

**Checkpoint**: the foundation is ready — stories can start; US4 and US6 can run in parallel to
US2/US3 after this.

---

## Phase 3: User Story 1 — Define tokens in a single validated source (Priority: P1) 🎯 MVP

**Goal**: a single DTCG source in three layers, with standardized names, validated in CI; a malformed,
misnamed token, one with a literal outside the primitive layer, or one with an invalid reference is blocked.

**Independent Test**: propose valid and invalid changes (name off the standard, literal in the semantic
layer, alias to a nonexistent token, cycle, category without a semantic token) and confirm that only the
valid ones pass, with a report by category (spec US1).

### Fixtures and tests (US1)

- [x] T024 [P] [US1] Create invalid fixtures in `tools/tokens-build/fixtures/invalid/` with an `expect`
  of code per case: literal outside a primitive (V-02), nonexistent alias and cycle (V-03), reference
  to a layer above (V-04: `primitive → primitive`, `semantic → primitive|semantic`, `component →
  semantic|component|primitive`), `$ref` outside a primitive, `$root` and `$extends` off the keyed
  form (V-05), name off the grammar (V-06), category without a semantic token (V-11), variation on
  both axes off the `brand.` form (V-08), semantic value in a shared set (V-09), `hex`
  diverging from the components (V-10), control height outside the scale (V-12), semantic key
  missing/excess in a permutation (V-13)
- [x] T025 [P] [US1] Create valid fixtures in `tools/tokens-build/fixtures/valid/` that pass with
  zero violations, covering all 11 categories and the height scale
- [x] T026 [P] [US1] Validator unit tests in `tools/tokens-build/test/validate.test.ts`
  (Vitest), comparing the expected and obtained multiset of `{file, line, column, code}` (100%
  of the expected errors, zero false positives; FR-024, SC-009, QA-02)

### Implementation (US1)

- [x] T027 [US1] Implement the layer and alias validators in
  `tools/tokens-build/src/rules/layer.ts`: literal only in `primitive` (V-02, FR-003); alias resolves and
  is cycle-free in all permutations (V-03, FR-004); reference direction (V-04); `$ref` only in
  a primitive, `$root` forbidden, `$extends` only with keys (V-05) — `TKN-*` codes from token-source.md
- [x] T028 [US1] Implement the naming validator in `tools/tokens-build/src/rules/naming.ts`:
  segment grammar by category in a fixed order, ASCII kebab, prefix, CSS name collision
  (V-06, FR-005, `TKN-NAME-*`)
- [x] T029 [US1] Implement the axis validators in `tools/tokens-build/src/rules/axis.ts`: axis
  consistent with the contexts (V-07); `brand.` group form for brand × mode variation, with the same
  keys across every brand (V-08, FR-033); shared sets without an axis value (V-09, `TKN-AXIS-*`,
  `TKN-BRAND-SOURCE-*`)
- [x] T030 [US1] Implement coverage and scale in `tools/tokens-build/src/rules/coverage.ts`: at
  least one semantic token per category (V-11, FR-006); single closed height scale (V-12,
  FR-007, `TKN-CATEGORY-COVERAGE`, `TKN-CONTROL-SCALE`)
- [x] T031 [US1] Implement key parity in `tools/tokens-build/src/rules/parity.ts`:
  compare the set of semantic keys of all permutations and per context, pointing to a missing
  or excess key (V-13, FR-011, `TKN-PARITY-*`)
- [x] T032 [US1] Wire the rules to `tokens-build validate`, emitting a JSON validation summary with
  a count by category and the height scale per permutation (meets US1 scenario 4; the full report
  stays in the build, FR-008)
- [x] T033 [P] [US1] Create the initial source in `packages/tokens/src/`: `tokens.resolver.json`
  (modifiers `brand` with contexts `a`/`b` and `mode` with `light`/`dark`, `default` `a` and `light`,
  `resolutionOrder`), `primitive/*.tokens.json`, `semantic/invariant.tokens.json`,
  `semantic/brand/{a,b}.tokens.json` (`brand.` group), `semantic/mode/{light,dark}.tokens.json`,
  `component/*.tokens.json`, covering the 11 categories and `size.control.*` with synthetic values
- [x] T034 [US1] Implement the `tools/repo-checks` `scan-tokens` subcommand (FR-001): scan
  `git ls-files` for a custom property declaration with a literal value and any name in CSS, SFC `<style>`,
  and HTML outside the source, `--<prefixo>-` keys and `setProperty` in TS/JS/JSON and DTCG documents
  outside the source; honor `quality/scan-allowlist.json`; self-test fixtures in CSS, SFC, TSX, and
  JSON detected 100% (SC-001, SC-009)
- [x] T035 [US1] Add the "logic module without a sibling test" check to `tools/repo-checks` and
  run it in `pnpm test` (QA-02)
  — done: `repo-checks logic-tests` flags any `tools/*/src/**/*.ts` with a runtime export (not the
  `index.ts` barrel or `cli.ts`/bin) that no `test/**/*.test.ts` of its package imports (QA02-UNTESTED-MODULE);
  `determinism.ts` is allow-listed (an integration module exercised end-to-end by check:determinism/drift).
  Wired as `check:logic-tests` (root script + turbo + tokens-ci.yml) with synthetic tests; closed the real
  gaps it found (emit.ts, write.ts now have unit tests)
- [x] T036 [US1] Wire `tokens:validate` and `check:scan` into `tokens-ci.yml` as required PR
  checks; run over the real source (100% of the tokens pass)

**Checkpoint**: US1 testable on its own — `pnpm tokens:validate` passes the source and blocks each violation.

---

## Phase 4: User Story 2 — Consume generated tokens with brand and mode per subtree (Priority: P2)

**Goal**: CSS per brand and typed modules generated deterministically; brand and mode by attribute,
with nested scopes; a type error for a nonexistent token.

**Independent Test**: an example app that imports `base.css` + brand A, toggles mode and nests
scopes, with no B-exclusive variable and no variable without a value; a typed project gets an error on a nonexistent
token; two byte-for-byte identical builds (spec US2).

### Tests (US2)

- [x] T037 [P] [US2] Formatter unit tests in
  `tools/tokens-build/test/format-css.test.ts` and `format-esm.test.ts`: selectors, no-space form
  between toggles, literal `initial`, placement by `placement`, ordered output (QA-02)
- [x] T038 [P] [US2] Create `apps/tokens-example` (Vite 8 without a framework, `@<prefixo>/tokens-example`)
  that installs the **packaged tarball** of the token package (never the source code; QA-06, Principle
  VII), imports `./css/base.css` and `./css/brand-a.css`, and reads the `./values` map
- [x] T039 [P] [US2] Real-browser tests in `apps/tokens-example/tests/scopes.spec.ts`
  (@playwright/test, image `mcr.microsoft.com/playwright:v1.64.x-noble` pinned by digest, no network)
  covering the 21 cases of css-output.md §16: no attribute (default brand + light), mode only at the root,
  mode-only nested scope, brand-only scope inheriting mode, A→B→A, mode toggle, interleaved
  chain, two attributes on one element, invalid values inherit the ancestor, brand not
  imported, runtime switch, exact string comparison; and importing only A with no B variable
  or public variable without a value (ENG-06, FR-012 to FR-014, FR-017, SC-006, SC-007)
- [x] T040 [P] [US2] Create `tests/types-consumer` (`@<prefixo>/types-consumer`) that installs the tarball
  and runs strict `tsc --noEmit` in `moduleResolution` `bundler` and `nodenext`, in TS versions 6.0.x and
  7.0.x (catalog `typescript7`), with `expect-type` in the positive cases and `@ts-expect-error` in the
  negatives (nonexistent token, brand, and mode); `publint` on the tarball (FR-016, QA-08, ENG-05)

### Implementation (US2)

- [x] T041 [US2] Implement the CSS formatter in `tools/tokens-build/src/format/css.ts`: emit
  `base.css` (layer declaration from `layers.json`, shared primitives in `:where(:root)`,
  private toggles `--<prefixo>-_on-light`/`_on-dark` with literal `initial`, default mode, resolver
  `:where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode])` with the mode-axis tokens,
  invariants and components, in the no-space form) and `brand-<id>.css` (public brand-axis tokens
  and brand-exclusive primitives; `:where(:root)` only in the default brand) — css-output.md §4 to §8,
  FR-015, FR-017
  — note: the D7 brand-exclusive primitive partition (§4) was missing here (all primitives sat in
  base.css); completed under T044/FND-02 — exclusive primitives now move to their brand file, and a
  whole-token-aliased primitive emits `var()` (DEP-03) instead of a resolved literal
- [x] T042 [US2] Implement the generated-CSS lint in `tools/tokens-build/src/format/css-lint.ts`:
  no-space form, literal `initial` (WebKit bug 243247), every `var()` target declared, public
  token only in the resolver or in the brand scope, `css-layer` vs `layers.json`, `dist-parity`
  (css-output.md §13) — fails in the build
- [x] T043 [P] [US2] Implement the ESM formatter in `tools/tokens-build/src/format/esm.ts`: `index.js`
  with a frozen `tokens` object by path + `.d.ts` with a `TokenName` union and literals
  `var(--<prefixo>-…)`; `values.js` with `Readonly<Record<Brand, Record<Mode, Record<TokenName,
  string>>>>` + `.d.ts`; exclude the private `_` segment (esm-output.md, FR-016)
- [x] T044 [US2] Implement the `dist/meta/tokens.manifest.json` emitter in
  `tools/tokens-build/src/format/manifest.ts` per [contracts/build-manifests.md](contracts/build-manifests.md)
  §2 (per token: `cssName`, `layer`, `category`, `type`, `axis`, `role`, `placement`,
  `exclusiveBrand`, `aliasOf`, `aliasChains` per permutation, `scale`, `color.emitted`/`subRefs`,
  `source`), with guarantees M-06 to M-08
  — done (in build.ts renderTokensManifest, not a separate format/manifest.ts — monolithic build like
  T041/T045-T047): full §2.2 shape — `path` (was `id`), `aliasOf` (by context "*"/brand/mode),
  `aliasChains` (per permutation, token itself first), `color.subRefs`, `exclusiveBrand`, `source`
  (packages/tokens-relative `src/…` file + 1-based line/column via @humanwhocodes/momoa), `deprecated`,
  `description` + root `package` + `brands[].file`. M-06 (placement→file) in checkPublicPlacement,
  M-07/M-08 in checkManifestGuarantees (css-lint). D7 brand-exclusive derivation lives in model.ts
  (FND-02); manifest consumers migrated `id`→`path` (tokens-contrast, stylelint, dist-parity).
  Adversarial review (workflow) confirmed + fixed: primitive whole-token alias now emits `var()`
  (DEP-03/§4) so the fixpoint matches the renderer; stale §2.2 `source` example corrected (dark/line 6)
- [x] T045 [P] [US2] Implement the `dist/meta/sync-manifest.json` emitter in
  `tools/tokens-build/src/format/sync-manifest.ts` (build-manifests.md §3, format in
  [contracts/design-sync.md](contracts/design-sync.md)), from the same resolved model
- [ ] T046 [P] [US2] Implement the `dist/meta/report.json` and `report.md` emitter in
  `tools/tokens-build/src/format/report.ts`: count by category and layer, height scale per
  permutation, out-of-gamut colors mapped, raw and gzip size of each file (build-manifests.md
  §4, FR-006, FR-008, QA-07)
  — report.md done: `renderReportMd` emits `dist/meta/report.md` (totals, per-category counts,
  control-height scale, permutations, file bytes/gzip — the report.json data in tables, no timestamp,
  G-3) and it is listed under `./meta/*` in the API report. Remaining: report.json `controlHeight` is a
  flat id list, not the §4 per-permutation `{path,value}` shape; QA-07 budget wiring is T081
- [x] T047 [P] [US2] Implement the API-report emitter in
  `tools/tokens-build/src/format/api-report.ts` → `packages/tokens/api/tokens.api.json` (versioned),
  per esm-output.md §11 (public surface, GOV-01 major/minor/patch classification)
  — done (in build.ts renderApi, monolithic like T041-T046): full §11 document — `css` {layer,layerOrder},
  `theme` {attributes,brands,defaultBrand,defaultMode,modes}, `entries` (the exports map: `.`/`./values`
  esm with exports[] by name, css base, css brand-* with files[], meta/* with versioned files[]), and
  `tokens[]` with per-token metadata (name/cssName/type/category/layer/axis/role/placement/exclusiveBrand/
  deprecated, no values/descriptions), ordered by name. This is the GOV-01 §11.2 classification input; the
  comparator itself is the CI/publishing feature. dist-parity now reads `api.tokens[].name`. report.md is
  listed under meta/* once T046 generates it
- [x] T048 [US2] Implement the deterministic writer in `tools/tokens-build/src/write.ts` (code-point
  ordering, LF, no timestamp or absolute path; canonical JSON M-02) and wire the
  `tokens-build build` pipeline that runs formatters T041 to T047
- [ ] T049 [US2] Implement the `tools/repo-checks` `determinism` subcommand: two builds from
  two clean `git worktree`s, in different paths, `TZ`, and `LC_ALL`, with task cache
  off, packing with `pnpm pack`; compare sha256 per file and of the tarballs; variant between
  floor and latest Node (FR-015, SC-002, ENG-08)
  — strengthened: determinism.ts now builds a third time from a divergent filesystem path (a fresh
  copy of the source at a temp path, built with a different TZ and the C locale) and compares the dist +
  API hashes, so path independence is tested (code `DETERMINISM-PATH`), not only TZ/locale. Remaining: a
  literal two-`git worktree` run and the `pnpm pack` tarball sha256 comparison (floor vs latest Node)
- [x] T050 [US2] Implement the `tools/repo-checks` `drift` subcommand: `dist/` in `.gitignore`; fail
  if `git ls-files` lists a generated file; regenerate `api/tokens.api.json` and require
  `git diff --exit-code` (QA-08)
- [x] T051 [US2] Wire `tokens:build`, `test:types`, `test:e2e` (Chromium on the PR; all engines in the
  nightly), `check:determinism`, and `check:drift` into `tokens-ci.yml`; generate the tarball and install it in
  the apps (QA-06)

**Checkpoint**: US2 testable — the example app switches brand and mode, types block a nonexistent token,
byte-for-byte identical build.

---

## Phase 5: User Story 3 — Add a brand without touching components (Priority: P3)

**Goal**: adding a brand changes only token files (the source and the regenerated API
report), with the same semantic keys and runtime switching.

**Independent Test**: add the synthetic brand `c` and check in the diff that only token files
changed; the key check passes; the app switches to `c` at runtime (spec US3).

- [x] T052 [P] [US3] Integration test in `tools/tokens-build/test/add-brand.test.ts`: copy the
  source to a temporary worktree, add the `c` context and `semantic/brand/c.tokens.json`,
  run `tokens-build build`, and assert that `git diff --name-only` touches only `packages/tokens/src/**`
  and `packages/tokens/api/tokens.api.json` (FR-009, SC-005)
- [ ] T053 [P] [US3] Real-browser test in `apps/tokens-example/tests/add-brand.spec.ts`: with the
  `c` brand in the worktree, the app switches to `c` at runtime; values change without reloading and without a
  change to component code (US3 scenario 3)
- [x] T054 [US3] Confirm that the key parity (T031) and the diff accept brand `c`: a fixture where
  `c` has a missing or excess key is blocked (US3 scenario 2); document the "add a brand" steps
  in [quickstart.md](quickstart.md) if not yet covered

**Checkpoint**: US3 testable — a new brand enters through token files only.

---

## Phase 6: User Story 4 — Guarantee contrast across all combinations (Priority: P4)

**Goal**: contrast-pair manifest measured across all brand and mode combinations, with
composited opacity; a failing pair fails the build; an inactive state is measured and reported without failing.

**Independent Test**: include a failing pair and a translucent one and confirm that the build fails on the
first and composites the second over the background (spec US4).

### Tests (US4)

- [ ] T055 [P] [US4] Manifest fixtures in `tools/tokens-contrast/fixtures/`: failing pair, translucent
  composited pair, stack without an opaque base (V-16), empty surface set in a mode, a token
  missing in a permutation (V-14), exempt `wcag-inactive` pair below the minimum (reported, does not fail),
  "any-of" group with one passing side and another with no passing side, incoherent thresholds (code 2),
  `emitted-mismatch`
  — reopened: no on-disk `tools/tokens-contrast/fixtures/` dir exists
- [ ] T056 [P] [US4] Unit tests in `tools/tokens-contrast/test/check.test.ts` of the compositing
  (float and 8-bit per blend, the smaller of the two), exemption, any-of group, and report
  truncation/order (FR-020, SC-002, QA-02)
  — reopened: check.test.ts builds inline temp fixtures (mkdtemp/writeFile), not the on-disk matrix;
  covers only a subset (no any-of group / emitted-mismatch)

### Implementation (US4)

- [ ] T057 [P] [US4] Create `packages/tokens/contrast/manifest.json`, `surfaces.json`, and their schemas
  (`manifest.schema.json`, `surfaces.schema.json`) per contrast-manifest.md: `pairs[]` with `id`,
  `fg`, `bg` (stack or `@set`), `state` from the versioned vocabulary, `kind`, `group`, `exempt`;
  references only to public semantic or component tokens (FR-019); the a11y owner in CODEOWNERS
- [x] T058 [US4] Create `tools/tokens-contrast` (`@<prefixo>/tokens-contrast`, devDependency of
  `@<prefixo>/color` and the manifests of `@<prefixo>/tokens`): `bin` `tokens-contrast check`, exit
  codes 0–3
- [ ] T059 [US4] Implement the checker in `tools/tokens-contrast/src/check.ts`: for each pair and
  permutation, resolve via `tokens.manifest.json` (`color.emitted`), composite alpha over an opaque stack or
  an expanded `@set`, apply the WCAG module of `@<prefixo>/color`, minimums from
  `quality/thresholds.json`, `wcag-inactive` exemption, any-of group, `emitted-mismatch`; a failing pair
  fails the build (FR-020, FR-021 data part, A11Y-09, SC-008)
  — core done (A1a): contract finding codes (`pair-below-minimum`, `group-below-minimum`,
  `stack-not-opaque`, `empty-surface-set`, `unknown-token`, `emitted-mismatch`), any-of group (§8 step 10),
  G-4 `THRESHOLDS_MISMATCH` against the normative table (exit 2), near-threshold flag, and the §10
  `ContrastCheckResult` envelope (cases/groups/findings/summary). G-2 is the toEmittedSrgb round-trip of
  the manifest's emitted value (§8 step 4, manifest-only inputs).
  — still open (A1b): `@set` surface-set expansion (needs `surfaces.json`, T057) — a pair using `@set`
  reports `unknown-surface-set` for now; the independent source recompute for G-2 (the manifest carries no
  raw DTCG value, so the round-trip is self-consistency only); `--out` report writing is T060
- [ ] T060 [US4] Emit the JSON and Markdown contrast report (ordered by id, brand, and mode, with no
  timestamp, ratios truncated to 2 places in the table) and retain it as evidence (ACE-02)
  — reopened: no Markdown report, no `--out` file writing; JSON shape diverges from the §10
  ContrastCheckResult envelope
- [ ] T061 [P] [US4] Real-browser samples in `apps/tokens-example/tests/contrast.spec.ts`:
  render one swatch per pair and permutation from the tarball, paint the opaque stack on real ancestors,
  assert `getComputedStyle` equals the emitted sRGB and run axe (Principle VII, QA-01; axe/@axe-core
  in `license-policy.json` as MPL-2.0 dev)
- [x] T062 [US4] Wire `contrast:check` into `tokens-ci.yml` over the real manifest on every PR and include
  the report in the determinism variant between floor and latest Node

**Checkpoint**: US4 testable — contrast of all pairs in all combinations, with exemptions.

---

## Phase 7: User Story 5 — Block styles outside the tokens (Priority: P5)

**Goal**: a style lint that blocks a primitive token, literal value, and control height outside the
scale, delivered with fixtures and proven.

**Independent Test**: run the lint over valid and invalid examples and confirm 100% of the expected
errors and zero false positives (spec US5).

### Tests (US5)

- [ ] T063 [P] [US5] On-disk fixtures under `tools/stylelint-plugin/fixtures/` in the §5 layout
  (`design-tokens/{valid,invalid}/*.css`, `contrast-pairs/{valid,invalid}/*.css`, `gate-probe/probe.css`,
  synthetic `contrast/{manifest,surfaces}.json`, `registry.fixture.json`): `valid/` zero warnings,
  `invalid/` one `/* expect: <code>@<column> */` per case, covering the 9 design-tokens subcodes
  (`primitive-token`, `brand-mode-source-token`, `unknown-token` with and without prefix, `literal-value`,
  `var-fallback-literal`, `token-definition`, `control-height`, `control-height-missing`,
  `unclassified-component`) and the 6 contrast-pairs subcodes (lint-rules.md §5)
  — reopened: tests are inline in `test/*.test.ts`; no on-disk fixtures exist yet
- [ ] T064 [P] [US5] Fixture harness in `tools/stylelint-plugin/test/rule.test.ts` comparing the
  multiset of `{file, line, column, code}`, requiring every code to have an invalid fixture
  (FR-024, SC-009)
  — reopened: current test uses inline `stylelint.lint({code})`; no multiset harness over on-disk
  fixtures and no coverage assertion

### Implementation (US5)

- [ ] T065 [US5] Create `tools/stylelint-plugin` (`@<prefixo>/stylelint-plugin`, devDependency of
  stylelint 17.16.x, `@csstools/*` 4.x, `postcss-selector-parser` 7.x; consumes
  `@<prefixo>/tokens/meta/tokens.manifest.json`)
  — reopened: package.json is missing the `@<prefixo>/tokens` devDep (`./meta/*`), `@csstools/*` and
  `postcss-selector-parser`; the rules do not resolve a package-specifier manifest path (readFileSync
  only) — §2.1/§2.2
- [ ] T066 [US5] Implement the `<prefixo>/design-tokens` rule in
  `tools/stylelint-plugin/src/design-tokens.ts`: a map of governed properties, a keyword allowlist
  (`transparent`, `currentcolor`, `0`, `auto`, `none`, globals), the 9 subcodes,
  a fixture-only control registry, a rule for `@media`/`@container` (lint-rules.md §3; FR-022,
  FR-023)
  — reopened: only 6/9 subcodes implemented; `control-height`, `control-height-missing`,
  `unclassified-component` and the control registry (`controlRegistryPath`, §3.7) are absent, so FR-023
  is not enforced
- [x] T067 [P] [US5] Implement the `<prefixo>/contrast-pairs` rule in
  `tools/stylelint-plugin/src/contrast-pairs.ts`: group by subject and state, require a
  background annotation `/* <prefixo>-contrast: on <token> | @<set> */` when it is not on the same subject,
  error on a non-resolvable expression, skip `@media (forced-colors)` (FR-021)
- [ ] T068 [US5] Fill `stylelint.config.mjs` and wire `lint:styles` into `tokens-ci.yml` with
  `ignoreDisables`, `--max-warnings 0`, and a JSON report as proof of zero violations (applied to
  the fixtures in this feature; to the core once it exists)
  — blocked on T063/T065/T066; must match §6 exactly: gate glob `fixtures/*/valid/*.css` +
  `gate-probe/*.css`, package-specifier `manifestPath`, synthetic contrast manifest/surfaces,
  `controlRegistryPath`, report `reports/lint-styles/stylelint.json`, turbo dependsOn
  `@<prefixo>/tokens#tokens:build`, plus a deliberate-violation CI step

**Checkpoint**: US5 testable — the lint blocks each violation and produces no false positive.

---

## Phase 8: User Story 6 — Keep the design tool synced (Priority: P6)

**Goal**: a repository → tool sync engine in ports and adapters, with an in-memory
fake, divergence detection, and trackable items; with no operation that reads from the tool into the
repository.

**Independent Test**: a contract suite against the fake (manual edit restored, rename, divergence);
no routine imports variables into the repository (spec US6).

### Tests (US6)

- [ ] T069 [P] [US6] Implement `InMemoryDesignTool` in `tools/design-sync/src/adapters/memory.ts`
  with configurable capabilities and fault injection (fail after N operations, 429 with Retry-After,
  403, expired credential) and the helpers `simulateManualEdit`, `simulateRename`,
  `simulateExtraVariable`, `faults.failAfterOperations` (design-sync.md)
  — reopened: memory.ts exists but is a reduced prototype — omits capability fields and returns toy
  types vs the §4 port shapes (follows T072)
- [ ] T070 [P] [US6] Implement `describeDesignToolPortContract` in
  `tools/design-sync/test/port-contract.test.ts` (cases C-01 to C-18) and run it against the fake on every
  PR (QA-02); `InMemoryTracker`, `InMemoryAlert`, and `FakeClock`; synthetic brands A/B (QA-15)
  — reopened: port-contract.test.ts and the C-01..C-18 suite + InMemoryTracker/InMemoryAlert/FakeClock
  do not exist (only an inline sync.test.ts)

### Implementation (US6)

- [x] T071 [US6] Create `tools/design-sync` (`@<prefixo>/design-sync`, `private: true`, **with no
  runtime dependencies**; only `fetch`, `crypto`, `fs`, `util.parseArgs`) with `bin` `design-sync`
  (`plan`, `apply`, `detect`, `check-access`, `--adapter memory|<tool>`); codes 0–5 (4 access, 5
  verify)
- [ ] T072 [US6] Define the ports in `tools/design-sync/src/ports.ts`: `DesignToolPort`
  (`capabilities`, `checkAccess`, `readSnapshot`, `apply(plan,{dryRun})`, `requestPublish`),
  `TrackerPort`, `AlertPort`, **with no tool → repository operation** (guarantees FR-025 and US6 scenario
  6)
  — reopened: G-1 (no tool→repo op) holds, but signatures diverge from §4 — `apply`→`void` not
  `ApplyResult`, `readSnapshot`→`ToolVariable[]` not `ToolSnapshot`; capability set reduced
- [ ] T073 [US6] Implement the pure core in `tools/design-sync/src/core/`: desired state from the
  `sync-manifest.json`, topology per axis, diff and plan (rename by key, recreate on a type
  change, deletes last only in managed collections), divergence classification against the previous
  and current version, canonical JSON log with a separate envelope, divergence fingerprint
  (DSN-01 to DSN-05, DSN-11, FR-025 to FR-030); states `planned|dry-run|verified|failed`
  — reopened: core.ts (not src/core/) has an idempotent plan + a fingerprint, but no §6 divergence
  classification, no §7/§8 canonical log/envelope, collapses token values to `${type}:${axis}`, and the
  fingerprint formula diverges from §8
- [ ] T074 [P] [US6] Implement the GitHub tracker and alert adapters in
  `tools/design-sync/src/adapters/github/`: a short-lived GitHub App token (Issues:write, org
  Members:read), an item with an owner (CODEOWNERS role) and due date (detection + SLA from
  `design-sync.config.json`), an alert to the owner on failure (DSN-02, FR-026); tests against recorded
  snapshots
- [ ] T075 [US6] Create `.github/workflows/design-sync.yml`: triggers post-promotion to the main tag,
  weekly cron, and `workflow_dispatch`, in a concurrency group; environments `design-sync-read` and
  `design-sync-write`; actions pinned by SHA; no secret in a fork PR (ENG-14)
- [ ] T076 [US6] Add an architecture test (`tools/design-sync/test/no-repo-write.test.ts`) and an
  edge in the layer file that forbid `design-sync` from writing to the token source (ENG-01,
  FR-025)

**Checkpoint**: US6 testable — sync validated against the fake; the real adapter is left for after
the requester's decision.

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: closing, traceability, and cross-cutting requirements.

- [x] T077 [P] Write `packages/tokens/README.md` with purpose, installation, minimal usage, and a link to
  the full documentation (DOC-08)
- [ ] T078 [P] Generate/write `docs/tokens/convencao-de-nomes.md` from the
  [token-source.md](contracts/token-source.md) contract and wire the check that compares the document's
  vocabularies with the validator's (TOK-04)
- [x] T079 Create the versioned traceability matrix (`specs/001-design-tokens-themes/traceability.md`
  or `quality/traceability.json`) linking each FR/ID of this feature to a CI check or evidence, and a
  check that fails with an ID without a check (FR-031, ACE-02)
  — done (pulled forward from Polish per post-analyze remediation): `quality/traceability.json`
  (FR-001..033 + SC-001..011 + ENG-01/ENG-06/QA-06/QA-08/GOV-01, status met/planned/deferred with the
  gating check or owning task) + `repo-checks traceability` subcommand (fails a `met` id whose check is
  not a real root script, or has no check/evidence, or a duplicate/bad envelope) + `check:traceability`
  wired into `tokens-ci.yml` before check:scan; negative tests in checks.test.ts
- [ ] T080 [P] Wire `pnpm sbom` (ENG-19) and `pnpm licenses list --json` against
  `quality/license-policy.json` (ENG-21) into `tokens-ci.yml`, including the `tools/*` packages
- [ ] T081 [P] Wire the bundle-budget measurement (QA-07) from `report.json` (`files`)
  against `quality/thresholds.json` (budget value pending with the requester)
- [ ] T082 Run the end-to-end validation of [quickstart.md](quickstart.md) and record the result
- [ ] T083 Constitution conformance review (the 14 questions of the plan's Constitution Check)
  and attach it to the phase acceptance package (ACE-01); obtain owner approval of ADR-11 to ADR-16
  (GOV-07, GOV-09)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependency; starts right away.
- **Foundational (Phase 2)**: depends on Setup; **blocks all stories**.
- **US1 (Phase 3)**: depends on Foundational. It is the MVP.
- **US2 (Phase 4)**: depends on Foundational and the valid US1 source (T033).
- **US3 (Phase 5)**: depends on US1 (parity) and US2 (build and example app).
- **US4 (Phase 6)**: depends on Foundational (`tools/color`, T019) and the values emitted in
  `tokens.manifest.json` (T044); it can run in parallel to US2 after T044.
- **US5 (Phase 7)**: depends on `tokens.manifest.json` (T044).
- **US6 (Phase 8)**: depends on `sync-manifest.json` (T045); the core and the fake do not depend on US3,
  US4, or US5.
- **Polish (Phase 9)**: depends on the contracted stories being complete.

### Within Each User Story

- Fixtures and tests before or together with the implementation; compare by multiset.
- Validators and formatters are pure functions with unit tests.
- A story complete and testable before the next priority.

### Parallel Opportunities

- Setup: T003, T004, T005, T007, T008, T009, T010, T011, T012 in parallel.
- Foundational: T014, T015, T019, T020 in parallel; T016→T017→T018 in sequence.
- US1: T024, T025, T026, T033 in parallel before the rules; the rules T027 to T031 touch different
  files and can run in parallel.
- US2: T037, T038, T039, T040 in parallel; formatters T043, T045, T046, T047 in parallel after T044.
- After Foundational, with `tokens.manifest.json` ready (T044), **US4, US5, and the US6 core**
  can run in parallel to US3, since they touch different packages (`tools/tokens-contrast`,
  `tools/stylelint-plugin`, `tools/design-sync`).

---

## Parallel Example: User Story 1

```bash
# Fixtures and tests together:
Task: "Invalid fixtures in tools/tokens-build/fixtures/invalid/ (T024)"
Task: "Valid fixtures in tools/tokens-build/fixtures/valid/ (T025)"
Task: "Initial source in packages/tokens/src/ (T033)"

# Validation rules (different files):
Task: "Layer and alias rules in tools/tokens-build/src/rules/layer.ts (T027)"
Task: "Naming in tools/tokens-build/src/rules/naming.ts (T028)"
Task: "Axis and brand.* in tools/tokens-build/src/rules/axis.ts (T029)"
Task: "Coverage and scale in tools/tokens-build/src/rules/coverage.ts (T030)"
Task: "Parity in tools/tokens-build/src/rules/parity.ts (T031)"
```

---

## Implementation Strategy

### MVP (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → validate `pnpm tokens:validate` and
`check:scan` on their own. Delivers the single validated source.

### Incremental delivery

Setup + Foundational → US1 (validated source) → US2 (CSS/ESM/manifests, example app) → US3 (new
brand) → US4 (contrast) → US5 (lint) → US6 (sync). Each story adds value without breaking the
previous ones.

### Parallel-team strategy

After T044 (`tokens.manifest.json`), US4, US5, and the US6 core go to different people, in
distinct `tools/*` packages; US2 and US3 continue on the main track.

---

## Notes

- `[P]` = different files, no pending dependency.
- Brands `a`/`b` synthetic; the real default brand, prefix, design tool, browser list,
  Node/TS floors, and the contracting of TOK-12 pending with the requester (plan.md, research.md). The
  tasks use the current premises.
- The ENG-01 `.vue` checks and the ENG-03 remote cache (ADR-12) are left for the CI and
  governance feature; this feature delivers the layer checks in `.ts`.
- FR-032 (TOK-12, Desirable) has no task until it is contracted.
- Commit after each task or logical group; stop at each checkpoint to validate the story.
