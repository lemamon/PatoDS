# Contract: contrast manifest and pair check

**Feature**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) (D5, D6) |
**Model**: [data-model.md](../data-model.md) | **CLI**: [tools-cli.md](tools-cli.md) |
**Lint**: [lint-rules.md](lint-rules.md) |
**ADR**: [ADR-15](../../../docs/adr/ADR-15-cor-e-contraste.md) (Proposed) | **Date**: 2026-10-21

This contract defines the format of the versioned manifest of contrast pairs and of the surface-sets
file, the validation rules V-14 to V-16, the algorithm of the check run by the private package
`@<prefixo>/tokens-contrast` (`tools/tokens-contrast`, command `tokens-contrast check`), the report
format and the real-browser verification. It covers FR-019 and FR-020, the data part of FR-021, User
Story 4, SC-008 and, in part, SC-009. The lint rule that checks whether every pair used in a style
appears in the manifest (FR-021) is in [lint-rules.md](lint-rules.md). The snippets are formats and
signatures; no implementation is defined here. `<prefixo>` is the constitution's marker (TODO(PREFIXO)).

## 1. Assumptions and guarantees

**Assumptions made** (none is decided here):

| Open decision | Assumption used | Effect in this contract |
| --- | --- | --- |
| Target conformance level (A11Y-01) | WCAG 2.2 AA | Text requires 4.5:1; non-text, including the focus indicator, 3:1. The exemption for an inactive component and the "one side is enough" rule for focus that crosses the border come from that level (spec Clarifications). |
| Version 1.0 brands and default brand | All brands of the current apps; until the values are delivered, synthetic brands A and B (QA-15) | The manifest does not list brands: the permutations come from the resolver (`src/tokens.resolver.json`). The default brand does not change the check, which measures every permutation. |
| Wide-gamut color palettes | Deterministic mapping to sRGB (open question to the requester in research.md) | The measured value is the sRGB emitted by `toEmittedSrgb()` (section 8). |
| Browser list (ENG-08) | Versioned list still pending | The real-browser verification runs in Chromium on every PR and in every engine of the list nightly and before publishing (QA-12). |
| CI platform | GitHub Actions (inferred from ENG-18, pending confirmation) | The report is published as a job artifact and retained as evidence (ACE-02). |

**Guarantees**:

- G-1 (FR-020): every pair in the manifest is measured in every brand × mode permutation, with the
  same permutation list the CSS generator uses. An undefined or empty list is an error.
- G-2 (TOK-05, Principle I): the measured value is the emitted value. The CSS generator and the checker
  call the same `toEmittedSrgb()` function from `@<prefixo>/color`, and the checker checks its output
  against the string emitted by the build (code `emitted-mismatch`).
- G-3 (SC-002): for the same inputs, the report is byte-for-byte identical, with no date, time,
  absolute path or locale-dependent formatting.
- G-4 (QA-14): the minimums come from the thresholds file, never from the code; the checker rejects
  values that do not match the declared level.

## 2. Files

| Path | Role | Versioned | Owner (GOV-09) |
| --- | --- | --- | --- |
| `packages/tokens/contrast/manifest.json` | Contrast pairs (FR-019) | Yes | Accessibility owner |
| `packages/tokens/contrast/surfaces.json` | Named sets of opaque surfaces | Yes | Accessibility owner |
| `packages/tokens/contrast/manifest.schema.json` | JSON Schema 2020-12 of the manifest and single source of the state vocabulary | Yes | Accessibility owner |
| `packages/tokens/contrast/surfaces.schema.json` | JSON Schema 2020-12 of the sets | Yes | Accessibility owner |
| `quality/thresholds.json`, section `contrast` | Level and minimums (QA-14) | Yes | Person designated by the requester |
| `packages/tokens/dist/meta/tokens.manifest.json` | Build-generated input (section 13) | No (generated) | — |
| `<out>/contrast-report.json` and `<out>/contrast-report.md` | Report (section 10) | No (CI artifact) | — |

The two schema file names are proposed by this contract. The `contrast/` directory is not part of the
tarball: it is outside `exports` and outside the allowlist of published files (ENG-17). By layer,
`@<prefixo>/tokens-contrast` depends on `@<prefixo>/tokens` only as a devDependency and only reads
`./meta/*` and the files in `contrast/` by path; `@<prefixo>/color` is a leaf, with no workspace
dependency (ENG-01).

