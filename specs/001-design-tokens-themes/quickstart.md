# Quickstart: Design tokens and themes

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md) |
**Data model**: [data-model.md](data-model.md) | **Contracts**: [contracts/](contracts/) | **Date**: 2026-10-21

Validation guide for feature 001. It shows how to prepare the environment and how to prove, per user
story, that the implementation meets the spec: command, fixture or intentional violation, and expected
result (exit code and observable effect). It is not an implementation guide. Formats, grammars, and
schemas are in the contracts and the data model, cited in each scenario, and are not repeated
here:

| Topic | Reference |
| --- | --- |
| DTCG source, resolver, layers, name convention | [contracts/token-source.md](contracts/token-source.md), `docs/tokens/convencao-de-nomes.md`, rules V-01 to V-13 of [data-model.md](data-model.md) |
| Generated CSS (`base.css`, `brand-<id>.css`) | [contracts/css-output.md](contracts/css-output.md), [ADR-13](../../docs/adr/ADR-13-escopos-marca-modo-css.md) |
| Generated ESM (`.` and `./values`) | [contracts/esm-output.md](contracts/esm-output.md), [ADR-11](../../docs/adr/ADR-11-pipeline-build-tokens.md) |
| Contrast and surfaces manifest | [contracts/contrast-manifest.md](contracts/contrast-manifest.md), rules V-14 to V-16, [ADR-15](../../docs/adr/ADR-15-cor-e-contraste.md) |
| Lint rules and fixtures | [contracts/lint-rules.md](contracts/lint-rules.md), [ADR-16](../../docs/adr/ADR-16-lint-tokens-e-testes.md) |
| Sync with the design tool | [contracts/design-sync.md](contracts/design-sync.md), [ADR-14](../../docs/adr/ADR-14-sincronizacao-ferramenta-design.md) |
| Binaries, flags, `--json`, and exit codes | [contracts/tools-cli.md](contracts/tools-cli.md) |
| Monorepo, toolchain, and layers | [ADR-12](../../docs/adr/ADR-12-monorepo-toolchain.md) |

The commands come into existence as the `tasks.md` tasks are implemented. Until then,
this document serves as an executable acceptance criterion for each story.

`<prefixo>` appears literally as a marker of the project prefix (the constitution's TODO(PREFIXO)
v1.0.0). In the generated artifacts, it corresponds to the generator's prefix parameter, whose value the
requester will define.

## 1. Premises used in this guide

No open decision of the requester is taken here. The scenarios assume the current premises
below (spec, Assumptions; [research.md](research.md), "Questions for the requester").

| Open decision | Premise used | Effect on validation |
| --- | --- | --- |
| Design tool, plan, and account (DSN-01) | None chosen; only the `memory` adapter (in-memory fake) | US6 is validated against the fake; the scenarios with the real tool are in section 11 |
| Sync direction (DSN-01) | The repository is the source; the tool receives the variables | Scenario Q6.17 proves there is no import routine |
| Version 1.0 brands and their values (TOK-07) | All brands of the current consumer apps, with light and dark. Until delivery, placeholder brands `a` and `b` with synthetic values (QA-15), not published to the registry; brand `c` exists only in the US3 scenario | Every expected value comes from the generated value map, never from a hand-written number |
| Default brand (CMP-24) | Indicated by the requester; in the tests, `a` | The default-combination scenarios use `a` and `light` |
| Project prefix | `<prefixo>` | Names `--<prefixo>-*`, `data-<prefixo>-*`, `@<prefixo>/*`, and `@layer <prefixo>.tokens` |
| TOK-12 (Desirable) | Not contracted | FR-032 is out; no scenario |
| Browser list (ENG-08) | The versioned list not yet defined. The CSS mechanism requires only `@layer`, already required by ADR-03. As a working premise, the tests use the engines of the pinned Playwright image (Chromium, Firefox, WebKit), without thereby pinning the list | Chromium on every PR; the other engines nightly and before publishing; the CSS compatibility lint awaits the list |
| Node floor (ENG-08) | The repository toolchain on Node 24.x (`.node-version`). `engines` and matrix floor: Node 22 LTS, per the "Node on LTS" premise; latest: Node 26 LTS from 2026-10-28 | The determinism comparison between floor and latest runs nightly in CI |
| TypeScript floor (ENG-08) | 6.0.x as the provisional value of the premise's `<version>`; axis 7.0.x only with `tsc` | `pnpm test:types` runs in both versions |
| Repository and CI platform | GitHub and GitHub Actions, inferred from ENG-18 | Workflows `.github/workflows/tokens-ci.yml` and `design-sync.yml`; owners file in `.github/CODEOWNERS` |
| WCAG level (A11Y-01) | WCAG 2.2 AA | Minimums 4.5 (text) and 3 (non-text) in `quality/thresholds.json` |
| License of the published packages (ENG-22) | Proprietary; `UNLICENSED` as a provisional value | Checked in the tarball (CC-6) |
| CI thresholds (QA-14) | Contrast section per the level; coverage `<N>`% still without a value | The coverage threshold is not yet validatable (section 11) |
| Interpretation of "variable without a value" (ENG-06) | Only public tokens, without the private `_` segment; the toggles `--<prefixo>-_on-light` and `--<prefixo>-_on-dark` are out (spec, Clarifications) | Used in Q2.3, Q2.4, and Q2.9; the acceptor's confirmation is pending |

## 2. Prerequisites

| Item | Version and origin | How to check |
| --- | --- | --- |
| Node.js | 24.x, pinned in `.node-version` | `node --version` matches the `.node-version` line (use your preferred version manager) |
| pnpm | 11.28.x exact, pinned in the root `package.json` `packageManager` field; `devEngines.packageManager` with `pmOnFail: error` refuses another version | `corepack enable` and then `pnpm --version` |
| Docker | A recent Engine or Desktop | `docker version`; the image `mcr.microsoft.com/playwright:v1.64.<patch>-noble` is used by the digest pinned in `.github/workflows/tokens-ci.yml`, at the same `@playwright/test` version |
| Git | With `git worktree` support | The repository needs at least one commit: the determinism check builds from clean `HEAD` worktrees |

