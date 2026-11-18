# Constitution conformance review (feature 001)

**Feature**: 001-design-tokens-themes | **Task**: T083 | **Date**: 2026-11-17
**Basis**: built and committed state at HEAD `108e560` (not design intent). Checklist: plan.md "Constitution Check" (14 questions, Constitution "Spec Kit Workflow").
**Evidence base**: [quickstart-results.md](quickstart-results.md) (ACE-01, 17 of 17 gates exit 0, US1 to US6 accepted, commit `af9c703`), repository files, `.github/workflows/`, `quality/`.
**Status of this document**: SIGNED OFF by the owner on 2026-11-18 — see "SIGN-OFF RECORD" at the end. (Originally a prepared recommendation; the sign-off actions have since been applied.)

Verdict scale: PASS = satisfied by built and committed state within feature scope (or not applicable because no component exists yet, stated explicitly). CONCERN = partially satisfied or resting on deferred work; the missing item is named.

Totals: 7 PASS, 7 CONCERN.

## Review table

| # | Question (Constitution principle) | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Token data comes from the declared sources and consumers use derived output, no hand copy? (I) | PASS | Single DTCG source in `packages/tokens/src/`; CSS, ESM, manifests, API report derived (`packages/tokens/dist/`, git-ignored; `check:drift` exit 0 proves no generated file is tracked). `check:scan` exit 0 (FR-001, no token outside the source). `check:determinism` exit 0 (byte-identical builds). quickstart-results.md rows US1, US2. Scope note: the component catalog and API-contract sources do not exist yet (later features); the answer covers token data only. |
| 2 | Styles consume only semantic/component tokens; sync follows the current direction with divergences detected? (II) | CONCERN | Lint rule `patods/design-tokens` (codes `primitive-token`, `literal-value`, `brand-mode-source-token`) proven by valid/invalid fixtures and `lint:styles` exit 0, plus CI gate-probe step in `tokens-ci.yml`. Sync: repository-to-tool direction implemented behind a port with the in-memory adapter only (`tools/design-sync`, US6 contract suite, ADR-14). MISSING: (a) the lint rule is applied to no real component style, because the core does not exist; (b) no real design-tool adapter, so DSN-03 restore, weekly and per-version detection (DSN-11) are exercised only against the fake; `design-sync.yml` has never run against a real tool (quickstart-results.md "Not validatable"). |
| 3 | Framework packages without CSS, core without selector over headless attributes, interactives on headless primitives? (III) | PASS | Not applicable directly: no components, no core, no framework package exist. Token CSS stays in `@patods/tokens`, inside `@layer patods.tokens` with the `patods` prefix (`packages/tokens/dist/css/base.css` line 1). `packages/{core,react,vue}` do not exist. |
| 4 | API, DOM, and React/Vue behavior parity maintained? (IV) | PASS | Not applicable: no component exists. Tokens are framework-neutral (CSS attributes plus ESM). React/Vue nested-theme tests belong to the components feature (plan.md row 4). |
| 5 | Accessibility tests, token contrast, conformance declaration, exceptions recorded? (V) | CONCERN | Token contrast: `pnpm contrast:check` exit 0, 16 cases (4 exempt), 12 passed, 0 failed, over `packages/tokens/contrast/manifest.json` (A11Y-09), plus rendered contrast samples in e2e. MISSING: (a) the 4 exempt cases use `exempt: "wcag-inactive"` in the manifest, not an A11Y-11 exception record with owner and deadline; the owner should confirm this exemption path satisfies A11Y-11; (b) the check that every pair used in the core appears in the manifest cannot run until the core exists; (c) rules-engine, keyboard, focus, reflow, target-size tests and conformance declarations are component items (not yet applicable). |
| 6 | SSR, RSC, CSP, i18n, provider-less usage valid? (VI) | PASS | Pure CSS selected by attributes; no JS and no injected style. Default brand and light mode without a provider or attribute covered by e2e (FR-013, quickstart US2 Q2.x, 27 Playwright cases). Scope note: no SSR/RSC/CSP run was performed because there is no component to render. |
| 7 | Real-browser tests, required engine matrix, thresholds from the QA-14 file? (VII) | CONCERN | Real browser: Playwright, example app consumes the packed tarball (`test:e2e` exit 0, 27 passed). Contrast minimums read from `quality/thresholds.json`. Workflow defines Chromium on PR and Chromium/Firefox/WebKit nightly (`tokens-ci.yml` jobs `e2e`, `nightly-e2e`). MISSING: (a) only Chromium was exercised (quickstart-results.md); Firefox and WebKit have no recorded green run; (b) `tokens-ci.yml` has no recorded run on the remote (no CI run evidence in the repository); (c) the QA-14 bundle thresholds (QA-07) were descoped by the owner (2026-11-18, not pursued); the QA-03 coverage threshold value remains pending. |
| 8 | Agent data from the catalog; tools read-only, no network or credentials? (VIII) | PASS | Not applicable: no catalog, MCP or CLI in this feature. Manifests (`dist/meta/*`) are a future catalog input (plan.md row 8). The build uses no network (remote `$ref` blocked, per ADR-11). |
| 9 | Dependencies, secrets, publishing, assets follow the supply chain? (IX) | CONCERN | In place: exact pins via `pnpm-workspace.yaml` catalog with `catalogMode: strict`; `minimumReleaseAge: 1440`, `blockExoticSubdeps`, `trustPolicy: no-downgrade`, `strictDepBuilds` and `allowBuilds` allowlist (ENG-16, ENG-24); frozen install (quickstart row 1); `check:licenses` exit 0 against `quality/license-policy.json` (ENG-21); `sbom:generate` exit 0; workflow actions use 40-hex SHA digests (ENG-18). MISSING: (a) the header comment of `tokens-ci.yml` still says "The SHAs below are placeholders; the CI and governance feature pins the real digests"; the digests are unverified against the upstream tags until that feature runs; (b) publishing, provenance attestation, scope reservation, secrets inventory, remote cache restriction (ENG-03, ENG-09, ENG-13, ENG-14, ENG-15, ENG-20, ENG-26, ENG-27) are deferred to the CI and publishing feature; (c) the new direct dependency `@humanwhocodes/momoa` requires owner approval (ENG-25), see "Dependencies added". |
| 10 | SemVer, stage, and deprecation respected? (X) | CONCERN | Token API report emitted and drift-checked (`packages/tokens/api/tokens.api.json`, `check:drift` exit 0, quickstart CC-2). Traceability matrix marks GOV-01 as `planned` (`quality/traceability.json`). MISSING: the major/minor comparator that blocks a break without a major increment (GOV-01) does not exist; it is assigned to the CI and publishing feature. Until then a token removal is visible as a report diff but not blocked. Package version is `0.0.0` and no stage or deprecation case exists yet. |
| 11 | Layer boundaries valid? (XI) | PASS | `turbo.json` tags `tokens`, `tools`, `apps`; `check:layers` exit 0 (`turbo boundaries` plus `tools/repo-checks/src/layers.ts`: tools may depend on UI only as devDependency, `tools/color` a leaf). quickstart-results.md CC-4 PASS; US6 architecture test. Scope note: `core` and framework layers are added when created (ACE-08). |
| 12 | Coexistence with legacy conflict-free? (XII) | CONCERN | Prefix `patods` on variables and attributes, `@layer patods.tokens` (`dist/css/base.css`), single-source layer order (ADR-13). MISSING: no test places the token CSS beside legacy CSS on one page, and the legacy-wrapping guide and layer-order publication (MIG-07, MIG-14) are not delivered; the prefix is provisional (see 14). Conflict-freedom is by construction, not by evidence. |
| 13 | Documentation covers React/Vue, generated from the catalog, examples compile, README per package, valid links? (XIII) | PASS | `packages/tokens/README.md` has purpose, installation, minimal usage and links to the spec and contracts (DOC-08). `check:naming-doc` exit 0 keeps the naming document and validator in sync. Scope note: site, React/Vue pages, catalog-generated fundamentals and link checking (DOC-01, DOC-05, DOC-12) belong to the docs feature, per plan.md row 13. The README HTML snippet uses a bare package specifier in `href`; it is illustrative only and is not compiled or link-checked. |
| 14 | In scope and Inventory, priority respected, premises cited? (Constraints) | CONCERN | Premises are cited in spec, research and ADR-11..ADR-16; TOK-12 (FR-032) is recorded `deferred` and not built (`quality/traceability.json`); no requester decision was taken. MISSING: values that depend on requester decisions remain provisional and must be replaced by the owner: prefix `patods` (Constitution `TODO(PREFIXO)`), brands `a` and `b`, number of brands N, license `UNLICENSED`, browser list, Node/TypeScript floors (the QA-07 bundle budget was descoped, 2026-11-18). |