## 3. Manifest format (`manifest.json`)

Example (token names are illustrative; the grammar per category is in
`docs/tokens/convencao-de-nomes.md` and in [token-source.md](token-source.md)):

```json
{
  "$schema": "./manifest.schema.json",
  "schemaVersion": 1,
  "pairs": [
    {
      "id": "button.default.label",
      "fg": "color.button.fg.default",
      "bg": ["color.button.bg.default"],
      "state": "default",
      "kind": "text"
    },
    {
      "id": "button.disabled.label",
      "fg": "color.button.fg.disabled",
      "bg": ["color.button.bg.disabled"],
      "state": "disabled",
      "kind": "text",
      "exempt": "wcag-inactive"
    },
    {
      "id": "focus.ring.inner",
      "fg": "color.border.focus",
      "bg": ["color.button.bg.default"],
      "state": "focus-visible",
      "kind": "non-text",
      "group": "focus-ring-button"
    },
    {
      "id": "focus.ring.outer",
      "fg": "color.border.focus",
      "bg": "@surfaces",
      "state": "focus-visible",
      "kind": "non-text",
      "group": "focus-ring-button"
    },
    {
      "id": "overlay.scrim.text",
      "fg": "color.fg.inverse",
      "bg": ["@surfaces", "color.bg.scrim"],
      "state": "default",
      "kind": "text",
      "description": "Text over a translucent scrim opened over any surface"
    }
  ]
}
```

Fields of each pair:

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `id` | Yes | string | Lowercase ASCII, kebab segments joined by `.`; unique; the file is ordered by `id` in code-point order. |
| `fg` | Yes | token path | `semantic` token with role `public`, or a `component` token, of `$type` `color`. Never a primitive, never `brand-mode-source` (group `brand.`), never a literal. |
| `bg` | Yes | stack or `@set` | Stack from bottom to top. List form: the first item is a token path or a `@set`; the rest are token paths. Short form: the string `"@set"`, equivalent to `["@set"]`. The base must be opaque in every permutation or be a surface set (V-16). |
| `state` | Yes | enum | State vocabulary of section 5. |
| `kind` | Yes | `text` \| `non-text` | Defines the minimum: `thresholds.text` or `thresholds.nonText`. |
| `group` | No | kebab string | `any-of` group: passes when at least one member meets the minimum (section 8, step 9). Only for a focus indicator that crosses the component border. |
| `exempt` | No | `"wcag-inactive"` | Only with `state` `disabled` or `inactive`. The pair is measured and reported, but does not fail. |
| `description` | No | string up to 200 characters | Free text for review; no effect on the check. |

There is no "large text" form with minimum 3:1: under the assumption, FR-020 fixes 4.5:1 for all
text. Opacity applied via the CSS `opacity` property is also not modeled in this contract; the
translucency comes from the alpha channel of the color token itself (scenario 3 of User Story 4). The
effect of `opacity` on elements is covered by the real-browser rules engine (A11Y-02).

