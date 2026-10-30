# Feature Specification: Design tokens and themes

**Feature Branch**: `001-design-tokens-themes`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Feature 001 — PatoDS Design tokens and themes (Phase 1). Source: docs/requisitos.md, the \"Design tokens and themes\" section and linked items. Scope: single token source in DTCG with three layers (primitive, semantic, component) and CI validation (TOK-01, TOK-02, TOK-04, TOK-09, TOK-10, TOK-13); deterministic generation of prefixed CSS custom properties and typed ESM modules with maps by brand and mode (TOK-05, TOK-06); multiple brands and light/dark modes as independent axes via attributes, applicable to any subtree with nested scopes at the CSS level (TOK-07, TOK-08, TOK-14); each brand's CSS importable without the others (ENG-06); manifest of contrast pairs per target level (A11Y-09); style lint that blocks primitive tokens, literal values, and control heights outside the scale (TOK-03, TOK-13, applied to the core once it exists); sync with the design tool in the direction of the current premise, with manual-edit restoration, identical names and hierarchy, swappable brand and mode, and token divergence detection (DSN-01 to DSN-05, DSN-11 for the token part). TOK-12 is Desirable: included only if contracted. Out of this feature: components, the theme Provider and its React/Vue nested-theme and SSR tests (components feature), fundamentals documentation (DOC-05, docs feature), legacy token mapping (MIG-03). Prefix still undefined: use <prefixo>. Comply with constitution v1.0.0."

Requirements source: [docs/requisitos.md](../../docs/requisitos.md). The IDs in parentheses
(TOK-xx, DSN-xx, etc.) refer to it. Applicable constitution principles: I, II, III, V, VII,
IX, X, and XI.

## Clarifications

### Session 2026-10-21

Adjustments coming from the plan research ([research.md](research.md)); none decides an open premise.

- Q: How does the CSS satisfy "only that brand's selectors" (ENG-06) if brand and mode are independent axes?
  → A: Distribution in a brand-neutral `base.css` (layer order, shared primitives,
  default mode, and token resolver) plus one file per brand with only its own selectors; the app imports
  `base.css` and the brand's file (FR-013, FR-017).
- Q: What counts as a "variable without a value" (ENG-06, FR-013, FR-014, SC-006)? → A: A public token
  `--<prefixo>-*` (name without the private `_` segment) that is empty or guaranteed invalid, or a `var()` without
  a fallback that resolves that way. The scoping mechanism's private variables, with the `_` segment, are empty
  or `initial` by design and are out of scope. Interpretation to be confirmed with the acceptor.
- Q: Do inactive or disabled state pairs fail the contrast check? → A: No. WCAG 2.2 AA
  (A11Y-01 premise) exempts inactive components: those pairs stay in the manifest, are measured and
  reported, but do not fail the build (FR-020).
- Q: Does a focus indicator that falls partly inside and partly outside the component need 3:1 on both
  sides? → A: No; one of the sides is enough (Understanding 1.4.11). The manifest declares those pairs as a
  group in which at least one member meets the minimum (FR-020).
- Q: How does a token that varies by brand and by mode appear in the design tool with brand and mode
  in independent collections and without auxiliary variables (DSN-04, DSN-05)? → A: The source expresses it as a
  mode-axis token whose value in each mode is an alias to a brand-axis token with the same keys
  across every brand (FR-033).
- Q: Adding a brand regenerates the token API report, versioned as required by QA-08.
  Does this violate "only token files" (TOK-07)? → A: No. The report is a token file,
  derived from the source and never edited by hand; the diff check accepts the source and this report and
  rejects any other file (FR-009, SC-005).
- Q: Are composite typography tokens published? → A: No. Only tokens with a single CSS value are
  publishable; the typography category uses atomic tokens (family, weight, size, line height,
  spacing), which keeps one token per custom property, per value-map entry, and per
  variable in the design tool (FR-006, FR-016, FR-028).

## User Scenarios & Testing *(mandatory)*

Actors:

