# token-build

## DECISION
Terrazzo 2.x used only as a library: `@terrazzo/parser` (parse DTCG 2025.10, Resolver Module, `{}` aliases, `$extends`, `$root`, `$ref`, broken-alias and cycle detection, `lint` and `build` hooks) plus `@terrazzo/token-tools` (subpath `/css`, value serialization to CSS). Exact version pinned in the range >=2.9.0 <3.0.0. Given the minimum publication window, 2.9.0 enters today; 2.10.0 shipped on 2026-10-21. Do not use `@terrazzo/cli` or the ready-made output plugins (`plugin-css`, `plugin-css-in-js`, `plugin-js`). Add `ajv` ^8.20 (draft-07) to validate the source against a versioned copy, with sha256, of the official DTCG 2025.10 JSON Schemas (`https://www.designtokens.org/schemas/2025.10/format.json` and `resolver.json`). The `uri-reference` and `json-pointer-uri-fragment` formats come in as custom validators; `ajv-formats` is optional.

Source format: `*.tokens.json` files (DTCG 2025.10) plus a `*.resolver.json` (`version: "2025.10"`) with the `brand` and `mode` modifiers. Color as a `{colorSpace, components, alpha?, hex?}` object. Dimension as `{value, unit}`. Aliases only with `{group.token}` keys in the semantic and component layers.

PatoDS writes a private tools package (e.g. `tools/tokens-build`, the "tools" layer in the ENG-01 layers file). The published package `@<prefixo>/tokens` depends on it only as a devDependency and ships with no runtime dependency. The tools package contains:

(1) Custom lint rules in the `lint` hook:
- a literal outside the primitive layer (FR-003);
- alias direction between layers, via `aliasOf`, `aliasChain` and `dependencies` (FR-004);
- naming: prefix, segments in fixed order per category, ASCII kebab only, CSS name collision (FR-005);
- coverage of the 11 categories (FR-006);
- single control-height scale (FR-007);
- parity of semantic keys across all brand×mode permutations via `resolver.apply` (FR-011);
- forbidding `$ref` JSON Pointer outside the primitive layer.

(2) Custom formatters in the `build` hook:
- one CSS per brand, with `[data-<prefixo>-brand]` and `[data-<prefixo>-mode]` selectors; the default combination only in the default brand's file; the nested-scope strategy of FR-012 to FR-014 is implemented here (FR-015, FR-017);
- an ESM module of `var(--<prefixo>-*)` references with .d.ts (literal union of names) and a separate entry with value maps per brand×mode, also with .d.ts (FR-016);
- a manifest token → CSS name/layer/category, consumed by the style lint (FR-022, FR-023) and by the pair check (FR-020, FR-021);
- a JSON and Markdown report with counts per category and the height scale per theme (FR-008).

(3) Deterministic writer: sorting by code point, never by locale; LF; no timestamp, absolute path or environment data. CI runs two builds and compares the sha256 values.

## RATIONALE
1) DTCG status on 2026-10-21. Version 2025.10 is the first stable one: a Final Community Group Report from 2025-10-28, with three modules (Format, Color and Resolver). It is a Community Group report, not a W3C standard. There is no later stable version; only the living draft in /TR/drafts/ exists.

The format fixes:
- `.tokens` or `.tokens.json` files, media type `application/design-tokens+json`;
- color as a `{colorSpace, components, alpha?, hex?}` object, with 14 spaces (srgb, oklch, display-p3 etc.), the `none` keyword and a 6-digit `hex` as fallback;
- dimension `{value, unit: px|rem}` and duration `{value, unit: ms|s}`;
- alias `{a.b}` only for a whole token, `$ref` JSON Pointer for subvalues, `$extends` for group inheritance, `$root` as a group's base value, `$type` inherited from the group and never inferred;
- names with no leading `$` and no `{`, `}` or `.`.

The Resolver (`.resolver.json`, `version` "2025.10") has `sets`, `modifiers` (with `contexts` and `default`) and `resolutionOrder`. The entry is `{modifier: context}`. This is the standard mechanism to model brand and mode as axes without duplicating files (FR-009, FR-010). The DTCG site publishes draft-07 JSON Schemas (`format.json` and `resolver.json`), which the spec text itself treats as non-normative. So the source is validated by the versioned official schema (literal proof of FR-002) and, as a second line, by the parser.