Schema sketch (`manifest.schema.json`, JSON Schema 2020-12):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PatoDS: contrast pairs manifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["$schema", "schemaVersion", "pairs"],
  "properties": {
    "$schema": { "type": "string" },
    "schemaVersion": { "const": 1 },
    "pairs": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/pair" } }
  },
  "$defs": {
    "segment": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
    "tokenPath": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+(-[a-z0-9]+)*)+$" },
    "setRef": { "type": "string", "pattern": "^@[a-z][a-z0-9]*(-[a-z0-9]+)*$" },
    "state": {
      "enum": ["default", "hover", "active", "focus-visible", "selected", "invalid", "disabled", "inactive"]
    },
    "bg": {
      "oneOf": [
        { "$ref": "#/$defs/setRef" },
        {
          "type": "array",
          "minItems": 1,
          "prefixItems": [{ "anyOf": [{ "$ref": "#/$defs/tokenPath" }, { "$ref": "#/$defs/setRef" }] }],
          "items": { "$ref": "#/$defs/tokenPath" }
        }
      ]
    },
    "pair": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "fg", "bg", "state", "kind"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+(-[a-z0-9]+)*)*$" },
        "fg": { "$ref": "#/$defs/tokenPath" },
        "bg": { "$ref": "#/$defs/bg" },
        "state": { "$ref": "#/$defs/state" },
        "kind": { "enum": ["text", "non-text"] },
        "group": { "$ref": "#/$defs/segment" },
        "exempt": { "const": "wcag-inactive" },
        "description": { "type": "string", "maxLength": 200 }
      },
      "allOf": [
        {
          "if": { "required": ["exempt"] },
          "then": { "properties": { "state": { "enum": ["disabled", "inactive"] } }, "not": { "required": ["group"] } }
        },
        {
          "if": { "required": ["group"] },
          "then": { "properties": { "state": { "const": "focus-visible" }, "kind": { "const": "non-text" } } }
        }
      ]
    }
  }
}
```

The schema covers the shape. Ordering, uniqueness, layers, token existence and opacity are semantic
rules of the checker (section 6), because they depend on the token manifest and the permutations.

## 4. Surface sets (`surfaces.json`)

A named set lists, per mode, the opaque surface tokens over which a translucent token or an element
can sit. The checker expands one measured case per surface of the permutation's mode, and all cases
must pass (worst case by enumeration).

```json
{
  "$schema": "./surfaces.schema.json",
  "schemaVersion": 1,
  "sets": {
    "@raised": {
      "dark": ["color.bg.raised"],
      "light": ["color.bg.raised"]
    },
    "@surfaces": {
      "dark": ["color.bg.raised", "color.bg.surface"],
      "light": ["color.bg.raised", "color.bg.sunken", "color.bg.surface"]
    }
  }
}
```

Rules:

- Set name: `@` followed by a kebab segment; keys of `sets` in code-point order.
- The keys of each set are exactly the mode ids of the resolver (`dark`, `light`), no more and no
  less.
- Each list is non-empty (V-16), ordered by code point and without repetition.
- Each item is a public `semantic` or `component` token, of `$type` `color`, opaque (alpha 1 in the
  emitted value) in every permutation of the corresponding mode (V-16).

Schema sketch (`surfaces.schema.json`):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["$schema", "schemaVersion", "sets"],
  "properties": {
    "$schema": { "type": "string" },
    "schemaVersion": { "const": 1 },
    "sets": {
      "type": "object",
      "propertyNames": { "pattern": "^@[a-z][a-z0-9]*(-[a-z0-9]+)*$" },
      "additionalProperties": {
        "type": "object",
        "minProperties": 1,
        "additionalProperties": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+(-[a-z0-9]+)*)+$" }
        }
      }
    }
  }
}
```

## 5. State vocabulary

The vocabulary is versioned and has a single source: `$defs.state.enum` of `manifest.schema.json`.
The `<prefixo>/contrast-pairs` rule reads the same list; every target of its selector-to-state map
must belong to it ([lint-rules.md](lint-rules.md), section 4.3).

| State | Meaning | Can have `exempt` |
| --- | --- | --- |
| `default` | At rest, no interaction | No |
| `hover` | Pointer over the element | No |
| `active` | Activation in progress (pressed) | No |
| `focus-visible` | Visible focus, including the focus indicator | No |
| `selected` | Selected, checked, toggle-pressed or current | No |
| `invalid` | Invalid value | No |
| `disabled` | Disabled | Yes |
| `inactive` | Inactive for a reason other than disabled that WCAG treats as an inactive component | Yes |

Adding a state is a `minor` change of the schema (`schemaVersion` unchanged, enum widened) and requires
a simultaneous update of the lint rule's state map. Removing or renaming a state requires a new
`schemaVersion`.

## 6. Validation rules

Structure rules, checked before measurement (prefix CM, for "contrast manifest"). The codes are those
of the findings table in [tools-cli.md](tools-cli.md) (section 3.1), which includes
`unknown-surface-set`, `duplicate-pair`, `invalid-group` and `emitted-mismatch`.

