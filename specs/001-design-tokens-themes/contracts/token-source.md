# Contract: DTCG token source

**Feature**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) |
**Data model**: [data-model.md](../data-model.md) | **Date**: 2026-10-21

This contract fixes the format of the single token source of the `@<prefixo>/tokens` package
(`packages/tokens/`): directory structure, brand and mode resolution file, layer and axis rules, name
grammar, derivation of the CSS name and of the name in the design tool, color value rules and the format
of the validation errors. It is the reference of the validator
`tokens-build validate` (private package `@<prefixo>/tokens-build`), of the token manifest that the
style lint and the contrast check consume and of the naming convention document (TOK-04).

The terms MUST, MUST NOT, SHOULD and MAY follow the constitution's convention. `<prefixo>` is the
intentional marker of the project prefix (TODO(PREFIXO) of constitution v1.0.0).

Source decisions: D1 (pipeline), D3 (CSS scopes), D4 (sync), D5 (color) and D7 (source model) of
[research.md](../research.md). Related ADRs, all with status **Proposed** and accepted only by owner
approval (GOV-07, GOV-09):
[ADR-11](../../../docs/adr/ADR-11-pipeline-build-tokens.md),
[ADR-13](../../../docs/adr/ADR-13-escopos-marca-modo-css.md),
[ADR-14](../../../docs/adr/ADR-14-sincronizacao-ferramenta-design.md),
[ADR-15](../../../docs/adr/ADR-15-cor-e-contraste.md) and
[ADR-16](../../../docs/adr/ADR-16-lint-tokens-e-testes.md).

## 1. Scope and precedence

This contract governs the content of `packages/tokens/src/`, the versioned schemas in
`packages/tokens/schemas/dtcg-2025.10/` and the diagnostic output of `tokens-build validate`.

It does not govern, and only references:

- the generated CSS (`base.css`, `brand-<id>.css`, resolver, mode toggles): [css-output.md](css-output.md);
- the style lint rules (`<prefixo>/design-tokens`, `<prefixo>/contrast-pairs`):
  [lint-rules.md](lint-rules.md);
- the contrast manifest and the surface set (`contrast/manifest.json`,
  `contrast/surfaces.json`) and rules V-14 to V-16, the ESM modules, the manifests in
  `dist/meta/`, the build report and the API report (`api/tokens.api.json`), each in its own
  contract in `contracts/`;
- the repository scan of FR-001 (`repo-checks scan-tokens`) and the versioned-generated-file check
  (`repo-checks drift`).

Precedence: Requirements > constitution > [spec.md](../spec.md) > [research.md](../research.md) >
[data-model.md](../data-model.md) > this contract. A divergence of this contract with a higher-level
document is a defect of this contract. Section 12 records where this contract details or adjusts the
data-model.

## 2. Assumptions made

No open decision of the requester is taken here. The assumptions below hold.

| Topic | Assumption used | Effect in this contract |
| --- | --- | --- |
| Project prefix | `<prefixo>`, marker of the TODO(PREFIXO) of the constitution | It appears in the CSS name, in the `data-<prefixo>-*` attributes and in the package scope. Swapping it for the final value does not change the grammar. |
| Version 1.0 brands (TOK-07) | Current assumption: all brands of the current consuming apps, with light and dark | The format accepts any number of brands (1 or more). Until the values are delivered, the source and the fixtures use only the synthetic brands `a` and `b` (QA-15). |
| Default brand (CMP-24) | Designated by the requester | `default` field of the `brand` modifier. Provisional value `a` in fixtures and examples (data-model, Brand). |
| Default mode | `light` (spec, Assumptions) | `default` field of the `mode` modifier. |
| Design tool (DSN-01) | None chosen; the repository is the source and the tool receives the variables | The name mapping (section 8.9) covers Figma and Penpot as candidates, without choosing; another tool uses the same rule with the separator declared by its adapter. |
| Wide-gamut color palettes | Deterministic mapping to sRGB (research.md, Questions for the requester) | Section 9: a color outside the sRGB gamut is emitted by the CSS Color 4 mapping. |
| WCAG level (A11Y-01) | WCAG 2.2 AA | Does not affect this contract; it applies in the contrast check. |
| TOK-12 | Not contracted | There is no rule for a token without a reference. |
| Browser list, Node and TypeScript floors (ENG-08) | Current assumptions, with no values fixed here | They do not affect the source format. |
| CI platform | GitHub Actions (inferred from ENG-18) | The validation runs in the workflow `.github/workflows/tokens-ci.yml`, with actions pinned by SHA. |

## 3. Terms

- **Path**: list of a token's segments, written with `.` (e.g. `color.bg.surface`).
- **Layer**: `primitive`, `semantic` or `component`, derived from the file's directory (section 4).
- **Axis**: `invariant`, `brand` or `mode`. Only semantic tokens have their own axis; primitives and
  components are `invariant` in the source (D7).
- **Context**: value of a resolver modifier: a brand id, or `light` or `dark`.
- **Permutation**: brand × mode pair, written `<brand>/<mode>` (e.g. `a/light`).
- **Public token**: token whose first segment is a category (section 8.3). It includes the brand-axis
  tokens, which component styles can consume.
- **Brand-mode source token** (role `brand-mode-source`): brand-axis token under the reserved root group
  `brand`, whose last segment is a mode id (section 7.3). Component styles MUST NOT consume it.
- **Axis dependency**: the set of axes on which a token's resolved value depends, by location or by any
  alias of its chain (section 7.2).
- **CSS name**: `--<prefixo>-` followed by the segments joined by `-` (section 8.7).

## 4. Directory structure

```text
packages/tokens/
├── package.json
├── src/
│   ├── tokens.resolver.json            # DTCG Resolver 2025.10 (section 5)
│   ├── primitive/
│   │   └── *.tokens.json               # all primitives, including those used by a single brand
│   ├── semantic/
│   │   ├── invariant.tokens.json       # invariant axis
│   │   ├── brand/
│   │   │   ├── a.tokens.json           # one file per brand (brand modifier context)
│   │   │   └── b.tokens.json
│   │   └── mode/
│   │       ├── light.tokens.json       # one file per mode (mode modifier context)
│   │       └── dark.tokens.json
│   ├── component/
│   │   └── <component>.tokens.json     # one file per component
│   └── layers.json                     # @layer order; not a token file (css-output.md, L-03)
├── contrast/
│   ├── manifest.json                   # contrast contract
│   ├── surfaces.json
│   └── manifest.schema.json, surfaces.schema.json   # schemas proposed in contrast-manifest.md
├── schemas/dtcg-2025.10/
│   ├── format.json                     # copy of the official JSON Schema (Format)
│   ├── resolver.json                   # copy of the official JSON Schema (Resolver)
│   ├── SHA256SUMS
│   └── LICENSE-W3C.md
├── api/tokens.api.json                 # generated and versioned on purpose (drift)
└── dist/                               # generated, in .gitignore
```

| Path in `src/` | Layer | Axis | Allowed content |
| --- | --- | --- | --- |
| `primitive/*.tokens.json` | `primitive` | `invariant` | Literals and aliases between primitives. |
| `semantic/invariant.tokens.json` | `semantic` | `invariant` | Aliases with no brand or mode dependency. |
| `semantic/brand/<id>.tokens.json` | `semantic` | `brand` (context `<id>`) | Public brand-axis tokens and `brand.*` tokens. |
| `semantic/mode/<mode>.tokens.json` | `semantic` | `mode` (context `<mode>`) | Public mode-axis tokens. |
| `component/<component>.tokens.json` | `component` | `invariant` | Aliases whose second segment is `<component>`. |

Rules:

1. Every `*.tokens.json` file under `src/` MUST be in one of the paths of the table and be
   referenced by `tokens.resolver.json` (codes `TKN-FILE-LOCATION` and
   `TKN-FILE-UNREFERENCED`). A brand file name and a mode file name MUST equal the id of the
   context. A component file MUST contain only tokens whose second segment is the name of the
   file.
