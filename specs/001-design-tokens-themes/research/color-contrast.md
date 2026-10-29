# color-contrast

## DECISION
Use colorjs.io 0.7.1 (MIT, zero dependencies, pinned to that exact version in the tools layer) wrapped in one in-repo adapter module (tools/color). It parses DTCG 2025.10 color values in all 14 colorSpaces, converts them to gamma-encoded sRGB and gamut-maps with the CSS Color 4 algorithm (toGamut method "css", deltaEOK JND 0.02). The token CSS generator's color transform and the contrast checker both call the same adapter function, toEmittedSrgb(): use the DTCG hex if present, else the gamut-mapped components, then quantize to 8 bits. So the value we measure is the value the CSS emits.

Measure with our own small WCAG 2.2 module rather than a library contrast function: linearization threshold 0.04045, coefficients 0.2126/0.7152/0.0722, ratio (L1+0.05)/(L2+0.05), and no rounding before the comparison. Before measuring, apply source-over alpha compositing in gamma-encoded sRGB over a background stack that must end in an opaque surface.

The manifest is versioned JSON validated by a JSON Schema. Each pair has id, fg, bg (an ordered stack or a named surface set), state, and kind (text or non-text). Every pair is measured in every brand×mode permutation, taken from the same permutation source the CSS generator uses. The minimums come from the QA-14 thresholds file: under WCAG22-AA, text 4.5 and non-text 3, focus included.

FR-021 is a custom stylelint rule (stylelint ^17.16.0 with @csstools/css-tokenizer and @csstools/css-parser-algorithms ^4.0.2). It merges declarations per subject and state. When the background is not declared on the same subject, the rule requires an explicit background annotation. A real-browser cross-check backs it up: getComputedStyle on swatches from the packed tarball, plus axe in A11Y-02.

## RATIONALE
1) DTCG color format, verified. DTCG 2025.10 (published 2025-10-28) is the first stable release, and there is no 2026 version. A color $value is {colorSpace, components, alpha?, hex?}. The colorSpace values are srgb, srgb-linear, hsl, hwb, lab, lch, oklab, oklch, display-p3, a98-rgb, prophoto-rgb, rec2020, xyz-d65 and xyz-d50. Components are numbers or "none". alpha defaults to 1. hex is an optional 6-digit sRGB fallback. Gamut mapping is explicitly non-normative and left to tools, so PatoDS has to fix one deterministic policy and record it in an ADR.

2) Why colorjs.io.
- Accuracy: Chris Lilley and Lea Verou maintain it; both edit the CSS Color spec. It implements the CSS Color 4 conversions and gamut mapping (toGamutCSS with deltaEOK JND 0.02; raytrace has been available since 0.7).
- Coverage: it supports all 14 DTCG spaces natively. Id map: display-p3→p3, a98-rgb→a98rgb, prophoto-rgb→prophoto, others identical. DTCG "none" maps to null since 0.6. HSL s/l and Lab L use the same 0–100 ranges as DTCG.
- Maintenance: actively maintained (0.7.1 released 2026-07-24, commits in Oct 2026).
- Supply chain: MIT, zero runtime dependencies, no install scripts, ships its own TypeScript types.
- Ecosystem: it is already the color engine of both leading DTCG builders. @terrazzo/token-tools 2.10 uses ^0.7.1 (it moved off culori in 2.0); style-dictionary 5.7 uses ^0.5.2. So we add no new engine family.
- Size: 15.8 MB unpacked does not matter. It is a devDependency of the tools layer and never ships in a tarball (ENG-01, ENG-17).

3) Why our own WCAG module and compositing instead of a library contrast function.
- colorjs.io contrastWCAG21 takes luminance as XYZ-D65 Y from the matrix row 0.21263900587…, not WCAG's normative 4-decimal coefficients. It ignores alpha and does not gamut-map, so it can flip a result right at a threshold. culori's wcagContrast also ignores alpha.
- The normative formula is about 20 lines. Unit tests (QA-02) cover the WCAG vectors: #767676 on #fff = 4.542 passes, #777777 on #fff = 4.478 fails, black on white = 21. They also cross-check against colorjs within 1e-4 for opaque in-gamut colors.
- WCAG 2.2 uses the 0.04045 threshold (0.03928 before May 2021). The Understanding doc says ratios must not be rounded (4.499 fails 4.5).

4) Algorithm, for each brand×mode permutation and each manifest pair:
(a) Resolve aliases to DTCG color values. A missing token is an error, which complements the TOK-09 key check.
(b) Run each value through toEmittedSrgb(): hex if present, else CSS Color 4 gamut mapping of the components to sRGB. Alpha is kept.
(c) Background: bg is an ordered stack, bottom to top, and the bottom layer must have alpha 1. Fold upward with B = a·L + (1−a)·B per channel in gamma-encoded sRGB. This is CSS Compositing "simple alpha compositing" with an opaque backdrop, which is what browsers and axe-core do. A layer may carry an opacity token to model the CSS opacity property.
(d) Foreground: F = a·fg + (1−a)·B.
(e) Compute the ratio twice, on the float composite and on the 8-bit-rounded composite (axe rounds), and gate on the minimum.
(f) Fail when ratio < minimum[kind]. Text needs 4.5 and non-text needs 3, including focus indicators, measured against the adjacent color per Understanding 1.4.11. For an outer ring that is the surface the component sits on; for an inset ring it is the component's own background. The manifest lists both when both apply.
(g) Write the report as JSON plus a text table, sorted by pair id, brand and mode. It has no timestamps, uses locale-free number formatting, and truncates displayed ratios to 2 decimals so 4.4996 never prints as 4.50. The output is byte-identical across runs and is kept as ACE-02 evidence.

