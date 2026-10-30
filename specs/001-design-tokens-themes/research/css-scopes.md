# css-scopes

## DECISION
Option (b), pure CSS with no npm dependency. It has four generated parts:
- Brand rule: holds only that brand's private raw variables (--<prefixo>-_l-*, --<prefixo>-_d-*, --<prefixo>-_v-*).
- Mode toggles: a pair of private space toggles (--<prefixo>-_on-light / --<prefixo>-_on-dark, values `initial` or empty), set by [data-<prefixo>-mode] rules.
- Default-mode rule: one per brand.
- Brand-neutral resolver rule, :where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode]): redeclares every public semantic and component token on every scope element.

Everything sits in @layer <prefixo>.tokens. Defaults are zero-specificity :where(); brand and mode rules are (0,1,0). The output comes from a custom output format of whichever token build tool is chosen (separate decision). Browser floor = the @layer floor that ADR-03 already imposes: Chrome/Edge 99, Firefox 97, Safari 15.4. Later, when CSS if() is Baseline, the generator can emit if() instead of the toggles; the attribute API stays the same.

## RATIONALE
WHY IT IS CORRECT
- css-variables-1: a custom property's computed value is its specified value with var() substituted, and that substituted value is what inherits.
- Raw brand values are declared only on brand scopes, so each element inherits them from its nearest brand scope; an inner declaration shadows an outer one.
- Mode toggles are declared only on mode scopes (plus the defaults), so they come from the nearest mode scope.
- The resolver runs again on every element that is a scope for either axis. Each public token there = f(nearest brand raw, nearest mode toggle).
- An element that is not a scope inherits from its nearest scope element. Nothing changed in between, so the values are right.
- This literally meets TOK-14 / FR-012: "each scope redeclares the semantic tokens".
- FR-014: an invalid value (data-brand="zzz", "", mode "sepia", or a brand whose CSS is not imported) still matches the resolver, which uses attribute presence. No brand or mode rule matches it, so the resolver recomputes from the inherited inputs and gets the ancestor's values. No variable is left unset.
- Toggles select any token type: colors, multi-layer shadow lists (commas are fine inside var() fallbacks and raw values), opacity numbers, dimensions.
- SSR: pure CSS keyed on attributes that are already in the server HTML. No JS, no flash.

FILE SPLIT (ENG-06 / FR-013 / FR-017)
- Brand X's file has three kinds of content:
  1. Selectors naming only brand X.
  2. Brand-neutral blocks (mode toggles and the resolver). They carry no brand-specific literal and are byte-identical in every file, except that the default file adds :root.
  3. :root, only in the default brand's file.
- Importing A+B in either order gives the same result. Defaults are (0,0,0) and brand/mode rules are (0,1,0), and each rule kind declares a different set of properties.
- A B-only app sets data-<prefixo>-brand="b" on the root, as FR-013 requires. The default-mode rule for B uses :not(:is(valid modes) *), so B still defaults to light without a :root rule in its file.
- Suggested CI check:
  - every brand attribute value in file X equals X;
  - :root appears only in the default file;
  - the neutral blocks are identical across files;
  - the set of private raw names is the same in every brand file (structural support for TOK-09);
  - every var() target is declared in the same file.