## Dependencies added (ENG-25)

| Item | Finding | Evidence |
| --- | --- | --- |
| Package | `@humanwhocodes/momoa`, used to capture JSON source positions (manifest `source`, V-01 diagnostics) | `tools/tokens-build/package.json` line 17 and `tools/tokens-contrast/package.json` line 14 (both `"catalog:"`) |
| Direct dependency | Yes, declared directly by two private tool packages | same files |
| Exact pin | Yes: `3.3.13` (no range operator), single version enforced by `catalogMode: strict` | `pnpm-workspace.yaml` line 23; `pnpm-lock.yaml` entry `'@humanwhocodes/momoa@3.3.13'` |
| License | `Apache-2.0`, listed in `allowed` of `quality/license-policy.json`; installed `package.json` reports `"license": "Apache-2.0"` | `quality/license-policy.json`; `check:licenses` exit 0 (quickstart-results.md row 38) |
| Enforcement | `check:licenses` (ENG-21) runs in `tokens-ci.yml` | `.github/workflows/tokens-ci.yml` |
| Shipped to consumers | No; build-time dependency of private tool packages. `@patods/tokens` has no `dependencies` | `policy notes` in `quality/license-policy.json`; quickstart CC-6 |
| Approval | Acknowledged by the owner on 2026-11-18 (ENG-25). | see SIGN-OFF RECORD |

