# lint-test

## DECISION
LINT: write one in-house Stylelint rule, `<prefixo>/design-tokens`, as an ESM plugin on stylelint ^17.16.0. It parses values with @csstools/css-tokenizer and @csstools/css-parser-algorithms ^4.0.2, and selectors with postcss-selector-parser ^7.1.7. Its data comes from a token manifest JSON emitted by the tokens build (name, layer, category, resolved alias chain, scale membership). Interactive controls are identified by a versioned control registry of component root classes, with an exhaustiveness check. Fixtures run through stylelint.lint() inside Vitest, and the test requires the expected warnings and the actual warnings to be exactly the same set. The CI gate runs with ignoreDisables, --max-warnings 0 and a JSON report. TESTS: (a) Vitest ^5.0.5 with @vitest/coverage-v8 5.0.5, Node environment only, for every build script, validator, lint rule and CI script (QA-02). (b) Type tests live in a consumer project that installs the packed tarball. They use expect-type ^1.4.0 for positive cases and `@ts-expect-error` for negative cases, and the gate is plain `tsc --noEmit` (strict, moduleResolution bundler and nodenext) on TypeScript 7.0.x and 6.0.x. publint ^0.3.25 checks the tarball. (c) Real-browser tests use @playwright/test ^1.64.1 against a plain TypeScript Vite 8 example app (no framework) built only from the tarball and served by Playwright webServer (`vite preview`). They run in mcr.microsoft.com/playwright:v1.64.1-noble pinned by digest, with no external network. (d) The determinism check, generated-file drift check and FR-001 repository scan are small in-house Node scripts that use only node:crypto, git ls-files and postcss ^8.5.31. Each is unit-tested with fixtures that contain deliberate violations.

## RATIONALE
LINT, why a custom rule. FR-022 has to tell a primitive var() apart from a semantic or component one. Only the token source knows which is which. Existing plugins check "is this a variable", not "which variable". stylelint-declaration-strict-value accepts any var(); built-in name regexes would tie the lint to a naming convention that is not final yet (FR-005, and the prefix is undefined). A manifest emitted by the same build that generates the CSS keeps one source (Principles I and II). It also exposes the alias chain, which FR-023 needs: a component token such as `--<prefixo>-button-height-md` that aliases the control-height scale is legal. A single rule ID also satisfies the wording of FR-023 ("the same rule"). The rule has sub-checks, each reporting a stable code:
- [primitive-token]: var() of a token whose layer is primitive.
- [unknown-token]: a `--<prefixo>-*` name that is not in the manifest.
- [literal-value].
- [var-fallback-literal], e.g. `var(--x, #fff)`.
- [token-definition]: a `--<prefixo>-*` custom property declared in component CSS. This is also defense in depth for FR-001.
- [control-height].
- [unclassified-component].

Literal detection. A versioned map assigns each governed property to a TOK-10 category: color, spacing, sizing, radius, border, shadow, font, line-height, letter-spacing, z-index, opacity, and durations and easing. Inside governed properties, every leaf of the value must be one of:
- var() of an allowed token;
- an allowlisted keyword: CSS-wide keywords, none, auto, currentcolor, transparent, 0;
- a math function (calc, min, max, clamp) whose leaves also comply. Unitless factors are allowed inside calc, e.g. `calc(var(--s) * -1)`.

Hex colors, color functions, named colors, dimensions, times and bare numbers fail. var() is invalid in media queries, so dimensions in @media and @container params also fail. The intended path is `@custom-media` names generated from breakpoint tokens and compiled away by the core build.

Control height, decided deterministically. These properties are checked: height, min-height, block-size, min-block-size (max-* configurable). They are checked in rules whose rightmost compound selector contains a registered control root class. The match is an exact class match through postcss-selector-parser, with nesting resolved, so descendants and `__part` classes are not matched. The value must be var() of a token that resolves, through the manifest alias chain, to a member of the FR-007 scale. A literal, auto, or any other dimension token fails. The exhaustiveness check requires every `.<prefixo>-<component>` root class found in core CSS to be classified in the registry as control or non-control. An unclassified class fails, so a missing classification cannot pass silently, unlike opt-in annotation comments. The registry should later be generated from the per-component orientation files, so it does not become a hand-kept copy (Principle I).

Fixture harness (FR-024, SC-009):
- `valid/*.css` must produce zero warnings.
- In `invalid/*.css`, each offending line carries a `/* expect: <code> */` comment.
- The test requires set equality of {file, line, code} between expected and actual. That gives 100% of expected errors and zero false positives.
- The test also fails if any code has no invalid fixture.
- The fixture manifest comes from running the real tokens build on synthetic brands A and B (QA-15).

The gate uses a separate config with ignoreDisables: true, so no inline disable can bypass it. It runs with --max-warnings 0 and keeps the JSON formatter output as the "zero violations" report. It applies to the fixtures now and to the core CSS once that exists. Stylelint 17 is the current major, MIT, Node >=20.19 and has no install scripts. Its plugin API (createPlugin, namespaced rule, utils.report with a node) is stable.

