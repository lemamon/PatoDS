# PatoDS — Scientific and Technical Foundations

> A cited evidence base for the key architectural decisions of PatoDS, a single multi-framework
> (React + Vue) design system built on one W3C DTCG token source.

**Status:** research document (not product code). **Date:** 2026-11-07.
**Scope:** feature 001 (token foundation + build/quality tooling), with forward references to the
component work (feature 002).

## How to read this document

This document gathers *primary* evidence — peer-reviewed papers, W3C/ISO/IEC standards, original
author works, and authoritative engineering documentation — behind the decisions recorded in the
[constitution](../../.specify/memory/constitution.md) and in
[`specs/001-design-tokens-themes/research.md`](../../specs/001-design-tokens-themes/research.md).

Every source below was **opened and read in a live browser** before being cited. Where a claim could
not be verified against a real page, it is not cited. Each reference carries:

- **Citation** — authors or organization, title, venue/publisher, year.
- **URL** — the page that was read.
- **Type** — `peer-reviewed` · `standard / W3C REC` · `W3C CR / draft` · `W3C CG report` ·
  `ISO/IEC standard` · `official docs` · `technical article` · `original author work`.
- **Access** — `open` · `OA preprint` · `paywalled`.
- **How it underpins PatoDS** — the specific decision it supports.

A **standard** (W3C Recommendation, ISO/IEC) is normative; a **W3C Community Group Final Report**
(DTCG) is a stable community deliverable but *explicitly not a W3C Standard*; a **technical article**
is expert opinion, not a standard. Those distinctions matter and are preserved below.