## OWNER SIGN-OFF REQUIRED

These were owner actions. They have now been applied — see "SIGN-OFF RECORD" below. (When this review was written, no ADR status had been changed and nothing recorded an approval.)

To accept feature 001, the owner must:

(a) Move ADR-11 through ADR-16 from Proposto (Proposed) to Aceito (Accepted), including the status table in `docs/adr/README.md`:

| ADR | One-line decision |
| --- | --- |
| ADR-11 | Token source is DTCG 2025.10 in `packages/tokens/src/` with a Resolver, compiled by an own build pipeline (`@patods/tokens-build`) into per-brand CSS, typed ESM and manifests. |
| ADR-12 | Monorepo on pnpm 11.28.x and Turborepo with exact pins, `catalogMode: strict`, a script allowlist, a release-age delay and layer tags. |
| ADR-13 | Brand and mode are independent CSS scopes via `data-<prefix>-brand` and `data-<prefix>-mode`, in pure CSS under `@layer <prefix>.tokens`, one importable file per brand. |
| ADR-14 | Design-tool sync is a one-way (repository to tool) ports-and-adapters CLI `@patods/design-sync`, tool-agnostic, shipped with an in-memory adapter. |
| ADR-15 | Color engine is `colorjs.io` 0.7.1 in a leaf package; colors are emitted as gamut-mapped 8-bit sRGB, and contrast is measured on the emitted value over a versioned pair manifest. |
| ADR-16 | Token lint is a stylelint plugin rule `<prefix>/design-tokens` driven by the token manifest; tests run in real browsers (Playwright) against the packed tarball. |

(b) Acknowledge the new direct dependency `@humanwhocodes/momoa` 3.3.13 (Apache-2.0, exact pin, build-time only) as required by ENG-25.

Out of scope for 001 acceptance: ADR-17 (Storybook, feature 002) is referenced only; its status is not part of this sign-off.

Recommended owner follow-ups, not blockers by themselves (they are the CONCERN items above): confirm the `wcag-inactive` exemption path versus A11Y-11 (Q5); confirm that Chromium-only evidence and the unrun remote CI are acceptable for accepting the feature (Q7); decide the provisional values listed in Q14.

## SIGN-OFF RECORD

**2026-11-18 — Owner (Deyvid) signed off in chat.**

- (a) ADR-11 through ADR-16 moved Proposto → Aceito, in each ADR file (the `**Status**` line) and the `docs/adr/README.md` status table.
- (b) The new direct dependency `@humanwhocodes/momoa` 3.3.13 (Apache-2.0, exact pin, build-time only) is acknowledged (ENG-25).

Feature 001 is accepted with the 7 CONCERN items recorded above as either deferred to later features (Q2, Q10, Q12) or provisional pending owner decisions (Q5, Q7, Q14). The session applied the ADR/table status changes as the mechanical execution of the owner's chat sign-off; the decision is the owner's.