TEST STACK, unit tests. Vitest 5 is the current major (5.0.0 on 2026-09-03, 5.0.5 on 2026-10-15). It runs ESM and TypeScript natively, with V8 coverage whose thresholds are read from the single QA-14 thresholds file. Storybook's addon-vitest, the likely runner for component stories later, accepts vitest ^4 || ^5, so one runner serves the whole repo. Unit tests run in Node, with no jsdom or happy-dom. A small script fails if a logic module has no sibling test file (QA-02).

Type tests. TypeScript 7.0 has no programmatic API until 7.1, so anything that needs the API (TSTyche 7, tsd, attw's internal TS) cannot check TS 7. Plain tsc diagnostics work on both TS 6 and TS 7. An unused `@ts-expect-error` raises error TS2578, so a negative case that stops failing breaks the build.

Real-browser tests. FR-018 and QA-06 require the built consumer app installed from the tarball. Playwright Test with webServer tests exactly that. Vitest browser mode serves test modules from the Vite dev server inside an iframe, so it suits component stories, not a built app. Both share the same pinned Playwright browsers. The expected values in browser tests come from the tarball's generated values-map entry, never hand-written (Principle I). For unregistered custom properties, the computed value has var() already substituted, so the comparison is direct after whitespace normalization. Chromium runs on every PR; Chromium, Firefox and WebKit run nightly and before publishing (QA-12, browser list).

Determinism and drift. The determinism check builds twice from two clean `git worktree` checkouts at different absolute paths, with different TZ and LC_ALL. It compares the sorted path list and the sha256 of every file, plus the `npm pack --dry-run --json` file list. On a mismatch it prints the first differing file and a diff. A nightly job repeats the comparison across different runners. The generator must sort by code point, write LF line endings, and emit no timestamps or absolute paths. Generated token outputs stay gitignored. The drift check then:
- fails if `git ls-files` lists any generated path or any file carrying the generated header (covers the "token CSS edited by hand" edge case);
- for artifacts that are versioned on purpose (e.g. a token API report for QA-08), regenerates them, then requires `git diff --exit-code` to pass and `git status --porcelain` to be empty.

FR-001 scan. It walks the files from git ls-files and flags:
- CSS: any declaration whose property starts with `--<prefixo>-`, found by parsing with PostCSS;
- `<style>` blocks and `style=` attributes in .vue and .html files;
- in TS, JS and JSON, string keys and setProperty calls with `--<prefixo>-` names;
- DTCG `$value` documents outside the token source.

A versioned allowlist covers the token source directory and the scanner's own fixtures, each entry with a justification. Self-test fixtures planted in CSS, a Vue SFC, TSX and JSON must be detected 100%, which is the deliberate violation the constitution requires. Using no extra binaries keeps ENG-07, ENG-21 and ENG-24 simple. Every chosen package was checked on the npm registry on 2026-10-21: MIT or Apache-2.0, not deprecated, and no preinstall, install or postinstall scripts (stylelint, vitest, @playwright/test, playwright, typescript 7, rolldown, lightningcss).

## ALTERNATIVES
- stylelint-declaration-strict-value 1.12.1 plus Stylelint built-ins (color-no-hex, color-named, unit-disallowed-list, declaration-property-value-disallowed-list): It only checks that a value is a variable, function or allowed keyword. It cannot tell a primitive var() from a semantic one, cannot resolve alias chains, and has no notion of interactive control, so FR-022 and FR-023 would still need custom code: two mechanisms and duplicate warnings. Its ignoreFunctions setting is all-or-nothing: either rgb() is allowed or calc(var()) is blocked. It does not lint @media params. Its one dependency, regexp.escape, pulls in the large es-abstract tree.
- Built-in Stylelint rules only, with regexes on token names (e.g. block `--<prefixo>-palette-*`): Ties the lint to a naming convention that is not final (FR-005, prefix undefined). It cannot verify membership in the control-height scale through aliases, and cannot scope checks to interactive controls.
- Domain plugins: @primer/stylelint-config 13.6.0, stylelint-plugin-carbon-tokens 5.0.6: Hard-wired to the Primer and Carbon token sets. Useful only as precedent for token-aware custom rules.
- stylelint-value-no-unknown-custom-properties 6.1.1: CC0-1.0 license, outside the MIT/Apache-2.0/BSD/ISC preference, and it only detects unknown variables. The manifest-driven [unknown-token] check already covers this.
- @eslint/css 2.0.1 with ESLint 10 custom rules: A younger CSS language plugin with a much smaller CSS rule ecosystem and fewer test helpers. Stylelint is the mature standard for CSS. Worth revisiting only if the repo later wants a single linter.
- Biome 2.6 CSS linter: Plugins are GritQL, not JavaScript, so it cannot load the token manifest or walk alias chains. It would still need a second tool.
- Identify controls by annotation comments (`/* @<prefixo>-control */`), or apply the height rule to every component rule: Annotations are opt-in: a forgotten comment passes silently (false negative). Checking every height property gives false positives on non-controls such as avatars and dividers. A registry plus the exhaustiveness check avoids both.
- Vitest browser mode for the example-app tests: It runs test modules from the Vite dev server inside an iframe. It does not test the built consumer app installed from the tarball, which FR-018 and QA-06 require. It remains the right tool for component stories later (Storybook addon-vitest) and shares the same Playwright browsers.
- Jest 30 for unit tests: Needs a transform setup for ESM and TypeScript, would be a second runner next to Storybook's Vitest, and complicates coverage aggregation for QA-03. Vitest runs ESM and TypeScript natively.
- jsdom or happy-dom for scope and cascade tests: Constitution VII and QA-01 forbid simulated DOM, and neither implements the real cascade or computed custom properties reliably.
- TSTyche 7.2.5 for type tests: Depends on the TypeScript API. TS 7 support exists only in 8.0.0-beta.0, while 7.2.x falls back to TS 6.
- tsd 0.33.0: Bundles its own fork of TypeScript, which lags releases. Last published August 2025.
- vitest --typecheck as the type-test gate: It only calls tsc or vue-tsc and parses the output, so it adds nothing essential. TS 7 behaviour is undocumented. It can still be added later for nicer reporting.
- @arethetypeswrong/cli 0.18.5: Its core pins typescript 5.6.1-rc internally. Redundant with publint plus strict consumer compiles under both bundler and nodenext resolution.
- Commit generated CSS and rely only on a git-diff drift check: TOK-05 and the spec's edge case treat token CSS as generated and never versioned. Keeping it gitignored and checking that it is absent is stricter and simpler.
- diffoscope, Semgrep or ast-grep for determinism and scanning: Extra binaries or runtimes with license (diffoscope is GPL-3.0, Semgrep's engine is LGPL) and supply-chain overhead. sha256 manifests and a PostCSS-based Node script are deterministic, unit-testable and add no dependencies.
- Vitest 4.1.x (still patched, 4.1.12 on 2026-10-15): Viable fallback, but 5.x is the current major with the same Storybook compatibility. Starting on 4.x means a forced migration soon after Phase 1.

## REQUIREMENT FIT
- FR-001: The repository scan script (PostCSS for CSS, extraction for Vue and HTML, regex for TS, JS and JSON, DTCG $value outside the source), with a versioned allowlist, runs as a required CI check. Its self-test fixtures prove 100% detection. The lint's [token-definition] check also blocks `--<prefixo>-*` declarations in core CSS.
- FR-002, FR-003, FR-004: Vitest unit tests drive the validators with fixtures: schema error, literal in the semantic or component layer, missing alias, alias cycle (the chain must be reported), upward-layer reference. Each asserts the error code and token path. CI also runs the validator on the real source.
- FR-005, FR-006, FR-007, FR-008: Table-driven Vitest tests cover the naming validator, the category-coverage check (at least one semantic token per category), control-height scale closure and component height tokens aliasing the scale. A fixture-based assertion checks the build report: counts per category and the scale per theme. CI runs these against the real source so 100% of published tokens pass.
- FR-009: A Vitest integration test copies the token source to a temp worktree, adds synthetic brand C, builds, and asserts that the CSS and values for brand C exist and that `git diff --name-only` touches only the token source. In the same job, Playwright switches to brand C at runtime.
- FR-010, FR-011: Vitest tests on the generator check that the data-<prefixo>-brand and data-<prefixo>-mode selectors exist for every combination and that the output parses as valid CSS. The key-parity checker is tested with missing-key and extra-key fixtures that must block.
- FR-012, FR-013, FR-014: Playwright tests on the tarball-built example app read getComputedStyle custom properties and compare them with the tarball's values map. They cover: defaults with no attributes, a mode-only nested scope, a brand-only nested scope, A→B→A alternation, and an invalid attribute value falling back to the nearest ancestor. A CSSOM walk asserts that no var() resolves empty.
- FR-015: The determinism script builds twice in different paths, timezones and locales and compares sha256 per file. The drift check fails if any generated token CSS is tracked by git. The FR-001 scan catches hand-written token CSS.
- FR-016: In the consumer project installed from the tarball: expect-type positives (literal `var(--<prefixo>-…)` types, not.toBeAny) and `@ts-expect-error` negatives for a nonexistent token in the refs entry and a nonexistent token, brand or mode in the values entry. The gate is `tsc --noEmit`, strict, under bundler and nodenext, on TS 7.0.x and 6.0.x. publint plus the tarball allowlist assert that the ESM files and .d.ts files of both entries are present.
- FR-017: A Vitest static check on each brand file: every selector carries that brand's attribute, except the default-combination selectors in the default brand file. After vite build of the example app that imports only brand A, its CSS is parsed to assert there are no brand-B selectors or variables. At runtime, Playwright asserts that no variable is left without a value.
- FR-018: The example app installs only the packed tarball: frozen install of third-party deps, then the tarball with scripts disabled, then an integrity check that the installed files match the tarball. Playwright toggles brand and mode at runtime, checks that values change, and checks there was no navigation and no component code change.
- FR-019, FR-020, FR-021: Vitest tests of the contrast math cover alpha compositing against reference values and the 4.5:1 and 3:1 thresholds, including a known-failing pair and a translucent pair. The full manifest × brand × mode run is a CI gate. The FR-021 pair-in-manifest check can live in the same plugin package and reuses the same expected-versus-actual fixture harness.
- FR-022: The `<prefixo>/design-tokens` sub-checks [primitive-token], [unknown-token], [literal-value] and [var-fallback-literal] are driven by the token manifest. The gate is required, uses ignoreDisables and --max-warnings 0.
- FR-023: The [control-height] sub-check of the same rule ID: height and block-size properties of registered control root classes must resolve, through the alias chain, to the FR-007 scale. The [unclassified-component] check stops a component being left out of the registry silently.
- FR-024: Valid and invalid fixtures, with expected and actual {file, line, code} required to be the same set: 100% of expected errors, zero false positives. Every code must have at least one invalid fixture. The CI JSON report shows zero violations, and the same config is pointed at the core CSS once it exists.
- FR-025, FR-026, FR-027, FR-028, FR-029, FR-030: Vitest unit tests cover the tool-agnostic sync planner, diff, restore and divergence logic against recorded snapshots of remote variables. They include a deliberate manual edit that must be restored and logged, and name and hierarchy equality. Contract tests against the real design tool come after the requester chooses the tool.
- FR-031: Each check above is a named required CI job, referenced from the traceability matrix. A unit-tested matrix checker fails on any ID with no check.
- QA-01 / Constitution VII: Real browsers through Playwright, never simulated DOM. Browsers come from the official image pinned by digest; external network is blocked with page.route. Chromium runs on PRs; every engine in the browser list runs nightly and before publishing. Coverage and other thresholds are read from the single QA-14 file.
- QA-02: Vitest covers every non-UI module: build, validators, lint rule, scan, determinism and drift scripts. A script fails if a module has no sibling test file.
- QA-06: The example app consumes only the packed tarball, with integrity verified. Build and smoke tests run with zero import errors or warnings.
- QA-08: tsc plus expect-type with at least one `@ts-expect-error` negative per entry and per axis (token name, brand, mode). A token API report generated by the build is versioned and drift-checked.
- ENG-07, ENG-16, ENG-17, ENG-21, ENG-24: Every chosen package is current, not deprecated, MIT or Apache-2.0, and has no install scripts (checked 2026-10-21). The in-house scripts add no dependencies. The tarball allowlist check is reused for FR-016. The one license caveat (lightningcss, MPL-2.0, through Vite 8) is listed under risks.
- ENG-01: The lint plugin and the scripts sit in the tools layer. They take the token manifest path as an option instead of importing UI packages. The example app depends only on the tarball.

## RISKS
- Vitest 5 is young (5.0.0 on 2026-09-03). Mitigation: pin it through the lockfile. The V4 line (4.1.12) is still patched and Storybook addon-vitest accepts ^4 || ^5, so falling back is cheap.
- TypeScript 7.0 has no programmatic API until 7.1. Any API-based tool (typescript-eslint, vue-tsc, API Extractor, TSTyche 7) must run on TS 6 (typescript@6 or @typescript/typescript6). The type tests deliberately use only tsc diagnostics. The TS matrix depends on the ENG-08 floor decision.
- Vite 8 (example app and Vitest peer) pulls in lightningcss, which is MPL-2.0, transitively. The license policy must allow it as a dev-only transitive dependency. The other option is Vite 7, which brings esbuild with a postinstall script that would need an ENG-24 allowlist entry.
- The in-house plugin costs maintenance. The governed-property map and keyword allowlist must evolve with CSS, and too broad a governance creates false positives (e.g. width: 100%). Mitigation: the set-equality fixture harness, with per-code coverage enforced.
- var() is invalid in @media and @container params. Literal breakpoints in core CSS will fail the rule until the core build adopts `@custom-media` names generated from tokens (postcss-custom-media is MIT; Lightning CSS drafts.customMedia is MPL-2.0). That decision belongs to the core-styles feature.
- The control registry is a hand-maintained classification until the orientation files exist, which is in tension with Principle I. Plan to generate it from the orientation file or catalog; the exhaustiveness check catches omissions in the meantime.
- Installing the tarball conflicts with the frozen lockfile (ENG-16): the tarball's integrity changes on every build. Third-party deps must install frozen, then the tarball is added without rewriting the lockfile, and an integrity check proves the tarball was used and not the source.
- Custom-property serialization differs across engines (whitespace, color formats). Normalize before comparing, or compare a real property such as computed color.
- Cross-OS determinism (line endings, locale-dependent sorting, path separators). Enforce LF through .gitattributes and code-point sorting, and run the determinism comparison across runners nightly.
- The Playwright Docker image version must match the npm Playwright version exactly, or the browsers are not found. Pin both together.
- The FR-001 regex detectors for TS and JS can produce false positives, for example strings in docs. Mitigation: an allowlist where every entry needs a justification, plus self-test fixtures.

## OPEN QUESTIONS
- ENG-08 'Minimum versions': which TypeScript floor (the assumption still has a `<version>` placeholder) and which versioned browser list? This decides whether type tests also run on TS 6.0.x next to 7.0.x, and which engines run nightly and before publishing.
- ENG-21 license policy: may MPL-2.0 be accepted for a transitive, dev-only dependency (lightningcss through Vite 8)? If not, the toolchain must use Vite 7 and allowlist esbuild's postinstall script under ENG-24.

## ADR
ADR-0NN: Token lint via a custom manifest-driven Stylelint rule and the tokens feature's test stack (Vitest 5, tsc + expect-type over the tarball, Playwright Test in a real browser)

## SOURCES
- https://www.npmjs.com/package/stylelint — npm registry, queried 2026-10-21: stylelint 17.16.0 is current, MIT, engines node >=20.19.0, no install scripts.
- https://stylelint.io/migration-guide/to-17 — Stylelint 17 removes the CommonJS API, requires full paths for plugins, and requires report() to receive a PostCSS node.
- https://stylelint.io/developer-guide/plugins — Plugins use createPlugin with a namespaced rule name and utils.report/ruleMessages/validateOptions. Tests use stylelint-test-rule-node or jest-preset-stylelint, or call stylelint.lint directly.
- https://stylelint.io/user-guide/options — The ignoreDisables, reportNeedlessDisables, reportDescriptionlessDisables, reportUnscopedDisables and maxWarnings options exist.
- https://github.com/AndyOGo/stylelint-declaration-strict-value — Requires a value to be a variable, function or allowed literal. It does not tell var() names apart, and ignoreAtRules only skips declarations inside at-rules.
- https://www.npmjs.com/package/stylelint-declaration-strict-value — npm registry: version 1.12.1, MIT, peer stylelint >=16 <=17, depends on regexp.escape, which pulls in es-abstract.
- https://www.npmjs.com/package/stylelint-value-no-unknown-custom-properties — npm registry: version 6.1.1, license CC0-1.0.
- https://github.com/primer/stylelint-config — Primer ships its own variable-enforcement Stylelint rules for its own tokens, a precedent for token-aware custom rules.
- https://developer.mozilla.org/en-US/docs/Web/CSS/var — var() cannot be used anywhere except property values, so not in selectors or property names, and by implication not in media query conditions.
- https://lightningcss.dev/transpilation.html — Lightning CSS supports @custom-media behind drafts.customMedia.
- https://vitest.dev/blog/vitest-5 — Vitest 5.0 released 2026-09-03; requires Node >=22.12 and Vite >=6.4; lists its breaking changes.
- https://www.npmjs.com/package/vitest — npm registry: vitest 5.0.5 is latest (2026-10-15); the V4 tag is at 4.1.12, still patched; MIT.
- https://vitest.dev/guide/testing-types — Vitest typecheck does not execute files: it calls tsc or vue-tsc and parses the results.
- https://vitest.dev/guide/browser/ — Browser mode serves tests through the Vite dev server inside an iframe, with playwright or webdriverio providers.
- https://storybook.js.org/docs/writing-tests/integrations/vitest-addon — Storybook 10.6's Vitest addon runs stories as tests in Vitest browser mode with Playwright Chromium.
- https://www.npmjs.com/package/@storybook/addon-vitest — npm registry: addon-vitest 10.6.3 has peers vitest ^4.0.0 || ^5.0.0.
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ — TypeScript 7.0 announced 2026-07-08 without a programmatic API (expected in 7.1). @typescript/typescript6 provides tsc6 and the 6.0 API side by side.
- https://www.npmjs.com/package/typescript — npm registry: typescript 7.0.2 is latest; 6.0.3 (2026-04-16) is the last 6.x; no install scripts.
- https://github.com/tstyche/tstyche/releases — TSTyche 7.2.5 is the stable release; TypeScript 7 support exists only in 8.0.0-beta.0.
- https://www.npmjs.com/package/tsd — npm registry: tsd 0.33.0, last modified 2025-08-05.
- https://www.npmjs.com/package/expect-type — npm registry: expect-type 1.4.0, Apache-2.0, no dependencies.
- https://www.npmjs.com/package/@arethetypeswrong/core — npm registry: @arethetypeswrong/core 0.18.5 pins typescript 5.6.1-rc as a dependency.
- https://www.npmjs.com/package/publint — npm registry: publint 0.3.25, MIT, updated 2026-10.
- https://playwright.dev/docs/docker — Official image mcr.microsoft.com/playwright:v1.64.x-noble includes the browsers. Pin the image version, which must match the Playwright package version.
- https://playwright.dev/docs/test-webserver — The webServer option starts a server (e.g. vite preview) before the tests, using command, url and reuseExistingServer.
- https://www.npmjs.com/package/@playwright/test — npm registry: @playwright/test 1.64.1 (2026-10-14), Apache-2.0, no install scripts.
- https://www.npmjs.com/package/vite — npm registry: vite 8.3.5 depends on rolldown and lightningcss; esbuild is only an optional peer.
- https://www.npmjs.com/package/lightningcss — npm registry: lightningcss 1.33.0 is licensed MPL-2.0.
- https://nodejs.org/en/about/previous-releases — Node 20 is end-of-life (March 2026) and Node 22 and 24 are LTS, consistent with Vitest 5 requiring Node >=22.12.


# VERIFICATION: needs_changes
- [major] CLAIM: [control-height] checks height/min-height/block-size/min-block-size only in rules whose rightmost compound contains an exact registered control root class; the exhaustiveness check classifies every `.<prefixo>-<component>` root class.
  PROBLEM: The check misses three common cases. (1) Size and state modifiers are usually written as standalone classes such as `.<prefixo>-button--sm { height: 28px }`. The compound does not contain the root class, so the rule never runs. Size variants are exactly where heights get set. (2) Nothing requires a control to declare a height at all, so a control sized only by padding-block plus line-height passes. That breaks TOK-13/FR-007 ('used by all controls') and SC-009. (3) The exhaustiveness check has to tell root, part and modifier classes apart, which depends on the class naming convention (CMP-05/CMP-14). That convention is not final, and the result used exactly this argument to reject the regex-based alternatives.
  CORRECTION: Registry entries must list every selector that sizes the control box: root class, size and state modifier classes, and data-attribute variants. These should come from the DOM contract (CMP-14) or the orientation file, not from a class-name pattern. Alternatively, match any class in the component's namespace except registered __parts. Add a presence sub-check (e.g. [control-height-missing]): each registered control and each size variant must declare block-size, min-block-size, height or min-height resolving to the FR-007 scale. Flag padding-block or line-height used for sizing on a control root that has no scale height. Add invalid fixtures for modifier-only and padding-only sizing.
- [major] CLAIM: FR-001 is enforced by a scan for `--<prefixo>-` declarations and by the lint's [token-definition] check; [literal-value] applies only to governed (TOK-10-mapped) properties; [unknown-token] applies to `--<prefixo>-*` names.
  PROBLEM: A custom property without the prefix escapes everything. Example: `--brand-blue: #0055ff` in component CSS. The scan and [token-definition] key on the prefix, and custom-property declarations are not governed properties, so the literal is never checked. The result also does not say whether `color: var(--brand-blue)` (no prefix, not in the manifest) counts as an 'allowed token'. This is exactly spec US1 scenario 3 ('a color variable declared directly in a style file'), SC-001 and SC-009. The planned self-test fixtures use prefixed names, so they would pass while this hole stays open.
  CORRECTION: In the lint: treat every custom-property declaration in component CSS as governed. Its value must be var() of an allowed manifest token, or private custom properties are forbidden outright. Any var() whose name is not a manifest semantic or component token must fail, whatever its prefix ([unknown-token] or [non-token-var]). In the FR-001 scan: flag any custom-property declaration with a literal value, under any name, in CSS, SFC <style> or HTML outside the token source and the allowlist. Add fixtures with unprefixed names.
- [major] CLAIM: Every chosen package is MIT or Apache-2.0 with no install scripts; 'the one license caveat (lightningcss, MPL-2.0, through Vite 8)'; the alternative is Vite 7, whose esbuild postinstall would need an ENG-24 allowlist entry.
  PROBLEM: I resolved the proposed toolchain with npm --package-lock-only (214 packages: stylelint 17.16.0, vitest 5.0.5, vite 8.3.5, @playwright/test 1.64.1, typescript 7.0.2 and the rest). The licenses found: MPL-2.0 (lightningcss and its 11 platform packages); MIT-0 (3 @csstools packages, via stylelint); Python-2.0 (argparse, via cosmiconfig → js-yaml, via stylelint); CC0-1.0 (mdn-data, via css-tree, via stylelint); BSD-3-Clause. svg-tags@1.0.0 (via stylelint) has no SPDX `license` field, only the legacy `licenses` array, so a strict checker reports it as unknown, and ENG-21 fails on 'desconhecida'. fsevents@2.3.3, an optional darwin-only dependency of vite 8, has `install: node-gyp rebuild`, so Vite 8 also needs an ENG-24 allowlist entry; the Vite 7 vs Vite 8 trade-off is framed wrongly. esbuild works with install scripts blocked, through its optional platform packages. Storybook 10.6.3, named as the future runner, depends on esbuild anyway. Rejecting stylelint-value-no-unknown-custom-properties for CC0-1.0 is inconsistent, because stylelint itself pulls in CC0-1.0 mdn-data.
  CORRECTION: List the full transitive license set in the ADR. The ENG-21 policy draft must cover MIT-0, Python-2.0, CC0-1.0, BSD-3-Clause and MPL-2.0 (dev-only, transitive), plus an override for svg-tags (MIT declared through the legacy field). Add ENG-24 allowlist entries for fsevents now and for esbuild when Storybook arrives; both can stay blocked from running. Reword the ENG-21 open question to ask for approval of that whole set, not only MPL-2.0. For stylelint-value-no-unknown-custom-properties, drop the license reason and keep only the redundancy reason.
- [minor] CLAIM: Biome 2.6: 'Plugins are GritQL, not JavaScript, so it cannot load the token manifest'.
  PROBLEM: This is stale. Biome now accepts JavaScript and TypeScript plugin files. They are in Developer Preview, and breaking changes can land in patch releases.
  CORRECTION: Reject Biome because its JS plugin API is still a preview and unstable, with no documented file-reading API and a smaller CSS rule set. Do not reject it on the 'GritQL only' claim.
- [minor] CLAIM: QA-06 is satisfied by a plain TypeScript Vite example app built from the tarball.
  PROBLEM: QA-06 explicitly requires React and Vue example apps. The spec cites QA-06 only as a principle for FR-018 and does not list it as served by this feature. A framework-free app satisfies FR-017 and FR-018, not QA-06.
  CORRECTION: Mark QA-06 as partial, completed by the component feature. Optionally, run the token browser checks inside the React and Vue example apps once they exist, so the repo does not keep a third example app.
- [minor] CLAIM: The determinism check builds twice from two clean git worktrees with different TZ and LC_ALL and compares sha256 per file plus the `npm pack --dry-run --json` file list.
  PROBLEM: ENG-03 requires a shared remote task cache. If the second build is served from the local or remote cache, the comparison proves nothing. In a pnpm workspace, `npm pack` also differs from the real packing step, since pnpm pack rewrites workspace: and catalog: specifiers.
  CORRECTION: Force the cache off for both builds (e.g. --skip-cache / --force in the task runner). Pack with the repository's own package manager. Also compare the sha256 of the packed tarballs, which are deterministic when the inputs are.
- [minor] CLAIM: The fixture harness requires set equality of {file, line, code}.
  PROBLEM: With set semantics, a duplicate report or two violations of the same code on one line collapse into one entry. A missed second violation or a double-reported one goes unnoticed, which weakens the claims of '100% of expected errors' and 'zero false positives'.
  CORRECTION: Compare multisets keyed by {file, line, column, code}, or allow `expect: code×N`.
- [minor] CLAIM: Node 20 reached end of life in March 2026.
  PROBLEM: The official schedule gives 2026-04-30. Node 26 becomes LTS on 2026-10-28, which matters for the 'latest' leg of the ENG-08 matrix. Vitest 5 engines are ^22.12 || ^24 || >=26.
  CORRECTION: Fix the date and note that Node 26 LTS joins the matrix next week.
- [minor] CLAIM: TypeScript 7.0 has no programmatic API until 7.1.
  PROBLEM: Correct for the stable line, but typescript@7.1.0-beta was published on 2026-10-20 and TSTyche 8.0.0-beta.0 adds TS 7 support. The risk section does not record a point to revisit.
  CORRECTION: Add a revisit trigger at 7.1 stable for the API-based tools (TSTyche 8, API reports, attw). The decision itself does not change.
- [minor] CLAIM: The control registry is hand-maintained until the orientation files exist; [token-definition] forbids any `--<prefixo>-*` declaration in component CSS.
  PROBLEM: A standalone hand-kept registry is a fourth hand-written source, which conflicts with Principle I. Feature 001 does not need one: the lint applies to the core only once the core exists, so fixtures need only a synthetic registry. Separately, [token-definition] rules out the common pattern of remapping a component variable inside a variant (e.g. `.x-button--danger{--x-button-bg:…}`). That is a large constraint on the core-styles feature, and it is not stated. The keyword allowlist (transparent, currentcolor, 0, auto, none) is also a reading of what TOK-03 means by 'literal value'.
  CORRECTION: Specify that the production registry is derived from the orientation file or the DOM contract (CMP-14) and that feature 001 ships only fixture registries. Record the variant-remapping ban and the keyword allowlist in the ADR as explicit constraints on the core feature, for the acceptor to see.
- [minor] CLAIM: ENG-01 is satisfied because the plugin sits in the tools layer and takes the manifest path as an option.
  PROBLEM: ENG-01 names 'lint' as a layer. It must be added to the versioned layers file in the phase it is created, with a deliberate forbidden-edge violation as evidence. The tokens-build → lint dependency (the manifest) also has to be declared in the task graph so that ENG-02 affected-runs include the lint when tokens change.
  CORRECTION: Add the lint layer and its allowed edges to the layers file, plant a deliberate violation, and declare the manifest dependency in the task graph.

## REVISED DECISION
Keep the overall decision.
- One in-house `<prefixo>/design-tokens` rule for Stylelint ^17.16.0, driven by the token manifest.
- Vitest ^5.0.5 with coverage-v8, Node environment only.
- Type tests with tsc --noEmit plus expect-type in a consumer project installed from the tarball, on TS 7.0.x and 6.0.x (via @typescript/typescript6), plus publint.
- @playwright/test 1.64.1 against a tarball-built Vite 8 app, in mcr.microsoft.com/playwright:v1.64.1-noble pinned by digest.
- In-house determinism, drift and FR-001 scripts.

Amend it as follows:
(1) [control-height] covers every selector that sizes a control: root, size and state modifiers, and data-attribute variants, taken from the DOM contract or orientation file rather than a class-name pattern. Add a presence sub-check: every registered control and size variant must declare a height or block-size from the FR-007 scale.
(2) Every custom-property declaration in component CSS is governed. Any var() of a name outside the manifest's semantic and component tokens fails, whatever its prefix. The FR-001 scan flags any custom property declared with a literal value, under any name, outside the token source. Add fixtures with unprefixed names.
(3) Record the real transitive license set in the ADR: MPL-2.0, MIT-0, Python-2.0, CC0-1.0, BSD-3-Clause, and svg-tags with only a legacy license field. Record the ENG-24 allowlist entries: fsevents now, esbuild later. Reword the ENG-21 open question to cover that whole set.
(4) The determinism check bypasses the task caches and packs with the repository's package manager.
(5) The fixture harness compares multisets of {file, line, column, code}.
(6) QA-06 is marked partial. The control registry is derived from the orientation file or DOM contract, and feature 001 ships only fixture registries. The ban on variant remapping and the keyword allowlist are recorded as constraints on the core feature.
(7) Fix the Node 20 end-of-life date (2026-04-30). Correct the Biome rejection reason (JS plugins exist, in preview). Add a revisit point at TS 7.1 stable.

Open questions remain only ENG-08 (TS floor and browser list) and the broadened ENG-21 license-set approval.

## EXTRA SOURCES
- https://registry.npmjs.org/vitest/5.0.5 — vitest 5.0.5 makes vite a required peer (^6.4.0 || ^7.0.0 || ^8.0.0; peerDependenciesMeta optional:false); engines node ^22.12.0 || ^24.0.0 || >=26.0.0; 5.0.0 published 2026-09-03, 4.1.12 published 2026-10-15.
- https://registry.npmjs.org/vite — vite 8.3.5 (latest, 2026-10-21) depends on postcss, rolldown, picomatch, tinyglobby and lightningcss; fsevents ~2.3.3 is an optional dependency; esbuild is an optional peer.
- https://registry.npmjs.org/fsevents/2.3.3 — fsevents 2.3.3 (MIT, darwin-only) declares an install script `node-gyp rebuild`, so it is an install-script dependency for ENG-24.
- https://registry.npmjs.org/svg-tags — svg-tags 1.0.0 (2014, a stylelint dependency) has no SPDX `license` field, only a legacy `licenses` array giving MIT.
- https://registry.npmjs.org/argparse — argparse 2.0.1 (via js-yaml, via cosmiconfig, via stylelint) is licensed Python-2.0.
- https://registry.npmjs.org/mdn-data — mdn-data (via css-tree, via stylelint) is licensed CC0-1.0.
- https://registry.npmjs.org/stylelint/17.16.0 — stylelint 17.16.0 depends on @csstools/css-tokenizer ^4.0.0, @csstools/css-parser-algorithms ^4.0.0, postcss-selector-parser ^7.1.5, svg-tags, cosmiconfig ^9 and css-tree ^3.2.1. Its only lifecycle script is prepare, which does not run on registry installs.
- https://registry.npmjs.org/stylelint-plugin-carbon-tokens — stylelint-plugin-carbon-tokens 5.0.6 has a postinstall telemetry script (ibmtelemetry), a further ENG-24 reason to reject it.
- https://registry.npmjs.org/typescript — typescript 7.0.2 is latest (2026-07-08); 7.1.0-beta was published 2026-10-20; 6.0.3 was published 2026-04-16; the 7.x line uses platform optionalDependencies and has no install scripts.
- https://registry.npmjs.org/@typescript/typescript6 — @typescript/typescript6 6.0.2 is a thin alias (@typescript/old: npm:typescript@^6), Apache-2.0.
- https://mcr.microsoft.com/v2/playwright/tags/list — The Playwright image tags v1.64.1-noble, -jammy and -resolute exist, matching @playwright/test 1.64.1.
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json — Node 20 end of life is 2026-04-30; Node 26 becomes LTS on 2026-10-28; Node 22 and 24 are LTS.
- https://biomejs.dev/linter/plugins/ — Biome supports GritQL plugins and JavaScript/TypeScript plugins; the JS plugins are in Developer Preview, with breaking changes possible in patch releases.
- https://esbuild.github.io/getting-started/ — esbuild still works when installed with --ignore-scripts, through its optional platform packages; only --ignore-scripts together with --no-optional breaks it.
- https://registry.npmjs.org/storybook — storybook 10.6.3 depends on esbuild, which has a postinstall script, so an ENG-24 allowlist entry for esbuild will be needed once Storybook is adopted, whichever Vite major is used.
- https://firefox-source-docs.mozilla.org/code-quality/lint/linters/stylelint-plugin-mozilla/rules/no-base-design-tokens.html — Mozilla's in-tree Stylelint rule no-base-design-tokens is another precedent for a token-aware custom rule that bans base (primitive) tokens. No maintained DTCG-manifest-driven Stylelint plugin was found, which supports building the rule in-house.
- https://github.com/tstyche/tstyche/releases — TSTyche 7.2.2 notes 'Use TypeScript v6 when v7 is installed'; 8.0.0-beta.0 (11 Oct) adds TypeScript 7 support as a breaking change.