SKETCH (default brand "a"; brand-b.css is the same with [data-<prefixo>-brand="b"] and no :root anywhere)
@layer <prefixo>.tokens /*, rest of the canonical order, identical at the top of every published CSS file */;
@layer <prefixo>.tokens {
  :where(:root), [data-<prefixo>-brand="a"] {
    --<prefixo>-_l-color-bg: #ffffff;
    --<prefixo>-_d-color-bg: #101010;
    --<prefixo>-_l-shadow-focus: 0 0 0 2px #fff, 0 0 0 4px #0055cc;
    --<prefixo>-_d-shadow-focus: 0 0 0 2px #101010, 0 0 0 4px #66aaff;
    --<prefixo>-_v-radius-control: 4px;
  }
  :where(:root, [data-<prefixo>-brand="a"]:not(:is([data-<prefixo>-mode="light"], [data-<prefixo>-mode="dark"]) *)) {
    --<prefixo>-_on-light: initial;
    --<prefixo>-_on-dark: ;
    color-scheme: light;
  }
  [data-<prefixo>-mode="light"] {
    --<prefixo>-_on-light: initial;
    --<prefixo>-_on-dark: ;
    color-scheme: light;
  }
  [data-<prefixo>-mode="dark"] {
    --<prefixo>-_on-light: ;
    --<prefixo>-_on-dark: initial;
    color-scheme: dark;
  }
  :where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode]) {
    --<prefixo>-color-bg: var(--<prefixo>-_on-light, var(--<prefixo>-_l-color-bg)) var(--<prefixo>-_on-dark, var(--<prefixo>-_d-color-bg));
    --<prefixo>-shadow-focus: var(--<prefixo>-_on-light, var(--<prefixo>-_l-shadow-focus)) var(--<prefixo>-_on-dark, var(--<prefixo>-_d-shadow-focus));
    --<prefixo>-opacity-scrim: var(--<prefixo>-_on-light, 0.4) var(--<prefixo>-_on-dark, 0.7); /* brand-invariant: literals */
    --<prefixo>-radius-control: var(--<prefixo>-_v-radius-control); /* brand-only */
    --<prefixo>-z-overlay: 1000; /* invariant */
    --<prefixo>-button-bg: var(--<prefixo>-color-accent); /* component alias resolves again per scope */
  }
}

GENERATOR RULES
- Write the literal `initial`. Never write var(--ON): WebKit bug 243247, still open.
- Sort by token name, use fixed formatting and no timestamps, so output is byte-identical (FR-015).
- Keep the private `_` segment out of ESM/.d.ts, the DOM contract and the API report.
- Primitives never appear in scope rules. Whether to emit them at all is a separate decision.
- Prefix and default brand are generator parameters; their values are pending with the requester.

EVIDENCE
- I built a harness (scratchpad scope-test/gen.mjs, page.mjs, run.mjs) and ran it on Playwright builds of Chromium 156, Firefox 157 and WebKit 26.4.
- Coverage: 6 import configs × 3 seeds, about 195 elements and 2,531 checks per pass. Each run checks the initial state, then again after 60 random attribute changes at runtime.
- Checks: computed public tokens, plus used background-color, box-shadow, border-radius and outline-color, compared against a DOM-walk oracle (nearest valid ancestor per axis).
- Results:
  - Option (b): 0 failures, including the minified `--x:;` form.
  - @scope: passes only after the :root defaults move into a sub-layer.
  - Combos and style queries: fail widely.
- Size, synthetic 350 tokens:
  - (b): about 43.6 KB raw / 5.6 KB gzip per brand file.
  - @scope: 93 / 8.0 KB (default file) and 59 / 6.2 KB (other files).
  - Combos: 45 / 4.2 KB, but wrong.
- Size is linear in token count, one file per brand, and does not depend on nesting depth.

REAL-BROWSER TEST MUST COVER (every engine in the list nightly, one engine per PR; QA-01, QA-12)
1. No attributes anywhere, default file imported: default brand + light on html and descendants.
2. Root mode=dark only.
3. Mode-only inner scope (A-light > [mode=dark]): the element itself and its child are A-dark; the sibling after it is back to A-light.
4. Brand-only inner scope inherits mode (A-dark > [brand=b]): B-dark on the element itself and its child.
5. A > B > A: the innermost A uses A values with the nearest mode.
6. Mode alternation light > dark > light.
7. Interleaved chain dark > B > A > [mode=light] > [brand=b] > [mode=dark], checked at every level.
8. Both attributes on one element, plus the swapped pair nested inside it.
9. Brand-only scope at top level with no mode ancestor: that brand + light.
10. Invalid values: brand "zzz", brand "", mode "sepia". The element keeps the nearest valid ancestor's value for that axis.
11. A brand present in the markup whose CSS is not imported: behaves like invalid.
12. A sibling after a nested scope closes: outer values.
13. Brand alternation 4 or more levels deep, then a mode-only scope inside.
14. Import sets: A only; B only with root brand=b; A+B and B+A with root brand=b (same result in both orders); root brand+mode.
15. Runtime set/remove of attributes on root and nested elements: values update without reload.
16. Non-color tokens: multi-layer shadow, opacity, a brand-only dimension and an invariant token inside mode-only scopes; a component alias inside nested scopes.
17. Used values equal reference literals (catches invalid-at-computed-value-time).
18. Every public --<prefixo>-* is non-empty on every element in every config (private _ toggles excluded).
19. Minified output variant.
20. Seeded random trees (depth 6 or more, valid and invalid values) against the oracle.
21. An unlayered app override beats the layer.