The final section, [Open questions / where the evidence is contested](#7-open-questions--where-the-evidence-is-contested),
collects the places where the literature is divided or where a PatoDS assumption is challenged.

## Table of contents

1. [Design tokens and token architecture](#1-design-tokens-and-token-architecture)
2. [Color science and accessibility](#2-color-science-and-accessibility)
3. [Multi-framework / framework-agnostic UI](#3-multi-framework--framework-agnostic-ui)
4. [Deterministic and reproducible builds](#4-deterministic-and-reproducible-builds)
5. [Supply-chain security](#5-supply-chain-security)
6. [Design-tool synchronization](#6-design-tool-synchronization)
7. [Open questions / where the evidence is contested](#7-open-questions--where-the-evidence-is-contested)
8. [Reference legend](#8-reference-legend)

---

## 1. Design tokens and token architecture

**PatoDS decisions covered:** DTCG as the single source of appearance (Constitution II, TOK-01);
three token layers primitive → semantic → component where *only* primitives carry a literal and the
other layers reference by alias (TOK-02, TOK-03); brand and mode as **independent, orthogonal axes**
selected by distinct attributes (TOK-07, TOK-08, TOK-14); one DTCG Resolver file with two modifiers
resolved over all permutations ([research.md](../../specs/001-design-tokens-themes/research.md) D1,
D7).

### 1.1 Primary sources

**Design Tokens Format Module 2025.10** — Design Tokens Community Group (Chenais, McMahon, Powers,
Ström-Awn, Vitan, eds.), Final Community Group Report, 28 October 2025.
<https://www.designtokens.org/tr/2025.10/format/>
- *Type:* W3C CG report. *Access:* open.
- *Underpins:* the whole premise that appearance lives in "a file format to exchange design tokens
  between different tools." §7 defines **aliases/references** (curly-brace `{group.token}` syntax and
  required JSON Pointer support) — this is the mechanism by which PatoDS's semantic and component
  layers reference primitives without re-stating literals (TOK-02). §8 defines typed tokens and §9
  defines composite types; PatoDS deliberately narrows §9 away (publishes only single-value tokens,
  research.md D8) so one token maps to exactly one CSS custom property.
- *Caveat:* the report states it "is **not a W3C Standard**." It is stable, but pre-standard.

**Design Tokens Resolver Module 2025.10** — Design Tokens Community Group (Broekema, Cheran, Kamminga,
L'Homme, Powers, Ström-Awn, Wittmann, eds.), Final Community Group Report, 28 October 2025.
<https://www.designtokens.org/tr/2025.10/resolver/>
- *Type:* W3C CG report. *Access:* open.
- *Underpins:* the Resolver is the 2025.10 innovation PatoDS's multi-brand / multi-mode model relies
  on. Its abstract defines "a method to work with design tokens in multiple contexts (such as 'light
  mode' and 'dark mode')." Its terminology section makes **§2.1 Orthogonality** and **§2.2
  Permutation** first-class concepts, and §4.1.5 models **Modifiers → Contexts** with a default and a
  resolution count. This is exactly PatoDS's two-orthogonal-modifier design (`brand` with
  contexts = brands, `mode` with light/dark) resolved over `listPermutations()` (research.md D7). It
  is the standard that makes "brand and mode are independent axes" (TOK-07/TOK-08) expressible in the
  source rather than invented by PatoDS.

**Naming Tokens in Design Systems** — Nathan Curtis, EightShapes, 15 October 2020.
<https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676>
- *Type:* technical article. *Access:* open (metered).
- *Underpins:* establishes the tiered taxonomy (base/option → alias/semantic → component-scoped) as
  community prior art, not a PatoDS invention, and records the origin: "Design tokens have provided a
  visual foundation of many design systems since Salesforce pioneered the concept in 2014." PatoDS's
  three-layer model is a disciplined instance of this widely-adopted practice.

**Style Dictionary** — Amazon / OSS, project documentation (accessed 2026-11-07).
<https://styledictionary.com/>
- *Type:* official docs (OSS). *Access:* open.
- *Underpins:* the canonical prior-art build tool ("Export your Design Tokens to any platform … 
  Forward-compatible with Design Tokens Community Group spec"), used here as the baseline PatoDS
  measured against. research.md D1 rejects it *for this feature* because its DTCG 2025.10 / Resolver
  support is incomplete (upstream issue #1590), choosing Terrazzo as the parser instead — a
  documented, reversible call, not a dismissal of the methodology.

### 1.2 Synthesis

The evidence supports PatoDS's core token decisions strongly. The primitive/semantic/component tier
model is established industry practice (Curtis; Salesforce lineage) and the W3C DTCG format gives it
a tool-neutral, machine-validatable encoding with a first-class alias mechanism. The 2025.10 Resolver
is the piece that makes **orthogonal** brand × mode axes a property of the *source format* rather than
a bespoke convention — directly validating TOK-07/TOK-08 and the D7 model.

**Challenged assumption:** DTCG 2025.10 is a *Community Group Final Report, not a W3C Recommendation*.
PatoDS treats it as "the single source of appearance" (Constitution II), which is a bet on a
pre-standard format and on a young single-publisher parser (Terrazzo). The constitution's own
mitigations (schema pinning with sha256, golden outputs, the official DTCG test suite, MIT
fork-viability) are the right hedges, but the foundation is not yet a ratified standard. See §7.

---

## 2. Color science and accessibility

**PatoDS decisions covered:** WCAG 2.2 AA as the single target level (A11Y-01); color tokens must meet
contrast ratios **measured over a versioned manifest of pairs, with composited opacity** (A11Y-09);
a custom WCAG 2.2 module with threshold `0.04045`, luminance coefficients `0.2126/0.7152/0.0722`, and
ratios compared without rounding; **source-over compositing in gamma-encoded sRGB** before measuring;
sRGB emission via the CSS Color 4 algorithm with `deltaEOK` gamut mapping at `JND 0.02`; APCA
explicitly *not* adopted ([research.md](../../specs/001-design-tokens-themes/research.md) D5).

### 2.1 Primary sources

**Understanding SC 1.4.3: Contrast (Minimum)** — W3C Web Accessibility Initiative (WCAG 2.2).
<https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
- *Type:* standard / W3C REC (supporting material for WCAG 2.2, a W3C Recommendation). *Access:* open.
- *Underpins:* the **derivation** of PatoDS's thresholds. The 3:1 minimum for normal vision comes from
  `[ISO-9241-3]` and `[ANSI-HFES-100-1988]`; 4.5:1 adds the empirical finding that 20/40 acuity
  implies a contrast-sensitivity loss of ~1.5 `[ARDITI-FAYE]`, so 3 × 1.5 = 4.5 (and 20/80 → 7:1 for
  AAA). It states the ratios are **thresholds that must not be rounded** ("4.499:1 would not meet the
  4.5:1 threshold") — matching PatoDS's "ratio without rounding, passing with ≥ minimum." It also
  documents the `0.05` term (ambient/viewing flare from IEC 61966-2-1) and the sRGB linearization
  source, and explains the *intent* that contrast be computed so that hue is not a key factor — the
  justification for using a luminance metric at all.

**Relative luminance** — WCAG Working Group wiki (W3C).
<https://www.w3.org/WAI/GL/wiki/Relative_luminance>
- *Type:* W3C WG wiki (informative). *Access:* open.
- *Underpins:* the exact formula PatoDS reimplements —
  `L = 0.2126·R + 0.7152·G + 0.0722·B`, with per-channel linearization `c/12.92` below the piecewise
  threshold else `((c+0.055)/1.055)^2.4`. **Crucially**, it carries an **errata notice**: the correct
  IEC threshold is `0.04045`, *not* the `0.03928` printed in the WCAG 2.x text, and "for 8 bit color
  values the difference is not significant." PatoDS uses `0.04045` — i.e. it follows the IEC-correct
  value, which is *more* correct than the literal WCAG 2.x spec. The page also notes WCAG 3 "is
  following a new paradigm based on modern vision science." See §7.

**CSS Color Module Level 4, §14 Gamut Mapping** — W3C CSS WG.
<https://www.w3.org/TR/css-color-4/#gamut-mapping>
- *Type:* W3C CR / draft. *Access:* open.
- *Underpins:* PatoDS emits DTCG color components to sRGB by the CSS Color 4 algorithm and maps
  out-of-gamut colors with **`deltaEOK` (an OKLab-based ΔE) under a just-noticeable-difference
  threshold**, via binary-search "Local MINDE" chroma reduction in **OKLCh**: "If the current color is
  outside the gamut boundary, but the `deltaEOK` between it and the clipped version is below a
  threshold for a just noticeable difference (JND), the clipped version … is returned." The spec sets
  one JND = `0.02` for OKLCh — exactly PatoDS's "deltaEOK JND 0.02, always passed explicitly" (D5).

**Compositing and Blending Level 1** — W3C CSS/FX WG.
<https://www.w3.org/TR/compositing-1/>
- *Type:* W3C CR / draft. *Access:* open.
- *Underpins:* defines "Simple Alpha Compositing," in which each element "is merged with its backdrop
  using the **Porter Duff source-over operator**." This is the operator browsers use to paint
  translucent layers, so PatoDS composites pairs **source-over** over an opaque surface stack *before*
  measuring contrast — ensuring "the measured is the emitted" (A11Y-09, D5).

**A perceptual color space for image processing (Oklab)** — Björn Ottosson, 2020 (updated 2025).
<https://bottosson.github.io/posts/oklab/>
- *Type:* original author work. *Access:* open (public-domain + MIT reference code).
- *Underpins:* the scientific basis for `deltaEOK`. Oklab is a D65, opponent-type perceptual space
  derived to predict lightness, chroma, and hue with near-**orthogonal** L/C/h, outperforming CIELAB
  on hue/lightness prediction; it is the space CSS Color 4/5 (and Photoshop, major browsers) adopted.
  PatoDS inherits this via colorjs.io's CSS Color 4 gamut mapping.

**The corrected introduction to APCA** + **APCA for W3C & WCAG3 (`apca-w3`)** — Andrew Somers / Myndex.
<https://github.com/Myndex/apca-introduction> · <https://github.com/Myndex/apca-w3> ·
<https://raw.githubusercontent.com/Myndex/apca-w3/master/LICENSE.md>
- *Type:* original author work / draft method. *Access:* open (code restrictively licensed).
- *Underpins (by exclusion):* APCA is "a supra-threshold visual contrast prediction model … tuned to
  readability on self-illuminated displays" that "follows human perception, including … font weight
  and size," outputs a signed `Lc`, and is the candidate contrast method for WCAG 3. PatoDS **does not
  adopt it**, and the sources confirm the two stated reasons: (a) it is *not the WCAG 2.2 normative
  metric*; (b) its license is restrictive — the `apca-w3` LICENSE is a "W3 License for Compliant Code
  Only," licensed to the W3/AGWG "for use with WCAG accessibility guidelines … and not for any other
  use," with "Patent(s) pending" and "All Rights Reserved." That is incompatible with PatoDS's
  permissively-licensed (MIT/Apache) build pipeline and with measuring against a *contractual*
  conformance level. See §7 for the WCAG 2 vs APCA debate.

> *Standards cited through the WCAG Understanding doc but not independently opened (paywalled ISO/IEC):*
> IEC 61966-2-1 (sRGB), ISO-9241-3, ANSI/HFES 100-1988. They are the primary scientific/industrial
> basis for the linearization and the 3:1 floor; PatoDS relies on them transitively via the open WCAG
> material.

### 2.2 Synthesis

This is the most rigorously grounded pillar. PatoDS's contrast engine is faithful to the normative
chain: WCAG 2.2 relative luminance + contrast ratio (with the IEC-correct `0.04045`), CSS Color 4 sRGB
emission and OKLCh/`deltaEOK` gamut mapping, and Compositing L1 source-over. Compositing *before*
measuring, over a versioned pair manifest, is a genuinely stronger guarantee than most contrast
checkers provide (many measure declared colors, ignoring alpha). Taking the **minimum** of the
floating-point ratio and an 8-bit-rounded ratio (axe-core-style) is a defensible robustness margin.

**Challenged assumptions (flagged, detailed in §7):** (a) the WCAG 2 luminance ratio itself is
contested vs APCA; (b) PatoDS's `0.04045` diverges from the *literal* WCAG 2.x text and from some
popular checkers that used `0.03928`; (c) compositing in gamma-encoded sRGB is "what the browser
shows," not physically-correct linear-light blending — a pragmatic, not colorimetric, choice.

---

## 3. Multi-framework / framework-agnostic UI

**PatoDS decisions covered:** styles live in an agnostic CSS core with prefixed classes and `@layer`
layers; React/Vue packages contain **no CSS** and apply the same core classes (ADR-03, CMP-04);
interactive components are built on **headless primitives from a maintained library accessible in each
framework** (ADR-04, CMP-02); React/Vue API parity verified by machine (Constitution IV); SSR with no
hydration warnings and RSC `use client` boundaries (CMP-08, CMP-22).

### 3.1 Primary sources

**CSS Cascading and Inheritance Level 5, §6.4 Cascade Layers** — W3C CSS WG.
<https://www.w3.org/TR/css-cascade-5/#layering>
- *Type:* W3C CR / draft. *Access:* open.
- *Underpins:* the normative semantics of `@layer` (§6.4.1–6.4.4 declaring layers, §6.4.3 Layer
  Ordering, §6.5 precedence). Cascade layers sort in the cascade **above selector specificity** (but
  below importance/origin): later-declared layers win for normal declarations, and **unlayered normal
  styles win over layered ones**. This is precisely what lets PatoDS put all tokens/components in
  `@layer <prefixo>.tokens`, publish a fixed layer order, and tell consumers to wrap legacy CSS in a
  *lower* layer for conflict-free coexistence (MIG-07, MIG-14) without specificity wars.

**CSS Custom Properties for Cascading Variables Level 1** — W3C CSS WG.
<https://www.w3.org/TR/css-variables-1/>
- *Type:* W3C CR / draft. *Access:* open.
- *Underpins:* the "space-toggle" brand/mode resolver (D3) depends on custom-property semantics:
  "Custom properties are ordinary properties, so they can be declared on any element, are resolved
  with the normal inheritance … rules." Because the computed value substitutes `var()` and inherits,
  PatoDS can redeclare semantic/component tokens at each brand/mode scope so the **nearest scope wins
  per axis** (FR-012, TOK-14) — a direct consequence of this spec.

**Ark UI — Unstyled UI components** — Chakra/Ark UI, project documentation (accessed 2026-11-07).
<https://ark-ui.com/>
- *Type:* official docs (OSS). *Access:* open.
- *Underpins:* the ADR-04 / CMP-02 headless strategy and the agnostic-core claim. Ark UI is "a
  headless library with 45+ accessible components … across React, Solid, Vue, and Svelte," "Truly
  Headless" (no default styles), "Framework Agnostic" ("the same API works across React, Solid, Vue,
  and Svelte"), "Accessible by Default" (WAI-ARIA patterns, keyboard nav, screen-reader support), and
  "State Machine Powered." A single library giving React **and** Vue the same accessible primitive is
  exactly what makes "agnostic core, native implementation per framework" + machine-checked parity
  feasible. (Component library selection is finalized in feature 002 behind the CMP-28 PoC.)

**WAI-ARIA Authoring Practices Guide (APG) — Patterns** — W3C WAI.
<https://www.w3.org/WAI/ARIA/apg/patterns/>
- *Type:* W3C Group Note. *Access:* open.
- *Underpins:* A11Y-04 ("operable by keyboard alone per the applicable APG pattern"). The APG defines
  the keyboard-interaction and roles for each widget (Accordion, Dialog, Button, …) and opens with the
  governing caution, "No ARIA is better than Bad ARIA." It is the reference each PatoDS interactive
  component is audited against.

**`'use client'` directive** — React (react.dev), official documentation.
<https://react.dev/reference/rsc/use-client>
- *Type:* official docs. *Access:* open.
- *Underpins:* CMP-22 — "every module with hooks or event handlers MUST have `use client`; the catalog
  MUST mark each component as server-safe or client-only." The directive is the normative React
  mechanism marking the server/client module boundary in RSC.

**Server-Side Rendering (SSR)** — Vue.js, official documentation.
<https://vuejs.org/guide/scaling-up/ssr>
- *Type:* official docs. *Access:* open.
- *Underpins:* the Vue half of SSR parity (CMP-08). Vue renders components "into HTML strings on the
  server … and finally 'hydrate' the static markup into a fully interactive app on the client"
  (isomorphic/universal). PatoDS's "no browser APIs in render/setup, zero hydration warnings, CSS in
  the initial HTML" rule is this model's correctness contract, mirrored across React and Vue.

### 3.2 Synthesis

The CSS mechanism is on solid normative ground: Cascade Layers + Custom Properties give PatoDS
deterministic, specificity-free theming and legacy coexistence with only features it already requires
(`@layer`). Headless primitives with one cross-framework API (Ark UI) plus machine-verified parity is
a coherent answer to "write behavior twice without diverging." The SSR/RSC constraints map cleanly to
the official React and Vue models.

**Challenged assumption:** the agnostic-core claim is only as durable as the chosen headless library's
cross-framework maintenance, and *true* React/Vue idiom parity (`v-model` vs `value` + callback) is
not free — it still requires PatoDS's own normalization rules and CI parity checks (CMP-03, CMP-12).
The library gives the primitive; parity is still something PatoDS must *prove*, not inherit. See §7.

---

## 4. Deterministic and reproducible builds

**PatoDS decisions covered:** two builds from the same token source must be **byte-for-byte identical**
(TOK-05); catalog generation is deterministic — same commit on different machines yields the same hash
(IA-04); a custom deterministic writer (code-point ordering, LF, no timestamp or absolute path) and a
determinism test across two `git worktree`s with different paths, `TZ`, and `LC_ALL`
([research.md](../../specs/001-design-tokens-themes/research.md) D6).

### 4.1 Primary sources

**Definitions** — Reproducible Builds project, documentation (accessed 2026-11-07).
<https://reproducible-builds.org/docs/definition/>
- *Type:* official docs (project). *Access:* open.
- *Underpins:* the canonical definition PatoDS implements: "A build is reproducible if given the same
  source code, build environment and build instructions, any party can recreate **bit-by-bit identical
  copies** of all specified artifacts." The docs enumerate the exact sources of nondeterminism PatoDS
  guards against — **timestamps, timezones, locales, stable order for inputs and outputs, randomness,
  build path, archive metadata, version information** (and `SOURCE_DATE_EPOCH`). PatoDS's writer
  (code-point order, LF, no timestamp/abs-path) and its `TZ`/`LC_ALL`/distinct-path test are a
  point-for-point application of this guidance; the docs even name **locale** as a build-environment
  attribute "preferable to reduce," matching research.md's note that Terrazzo sorts with an
  ICU-dependent collator (hence PatoDS's own ordering).

**Reproducible Builds: Increasing the Integrity of Software Supply Chains** — Chris Lamb, Stefano
Zacchiroli, *IEEE Software*, vol. 39(2), 2022 (IEEE Software Best Paper). arXiv:2104.06020.
<https://arxiv.org/abs/2104.06020>
- *Type:* peer-reviewed. *Access:* OA preprint (arXiv); published version paywalled (IEEE).
- *Underpins:* the *why*. "Trusting code is not the same as trusting its executable counterparts.
  These are typically built and distributed by third-party vendors, with severe security consequences
  if their supply chains are compromised." Reproducible builds let any party "determine whether
  generated binaries correspond with their original source code," when "every build generates bit-for-
  bit identical results." Because PatoDS is a dependency of every consuming app, byte-identical builds
  (TOK-05/IA-04) are its mechanism for making tampering detectable — the paper's central thesis.

### 4.2 Synthesis

PatoDS's determinism design is textbook-faithful to reproducible-builds.org and is motivated exactly
as the peer-reviewed literature motivates it. Its concrete controls (deterministic writer, worktree +
`TZ`/`LC_ALL`/path matrix, floor-vs-latest-Node comparison) target the specific nondeterminism sources
the project documentation names.

**Challenged assumption:** reproducibility is an *ongoing property*, not a one-time proof. The IEEE
paper and the project both stress that environment drift (toolchain, ICU/collator versions) re-breaks
reproducibility; PatoDS's node-floor-vs-latest and nightly repetition are the right posture, but the
guarantee holds only as long as those gates keep running. See §7.

---

## 5. Supply-chain security

**PatoDS decisions covered:** every version has a **signed provenance attestation and an SBOM** (ENG-09,
ENG-19); publish only via the pipeline (ENG-15); dependencies installed from a **frozen lockfile**
(ENG-16); third-party CI actions **pinned by SHA digest** (ENG-18); install scripts blocked except an
allowlist (ENG-24); the `@<prefixo>` registry scope reserved and checked (ENG-20); a pnpm
`minimumReleaseAge` of 1440 min on every pin
([research.md](../../specs/001-design-tokens-themes/research.md) cross-cutting rules).

### 5.1 Primary sources

**SLSA — Security levels (v1.0)** — OpenSSF / SLSA, specification (accessed 2026-11-07).
<https://slsa.dev/spec/v1.0/levels>
- *Type:* open specification. *Access:* open.
- *Underpins:* the provenance ladder behind ENG-09/ENG-15. SLSA's Build track runs **L0 (no
  guarantees) → L1 (provenance exists) → L2 (hosted build platform) → L3 (hardened builds)**, giving
  "increasing supply chain security guarantees … that software hasn't been tampered with and can be
  securely traced back to its source." PatoDS's "signed provenance attestation" is the L1+ concept;
  "published only by the pipeline, two-person MFA approval, no personal token" is the L2/L3 hardened/
  hosted-platform posture.

**in-toto: Providing farm-to-table guarantees for bits and bytes** — S. Torres-Arias, H. Afzali, T. K.
Kuppusamy, R. Curtmola, J. Cappos, *28th USENIX Security Symposium*, 2019.
<https://www.usenix.org/conference/usenixsecurity19/presentation/torres-arias>
- *Type:* peer-reviewed. *Access:* open (USENIX OA).
- *Underpins:* the academic basis of end-to-end attestation (SLSA provenance descends from in-toto).
  It models the chain "developers check source … compiled at a build farm … CI/CD runs tests … 
  packaged for distribution," where "an attacker able to compromise any single step … can maliciously
  modify the software," and provides cryptographic integrity across the *whole* chain. This is the
  theory PatoDS operationalizes by constraining who may build and publish.

**Small World with High Risks: A Study of Security Threats in the npm Ecosystem** — M. Zimmermann, C.-A.
Staicu, C. Tenny, M. Pradel, *28th USENIX Security Symposium*, 2019. arXiv:1902.09217.
<https://arxiv.org/abs/1902.09217>
- *Type:* peer-reviewed. *Access:* open (USENIX OA / arXiv).
- *Underpins:* the quantitative case for PatoDS's dependency minimalism. Over "800,000 free and
  reusable software packages," it shows transitive-dependency reach and **maintainer concentration**
  are structural risks — a few accounts can compromise most of the ecosystem. PatoDS answers with leaf
  packages that have no workspace deps, "light dependencies," `blockExoticSubdeps`, and enforced layer
  boundaries (ENG-01) that keep tools out of the UI's production closure.

**Backstabber's Knife Collection: A Review of Open Source Software Supply Chain Attacks** — M. Ohm, H.
Plate, A. Sykosch, M. Meier, *DIMVA 2020*. arXiv:2005.09535 (DOI 10.1007/978-3-030-52683-2_2).
<https://arxiv.org/abs/2005.09535>
- *Type:* peer-reviewed. *Access:* OA (arXiv + Fraunhofer repository).
- *Underpins:* the install-time threat model. A dataset of **174 real malicious packages** shows
  injection "to compromise dependent systems further down the chain," often via dependency managers
  that "automatically resolve, download and install hundreds of open source packages." PatoDS's
  install-script blocking (ENG-24), allowlisted tarball files with no install scripts (ENG-17), and
  `minimumReleaseAge` are direct countermeasures to these attack trees.

**Dependency Confusion: How I Hacked Into Apple, Microsoft and Dozens of Other Companies** — Alex
Birsan, 2021.
<https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610>
- *Type:* technical article (industry research). *Access:* open.
- *Underpins:* the specific attack that motivates scope reservation + `minimumReleaseAge`. A
  higher-version package published to a *public* registry shadows a private internal one of the same
  name. PatoDS defends by reserving and daily-checking the `@<prefixo>` scope (ENG-20), frozen
  installs (ENG-16), and a minimum release-age window that denies a freshly-published malicious
  version an instant auto-upgrade.

**SPDX — Overview** — Linux Foundation / ISO, standard (accessed 2026-11-07).
<https://spdx.dev/about/overview/>
- *Type:* ISO/IEC standard. *Access:* open (SPDX spec); ISO PDF paywalled.
- *Underpins:* the SBOM requirement (ENG-19). SPDX is "an open standard for communicating software
  bill of material information, including provenance, license, security," "recognized as the
  international open standard … as **ISO/IEC 5962:2021**." PatoDS's `pnpm sbom` + ENG-21 license policy
  live in this standard's world.

### 5.2 Synthesis

PatoDS's supply-chain controls line up with both the standards (SLSA, SPDX) and the peer-reviewed
threat literature (in-toto for integrity theory; Small World, Backstabber's, and Birsan for the
measured threats). The constitution's framing — "a design system is a dependency of every app;
compromising it compromises them all" — is precisely the Lamb/Zacchiroli and in-toto thesis. This
pillar is well-evidenced and non-controversial; the open question is operational (keeping every gate
green), not conceptual.

---

## 6. Design-tool synchronization

**PatoDS decisions covered:** sync is **one-directional** (repo → tool); the tool receives variables,
no routine imports variables back (DSN-01); a manual edit at the destination is restored by the next
sync and logged (DSN-03); tool variables have **names and hierarchy identical to the tokens**, with
brand and mode as independently swappable axes (DSN-04, DSN-05); divergences are detected
automatically with a trackable item, owner, and deadline (DSN-11); a ports-and-adapters package with
*no operation that reads from the tool into the repo*
([research.md](../../specs/001-design-tokens-themes/research.md) D4, ADR-14).

### 6.1 Primary sources

**Variables (REST API)** — Figma, Developer Documentation (accessed 2026-11-07).
<https://developers.figma.com/docs/rest-api/variables/>
- *Type:* official docs (vendor). *Access:* open.
- *Underpins:* the concrete transport constraints PatoDS documented without yet choosing a tool. The
  Variables REST API has endpoints "for querying, creating, updating, and deleting variables" and is
  meant to "sync design system source of truth to and from Figma" and "integrate Figma directly with
  CI." Critically, "To use this API, you must have a **Full seat in an Enterprise org**" (both GET and
  POST require Enterprise), and updated variables "need to publish … before they can be used in other
  files" — i.e. there is no REST *library-publishing* endpoint, so publishing becomes a manual,
  trackable step. These are exactly the limits research.md D4 records for the Figma option.

**Design Tokens Resolver Module 2025.10** — Design Tokens Community Group, 2025 (see §1).
<https://www.designtokens.org/tr/2025.10/resolver/>
- *Type:* W3C CG report. *Access:* open.
- *Underpins:* the **identity-by-name** and **orthogonal-axis** basis for sync. Because the Resolver
  models brand and mode as orthogonal modifiers over named sets, PatoDS can map each token to a tool
  variable of the *same name and hierarchy* (DSN-04/DSN-05) with "zero auxiliary variables" — every
  tool variable corresponds to a real token. Divergence detection and prune ("restore manual edits")
  then reduce to a name-keyed diff between the generated manifest and the tool's variable set.

### 6.2 Synthesis

The one-directional design is well-justified by first principles and by the tool's own API shape. The
DTCG Resolver supplies a canonical, name-keyed, orthogonal source; Figma's Variables REST API supplies
a CRUD transport whose constraints (Enterprise/Full-seat, manual publish, mode limits) PatoDS has
documented rather than hidden. Matching by name and pruning extras is the natural diff over a
name-identity source.

**Challenged assumption:** Figma's API is advertised as syncing "**to and from**" Figma —
bidirectional is *possible*. PatoDS deliberately forbids the import direction (Principle I: the tool
must not become an undeclared source), accepting that designer edits made in the tool are overwritten
and logged (DSN-03). That is a governance choice, not a technical necessity, and it is the right one
for a single-source system — but it is a constraint PatoDS imposes, not one the tool requires. See §7.

---

## 7. Open questions / where the evidence is contested

1. **WCAG 2.x luminance ratio vs APCA (the central debate).** The WCAG 2.2 metric
   `(L1 + 0.05)/(L2 + 0.05)` is luminance-only: it ignores spatial frequency (font weight/size) and
   polarity (light-on-dark vs dark-on-light), and is widely reported to mispredict contrast for dark
   themes and thin/saturated text — the motivation for APCA, the WCAG 3 candidate, which models
   polarity and spatial frequency and emits a signed `Lc`. **But** APCA is non-normative (WCAG 3 is
   years away), patent-pending, and restrictively licensed ("compliant code only," not for non-WCAG
   use), and its headline validation (≈500 color pairs) is largely single-author rather than
   independently replicated. **PatoDS's position** — measure the *normative, contractually enforceable,
   permissively-reimplementable* WCAG 2.2 metric and treat APCA as out of scope — is defensible and
   arguably the only choice compatible with an MIT/Apache pipeline and a declared AA conformance
   target. The honest caveat: PatoDS can pass pairs APCA would flag as hard to read (and, occasionally,
   fail pairs APCA would accept). *PatoDS's AA conformance is exactly as good — and as limited — as the
   WCAG 2 metric itself.*

2. **The `0.03928` vs `0.04045` linearization threshold.** PatoDS uses `0.04045`, which the WCAG WG's
   own errata calls the IEC-correct value — so PatoDS is *more* correct than the literal WCAG 2.x spec
   text (`0.03928`). The WG notes the 8-bit difference is "not significant." The nuance: some popular
   checkers historically used `0.03928`, so PatoDS's ratios can differ in the last decimals from those
   tools. PatoDS mitigates by taking the **minimum** of the float ratio and an 8-bit-rounded ratio, so
   it never over-reports. This is a (minor) interop footnote, not a correctness problem — but worth
   documenting so a reviewer comparing PatoDS against `axe` output understands any last-decimal gap.

3. **Compositing in gamma-encoded sRGB, not linear light.** PatoDS composites source-over in
   gamma-encoded sRGB "to match what the browser shows," explicitly rejecting physically-correct
   linear-light alpha blending. Colorimetrically, linear-light compositing is the "true" blend; but
   browsers (and axe) composite in gamma space, so "measure what is actually emitted" favors PatoDS's
   choice. This is a pragmatic decision aligned with rendered reality, not a claim of colorimetric
   correctness — and it is the right call for a *conformance* tool, as long as it is labeled as such.

4. **DTCG 2025.10 is pre-standard.** The Format and Resolver modules are *Community Group Final
   Reports*, explicitly "not a W3C Standard," and the only mature 2025.10/Resolver parser (Terrazzo)
   has a single npm publisher (bus-factor risk) and a fast release cadence. PatoDS bets its single
   source of appearance on this. The mitigations (schema sha256-pinning, golden outputs, the official
   DTCG test suite as an upgrade gate, MIT fork-viability) are appropriate, but the foundation can
   still move under the project; this should be revisited if/when a W3C Recommendation supersedes the
   CG reports.

5. **Reproducibility is continuous, not proven-once.** Byte-identical output depends on toolchain
   stability (notably ICU/collator versions — the reason PatoDS overrides Terrazzo's collator with
   code-point ordering). The Lamb/Zacchiroli work and reproducible-builds.org both frame
   reproducibility as a property that environment drift re-breaks. PatoDS's floor-vs-latest-Node and
   nightly cross-runner repetition are the correct defense, but the guarantee is only as live as those
   gates.

6. **One-directional sync vs a bidirectional-capable API.** Figma's Variables API supports writing
   "to and from" Figma; PatoDS forbids the import direction by policy (Principle I). The trade-off is
   real: designers cannot round-trip changes through the tool; in-tool edits are overwritten and
   logged. This is the correct governance stance for a single-source system, but teams expecting
   designer-authored tokens to flow back into the repo will find this intentionally blocked.

7. **Agnostic-core parity is asserted, then must be proven.** A headless library with one
   cross-framework API (e.g. Ark UI) makes React/Vue parity *feasible*, but idiomatic parity
   (`v-model` vs `value` + callback), identical normalized DOM, and a single behavior spec run on both
   frameworks are things PatoDS must *verify by machine* (CMP-03, CMP-12, CMP-14, CMP-15), and the
   whole strategy inherits the chosen library's cross-framework-maintenance risk. The evidence
   supports feasibility, not automatic parity.

---

## 8. Reference legend

**Type.** `standard / W3C REC` — a ratified W3C Recommendation (e.g. WCAG 2.2) or supporting material
thereof. `W3C CR / draft` — a Candidate Recommendation or Working Draft (normative-track but not
finalized; e.g. CSS Color 4, Compositing 1, CSS Cascade 5, CSS Variables 1). `W3C CG report` — a
Community Group Final Report (stable, *not* a W3C Standard; DTCG). `ISO/IEC standard` — an
international standard (e.g. ISO/IEC 5962:2021 SPDX). `peer-reviewed` — published after academic peer
review (USENIX Security, DIMVA, IEEE Software). `official docs` — first-party product/project
documentation. `technical article` — expert industry writing (not peer-reviewed). `original author
work` — the primary work of the method's author (Oklab, APCA).

**Access.** `open` — freely readable. `OA preprint` — an open preprint (arXiv) of a work whose
publisher version is paywalled. `paywalled` — behind a purchase/subscription wall; where used, an
open equivalent (preprint, standard text, or the W3C material that cites it) is cited instead.

**Method note.** All URLs above were opened and read in a live logged-in browser on 2026-11-07. Where
a source's full text sat behind a paywall (IEC 61966-2-1, ISO-9241-3, ANSI/HFES 100-1988, the IEEE
published PDF), the claim is anchored to an open equivalent — the WCAG 2.2 Understanding material or
the arXiv preprint — and the paywalled original is named but not quoted. No citation in this document
rests on a page that could not be opened and verified.