5) Translucent backgrounds. A pair is valid only when its stack ends in an opaque surface. When a translucent token (scrim, hover tint, overlay) can sit on several surfaces, the manifest names a surface set (e.g. "@surfaces"). The checker expands it to one measured case per opaque surface in that mode, and every case must pass (worst case by enumeration).
- An unterminated stack is an error. The checker never assumes white, because WCAG's "white is assumed" default is unsafe with dark mode.
- Why an unknown backdrop cannot pass: as the backdrop goes from black to white, the composited luminance sweeps an interval. If the foreground's luminance falls inside that interval, the worst case is 1:1. Example: white text on a black 50% scrim measures 3.98 over a white page but 21 over black.

6) Out-of-gamut colors. Browsers do not reliably run the CSS Color 4 mapping: most clip or use platform mapping. Some macOS browsers even composite in display-p3, and the CSSWG resolved in Aug 2025 to add new gamut-mapping algorithms. So the generator should emit the sRGB value produced by the shared adapter, and what we measure is then what every browser renders.
- If wide-gamut CSS is ever emitted as an extra variant, the checker must also measure that variant and gate on the minimum across variants. That variant's luminance would be CIE Y, a documented extension because WCAG 2.x defines sRGB only.
- The adapter serializes 8-bit hex itself and never relies on the library's default precision of 5.

7) Manifest (FR-019).
- Location and schema: a file such as packages/tokens/contrast/manifest.json, with a $schema field and a schemaVersion field.
- Order and identity: entries sorted by id; duplicates are rejected.
- Token references: fg and bg reference only semantic or component tokens, never primitives or literals (TOK-02, TOK-03).
- States: state values come from a versioned state vocabulary shared with the FR-021 rule (default, hover, active, focus-visible, selected, invalid…).
- Ownership: CODEOWNERS gives the manifest to the a11y owner (GOV-09).
- Minimums: they live in the QA-14 thresholds file as {level: "WCAG22-AA", text: 4.5, nonText: 3}. The checker asserts they match the declared level, so they cannot be lowered silently.

8) FR-021 static checker. It is a rule in the same custom stylelint plugin as FR-022 and reuses its var()→token resolution from the generated token index.
- Subjects: rules are grouped by subject, meaning the selector with state segments stripped (:hover, :focus-visible, :disabled, [aria-*], [data-<prefixo>-state=…]). States map to manifest states, and state rules override the base rule within the subject.
- Extraction: foreground properties are color and -webkit-text-fill-color (text) and border-*-color, outline-color, fill, stroke and accent-color (non-text), all from a versioned list. Backgrounds are background-color and the color inside the background shorthand. currentColor resolves to the subject's color. Local custom-property indirection inside the same file is resolved.
- Pairing: when fg and bg are on the same subject, they form the pair. When fg or bg is declared alone, or the property is outline or a focus ring, the rule requires an explicit annotation such as /* <prefixo>-contrast: on color-bg-surface | @surfaces */. This follows the WCAG note that declaring a text color without a background is a failure.
- Results: the canonical (fg, bg, state, kind) tuple must exist in the manifest. Unresolvable expressions (color-mix(), light-dark(), relative color syntax, gradients or images under text, var() from another file) produce an error, not silence. @media (forced-colors: active) blocks are skipped.
- Proof: valid and invalid fixtures prove 100% of expected errors and zero false positives.
- Limits: static analysis cannot see DOM nesting across components, consumer overrides, inline styles, ancestor opacity or blend modes, or images. Annotations can be wrong. That is why axe color-contrast runs in a real browser (A11Y-02, QA-01) as the backstop.

9) Real browser (Principle VII). A Playwright story or test renders a swatch per manifest pair for each brand×mode from the packed tarball (QA-06). It asserts that getComputedStyle colors equal the checker's emitted sRGB values, which proves generator, cascade and checker agree, and it runs axe on the swatches.

10) Determinism. The functions are pure, with sorted iteration, an exact library pin, a frozen lockfile and a pinned Node toolchain. V8 math is deterministic for a given version. Changing the gamut-mapping method or the library version changes emitted bytes, so it goes through PR review with visual regression (QA-04).