## ALTERNATIVES
- (a) light-dark() + color-scheme on [data-mode], brand values redeclared on [data-brand]: Correct only for colors, and per MDN light-dark() accepts only <color> or <image>. Mode-dependent shadows (offsets, blur, layer count) and opacity numbers cannot use it, so a second mechanism would still be needed. It also ties the mode axis to color-scheme, a property apps and third-party widgets set themselves; e.g. `color-scheme: light dark` would make the default follow the OS instead of light (FR-013). Baseline newly available 2024-05, widely available 2026-11-13. Keeping color-scheme only as a side effect of the mode rules (for native widgets) is still recommended.
- (c) Container style queries: @container style(--brand: x) and style(--mode: y) { * { tokens } }: Structurally wrong: an element is evaluated against an ANCESTOR query container (css-conditional-5), so a scope element never gets its own values and the root gets none. The harness confirms it: html and every attribute-bearing element come out empty or wrong in all configs. It also redeclares tokens on every element via *, and Baseline is new (Firefox 151, 2026-05-19; widely available 2028-11).
- (d) @scope proximity: @scope([brand=x]) [mode=y] and @scope([mode=y]) [brand=x] blocks with literal values: Correct in current engines, but only if every rule has equal specificity (:where everywhere) and the :root defaults sit in a lower sub-layer; without that, B-before-A import order breaks root brand=b (reproduced). Output is about 1.4–2.1x larger (5 literal blocks per brand plus 3 in the default file). Baseline newly available only since 2026-03-24 (Chrome 143, Firefox 146, Safari 26.4; widely available 2028-09-24), so the browser floor would rise far above the @layer floor. MDN also warns that & specificity inside @scope differs across engines and releases.
- (e) Enumerated brand×mode selector combos ([b][m], [b] [m], [m] [b]): Descendant combinators match ANY ancestor, not the nearest. In A>B>[mode] or alternating chains, equal specificity lets source order pick the brand. The harness shows hundreds of failures per config, e.g. mode-only light inside A inside B-dark gets B's accent. Patterns also multiply with brands × modes.
- CSS if(style(--<prefixo>-mode: dark): …; else: …) instead of toggles: The cleanest semantics: it evaluates on the element itself and has a native else default. But availability is limited: Chrome/Edge 137+ only, no Firefox or Safari, and per MDN it does not degrade gracefully. Kept as the future generator target, with no change to the public API.
- Runtime JS theme provider / CSS-in-JS computing tokens per subtree: Breaks the SSR-without-JS requirement (TOK-14 SSR criterion) and violates ADR-03 (no runtime CSS-in-JS).
- Numeric 0/1 registered toggle with calc()/color-mix() interpolation: Cannot select shadow lists or keywords. color-mix converts the color space and can shift values the contrast manifest measured. Needs @property registration duplicated across brand files.