| Rule | Description | Code |
| --- | --- | --- |
| CM-01 | `manifest.json` and `surfaces.json` validate against the schemas; `schemaVersion` supported (today, 1). | `manifest-schema` |
| CM-02 | `pairs` ordered by `id` in code-point order; `id` unique. | `unsorted-manifest`, `duplicate-id` |
| CM-03 | `fg`, items of `bg` and items of sets reference a public `semantic` token or a `component` token of `$type` `color`. A primitive, `brand-mode-source`, private variable, literal or other type is an error. | `forbidden-reference` |
| CM-04 | `@set` only appears in the first position of `bg` and exists in `surfaces.json`. | `unknown-surface-set` |
| CM-05 | No pair repeats the canonical tuple (`fg`, `bg` normalized to a list, `state`, `kind`) of another pair. Tuple uniqueness lets the lint rule match pairs without ambiguity. | `duplicate-pair` |
| CM-06 | A group has at least two members, all with `state` `focus-visible`, `kind` `non-text`, the same `fg` and distinct `bg`; no member has `exempt`. | `invalid-group` |
| CM-07 | `exempt` only with `state` `disabled` or `inactive` (also enforced by the schema). | `exempt-invalid-state` |
| CM-08 | `state` belongs to the vocabulary (section 5). Reported with this code, rather than as `manifest-schema`, to point to the vocabulary. | `unknown-state` |

Rules V-14 to V-16 of the [data model](../data-model.md), in operational form:

- **V-14** Every reference of the pair (`fg`, each item of `bg`, each surface of the sets used) exists
  and resolves to a color value in every permutation. It complements key parity (V-13): a token
  missing in one permutation is an error that points to the pair, brand and mode. Code
  `unknown-token`.
- **V-15** A pair without `exempt` and outside a group whose ratio falls below the minimum of its
  `kind` in any permutation fails the build (FR-020, SC-008). A group in which no member meets the
  minimum in some permutation fails the build. A pair with `exempt` never fails, even below the
  minimum. Codes `pair-below-minimum` and `group-below-minimum`.
- **V-16** The base of the stack must have alpha 1 in every permutation, checked in the emitted value;
  a surface set must have at least one surface in the permutation's mode, and each surface must be
  opaque. The checker never assumes a white background, because the WCAG default ("assumed white") is
  unsafe with dark mode. Codes `stack-not-opaque` (translucent base or surface) and
  `empty-surface-set`.

Build consistency error: `emitted-mismatch`, when the string that `toEmittedSrgb()` produces for a
token in a permutation differs from the emitted string the build recorded in the token manifest. It
indicates a divergence between generator and checker and blocks as a violation.

Every finding in this section has `severity` `error` and makes the command exit with code 1. The
format follows [tools-cli.md](tools-cli.md) (section 1.5): `token` with the token path, `context` with
`{ brand, mode }` when the finding depends on the permutation, and `data` with `{ pair, ratio, minimum,
surface }` when there is a measurement. Findings coming from a JSON file carry the file, line and
column of the offending node.

## 7. Thresholds

The checker reads only the `contrast` section of `quality/thresholds.json` (QA-14):

```json
{
  "contrast": { "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }
}
```

The checker holds an internal table of the normative values per level. Today it has only `WCAG22-AA`
(text 4.5; non-text 3), which is the current assumption of A11Y-01. An unknown level, or a value that
differs from the table for the declared level, is a configuration error (exit code 2, error
`THRESHOLDS_MISMATCH`): the minimums cannot be silently lowered. Switching level requires an approved
change of the thresholds file (QA-14) and of the checker's table, recorded in ADR-15.

## 8. Check algorithm

Inputs: validated manifest and sets (section 6, CM-01 to CM-08), generated token manifest, thresholds.
All iterations follow code-point order, and all functions are pure.

