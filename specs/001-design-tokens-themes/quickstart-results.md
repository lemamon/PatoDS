# Quickstart acceptance results (ACE-01 evidence)

**Feature**: 001-design-tokens-themes | **Task**: T082 | **Date**: 2026-11-17
**Source**: [quickstart.md](quickstart.md)

## Toolchain

| Item | Version |
| --- | --- |
| Node.js | 24.x (24.22.0) |
| pnpm | 11.28.6 (via corepack) |
| Playwright browsers | installed locally; e2e ran on Chromium (PR-level matrix) |

## Method

- Dependencies removed from every workspace and reinstalled with `pnpm install --frozen-lockfile`.
- Every gate was then run with the turbo cache bypassed (`TURBO_FORCE=true`), so each result is a real execution and not a cache replay.
- `git status --porcelain` after all gates: only the pre-existing untracked `specs/002-components/` (no generated or tracked file changed).

## Per-gate results

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Clean reinstall, lockfile frozen, no integrity error |
| `pnpm tokens:validate` | 0 | 1/1 task; zero violations across brand x mode permutations |
| `pnpm tokens:build` | 0 | 2/2 tasks; dist artifacts generated |
| `pnpm test` | 0 | 6/6 tasks; all unit and fixture suites pass |
| `pnpm test:types` | 0 | 4/4 tasks; TS 6.0 and TS 7.0 consumer checks pass |
| `pnpm test:e2e` | 0 | 4/4 tasks; tarball install plus Playwright 27 passed |
| `pnpm contrast:check` | 0 | 16 cases (4 exempt), 12 passed, 0 failed, 0 findings |
| `pnpm lint:styles` | 0 | 3/3 tasks; zero violations |
| `pnpm check:scan` | 0 | FR-001 scan clean |
| `pnpm check:layers` | 0 | Layer boundaries respected |
| `pnpm check:drift` | 0 | No generated file tracked; API report has no diff |
| `pnpm check:traceability` | 0 | Traceability matrix consistent |
| `pnpm check:logic-tests` | 0 | Every logic module has a test file |
| `pnpm check:naming-doc` | 0 | Naming doc and validator in sync |
| `pnpm check:licenses` | 0 | Tree licenses within `quality/license-policy.json` |
| `pnpm sbom:generate` | 0 | CycloneDX SBOM generated |
| `pnpm check:determinism` | 0 | Ran in full (two `git worktree` builds of HEAD, `pnpm pack`, per-file and tarball sha256): identical outputs |

`check:determinism` was executed, not time-bounded or skipped. It completed in a few seconds because the
check builds with the current checkout tooling and packs offline.

## Per-user-story acceptance map

| Story | Scenarios | Gate(s) that prove it | Result |
| --- | --- | --- | --- |
| US1 define tokens in a validated source | Q1.1 to Q1.15, CC-3, CC-9 | `tokens:validate`, `tokens:build`, `check:scan`, `test` (rule fixtures V-01 to V-13, intentional-violation fixtures) | PASS |
| US2 consume tokens per subtree | Q2.1 to Q2.17, CC-1, CC-5, CC-6 | `tokens:build`, `test:e2e` (27 browser cases), `test:types`, `check:determinism` | PASS |
| US3 add a brand without touching components | Q3.1 to Q3.4 | `test` (tokens-build add-brand integration), `test:e2e` (runtime brand switch), `contrast:check` | PASS |
| US4 contrast across all combinations | Q4.1 to Q4.13 | `contrast:check`, `test` (color, tokens-contrast, stylelint-plugin fixtures), `lint:styles`, `test:e2e` (rendered contrast samples) | PASS |
| US5 block styles outside tokens | Q5.1 to Q5.8 | `test` (stylelint-plugin valid/invalid fixtures), `lint:styles` | PASS |
| US6 keep the design tool synced | Q6.1 to Q6.17 (memory adapter, contract suite) | `test` (design-sync contract suite and architecture test), `check:layers` | PASS |

Cross-cutting: CC-2 `check:drift` PASS; CC-4 `check:layers` PASS; CC-7 `test` PASS; CC-8 frozen install PASS;
CC-10 `check:traceability` PASS.

## Not validatable in this feature (per quickstart section 11)

Real design tool adapter, real notification of the owner role, publish-triggered sync, lint and pair check in
the core, real brands, real prefix, TOK-12, browser list, Node and TypeScript floors beyond the provisional
matrix, React and Vue example apps, QA-03 coverage and QA-07 bundle thresholds, and the full ENG-01 and
remote cache. Q6.18 (workflow inspection) and manual intentional-violation demonstrations in throwaway
worktrees were covered by the automatic fixtures, not re-run by hand. Only Chromium was exercised.

## Overall verdict

ALL GATES EXIT 0 (17 of 17). Quickstart acceptance for user stories US1 to US6: PASS within the stated
limits above.