## REQUIREMENT FIT
- FR-010 / TOK-08 / CMP-05: Two distinct prefixed attributes, data-<prefixo>-brand and data-<prefixo>-mode; any brand combines with any mode. The build emits each brand's raw values for both modes, so every combination is valid.
- FR-011 / TOK-09: The resolver is shared and brand-neutral, so every combination exposes exactly the same public keys. CI also asserts identical private raw-name sets across brand files, alongside the DTCG key-parity check.
- FR-012 / TOK-14 (CSS level): Every element carrying either attribute redeclares every public semantic and component token through the resolver. Nearest scope wins per axis, verified by fuzzing against a DOM-walk oracle in Chromium, Firefox and WebKit. React/Vue tests and SSR stay in the components feature.
- FR-013 / CMP-24: :where(:root) default-brand raw values and light toggles exist only in the default brand's file. Non-default files get the default mode through a brand-B-only selector, so a B-only app with root brand=b has no unset variables (verified).
- FR-014: Unknown, empty or unimported attribute values match only the resolver, which recomputes from inherited inputs, so the ancestor's values are kept (verified for "zzz", "", "sepia" and an unimported brand).
- FR-015 / TOK-05: Generated by a deterministic formatter: sorted, fixed format, no timestamps; byte-identical across two builds. No hand-written CSS.
- FR-016 / TOK-06: ESM exports only public var(--<prefixo>-*) names. The private _ namespace is excluded from types. Value maps per brand×mode come from the same resolved data.
- FR-017 / ENG-06 / SC-006: Each brand file holds only its own brand selectors plus byte-identical brand-neutral blocks; :root appears only in the default file. Import order does not matter. A CI selector audit and the example-app runtime check (public tokens non-empty) enforce it.
- FR-018 / TOK-07 / US3-3: Swapping attributes at runtime updates values without reload or component code (verified with random runtime mutations). Adding a brand only adds token source files; the generator emits a new file.
- ADR-03 / Principle III / MIG-14: All rules live in @layer <prefixo>.tokens, so unlayered app CSS still overrides. Every published file starts with the same canonical layer-order statement; layer names follow the core's published layer contract.
- ENG-08: Uses only custom properties, var() fallback, :where/:is/:not with complex arguments, @layer and color-scheme, all Baseline widely available. Floor = the @layer floor already required by ADR-03, so the CSS compat lint stays green for any list at or above it.
- Principle IX / ENG-07 / ENG-16 / ENG-17 / ENG-21 / ENG-24: No new dependency, no install scripts, no license exposure. It is a formatter inside the already-chosen token tool.
- A11Y-09: Contrast checks read the per-brand×mode resolved values, unaffected by the CSS mechanism. color-scheme on mode scopes keeps native widgets readable in dark subtrees.
- TOK-04: The naming convention must reserve a private segment (--<prefixo>-_*) for raw values and toggles, exempt from public-token naming and the DOM contract, while still carrying the prefix.
- QA-01 / QA-02 / QA-12 / Principle VII: The 21-case real-browser suite plus seeded fuzzing runs in real engines with deterministic seeds. The generator classification logic gets unit tests.

## RISKS
- Private toggles are intentionally guaranteed-invalid in one state. A naive 'variables without value' scanner would flag them, so limit the ENG-06 runtime check to public tokens and add a static check that every var() target is declared.
- Any brand- or mode-dependent token declared outside the resolver (for example a component alias only at :root) goes stale in nested scopes. CI must assert that every public token is declared only in the resolver.
- Consumer overrides: a public token overridden at :root is shadowed again at each nested scope. The supported override pattern (on the scope element, unlayered) needs documenting, and private _ vars must be marked non-API (excluded from the GOV-01 API report).
- Minifiers may rewrite `--x: ;` as `--x:;`. That is valid per spec and verified in all three engines; Chrome only accepts it from 99, which equals the @layer floor. Keep the minified variant in the test matrix.
- WebKit bug 243247 (still open): toggles set through var(--ON) indirection fail in Safari. The generator must emit the literal `initial`, enforced by a lint on the generated output.
- color-scheme set by the mode rules affects UA widgets and iframe backdrops. Apps that set color-scheme themselves (unlayered) win, so document this.
- Portals (CMP-21): the portal container must carry BOTH attributes resolved from the origin's nearest scopes. This is a Provider responsibility in the components feature.
- DevTools shows var() chains as specified values (the computed value is the final value). This needs documenting for maintainers and consumers.
- Size is about 2–3 declarations per token per brand file (about 5.6 KB gzip at 350 synthetic tokens). Measure against the QA-07 budget once its threshold is set.
- Adding a mode means regenerating (the default-mode :not() list); the generator handles it, but it changes the output bytes.
- Later migration to if() changes the CSS bytes but not the public API. Treat it as a non-breaking release and re-run the full engine matrix.