1. **Permutations.** Read the permutation list from the token manifest (the same as the CSS
   generator, coming from the resolver's `listPermutations()`). A missing or empty list is a
   configuration error (code 2, error `CONFIG`).
2. **Cases.** For each pair (by `id`) and each permutation (by brand, then mode), normalize `bg` to a
   list. If the base is a `@set`, expand one case per surface of the set in the permutation's mode
   (V-16 when empty), in token-path order, with the surface in the base's place; otherwise there is a
   single case.
3. **Resolution.** Resolve each reference to the permutation's DTCG color value (V-14).
4. **Emitted value.** Pass each value through `toEmittedSrgb()` from `@<prefixo>/color`: DTCG
   components as the source of truth, CSS Color 4 gamut mapping (method `css`, deltaEOK, JND 0.02,
   always passed explicitly) and 8-bit quantization (ADR-15). The string follows the single form of
   [css-output.md](css-output.md): `#rrggbb` for opaque color and `rgb(r g b / a)`, with `a` to three
   decimal places, for color with alpha less than 1. Check the string against the one emitted by the
   build (`emitted-mismatch`). Read back from the string the integer channels `r, g, b` in 0..255 and
   the alpha `a`; the checker composes with that alpha read back, so that the measured value is the
   emitted value.
5. **Opaque base.** Require `a = 1` in the base of the stack and in each expanded surface (V-16).
6. **Composition.** Compose in gamma-encoded sRGB (CSS Compositing, source-over over an opaque
   background), per channel, from bottom to top:
   `B₀ = base`; `Bᵢ = aᵢ · Lᵢ + (1 − aᵢ) · Bᵢ₋₁` for each layer `Lᵢ` above the base; and the
   foreground `F = a_fg · fg + (1 − a_fg) · Bₙ`. Composition in linear light is not used, because it
   diverges from what the browser shows and from what axe measures.
7. **Two variants.** Compute the composition in two variants:
   - *floating point*: no rounding between folds;
   - *8-bit per fold*: round each channel to an integer (half up, like `Math.round`) after **each**
     fold, both of the background layers and of the foreground over the background, like axe-core's
     `flattenColors`.
8. **WCAG 2.2 ratio.** For each variant: `c = v / 255`; linearize with
   `c ≤ 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055)^2.4`; `L = 0.2126 R + 0.7152 G + 0.0722 B`;
   ratio `(L_higher + 0.05) / (L_lower + 0.05)`, with no rounding. The case's ratio is the smaller of
   the two variants.

   > **Why `0.04045`, not `0.03928` — do not "fix" this.** `0.04045` is the IEC 61966-2-1 (sRGB)
   > piecewise threshold. The WCAG 2.x spec *text* prints `0.03928`, which the WCAG Working Group's own
   > errata records as incorrect: "the correct threshold for the piecewise equation is 0.04045 and not
   > the 0.03928 … Nevertheless for 8 bit color values the difference is not significant." This checker
   > deliberately uses the IEC-correct `0.04045`; it is *more* correct than the literal WCAG 2.x text, so
   > a reviewer MUST NOT revert it to `0.03928`. The `min(float, 8-bit)` of step 7 further guarantees the
   > checker never over-reports versus an axe build that still uses `0.03928`. Derivation, the errata
   > source, and the WCAG2-vs-APCA debate: `docs/research/foundations.md` §2.1 and §7.
9. **Per-case decision.** Minimum `m = thresholds.text` for `kind` `text` and `thresholds.nonText` for
   `non-text`. The case passes when `ratio ≥ m`, without rounding (4.499 fails 4.5). Case result:
   `exempt` when the pair has `exempt` (measured and reported, never fails); otherwise `pass` or
   `fail`.
10. **Per-pair and per-group decision.** A pair passes in a permutation when all of its cases pass
    (worst case among surfaces). A pair outside a group and without `exempt` that does not pass in a
    permutation generates `pair-below-minimum` with the `context` of that permutation. A group passes
    in a permutation when at least one member passes in it (`any-of`, Understanding 1.4.11); otherwise
    it generates `group-below-minimum` with `context`. A failed member of a passing group keeps
    `result` `fail` in the case, without generating a finding. The group's `result` in the report is
    `pass` only when the group passes in every permutation.
11. **Informative flag.** A passing case with `ratio − m < 0.05` receives the `near-threshold` mark in
    `flags`. It does not fail the check; it signals a risk of divergence with axe (section 11) and with
    the engine's alpha quantization.
12. **Exit.** Code 0 with no findings; 1 with any finding from sections 6 and 8; 2 for invalid use or
    configuration; 3 for an internal error. `fail` cases of members of a passing group and `exempt`
    cases do not change the code.

Reference example (unit test vector): opaque white text over a black scrim with alpha 0.5, opened over
a white surface. In the floating-point variant the composed background is 127.5 per channel and the
ratio is about 3.976 (shown 3.97); in the 8-bit variant the background rounds to 128 and the ratio is
about 3.949 (shown 3.94). It is 3.94: failed for text. Over a black surface, the same scrim gives a
ratio of 21. That is why a translucent scrim over an unknown background cannot be approved in general,
and the manifest requires an opaque base or a surface set.

Other required vectors (QA-02): `#767676` over `#ffffff` = 4.54 (passes for text); `#777777` over
`#ffffff` = 4.47 (fails); black over white = 21.00; and agreement with colorjs.io within 1e-4 for
opaque in-gamut colors.

## 9. CLI `tokens-contrast check`

The command-line interface is that of [tools-cli.md](tools-cli.md) (section 3.1), with the common
conventions of that contract: `--json` with a single canonical JSON document on stdout; human output
otherwise, one line per finding in the format `file:line:column  error  code  message` and a summary
line; `--root` for the repository root.

```text
tokens-contrast check [--manifest <file>] [--surfaces <file>] [--tokens <file>]
                      [--thresholds <file>] [--out <dir>] [--json]
```

| Option | Default (relative to the repository root) |
| --- | --- |
| `--manifest` | `packages/tokens/contrast/manifest.json` |
| `--surfaces` | `packages/tokens/contrast/surfaces.json` |
| `--tokens` | `packages/tokens/dist/meta/tokens.manifest.json`; missing: code 2 with guidance to run `pnpm tokens:build` |
| `--thresholds` | `quality/thresholds.json`, section `contrast` |
| `--out` | No default; when present, writes `contrast-report.json` and `contrast-report.md` |

Exit codes: 0 with no findings; 1 findings (validation or contrast); 2 use or configuration
(`USAGE`, `CONFIG`, `THRESHOLDS_MISMATCH`); 3 internal error (`INTERNAL`). The root script
`pnpm contrast:check` runs the command via turbo, after `@<prefixo>/tokens#tokens:build`; the
`contrast` job passes `--out <dir>`, publishes the two files as an artifact and retains them as
evidence of A11Y-09 in the ACE-02 matrix.

## 10. Report

`contrast-report.json` (written to `--out`, with the same content printed by `--json`) and
`contrast-report.md` (readable table, written to `--out`) are ordered, use LF, have no date, time or
absolute path, and format numbers without depending on locale (dot as the decimal separator). The JSON
follows the canonical JSON rules of [tools-cli.md](tools-cli.md) (section 1.4).

**Ratios**: truncated, never rounded. In the table, two decimal places with trailing zeros (`4.49`,
`4.50`, `21.00`); in the JSON, numbers truncated to four decimal places, as in tools-cli.md. The
result always comes from the comparison without truncation, and a failed case never shows a value
greater than or equal to the minimum (4.4996 is shown `4.49` in the table and `4.4996` in the JSON).

JSON format: the common envelope of tools-cli.md (section 1.3) plus the command's keys:

```ts
type State = 'default' | 'hover' | 'active' | 'focus-visible'
  | 'selected' | 'invalid' | 'disabled' | 'inactive';

interface ContrastCheckResult {
  format: '<prefixo>.cli-result'; version: 1;
  tool: 'tokens-contrast'; command: 'check';
  ok: boolean; exitCode: 0 | 1 | 2 | 3;
  level: 'WCAG22-AA';
  minimums: { nonText: number; text: number };
  summary: {
    cases: number; pairs: number;
    passed: number; failed: number; exempt: number;   // passed + failed + exempt = cases
    groups: { passed: number; failed: number };
  };
  cases: ContrastCase[];      // ordered by pair, brand, mode, surface
  groups: ContrastGroup[];    // ordered by id
  findings: Finding[];        // format and order of tools-cli.md, section 1.5
  errors: CliError[];         // codes 2 and 3
}

interface ContrastCase {
  pair: string; brand: string; mode: string;
  surface: string | null;     // surface expanded from a @set
  state: State; kind: 'text' | 'non-text';
  fg: string;                 // foreground token path
  bg: string[];               // expanded stack, from bottom to top (the surface takes the base)
  ratio: number;              // smaller of the two variants, truncated to 4 places
  ratioFloat: number; ratio8bit: number;
  minimum: number;            // 4.5 or 3
  result: 'pass' | 'fail' | 'exempt';
  group: string | null;
  flags: Array<'near-threshold'>; // tools-cli.md, section 3.1
}

interface ContrastGroup {
  id: string;
  members: string[];          // pair ids, ordered
  result: 'pass' | 'fail';    // pass only when the group passes in every permutation
}
```

Table (`contrast-report.md`, sketch with illustrative values; one line per case, in the order of
`cases`):

```markdown
# Contrast report

Level: WCAG22-AA. Minimums: text 4.50; non-text 3.00.

| pair | brand | mode | surface | state | kind | min | ratio | result | group |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| button.default.label | a | dark | - | default | text | 4.50 | 7.12 | pass | - |
| button.disabled.label | a | dark | - | disabled | text | 4.50 | 2.10 | exempt | - |
| focus.ring.inner | a | dark | - | focus-visible | non-text | 3.00 | 2.41 | fail | focus-ring-button |
| focus.ring.outer | a | dark | color.bg.raised | focus-visible | non-text | 3.00 | 3.37 | pass | focus-ring-button |
| overlay.scrim.text | a | light | color.bg.surface | default | text | 4.50 | 3.94 | fail | - |

## Groups

| group | members | result |
| --- | --- | --- |
| focus-ring-button | focus.ring.inner, focus.ring.outer | pass |

## Findings

- `packages/tokens/contrast/manifest.json:41:7` `pair-below-minimum` overlay.scrim.text (a/light): 3.94 < 4.50

## Summary

cases=32 pairs=5 passed=25 failed=3 exempt=4 groups.passed=1 groups.failed=0 findings=2
```

## 11. Real-browser verification (samples)

The static check proves the math; the real-browser verification proves that generator, cascade and
checker agree (Principle VII, ADR-08, QA-06). It lives in the example app
`@<prefixo>/tokens-example`, which installs only the packaged tarball, and runs in `pnpm test:e2e`.

- **Page**: a dedicated page of the example app (proposed name `contrast.html`) imports
  `@<prefixo>/tokens/css/base.css` and all `brand-<id>.css` from the tarball, and styles the samples
  with the `var(--<prefixo>-*)` references exported by `@<prefixo>/tokens`. The FR-017 page, which
  imports only brand A, is a different one.
- **Case input**: the `cases` list from the `contrast-report.json` of the same commit, received by the
  job as a file (environment variable `CONTRAST_REPORT`). It is test data, not a package dependency:
  the app keeps no edge to `tools/*` (ENG-01). The `test:e2e` task now depends, in turbo's task graph,
  on the task that generates the report ([tools-cli.md](tools-cli.md), section 7).
- **Expected values**: come from the tarball's values map (`@<prefixo>/tokens/values`,
  `values[brand][mode][token]`), never hand-written. Since the checker has already proven that its
  conversion equals the emitted string (`emitted-mismatch`), equality with the computed value closes
  the chain measured = emitted = rendered.