2) Terrazzo 2.0.0 (2026-03-17) announces full support for DTCG 2025.10, with resolvers. `@terrazzo/parser` exposes:
- a JS API without CLI (`defineConfig`, `parse`, `build`);
- `resolver.apply`, `listPermutations`, `isValidInput` and orthogonality detection;
- a `lint` hook with `create({tokens, report})`, for custom rules with configurable severity;
- a `build` hook with `outputFile` called several times, which allows one file per brand.

The parser and token-tools have few dependencies: momoa, colorjs.io, merge-anything, scule, picocolors, wildcard-match and @terrazzo packages. All are MIT, ISC or Apache-2.0 licensed, none is deprecated and none has an install script, which satisfies ENG-07, ENG-21 and ENG-24. Only the published packages were inspected in the registry; the full transitive tree still has to pass the CI checks.

3) Use only the library, not the CLI or the ready-made plugins:
- `plugin-css` merges the permutations into a single file per instance, with selectors assembled by strings in `prepare`, and requires `@terrazzo/cli` as a peer.
- The CLI brings vite, vite-node, chokidar, escodegen and @clack/prompts, and offers native Figma import, which contradicts the current DSN-01 premise (no routine imports variables into the repository).
- `plugin-js` generates a runtime `resolver.apply()`, not a static map, which puts code in the app bundle (ENG-04).

PatoDS's requirements are specific and no tool covers them: three layers and alias direction, segments in fixed order, key parity, one file per brand with only its selectors, default combination, per-axis nested scopes, a manifest for stylelint and contrast, a per-category report. They would have to be written anyway. Written as plugins over the parser's normalized model, each rule and formatter is a pure function with a unit test (QA-02), and the generated .d.ts is covered by a type test (QA-08).

4) Style Dictionary 5.7.0 (2026-10-16, Apache-2.0) is mature and widely used, but its 2025.10 support is incomplete. Issue #1590 is still open: color since 5.3.0, dimension since 5.4.0, duration and part of `$root` since 5.7.0; gradient pending; Resolver with no PR; `$extends` and `$ref` not handled. Without the Resolver, brand×mode would require custom loops with several instances, off the standard.

5) Isolation limits the risk. PatoDS's rules and formatters operate over an internal model (id, layer, category, `$type`, value per permutation, alias chain), behind a thin adapter. Swapping Terrazzo for Style Dictionary, once it has a Resolver, or for a custom parser costs only the adapter. Golden-output tests detect a behavior change on every update.

## ALTERNATIVES
- Style Dictionary 5.7.0 (Apache-2.0, 3 maintainers, about 1.15 million downloads per week): Incomplete DTCG 2025.10 support: issue #1590 is still open, no Resolver, with gradient pending and no handling of `$extends` or `$ref`. Brand×mode would require a custom loop over several instances, off the Resolver standard. The default file header carries a generation date and breaks byte-for-byte output if not turned off. It validates neither the DTCG schema nor layer and naming rules, so the custom validators and formatters would be needed anyway. It brings heavier runtime dependencies (prettier, tinycolor2 with no release since 2023). It stays as a swap-via-adapter alternative when the Resolver ships.
- Full Terrazzo: @terrazzo/cli with plugin-css, plugin-css-in-js and plugin-js as they come: plugin-css merges the permutations into a file per instance and does not on its own guarantee one file per brand with only its selectors, the default combination and per-axis nested scopes (FR-012, FR-013, FR-014, FR-017). plugin-js generates a runtime `resolver.apply()` instead of a static map (ENG-04). plugin-css-in-js's names and format are tied to plugin-css. plugin-css requires the CLI as a peer, and the CLI brings vite, vite-node, chokidar, escodegen and prompts into the toolchain, besides offering Figma import, contrary to the DSN-01 premise. Only the reuse of @terrazzo/token-tools/css serializers remains.
- A 100% custom compiler: JSON, Ajv and a custom implementation of alias, $extends, $ref, $root and Resolver: It would require reimplementing the most spec-sensitive part: $type inheritance, $extends merge, $root, JSON Pointer, resolution order and Resolver orthogonality, serialization of 14 color spaces. There is no mature, independent 2025.10 JS parser besides Terrazzo; Asimonim is in Go and the rest is immature. High cost and risk of diverging from the spec, with no functional gain. It stays plan B, because the custom rules and formatters run over an internal model behind an adapter.
- Style Dictionary with @tokens-studio/sd-transforms: Designed for the Tokens Studio format and coupled to a design tool, a choice that is the requester's open decision. It inherits Style Dictionary's gaps in 2025.10 (no Resolver).
- Asimonim (a DTCG parser and validator in Go): A toolchain outside TypeScript and Node in a TS monorepo, unproven maturity, and it generates no outputs. It would cover only validation.