- **DS maintainer**: the person who creates and changes tokens in the PatoDS repository.
- **Brand design lead**: the requester's person who defines each brand's values.
- **Consumer app dev**: the person who uses the published tokens in a React, Vue, or
  any web-page application.
- **Designer**: the person who uses the PatoDS variables in the design tool.
- **Sync owner**: the vendor role that runs the sync with the design
  tool and fixes failures (DSN-02).

### User Story 1 - Define tokens in a single validated source (Priority: P1)

The DS maintainer defines all tokens in a single place, in an open format, organized into
primitive, semantic, and component layers, with standardized names. Every proposed change goes
through automated validation before being integrated; a malformed, misnamed token, one with a literal value
outside the primitive layer, or one with an invalid reference is blocked.

**Why this priority**: everything else (generated outputs, themes, contrast, sync) depends on
a reliable single source. Without it, there is no "single source of appearance" (ADR-02, Principle II).

**Independent Test**: propose changes with valid and invalid tokens (name off the standard, literal
in the semantic layer, alias to a nonexistent token, alias cycle, category without a semantic token) and
confirm that only the valid ones pass, with a report by category.

**Acceptance Scenarios**:

1. **Given** a valid token source, **When** the maintainer proposes a semantic token with a literal
   value, **Then** validation rejects the change and points to the token and the violated rule.
2. **Given** a valid token source, **When** the maintainer proposes a token with a name off the
   convention, **Then** validation rejects the change.
3. **Given** a valid token source, **When** someone tries to define a token outside the single source
   (for example, a color variable declared directly in a style file), **Then** the validation scan
   finds the occurrence and blocks the integration.
4. **Given** a valid change, **When** validation finishes, **Then** the report lists the
   token count by category and the control-height scale of each theme.

---

### User Story 2 - Consume generated tokens with brand and mode per subtree (Priority: P2)

The consumer app dev imports a brand's CSS and, optionally, the typed reference
modules. She chooses brand and mode (light or dark) by marking any element on the page, and can
nest scopes: an area in dark mode inside a light page, or a different brand inside
another. When she types the name of a nonexistent token, she gets a type error.

**Why this priority**: it is the value delivery for whoever uses the design system; without it the tokens never
leave the repository.

**Independent Test**: in an example app that imports only brand A's CSS, toggle mode and
nest brand and mode scopes; check the applied values in each scope, the absence of
brand B-exclusive variables, and the absence of variables without a value; in a typed project, reference
a nonexistent token and confirm the type error.

**Acceptance Scenarios**:

1. **Given** an app that imports only brand A's CSS, selected per FR-013, **When** the
   content is analyzed, **Then** there is no brand B-exclusive variable and no variable used without a value.
2. **Given** an element with brand A and light mode, **When** a descendant declares dark mode,
   **Then** the descendant uses brand A and dark mode values, and the rest stays on brand A
   and light mode.
3. **Given** alternating scopes brand A → brand B → brand A, **When** the values are read in the
   innermost scope, **Then** brand A's values apply.
4. **Given** a typed project that uses the token modules, **When** the code references a nonexistent
   token name, **Then** type checking fails.
5. **Given** the same token source, **When** the build runs twice, **Then** the outputs are
   byte-for-byte identical.

---

### User Story 3 - Add a brand without touching components (Priority: P3)

The brand design lead delivers a new brand's values, and the maintainer adds it by changing
only token files. The new brand then exists in light and dark modes, with the
same set of semantic keys as the others, and can be switched at runtime.

**Why this priority**: multiple brands are a contract requirement (TOK-07), but they depend on
stories 1 and 2.

**Independent Test**: add a new synthetic brand and check in the diff that only token files
changed (source and regenerated API report); check that the key check passes and that the example app toggles
between the new brand and another at runtime.

**Acceptance Scenarios**:

1. **Given** two published brands, **When** the maintainer adds a third, **Then** the diff
   changes only token files: the source and the regenerated token API report.
2. **Given** a new brand missing a semantic key that the others have, **When** validation runs,
   **Then** the change is blocked and the missing key is pointed out.