- **Stack painted on real ancestors**: for each case, the outermost ancestor receives
  `data-<prefixo>-brand` and `data-<prefixo>-mode` of the permutation and paints the opaque base; each
  following background layer is a child element that paints its color; the foreground sample sits in
  the innermost element. That way axe never reaches the page's default white background, which it
  composes last. No ancestor of the sample has `opacity`, `filter`, `mix-blend-mode` or `transform`.

```html
<section data-<prefixo>-brand="a" data-<prefixo>-mode="light" data-case="overlay.scrim.text|a|light|color.bg.surface">
  <div class="layer" data-token="color.bg.surface">       <!-- opaque base -->
    <div class="layer" data-token="color.bg.scrim">       <!-- translucent layer -->
      <span class="sample-text" data-token="color.fg.inverse">Aa sample</span>
    </div>
  </div>
</section>
```

- **Text sample**: text of normal size (not "large text"), so that axe applies 4.5:1, the same minimum
  as the checker. **Non-text sample**: a block that paints the foreground color as its background.
- **Assertions** (in every case, including exempt and group ones):
  1. The computed color (`getComputedStyle`: `background-color` of the layers and `color` or
     `background-color` of the sample) equals the value from the `./values` map for that token and
     permutation: channels `r, g, b` exactly equal; alpha within a tolerance of half an 8-bit step
     (1/510), because engines may quantize the alpha.
  2. axe `color-contrast` runs over the text samples of pairs without `exempt` and records no violation
     and no incomplete result. Non-text and exempt samples are kept out of axe (axe only measures text,
     and an exempt pair may be below the minimum by design).
