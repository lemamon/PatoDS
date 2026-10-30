# Data Model: Design tokens and themes

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md) | **Date**: 2026-10-21

Spec entities (Key Entities) with fields, validation rules, relations, and transitions. File
formats and detailed grammar are in [contracts/](contracts/). `<prefixo>` is the constitution's
marker (TODO(PREFIXO)).

## Overview

```text
Resolver (packages/tokens/src/tokens.resolver.json)
 ├─ brand modifier ──► Brand (1..n, one default)
 ├─ mode modifier  ──► Mode (light, dark; default light)
 └─ sets ──► *.tokens.json files per layer ──► Token (1..n)

Permutation = Brand × Mode ──► resolved map Token → value
Build ──► Generated artifacts (base.css, brand-<id>.css, ESM refs/values, manifests, report)
Contrast manifest ──► Contrast pair (1..n) ──► Surface set (0..n)
sync-manifest.json ──► Tool variable ──► Sync run ──► Divergence
```

## Token

A unit of visual decision, defined only in the DTCG source (FR-001).

| Field | Type | Rule |
| --- | --- | --- |
| `path` | list of segments | DTCG path (`color.bg.surface`). Segments in ASCII lowercase kebab, with no internal `$`, `{`, `}`, or `.` (DTCG 2025.10, FR-005). |
| `cssName` | string | `--<prefixo>-` + segments joined by `-`. Unique among all tokens; a collision is an error (FR-005). |
| `layer` | `primitive` \| `semantic` \| `component` | Derived from the source directory and recorded in the adapter index (D1, D7). |
| `category` | Category enum | First segment of the path; the second, under the reserved `brand` group (FR-006). |
| `type` | DTCG `$type` | Declared or inherited from the group, never inferred. Must be compatible with the category. |
| `axis` | `invariant` \| `brand` \| `mode` | Only for `semantic`. Primitives and components are `invariant` in the source (D7). |
| `role` | `public` \| `brand-mode-source` | `brand-mode-source` = a brand-axis token under the reserved root group `brand`, whose last segment is a mode id (e.g., `brand.color.bg.surface.light`), the source of a mode-axis token (FR-033). Not consumable by a component style. The group is necessary because, in DTCG, a token cannot have children. |
| `values` | context → value map | Primitive: DTCG literal. Semantic and component: alias `{path}` (FR-003). The map keys follow the axis: one value (`invariant`), one per brand (`brand`), one per mode (`mode`). |
| `description` | string | Optional; free text subject to the catalog's invisible-Unicode scan (IA-18, catalog feature). |
| `deprecated` | boolean or string | DTCG field `$deprecated`; removal follows SemVer major (Principle X). |
| `source` | file, line, column | From the index built on the Ajv read; used in every error message. |

**Validation rules**:

- V-01 DTCG 2025.10 schema (`format.json`, `resolver.json`) with no error (FR-002).
- V-02 Literal only in `primitive` (FR-003). A composite (shadow, typography, border) in `semantic` or
  `component` cannot have a literal subvalue.
- V-03 An alias resolves to an existing token, cycle-free, in all permutations (FR-004).
- V-04 Reference direction: `primitive → primitive`; `semantic → primitive | semantic`;
  `component → semantic | component | primitive` (FR-004).
- V-05 `$ref` (JSON Pointer) forbidden outside `primitive`; `$root` forbidden; `$extends` only in the keyed
  form (D1).
- V-06 The name follows the convention grammar, per category, with segments in a fixed order (FR-005;
  [contracts/token-source.md](contracts/token-source.md)).
- V-07 The axis is consistent with the contexts that define the token: `brand` only in brand-context sets,
  `mode` only in mode-context sets, `invariant` only in shared sets (D7).
- V-08 Variation on both axes in a single token is an error; the accepted form is a mode-axis token whose
  value in each mode is an alias to the corresponding `brand-mode-source` token
  (`color.bg.surface` → `{brand.color.bg.surface.light}` in `light` mode), with the same keys across
  every brand (FR-033). Every token under `brand.` is a `brand-mode-source`, has a `brand` axis, and ends in a
  mode id.
- V-09 Shared sets have no brand- or mode-axis values (parity not masked, D1).
- V-10 A `hex` given for a color within the sRGB gamut must equal the 8-bit quantization of the
  components (D5).