3. **Given** the example app, **When** the dev switches the brand at runtime, **Then** the
   applied values change without reloading the page and without changing component code.

---

### User Story 4 - Guarantee contrast across all combinations (Priority: P4)

Each pair of foreground and background colors, in each state, is declared in a manifest and measured across all
brand and mode combinations. A pair that does not reach the ratio required by the target accessibility
level fails the build.

**Why this priority**: accessibility is non-negotiable (Principle V), but the check only takes
effect after color tokens and brands exist.

**Independent Test**: include in the manifest a pair known to fail and another with a translucent
color; confirm that the build fails on the first and that the second is measured with the opacity
composited over the background.

**Acceptance Scenarios**:

1. **Given** a text pair with a ratio below 4.5:1 in any combination, **When** the build
   runs, **Then** the build fails and points to the pair, brand, and mode.
2. **Given** a non-text pair (including a focus indicator) below 3:1, **When** the build runs,
   **Then** the build fails.
3. **Given** a foreground color with opacity, **When** the ratio is calculated, **Then** the color is
   composited over the background before the calculation.
4. **Given** an example style that uses a color pair missing from the manifest, **When** the
   check runs, **Then** it fails and points to the pair.

---

### User Story 5 - Block styles outside the tokens (Priority: P5)

The maintainer writing component styles gets a lint error when using a primitive token, a literal
value, or a control height outside the single scale.

**Why this priority**: the rule protects the style core, which is born in the components feature;
here it is delivered and proven by examples, and it starts to apply to the core as soon as it exists.

**Independent Test**: run the lint over valid and invalid examples and confirm 100% of the
expected errors and zero false positives.

**Acceptance Scenarios**:

1. **Given** a component style that uses a primitive token, **When** the lint runs, **Then** the
   merge is blocked.
2. **Given** a component style with a literal value for color, space, or radius, **When** the lint
   runs, **Then** the merge is blocked.
3. **Given** an interactive control with a height outside the scale, **When** the lint runs, **Then** the
   merge is blocked.
4. **Given** styles that use only semantic or component tokens, **When** the lint runs,
   **Then** there is no error.

---

### User Story 6 - Keep the design tool synced with the repository (Priority: P6)

With each published version, the design tool's variables receive the repository's tokens,
with the same names and hierarchy, brand and mode as independent axes. A manual edit in the
tool is undone on the next sync. Divergences are detected by a scheduled check
and become trackable items with an assignee and due date.

**Why this priority**: it keeps design and code aligned (DSN section), but it depends on published
tokens and the decision about the tool.

**Independent Test**: publish a version and check the log of changed variables; edit a
variable by hand in the tool and check that the next sync restores the value and records the
occurrence; switch only the brand or only the mode of a frame and check that the values change without relinking
layers; cause a divergence and check the generated item.

**Acceptance Scenarios**:

1. **Given** a published version, **When** the sync runs, **Then** the tool's
   variables reflect the tokens and the log lists the changed variables.
2. **Given** a variable edited by hand in the tool, **When** the next sync runs,
   **Then** the source value is restored and the occurrence stays in the log.
3. **Given** a frame in the tool, **When** the designer switches only the brand or only the mode, **Then**
   the values change without relinking layers.
4. **Given** a name, hierarchy, or value divergence between tool and repository, **When**
   the scheduled check runs, **Then** a trackable item with an assignee and due date is created.
5. **Given** a sync failure, **When** it occurs, **Then** an alert is assigned to the
   sync owner.
6. **Given** the current premise, **When** the repository is inspected, **Then** there is no routine
   that imports variables from the tool into the repository.

---

### Edge Cases

- An alias that points to a nonexistent token or forms a cycle: validation fails and points to the chain.
- A token that references a layer above its own (for example, a primitive referencing a semantic): the
  validation fails.
- A brand or mode with one more or one fewer semantic key than the other combinations: blocked (TOK-09).
- An inner scope that defines only the mode: it inherits the brand from the nearest ancestor and applies the
  new mode; the same holds when defining only the brand (each axis resolves from the nearest scope).
