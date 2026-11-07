# Contract: token build manifests and report

**Feature**: [spec.md](../spec.md) | **Model**: [data-model.md](../data-model.md) | **Date**: 2026-10-21

Normative format of the files in `packages/tokens/dist/meta/` produced by
`tokens-build build` ([tools-cli.md](tools-cli.md)). This contract owns the format; the
consumers cite this page:

| File | Consumers | Requirements |
| --- | --- | --- |
| `tokens.manifest.json` | `<prefixo>/design-tokens` and `<prefixo>/contrast-pairs` ([lint-rules.md](lint-rules.md)), `tokens-contrast` ([contrast-manifest.md](contrast-manifest.md)), browser tests ([css-output.md](css-output.md), §16), ENG-06 check | FR-017, FR-020 to FR-023 |
| `sync-manifest.json` | `design-sync` (format in [design-sync.md](design-sync.md)) | FR-025 to FR-030 |
| `report.json` and `report.md` | CI, acceptance package | FR-008 |

All are derived, generated on every build, outside version control, and published under `./meta/*`
for tools; apps do not import them ([esm-output.md](esm-output.md)). `<prefixo>` is the constitution's
marker.

## 1. Common rules

- **M-01** Envelope: every JSON file begins with `format` (stable identifier) and `version`
  (integer). An incompatible format change increments `version` and is a major change of the package
  ([esm-output.md](esm-output.md), §11.2).
- **M-02** Canonical JSON: object keys ordered by code point, arrays in the order defined by this
  contract, 2-space indentation, LF, final newline, no timestamp, no absolute path, no environment
  data. Two builds of the same source produce byte-for-byte identical files (FR-015, SC-002).
- **M-03** File paths are relative to `packages/tokens/` and use `/`.
- **M-04** Permutation key: `"<brand>/<mode>"` (e.g. `"a/light"`). Permutations ordered by brand
  then by mode, both by code point.
- **M-05** Private variables of the scope mechanism (segment `_`, such as `--<prefixo>-_on-light`)
  never appear in the manifests ([css-output.md](css-output.md), §6).

## 2. `tokens.manifest.json`

### 2.1 Root

```json
{
  "format": "<prefixo>.tokens-manifest",
  "version": 1,
  "attributes": { "brand": "data-<prefixo>-brand", "mode": "data-<prefixo>-mode" },
  "brands": [
    { "default": true, "file": "dist/css/brand-a.css", "id": "a" },
    { "default": false, "file": "dist/css/brand-b.css", "id": "b" }
  ],
  "layerOrder": ["<prefixo>.tokens"],
  "modes": [
    { "default": false, "id": "dark" },
    { "default": true, "id": "light" }
  ],
  "package": "@<prefixo>/tokens",
  "permutations": ["a/dark", "a/light", "b/dark", "b/light"],
  "scales": {
    "control-height": ["size.control.lg", "size.control.md", "size.control.sm"]
  },
  "tokens": []
}
```

| Field | Rule |
| --- | --- |
| `brands[]` | One entry per `brand` modifier context, ordered by `id`; exactly one with `default: true` (FR-013, CMP-24). |
| `modes[]` | `light` and `dark`, ordered by `id`; `light` is the default (spec assumption). |
| `layerOrder` | Copy of `src/layers.json` ([css-output.md](css-output.md), L-03); `<prefixo>.tokens` first. |
| `permutations` | All brand × mode combinations (M-04). The build fails if the list comes in incomplete. |
| `scales.control-height` | Paths of the members of the single control-height scale (FR-007), ordered by path. The size order is in the report (§4). |
| `tokens[]` | All public tokens and `brand-mode-source`, ordered by `path` (code point). |

### 2.2 Token

```json
{
  "aliasChains": {
    "a/dark": ["color.bg.surface", "brand.color.bg.surface.dark", "color.neutral.900"],
    "a/light": ["color.bg.surface", "brand.color.bg.surface.light", "color.neutral.0"]
  },
  "aliasOf": {
    "dark": "brand.color.bg.surface.dark",
    "light": "brand.color.bg.surface.light"
  },
  "axis": "mode",
  "category": "color",
  "color": {
    "emitted": { "a/dark": "#16181d", "a/light": "#ffffff" },
    "value": {
      "a/dark": { "colorSpace": "srgb", "components": [0.086, 0.094, 0.114] },
      "a/light": { "colorSpace": "srgb", "components": [1, 1, 1] }
    },
    "subRefs": null
  },
  "cssName": "--<prefixo>-color-bg-surface",
  "deprecated": false,
  "description": "Default background for surfaces.",
  "exclusiveBrand": null,
  "layer": "semantic",
  "path": "color.bg.surface",
  "placement": "base",
  "role": "public",
  "scale": null,
  "source": { "column": 7, "file": "src/semantic/mode/dark.tokens.json", "line": 6 },
  "type": "color"
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `path` | string | DTCG path joined by `.` ([token-source.md](token-source.md)). |
| `cssName` | string | `--<prefixo>-` + segments joined by `-` ([css-output.md](css-output.md), L-05). |
| `layer` | `primitive` \| `semantic` \| `component` | V-02, V-04. |
| `category` | string | TOK-10 category (data-model, "Category"). |
| `type` | string | Resolved DTCG `$type`. Allowed composites: `shadow`, `border`, `transition` (§2.3). |
| `axis` | `invariant` \| `brand` \| `mode` | V-07; primitives and components are `invariant`. |
| `role` | `public` \| `brand-mode-source` | `brand-mode-source` = token under the `brand.` group (FR-033). |
| `placement` | `base` \| `brand` \| `brand-exclusive` | Where the CSS declares the token ([css-output.md](css-output.md), §4). |
| `exclusiveBrand` | string \| null | Brand id when `placement` is `brand-exclusive`; otherwise `null`. |
| `aliasOf` | object \| null | Direct alias target per context key: `"*"` for `invariant`, brand id for `brand`, mode id for `mode`; `null` for primitive. |
| `aliasChains` | object \| null | Per permutation (M-04), the chain from the token itself down to the terminal primitive, inclusive. `null` for primitive. Used by the lint to verify scale membership through aliases (FR-023). |
| `scale` | `"control-height"` \| null | Member of the control-height scale (FR-007). |
| `color` | object \| null | Only for `type` `color` or a composite with color; otherwise `null` (§2.3). |
| `deprecated` | boolean \| string | From `$deprecated`. |
| `description` | string \| null | From `$description`. |
| `source` | object | First definition of the token — the first declaring file in code-point-sorted order (so a path in both `mode/dark` and `mode/light` resolves to `dark`): file (M-03), line and column, 1-based. |

### 2.3 Color and composites

- `color.emitted`: per permutation, the string exactly as it is emitted in the CSS and in the
  `./values` map (`#rrggbb` for opaque; `rgb(r g b / a)` with three decimal places in the alpha),
  produced by `toEmittedSrgb()` ([css-output.md](css-output.md), §11; ADR-15). The contrast checker
  composes from that string (`emitted-mismatch` if it diverges from the measured value).