## Layer

The enum `primitive`, `semantic`, `component` (TOK-02). It defines the allowed literal and the reference direction
(V-02, V-04). Component styles only consume `semantic` (with `role = public`) and `component`
(TOK-03, FR-022).

## Category

A closed enum from TOK-10, with the allowed DTCG `$type`:

| Category (1st segment) | Allowed `$type` |
| --- | --- |
| `color` | `color` |
| `typography` | `fontFamily`, `fontWeight`, `dimension`, `number` (atomic tokens only; the composite `typography` is not publishable, a plan decision) |
| `space` | `dimension` |
| `size` (dimension) | `dimension` |
| `radius` | `dimension` |
| `border` | `border`, `strokeStyle` (string form only), `dimension` |
| `shadow` | `shadow` |
| `motion` | `duration`, `cubicBezier`, `transition` |
| `z-index` | `number` |
| `breakpoint` | `dimension` |
| `opacity` | `number` |

Rule: each category has at least one published `semantic` token (V-11, FR-006). The exact names of the
first segments are fixed in the naming convention (TOK-04) and only change by major version.

## Control-height scale

A closed and ordered set of `semantic` tokens of the `size` category under a reserved group (e.g.,
`size.control.<step>`), with the same set of steps across every permutation (FR-007, TOK-13).

- V-12 Every token whose name indicates a control height belongs to the scale; no step outside it.
- The build report lists the resolved scale per permutation (FR-008).
- The token manifest marks `scale: "control-height"` on the members, for the lint rule (FR-023).

## Brand

| Field | Type | Rule |
| --- | --- | --- |
| `id` | ASCII kebab string | Context of the `brand` modifier; becomes the `data-<prefixo>-brand` value and the `brand-<id>.css` file name. |
| `default` | boolean | Exactly one default brand, indicated by the requester (CMP-24). Until then, synthetic brand A in the tests. |
| `sets` | files | Only brand-axis semantic tokens (including the `brand.*` ones). All primitives stay in `src/primitive/`; the build derives which ones are brand-exclusive from the references and emits them in that brand's file (`placement: brand-exclusive`, [contracts/build-manifests.md](contracts/build-manifests.md)). |

Adding a brand = a new context in the resolver + new token files; no other file
changes (FR-009, SC-005). Synthetic brands (A, B, C) exist only in fixtures and examples (QA-15).

## Mode

The enum `light`, `dark`; default `light` (spec premise, Assumptions). Value of
`data-<prefixo>-mode`. A new mode would require regenerating the CSS resolver and changes the API (major).

## Permutation (theme combination)

A brand × mode pair. For each permutation the build has the resolved map token → final value.

- V-13 Every permutation has exactly the same set of `semantic` token keys (FR-011,
  SC-004); parity is also verified per context (what each brand and each mode contribute).
- The build fails if the permutation list comes back undefined (parser limit) or incomplete.

## Theme scope (runtime)

An HTML element with `data-<prefixo>-brand`, `data-<prefixo>-mode`, or both.

- Resolution per axis: the nearest scope of that axis wins (FR-012).
- No attribute on the element or on an ancestor: default brand and default mode (FR-013).
- A nonexistent value or a brand not imported: keeps the value of the nearest ancestor (FR-014).
- Mechanism: [contracts/css-output.md](contracts/css-output.md).

## Contrast pair

An item of the versioned contrast manifest (FR-019).

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Unique; the manifest is ordered by `id`. |
| `fg` | token ref | Only public `semantic` or `component`; never a primitive or literal. |
| `bg` | ordered list of refs or a surface-set name | Stack bottom to top; the base must be opaque or be a surface set. |
| `state` | state-vocabulary enum | `default`, `hover`, `active`, `focus-visible`, `selected`, `invalid`, `disabled`, `inactive` (versioned vocabulary, shared with the FR-021 rule). |
| `kind` | `text` \| `non-text` | Defines the minimum (4.5 or 3 under WCAG 2.2 AA). |
| `group` | optional string | Pairs of the same "any-of" group: the group passes if at least one member reaches the minimum. |
| `exempt` | optional `"wcag-inactive"` | Allowed only with `state` `disabled` or `inactive`; measured and reported, does not fail. |