## REQUIREMENT FIT
- FR-001 / TOK-01: A single source in `tokens/**/*.tokens.json` plus a `*.resolver.json`, in the DTCG 2025.10 format. The repository search for tokens outside the source (custom properties `--<prefixo>-` declared outside the generated files) is a separate check that uses the generated manifest.
- FR-002 / TOK-01: Ajv validates each file against the official DTCG 2025.10 format.json and resolver.json, versioned with sha256 and with no network in CI. The parser's `core/valid-*` rules serve as a second line. A schema error gives a non-zero exit code and blocks the merge.
- FR-003 / TOK-02: A custom lint rule: a token outside the primitive layer with no `aliasOf`, or a composite with a literal subvalue, is rejected with the token and the rule pointed out. The layer comes from the source set or directory, per the data-model.
- FR-004 / TOK-02: The parser fails on a nonexistent alias or a cycle. A custom rule walks `aliasChain` and `dependencies` and rejects a reference from a lower layer to a higher one. Another rule forbids `$ref` outside the primitive layer.
- FR-005 / TOK-04: A custom rule with the per-category segment grammar (fixed order), ASCII kebab only, and detection of CSS name collisions between distinct ids. Terrazzo's `core/consistent-naming` covers only the case and is not enough.
- FR-006, FR-008 / TOK-10, TOK-13: A custom rule requires at least one semantic token per category. The formatter generates the report (JSON and Markdown in CI) with the count per category and the height scale per brand×mode permutation.
- FR-007 / TOK-13: A custom rule validates that the control-height tokens form the defined closed set. The manifest exports that scale to the FR-023 stylelint rule.
- FR-009, FR-010 / TOK-07, TOK-08: Brand and mode are DTCG 2025.10 Resolver modifiers. Adding a brand is adding its context and token files, without touching code, which the diff proves. The build iterates all permutations via `resolver.apply`.
- FR-011 / TOK-09: A custom rule compares the semantic key sets of all permutations and flags a missing or extra key.
- FR-012, FR-013, FR-014 / TOK-14, ENG-06: The CSS formatter is custom, so the selector and per-scope redeclaration strategy (nearest axis, invalid value with no empty variable, default combination) can be implemented as the design requires. The strategy itself is decided in a separate topic.
- FR-015 / TOK-05: Custom properties `--<prefixo>-*` generated in the build and not versioned, with a check for a hand-edited generated file. The writer is deterministic and CI compares the sha256 of two builds.
- FR-016 / TOK-06: A custom formatter emits ESM of `var(--<prefixo>-*)` references with a .d.ts of literal types and, in a separate entry, ESM of per-brand×mode maps with .d.ts, generated as text and with no runtime. A nonexistent name fails the type test with @ts-expect-error (QA-08).
- FR-017 / ENG-06: One CSS file per brand via several `outputFile` calls, each with only that brand's selectors and both modes; the default combination goes only in the default brand's file. An automated check reads the manifest and confirms.
- FR-019, FR-020, FR-021 / A11Y-09: A custom checker over the per-permutation resolved model, using colorjs.io, which is already a transitive dependency. It composites alpha over the background and applies 4.5:1 for text and 3:1 for non-text. The pair manifest and the token manifest feed the FR-021 check.
- FR-022, FR-023, FR-024 / TOK-03, TOK-13: The manifest token → layer/category and the height scale generated in the build are the input for the stylelint rule, which is written separately.
- FR-025, FR-028 / DSN-01, DSN-04: The sync reads the same normalized ids and the same permutations (same name and hierarchy). Without @terrazzo/cli, there is no Figma import routine in the repository, which meets the current premise.
- ENG-01 / Principle XI: The generator lives in the tools package, a devDependency of the tokens package, which is published with no runtime dependencies. The tools → tokens edge goes into the layers file.
- ENG-07, ENG-16, ENG-17, ENG-21, ENG-24 / Principle IX: Direct dependencies (@terrazzo/parser, @terrazzo/token-tools, ajv) with MIT license, no deprecation and no preinstall, install or postinstall. The transitive tree verified in the registry has only MIT, ISC, Apache-2.0 and BSD. Exact versions in the frozen lockfile. The tokens tarball contains only the generated output, with no scripts.
- QA-02, QA-08 / Principle VII: Rules and formatters are pure functions with a unit test and deliberate-violation fixtures (SC-009). Golden outputs and .d.ts are covered by a type test.
- SC-002: Code-point sorting in the custom formatters, pinned Node (`engines` and `.nvmrc`), ASCII-only names and a double build in CI with different LANG and TZ and sha256 comparison.