## OPEN QUESTIONS


## ADR
ADR-NN: Brand and mode scopes in CSS: variable toggles, per-brand raw values and a token resolver on every scope

## SOURCES
- https://drafts.csswg.org/css-variables-1/ — A custom property's computed value is its specified value with var() substituted, and it inherits. The initial value is the guaranteed-invalid value; a var() fallback is used when the referenced value is guaranteed-invalid; `--foo:;` is a valid empty value.
- https://lea0.verou.me/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property — The space-toggle technique: `initial` vs whitespace values switch var() fallbacks.
- https://bugs.webkit.org/show_bug.cgi?id=243247 — Safari bug, still NEW: setting a toggle via var(--ON) where --ON is initial does not yield the initial value, so emit literal `initial`.
- https://github.com/sveltejs/svelte/pull/7303 — `--foo:;` was invalid in Chromium before the Chrome 99 fix.
- https://web-platform-dx.github.io/web-features-explorer/features/light-dark/ — light-dark(): Baseline newly available 2024-05-13 (Chrome 123, Firefox 120, Safari 17.5); widely available 2026-11-13.
- https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark — light-dark() accepts only two <color> or two <image> values and resolves from the used color scheme.
- https://web-platform-dx.github.io/web-features-explorer/features/scope/ — @scope: Baseline newly available 2026-03-24 (Chrome 143, Firefox 146, Safari 26.4); widely available 2028-09-24.
- https://developer.mozilla.org/en-US/docs/Web/CSS/@scope — Scoping proximity is applied after importance, layers and specificity. Bare selectors are prefixed with :where(:scope) (descendants only); :scope adds (0,1,0); & specificity differs across engines.
- https://web-platform-dx.github.io/web-features-explorer/features/container-style-queries/ — Container style queries: Baseline newly available 2026-05-19 (Chrome 111, Safari 18, Firefox 151); widely available 2028-11-19.
- https://drafts.csswg.org/css-conditional-5/#container-rule — The query container is chosen from the element's ancestor query containers; by default all elements are style query containers.
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries — style() supports only custom properties; container-type is not required for style queries.
- https://web-platform-dx.github.io/web-features-explorer/features/if/ — CSS if(): limited availability, Chrome/Edge 137+ only, not in Firefox or Safari.
- https://developer.mozilla.org/en-US/docs/Web/CSS/if — if() style() queries evaluate on the same element, with an else branch, and do not degrade gracefully.
- https://web-platform-dx.github.io/web-features-explorer/features/cascade-layers/ — Cascade layers: widely available since 2024-09-14 (Chrome 99, Firefox 97, Safari 15.4). This is the floor of the recommended approach.
- https://web-platform-dx.github.io/web-features-explorer/features/where/ — :where(): widely available since 2023-07-21 (Chrome 88, Firefox 82, Safari 14).
- https://web-platform-dx.github.io/web-features-explorer/features/not/ — :not(): widely available since 2023-07-21 (Chrome 88, Firefox 84, Safari 9).
- https://web-platform-dx.github.io/web-features-explorer/features/color-scheme/ — color-scheme: widely available since 2024-08-03.