- Alternating brand scopes (A → B → A): the nearest scope wins.
- A brand or mode attribute with a nonexistent value: the scope keeps the values of the nearest
  ancestor, with no variable without a value.
- A page with no brand or mode attribute that imports the default brand's CSS: the default
  combination applies, with no variable without a value; an app that imports only another brand selects it by
  an attribute on the document root (FR-013).
- A page that imports two brands' CSS: the default brand, if it is one of them, applies in scopes without a
  brand attribute, and the other takes effect only in scopes that select it.
- A token CSS file edited by hand in the repository: validation fails, because that file is
  generated.
- A color with opacity in a contrast pair: it is composited over the background before measuring.
- Removal or renaming of a published token: it is an incompatible public-API change and follows SemVer
  (Principle X).
- A design-tool plan with a mode limit lower than the number of brands × modes: the limit
  and the adopted solution are recorded (DSN-05).
- A sync interrupted midway: the next run converges to the source state, without
  leaving partial divergent variables unrecorded.
- A manual edit in the tool between two syncs: the divergence is detected by the scheduled
  check and undone on the next sync.

## Requirements *(mandatory)*

### Functional Requirements

**Single source and structure**

- **FR-001**: The system MUST define all tokens in a single source in the W3C Design Tokens
  (DTCG) format; no token MAY be defined outside it, and an automated repository scan MUST
  confirm this (TOK-01).
- **FR-002**: The system MUST validate the source against the DTCG schema on every proposed change; a schema
  error MUST block the merge (TOK-01).
- **FR-003**: The system MUST organize tokens into three layers: primitives, semantics, and
  components. Only primitive tokens MAY have a literal value; semantics and components MUST
  reference other tokens by alias, and validation MUST reject a literal outside the primitive
  layer (TOK-02).
- **FR-004**: Every alias MUST resolve to an existing token, without a cycle (TOK-01, TOK-02). No
  layer MAY reference a layer above it (primitive → primitive; semantic → primitive or
  semantic; component → semantic, component, or primitive). Rationale, with no ID of its own:
  a reference from a lower layer to an upper layer inverts the three layers of TOK-02 and would make the
  value of a primitive depend on brand or mode.
- **FR-005**: The system MUST adopt a documented naming convention, with the `<prefixo>` prefix
  and segments in a fixed order (e.g., category-property-state); validation MUST reject a name
  off the standard, and 100% of published tokens MUST pass (TOK-04).
- **FR-006**: The system MUST cover the color, typography, space, dimension, radius, border,
  shadow, motion, z-index, breakpoints, and opacity categories, with at least one semantic token published in
  each (TOK-10).
- **FR-007**: The system MUST define a single height scale for interactive controls, used
  by all controls (TOK-13).
- **FR-008**: The system MUST emit, on each build, a report with the token count by category
  and the control-height scale of each theme (TOK-10, TOK-13).

**Brands, modes, and scopes**

- **FR-009**: The system MUST support multiple brands and publish each brand's tokens from the
  "Brands and themes of version 1.0" decision (current premise: all brands of the current consumer
  apps), each in light and dark modes; adding a brand MUST change only token files (the
  token source and the token API report regenerated by the build), never component
  or tool code, proven by the diff (TOK-07).
- **FR-010**: The system MUST offer light and dark modes as an axis independent of the brand,
  combinable with any brand; brand and mode MUST be selected by distinct data
  attributes, both prefixed (`data-<prefixo>-*`), and the build MUST generate valid output for all
  combinations (TOK-08, CMP-05).
- **FR-011**: Every brand and mode combination MUST have exactly the same set of
  semantic keys; a check MUST compare all combinations, and a missing or excess key MUST
  block the merge (TOK-09).
- **FR-012**: The brand and mode attributes MUST apply on any element, each scope MUST
  redeclare the semantic tokens, and in nested scopes the values of the nearest
  scope MUST apply for each axis (TOK-14, at the CSS level).