## ALTERNATIVES
- culori 4.0.2 (MIT, zero deps, CSS Color 4 toGamut, exact WCAG coefficients): Accurate and permissive, but its last release was 2025-06-27, about 16 months ago. Types come from a separate @types/culori package, an extra dependency to keep in step. Terrazzo dropped it for colorjs.io in 2.0, so it would add a second color engine next to whichever DTCG builder is chosen. It is the runner-up: its API is close enough that swapping it in behind the adapter would be a small change.
- @texel/color 1.1.11 (MIT, very fast, OKLCH gamut mapping): It has no built-in CIE Lab, LCH, HSL or HWB, which are 4 of the 14 DTCG colorSpaces; we would have to write custom spaces. Its gamut mapping is Ottosson's approximation, not the CSS Color 4 algorithm, and speed does not matter here.
- chroma-js 3.2.0 (BSD-3-Clause AND Apache-2.0): It does not document display-p3, a98-rgb, prophoto-rgb, rec2020, xyz-d50, hwb or CSS color() support, so it cannot read every DTCG color. It has no CSS Color 4 gamut mapping, and its dual license complicates the license policy for no gain.
- color 5.x, tinycolor2 1.6.0, wcag-contrast 3.0.0: They are effectively sRGB-only or limited-space libraries. tinycolor2 was last released in 2023 and wcag-contrast in 2022. None can parse or gamut-map the DTCG wide-gamut spaces.
- APCA (apca-w3 0.1.9) or another WCAG 3 draft metric as the gate: The premise is WCAG 2.2 AA (A11Y-01), and APCA is not its conformance metric. The npm license is 'Limited W3 License', outside an MIT/Apache/BSD/ISC policy (ENG-21). The package was last published in 2022.
- Use the token builder's built-in contrast lint (Terrazzo a11y/min-contrast) or colorjs.io contrastWCAG21 directly: Terrazzo's rule checks pairs on the default $value only. It does not iterate brand×mode, does no alpha compositing, has no states or background stacks, and calls contrastWCAG21. contrastWCAG21 uses XYZ-matrix luminance instead of the WCAG coefficients, ignores alpha and does not gamut-map. FR-020 needs compositing and every permutation measured.
- Composite in linear light (physically correct) instead of gamma-encoded sRGB: Browsers composite per CSS Compositing in gamma-encoded sRGB for web compatibility, and axe-core does the same. Compositing in linear light would measure something users never see and would disagree with the A11Y-02 axe results.
- Assume a white backdrop (WCAG default) or skip pairs whose background stack is translucent: This is unsafe with dark mode: white on a 50% black scrim measures 3.98 over white but 21 over black. A stack that ends in an unknown backdrop cannot be shown to pass in general, so the stack must end in an opaque surface or a named surface set that is enumerated.
- Emit wide-gamut CSS (oklch or color(display-p3)) and measure only the authored value or its clipped sRGB: Browsers render out-of-gamut values inconsistently (clipping, platform mapping, P3 compositing on macOS), and the CSSWG is still changing the gamut-mapping algorithms. The measured value would not equal the rendered one. Emitting the adapter's sRGB keeps them identical.
- FR-021 by pairing color and background-color in the same rule only: In real components the text color and its background often sit on different selectors or states, and focus rings sit on the parent surface. Rule-only pairing would miss pairs or invent false ones. Kept as one input to the subject+state merge, not as the whole mechanism.
- FR-021 by annotating every color declaration with its background: Verbose, and every annotation can drift. Annotations are required only when the background cannot be derived from the same subject.
- FR-021 by token naming convention (Material-style on-X tokens imply the pair): It would constrain the TOK-04 naming convention, which is decided elsewhere, and many pairs (borders, focus rings over several surfaces, translucent tints) do not fit. It can be an extra signal but not the gate.
- FR-021 from a per-component color contract inside the DOM contract (CMP-14): The DOM contract belongs to the component feature and does not exist yet. The rule's annotation format is designed so annotations can later be generated from that contract without changing the rule.
- FR-021 only at runtime (Playwright or axe walks stories and maps computed colors back to tokens): Mapping computed values back to tokens is ambiguous when tokens share values, and coverage depends on which stories exist, so it is not a deterministic static check. It is kept as the backstop (A11Y-02) and the swatch cross-check.