No scenario in this guide requires a credential. The network is only used to install dependencies from the registry;
the browser tests block external network.

## 3. Preparation

### 3.1 Installation and first build

```bash
pnpm install --frozen-lockfile
pnpm tokens:validate
pnpm tokens:build
```

Expected result:

- `pnpm install --frozen-lockfile`: exit 0. No install script outside the `allowBuilds` map
  of `pnpm-workspace.yaml` is executed.
- `pnpm tokens:validate`: exit 0. The summary shows the tokens by layer and by category, with zero
  violations across all brand × mode permutations (`a` and `b` × `light` and `dark`). Before the rules, the
  validation checks `packages/tokens/schemas/dtcg-2025.10/SHA256SUMS`.
- `pnpm tokens:build`: exit 0. Generates in `packages/tokens/dist/`, outside git: `css/base.css`,
  `css/brand-a.css`, `css/brand-b.css`, `esm/index.js` with `index.d.ts`, `esm/values.js` with
  `values.d.ts`, `meta/tokens.manifest.json`, `meta/sync-manifest.json`, and `meta/report.json` with
  `report.md`. The same build regenerates `packages/tokens/api/tokens.api.json`.
- `git status --porcelain` stays empty: `dist/` is in `.gitignore`, and the API report only changes
  when the public surface changes.

### 3.2 Execution conventions

Exit codes of all custom CLIs (`tokens-build`, `tokens-contrast`, `design-sync`,
`repo-checks`):

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Violations found (validation, lint, contrast, divergence) |
| 2 | Usage or configuration error |
| 3 | Internal error |
| 4 | `design-sync` only: access or credential error of the design tool |
| 5 | `design-sync` only: divergence in the verify after the `apply` |

- Every CLI accepts `--json`: machine output on stdout, with a stable schema. Without the flag, it prints
  human output. Errors carry `file:line:column` when applicable.
- In the tables, "exit N" is the binary's code. The root scripts go through pnpm and turbo: the specific
  code appears in the task's failure message, and the root process ends with a non-zero code whenever N ≠ 0.
- To read the exact code or consume `--json`, invoke the binary outside turbo, which prefixes the
  log lines. Example: `pnpm -C packages/tokens exec tokens-build validate --json`. The invocation
  form of each binary is in [contracts/tools-cli.md](contracts/tools-cli.md).
- Third-party tools keep their codes: `tsc` and Playwright end with a non-zero code
  on failure; Stylelint uses 2 for a rule violation.
- A package's unit tests run with `pnpm test --filter=<package>`; the argument reaches turbo.

### 3.3 Intentional violations