- V-14 Every reference exists in every permutation (complements V-13).
- V-15 A pair without `exempt`, outside a group, below the minimum in any permutation fails the build
  (FR-020, SC-008).
- V-16 A stack without an opaque base, or an empty surface set in the mode, is an error.

## Surface set

A name (`@surfaces`, `@raised`, etc.) → a list of opaque surface tokens per mode. The checker expands
one measured case per surface; all must pass.

## Contrast thresholds

A section of the versioned thresholds file of QA-14: `{ "level": "WCAG22-AA", "text": 4.5,
"nonText": 3 }`. The checker confirms that the values match the declared level (A11Y-01); a change
requires the QA-14 approval.

## Generated artifacts

All derived, deterministic (FR-015, SC-002) and outside version control, except the token
API report, versioned on purpose and checked by drift (QA-08). Manifest and
report format: [contracts/build-manifests.md](contracts/build-manifests.md).

| Artifact | Content | Consumer |
| --- | --- | --- |
| `dist/css/base.css` | Layer order, shared primitives, mode toggles, resolver | Apps |
| `dist/css/brand-<id>.css` | Brand-axis tokens and brand-exclusive primitives | Apps |
| `dist/esm/index.js` + `.d.ts` | `var(--<prefixo>-*)` references of all public tokens | Apps |
| `dist/esm/values.js` + `.d.ts` | Value maps by brand × mode | Apps, tests |
| `dist/meta/tokens.manifest.json` | Token → cssName, layer, category, axis, role, alias chain, scale | Lint, contrast |
| `dist/meta/sync-manifest.json` | Desired state for the design tool | design-sync |
| `dist/meta/report.json` and `.md` | Count by category, scale per permutation | CI, acceptance |
| `api/tokens.api.json` | Public surface (names, types, entries) | API check (GOV-01) |

## Design-tool variable

A mirror of a token in the tool (snapshot normalized by the adapter).

| Field | Rule |
| --- | --- |
| `path` | Same segments as the token; the tool's separator defined in the convention (FR-028). |
| `collection` | One per axis: Primitives, Brand, Mode, Invariant semantics, Components (FR-029). |
| `modes` | Brands (Brand collection), `light`/`dark` (Mode collection); the rest without modes. |
| `value` | Literal or alias by path, per mode. |
| `key` | The token key stored in a tool field (e.g., description or code syntax), to detect a manual rename. |
| `nativeRef` | Opaque tool identifier. |

Every variable corresponds to a real token; there is no auxiliary variable (FR-033, DSN-04).

## Sync run

```text
planned ──--dry-run──► dry-run                         (nothing applied; plan and log emitted)
   │
   └──apply──► verify(empty diff) ──► verified
        │            │
        └──error──► failed ◄──verify(non-empty diff)   failed ──► alert to the owner (FR-026)
```

States recorded in the log: `planned`, `dry-run`, `verified`, `failed`
([contracts/design-sync.md](contracts/design-sync.md)).

| Field | Rule |
| --- | --- |
| `version` | Source published version (main tag) or a flagged manual run. |
| `changes[]` | Variables created, changed, renamed back, and removed, ordered by path. |
| `restored[]` | Manual edits undone (FR-027), distinguished from release changes. |
| `digests` | sha256 of the source manifest and of the tool snapshot. |
| Envelope | Timestamp and run URL, outside the canonical content (byte-for-byte identical content). |

## Divergence

| Field | Rule |
| --- | --- |
| `fingerprint` | sha256(type \| path \| mode \| tool); deduplicates items. |
| `kind` | `missing`, `extra`, `value`, `alias`, `name`, `hierarchy`, `type`. |
| `owner` | The sync owner role (owners file, FR-026). |
| `due` | Detection date + the SLA from the versioned configuration. |
| `state` | `open` → `resolved` (closes itself when the next run sees an empty diff) → `open` again if the same fingerprint reappears (the tracker reopens the existing item). |

Generated by the scheduled check, at least weekly and on each published version (FR-030, SC-011).

## Lint finding

Output of the style rules (FR-021 to FR-024): `{ file, line, column, code, message }`, with `code`
in a stable set ([contracts/lint-rules.md](contracts/lint-rules.md)). Fixtures compare
multisets of `{file, line, column, code}`.