2. No token MAY exist outside `packages/tokens/src/` (FR-001). The repository scan
   (`pnpm check:scan`) covers the rest of the repository, with justified exceptions in
   `quality/scan-allowlist.json` (for example, the validator's fixtures).
3. The files MUST be valid JSON in UTF-8 without BOM and with no duplicate key in the same object
   (`TKN-JSON-PARSE`). The LF line ending is guaranteed by `.gitattributes`.
4. The primitive files SHOULD be organized one per category
   (`primitive/<category>.tokens.json`), and a category may split into files with a
   qualifier (`primitive/<category>.<qualifier>.tokens.json`). A primitive's location does not
   indicate a brand: a primitive's exclusivity to a brand is derived from the
   references by the build (D7) and decides whether it goes into `base.css` or into `brand-<id>.css`
   ([css-output.md](css-output.md)).
5. `schemas/dtcg-2025.10/` holds copies of the official DTCG 2025.10 JSON Schemas. The validator
   checks the sha256 of each copy against `SHA256SUMS` before using it and validates without a network
   (D1). `LICENSE-W3C.md` records the W3C Software and Document License, which enters the third-party
   notices and the versioned license policy (`quality/license-policy.json`, ENG-21).
6. `dist/` is generated and never versioned (FR-015). `api/tokens.api.json` is generated, versioned on
   purpose and checked by `pnpm check:drift`.
7. The source only changes through a reviewed pull request. No routine writes to `src/` from the
   design tool (DSN-01, FR-025): `@<prefixo>/design-sync` reads only
   `dist/meta/sync-manifest.json`, and the layers file (ENG-01) has no edge that would allow the
   reverse.

## 5. `tokens.resolver.json` file

### 5.1 Shape

The file follows the Resolver Module of DTCG 2025.10. The sketch below shows the adopted shape with the
synthetic brands `a` and `b`. The normative form of the properties is that of the versioned schema
`schemas/dtcg-2025.10/resolver.json` (V-01); if the sketch diverges from the schema in a property's name
or nesting, the schema prevails and the sketch is corrected, with the rules of section 5.2 kept.

```json
{
  "version": "2025.10",
  "sets": {
    "primitive": {
      "sources": [
        { "$ref": "primitive/color.tokens.json" },
        { "$ref": "primitive/space.tokens.json" }
      ]
    },
    "semantic-invariant": {
      "sources": [{ "$ref": "semantic/invariant.tokens.json" }]
    },
    "component": {
      "sources": [{ "$ref": "component/button.tokens.json" }]
    }
  },
  "modifiers": {
    "brand": {
      "contexts": {
        "a": [{ "$ref": "semantic/brand/a.tokens.json" }],
        "b": [{ "$ref": "semantic/brand/b.tokens.json" }]
      },
      "default": "a"
    },
    "mode": {
      "contexts": {
        "dark": [{ "$ref": "semantic/mode/dark.tokens.json" }],
        "light": [{ "$ref": "semantic/mode/light.tokens.json" }]
      },
      "default": "light"
    }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/primitive" },
    { "$ref": "#/sets/semantic-invariant" },
    { "$ref": "#/modifiers/brand" },
    { "$ref": "#/modifiers/mode" },
    { "$ref": "#/sets/component" }
  ]
}
```

### 5.2 Rules

1. `version` MUST be `"2025.10"`, the constant value of the versioned schema. The text of the Resolver
   2025.10 has an internal inconsistency in the version value; the copied schema prevails.
2. The modifiers MUST be exactly `brand` and `mode`, orthogonal.
3. `mode.contexts` MUST have exactly `light` and `dark`, and `mode.default` MUST be `"light"`.
   Adding a mode changes the public API and the CSS resolver (major version, data-model).
4. `brand.contexts` MUST have at least one context. Each key is a brand id
   (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`), which is also the value of `data-<prefixo>-brand`, the name of
   `brand-<id>.css` and the mode name in the design tool. Each context MUST list exactly
   the file `semantic/brand/<id>.tokens.json` of the same id. `brand.default` MUST name an
   existing context: the default brand (assumption of section 2).
5. The sets MUST use the canonical names `primitive`, `semantic-invariant` and `component`, and each
   one MUST list exactly the files of the corresponding directory. A set with no file is omitted,
   along with its entry in `resolutionOrder`.
6. `resolutionOrder` MUST follow the canonical order `primitive`, `semantic-invariant`, `brand`,
   `mode`, `component`, with the present entries. Since no path is defined in two places
   (`TKN-PATH-DUPLICATE`, section 7.1), the order decides no value; it is fixed so that no
   equivalent divergent configurations exist and so that the modifiers stay orthogonal, as the
   Resolver recommends.
7. Every `$ref` of the resolver MUST be a relative POSIX path inside `src/` (no `..`, no
   absolute path, no URL scheme) or an internal pointer `#/sets/<name>` or
   `#/modifiers/<name>` (`TKN-RESOLVER-REF`). The build passes the parser a loader that refuses
   any other origin (D1).
8. Source lists and context keys SHOULD be in code-point order. The build does not
   depend on this: it orders by code point before any output.

Deviations from rules 2 to 6 generate `TKN-RESOLVER-STRUCTURE`.

### 5.3 Permutations

The set of permutations is the product of the contexts of `brand` and `mode`. The validator and the
build obtain the list from the resolver (`listPermutations()`) and resolve each one (`apply()`); all
the rules of sections 6 to 9 run over all permutations, and not just over the default one (D1). An
undefined list (parser limit) or one that differs from brands × modes generates `TKN-CONFIG-PERMUTATIONS`.

### 5.4 Adding a brand

Adding the brand `c` requires only:

1. creating `src/semantic/brand/c.tokens.json` with the same set of paths as the other brands
   (section 7.4);
2. adding the context `c` in `modifiers.brand.contexts`;
3. if necessary, adding primitives in `src/primitive/`.

Nothing outside `packages/tokens/src/` is hand-edited, which the diff proves (FR-009, SC-005). The
`brand-c.css` file and the brand's ESM entries come from the build; the versioned API report
(`api/tokens.api.json`) is regenerated by it. That report is a token file, and the diff check accepts it
together with the source (spec, Clarifications; [esm-output.md](esm-output.md), §11.3).

## 6. Layers and reference direction (V-02 to V-05)

| Layer | Literal value | MAY reference by alias | `$ref` (JSON pointer) | `$extends` |
| --- | --- | --- | --- | --- |
| `primitive` | Yes | `primitive` | Yes, local only | Only with braces |
| `semantic` | No | `primitive`, `semantic` | No | Only with braces |
| `component` | No | `semantic`, `component`, `primitive` | No | Only with braces |

Rules:

1. **Literal only in the primitive (V-02, FR-003)**. A literal is any `$value`, or composite subvalue,
   that is not a `{path}` alias. In `semantic` and `component`, the recommended form for composites
   (shadow, typography, border, transition) is the whole-token alias; composition by subvalues is only
   accepted when every subvalue is an alias. The `inset` subvalue of the shadow, which has no type of
   its own in DTCG, forces the whole alias. Violation: `TKN-LITERAL-OUTSIDE-PRIMITIVE`.
2. **Resolved alias with no cycle (V-03, FR-004)**. Every alias MUST resolve to an existing token
   in all permutations, with no cycle (`TKN-ALIAS-UNRESOLVED`, `TKN-ALIAS-CYCLE`, the latter
   with the full chain). The target's type MUST equal the token's `$type` (`TKN-ALIAS-TYPE`).
3. **Reference direction (V-04, FR-004)**: per the table (`TKN-LAYER-DIRECTION`). Two additional
   restrictions hold within those edges: the axis rules of section 7.2 and the rule that
   `brand.*` tokens are referenced only by the corresponding mode-axis token (section 7.3).
4. **`$ref`, `$root` and `$extends` (V-05)**. `$ref` is accepted only in the primitive layer, pointing
   to a local fragment (`#/...`) or a relative file inside `src/primitive/`
   (`TKN-REF-OUTSIDE-PRIMITIVE`, `TKN-REF-NOT-LOCAL`). `$root` is forbidden in any layer
   (`TKN-ROOT-FORBIDDEN`), because the parser removes it from the path and the path would stop being
   equal to the CSS name and the name in the tool. `$extends` is accepted only in the braces form,
   pointing to a group (`"$extends": "{color.blue}"`); the object form is refused (`TKN-EXTENDS-FORM`).
   The rules of this contract apply over the already-expanded tokens, with the error pointed at the
   `$extends`.
5. **Type**. Every token MUST have `$type` declared on itself or on an ancestor group, never inferred
   from the alias target (`TKN-TYPE-MISSING`), and compatible with the category and the property
   (`TKN-TYPE-CATEGORY`, section 8.3).
6. `$description` and `$deprecated` MAY be used. The text of `$description` passes through the catalog's
   invisible-Unicode scan (IA-18, catalog feature). `$extensions` MAY exist, but
   does not change the layer, axis, role or name of any token.

## 7. Variation axes and `brand.*` form (V-07 to V-09, V-13, FR-011, FR-033)

### 7.1 Axis by location (V-07, V-09)

A semantic token's axis comes from the file that defines it (section 4). Each path MUST be
defined in exactly one of these places:

- a single file of a shared set (`primitive`, `semantic-invariant`, `component`); or
- the context files of exactly one modifier (all brand files, or the two mode files).

A path present in a shared set and also in a context, in contexts of both modifiers or in two files of
the same set generates `TKN-PATH-DUPLICATE`. With this, shared sets never carry brand-axis or mode-axis
values (V-09), and a brand does not silently inherit a value it did not define.

### 7.2 Axis dependency

A token's axis dependency is computed statically over the alias graph, in all contexts:

- primitive: empty;
- brand-axis token: `{brand}` plus the targets' dependency;
- mode-axis token: `{mode}` plus the targets' dependency;
- invariant or component token: the targets' dependency.

Rules:

1. **AX-1**: an invariant semantic token MUST have an empty dependency.
2. **AX-2**: a brand-axis token, public or `brand.*`, MUST NOT depend on `mode`. Brand tokens are
   declared in the brand scope ([css-output.md](css-output.md), D3); depending on the mode would freeze,
   in a nested mode scope, the mode of the brand scope (FR-012).
3. **AX-3**: a mode-axis token MAY depend on `brand` only in the form of section 7.3.
4. Component tokens MAY depend on any axis, because the CSS resolver redeclares them in every scope
   (D3), but MUST NOT reference `brand.*` tokens.

Violation of AX-1 or AX-2: `TKN-AXIS-DEPENDENCY`. Violation of AX-3: `TKN-AXIS-BOTH`. In both, the
diagnostic carries the alias chain up to the token that introduces the axis.

### 7.3 `brand-mode-source` form (V-08, FR-033)

A semantic token that varies by brand and by mode MUST be expressed as a mode-axis token whose
value in each mode is an alias to a brand-axis token with the same keys in every brand. The source
fixes that form as follows:

1. **Name**: `brand.<P>.<m>`, where `<P>` is the path of a valid public semantic token
   (section 8.3) and `<m>` is `light` or `dark`. Example: `brand.color.bg.surface.light`.
2. **Location**: only in `src/semantic/brand/<id>.tokens.json` (brand axis). Every token under `brand.`
   has role `brand-mode-source`, axis `brand` and ends in a mode id.
3. **Form**: if the mode-axis token `<P>` depends on brand, then, in each mode `<m>`, its value
   MUST be exactly the alias `{brand.<P>.<m>}`, with no intermediary. Thus, `brand.<P>.light` and
   `brand.<P>.dark` exist in every brand.
4. **Correspondence**: if `brand.<P>.<m>` exists, `<P>` MUST exist in the mode files and its
   value in mode `<m>` MUST be `{brand.<P>.<m>}`. An orphan `brand.*` token is an error.
5. **Reference**: `brand.<P>.<m>` MAY be referenced only by `<P>` in the file of mode `<m>`.
   A reference by a component, by another semantic token, by another `brand.*` or by `<P>` in another
   mode generates `TKN-BRAND-SOURCE-REF`. The lint rule `brand-mode-source-token`
   ([lint-rules.md](lint-rules.md)) imposes the same ban in the component styles.
6. **Targets**: `brand.<P>.<m>` obeys AX-2 and MAY reference primitives, invariant semantic tokens
   and public brand-axis tokens.

Violations of items 1, 2 and 4: `TKN-BRAND-SOURCE-FORM`; of item 3: `TKN-AXIS-BOTH`; of item 5:
`TKN-BRAND-SOURCE-REF`; of item 6: `TKN-AXIS-DEPENDENCY`.

The root group is necessary because, in DTCG, a token cannot have children: `color.bg.surface.light`
cannot coexist with the token `color.bg.surface`. It also isolates the role for the lint and for the
token manifest (`role: "brand-mode-source"`).

In the outputs, `brand.*` tokens are public tokens (name without the private segment `_`), with CSS name
`--<prefixo>-brand-…` declared in the brand file, and they appear in the tool's Brand collection with the
same name. Only the mode toggles `--<prefixo>-_on-light` and `--<prefixo>-_on-dark` are private
(section 8.8).

### 7.4 Key parity (V-13, FR-011, TOK-09)

1. **Per context**: the set of paths defined by each brand file MUST equal that of the other
   brands, and that of each mode file MUST equal that of the other mode
   (`TKN-PARITY-CONTEXT`). The diagnostic points to the file of the context where the key is missing (or
   extra) and relates the files that have it.
2. **Per permutation**: the set of resolved semantic paths, including `brand.*`, MUST be
   equal in all permutations (`TKN-PARITY-PERMUTATION`, SC-004).

The per-context check is not masked by inheritance because shared sets do not carry axis values
(section 7.1).

### 7.5 Worked example (synthetic brands `a` and `b`)

Primitives (`src/primitive/color.tokens.json`); the `hex` values are consistent with the components
(section 9):

```json
{
  "color": {
    "$type": "color",
    "gray": {
      "0": { "$value": { "colorSpace": "srgb", "components": [1, 1, 1], "hex": "#ffffff" } },
      "100": { "$value": { "colorSpace": "srgb", "components": [0.933333, 0.933333, 0.933333], "hex": "#eeeeee" } },
      "900": { "$value": { "colorSpace": "srgb", "components": [0.066667, 0.066667, 0.066667], "hex": "#111111" } }
    },
    "blue": {
      "600": { "$value": { "colorSpace": "srgb", "components": [0, 0.333333, 0.8], "hex": "#0055cc" } },
      "900": { "$value": { "colorSpace": "srgb", "components": [0, 0.133333, 0.333333], "hex": "#002255" } }
    },
    "green": {
      "700": { "$value": { "colorSpace": "srgb", "components": [0, 0.4, 0.2], "hex": "#006633" } },
      "900": { "$value": { "colorSpace": "srgb", "components": [0, 0.2, 0.133333], "hex": "#003322" } }
    }
  }
}
```

Brand `a` (`src/semantic/brand/a.tokens.json`):

```json
{
  "color": {
    "$type": "color",
    "bg": { "accent": { "$value": "{color.blue.600}" } }
  },
  "brand": {
    "color": {
      "$type": "color",
      "bg": {
        "surface": {
          "light": { "$value": "{color.gray.0}" },
          "dark": { "$value": "{color.blue.900}" }
        }
      }
    }
  }
}
```

Brand `b` (`src/semantic/brand/b.tokens.json`): same keys, with `color.bg.accent` →
`{color.green.700}`, `brand.color.bg.surface.light` → `{color.gray.100}` and
`brand.color.bg.surface.dark` → `{color.green.900}`.

Modes (`src/semantic/mode/light.tokens.json`; `dark.tokens.json` is the same, with
`{brand.color.bg.surface.dark}` and `{color.gray.0}`):

```json
{
  "color": {
    "$type": "color",
    "bg": { "surface": { "$value": "{brand.color.bg.surface.light}" } },
    "fg": { "default": { "$value": "{color.gray.900}" } }
  }
}
```

Resolved values per permutation:

| Token | Axis and dependency | `a/light` | `a/dark` | `b/light` | `b/dark` |
| --- | --- | --- | --- | --- | --- |
| `color.bg.surface` | mode; {brand, mode} by form 7.3 | `#ffffff` | `#002255` | `#eeeeee` | `#003322` |
| `color.fg.default` | mode; {mode} | `#111111` | `#ffffff` | `#111111` | `#ffffff` |
| `color.bg.accent` | brand; {brand} | `#0055cc` | `#0055cc` | `#006633` | `#006633` |
| `brand.color.bg.surface.light` | brand (`brand-mode-source`) | `#ffffff` | `#ffffff` | `#eeeeee` | `#eeeeee` |
| `brand.color.bg.surface.dark` | brand (`brand-mode-source`) | `#002255` | `#002255` | `#003322` | `#003322` |

By the D7 classification, `color.blue.*` is exclusive to `a`, `color.green.*` and `color.gray.100` are
exclusive to `b`, and `color.gray.0` and `color.gray.900` are shared.

Sketch of the resulting CSS, for illustration only; the normative form is in
[css-output.md](css-output.md):

```css
/* brand-a.css (a is the provisional default brand, hence also :where(:root)) */
@layer <prefixo>.tokens {
  :where(:root), [data-<prefixo>-brand="a"] {
    --<prefixo>-color-bg-accent: var(--<prefixo>-color-blue-600);
    --<prefixo>-brand-color-bg-surface-light: var(--<prefixo>-color-gray-0);
    --<prefixo>-brand-color-bg-surface-dark: var(--<prefixo>-color-blue-900);
  }
}
/* base.css, resolver block */
@layer <prefixo>.tokens {
  :where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode]) {
    --<prefixo>-color-bg-surface: var(--<prefixo>-_on-light, var(--<prefixo>-brand-color-bg-surface-light))var(--<prefixo>-_on-dark, var(--<prefixo>-brand-color-bg-surface-dark));
    --<prefixo>-color-fg-default: var(--<prefixo>-_on-light, var(--<prefixo>-color-gray-900))var(--<prefixo>-_on-dark, var(--<prefixo>-color-gray-0));
  }
}
```

In the design tool (Figma separator; section 8.9):

| Collection | Variable | Modes and values |
| --- | --- | --- |
| Primitives | `color/blue/600` and the rest | No modes |
| Brand | `color/bg/accent` | `a` → `color/blue/600`; `b` → `color/green/700` |
| Brand | `brand/color/bg/surface/light` | `a` → `color/gray/0`; `b` → `color/gray/100` |
| Brand | `brand/color/bg/surface/dark` | `a` → `color/blue/900`; `b` → `color/green/900` |
| Mode | `color/bg/surface` | `light` → `brand/color/bg/surface/light`; `dark` → `brand/color/bg/surface/dark` |
| Mode | `color/fg/default` | `light` → `color/gray/900`; `dark` → `color/gray/0` |

Switching only the brand of a frame changes `color/bg/accent` and the sources of `color/bg/surface`;
switching only the mode chooses the source. Every variable corresponds to a token, with no auxiliary
variable (FR-028, FR-029).

Changes that validation blocks in this example:

| Change | Code |
| --- | --- |
| In `dark.tokens.json`, `color.bg.surface` → `{color.bg.accent}` | `TKN-AXIS-BOTH` |
| In `dark.tokens.json`, `color.bg.surface` → `{brand.color.bg.surface.light}` | `TKN-BRAND-SOURCE-REF`, with `TKN-AXIS-BOTH` (form) and `TKN-BRAND-SOURCE-FORM` (`dark` orphan) |
| Remove `brand.color.bg.surface.dark` from `b.tokens.json` | `TKN-PARITY-CONTEXT` (and `TKN-ALIAS-UNRESOLVED` in `b/dark`) |
| Define `color.fg.default` also in `a.tokens.json` | `TKN-PATH-DUPLICATE` |
| In `a.tokens.json`, `brand.color.bg.surface.light` → `{color.fg.default}` | `TKN-AXIS-DEPENDENCY` |
| In `component/button.tokens.json`, `color.button.bg.default` → `{brand.color.bg.surface.light}` | `TKN-BRAND-SOURCE-REF` |
| Create the primitive `color.dark.900` (palette with a mode id) | `TKN-NAME-RESERVED` |

## 8. Name grammar (V-06, FR-005, TOK-04)

### 8.1 Segments

Every segment MUST match `^[a-z0-9]+(-[a-z0-9]+)*$`: lowercase ASCII in kebab, without `$`, `{`,
`}`, `.`, `/`, `_` or space (`TKN-NAME-SEGMENT`). This is a subset of the DTCG 2025.10 name restrictions
and ensures that the CSS name and the name in the tool are lossless derivations.

The first segment MUST be a category of the closed TOK-10 list (`color`, `typography`,
`space`, `size`, `radius`, `border`, `shadow`, `motion`, `z-index`, `breakpoint`, `opacity`) or
the reserved group `brand` (`TKN-NAME-CATEGORY`). Under `brand`, the category is the second segment.

### 8.2 Notation

`<x>` is a required segment; `[.<x>]`, optional; `|` separates alternatives. `<comp>` is the component
id; `<part>`, a part of the component; `<prop>`, `<role>`, `<variant>` and `<state>`
come from the vocabularies of section 8.4. The segment order is fixed and the analysis is positional: in
components, after `<comp>`, the next segment is `<part>` if it does not belong to the category's
properties, the variants or the states; otherwise it is `<prop>`. An excess, missing or out-of-vocabulary
segment generates `TKN-NAME-GRAMMAR`.

As in DTCG a token cannot have children, when a prefix has tokens with a state, the default state is
written explicitly (`color.button.bg.default` alongside `color.button.bg.hover`).

### 8.3 Segment order per category

| Category | Primitive | Semantic (public) | Component |
| --- | --- | --- | --- |
| `color` | `color.<palette>.<step>` — `color.blue.600` | `color.<prop>.<role>[.<variant>][.<state>]` — `color.bg.surface`, `color.fg.default`, `color.border.focus`, `color.bg.danger.subtle` | `color.<comp>[.<part>].<prop>[.<variant>][.<state>]` — `color.button.bg.default`, `color.button.bg.primary.hover` |
| `typography` | `typography.<prop>.<step>\|<name>` — `typography.size.300`, `typography.family.sans` | `typography.<prop>.<role>[.<variant>]` — `typography.size.body.md`, `typography.family.code` | `typography.<comp>[.<part>].<prop>[.<variant>][.<state>]` — `typography.button.label.size.md` |
| `space` | `space[.<scale>].<step>` — `space.4`, `space.0-5` | `space.<prop>.<role>` — `space.inset.md`, `space.stack.lg` | `space.<comp>[.<part>].<prop>[.<variant>]` — `space.button.inset.md` |
| `size` | `size[.<scale>].<step>` — `size.40` | `size.<prop>.<role>` — `size.control.md`, `size.icon.sm` | `size.<comp>[.<part>].<prop>[.<variant>][.<state>]` — `size.button.control-height.md` |
| `radius` | `radius[.<scale>].<step>` — `radius.2`, `radius.full` | `radius.<prop>.<role>` — `radius.control.default` | `radius.<comp>[.<part>][.<variant>][.<state>]` — `radius.button.md` |
| `border` | `border.<prop>.<step>\|<name>` — `border.width.1`, `border.style.solid` | `border.<prop>.<role>[.<variant>][.<state>]` — `border.width.default`, `border.stroke.focus` | `border.<comp>[.<part>].<prop>[.<variant>][.<state>]` — `border.input.stroke.invalid` |
| `shadow` | `shadow[.<scale>].<step>` — `shadow.2` | `shadow.<prop>.<role>` — `shadow.elevation.raised` | `shadow.<comp>[.<part>][.<variant>][.<state>]` — `shadow.button.focus-visible` |
| `motion` | `motion.<prop>.<step>\|<name>` — `motion.duration.200`, `motion.easing.standard` | `motion.<prop>.<role>` — `motion.duration.fast` | `motion.<comp>[.<part>].<prop>[.<variant>][.<state>]` — `motion.tooltip.duration.default` |
| `z-index` | `z-index[.<scale>].<step>` — `z-index.100` | `z-index.layer.<role>` — `z-index.layer.modal` | `z-index.<comp>[.<part>][.<variant>]` — `z-index.tooltip` |
| `breakpoint` | `breakpoint[.<scale>].<step>` — `breakpoint.md` | `breakpoint.<prop>.<role>` — `breakpoint.viewport.md` | `breakpoint.<comp>[.<part>][.<variant>]` — `breakpoint.table.md` |
| `opacity` | `opacity[.<scale>].<step>` — `opacity.40` | `opacity.<prop>.<role>` — `opacity.state.disabled`, `opacity.overlay.scrim` | `opacity.<comp>[.<part>][.<variant>][.<state>]` — `opacity.button.disabled` |
| `brand` (reserved) | — | `brand.<semantic path>.<mode>` — `brand.color.bg.surface.light` (section 7.3) | — |

Properties and the `$type` allowed per property (refines the categories table of the data-model;
`TKN-TYPE-CATEGORY`):

| Category | Properties in the semantic | Properties in the component | 2nd segment of the primitive | `$type` |
| --- | --- | --- | --- | --- |
| `color` | `bg`, `fg`, `border` | `bg`, `fg`, `border` | `<palette>` required | `color` |
| `typography` | `text`, `family`, `weight`, `size`, `line-height`, `letter-spacing` | the same | `<prop>` required, except `text` | `text` → `typography`; `family` → `fontFamily`; `weight` → `fontWeight`; `size` and `letter-spacing` → `dimension`; `line-height` → `number` |
| `space` | `inset`, `stack`, `inline` | the same | `<scale>` optional | `dimension` |
| `size` | `control`, `icon`, `container` | `control-height`, `height`, `width`, `min-width`, `icon` | `<scale>` optional | `dimension` |
| `radius` | `control`, `container`, `indicator` | none | `<scale>` optional | `dimension` |
| `border` | `width`, `style`, `stroke` | the same | `<prop>` required: `width` or `style` | `width` → `dimension`; `style` → `strokeStyle`; `stroke` → `border` |
| `shadow` | `elevation`, `focus` | none | `<scale>` optional | `shadow` |
| `motion` | `duration`, `easing`, `transition` | the same | `<prop>` required: `duration` or `easing` | `duration` → `duration`; `easing` → `cubicBezier`; `transition` → `transition` |
| `z-index` | `layer` | none | `<scale>` optional | `number` |
| `breakpoint` | `viewport`, `container` | none | `<scale>` optional | `dimension` |
| `opacity` | `state`, `overlay` | none | `<scale>` optional | `number` |

In categories with no component property, the semantic's property segment designates the element class
the token applies to (for example, `radius.control`), and the component omits it. `brand.*` tokens have
the `$type` of the corresponding public token.

By rule S-04 of [css-output.md](css-output.md) (P-02, decided in the plan), the composite `$type`
`typography` (property `text`) and the `strokeStyle` in object form are not
publishable: validation accepts them in the source, but `tokens-build build` rejects them with the code
`unserializable-value` (exit 1). The coverage of the `typography` category (V-11) uses atomic tokens
(`family`, `weight`, `size`, `line-height`, `letter-spacing`).

Each category MUST have at least one published public semantic token (V-11, FR-006;
`TKN-CATEGORY-COVERAGE`).

### 8.4 Vocabularies (v1)

The vocabularies below are the initial proposal of this contract; they will be revised when the brand
values arrive. The evolution follows section 8.10.

**Size scale (`SZ`, ordered)**: `2xs` < `xs` < `sm` < `md` < `lg` < `xl` < `2xl` < `3xl`.

**States** (versioned vocabulary shared with the contrast manifest and with the FR-021 pairs rule):
`default`, `hover`, `active`, `focus-visible`, `selected`, `invalid`,
`disabled`, `inactive`.

**Variants**: the `SZ` words and `subtle`, `strong`, `inverse`, `primary`, `secondary`,
`tertiary`, `neutral`, `accent`, `success`, `warning`, `danger`, `info`. Variants and states are
disjoint, which makes the positional analysis unambiguous.

**Primitive step** (`<step>`): an integer (`[0-9]+`), a fraction written with a hyphen
(`0-5` = 0.5), a `SZ` word, `full` or `none`. **Primitive name** (`<name>`): free kebab,
only in `typography.family`, `border.style` and `motion.easing`. **Primitive palette and scale**
(`<palette>`, `<scale>`): free kebab that MUST NOT be a semantic property of the category (avoids
`color.bg.500` or `size.control.md` in the primitive layer).

**Roles in the semantic** (`<role>`):

| Category and property | Roles |
| --- | --- |
| `color.bg` | `surface`, `raised`, `sunken`, `overlay`, `inverse`, `accent`, `neutral`, `success`, `warning`, `danger`, `info`, `scrim` |
| `color.fg` | `default`, `muted`, `subtle`, `inverse`, `accent`, `on-accent`, `link`, `success`, `warning`, `danger`, `info` |
| `color.border` | `default`, `muted`, `strong`, `focus`, `inverse`, `accent`, `success`, `warning`, `danger`, `info` |
| `typography.*` | `display`, `heading`, `title`, `body`, `label`, `caption`, `code` |
| `space.*` | `none` and `SZ` |
| `size.control` | `SZ` (control-height scale, section 8.6) |
| `size.icon`, `size.container` | `SZ` |
| `radius.*` | `none`, `default`, `full` and `SZ` |
| `border.*` | `default`, `strong`, `focus`, `divider` |
| `shadow.elevation` | `raised`, `floating`, `overlay`, `modal` |
| `shadow.focus` | `default`, `inset` |
| `motion.duration` | `instant`, `fast`, `moderate`, `slow` |
| `motion.easing` | `standard`, `enter`, `exit`, `emphasized` |
| `motion.transition` | `fade`, `slide`, `scale` |
| `z-index.layer` | `base`, `raised`, `dropdown`, `sticky`, `overlay`, `modal`, `popover`, `toast`, `tooltip` |
| `breakpoint.*` | `SZ` |
| `opacity.state` | `hover`, `active`, `disabled` |
| `opacity.overlay` | `scrim`, `backdrop` |

**Component id** (`<comp>`): kebab, always in the second position, different from `control`. In this
feature there are only synthetic fixture components; the valid list of ids comes
from the usage guidance file, in the components feature. **Part** (`<part>`): a single
kebab segment outside the category's properties, the variants and the states.

### 8.5 Reserved groups, words and segments

| Reserved | Rule | Code |
| --- | --- | --- |
| Root group `brand` | Only in `src/semantic/brand/*.tokens.json`, only in the form `brand.<P>.<mode>` (section 7.3) | `TKN-NAME-RESERVED`, `TKN-BRAND-SOURCE-FORM` |
| Mode ids `light`, `dark` | MUST NOT be a segment of any name, except the last segment of `brand.*`; the mode is an axis, not part of the name | `TKN-NAME-RESERVED` |
| Group `size.control` | Only for the control-height scale, only in the semantic layer (section 8.6) | `TKN-NAME-RESERVED`, `TKN-CONTROL-SCALE` |
| Property `control-height` | Only in a component of the `size` category, as a direct alias of `size.control.<step>` | `TKN-CONTROL-SCALE` |
| Component id `control` | Forbidden | `TKN-NAME-RESERVED` |
| `$root` | Forbidden in any layer | `TKN-ROOT-FORBIDDEN` |
| `$ref` | Only in the primitive layer, only local | `TKN-REF-OUTSIDE-PRIMITIVE`, `TKN-REF-NOT-LOCAL` |
| `$extends` | Only in the braces form | `TKN-EXTENDS-FORM` |
| Private CSS segment `_` | Reserved to the generator (`--<prefixo>-_*`); no token occupies it (section 8.8) | `TKN-NAME-SEGMENT` |

### 8.6 Control-height scale (V-12, FR-007, TOK-13)

1. The members are the semantic tokens `size.control.<step>`, with `<step>` in `SZ` and `$type`
   `dimension`. At least one member MUST exist.
2. The set of steps is the same in all permutations (guaranteed by the parity, section 7.4).
3. In each permutation, all members MUST use the same unit, and the values MUST grow
   strictly in `SZ` order.
4. The scale MAY have any axis; the build report lists the scale resolved per permutation
   (FR-008).
5. A component token with a `control-height` property MUST be a direct alias of a member of the
   scale.
6. The token manifest marks members and `control-height` tokens with `scale: "control-height"`,
   which the FR-023 lint rule consumes ([lint-rules.md](lint-rules.md)).

Violation of any item: `TKN-CONTROL-SCALE`.

### 8.7 CSS name and collision

A token's CSS name is `--<prefixo>-` followed by the path segments joined by `-`:

| Path | CSS name |
| --- | --- |
| `color.bg.surface` | `--<prefixo>-color-bg-surface` |
| `z-index.layer.modal` | `--<prefixo>-z-index-layer-modal` |
| `space.0-5` | `--<prefixo>-space-0-5` |
| `brand.color.bg.surface.light` | `--<prefixo>-brand-color-bg-surface-light` |

The CSS name MUST be unique among all tokens of all layers, including `brand.*`. Since a segment can
contain a hyphen, distinct paths can collide (for example,
`color.bg.surface-raised` and `color.bg.surface.raised`); the collision generates `TKN-NAME-COLLISION`,
pointed at the path that comes last in code-point order and related to the others. No category begins
with `brand`, so `brand.*` tokens do not collide with category tokens.

The value of `<prefixo>` is a build parameter. The assignment of the CSS name and the shape of the
derived ESM modules are in the output contracts.

### 8.8 Private segment

The space `--<prefixo>-_*` is reserved for internal variables of the scope mechanism. Today these are
only the mode toggles `--<prefixo>-_on-light` and `--<prefixo>-_on-dark` (D3). Since no token segment
accepts `_`, no token occupies that space. Private variables are not tokens: they are outside the token
manifest, the ESM, the `.d.ts`, the DOM contract and the API report, and outside the operational
definition of "variable without a value" (spec, Clarifications).

### 8.9 Mapping to the design tool (FR-028, FR-029)

1. **Name**: the variable name in the tool is the token path with the segments joined by the tool's
   separator: `/` in Figma and `.` in Penpot. For another tool, the adapter
   declares the separator when the tool is chosen (ADR-14). The separator MUST be a
   character that does not appear in segments, so never `-`.
2. **Comparison**: the divergence check (FR-030) splits the variable name by the separator and
   compares the arrangement of segments with the token path, with no case, space or
   Unicode normalization; any difference is a divergence of type `name`.
3. **Hierarchy**: the collection (or theme group) is not a segment of the name. It is determined by the
   layer and the axis; a variable in a collection other than the expected one is a divergence of type
   `hierarchy`.

| Layer and axis | Collection | Modes |
| --- | --- | --- |
| `primitive` | Primitives | None |
| `semantic`, axis `invariant` | Invariant semantics | None |
| `semantic`, axis `brand` (includes `brand.*`) | Brand | Brand ids |
| `semantic`, axis `mode` | Mode | `light`, `dark` |
| `component` | Components | None |

4. **Modes**: the mode names in the tool are equal to the ids of the contexts.
5. **No auxiliary variable**: by the form of section 7.3, every brand × mode variation exists as a
   token; every tool variable corresponds to a token, and the sync core does not create a
   variable without a token (D4).

The shape of `sync-manifest.json`, the rename key stored in the tool and the mode limits
per plan are in the sync contract and in ADR-14.

### 8.10 Convention evolution

- Adding a word to a vocabulary is a compatible change: no token changes name.
- Removing or renaming a word used by a published token, or changing the segment order, requires
  renaming published tokens, which is an incompatible change of the public API (GOV-01, Principle X):
  major version, `$deprecated` before the removal and a migration guide (GOV-05, GOV-06).
- Every grammar change begins with an amendment of this contract, approved by the owner of the token
  package (GOV-09); the validator and the convention document follow it (section 11).

## 9. Color values (V-10)

1. The literal color value only exists in the primitive layer, as a DTCG object
   `{ colorSpace, components, alpha?, hex? }`, with `colorSpace` among the 14 spaces of DTCG
   2025.10, `components` numeric or `"none"`, `alpha` from 0 to 1 (default 1) and `hex` optional with
   6 digits.
2. **The components are the source of truth** (D5). The emitted value, which is also the value measured
   by the contrast check, comes from the `toEmittedSrgb()` function of the `@<prefixo>/color` package:
   conversion to sRGB with CSS Color 4 gamut mapping (method `css`, deltaEOK with JND
   0.02, always passed explicitly) and 8-bit quantization per channel,
   `round(clamp(c, 0, 1) × 255)`. The alpha serialization is single and defined in
   [css-output.md](css-output.md) and in ADR-15.
3. **`hex` consistency (V-10)**: if the color is inside the sRGB gamut and carries `hex`, the `hex`
   (compared case-insensitively) MUST equal the 8-bit quantization of the components. The
   divergence generates `TKN-COLOR-HEX-MISMATCH`, with the expected value in the message. The `hex` never
   replaces the components in the emission.
4. **Color outside the sRGB gamut**: under the current assumption, the color is emitted by the mapping of
   item 2; the `hex`, if present, is neither used nor compared. The build records those tokens in the
   build report, with the emitted value, for review by the brand's design owner. Using an
   informed `hex` as the emission policy for an out-of-gamut color would require an amendment of ADR-15.
5. Semantic and component color tokens are always aliases (V-02); colors inside composites
   (border, shadow) follow the same rules.

## 10. Validation and error format

### 10.1 Execution

`tokens-build validate [--json]` runs in the `packages/tokens` directory, called by the root script
`pnpm tokens:validate` (via turbo) and by the required check of the workflow `tokens-ci.yml`.
`tokens-build build` runs the same validation before generating; on an error, it writes nothing in `dist/`
and exits with the same code. The tests call the same function with another source root.

Steps, without a network and with a deterministic result:

1. integrity of the schemas against `SHA256SUMS`;
2. reading of each file with line and column positions (index path → file → line →
   layer, D1) and Ajv validation against `format.json` and `resolver.json`;
3. structural rules of the resolver and the files (sections 4 and 5);
4. analysis by the parser with a local-only loader, resolution of all permutations and the rules of
   sections 6 to 9.

An error in steps 1 to 3 stops the validation at the end of the step, after reporting all its
errors, because the resolved model would not be reliable.

### 10.2 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Valid source. |
| 1 | Violations found (codes of section 10.5 with exit 1). |
| 2 | Use or configuration error (invalid argument, missing source, tampered schema, permutation limit). |
| 3 | Internal error; the trace goes to stderr. |

### 10.3 Human output

Each diagnostic takes one main line, followed by optional indented lines. The main line
follows the common form of [tools-cli.md](tools-cli.md) (section 1.3), suited to problem
matchers; the message begins with the token path and ends with the rules and the requirements:

```text
<file>:<line>:<column>  error  <CODE>  <token-path>: <message> [<V-xx>; <FR-xxx>]
```

```text
packages/tokens/src/semantic/mode/dark.tokens.json:4:13  error  TKN-AXIS-BOTH  color.bg.surface: The token varies by brand and by mode; in "dark" mode the value must be {brand.color.bg.surface.dark}. [V-08; FR-033]
  chain: color.bg.surface -> color.bg.accent (brand axis)
  related: packages/tokens/src/semantic/brand/a.tokens.json:4:13 color.bg.accent
packages/tokens/src/semantic/brand/b.tokens.json:1:1  error  TKN-PARITY-CONTEXT  brand.color.bg.surface.dark: Key missing in brand "b" and present in the others. [V-13; FR-011]
  related: packages/tokens/src/semantic/brand/a.tokens.json:12:11 brand.color.bg.surface.dark
tokens-build validate: 2 errors in 2 files; 4 permutations checked (a/dark, a/light, b/dark, b/light).
```

Output rules:

- paths relative to the workspace root, with the `/` separator, never absolute;
- line and column start at 1; the column counts UTF-16 code units, like LSP-based
  editors;
- location pointed at: the token key for name, type, layer and axis errors; the start of the `$value`
  (or of the subvalue) for value, alias and `hex` errors; the property key for `$ref`,
  `$extends` and `$root`; the corresponding node of `tokens.resolver.json` for resolver errors; the
  context file where the key is missing, at 1:1, for parity; no file for global errors
  (`TKN-CATEGORY-COVERAGE`), in which case the line begins with `packages/tokens/src` without a line and
  column;
- messages in English, with a fixed template per code; code, path, file, line and column are
  stable, and the message text MAY be refined without changing the schema;
- order of the diagnostics: file (no file last), line, column, code and path, all
  by code point. The output has no time or environment data.

### 10.4 JSON output

With `--json`, only the document below goes to stdout. It uses the common envelope and the finding
format of [tools-cli.md](tools-cli.md) (sections 1.3 to 1.5), in canonical JSON. An incompatible change
in the format increments `version`.

```ts
type Mode = "light" | "dark";
type Category =
  | "color" | "typography" | "space" | "size" | "radius" | "border"
  | "shadow" | "motion" | "z-index" | "breakpoint" | "opacity";

interface RelatedLocation {
  file: string;        // relative to the workspace root, separator "/"
  line: number;        // 1-based
  column: number;      // 1-based, UTF-16 units
  token: string | null;
  note: string;
}

// Finding (tools-cli.md, section 1.5); only codes with exit 1
interface TokenFinding {
  code: TokenValidationCode;        // section 10.5
  rule: string;                     // main data-model rule, e.g. "V-08"
  severity: "error";                // all codes of this contract block
  message: string;
  file?: string;                    // absent on a global error
  line?: number;                    // 1-based
  column?: number;                  // 1-based, UTF-16 units
  token?: string;                   // path with ".", e.g. "color.bg.surface"
  context?: { brand: string; mode: Mode }; // present when the finding occurs in a single permutation
  data: {
    rules: readonly string[];        // e.g. ["V-08"]
    requirements: readonly string[]; // e.g. ["FR-033", "TOK-09"]
    permutations: readonly { brand: string; mode: Mode }[]; // empty: independent of permutation
    chain?: readonly string[];       // cycle, layer direction, axis dependency
    related?: readonly RelatedLocation[];
  };
}

// Error (tools-cli.md, section 1.5); exits 2 and 3
interface CliError {
  code: "USAGE" | "TKN-CONFIG-INPUT" | "TKN-CONFIG-SCHEMA-HASH" | "TKN-CONFIG-PERMUTATIONS" | "TKN-INTERNAL";
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

interface ValidateOutput {
  format: "<prefixo>.cli-result";
  version: 1;
  tool: "tokens-build";
  command: "validate";
  ok: boolean;
  exitCode: 0 | 1 | 2 | 3;
  summary: {
    errors: number;
    files: number;
    tokens: { primitive: number; semantic: number; component: number };
    permutations: readonly string[];               // ["a/dark", "a/light", ...]
    byCategory?: Readonly<Record<Category, number>>; // present when ok
    controlHeightScale?: Readonly<Record<string, readonly { step: string; value: string }[]>>;
  };
  findings: readonly TokenFinding[];
  errors: readonly CliError[];
}
```

When `ok` is true, `byCategory` and `controlHeightScale` (keyed by `<brand>/<mode>`)
carry the same values that the build writes in the build report at `dist/meta/report.json`
(US1, scenario 4; FR-008).

### 10.5 Validation codes

| Code | What it blocks | Rule | Requirements | Exit |
| --- | --- | --- | --- | --- |
| `TKN-CONFIG-INPUT` | Missing source or `tokens.resolver.json` (an invalid argument or flag uses the common code `USAGE`, [tools-cli.md](tools-cli.md), section 1.6) | — | — | 2 |
| `TKN-CONFIG-SCHEMA-HASH` | A schema copy with a sha256 different from `SHA256SUMS` | V-01 | FR-002, TOK-01 | 2 |
| `TKN-CONFIG-PERMUTATIONS` | A permutation list undefined or different from brands × modes | V-13 | FR-010, FR-011 | 2 |
| `TKN-JSON-PARSE` | Invalid JSON, a BOM or a duplicate key | V-01 | FR-002 | 1 |
| `TKN-SCHEMA` | Violation of `format.json` or `resolver.json` | V-01 | FR-002, TOK-01 | 1 |
| `TKN-RESOLVER-STRUCTURE` | Modifiers, contexts, `default`, sets or order outside the canonical form | V-07 | FR-009, FR-010, TOK-08 | 1 |
| `TKN-RESOLVER-REF` | A resolver `$ref` that is non-local, outside `src/` or nonexistent | V-01 | FR-002 | 1 |
| `TKN-FILE-LOCATION` | A token file outside the structure; a file name different from the context or component id | V-07 | FR-001, FR-009 | 1 |
| `TKN-FILE-UNREFERENCED` | A token file in `src/` not referenced by the resolver | — | FR-001, TOK-01 | 1 |
| `TKN-PATH-DUPLICATE` | A path defined in more than one place (section 7.1) | V-07, V-09 | FR-011, TOK-09 | 1 |
| `TKN-LITERAL-OUTSIDE-PRIMITIVE` | A literal, or a composite literal subvalue, outside the primitive layer | V-02 | FR-003, TOK-02 | 1 |
| `TKN-ALIAS-UNRESOLVED` | An alias to a nonexistent token in some permutation | V-03 | FR-004, TOK-02 | 1 |
| `TKN-ALIAS-CYCLE` | An alias cycle (with the chain) | V-03 | FR-004, TOK-02 | 1 |
| `TKN-ALIAS-TYPE` | An alias target with a type different from the token | V-01, V-03 | FR-002, FR-004 | 1 |
| `TKN-LAYER-DIRECTION` | A reference to a layer above | V-04 | FR-004, TOK-02 | 1 |
| `TKN-REF-OUTSIDE-PRIMITIVE` | A `$ref` outside the primitive layer | V-05 | FR-003, FR-004 | 1 |
| `TKN-REF-NOT-LOCAL` | A `$ref` remote or outside `src/primitive/` | V-05 | FR-002 | 1 |
| `TKN-ROOT-FORBIDDEN` | Use of `$root` | V-05 | FR-005 | 1 |
| `TKN-EXTENDS-FORM` | `$extends` outside the braces form or pointing to a token | V-05 | FR-005 | 1 |
| `TKN-TYPE-MISSING` | `$type` not declared on the token nor on an ancestor group | Token.type (data-model) | FR-002, FR-005 | 1 |
| `TKN-TYPE-CATEGORY` | `$type` incompatible with the category or the property | Category (data-model) | FR-005, FR-006 | 1 |
| `TKN-NAME-SEGMENT` | A segment outside `^[a-z0-9]+(-[a-z0-9]+)*$` | V-06 | FR-005, TOK-04 | 1 |
| `TKN-NAME-CATEGORY` | A first segment outside the categories and `brand` | V-06 | FR-005, FR-006, TOK-04, TOK-10 | 1 |
| `TKN-NAME-GRAMMAR` | Segment order, count or vocabulary outside section 8.3 | V-06 | FR-005, TOK-04 | 1 |
| `TKN-NAME-RESERVED` | A reserved group, word or id out of place (section 8.5) | V-06, V-08, V-12 | FR-005, FR-007, FR-033 | 1 |
| `TKN-NAME-COLLISION` | Two paths with the same CSS name | V-06 | FR-005, FR-015, TOK-05 | 1 |
| `TKN-AXIS-DEPENDENCY` | An invariant with an axis dependency; a brand token depending on mode | V-07 | FR-011, FR-012 | 1 |
| `TKN-AXIS-BOTH` | Variation on both axes outside the form of section 7.3 | V-08 | FR-033, TOK-09, DSN-04, DSN-05 | 1 |
| `TKN-BRAND-SOURCE-FORM` | A `brand.*` token with an invalid name, location or correspondence, or orphan | V-08 | FR-033 | 1 |
| `TKN-BRAND-SOURCE-REF` | A `brand.*` token referenced by someone other than the corresponding mode token | V-08 | FR-033, FR-022 | 1 |
| `TKN-COLOR-HEX-MISMATCH` | A `hex` different from the quantization of the components in an in-gamut color | V-10 | FR-015, FR-020 | 1 |
| `TKN-CATEGORY-COVERAGE` | A category with no public semantic token | V-11 | FR-006, TOK-10 | 1 |
| `TKN-CONTROL-SCALE` | An invalid control-height scale or a `control-height` outside it | V-12 | FR-007, TOK-13 | 1 |
| `TKN-PARITY-CONTEXT` | A key missing or extra in a brand or mode context | V-13 | FR-011, TOK-09 | 1 |
| `TKN-PARITY-PERMUTATION` | A set of semantic keys different between permutations | V-13 | FR-011, TOK-09, SC-004 | 1 |
| `TKN-INTERNAL` | An unexpected failure of the validator | — | — | 3 |

Rules V-14 to V-16 (contrast pairs) are checked by `tokens-contrast check`, with their own
codes in the contrast contract. FR-001 outside `src/` is checked by
`repo-checks scan-tokens`.

`TokenValidationCode` is the literal union of the codes of this table with exit 1, which go in
`findings`; the codes with exit 2 or 3 go in `errors` (section 10.4). Adding a code is a compatible
change; removing or renaming one increments `version`.

### 10.6 Fixtures

In `tools/tokens-build`, each code with exit 1 has at least one invalid fixture, and the valid fixtures
produce zero diagnostics. The tests compare multisets of
`{file, line, column, code}`: 100% of the expected errors and zero false positives (SC-009, QA-02).
Required fixtures include a violation planted only in the brand `b` file and another only in the `dark`
mode, which prove the validation over all permutations (D1). The official DTCG
2025.10 test suite and the golden outputs are a gate on each parser update (D1). The fixtures use only
synthetic data (QA-15) and appear in `quality/scan-allowlist.json` with a justification.

## 11. Convention document

`docs/tokens/convencao-de-nomes.md` is the naming convention document required by TOK-04
("the convention is published in the documentation"). It is derived from this contract: sections 8.1 to
8.10, layer and axis rules of sections 6 and 7 that affect names, derivation of the CSS name, private
segment, mapping to the design tool and examples.

- The preferred form is generation by `@<prefixo>/tokens-build` from the same grammar and vocabulary
  table that the validator uses, which keeps a single source per fact (Principle I). As a
  generated and versioned file, it is checked by `pnpm check:drift`.
- While the generator does not exist, the document MAY be kept in sync with this contract by
  review, with a check that compares the document's vocabularies with the validator's. A divergence
  between the document and the validator is a defect.
- A convention change begins with an amendment of this contract (section 8.10), never with the document.
- Publishing on the documentation site is the job of the documentation feature (TOK-04, publishing
  part; spec, Dependencies). This feature delivers the document and the validation that rejects
  names outside the pattern (FR-005).

## 12. Alignment notes

1. **Resolver file name**: `packages/tokens/src/tokens.resolver.json`, prefix-neutral
   (data-model and research aligned).
2. **Brand-exclusive primitives**: brand files are of the semantic layer and do not accept a
   literal (V-02), so all primitives sit in the shared set `primitive` and the build derives
   the exclusivity from the references (D7; data-model, Brand). Adding a brand still changes only
   token files (FR-009).
3. **Raw private variables**: the raw CSS-scopes report proposed private variables
   `--<prefixo>-_l-*`, `_d-*` and `_v-*`. research.md (D3, D7) replaced them with public
   brand-axis tokens and the reserved group `brand.`; only the mode toggles are private.
4. **Auxiliary variables in the tool**: the raw sync report allowed auxiliary variables
   as a declared exception. There is no exception: the form of section 7.3 (FR-033) eliminates the
   need.
5. **`hex` priority**: the raw color report made the `hex` prevail. The components prevail,
   with a consistency check (D5, V-10).
6. **Vocabularies**: no requirement fixes the words of section 8.4; they are a proposal of this
   contract, subject to owner approval and revisable when the brand values arrive.

## 13. Traceability

| Requirement | Sections | Main codes |
| --- | --- | --- |
| FR-001 (TOK-01) | 4 | `TKN-FILE-LOCATION`, `TKN-FILE-UNREFERENCED`; scan in `repo-checks scan-tokens` |
| FR-002 (TOK-01) | 4, 5, 10 | `TKN-SCHEMA`, `TKN-JSON-PARSE`, `TKN-CONFIG-SCHEMA-HASH` |
| FR-003, FR-004 (TOK-02) | 6 | `TKN-LITERAL-OUTSIDE-PRIMITIVE`, `TKN-ALIAS-*`, `TKN-LAYER-DIRECTION`, `TKN-REF-*` |
| FR-005 (TOK-04) | 8, 11 | `TKN-NAME-*`, `TKN-ROOT-FORBIDDEN`, `TKN-EXTENDS-FORM` |
| FR-006 (TOK-10) | 8.3 | `TKN-CATEGORY-COVERAGE`, `TKN-TYPE-CATEGORY` |
| FR-007 (TOK-13) | 8.6 | `TKN-CONTROL-SCALE` |
| FR-009, FR-010 (TOK-07, TOK-08) | 5 | `TKN-RESOLVER-STRUCTURE`, `TKN-CONFIG-PERMUTATIONS` |
| FR-011 (TOK-09) | 7.1, 7.4 | `TKN-PARITY-*`, `TKN-PATH-DUPLICATE` |
| FR-012 to FR-014 (TOK-14, ENG-06) | 7.2 (AX-2), 8.8 | `TKN-AXIS-DEPENDENCY` |
| FR-015 (TOK-05) | 8.7, 9 | `TKN-NAME-COLLISION`, `TKN-COLOR-HEX-MISMATCH` |
| FR-028, FR-029 (DSN-04, DSN-05) | 7.3, 8.9 | `TKN-AXIS-BOTH`, `TKN-BRAND-SOURCE-*` |
| FR-033 | 7.3 | `TKN-AXIS-BOTH`, `TKN-BRAND-SOURCE-FORM`, `TKN-BRAND-SOURCE-REF` |