- `color.value`: for a plain `color`, per permutation, the resolved DTCG color value
  (`{ colorSpace, components, alpha? }`) that the generator serialized — the source of truth. `null`
  for a composite (`shadow`, `border`), whose colors are reached through `subRefs`. The contrast
  checker passes this value through the same `toEmittedSrgb()` and asserts the result equals
  `color.emitted` of the same permutation, which is the independent G-2 recompute
  ([contrast-manifest.md](contrast-manifest.md), §8 step 4 and §13).
- `color.subRefs`: for `shadow` and `border`, per permutation, the ordered list (order of the shadow
  layers) of the paths of the color tokens referenced by the subvalues; `null` for `color`.
- Composite `typography` and `strokeStyle` in object form are not publishable
  ([css-output.md](css-output.md), S-04): `tokens-build build` rejects them with
  `unserializable-value`, and the `typography` category uses atomic tokens (plan decision).

### 2.4 Guarantees

- **M-06** Every token in `tokens[]` with `role: public` has a `cssName` declared in the CSS indicated
  by `placement`, and every public `cssName` of the generated CSS appears in the manifest
  (`dist-parity` in the build).
- **M-07** The keys of `aliasChains`, `color.emitted` and (for a plain `color`) `color.value` are
  exactly `permutations`.
- **M-08** No token has `placement: brand-exclusive` without `exclusiveBrand`, nor the reverse.

## 3. `sync-manifest.json`

Normative format in [design-sync.md](design-sync.md). This contract only fixes that it follows M-01
to M-05, is generated from the same resolved model as `tokens.manifest.json`, and lists the same
permutations.

## 4. `report.json` and `report.md`

```json
{
  "format": "<prefixo>.tokens-report",
  "version": 1,
  "categories": [
    { "category": "color", "component": 12, "primitive": 96, "semantic": 41 },
    { "category": "opacity", "component": 0, "primitive": 6, "semantic": 3 }
  ],
  "colorMapping": [
    { "outOfGamut": true, "path": "color.brand-a.500", "space": "oklch" }
  ],
  "controlHeight": {
    "a/light": [
      { "path": "size.control.sm", "value": "28px" },
      { "path": "size.control.md", "value": "36px" },
      { "path": "size.control.lg", "value": "44px" }
    ]
  },
  "files": [
    { "bytes": 0, "gzipBytes": 0, "path": "dist/css/base.css" }
  ],
  "permutations": ["a/dark", "a/light", "b/dark", "b/light"],
  "totals": { "component": 12, "primitive": 180, "semantic": 95 }
}
```

| Field | Rule |
| --- | --- |
| `categories[]` | The 11 TOK-10 categories, ordered by name, with a count per layer; a category without a semantic token has already failed validation (V-11). Evidence for FR-006 and FR-008. |
| `controlHeight` | Per permutation, the scale resolved in ascending order of value (FR-008, TOK-13). |
| `colorMapping` | Colors outside the sRGB gamut mapped by the CSS Color 4 algorithm (ADR-15); empty when there are none. |
| `files[]` | Raw and gzip size of each file in `dist/css/` and `dist/esm/`, input to the QA-07 budget (gzip at a fixed level, for determinism). |
| `permutations`, `totals` | Summary. |

`report.md` carries the same information in tables, without a timestamp, and is attached to CI as
evidence (ACE-02).

## 5. Traceability

| ID | Covered by |
| --- | --- |
| FR-006, FR-008 | §4 (`categories`, `controlHeight`) |
| FR-015 | M-02 |
| FR-017 | §2.2 (`placement`, `exclusiveBrand`), M-06, M-08 |
| FR-020, FR-021 | §2.3 (`color.emitted`, `subRefs`) |
| FR-022, FR-023 | §2.2 (`layer`, `role`, `aliasChains`, `scale`), §2.1 (`scales`) |
| FR-033 | `role`, `axis`, `aliasOf` |
| QA-07 | §4 (`files`) |