- **FR-013**: With no mode attribute on the element or on an ancestor, the default mode MUST
  apply; with no brand attribute on the element or on an ancestor, the default brand indicated by the
  requester MUST apply (CMP-24). Brand token values applied without a brand attribute MUST come only
  from the default brand's CSS; an app that imports only another brand's CSS selects that brand by an attribute
  on the document root, because each brand's file contains only its own selectors (ENG-06). Under those
  conditions, no variable MAY be left without a value, in the sense of the operational definition in the
  Clarifications section.
- **FR-014**: A nonexistent brand or mode attribute value MUST NOT leave a variable without a value; the
  scope keeps the values of the nearest ancestor. Rationale, with no ID of its own: it extends to
  invalid attribute values the ENG-06 requirement that the app have no CSS variables without a value.

**Generated outputs**

- **FR-015**: The system MUST generate, from the single source, CSS custom properties with the
  `--<prefixo>-` prefix; the repository MUST NOT version a hand-edited token CSS file, and two
  builds of the same source MUST produce byte-for-byte identical output (TOK-05).
- **FR-016**: The system MUST generate ESM JavaScript modules with TypeScript type declarations for
  all tokens: the modules export `var(--<prefixo>-*)` references and, in a separate entry,
  value maps by brand and mode. The published package MUST contain the ESM modules and the
  .d.ts files of both entries, and referencing a nonexistent token name MUST produce a type error,
  proven by a type test (TOK-06).
- **FR-017**: The system MUST distribute each brand's CSS, with light and dark modes, in its
  own file containing only that brand's selectors, including, in the default brand's file, those that
  apply the default combination (FR-013), per an automated check; what is brand-neutral (layer
  order, shared primitives, default mode, token resolver) MUST stay in a common base
  file, with no value exclusive to any brand. An example app that imports the base file
  and only brand A MUST NOT contain brand B-exclusive variables or variables without a value
  (ENG-06).
- **FR-018**: An example app, which MUST consume the packaged token package and never the
  source code (Principle VII, QA-06), MUST toggle between two brands and between the two modes at
  runtime and demonstrate nested scopes, without changing component code (TOK-07, TOK-14). The
  FR-017 example app follows the same rule.

**Contrast**

- **FR-019**: The system MUST maintain a versioned manifest of the foreground, background, and
  state color pairs, classified as text or non-text (A11Y-09).
- **FR-020**: A check MUST measure each manifest pair across all brand and mode combinations,
  compositing opacity before computing the ratio; under the current premise (WCAG 2.2 AA), text
  requires 4.5:1 and non-text, including the focus indicator, 3:1; a failing pair MUST fail the
  build (A11Y-09). Inactive or disabled state pairs, exempt under WCAG 2.2 AA, MUST appear in the
  manifest and be measured and reported, without failing the build; a focus indicator that falls partly inside and
  partly outside the component passes when at least one of the sides reaches 3:1 (A11Y-01, A11Y-09).
- **FR-021**: The system MUST provide a check that fails when a style uses a foreground and background color
  pair missing from the manifest, delivered with valid and invalid examples that trigger 100% of the
  expected errors and zero false positives; the check MUST be applied to the style core as soon
  as it exists (A11Y-09).

**Style lint**

- **FR-022**: The system MUST provide a style lint rule that blocks the merge when it detects a
  primitive token or literal value in a component style (TOK-03).
- **FR-023**: The same rule MUST reject an interactive control height outside the single
  scale (TOK-13).
- **FR-024**: The rule MUST be delivered with valid and invalid examples that trigger 100% of the
  expected errors and zero false positives, and MUST be applied to the style core as soon as it
  exists, with a zero-violations report in CI (TOK-03).

**Sync with the design tool**

- **FR-025**: A versioned pipeline MUST automatically sync the tokens with the
  design tool's variables on each published version and record a log of the changed variables; under the
  current premise (the repository is the source, the tool receives the variables), no routine MAY
  import variables from the tool into the repository (DSN-01).
- **FR-026**: The owners file MUST indicate the sync owner role, and every sync
  failure MUST produce an alert assigned to that role (DSN-02).