- **axe strict inequality**: axe passes only when `ratio > expected`, while WCAG and the checker pass
  with `≥`. A case exactly at the minimum passes in the checker and fails in axe. The divergence fails
  the real-browser test and is resolved by adjusting the tokens; the report's `near-threshold` mark
  points out these cases beforehand. axe also truncates the displayed ratio with
  `Math.floor(ratio × 100) / 100`, the same convention as the table in section 10.
- **Engines**: Chromium on every PR; every engine of the versioned list nightly and before publishing
  (QA-12), on the digest-pinned Playwright image, with no external network (QA-01).
- **License**: `axe-core` and `@axe-core/playwright` are MPL-2.0, development-only and unmodified; they
  enter the ENG-21 license policy as per D6.

## 12. Tests and evidence

| Test | Where | Proves |
| --- | --- | --- |
| Unit test of the composition, of the two variants and of the WCAG module (vectors of section 8) | `tools/color`, Vitest | FR-020, QA-02 |
| Unit test of ratio truncation and report ordering | `tools/tokens-contrast`, Vitest | SC-002 |
| Manifest fixtures with synthetic brands A and B: a known-failing pair; a translucent pair composed over the background; a stack without an opaque base; an empty set in some mode; a token missing in a permutation; an exempt pair below the minimum (reported, does not fail); a group with one passing side; a group with no passing side; inconsistent thresholds (code 2); `emitted-mismatch` | `tools/tokens-contrast/fixtures/`, Vitest | US4 scenarios 1 to 3, SC-009, V-14 to V-16 |
| `pnpm contrast:check` over the real manifest on every PR | CI | SC-008, A11Y-09 |
| Byte-for-byte of the report between floor and latest Node | Nightly CI (`check:determinism`) | SC-002, ENG-08 |
| Real-browser samples with axe | `apps/tokens-example/tests`, Playwright | Principle VII, QA-01 |