# VERIFICATION: needs_changes
- [major] CLAIM: requirement_fit for FR-013, FR-014, FR-017 and SC-006/ENG-06: no unset variables (verified), and each brand file holds only its own brand selectors.
  PROBLEM: This is true only for public tokens. By design, every scope leaves one private toggle guaranteed-invalid (`initial`) and the other empty. I re-ran the harness and added a probe: getPropertyValue returns "" for BOTH --px-_on-light and --px-_on-dark on html in Chromium 156.0.8078.4, Firefox 157 and WebKit 26.4. The spec text says otherwise. FR-013: "no variable MAY be left without a value". FR-014 and SC-006 say "zero variables without a value". ENG-06 says "This app has no CSS variables without a value". The harness oracle checks only public tokens, so '(verified)' overclaims. Same pattern for FR-017/ENG-06 "only that brand's selectors": every brand file carries brand-neutral selectors ([data-<prefixo>-mode=...] and :where([data-<prefixo>-brand],[data-<prefixo>-mode])). The result treats both as test-scoping choices (risk #1), but they reinterpret contractual acceptance wording. A naive acceptance scanner (ACE-01/ACE-02, FR-031) would fail Phase 1.
  CORRECTION: Make the operational definitions explicit in the spec (via /speckit-clarify, in FR-013/FR-014/FR-017/SC-006) and in the ADR's Consequences, and bind matching CI checks in the traceability matrix. (1) 'Variable without a value' means: any public --<prefixo>-* name (without `_`) that is empty or guaranteed-invalid on any element, or any var() reference without a fallback that resolves that way. The private --<prefixo>-_on-* toggles are excluded by naming rule. (2) 'Only that brand's selectors' means: every brand-valued attribute selector names only that brand; :root appears only in the default file; brand-neutral blocks are byte-identical across files. Do not claim literal compliance until this is recorded.
- [minor] CLAIM: Evidence: computed public tokens compared against a DOM-walk oracle, 0 failures.
  PROBLEM: The oracle runs norm() (trim and collapse whitespace), which hides the fact that every public mode-dependent token computes with stray whitespace in all 3 engines: light "#ffffff ", dark " #101010", shadow "0 0 0 2px #ffffff, 0 0 0 4px #0055cc ". The cause is the space between the two var() toggles. CSS consumption is unaffected, but these consumers see padded strings: JS readers of getComputedStyle, consumer style()/if() queries, DOM-contract and snapshot extraction, and exact-match runtime checks.
  CORRECTION: Emit the two toggles with no separator: `var(--<prefixo>-_on-light, L)var(--<prefixo>-_on-dark, D)`. I patched the harness this way and compared exact strings with no trimming: 0 failures across all 6 configs × 3 seeds, with and without the minified `--x:;` form, in Chromium 156, Firefox 157 and WebKit 26.4. esbuild 0.21.5 minification keeps both `--x: ;` and the adjacent var()s. Make the oracle and the case-17 test compare exact strings, and add a generator lint for the no-separator form.
- [minor] CLAIM: Browser floor = the @layer floor that ADR-03 already imposes: Chrome/Edge 99, Firefox 97, Safari 15.4.
  PROBLEM: The browser list is an open requester decision (Assumptions: 'browsers in a versioned list (e.g. browserslist)'). Worded as 'Browser floor =', it reads as fixing the list. The floor is also a static compat claim and was not tested: all evidence ran on Playwright pre-release builds (Chromium 156 dev, Firefox 157 Nightly, WebKit 26.4). The Chrome-99 claim for `--x:;` rests on Svelte PR 7303, which says only that the fix 'will be released in Chrome 99'.
  CORRECTION: Rephrase: 'The mechanism needs nothing beyond @layer, which ADR-03 already requires (web-features: Chrome/Edge 99, Firefox 97, Safari 15.4). The project browser list stays the open decision under its assumption.' State that floor compatibility is enforced by the ENG-08 CSS compat lint, not by real-browser tests at floor versions.
- [minor] CLAIM: Primitives never appear in scope rules. Whether to emit them at all is a separate decision.
  PROBLEM: FR-016/TOK-06 requires ESM var(--<prefixo>-*) references for ALL tokens, so primitives must exist as CSS custom properties or those references dangle, which itself breaks ENG-06. Placement interacts with this topic. Non-default brand files may not contain :root, so primitives emitted only at :root leave a B-only app without them. A shared palette emitted into every brand file can leak primitives used only by brand B into brand A's bundle (also ENG-06). Per FR-004, primitives are brand- and mode-invariant, so the mechanism can carry them.
  CORRECTION: Keep the emission choice as a dependent decision, but write down its constraints: references must resolve (FR-016); no B-exclusive variables in A's file (ENG-06); no :root in non-default files (FR-013). Primitives, being invariant, go either in a brand-neutral selector present in every brand file (filtered to the primitives that brand references) or in a separate shared file. Drop 'never in scope rules'.
- [minor] CLAIM: Importing A+B in either order gives the same result ... each rule kind declares a different set of properties.
  PROBLEM: Inaccurate wording. The default-mode rules and the [data-mode] rules declare the same properties (both toggles plus color-scheme). Order independence actually comes from (0,0,0) vs (0,1,0) specificity and from duplicate neutral blocks being byte-identical.
  CORRECTION: Restate the order-independence argument as specificity tiers plus identical duplicate blocks. The harness already confirms B+A = A+B.
- [minor] CLAIM: Principle IX: ... It is a formatter inside the already-chosen token tool.
  PROBLEM: This contradicts the decision text, which says the token build tool is a separate decision that has not been made. Principle IX compliance (license, deprecated deps, install scripts) depends on that choice.
  CORRECTION: Say 'a custom formatter for whichever token tool the separate ADR selects; adds no dependency by itself', and require QA-02 unit tests for the classifier and formatter.
- [minor] CLAIM: Risk: consumer override at :root is shadowed again at each nested scope; document override on the scope element.
  PROBLEM: Incomplete. I verified in all 3 engines that a semantic override on a non-scope element (style="--px-color-accent: …") changes --px-color-accent for its descendants but NOT --px-button-bg, because the component alias stays frozen at the nearest scope element. Any nested scope also reverts the override.
  CORRECTION: Document both effects: alias staleness for overrides on non-scope elements, and the revert at nested scopes. The supported pattern is to override on a scope element, unlayered, and to override component tokens directly.
- [minor] CLAIM: Every published file starts with the same canonical layer-order statement; layer names follow the core's published layer contract.
  PROBLEM: MIG-14 makes the layer order the core's published contract, with a CI check against the distributed @layer statement. Having the tokens package (the lowest layer) hard-code the full order, including core layer names, creates two sources for one fact.
  CORRECTION: Keep one source for the layer list (for example a generated constant owned by the lowest layer and consumed by the core), and extend the MIG-14 CI check to the token CSS files.
- [minor] CLAIM: Source: https://lea0.verou.me/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property
  PROBLEM: Wrong host. lea0.verou.me returns an expired TLS certificate.
  CORRECTION: Cite https://lea.verou.me/blog/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property/ (Lea Verou, 2020-10-12).

## REVISED DECISION
Keep option (b): pure CSS with no new npm dependency, all in @layer <prefixo>.tokens, with four generated parts. (1) Brand rule with that brand's private raw values. (2) Private mode toggles (--<prefixo>-_on-light / --<prefixo>-_on-dark, written as the literal `initial` or empty, never through var() indirection, because of WebKit bug 243247). (3) A default-mode rule per brand using :not(:is(valid modes) *). (4) A brand-neutral resolver on :where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode]) in the default file, or without :root in other files, that redeclares every public semantic and component token. Amendments:

(a) Emit the resolver with no whitespace between the toggles: `var(--<prefixo>-_on-light, L)var(--<prefixo>-_on-dark, D)`. Computed token strings then match the reference exactly; I verified this in Chromium 156, Firefox 157 and WebKit 26.4, minified and unminified. Make the oracle and tests compare exact strings with no trimming.

(b) Before the ADR is accepted, record in the spec (FR-013/FR-014/FR-017/SC-006, via /speckit-clarify) and in the ADR the operational definitions:
- 'Variable without a value' covers public --<prefixo>-* names (without `_`) and var() references without a fallback. The private _on-* toggles are by design guaranteed-invalid or empty and are excluded.
- 'Only that brand's selectors' means brand-valued attribute selectors name only that brand, :root appears only in the default file, and brand-neutral blocks are byte-identical.
Bind both checks in the traceability matrix.

(c) State the browser impact as 'requires nothing beyond @layer (ADR-03)'. The browser list stays the open decision under its assumption.

(d) Primitive emission remains a dependent decision with these constraints: FR-016 references must resolve; no B-exclusive variables in A's file; no :root in non-default files. Primitives are invariant per FR-004, so they go in a neutral block filtered per brand, or in a shared file.

(e) Fix the wording on order independence (it comes from specificity tiers plus identical blocks), the 'already-chosen tool' inconsistency and the Lea Verou citation. Keep a single source for the layer-order list, checked by MIG-14. Document override and alias staleness.

Alternatives (a) light-dark(), (c) style queries, (d) @scope, (e) combos, if(), JS provider and numeric toggle stay rejected for the stated reasons. The web facts re-verified: light-dark 2024-05-13 / 2026-11-13; @scope 2026-03-24 (Chrome 143, Firefox 146, Safari 26.4); container style queries 2026-05-19 (Firefox 151); if() Chromium 137+ only; @layer Chrome 99, Firefox 97, Safari 15.4. @scope also passes the harness, but it would force a browser floor far above @layer, which would pre-empt the open browser-list decision.

## EXTRA SOURCES
- https://lea.verou.me/blog/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property/ — Correct URL for the space-toggle article (Lea Verou, 2020-10-12): `initial` turns on the var() fallback and a single space turns it off.
- https://drafts.csswg.org/css-variables-1/ — Editor's Draft dated 2026-10-09: `--foo:;` is a valid empty value, not the guaranteed-invalid value; `initial` resets a custom property to guaranteed-invalid; the fallback is used only when the reference is guaranteed-invalid; the computed value is the specified value with var() substituted, keeping the author's serialization, which is why the space between toggles shows up in computed strings.
- https://bugs.webkit.org/show_bug.cgi?id=243247 — Still NEW (reported 2022-07-27, rdar://98042784): assigning var(--ON), where --ON is initial, does not yield guaranteed-invalid in Safari.
- https://github.com/sveltejs/svelte/pull/7303 — Chromium treated `--foo:;` as invalid; the PR says the fix 'will be released in Chrome 99' (forward-looking, not confirmed shipped there).
- https://web-platform-dx.github.io/web-features-explorer/features/scope/ — @scope: Baseline newly available 2026-03-24 (Chrome/Edge 143, Firefox 146, Safari 26.4); widely available expected 2028-09-24.
- https://web-platform-dx.github.io/web-features-explorer/features/container-style-queries/ — Container style queries: newly available 2026-05-19 (Chrome 111, Safari 18, Firefox 151); widely available expected 2028-11-19.
- https://web-platform-dx.github.io/web-features-explorer/features/if/ — CSS if(): limited availability; Chrome/Edge 137+ only; not in Firefox or Safari.
- https://developer.mozilla.org/en-US/docs/Web/CSS/if — if() style() queries evaluate on the same element and have an else branch; MDN says if() 'does not gracefully degrade' and needs an explicit fallback declaration.
- https://web-platform-dx.github.io/web-features-explorer/features/light-dark/ — light-dark(): newly available 2024-05-13 (Chrome 123, Firefox 120, Safari 17.5); widely available expected 2026-11-13.
- https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark — light-dark() accepts two <color> or two <image> values and resolves from the used color scheme.
- https://developer.mozilla.org/en-US/docs/Web/CSS/@scope — Scoping proximity ranks below importance, layers and specificity; bare selectors and & get an implicit :where(:scope); :scope adds 0-1-0; MDN warns that & specificity in @scope differs by engine and release.
- https://web-platform-dx.github.io/web-features-explorer/features/cascade-layers/ — Cascade layers: widely available 2024-09-14 (Chrome/Edge 99, Firefox 97, Safari 15.4).
- https://web-platform-dx.github.io/web-features-explorer/features/color-scheme/ — color-scheme: widely available since 2024-08-03 (Chrome 98, Firefox 96, Safari 13).
- https://web-platform-dx.github.io/web-features-explorer/features/not/ — :not(): widely available since 2023-07-21 (Chrome 88, Firefox 84, Safari 9).