Every check that promises a block is proven by an intentional violation (constitution, "Traceability
and acceptance"). There are two complementary forms:

1. **Automatic**: violation fixtures inside each tool package, run by
   `pnpm test` on every PR. Each rule has at least one valid and one invalid fixture.
2. **Manual demonstration**: apply the violation in a throwaway worktree and run the root script.

```bash
git worktree add ../patods-violacao HEAD
cd ../patods-violacao
pnpm install --frozen-lockfile
# apply the violation described in the scenario and run the indicated command
cd -
git worktree remove --force ../patods-violacao
```

### 3.4 Real browser

`pnpm test:e2e` packages `@<prefixo>/tokens` with `pnpm pack` and installs the tarball in
`apps/tokens-example`: third-party dependencies via the frozen lockfile, the tarball with scripts
disabled, and verification that the installed files are those of the tarball. Then it builds the
app (Vite 8, no framework) and runs the Playwright tests of `apps/tokens-example/tests` against
`vite preview`. The tests block external network, and the expected values come from
`@<prefixo>/tokens/values` of the tarball itself. The app has one page per import set (only
`a`; only `b` with an attribute on the root; `a` and `b` in both orders). The command ends with exit code 0 when
all cases pass and with a non-zero code if any case diverges; the Playwright report points to the
case and the engine.

Local run on the pinned image (the reference invocation is the e2e job of `tokens-ci.yml`):

```bash
docker run --rm --ipc=host -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.64.<patch>-noble@sha256:<digest> \
  bash -lc 'corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e'
```

Use a separate clone or worktree so as not to mix the host's `node_modules` with the container's.
On the PR only Chromium runs. For another engine, after a `pnpm test:e2e`, run
`pnpm -C apps/tokens-example exec playwright test --project=<engine>`, with the project names from the
app's Playwright configuration.

## 4. US1: define tokens in a single validated source (P1)

Precondition: section 3.1 with no error. Automatic coverage: `pnpm test --filter=@<prefixo>/tokens-build`
runs one valid and one invalid fixture per rule (V-01 to V-13) and the official DTCG
2025.10 test suite. The demonstrations below use the section 3.3 worktree. Every source violation is reported with
the token path, `file:line:column` (ADR-11 source index), and the violated rule.

Example of a Q1.2 violation, in `packages/tokens/src/semantic/invariant.tokens.json` (the existing alias
of `opacity.state.disabled` swapped for a literal; the name follows the grammar, so that only
rule V-02 fires):

```json
{ "opacity": { "state": { "disabled": { "$type": "number", "$value": 0.38 } } } }
```

| ID | Setup (violation or fixture) | Command | Expected result |
| --- | --- | --- | --- |
| Q1.1 | Repository source, unchanged | `pnpm tokens:validate` | Exit 0; zero violations across all permutations and all contexts |
| Q1.2 | Semantic token with a literal value (example above) | `pnpm tokens:validate` | Exit 1; points to `opacity.state.disabled` and rule V-02 (acceptance scenario 1) |
| Q1.3 | Name off the convention: segment `Surface_Raised` or first segment `colour` | `pnpm tokens:validate` | Exit 1; V-06 with the invalid segment (acceptance scenario 2) |
| Q1.4 | Alias to a nonexistent token, `"{color.blue.9999}"` | `pnpm tokens:validate` | Exit 1; V-03 with the unresolved reference |
| Q1.5 | Cycle: `color.fg.muted` → `{color.fg.subtle}` and `color.fg.subtle` → `{color.fg.muted}` | `pnpm tokens:validate` | Exit 1; V-03 with the full chain of the cycle |
| Q1.6 | Primitive in `src/primitive/color.tokens.json` with an alias to `{color.bg.surface}` | `pnpm tokens:validate` | Exit 1; V-04 (reference to a layer above) |
| Q1.7 | Schema error: nonexistent `$type` or token without `$value` | `pnpm tokens:validate` | Exit 1; V-01 with the JSON path and the position in the file |
| Q1.8 | `$ref` in a semantic token; group with `$root`; `$extends` in object form | `pnpm tokens:validate` | Exit 1; V-05 in each case |
| Q1.9 | Literal only in `src/semantic/brand/b.tokens.json` (for example, in `brand.color.bg.surface.dark`) and, in another run, an invalid name only in `src/semantic/mode/dark.tokens.json` | `pnpm tokens:validate` | Exit 1 in both cases, with the context (`b` or `dark`) pointed out. Proves that the rules run over all permutations, not only over the default (ADR-11 spike criterion) |
| Q1.10 | `color.fg.default` defined at the same time in `src/semantic/brand/a.tokens.json` and in `src/semantic/mode/dark.tokens.json`; in another run, a token under `brand.` without a mode id in the last segment | `pnpm tokens:validate` | Exit 1; V-07 or V-08 (mandatory form of FR-033) |
| Q1.11 | Remove all the semantic tokens of a category (for example, `z-index`) | `pnpm tokens:validate` | Exit 1; V-11 with the category without a semantic token (and V-03 for aliases that depended on them) |
| Q1.12 | A `size.control.<step>` step outside the closed scale of the convention, or a scale with different steps between permutations | `pnpm tokens:validate` | Exit 1; V-12 |
| Q1.13 | Primitive color within the sRGB gamut with a `hex` different from the 8-bit quantization of the `components` | `pnpm tokens:validate` | Exit 1; V-10 |
| Q1.14 | New file `apps/tokens-example/src/avulso.css` with `--brand-blue: #0055ff;`, added to the index with `git add` (the scan walks `git ls-files`) | `pnpm check:scan` | Exit 1; `file:line:column` of the declaration, even without the prefix (acceptance scenario 3). Other formats in CC-3 |
| Q1.15 | Repository source | `pnpm tokens:build` and reading `packages/tokens/dist/meta/report.md` | Exit 0; token count by category across the 11 categories, each with at least one semantic token, and the control-height scale resolved per brand × mode permutation (acceptance scenario 4) |

## 5. US2: consume generated tokens with brand and mode per subtree (P2)

Precondition: `pnpm tokens:build` with no error. The browser cases follow the 21 cases and the random
trees with a fixed seed of [research/css-scopes.md](research/css-scopes.md), now over the app
installed from the tarball. The comparison is exact-string, without normalizing whitespace, against the value
map of the tarball; any difference prints element, token, expected value, and obtained value.

| ID | Setup | Command | Expected result |
| --- | --- | --- | --- |
| Q2.1 | Repository source | `pnpm tokens:build` | Exit 0; section 3.1 artifacts, with `exports` and `.d.ts` per the CSS and ESM contracts |
| Q2.2 | Generated-CSS fixtures that break each generator rule | `pnpm tokens:build` (static audit of the generated CSS) and `pnpm test --filter=@<prefixo>/tokens-build` | Exit 0 with the repository source. The audit checks: in `brand-<id>.css`, every brand selector names only `<id>`; `:where(:root)` only in the default brand's file; `base.css` with no brand selector or brand-exclusive value; toggles with the literal `initial` or empty, never via `var()`; mode-axis tokens with no space between the two `var()`; every `var()` target declared; a public token declared only in the resolver or in the brand scope; everything in `@layer <prefixo>.tokens`. Each broken fixture gives exit 1 |
| Q2.3 | A page that imports `base.css` and `brand-a.css` | `pnpm test:e2e` | The bundle CSS has no `[data-<prefixo>-brand="b"]` selector or `b`-exclusive variable; the CSSOM scan across all elements finds no empty or invalid public token (acceptance scenario 1) |
| Q2.4 | A page that imports `base.css` and `brand-b.css`, with `data-<prefixo>-brand="b"` on `<html>` | `pnpm test:e2e` | No public token without a value; brand `b` in light mode |
| Q2.5 | A page with no attribute, with `base.css` and `brand-a.css` | `pnpm test:e2e` | `<html>` and descendants with the values of `a` and `light`; `color-scheme: light` |
| Q2.6 | An `a`/`light` element with an `data-<prefixo>-mode="dark"` descendant, a child, and a later sibling | `pnpm test:e2e` | Element and child with `a`/`dark` values; sibling back to `a`/`light` (acceptance scenario 2) |
| Q2.7 | An `a`/`dark` element with a `data-<prefixo>-brand="b"` descendant | `pnpm test:e2e` | `b`/`dark` on the element and on the child (the mode axis comes from the ancestor) |
| Q2.8 | Scopes `a` → `b` → `a`; brand alternation with four levels or more, followed by a mode-only scope | `pnpm test:e2e` | The innermost scope uses `a` with the mode of the nearest mode scope (acceptance scenario 3) |
| Q2.9 | `data-<prefixo>-brand="zzz"`, `data-<prefixo>-brand=""`, `data-<prefixo>-mode="sepia"`, and a brand present in the markup without imported CSS | `pnpm test:e2e` | The invalid axis keeps the value of the nearest valid ancestor; no public token is left without a value |
| Q2.10 | Pages that import `a` and `b` in both orders, with and without a brand attribute on the root | `pnpm test:e2e` | Identical results in both orders; the default brand applies in scopes without a brand attribute |
| Q2.11 | Switch and removal of attributes at runtime, on the root and in nested scopes | `pnpm test:e2e` | Values change without reloading (navigation counter unchanged) and without changing app code |
| Q2.12 | Non-color tokens in mode-only scopes: shadow with several layers, opacity, brand-axis dimension, invariant token, and component alias | `pnpm test:e2e` | Used values (`getComputedStyle` of real properties like `box-shadow` and `border-radius`) equal to those of the map |
| Q2.13 | Interleaved chain (`dark` > `b` > `a` > `light` > `b` > `dark`) and random trees with a fixed seed, with runtime mutations and a minified CSS variant | `pnpm test:e2e` | 100% of the values equal to the oracle (nearest scope of each axis) |
| Q2.14 | A token override without a layer, declared on the scope element | `pnpm test:e2e` | The override wins the `<prefixo>.tokens` layer (override pattern documented in the CSS contract) |
| Q2.15 | Project `tests/types-consumer`, installed from the tarball | `pnpm test:types` | Exit 0 in TS 6.0.x and 7.0.x, with `moduleResolution` `bundler` and `nodenext`. Positive cases with `expect-type` (literal types `var(--<prefixo>-…)`, never `any`); negative cases with `@ts-expect-error` for a nonexistent token in the `.` entry and for a nonexistent token, brand, and mode in `./values` (acceptance scenario 4) |
| Q2.16 | In `tests/types-consumer`, remove a `@ts-expect-error` from a negative case; in another run, swap the nonexistent name of a negative case for a name that exists | `pnpm test:types` | Non-zero exit code: in the first case, a type error on the nonexistent name; in the second, TS2578 (unused directive) |
| Q2.17 | Same source, two builds | `pnpm check:determinism` | See CC-1 (acceptance scenario 5) |

## 6. US3: add a brand without touching components (P3)

Precondition: the example app does not list brands in the code. It discovers the brands through the value
map of the tarball and loads `brand-<id>.css` on demand, which allows switching to a new brand
without changing the app. Automatic coverage: the `@<prefixo>/tokens-build` integration test copies the
source to a temporary worktree, adds `c`, generates the build, and checks the diff
(`pnpm test --filter=@<prefixo>/tokens-build`).

| ID | Setup | Command | Expected result |
| --- | --- | --- | --- |
| Q3.1 | In the worktree: context `c` in the `brand` modifier of `packages/tokens/src/tokens.resolver.json`; `src/semantic/brand/c.tokens.json` with the same keys as `a.tokens.json` and different synthetic values; primitives exclusive to `c` in `src/primitive/`, if any | `pnpm tokens:validate && pnpm tokens:build`, then `git status --porcelain` | Exit 0 in both; `dist/css/brand-c.css` generated and a value map with `c` × `light` and `dark`; `git status` lists only files in `packages/tokens/src/` and the regenerated `packages/tokens/api/tokens.api.json` (acceptance scenario 1; see the note below) |
| Q3.2 | In the same worktree, remove from `c.tokens.json` a key that `a` and `b` have (for example, `brand.color.fg.default.dark`); in another run, add a key that the other brands do not have | `pnpm tokens:validate` | Exit 1; V-13 points to the missing or excess key, the `c` context, and the affected permutations (acceptance scenario 2); the removal also breaks the dark-mode alias (V-03) |
| Q3.3 | Q3.1 worktree | `pnpm test:e2e` | The app switches between `c` and `a` at runtime; the values change without reloading the page and without a code change (acceptance scenario 3) |
| Q3.4 | Q3.1 worktree | `pnpm contrast:check` | Brand `c` enters the check with no change to the contrast manifest: exit 0 if the synthetic values reach the minimums, or exit 1 with the failing pairs in `c` |

Note: the public surface recorded in `api/tokens.api.json` includes the brand ids and the
list of brand files ([contracts/esm-output.md](contracts/esm-output.md), §11.3), so the
build regenerates it in the same PR, and `git status` also lists it. It is a derived artifact versioned on
purpose (QA-08), not a hand-edited file. Per the spec's Clarifications section, it is a token file
and enters the diff accepted by SC-005.

## 7. US4: guarantee contrast across all combinations (P4)

Inputs: `packages/tokens/contrast/manifest.json`, `packages/tokens/contrast/surfaces.json`, and the
contrast section of `quality/thresholds.json` (`{ "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }`).
Form of a pair (data-model fields, full format in the contract):

```json
{ "id": "fg-default-on-surface", "fg": "color.fg.default", "bg": ["color.bg.surface"], "state": "default", "kind": "text" }
```

Automatic coverage: `pnpm test --filter=@<prefixo>/color` (WCAG 2.2 luminance, alpha compositing,
round-trip of alpha serialization) and `pnpm test --filter=@<prefixo>/tokens-contrast` (manifest fixtures
for each scenario below).

Reference values for preparing violations with synthetic primitives (ratios truncated to two
places, as in the report):

| Foreground | Background | Ratio | Text (4.5) | Non-text (3) |
| --- | --- | --- | --- | --- |
| `#767676` | `#ffffff` | 4.54 | Passes | Passes |
| `#777777` | `#ffffff` | 4.47 | Fails | Passes |
| `#949494` | `#ffffff` | 3.03 | Fails | Passes |
| `#959595` | `#ffffff` | 2.99 | Fails | Fails |
| `#000000` with alpha 0.5 | `#ffffff` | 3.94: the smaller value between the floating-point compositing (3.976) and the variant rounded to 8 bits at each blend (3.949) | Fails | Passes |
| `#000000` | `#ffffff` | 21 | Passes | Passes |

| ID | Setup | Command | Expected result |
| --- | --- | --- | --- |
| Q4.1 | Repository manifest and source | `pnpm contrast:check` | Exit 0; JSON report and table ordered by pair, brand, and mode, with no timestamp; exempt pairs appear measured and marked as non-blocking |
| Q4.2 | In the worktree, point the primitive of `brand.color.fg.default.light` of brand `a` to `#777777`, with `color.bg.surface` at `#ffffff` in light mode | `pnpm contrast:check` | Exit 1; points to the pair, brand `a`, mode `light`, ratio 4.47, and minimum 4.5 (acceptance scenario 1) |
| Q4.3 | A focus-indicator `non-text` pair (for example, `color.border.focus` over `color.bg.surface`) with the focus primitive at `#959595` | `pnpm contrast:check` | Exit 1; ratio 2.99 below 3 (acceptance scenario 2) |
| Q4.4 | A text pair with foreground `#000000` alpha 0.5 over surface `#ffffff`; then, the same pair as `non-text` | `pnpm contrast:check` | As text: exit 1, with ratio 3.94 computed over the composited color (without compositing, the ratio would be 21 and the pair would pass). As non-text: exit 0 (acceptance scenario 3) |
| Q4.5 | Background stack with a translucent base; empty surface set in a mode | `pnpm contrast:check` | Exit 1; V-16 |
| Q4.6 | A `state: "disabled"` pair with `exempt: "wcag-inactive"` below the minimum; in another run, the same `exempt` with `state: "default"` | `pnpm contrast:check` | First: exit 0, the pair reported as exempt with the measured ratio. Second: exit 1, since the exemption only applies to `disabled` and `inactive` |
| Q4.7 | An any-of group of a focus indicator crossing the border, with one member above 3 and another below; in another run, both below | `pnpm contrast:check` | First: exit 0, with both members reported. Second: exit 1 |
| Q4.8 | A translucent foreground over a surface set (`@surfaces`) in which one of the surfaces fails | `pnpm contrast:check` | Exit 1; one measured case per surface, with the failing surface pointed out |
| Q4.9 | `fg` with a nonexistent reference in a permutation; in another run, `fg` pointing to a primitive | `pnpm contrast:check` | Exit 1; V-14 in the first case and the manifest reference rule in the second |
| Q4.10 | `quality/thresholds.json` with `"text": 4`, keeping `"level": "WCAG22-AA"` | `pnpm contrast:check` | Exit 2; a minimum incoherent with the declared level is a configuration error, so it cannot be silently lowered |
| Q4.11 | Fixtures of the `<prefixo>/contrast-pairs` rule: valid and invalid, including a pair in `disabled` state missing from the manifest and a non-resolvable expression | `pnpm test --filter=@<prefixo>/stylelint-plugin` | Exit 0 only if the findings match the annotations (multiset `{file, line, column, code}`); a pair missing from the manifest is an error (acceptance scenario 4) |
| Q4.12 | In the worktree, copy an invalid pairs fixture into the set governed by the gate configuration | `pnpm lint:styles` | Non-zero exit code (Stylelint: 2), with the missing pair pointed out |
| Q4.13 | Samples rendered from the tarball, one per pair × brand × mode, with the opaque stack painted on real ancestors | `pnpm test:e2e` | `getComputedStyle` equal to the sRGB emitted by `toEmittedSrgb()`; axe with no contrast violation in the non-exempt pairs |

## 8. US5: block styles outside the tokens (P5)

The `<prefixo>/design-tokens` rule is driven by `dist/meta/tokens.manifest.json`, generated from the
synthetic brands; turbo runs `pnpm tokens:build` first. The subcodes and the fixture annotation syntax
are in [contracts/lint-rules.md](contracts/lint-rules.md). In this feature, the registry of
interactive controls is fixture-only; the production one will be derived from the DOM contract (CMP-14) or from the
guidance file, in the components feature.

An illustrative, incomplete invalid fixture (token names as examples only). The comments
`expect:` omit the column for brevity; in the real fixtures the form is `code@column`, with all
the warnings of the file listed ([contracts/lint-rules.md](contracts/lint-rules.md), section 5):

```css
.<prefixo>-fixture-card {
  color: var(--<prefixo>-color-blue-500);                      /* expect: primitive-token */
  background: var(--<prefixo>-brand-color-bg-surface-light);   /* expect: brand-mode-source-token */
  padding: 16px;                                               /* expect: literal-value */
  border-radius: var(--<prefixo>-radius-control-default, 4px); /* expect: var-fallback-literal */
  --brand-blue: #0055ff;                                       /* expect: token-definition */
  border-color: var(--brand-blue);                             /* expect: unknown-token */
}
.<prefixo>-fixture-button--sm { block-size: var(--<prefixo>-size-icon-md); } /* expect: control-height */
.<prefixo>-fixture-switch { padding-block: var(--<prefixo>-space-inset-sm); } /* expect: control-height-missing */
.<prefixo>-fixture-novo { color: var(--<prefixo>-color-fg-default); }        /* expect: unclassified-component */
```

In the fixture registry, `button` (with the `--sm` modifier) and `switch` are controls, `card` is not a
control, and `novo` is not classified.

| ID | Setup | Command | Expected result |
| --- | --- | --- | --- |
| Q5.1 | The rule's `valid/` and `invalid/` fixtures, with the fixture registry | `pnpm test --filter=@<prefixo>/stylelint-plugin` | Exit 0 only with 100% of the expected errors and zero false positives (multiset `{file, line, column, code}`); also fails if any subcode has no invalid fixture |
| Q5.2 | `var()` of a primitive token in a component style | Covered by Q5.1; demonstration by Q5.7 | `primitive-token` (acceptance scenario 1) |
| Q5.3 | Literal color, space, or radius; `var()` with a literal fallback; custom property without a prefix and its use | Covered by Q5.1 | `literal-value`, `var-fallback-literal`, `token-definition`, and `unknown-token` (acceptance scenario 2) |
| Q5.4 | Source token `brand.<category>….<mode>` in a component style | Covered by Q5.1 | `brand-mode-source-token` |
| Q5.5 | Control height with a token outside the scale, on the root class and on a size modifier; a control sized only by `padding-block`, without a scale height; a root class outside the registry | Covered by Q5.1 | `control-height`, `control-height-missing`, and `unclassified-component` (acceptance scenario 3) |
| Q5.6 | A file with only semantic and component tokens, allowlist keywords (`transparent`, `currentcolor`, `0`, `auto`, `none`, and the CSS globals) and `calc(var(--<prefixo>-space-inset-md) * -1)` | Covered by Q5.1 | Zero findings (acceptance scenario 4) |
| Q5.7 | In the worktree, copy an invalid fixture into the governed set, with `/* stylelint-disable */` at the top | `pnpm lint:styles` | Non-zero exit code (Stylelint: 2). The comment does not bypass the gate (`ignoreDisables`, `--max-warnings 0`), and the JSON report lists the findings |
| Q5.8 | The repository's governed set (in this feature, only valid fixtures; the core enters in the components feature) | `pnpm lint:styles` | Exit 0 and a JSON report with zero violations |

## 9. US6: keep the design tool synced (P6)

All scenarios use the `memory` adapter. Without `--memory-state`, each CLI run with
`--adapter memory` starts from an empty tool. Scenarios that depend on state between two
syncs run in the contract suite (`pnpm test --filter=@<prefixo>/design-sync`), which uses the
same core, the `InMemoryDesignTool` with fault injection, the tracker, and the in-memory alert. Through the
CLI, the same scenarios can be chained by hand with `--memory-out <file>` in one run and
`--memory-state <file>` in the next ([contracts/tools-cli.md](contracts/tools-cli.md), section 5.1). Entities and states: data-model ("Design-tool variable",
"Sync run", "Divergence").

**CLI with the fake**

| ID | Setup | Command | Expected result |
| --- | --- | --- | --- |
| Q6.1 | `pnpm tokens:build` done | `pnpm design-sync -- plan --adapter memory` | Exit 0; ordered plan (collections, modes, variables, values, removals), with no write. Collections: Primitives (no modes), Brand (modes `a` and `b`), Mode (`light` and `dark`), Invariant semantics, and Components; zero auxiliary variables |
| Q6.2 | Same | `pnpm design-sync -- apply --adapter memory` | Exit 0; run `verified` (verify with an empty diff). Log in canonical JSON with `changes[]` (variables created, ordered by path), empty `restored[]`, and `digests`; timestamp and URL only in the envelope (acceptance scenario 1) |
| Q6.3 | Same | `pnpm design-sync -- detect --adapter memory` | Exit 1 against the empty tool; one `missing` divergence per variable, each with a `fingerprint`, `owner` (the sync owner role read from the owners file), and `due` (detection plus the SLA from the versioned configuration), recorded in the in-memory tracker (acceptance scenario 4) |
| Q6.4 | Same | `pnpm design-sync -- check-access --adapter memory` | Exit 0; the fake's capabilities printed (modes per axis, scope per frame, write, and publish) |
| Q6.5 | In the worktree, remove from the owners file the line of the sync owner role | `pnpm design-sync -- detect --adapter memory` | Exit 2 (configuration); no item is created without an assignee |

**Contract suite** (`pnpm test --filter=@<prefixo>/design-sync`; exit 0 with all cases)

| ID | Case | Expected result |
| --- | --- | --- |
| Q6.6 | `simulateManualEdit` on a variable after a sync | The next sync restores the source value and records the occurrence in `restored[]`, separated from a release change by the comparison with the previous and current version (acceptance scenario 2) |
| Q6.7 | `simulateRename` and `simulateExtraVariable` | Variable renamed back by the token key, without recreating; an extra variable in a managed collection removed and recorded |
| Q6.8 | A `$type` change of a token between versions | Recreation marked in the log |
| Q6.9 | Name, hierarchy, and value divergences planted in the fake | Report with types `name`, `hierarchy`, and `value`; after the sync, zero name and hierarchy differences, comparing arrays of normalized segments |
| Q6.10 | Capability `maxModesPerAxis` lower than the number of brands | Limit and topology recorded in the run report; no collection that combines brand and mode is created |
| Q6.11 | `faults.failAfterOperations(n, …)` (fails after N operations) | Run `failed` with an alert; the next run converges and records the repaired items |
| Q6.12 | Expired credential or 403 in `checkAccess`; 429 with `Retry-After` | Credential: the CLI exits with 4 and the alert goes to the owner role (FR-026). 429: the run respects `Retry-After` and completes |
| Q6.13 | Verify with a non-empty diff after the `apply` | The CLI exits with 5; run `failed`; alert to the owner role (acceptance scenario 5) |
| Q6.14 | The same divergence in two detections in a row; then, an empty diff | Item deduplicated by the `fingerprint` and closed on its own when the next run sees an empty diff |
| Q6.15 | The core run twice with the same inputs | Plan and log byte-for-byte identical, outside the envelope |
| Q6.16 | Capability `write: manual` or `publish: manual` | A trackable item with an assignee and due date, instead of a silent failure |
| Q6.17 | Architecture test | `DesignToolPort` has no operation that reads from the tool into the repository, and `tools/design-sync` does not write to `packages/tokens/src` (acceptance scenario 6) |

**Workflow inspection** (Q6.18): `.github/workflows/design-sync.yml` triggers after promotion to the main
tag, by weekly `schedule`, and by `workflow_dispatch` (until ENG-26 exists), in the same
`concurrency` group. Third-party actions are pinned by SHA. Secrets stay only in the environments
`design-sync-read` and `design-sync-write`. There is no `pull_request` or `pull_request_target` trigger, and
no step commits or pushes to the repository.

Acceptance scenario 3 (switch only the brand or only the mode of a frame without relinking layers) has only the
topology part validated with the fake: brand and mode in separate collections and every variable
corresponding to a real token (Q6.1, Q6.9). The per-frame switch depends on the tool (section 11).

## 10. Cross-cutting checks

| ID | Check | Command | Expected result and intentional violation |
| --- | --- | --- | --- |
| CC-1 | Determinism | `pnpm check:determinism` | Exit 0: two builds from two clean `git worktree`s of `HEAD`, in different paths, `TZ`, and `LC_ALL`, with no task cache, packaged with `pnpm pack`; sha256 equal per file and between the tarballs. A divergence: exit 1, with the first different file and the diff. Uncommitted changes are out. Self-test with a non-deterministic fixture in `pnpm test --filter=@<prefixo>/repo-checks`. Nightly, CI repeats the comparison between runners and between Node 22 and the latest in the matrix |
| CC-2 | Drift of generated files | `pnpm check:drift` | Exit 0: `git ls-files` lists no generated file or file with a generated header, and the regenerated `api/tokens.api.json` has no diff. Violations: `git add -f packages/tokens/dist/css/base.css` gives exit 1 (hand-edited token CSS edge case); editing `api/tokens.api.json` by hand gives exit 1 with the diff. Removing or renaming a token appears as a diff of that report; the SemVer check (GOV-01) belongs to the CI feature |
| CC-3 | FR-001 scan | `pnpm check:scan` | Exit 0 in the repository. Each violation below, added to the git index, gives exit 1 with `file:line:column`: a custom property with a literal in CSS (with and without prefix), in an SFC `.vue` `<style>`, and in an HTML `style=`; a `"--<prefixo>-…"` key in JSON; `setProperty('--<prefixo>-…', …)` in TS or JS; a DTCG document (`$value`) outside `packages/tokens/src`. A `quality/scan-allowlist.json` entry without a justification: exit 2 |
| CC-4 | Layer boundaries | `pnpm check:layers` | Exit 0 with `turbo boundaries` (tags `tokens`, `tools`, and `apps` from `turbo.json`) and `repo-checks layers` (pnpm manifest). Each violation gives exit 1 with the edge: `tools/color` with a workspace dependency; `@<prefixo>/tokens` in `dependencies` (not dev) of `tools/stylelint-plugin` or `tools/design-sync`; a package without exactly one layer tag; `workspace:` in `apps/tokens-example` or `tests/types-consumer`; an import of a file outside the package; `@boundaries-ignore` outside the exceptions registry |
| CC-5 | Types and exports | `pnpm test:types` | Q2.15 and Q2.16, plus `publint` with no error over the tarball |
| CC-6 | Tarball content | `pnpm -C packages/tokens pack --pack-destination "$TMPDIR/patods-pack"` and `tar -tzf` on the generated `.tgz` | The tarball contains only the versioned allowlist files (ENG-17): `package.json`, `dist/css/base.css`, `dist/css/brand-<id>.css`, `dist/esm/index.js`, `index.d.ts`, `values.js`, `values.d.ts`, `dist/meta/*`, README, and third-party notices (ENG-22). The `package.json` has `exports` for `.`, `./values`, `./css/base.css`, `./css/brand-*.css`, and `./meta/*`; `sideEffects: ["**/*.css"]`; no `dependencies`; no install script; `license` per the premise (`UNLICENSED` provisional). The tool packages are `private: true` and generate no publishable tarball |
| CC-7 | Unit tests | `pnpm test` | Exit 0; Vitest only in a Node environment; the QA-02 script fails when a logic module has no test file; the coverage threshold is read from `quality/thresholds.json` (value `<N>` pending) |
| CC-8 | Frozen install and scripts | `pnpm install --frozen-lockfile` | Violations: a version changed in a `package.json` without updating the lockfile fails with `ERR_PNPM_OUTDATED_LOCKFILE` (ENG-16); a fixture dependency with a `postinstall` outside `allowBuilds` makes the install fail (ENG-24) |
| CC-9 | Schema and license integrity | `pnpm tokens:validate`; `pnpm licenses list -r --json` | A changed byte in `schemas/dtcg-2025.10/format.json` makes the validation exit with 2 (the `SHA256SUMS` check). The tree's licenses are compared with `quality/license-policy.json` (MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, MIT-0, CC0-1.0, Python-2.0, MPL-2.0 only as a development dependency, W3C for the schemas, and the reviewed `svg-tags` override) |
| CC-10 | Traceability | Section 12 table | Each row becomes an entry in the ACE-02 traceability matrix (FR-031), linked to the CI job or the retained evidence |

## 11. What cannot be validated yet

- **Real design tool** (pending requester decision): real adapter; contract suite
  against a sandbox file nightly; switching only the brand or only the mode of a frame without relinking layers
  (US6, acceptance scenario 3, FR-029); real plan mode limits; library publishing, which
  is manual in Figma; a static credential with an owner and rotation (ENG-13); a spike of the MCP path on
  Professional and Organization plans. Today only the core, the topology, and the fake apply.
- **Real notification of the owner role** (FR-026): proof in a sandbox with a GitHub App token. It depends on
  the platform confirmation and the organization configuration (assignee field in the items).
- **"Published version" trigger** (FR-025, FR-030): depends on the publishing pipeline (ENG-26, CI
  feature). Until then, the sync owner triggers the workflow by hand, with the same log. The weekly
  run (SC-011) is only proven with the run history on the platform.
- **Lint and pair check in the core** (FR-021, FR-024): the core is born in the components feature.
  Today there are only fixtures and a fixture control registry; the zero-violations report in the core and
  the registry derived from the DOM contract (CMP-14) are left for there.
- **Real brands** (TOK-07, CMP-24): list, values, default brand, number of brands against the tool's mode
  limit, and an eventual wide-gamut palette (deterministic mapping to sRGB to be accepted). SC-005 and SC-008 with real
  brands depend on that delivery; today synthetic `a` and `b` apply.
- **Real prefix**: final names of variables, attributes, layer, and scope of the registry (ENG-20).
- **TOK-12** (FR-032): out of the plan until the requester's answer.
- **Browser list** (ENG-08): CSS compatibility lint and the definitive engines of the nightly and
  pre-publish runs.
- **Node and TypeScript floors** (ENG-08): the matrix uses Node 22 and 26 and TS 6.0 and 7.0 as provisional
  premises.
- **React and Vue**: nested-theme, SSR, and portal tests (TOK-14 partial, CMP-21) and React and Vue example
  apps (QA-06 partial) stay in the components feature.
- **Pending thresholds** (QA-14): QA-07 bundle budget (the CSS size per brand is measured,
  without a threshold) and QA-03 coverage (`<N>`%).
- **Full ENG-01 and remote cache**: import rules in ESLint with `.vue` fixtures and the ENG-03 remote
  cache arrive with the CI feature.
- **Interpretations to confirm with the acceptor**: the operational definition of "variable without a value"
  (ENG-06) and whether the regenerated `api/tokens.api.json` counts toward SC-005 (Q3.1).

## 12. Scenario → requirement mapping

| Scenario | User story and acceptance scenario | FR | SC | Other IDs |
| --- | --- | --- | --- | --- |
| Q1.1 | US1 | FR-002, FR-003, FR-004, FR-005 | SC-001 | TOK-01, TOK-02, TOK-04 |
| Q1.2 | US1, scenario 1 | FR-003 | SC-001, SC-009 | TOK-02 |
| Q1.3 | US1, scenario 2 | FR-005 | SC-001, SC-009 | TOK-04 |
| Q1.4, Q1.5, Q1.6 | US1, edge cases | FR-004 | SC-001 | TOK-01, TOK-02 |
| Q1.7 | US1 | FR-002 | SC-001 | TOK-01 |
| Q1.8 | US1 | FR-002, FR-004, FR-005 | SC-001 | TOK-02 |
| Q1.9 | US1 | FR-003, FR-004, FR-005 | SC-001, SC-009 | TOK-02, TOK-04 |
| Q1.10 | US1 | FR-011, FR-033 | SC-004 | TOK-09, DSN-04, DSN-05 |
| Q1.11 | US1 | FR-006 | SC-003 | TOK-10 |
| Q1.12 | US1 | FR-007 | — | TOK-13 |
| Q1.13 | US1 | FR-020 (measured value equal to the emitted) | SC-008 | A11Y-09 |
| Q1.14, CC-3 | US1, scenario 3 | FR-001 | SC-001 | TOK-01 |
| Q1.15 | US1, scenario 4 | FR-006, FR-007, FR-008 | SC-003 | TOK-10, TOK-13 |
| Q2.1, Q2.2 | US2 | FR-010, FR-013, FR-015, FR-016, FR-017 | SC-006 | TOK-05, TOK-06, TOK-08, ENG-06 |
| Q2.3, Q2.4 | US2, scenario 1 | FR-013, FR-017, FR-018 | SC-006 | ENG-06, QA-06 (partial) |
| Q2.5 | US2, edge case | FR-013 | SC-006 | CMP-24 |
| Q2.6, Q2.7, Q2.8 | US2, scenarios 2 and 3 | FR-012 | SC-007 | TOK-14 |
| Q2.9 | US2, edge case | FR-014 | SC-006 | ENG-06 |
| Q2.10 | US2, edge case | FR-013, FR-017 | SC-006 | ENG-06 |
| Q2.11 | US2 | FR-010, FR-018 | — | TOK-07, TOK-08, TOK-14 |
| Q2.12, Q2.13 | US2 | FR-012 | SC-007 | TOK-14 |
| Q2.14 | US2 | FR-012 | — | ADR-03, MIG-14 |
| Q2.15, Q2.16, CC-5 | US2, scenario 4 | FR-016 | SC-009 | TOK-06, QA-08, ENG-05 |
| Q2.17, CC-1 | US2, scenario 5 | FR-015 | SC-002 | TOK-05 |
| Q3.1 | US3, scenario 1 | FR-009 | SC-005 | TOK-07 |
| Q3.2 | US3, scenario 2 | FR-011 | SC-004, SC-009 | TOK-09 |
| Q3.3 | US3, scenario 3 | FR-009, FR-018 | — | TOK-07 |
| Q3.4 | US3 | FR-011, FR-020 | SC-004, SC-008 | A11Y-09 |
| Q4.1 | US4 | FR-019, FR-020 | SC-008 | A11Y-01, A11Y-09 |
| Q4.2 | US4, scenario 1 | FR-020 | SC-008, SC-009 | A11Y-09 |
| Q4.3 | US4, scenario 2 | FR-020 | SC-008, SC-009 | A11Y-09 |
| Q4.4 | US4, scenario 3 | FR-020 | SC-008 | A11Y-09 |
| Q4.5 to Q4.9 | US4 | FR-019, FR-020 | SC-008 | A11Y-01, A11Y-09 |
| Q4.10 | US4 | FR-020 | — | QA-14, A11Y-01 |
| Q4.11, Q4.12 | US4, scenario 4 | FR-021 | SC-009 | A11Y-09 |
| Q4.13 | US4 | FR-020 | SC-008 | QA-01 |
| Q5.1, Q5.8 | US5 | FR-024 | SC-009 | TOK-03 |
| Q5.2 | US5, scenario 1 | FR-022 | SC-009 | TOK-03 |
| Q5.3 | US5, scenario 2 | FR-001, FR-022 | SC-009 | TOK-03 |
| Q5.4 | US5 | FR-022, FR-033 | SC-009 | TOK-03 |
| Q5.5 | US5, scenario 3 | FR-007, FR-023 | SC-009 | TOK-13 |
| Q5.6 | US5, scenario 4 | FR-022, FR-024 | SC-009 | TOK-03 |
| Q5.7 | US5 | FR-024 | SC-009 | TOK-03 |
| Q6.1 | US6 | FR-025, FR-028, FR-029, FR-033 | SC-010 | DSN-01, DSN-04, DSN-05 |
| Q6.2 | US6, scenario 1 | FR-025 | SC-010 | DSN-01 |
| Q6.3 | US6, scenario 4 | FR-030 | SC-011 | DSN-11 |
| Q6.4, Q6.10 | US6, edge case | FR-029 | — | DSN-05 |
| Q6.5 | US6 | FR-026, FR-030 | SC-011 | DSN-02 |
| Q6.6 | US6, scenario 2 | FR-027 | SC-010 | DSN-03 |
| Q6.7, Q6.8, Q6.9 | US6 | FR-027, FR-028 | SC-010 | DSN-03, DSN-04 |
| Q6.11 | US6, edge case | FR-025, FR-027 | SC-010 | DSN-03 |
| Q6.12, Q6.13 | US6, scenario 5 | FR-026 | — | DSN-02, ENG-13 |
| Q6.14 | US6, scenario 4 | FR-030 | SC-011 | DSN-11 |
| Q6.15 | US6 | FR-025 | — | Principle I |
| Q6.16 | US6 | FR-025, FR-029 | — | DSN-01 |
| Q6.17 | US6, scenario 6 | FR-025 | — | DSN-01 |
| Q6.18 | US6 | FR-025, FR-030 | SC-011 | DSN-01, DSN-11, ENG-14, ENG-18 |
| CC-2 | Edge case (hand-edited CSS) | FR-015 | — | TOK-05, QA-08, GOV-01 |
| CC-4 | — | — | — | ENG-01 |
| CC-6 | — | FR-016, FR-017 | — | ENG-04, ENG-17, ENG-22 |
| CC-7 | — | — | — | QA-02 |
| CC-8 | — | — | — | ENG-16, ENG-24 |
| CC-9 | — | FR-002 | — | ENG-21 |
| CC-10 | — | FR-031 | — | ACE-02 |

FR-032 (TOK-12) has no scenario: the requirement is Desirable and was not contracted.