## 13. Requirements on other contracts

The checker and the lint rule depend on this information from the token manifest
(`dist/meta/tokens.manifest.json`), whose normative format is in
[build-manifests.md](build-manifests.md):

- list of brand × mode permutations, with brand and mode ids;
- per token: path, `cssName`, layer, category, `$type`, role (`public` or `brand-mode-source`), axis,
  alias chain and membership in the control-height scale;
- per color token and per permutation: the resolved DTCG value and the string emitted in the CSS;
- per composite border or shadow token: the references of the color subvalues, in layer order.

The emitted string recorded in the token manifest is the same as in the CSS and in the `./values` map,
in the single form of [css-output.md](css-output.md) (`#rrggbb` or `rgb(r g b / a)` with three places
in the alpha). The codes `unknown-surface-set`, `duplicate-pair`, `invalid-group` and
`emitted-mismatch`, the cases' `flags` field and the dependency of `test:e2e` on the contrast report
appear in [tools-cli.md](tools-cli.md) (sections 3.1 and 7).

## 14. Traceability

| ID | Covered by |
| --- | --- |
| FR-019 | Sections 3 to 6 (versioned manifest, states, text vs non-text classification) |
| FR-020 | Sections 7 and 8 (all permutations, composition before the ratio, exemption, `any-of` group) |
| FR-021 | Data shared with [lint-rules.md](lint-rules.md) (manifest, sets, vocabulary) |
| A11Y-09 | Sections 3 to 11; evidence: retained report |
| A11Y-01 | WCAG 2.2 AA assumption applied by the thresholds (section 7) |
| QA-14 | Minimums read from the thresholds file |
| SC-008, SC-009 | Sections 8 and 12 |
| ACE-02 | `pnpm contrast:check` and the report linked in the traceability matrix |