- **FR-027**: A manual edit at the destination MUST be restored by the next sync to the source
  value and recorded in the log, proven by a test with a deliberate manual change (DSN-03).
- **FR-028**: Each variable in the tool MUST have a name and hierarchy identical to the corresponding
  token; the divergence report MUST point to zero name or hierarchy differences
  (DSN-04).
- **FR-029**: Brand and mode MUST be independently swappable axes in the tool: switching only
  the brand or only the mode of a frame changes the values without relinking layers; the tool plan's mode
  limits and the adopted solution MUST be recorded (DSN-05).
- **FR-030**: A scheduled check, at least weekly and on each published version, MUST compare
  build tokens and tool variables; each divergence MUST produce a trackable item with an
  assignee and due date (DSN-11, token part).

**Traceability and conditional items**

- **FR-031**: Each ID met by this feature MUST have a CI check or retained evidence linked in the
  traceability matrix (ACE-02).
- **FR-032**: If TOK-12 (Desirable) is contracted, CI MUST publish on each build a report of
  tokens with no reference in components or in other tokens, and each item MUST have a decision recorded
  before release: keep, deprecate, or remove (TOK-12). The contracting of TOK-12 is pending with
  the requester; until the answer, this FR does not enter the plan or the tasks.
- **FR-033**: A semantic token that varies by brand and by mode MUST be expressed as a mode-axis
  token whose value in each mode is an alias to a brand-axis token, with the same keys across every
  brand; validation MUST reject variation on both axes that does not follow this form (TOK-09, DSN-04,
  DSN-05). Rationale: it is the form that allows brand and mode as independent axes in the CSS
  (FR-012) and in the design tool without variables that do not correspond to tokens (FR-028, FR-029).

### Requirements Traceability

| ID | Met by | Note |
| --- | --- | --- |
| TOK-01 | FR-001, FR-002 | |
| TOK-02 | FR-003, FR-004 | |
| TOK-03 | FR-022, FR-024 | Zero violations in the core once it exists (components feature) |
| TOK-04 | FR-005 | Publishing the convention on the site depends on the docs feature |
| TOK-05 | FR-015 | |
| TOK-06 | FR-016 | |
| TOK-07 | FR-009, FR-018 | |
| TOK-08 | FR-010 | |
| TOK-09 | FR-011, FR-033 | |
| TOK-10 | FR-006, FR-008 | |
| TOK-12 | FR-032 | Desirable; only if contracted |
| TOK-13 | FR-007, FR-008, FR-023 | |
| TOK-14 | FR-012, FR-018 | Partial: React/Vue and SSR tests in the components feature |
| ENG-06 | FR-013, FR-014, FR-017 | |
| CMP-05 | FR-010 | Partial: theme attributes only; the rest in the components feature |
| A11Y-09 | FR-019, FR-020, FR-021 | Applying FR-021 to the core in the components feature |
| DSN-01 | FR-025 | The "published version" trigger depends on the publishing pipeline |
| DSN-02 | FR-026 | |
| DSN-03 | FR-027 | |
| DSN-04 | FR-028, FR-033 | |
| DSN-05 | FR-029, FR-033 | |
| DSN-11 | FR-030 | Partial: icons, components, variants, properties, and stage in their respective features |

### Key Entities *(include if feature involves data)*

- **Token**: a unit of visual decision; it has a name, layer, category, literal value (primitive
  only) or alias, and description.
- **Layer**: primitive, semantic, or component; defines what a token can reference.
- **Category**: one of the eleven categories of TOK-10.
- **Brand**: visual identity; provides values for the semantic tokens.
- **Mode**: light or dark; an axis independent of the brand.
- **Theme combination**: a brand × mode pair; all have the same set of semantic keys.
- **Theme scope**: an element that selects brand, mode, or both for its subtree.
- **Control-height scale**: a closed set of heights allowed for interactive
  controls.
- **Contrast pair**: foreground, background, state, and type (text or non-text), with a minimum ratio.
- **Generated artifact**: CSS per brand, typed reference module, value map by brand and
  mode, build report.