## RISKS
- Terrazzo bus factor: a single npm publisher (drewpowers), about 57 contributors and about 76,000 weekly downloads of the parser, against 183 contributors and about 1.15 million for Style Dictionary. Mitigation: use only as a library behind an adapter and internal model, exact version, golden-output tests, MIT license (fork viable) and Style Dictionary as a swap when issue #1590 delivers the Resolver.
- Fast release cadence: from 2.8.0 to 2.10.0 in 8 days, and 2.10.0 shipped on 2026-10-21. Mitigation: exact version, a minimum publication window before adopting (e.g. pnpm's `minimumReleaseAge` or Renovate), changelog review and golden outputs in CI.
- Determinism: Terrazzo sorts with `Intl.Collator('en-us', {numeric:true})` (PR #863, 2.10.0), which depends on Node's ICU, and its utility-css uses the default locale (will not be used). `build()` runs plugins in parallel. Mitigation: the custom formatters sort by code point and do not depend on the parser's order, pinned Node and ICU, ASCII-only names enforced by lint, a double build with distinct LANG and TZ and sha256 comparison in CI.
- The DTCG 2025.10 JSON Schema is non-normative and may have bugs or lag behind the spec text. It uses `definitions` with an embedded `$id` and the `uri-reference` and `json-pointer-uri-fragment` formats. Mitigation: a versioned copy with sha256, double validation with the parser and a spike confirming that Ajv compiles the bundled schema.
- Spike needed before the plan: confirm via the JS API (`parse`/`build` with custom plugins, no CLI) that the custom rules' lint errors come out with their source location and a non-zero exit code, and that `resolver.apply` covers all brand×mode permutations.
- Brand×mode modeling in the Resolver: semantic values that depend on both axes make the modifiers non-orthogonal (order decides the value). Terrazzo 2.4+ orthogonality detection does not cover `$extends`. Decide in the data-model between (a) two orthogonal modifiers (brand defines role semantic tokens for both modes, mode chooses via a semantic → semantic alias) and (b) a single combined modifier. FR-011 parity runs over all permutations in both cases.
- The CSS strategy of per-axis nested scopes (FR-012 to FR-014, A → B → A alternation, invalid value with no empty variable) does not come from the tool and is the custom formatter's work. It depends on the browser list (ENG-08) and must be decided and tested in a real browser in a separate topic.
- The color output (oklch(), color(display-p3) or sRGB/hex fallback) depends on the not-yet-fixed browser list. The token-tools serializers have options (e.g. color depth, legacy hex), but the wrong choice breaks old browsers or loses gamut.

## OPEN QUESTIONS
- Target browser list (ENG-08, the "versioned list" premise with no values): it decides whether the generated CSS can use oklch() and color(display-p3) directly or needs an sRGB/hex fallback. It changes the color formatter's configuration and the nested-scope strategy.
- ENG-21 license policy: confirm that it accepts MIT, ISC, BSD-2-Clause, BSD-3-Clause and Apache-2.0 for build tools (non-distributed devDependencies). The chosen chain includes @humanwhocodes/momoa, under Apache-2.0.

## ADR
ADR-0NN — Token build pipeline: Terrazzo parser (DTCG 2025.10 + Resolver) as a library, with validation by the official JSON Schema and PatoDS's own validators/formatters

## SOURCES
- https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ — DTCG announces on 2025-10-28 the first stable version (2025.10), with theming and multi-brand, modern color spaces and aliases/inheritance.
- https://www.designtokens.org/tr/2025.10/ — The 2025.10 Technical Reports have three modules (Format, Color, Resolver), form a Final Community Group Report considered stable and cite no later version.
- https://www.designtokens.org/TR/2025.10/format/ — Format: alias {group.token} for a whole token, $ref JSON Pointer, $extends for groups, $root, dimension {value, unit px|rem}, duration {value, unit ms|s}, .tokens.json and application/design-tokens+json, name restrictions; the spec says a JSON Schema is still under study (non-normative).
- https://www.designtokens.org/TR/2025.10/color/ — Color as {colorSpace, components, alpha?, hex?}, 14 color spaces, the none keyword and a 6-digit hex as fallback.
- https://www.designtokens.org/TR/2025.10/resolver/ — Resolver: .resolver.json, version "2025.10", sets, modifiers (contexts/default), resolutionOrder and {modifier: context} entries; recommends orthogonal modifiers.
- https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/ — Final CG Report of the Format Module 2025.10, stable but off the W3C standards track.
- https://www.designtokens.org/schemas/2025.10/format.json — Bundled draft-07 JSON Schema of the DTCG 2025.10 format, published by DTCG, with subschemas per $id and uri-reference and json-pointer-uri-fragment formats (sha256 32e93b78… downloaded on 2026-10-21).
- https://www.designtokens.org/schemas/2025.10/resolver.json — Draft-07 JSON Schema of the Resolver 2025.10 (version const "2025.10", additionalProperties false).
- https://github.com/style-dictionary/style-dictionary/issues/1590 — Open DTCG 2025.10 support issue: Resolver with no PR, gradient pending, $root in a sub-issue, $extends and $ref not handled (last activity on 2026-10-16).
- https://github.com/style-dictionary/style-dictionary/releases — Style Dictionary 5.7.0 (2026-10-16) adds 2025.10 duration and $root handling; 2025.10 color landed in 5.3.0 and object dimension in 5.4.0.
- https://styledictionary.com/info/dtcg/ — Style Dictionary states that the 2025.10 format is not yet fully supported.
- https://styledictionary.com/reference/hooks/formats/#file-headers — Style Dictionary's default file header includes "Generated on <date>", which breaks byte-for-byte output if not turned off.
- https://app.unpkg.com/@terrazzo/parser@2.4.0/files/CHANGELOG.md — Terrazzo 2.0.0: full support for DTCG v2025.10 with resolvers, native Figma import, plugin-js remade as a resolver API; 2.4.0 adds orthogonality detection (without $extends).
- https://github.com/terrazzoapp/terrazzo/pull/863 — 2.10.0 swaps localeCompare for Intl.Collator('en-us',{numeric:true}) in sorting; utility-css uses Intl.Collator() with the default locale (determinism risk).
- https://terrazzo.app/docs/reference/js-api/ — @terrazzo/parser JS API without CLI: defineConfig, parse (returns tokens, sources and resolver), build (in-memory files); resolver methods apply, listPermutations, isValidInput.
- https://terrazzo.app/docs/reference/plugin-api/ — Hooks config, lint, transform, build and buildEnd; lint rules with create({tokens, report}); outputFile called several times; build runs in parallel; resolver.apply per permutation.
- https://terrazzo.app/docs/linting/ — Native rules (core/valid-*, core/consistent-naming case only, core/required-modes, a11y/min-contrast with pairs and level); severities error, warn and off.
- https://terrazzo.app/docs/guides/resolvers/ — Terrazzo models themes via the DTCG Resolver; plugin-css uses permutations {input, prepare}; recommends a combined modifier or orthogonal modifiers.
- https://terrazzo.app/docs/integrations/css/ — plugin-css generates one file (filename) with the combined permutations; options variableName, transform, skipBuild, colorDepth, legacyHex.
- https://terrazzo.app/docs/integrations/js/ — plugin-js generates tokens.js and .d.ts with a runtime resolver.apply(), not a static map.
- https://terrazzo.app/docs/integrations/css-in-js/ — plugin-css-in-js exports var(--…) references with .d.ts, with names tied to plugin-css.
- https://registry.npmjs.org/@terrazzo/plugin-css — @terrazzo/plugin-css 2.10.0 requires @terrazzo/cli as a peerDependency; the CLI depends on vite, vite-node, chokidar, escodegen and @clack/prompts.
- https://registry.npmjs.org/@terrazzo/parser — @terrazzo/parser 2.10.0 (MIT, 2026-10-21; 2.0.0 from 2026-03-17), light dependencies, no install scripts, a single maintainer on npm.
- https://registry.npmjs.org/style-dictionary — style-dictionary 5.7.0 (Apache-2.0), engines node >=22, runtime dependencies include prettier and tinycolor2; 3 maintainers.
- https://api.npmjs.org/downloads/point/last-week/style-dictionary — About 1.15 million weekly downloads of Style Dictionary, against about 76,000 for @terrazzo/parser (week of 2026-10-12 to 2026-10-18).
- https://github.com/terrazzoapp/terrazzo — Terrazzo repository: MIT, about 479 stars, about 57 contributors, push on 2026-10-21.
- https://registry.npmjs.org/ajv — ajv 8.20.0 (MIT, 2026-04-24), no install scripts.


# VERIFICATION: needs_changes
- [major] CLAIM: The custom rules run in Terrazzo's `lint` hook: a literal outside the primitive layer (FR-003), alias direction (FR-004), naming (FR-005) and key parity across all brand×mode permutations via `resolver.apply` (FR-011). The layer comes from the source set or directory. The `core/valid-*` rules serve as a second line.
  PROBLEM: Checked in the @terrazzo/parser 2.10.0 code, with the same flow in 2.9.0. When the input is a resolver, `loadResolver` does `tokens = resolver.apply(firstInput)`, i.e. only the default permutation, and `lintRunner` receives only those tokens. The rules' `create()` receives `{id, report, tokens, filename, sources, options}`, without `resolver`, so parity via `resolver.apply` inside the lint hook is impossible. Besides, in resolver mode the files are merged (bundle + `destructiveMerge`) and reprocessed as a synthetic JSON with the resolver file's name. As a result `token.source` does not point to the `.tokens.json`, the set or the source directory. Consequence: tokens and violations that exist only in non-default contexts (brand B, dark mode) pass the lint without error, including a literal in semantic, a forbidden alias and an off-standard name. A broken alias or cycle in those contexts only shows up if someone calls `apply` for them. The `core/valid-*` rules also cover only the default permutation. This breaks SC-001 and SC-009 in practice, and the proposed spike does not cover this case.
  CORRECTION: Run PatoDS's rules in a custom adapter, after `parse()`, over all permutations (`resolver.listPermutations()` + `resolver.apply()`). The build fails if `listPermutations` returns `undefined` due to `permutationLimit`. The layer comes from an explicit marker, such as the root group in the token path or a key in `$extensions`, or from a custom per-file index (id → file, line, layer) built during the read that Ajv already does. Errors with file and line come from that index. Use Terrazzo's hooks at most for `build`, which receives `resolver`. Spike criterion: a violation planted only in brand B's file and another only in dark mode must both be blocked.
- [minor] CLAIM: Style Dictionary: the default file header carries a generation date and breaks byte-for-byte output if not turned off.
  PROBLEM: Outdated information (it comes from v3). In style-dictionary 5.7.0, `lib/common/formatHelpers/fileHeader.js` sets `fileHeaderTimestamp: false` by default. The default header is just "Do not edit directly, this file was auto-generated.", with no date. The docs page still shows an old example with a timestamp.
  CORRECTION: Remove that reason from the Style Dictionary rejection. The rejection still stands on the other reasons: no Resolver, with `$extends`/`$ref` not handled and gradient pending in issue #1590, which is still open.
- [minor] CLAIM: plugin-css merges the permutations into a single file per instance and does not on its own guarantee one file per brand with only its selectors. The CLI, with Figma import, contradicts the DSN-01 premise.
  PROBLEM: `filename` is per instance and `prepare()` accepts any selector. Several instances, each with one brand's `permutations`, would give one file per brand. The DSN-01 argument is weak: the premise forbids a routine in the repository that imports variables, not a command available in an installed CLI. `core/consistent-naming` also accepts a custom validator function, it does not cover only the case. The repository has about 55 contributors (the number 57 is the count of open issues).
  CORRECTION: Reject plugin-css on the reasons that hold. It requires `@terrazzo/cli` as a peer, which brings vite, vite-node, chokidar, escodegen and @clack/prompts. The names and plugin-css-in-js are coupled to it. And PatoDS needs exact control over nested scopes, default combination, manifest and report, which are custom formatters anyway. Fix the statements about consistent-naming and contributors.
- [minor] CLAIM: The contrast checker uses colorjs.io, which is already a transitive dependency.
  PROBLEM: Importing a transitive dependency is a phantom dependency. With pnpm in strict isolation it does not resolve and it bypasses ENG-21, ENG-25 and ENG-07. colorjs.io is at 0.7.x (pre-1.0), subject to API breakage in a minor.
  CORRECTION: Declare `colorjs.io` as a direct devDependency of the tools package, with an exact version aligned to Terrazzo's `^0.7.1` range, owner approval (ENG-25) and golden tests on the contrast ratios.
- [minor] CLAIM: Exact Terrazzo version in the range >=2.9.0 <3.0.0 (2.9.0 today); `ajv` ^8.20.
  PROBLEM: @terrazzo/parser 2.9.0 declares `@terrazzo/token-tools ^2.9.0` and `@terrazzo/token-types ^2.9.0`. Without an override, the lockfile may resolve 2.10.0 as transitive (published today), with mixed copies, despite the direct pin. The minimum publication window is not defined in any requirement, and `ajv ^8.20` contradicts the exact-version policy.
  CORRECTION: Pin all `@terrazzo/*` to the same exact version via pnpm `overrides`, and ajv to an exact version too. Configure `minimumReleaseAge` (pnpm 10.16+; `minimumReleaseAgeStrict` in pnpm 11) with a value recorded in the repository, and upgrade only together with the changelog and the golden outputs.
- [minor] CLAIM: Determinism guaranteed by code-point sorting, pinned Node and ICU and a double build with distinct LANG and TZ. The ICU risk comes from PR #863 in 2.10.0.
  PROBLEM: (a) The parser's `defaultReq` does `fetch()` for a non-`file:` `$ref`, i.e. network at build time, which harms determinism and the supply chain. (b) 2.9.0 already used `localeCompare(b, 'en-us', {numeric:true})`, so the ICU dependency is not new in 2.10.0. (c) ENG-08 requires a matrix with the floor and the latest Node version, and pinning a single Node version does not prove the outputs are identical across the two.
  CORRECTION: Pass `parse()` a custom `req` that rejects non-`file:` URLs and remote `$ref`. Compare the sha256 of the outputs also between the floor Node and the latest in the matrix. Keep the custom code-point sorting.
- [minor] CLAIM: The parser covers DTCG 2025.10's `$extends` and `$root`, and the sync uses the same normalized ids (FR-025, FR-028).
  PROBLEM: Terrazzo removes `.$root` from the id (`parse/token.js`: `replace(/\.\$root$/, '')`), while the spec addresses `group.$root`. It also accepts `$extends` only as a string, although the official schema allows the JSON Pointer object form. This affects the naming convention, the name-and-hierarchy mapping in the design tool (DSN-04) and validation: Ajv accepts a form the parser rejects.
  CORRECTION: In the convention and the lint: only `$extends` in brace form and an explicit rule for `$root`, which may be to forbid it or to map it in a documented way to the CSS name and the tool's name. Cover both cases with fixtures.
- [minor] CLAIM: The spike needs to confirm that Ajv compiles the bundled schema. There is no other conformance guarantee besides the parser.
  PROBLEM: Omitted asset: the official design-tokens/community-group repository has `test-suite/tests/2025.10` (positive and negative fixtures for format and resolver). The `schemas` package already tests the bundled schemas with Ajv + ajv-formats (`validate-ajv.test.ts`), which reduces the spike risk. The schemas copied into the repository are under the W3C Software and Document License, outside the MIT/Apache/BSD list.
  CORRECTION: Use the official test-suite as the adapter's conformance gate and on every Terrazzo upgrade, together with the golden outputs. Record the origin and the W3C license of the schema copy in the third-party notices and in the ENG-21 policy.
- [minor] CLAIM: Semantic key parity (FR-011) checked over the resolved permutations.
  PROBLEM: If any shared set has semantic values, a key missing in brand B's context is inherited from the base set. The resolved permutation has the key and parity passes, but brand B uses a value it did not define, which masks the omission TOK-09 wants to block.
  CORRECTION: In the data-model, forbid semantic values in shared sets (only primitives or components) or check parity also over the keys each brand and mode context contributes, besides the resolved permutations.
- [minor] CLAIM: The tools → tokens edge goes into the layers file.
  PROBLEM: The real dependency is the reverse: the `@<prefixo>/tokens` package depends, as a build devDependency, on the tools package. ENG-01 deals with tools depending on the UI. There is a cycle risk if the package that consumes the manifest (stylelint, pair check) is the same as the generator.
  CORRECTION: Explicitly declare the "tokens → tools/tokens-build (dev only)" edge. Keep the generator separate from the lint and contrast package, which consumes `@<prefixo>/tokens`'s manifest as a devDependency, so as not to close a cycle.
- [minor] CLAIM: open_questions: ENG-21 license policy (confirm MIT, ISC, BSD and Apache-2.0).
  PROBLEM: ENG-21 does not appear in "Assumptions and open decisions". Only the published packages' license (ENG-22) is the requester's decision. The license policy is a versioned file written by the vendor, with owner approval. The question is not the requester's sole responsibility.
  CORRECTION: Remove the question from open_questions and create a task in the plan to write the versioned policy. Keep only the browser list (ENG-08), which is the Client's decision.

## REVISED DECISION
Keep @terrazzo/parser and @terrazzo/token-tools (subpath /css) 2.x only as a library. All `@terrazzo/*` stay at the same exact version via pnpm `overrides`: 2.9.0 today, with `minimumReleaseAge` recorded in the repository. Add `ajv` at an exact version and versioned copies, with sha256, of DTCG 2025.10's `format.json` and `resolver.json`. Do not use `@terrazzo/cli` or the ready-made plugins: plugin-css requires the CLI as a peer, and the CLI brings vite, chokidar and escodegen. Central change: PatoDS's rules (FR-003, FR-004, FR-005, FR-006, FR-007, FR-011 and the ban on `$ref` outside the primitive layer) do not live in the `lint` hook, which sees only the default permutation, does not receive the resolver and, in resolver mode, loses the per-file origin. They run in a custom adapter after `parse()`, over all permutations (`resolver.listPermutations()` + `apply()`, failing if the list comes back undefined). The layer comes from an explicit marker (root group or `$extensions`) or from a custom per-file index built during the Ajv read, which also gives file and line in errors. The custom formatters (CSS per brand, ESM of `var()` and of maps with .d.ts, manifest, report) run in the adapter or in the `build` hook, which receives the resolver. The writer is deterministic: code point, LF, no timestamp and no absolute path. `parse()` receives a `req` that blocks non-`file:` `$ref`. The sha256 is compared between two builds and between the floor Node and the latest in the matrix. The official DTCG 2025.10 test-suite and the golden outputs act as a gate on every upgrade. `colorjs.io` enters as a direct devDependency for contrast. The convention accepts only `$extends` in brace form and has an explicit rule for `$root`. The shared sets carry no semantic values, or parity is checked per context too. Style Dictionary 5.7.0 stays as a swap-via-adapter when it delivers the Resolver (issue #1590), without the timestamp argument, which is false in v5. Open question for the requester: only the browser list (ENG-08).

## EXTRA SOURCES
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/resolver/load.js — In resolver mode, parse() loads `tokens = resolver.apply(firstInput)`, only the default permutation. Those are the tokens passed to the lint.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/parse/index.js — `lintRunner({tokens, sources, config, logger})` runs inside parse(), before the final resolver, and does not receive a resolver. `defaultReq` does fetch() for non-file: URLs.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/lint/index.js — `rule.create` receives {id, report, tokens, filename, sources, options}, without a resolver.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/resolver/create-resolver.js — `apply()` merges the sources with destructiveMerge and reprocesses as synthetic JSON with the resolver file's name, losing the per-file origin.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/parse/token.js — Terrazzo removes `.$root` from the token id and accepts `$extends` only as a string.
- https://unpkg.com/@terrazzo/parser@2.9.0/dist/lib/array.js — 2.9.0 already sorted with localeCompare(b, 'en-us', {numeric:true}), ICU-dependent.
- https://registry.npmjs.org/@terrazzo/parser/2.9.0 — The parser 2.9.0 declares @terrazzo/token-tools ^2.9.0 and @terrazzo/token-types ^2.9.0 (caret ranges, which require an override to align).
- https://unpkg.com/style-dictionary@5.7.0/lib/common/formatHelpers/fileHeader.js — Style Dictionary 5.7.0: fileHeaderTimestamp is false by default, and the default header carries no date.
- https://github.com/design-tokens/community-group/tree/main/test-suite — Official DTCG 2025.10 conformance test-suite (format and resolver, positives and negatives).
- https://github.com/design-tokens/community-group/tree/main/schemas — The official schemas are bundled and tested with Ajv + ajv-formats (validate-ajv.test.ts).
- https://raw.githubusercontent.com/design-tokens/community-group/main/LICENSE.md — Reports under the W3C Software and Document License and test software under the W3C 3-clause BSD.
- https://pnpm.io/settings — pnpm minimumReleaseAge (since 10.16.0), minimumReleaseAgeExclude and minimumReleaseAgeStrict (11.0).
- https://terrazzo.app/docs/integrations/js/ — plugin-js generates a lookup resolver.apply() with all permutations precomputed in a module and is recommended for the server.
- https://api.github.com/repos/terrazzoapp/terrazzo — Terrazzo repository with MIT license, 479 stars and 57 open issues; about 55 contributors per the contributors API.