## REQUIREMENT FIT
- A11Y-09: Versioned manifest plus a checker that measures every pair in every brand×mode with alpha composited first. Failing pairs fail the build. The stylelint rule proves that every pair used in the core is in the manifest once the core exists.
- FR-019: manifest.json with a JSON Schema and schemaVersion. Each pair has id, fg, bg stack or surface set, state from a shared vocabulary, and kind text|non-text. Sorted and unique. Owned by the a11y owner in CODEOWNERS.
- FR-020: Checker iterates the generator's permutation list (brand×mode). Source-over compositing in gamma-encoded sRGB over a stack that ends in an opaque surface, then the WCAG 2.2 ratio with no rounding. Text needs 4.5 and non-text needs 3 (focus measured against adjacent colors per Understanding 1.4.11). Fixtures cover a known failing pair and a translucent pair, which makes US4 scenarios 1–3 testable.
- FR-021: Custom stylelint rule using subject+state merging and explicit background annotations, with valid and invalid fixtures (100% expected errors, 0 false positives). Same plugin as FR-022. Applied to the core when it exists.
- A11Y-01 (premise WCAG 2.2 AA): The minimums table is keyed by level (WCAG22-AA: text 4.5, nonText 3). The checker asserts the configured values match the declared level, so a level change is one approved edit.
- QA-14 / Principle VII thresholds file: Contrast minimums are read from the single versioned thresholds file, not from code, so changing them needs the approval QA-14 requires.
- TOK-05 / FR-015 (byte-identical output): Generator and checker share toEmittedSrgb(): fixed gamut method 'css', 8-bit hex written by our own code, exact library pin. The report is sorted, has no timestamps and uses locale-free formatting.
- TOK-09 / FR-011: A manifest token missing in any permutation is a checker error, which complements the key-parity check.
- TOK-02, TOK-03 / FR-022: The manifest may reference only semantic or component tokens. The FR-021 rule reuses FR-022's var()→token resolution, and literals or primitives are already blocked there.
- QA-02: Unit tests for the adapter (14 spaces, none→null, gamut mapping), compositing, the WCAG module (reference vectors, cross-check against colorjs within 1e-4) and the rule fixtures.
- QA-01 / ADR-08 / QA-06: Real-browser swatch test from the packed tarball: getComputedStyle equals the emitted sRGB, plus axe color-contrast. axe in A11Y-02 backs up the static check's limits.
- ENG-07, ENG-16, ENG-21, ENG-24: colorjs.io, stylelint, @csstools/* and postcss are all MIT with no install scripts and none deprecated; colorjs.io has zero dependencies. Exact pin and frozen lockfile.
- ENG-01 / ADR-09: The adapter, checker and stylelint plugin live in the tools layer, consume the tokens package build output, and are never runtime dependencies of UI packages.
- SC-008, SC-009: The gate requires 100% of pairs to pass. A deliberately failing pair, a translucent pair, an unterminated stack and a CSS pair missing from the manifest are each blocked by fixtures.
- ACE-02: The deterministic JSON report and the stylelint run are CI checks linked in the traceability matrix.
- GOV-07: Recorded as an ADR: library, gamut policy, compositing space and the static-check approach.

## RISKS
- colorjs.io is pre-1.0: 0.6 and 0.7 both had breaking minors (none became null; bundles removed). Mitigation: exact pin, all use goes through the tools/color adapter, golden-vector tests, and upgrades in their own PR with a diff of the emitted values.
- Generator and checker could drift if the DTCG builder uses its own internal color transform (style-dictionary 5.7 bundles colorjs.io ^0.5.2 plus tinycolor2; Terrazzo bundles ^0.7.1). Mitigation: the generator's color transform must call the shared adapter, and the browser swatch test asserts emitted equals measured.
- Browser compositing and gamut behavior is implementation-defined at the edges: some macOS browsers composite in display-p3, and out-of-gamut values are clipped or platform-mapped. Mitigation: emit sRGB only, gate on the minimum of the float and 8-bit composites, and rely on axe in a real browser as a cross-check. A small residual risk remains for translucent colors on P3 displays.
- The CSS Color 4 gamut-mapping algorithm is still changing (CSSWG resolution Aug 2025). Switching method later changes emitted bytes and appearance, so treat it as a visual change via QA-04.
- Static FR-021 limits: annotations can be wrong. Inheritance across components, consumer overrides, ancestor opacity or blend modes, and images or gradients are invisible to it. Mitigation: unresolvable expressions are errors, annotations are reviewed, and axe color-contrast runs in a real browser (A11Y-02).
- Annotation burden in the core could push authors toward the @surfaces macro too often, which multiplies measured cases and can produce many pair failures. Mitigation: keep surface sets small per mode and review them in the manifest PR.
- Near-threshold pairs (for example 4.50x) may pass the token check but fail axe because of rounding, or the reverse. Taking the minimum of the float and 8-bit results reduces this but cannot remove it entirely.
- If brands are delivered in wide-gamut colors, mapping them to sRGB changes how they look. This needs explicit acceptance (see open questions).

## OPEN QUESTIONS
- Disabled or inactive states: WCAG 1.4.3 and 1.4.11 exempt inactive UI components from contrast. Should PatoDS (a) leave disabled-state pairs out of the gate (the FR-021 rule skips disabled-state selectors and they are reported only), or (b) gate them anyway, which is stricter than WCAG 2.2 AA? Proposed default until you answer: (a).
- Will any brand palette for v1.0 be delivered in wide-gamut colors (display-p3 or OKLCH outside sRGB)? If so, is rendering them as sRGB, mapped deterministically with the CSS Color 4 algorithm, acceptable for v1.0? The alternative is extra wide-gamut CSS output, with each emitted variant measured separately.

## ADR
ADR-NNN: Motor de cor e checagem de contraste dos tokens (colorjs.io via adaptador único, WCAG 2.x com composição alfa sobre pilha de fundo opaca, manifesto de pares e regra stylelint de pares)

## SOURCES
- https://www.designtokens.org/tr/2025.10/color/ — DTCG Color Module 2025.10 (2025-10-28, stable): $value = {colorSpace, components, alpha?, hex?}; 14 colorSpace ids; 'none' components; alpha defaults to 1; hex is a 6-digit fallback; gamut mapping guidance is non-normative and tool-defined.
- https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ — First stable DTCG spec (2025.10), with P3, OKLCH and all CSS Color 4 spaces; no newer release found.
- https://www.designtokens.org/tr/2025.10/resolver/ — DTCG Resolver Module 2025.10: modifiers with contexts (e.g. brand, mode); permutations are the product of contexts. This is the source for enumerating brand×mode.
- https://www.w3.org/TR/WCAG22/ — WCAG 2.2 REC (2024-12-12): relative luminance uses 0.04045 (0.03928 before May 2021) and coefficients 0.2126/0.7152/0.0722; contrast ratio (L1+0.05)/(L2+0.05); declaring a text color without a background color is a failure (contrast ratio note 4).
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html — Computed ratios must not be rounded (4.499:1 fails 4.5:1); inactive UI components are exempt; contrast is measured against the background the text is rendered on.
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — Focus indicators need 3:1 against adjacent colors: an outer indicator against the surface the component is on, an inner one against the component's colors; inactive components are exempt.
- https://www.w3.org/TR/compositing-1/ — Simple alpha compositing: co = Cs·αs + Cb·αb·(1−αs); αo = αs + αb·(1−αs).
- https://lists.w3.org/Archives/Public/public-colorweb/2021Jan/0024.html — Chris Lilley: the CSS Compositing spec requires operations in gamma-encoded sRGB, for backward compatibility.
- https://lists.w3.org/Archives/Public/public-fxtf-archive/2023Jul/0007.html — Some macOS browsers composite in display-p3 on capable displays, so legacy compositing space is effectively implementation-defined.
- https://lists.w3.org/Archives/Public/public-css-archive/2025Aug/0486.html — CSSWG resolved (2025-08-19) to add two gamut-mapping algorithms to css-color-4; the algorithm is still changing.
- https://lists.w3.org/Archives/Public/public-css-archive/2024Jan/0728.html — Implementers shipped CSS Color 4 spaces but not the spec's gamut mapping; browsers mostly clip or use platform mapping.
- https://raw.githubusercontent.com/dequelabs/axe-core/develop/lib/commons/color/flatten-colors.js — axe-core composites source-over on gamma-encoded sRGB values and rounds the result to 8 bits.
- https://www.npmjs.com/package/colorjs.io — colorjs.io 0.7.1 (2026-07-24): MIT, no dependencies, no install scripts, bundled types; maintainers include Lea Verou and Chris Lilley.
- https://github.com/color-js/color.js/releases — 0.6.0 changed none from NaN to null (breaking); 0.7.0 removed prebuilt bundles (breaking) and added the raytrace gamut method; the library is actively released.
- https://colorjs.io/docs/gamut-mapping — toGamut defaults to the 'css' method (CSS Color 4 binary search in OKLCh); 'clip' is not recommended.
- https://unpkg.com/colorjs.io@0.7.1/src/toGamut.js — toGamutCSS uses deltaEOK with JND 0.02; raytrace method present; default gamut_mapping is 'css' and default serialization precision is 5.
- https://unpkg.com/colorjs.io@0.7.1/src/contrast/WCAG21.js — contrastWCAG21 uses XYZ-D65 Y (matrix coefficients 0.21263900587…) and ignores alpha; no gamut mapping.
- https://colorjs.io/docs/spaces — Color.js space ids: srgb, srgb-linear, hsl, hwb, lab, lch, oklab, oklch, p3, a98rgb, prophoto, rec2020, xyz-d65, xyz-d50; HSL s/l and Lab L use 0–100.
- https://www.npmjs.com/package/culori — culori 4.0.2, MIT, last release 2025-06-27; no dependencies.
- https://unpkg.com/culori@4.0.2/src/wcag.js — culori's WCAG luminance uses exact WCAG coefficients but ignores alpha.
- https://www.npmjs.com/package/@types/culori — culori types ship separately via DefinitelyTyped (@types/culori 4.0.1).
- https://github.com/texel-org/color — @texel/color has no built-in CIE Lab, LCH, HSL or HWB; uses Ottosson OKLCH gamut mapping; matches Colorjs.io within 2^-33.
- https://gka.github.io/chroma.js/ — chroma.js documents RGB, HSL, Lab, LCH, OKLab and OKLCH but not display-p3, a98, prophoto, rec2020, xyz-d50 or CSS color().
- https://www.npmjs.com/package/apca-w3 — apca-w3 0.1.9 is under a 'Limited W3 License' (not permissive); last published 2022.
- https://www.npmjs.com/package/@terrazzo/token-tools — @terrazzo/token-tools 2.10.0 depends on colorjs.io ^0.7.1; 0.10.3 depended on culori, so Terrazzo switched engines in 2.0.
- https://www.npmjs.com/package/style-dictionary — style-dictionary 5.7.0 (2026-10-16, Apache-2.0) depends on colorjs.io ^0.5.2 and tinycolor2.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/lint/plugin-core/rules/a11y-min-contrast.js — Terrazzo's a11y/min-contrast checks configured pairs on $value with contrastWCAG21: no alpha compositing, no per-mode iteration.
- https://terrazzo.app/docs/linting/ — a11y/min-contrast options are level, pairs (foreground/background) and largeText; no modes option.
- https://github.blog/engineering/user-experience/unlocking-inclusive-design-how-primers-color-system-is-making-github-com-more-inclusive/ — Prior art (GitHub Primer): 100+ declared token pairs checked across all themes in CI; a semi-transparent background is blended with the page background, then the semi-transparent text over that result.
- https://www.npmjs.com/package/stylelint — stylelint 17.16.0 (2026-10-01), MIT, Node >=20.19; already depends on @csstools/css-tokenizer and @csstools/css-parser-algorithms ^4.
- https://www.npmjs.com/package/@csstools/css-parser-algorithms — @csstools/css-parser-algorithms 4.0.2, MIT, actively maintained (preferred over postcss-value-parser 4.2.0).
- https://firefox-source-docs.mozilla.org/code-quality/lint/linters/stylelint-plugin-mozilla/rules/use-design-tokens/background-color.html — Prior art: a stylelint rule that enforces tokens per property; no existing plugin checks fg/bg pairs against a manifest, so a custom rule is needed.


# VERIFICATION: needs_changes
- [major] CLAIM: Open question 1, proposed default (a): leave disabled-state pairs out of the gate, with the FR-021 rule skipping disabled-state selectors and only reporting them.
  PROBLEM: A11Y-09's acceptance criterion says a check must confirm that every pair used in the core is in the manifest. If FR-021 skips disabled selectors, disabled pairs used in the core can be missing from the manifest and nothing blocks it, so FR-021 and A11Y-09 are not fully met. The question is also not one only the requerente can answer. Under the current premise (WCAG 2.2 AA, A11Y-01), inactive components are exempt from 1.4.3 and 1.4.11 (verified in both Understanding docs). Gating them would be stricter than the premise, and the constitution says that needs a change request. What actually needs fixing is the spec's own text: FR-020 currently gates every pair with no inactive exemption. That is a vendor-side /speckit-clarify item.
  CORRECTION: Keep disabled/inactive pairs inside both the manifest and the FR-021 coverage check: the rule never skips them, and an unlisted disabled pair is still an error. Give the manifest schema an explicit exemption field, e.g. `exempt: "wcag-inactive"`, allowed only when state ∈ {disabled, inactive}. The checker measures exempt pairs and reports them, but does not fail the build on them. Record the WCAG 2.2 AA inactive exemption in the spec (FR-020) through /speckit-clarify, citing A11Y-01. Remove the item from open_questions. Gating disabled pairs would only come back as a requerente change request.
- [minor] CLAIM: toEmittedSrgb(): use the DTCG hex if present, else the gamut-mapped components.
  PROBLEM: DTCG 2025.10 defines `hex` as an optional 6-digit *fallback*, and `components` as the color itself. Making hex win whenever it exists flips that order. A stale or hand-edited hex then silently overrides the components: the emitted CSS (and what the checker measures) stops matching the declared color, and it may also stop matching what the design-tool sync and the divergence check compare (FR-028, FR-030). Nothing in FR-002 schema validation catches the mismatch.
  CORRECTION: Treat components as the source of truth. For in-gamut colors, emit the 8-bit quantization of the components and fail validation if a supplied hex differs from it. For out-of-gamut colors, either use CSS Color 4 mapping, or use the authored hex only as an explicitly declared policy, and record that choice in the ADR. Either way, add a hex-vs-components consistency check to token validation (QA-02 fixtures).
- [minor] CLAIM: ENG-21 fit: colorjs.io, stylelint, @csstools/* and postcss are all MIT. The real-browser check runs axe on the swatches and leans on axe in A11Y-02 as the backstop.
  PROBLEM: The design depends on axe-core, and axe-core 4.14.0 is MPL-2.0, outside the MIT/Apache/BSD/ISC preference. The license-fit row leaves it out. Two behaviors also matter for the swatch harness. First, axe composites the background stack over a default white page last (get-background-color.js), so dark-mode swatches without a painted opaque surface are measured against white. Second, axe passes only when `contrast > expected`, a strict inequality, while WCAG and the checker use ≥.
  CORRECTION: List axe-core and @axe-core/playwright (MPL-2.0, dev-only, unmodified) in the versioned license policy (ENG-21), or record an exception. In the swatch harness, paint each manifest pair's opaque surface stack on real ancestor elements and put the brand/mode attributes on them, so axe never falls back to white. Note the strict-inequality difference in the near-threshold risk.
- [minor] CLAIM: Compute the ratio twice, on the float composite and on the 8-bit-rounded composite (axe rounds), and gate on the minimum.
  PROBLEM: axe's flattenColors rounds to 8 bits after every compositing step, and getBackgroundColor reduces the whole stack that way. Rounding only the final composite does not reproduce axe for stacks of two or more translucent layers, so the stated purpose (agreeing with axe in A11Y-02) is only partly met.
  CORRECTION: In the 8-bit variant, apply Math.round to each channel after every fold, both bg layers and the final fg-over-bg, mirroring axe's flattenColors. Keep the float variant and gate on the minimum of the two.
- [minor] CLAIM: Focus rings: for an outer ring the adjacent color is the surface; for an inset ring it is the component's background. The manifest lists both when both apply.
  PROBLEM: Understanding 1.4.11 says that when an indicator sits partly inside and partly outside the component, either part may provide the contrast. Requiring both cases to pass is stricter than WCAG 2.2 AA and would produce failures the premise does not require.
  CORRECTION: Give the manifest schema an any-of pair group for indicators that straddle the boundary: the group passes if at least one member reaches 3:1, and every member is still reported. Use all-of only when the indicator lies entirely on one side.
- [minor] CLAIM: Determinism: V8 math is deterministic for a given version; pinned Node toolchain.
  PROBLEM: ENG-08 and the constitution require a CI matrix with the Node floor and the latest Node, and IA-04/TOK-05 expect identical output across machines. The gamut-mapping path uses cbrt/pow/atan2/sin/cos, which may differ in the last bit across V8 versions. With 8-bit quantization a flip is very unlikely but not impossible, and nothing proves the build is byte-identical across the matrix.
  CORRECTION: Choose one canonical Node version for the token build that produces published bytes. Also add a CI job that builds the tokens on both the Node floor and the latest Node and diffs the CSS/JS outputs and the contrast report (SC-002 evidence).
- [minor] CLAIM: Alpha is kept (toEmittedSrgb quantizes to 8 bits).
  PROBLEM: The result does not say how alpha is serialized. If the CSS uses an 8-digit hex, alpha is quantized to n/255, while the checker composites with the source alpha. The measured value then differs slightly from the emitted one, against the stated 'what we measure is what the CSS emits' invariant.
  CORRECTION: Fix one alpha serialization in the adapter, e.g. `rgb(r g b / a)` with a rounded to a fixed number of decimals, or 8-digit hex. Have the checker composite with the alpha parsed back from that serialized string. Add a unit test that the round trip is exact.
- [minor] CLAIM: Alternatives considered: culori, @texel/color, chroma-js, color/tinycolor2/wcag-contrast, APCA, Terrazzo rule, etc.
  PROBLEM: One real, maintained option is missing: @csstools/css-color-parser 4.2.6 (MIT) on top of @csstools/color-helpers 6.1.2 (MIT-0), which implements CSS Color 4 conversions and gamut mapping. It comes from the same @csstools family the FR-021 rule already uses.
  CORRECTION: Add it as an alternative and reject it on the merits. It parses CSS color strings rather than DTCG {colorSpace, components} objects, so the adapter would have to build color() strings. MIT-0 would need its own entry in the license policy. Neither DTCG builder uses it, while both use colorjs.io.
- [minor] CLAIM: tinycolor2 was last released in 2023 and wcag-contrast in 2022.
  PROBLEM: The npm registry shows wcag-contrast 3.0.0 published 2019-11-05. 2022 is only the registry's 'modified' timestamp.
  CORRECTION: State that wcag-contrast was last released in 2019-11. The rejection still holds.
- [minor] CLAIM: The adapter, checker and stylelint plugin live in the tools layer and consume the tokens build output; the token CSS generator's color transform calls the same adapter.
  PROBLEM: If the generator runs as part of the tokens package build and imports tools/color, that creates a tokens→tools (dev) edge. The ENG-01/ACE-08 layer file has to declare it. And if tools/color ever imported token output, the task graph would have a cycle (tokens#build → tools-color, tools-contrast → tokens).
  CORRECTION: Make tools/color a leaf package with no workspace dependencies. Declare both edges in the versioned layer file: tokens-build →(dev) tools-color and tools-contrast →(dev) tokens + tools-color. Add a deliberate-violation fixture for the reverse edge.

## REVISED DECISION
Keep the core decision: colorjs.io 0.7.1 (MIT, zero deps, no install hooks, verified on npm 2026-07-24, actively committed Oct 2026), pinned exactly. Wrap it in one leaf adapter package, tools/color, with no workspace dependencies, and have both the token CSS generator and the contrast checker call its toEmittedSrgb(). Use our own WCAG 2.2 module (0.04045 threshold; 0.2126/0.7152/0.0722; no rounding; pass at ≥ min). Use source-over compositing in gamma-encoded sRGB over a background stack that must end in an opaque surface or a named surface set, which is then enumerated. The manifest is a JSON Schema-validated file covering every brand×mode permutation from the shared resolver permutation source, with minimums from the QA-14 thresholds file (WCAG22-AA: text 4.5, nonText 3). FR-021 is a custom stylelint 17 rule using subject+state merging and background annotations, backed by the real-browser swatch test plus axe.

Changes:
(1) Components are the source of truth. Emit the 8-bit quantization of the CSS Color 4 gamut-mapped components. A supplied DTCG hex must match it for in-gamut colors or validation fails. Using an authored hex for out-of-gamut colors is allowed only as an explicit policy recorded in the ADR.
(2) Fix one deterministic alpha serialization, and have the checker composite with the alpha parsed back from it.
(3) The 8-bit variant rounds after every fold, mirroring axe-core flattenColors. Gate on the minimum of the float and 8-bit ratios.
(4) Disabled/inactive pairs stay in the manifest and in FR-021 coverage, and the rule never skips them. They carry `exempt: "wcag-inactive"`: measured and reported, but they do not fail the build, as the WCAG 2.2 AA premise allows. Clarify FR-020 through /speckit-clarify and drop this from open_questions.
(5) Focus indicators that straddle the component boundary use an any-of group, per Understanding 1.4.11. Use all-of only when the indicator lies wholly on one side.
(6) The swatch harness paints each pair's opaque surface on real ancestors so axe never assumes white. List axe-core/@axe-core/playwright (MPL-2.0, dev-only) in the ENG-21 policy.
(7) Choose one canonical Node version for the token build, and add a CI byte-diff of the token outputs and contrast report across the ENG-08 Node floor and latest.
(8) Declare the tokens-build→tools-color and tools-contrast→tokens/tools-color dev edges in the ENG-01 layer file.
(9) List @csstools/css-color-parser + color-helpers as a rejected alternative, and correct wcag-contrast's last release to 2019.

Only remaining open question for the requerente: whether any v1.0 brand palette comes in wide-gamut colors, and if so, whether deterministic sRGB mapping is acceptable.

## EXTRA SOURCES
- https://registry.npmjs.org/colorjs.io — colorjs.io latest 0.7.1 published 2026-07-24; MIT; no dependencies; scripts have only prepack (no preinstall/install/postinstall); types bundled; unpackedSize 15,781,049 bytes; maintainers include leaverou and svgeesus.
- https://api.github.com/repos/color-js/color.js/commits — color.js has active commits in Oct 2026, e.g. 2026-10-15 'Ensure initial anchor is within the cube's range (#772)', which touches the raytrace path; the repo is not archived.
- https://unpkg.com/colorjs.io@0.7.1/src/defaults.js — colorjs.io defaults: gamut_mapping 'css', precision 5. defaults is a global mutable object, so the adapter must always pass the method explicitly.
- https://registry.npmjs.org/@terrazzo%2Ftoken-tools — Dependency history: culori ^4.0.x up to 0.10.x; colorjs.io ^0.6.1 from 2.0.0-beta.2 (2026-02-05); ^0.7.1 from 2.7.0; 2.10.0 published 2026-10-21.
- https://unpkg.com/style-dictionary@5.7.0/lib/common/transform-utils/colors.js — style-dictionary 5.7.0 imports both tinycolor2 and colorjs.io and maps the 14 DTCG 2025.10 color spaces to colorjs ids (display-p3→p3, a98-rgb→a98rgb, prophoto-rgb→prophoto).
- https://registry.npmjs.org/wcag-contrast — wcag-contrast 3.0.0 was published 2019-11-05 (registry modified 2022-06-28); BSD-2-Clause.
- https://registry.npmjs.org/axe-core — axe-core latest 4.14.0 (2026-10-05) is licensed MPL-2.0, outside an MIT/Apache/BSD/ISC-only policy.
- https://raw.githubusercontent.com/dequelabs/axe-core/develop/lib/commons/color/color.js — axe-core parses CSS colors with colorjs and gamut-maps to sRGB with method 'clip'; luminance uses 0.04045 and 0.2126/0.7152/0.0722.
- https://raw.githubusercontent.com/dequelabs/axe-core/develop/lib/checks/color/color-contrast-evaluate.js — axe's pass condition is strict: isValid = contrast > expected. The displayed ratio is truncated with Math.floor(contrast*100)/100.
- https://raw.githubusercontent.com/dequelabs/axe-core/develop/lib/commons/color/get-background-color.js — axe reduces the background stack with flattenColors, which rounds to 8 bits on every step, and composites a default white page background last.
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — If a focus indicator is partly inside and partly outside the component, either part may provide the 3:1 contrast; inactive components are exempt.
- https://registry.npmjs.org/@csstools%2Fcss-color-parser — @csstools/css-color-parser 4.2.6 (2026-10-02, MIT) depends on @csstools/color-helpers ^6.1.2 (MIT-0): a maintained CSS Color 4 parsing, conversion and gamut-mapping alternative that was not considered.
- https://registry.npmjs.org/stylelint — stylelint 17.16.0 (2026-10-01), MIT, engines node >=20.19.0; depends on @csstools/css-tokenizer ^4.0.0 and @csstools/css-parser-algorithms ^4.0.0; no install hooks (prepare runs only on git checkouts).