- **Design-tool variable**: a mirror of a token in the tool, with the same name and
  hierarchy.
- **Sync record**: a log of each run, with the changed variables and the restored manual
  edits.
- **Divergence**: a difference detected between tool and repository, with type, assignee, and
  due date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of published tokens pass the schema, layer, and
  naming validation, and zero tokens are found outside the single source.
- **SC-002**: Two builds of the same source produce identical outputs in 100% of
  runs.
- **SC-003**: Each of the eleven categories has at least one published semantic token.
- **SC-004**: All brand and mode combinations have the same set of semantic keys (zero
  missing or excess keys).
- **SC-005**: A new brand is added with zero files changed beyond the token source and the
  regenerated token API report.
- **SC-006**: An application that imports the base file and only one brand, selected per
  FR-013, loads zero variables exclusive to other brands and zero variables without a value (operational
  definition in the Clarifications section).
- **SC-007**: In nested scopes, 100% of the read values correspond to the nearest scope of
  each axis.
- **SC-008**: 100% of the manifest pairs reach the minimum ratio across all brand and mode
  combinations.
- **SC-009**: Each type of violation covered by this feature (literal outside the primitive layer,
  name off the standard, missing key, failing pair, primitive or literal in a style, height outside the
  scale, nonexistent token name) is blocked in 100% of the deliberately triggered cases.
- **SC-010**: After each sync, the divergence report points to zero name or
  hierarchy differences, and 100% of the manual edits at the destination are restored and recorded.
- **SC-011**: The divergence check runs at least once a week and on each published
  version, and 100% of the divergences have an assignee and due date.

## Assumptions

- Version 1.0 brands: the current premise applies, all brands of the current consumer apps, with
  light and dark. The values come from each brand's design lead before Phase 1; until then,
  tests and examples use two synthetic brands (A and B), with no real data (QA-15).
- Accessibility level: the current premise applies, WCAG 2.2 AA (A11Y-01).
- Sync direction: the current premise applies, the repository is the source and the tool receives
  the variables (DSN-01).
- Default combination: the brand indicated by the requester (CMP-24) and light default mode, until decided
  otherwise.
- Prefix: `<prefixo>` is an intentional marker of the project prefix, per the constitution's TODO(PREFIXO)
  v1.0.0; the value will be defined by the requester and incorporated by a constitution
  amendment, without changing this feature's requirements.
- Design tool: the choice is an open decision of the requester, with a deadline before the start of
  Phase 1 (Premises); this feature's requirements apply to any chosen tool, and its
  limits, such as the plan's number of modes, are recorded per FR-029. The choice is a plan
  input.
- "Published version" is the version promoted to the registry's main tag (ENG-26). While the publishing
  pipeline does not exist, the sync MAY be triggered manually by the sync
  owner, with the same log.
- Target browsers follow the versioned list of the minimum-versions premise (ENG-08).
- Removing or renaming a published token is an incompatible public-API change and requires a major
  version (GOV-01).

**Dependencies**

- CI and publishing feature: pre-release and promotion (ENG-26), public-API check
  (GOV-01), and the owners file (GOV-09) for this feature's trigger and gates.
- Core and components feature: applying the lint to the core (FR-024), applying the pair
  check to the core (FR-021), the theme Provider and React/Vue nested-theme and SSR tests (TOK-14).
- Documentation feature: publishing the naming convention on the site (TOK-04) and token
  fundamentals (DOC-05).
- Requester: the brand list and values, default brand, design-tool choice, access to
  the tool account, prefix value, and the answer about contracting TOK-12 (FR-032).

**Out of scope**

- Components, the theme Provider, and its React/Vue nested-theme and SSR tests.
- Fundamentals documentation on the site (DOC-05).
- Legacy token mapping (MIG-03) and themes that reproduce legacy brands (MIG-08).
- Sync of icons, components, variants, properties, and stage with the design
  tool (the other parts of DSN-11 and DSN-06 to DSN-09).
