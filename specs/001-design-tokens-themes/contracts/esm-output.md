# Contract: ESM modules and token types

**Feature**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) (D1, D6, D7) |
**Model**: [data-model.md](../data-model.md) | **Date**: 2026-10-21

Source decisions: [ADR-11](../../../docs/adr/ADR-11-pipeline-build-tokens.md) (build pipeline)
and [ADR-16](../../../docs/adr/ADR-16-lint-tokens-e-testes.md) (token lint and test stack),
both with status Proposed. Details: [research/token-build.md](../research/token-build.md) and
[research/lint-test.md](../research/lint-test.md); where they diverge from [research.md](../research.md),
research.md prevails.

`<prefixo>` is the project prefix marker (TODO(PREFIXO) of constitution v1.0.0), used literally in the
snippets below. Brands `a` and `b` are the synthetic fixture brands (QA-15). The CSS, the value
serialization and the scope mechanism are in [css-output.md](css-output.md).

## 1. Scope and traceability

This contract fixes the JavaScript entries of the `@<prefixo>/tokens` package, the shape of the
exports, the type declarations, what is left out, the `package.json` fields, the tarball content, the
type tests and the API report.

| Requirement | Where it is met |
| --- | --- |
| FR-016, TOK-06 | §2 to §5: `var(--<prefixo>-*)` references of all tokens and, in a separate entry, maps per brand and mode, with `.d.ts`; §10: a nonexistent name produces a type error |
| ENG-04 | §8: ESM with no side effects; `sideEffects` lists only CSS |
| ENG-05 | §8 and §10: types published with the code, `publint` and a strict consumer compiling each entry |
| ENG-17, ENG-22 | §8 and §9: tarball allowlist, no install script, `license` field and third-party notices |
| QA-08 | §10: type tests with negative cases; §11: versioned API report checked by drift |
| GOV-01 | §11: input to the public API check |
| Principle I | §4: brands, modes and attribute names exported as generated constants, without a hand copy in the consumers |

## 2. Entries

| Subpath | File | Types | Content |
| --- | --- | --- | --- |
| `.` | `dist/esm/index.js` | `dist/esm/index.d.ts` | `tokens` references object, theme constants and types `TokenName`, `Brand`, `Mode`, `TokenRef`, `TokenRefs` |
| `./values` | `dist/esm/values.js` | `dist/esm/values.d.ts` | `values` map per brand × mode × token and type `TokenValues` |

- The package is ESM only (`"type": "module"`). There is no `require` condition nor a CommonJS build.
- The two entries are independent at runtime: `values.js` does not import `index.js`, and neither
  imports CSS. The `.d.ts` of `./values` imports types from `./index.js` at the type level only.
- There is no default export (`default`); only named exports.
- `index.js` is small and serves apps; `values.js` grows with brands × modes × tokens and is intended
  for tests, SSR without a DOM, tools and contexts outside the CSS (for example, canvas). To style the
  DOM, use CSS or the references (css-output.md, O-06).

## 3. Export shape: decision

**Decision**: the `.` entry exports a frozen `tokens` object, indexed by the token path, with the
literal value `var(--<prefixo>-…)`, plus the `TokenName` union of the keys. There is no one named
export per token.

Reasons:

1. **Identity with the source and with the design tool.** The key is the exact DTCG path
   (`color.bg.surface`), the same as the convention (TOK-04), the manifest, the API report and, with
   another separator, the design tool (DSN-04). Named exports would require converting paths with `.`,
   `-` and segments starting with a digit into JavaScript identifiers, which creates a second naming
   convention and collisions: with camelCase, `space.1-5` and `space.15` would both become `space15`.
2. **A single type for token names.** `TokenName` is exactly `keyof TokenRefs`; it types app props and
   functions that receive token names, and `Object.keys(tokens)` allows iterating in docs and tests.
3. **Small, stable API surface.** One export and one union, instead of hundreds of exports in the
   GOV-01 report.
4. **Immutability consistent with the types.** `Object.freeze` at runtime and `readonly` properties in
   the `.d.ts`.

Accepted cost: there is no per-token tree-shaking. Whoever imports `tokens` receives all the references
(about 45 bytes per token before compression; to be measured against the QA-07 budget, whose value is
pending in the thresholds assumption). Mitigations: the `/*#__PURE__*/` annotation lets the bundler
remove the whole object when it is unused; apps that do not need JavaScript use only the CSS; the
per-component tree-shaking of ENG-04 applies to the UI packages, and the references module is a single
unit.

Rejected alternatives:

- **One named export per token**: collisions and a second naming convention (reason 1), hundreds of
  entries in the API report.
- **Modules per category** (`./color`, `./space`, etc.): more entries in the exports map and the
  report, with no type gain; a new category would become a new entry.
- **`token(name)` function or `Proxy`**: runtime code with no type advantage over the literal; the
  `Proxy` further prevents static analysis.
- **TypeScript `enum`**: generates TypeScript's own runtime, is not idiomatic ESM and, in the
  `const enum` form, conflicts with `isolatedModules` and `verbatimModuleSyntax`.
- **Literal types in the `values` values**: each color adjustment would change the `.d.ts` and the API
  report, turning a visual change into an API change; `string` is enough.

## 4. Entry `.`

| Export | Type | Content |
| --- | --- | --- |
| `tokens` | `TokenRefs` | Frozen object: token path → `"var(--<prefixo>-<segments joined by ->)"` |
| `TokenName` | type | Literal union of all published token paths |
| `TokenRefs` | type | Object with one `readonly` property per token, of literal type `"var(--<prefixo>-…)"` |
| `TokenRef` | type | `TokenRefs[TokenName]`: union of all references |
| `Brand` | type | Union of the brand ids (contexts of the `brand` modifier) |
| `Mode` | type | `"light" \| "dark"` (contexts of the `mode` modifier) |
| `brands` | `readonly [ … ]` | Frozen tuple of the brand ids, by code point |
| `modes` | `readonly [ … ]` | Frozen tuple of the modes, in canonical order (default mode first) |
| `defaultBrand` | literal of `Brand` | Default brand (assumption: designated by the requester, CMP-24; `a` in the fixtures) |
| `defaultMode` | literal of `Mode` | Default mode (spec assumption: `light`) |
| `attributes` | frozen object | `{ brand: "data-<prefixo>-brand", mode: "data-<prefixo>-mode" }` |

`TokenName` includes all published tokens: primitives, public semantics, brand-mode sources
(`brand.…`) and component. The consumption rules (component style only with public semantics and
component tokens, TOK-03) are enforced by the style lint, not by the types; a reference to a brand-mode
source ignores the mode, and a reference to a brand-exclusive primitive only resolves in that brand's
scope (css-output.md, §15).

Sketch of `dist/esm/index.js` (shape, not full content):

```js
/* @<prefixo>/tokens: generated file, do not edit. */
export const attributes = /*#__PURE__*/ Object.freeze({
  "brand": "data-<prefixo>-brand",
  "mode": "data-<prefixo>-mode"
});
export const brands = /*#__PURE__*/ Object.freeze(["a", "b"]);
export const defaultBrand = "a";
export const defaultMode = "light";
export const modes = /*#__PURE__*/ Object.freeze(["light", "dark"]);
export const tokens = /*#__PURE__*/ Object.freeze({
  "brand.color.bg.surface.dark": "var(--<prefixo>-brand-color-bg-surface-dark)",
  "color.bg.surface": "var(--<prefixo>-color-bg-surface)",
  "z-index.layer.modal": "var(--<prefixo>-z-index-layer-modal)"
});
```

Sketch of `dist/esm/index.d.ts`:

```ts
/* @<prefixo>/tokens: generated file, do not edit. */
export type Brand = "a" | "b";
export type Mode = "light" | "dark";
export type TokenName =
  | "brand.color.bg.surface.dark"
  | "color.bg.surface"
  | "z-index.layer.modal";
export type TokenRefs = {
  readonly "brand.color.bg.surface.dark": "var(--<prefixo>-brand-color-bg-surface-dark)";
  /** Main content surface. */
  readonly "color.bg.surface": "var(--<prefixo>-color-bg-surface)";
  readonly "z-index.layer.modal": "var(--<prefixo>-z-index-layer-modal)";
};
export type TokenRef = TokenRefs[TokenName];
export declare const attributes: {
  readonly brand: "data-<prefixo>-brand";
  readonly mode: "data-<prefixo>-mode";
};
export declare const brands: readonly ["a", "b"];
export declare const defaultBrand: "a";
export declare const defaultMode: "light";
export declare const modes: readonly ["light", "dark"];
export declare const tokens: TokenRefs;
```

## 5. Entry `./values`

`values[brand][mode][token]` is the final value of the token in that permutation, resolved down to the
literal and serialized as in the CSS (css-output.md, §11), without `var()`. It equals the computed
value of the custom property in the browser for that effective brand and mode (css-output.md, BR-18).

- Every `(brand, mode)` contains all tokens of `TokenName`, so the type `Record<TokenName, string>` is
  exact. This includes the primitives exclusive to another brand, which are invariant and have the same
  value in every permutation (D7); which CSS file each one is declared in is in the manifest's
  `placement` field.
- Brand-mode sources carry the brand's value, identical in the two modes.

Sketch of `dist/esm/values.js`:

```js
/* @<prefixo>/tokens: generated file, do not edit. */
export const values = /*#__PURE__*/ Object.freeze({
  "a": /*#__PURE__*/ Object.freeze({
    "light": /*#__PURE__*/ Object.freeze({
      "color.bg.surface": "#ffffff",
      "color.button.bg.default": "#1f5fd1"
    }),
    "dark": /*#__PURE__*/ Object.freeze({ /* … */ })
  }),
  "b": /*#__PURE__*/ Object.freeze({ /* … */ })
});
```

Sketch of `dist/esm/values.d.ts`:

```ts
/* @<prefixo>/tokens: generated file, do not edit. */
import type { Brand, Mode, TokenName } from "./index.js";
export type { Brand, Mode, TokenName } from "./index.js";
export type TokenValues = Readonly<Record<Brand, Readonly<Record<Mode, Readonly<Record<TokenName, string>>>>>>;
export declare const values: TokenValues;
```

`TokenValues` is the type `Record<Brand, Record<Mode, Record<TokenName, string>>>` with `Readonly` at
each level; `readonly` properties remain assignable to the type without `Readonly` for reading.

## 6. What is left out

- Private toggles `--<prefixo>-_on-*` and any name with the segment `_` (css-output.md, T-05).
- `$extensions`, the source location in the source, the alias chain, layer, axis and role: they stay in
  the manifest (`./meta/tokens.manifest.json`), for tools.
- `$description` appears only as a JSDoc comment in the `.d.ts`, with no type effect.
- Resolution runtime (for example, `resolver.apply()`), functions, classes and `Proxy`.
- Importing CSS from the ESM; the CSS is imported by the app (css-output.md, U-01).
- Literal-typed values in the `values` map (§3).

## 7. Generation and determinism rules

- **E-01** The modules are generated by `tokens-build build` from the same resolved model that generates
  the CSS, and never hand-edited (FR-015, FR-016).
- **E-02** ES2015 module syntax, with no later features: only `export const`, literals and
  `Object.freeze`. No `import` at runtime.
- **E-03** Token and brand keys ordered by code point; modes in canonical order (css-output.md, RS-03).
  Every token path contains `.`, so no key is a numeric index and the enumeration order is the insertion
  order.
- **E-04** Strings written with `JSON.stringify` (deterministic escapes), keys always in double quotes,
  two-space indentation, LF line endings, a final line break, a fixed header with no date or version, no
  source map.
- **E-05** Every call to `Object.freeze` carries `/*#__PURE__*/`; `values` is frozen at every level.
- **E-06** `tokens[N]` is `"var(" + cssName(N) + ")"`, with `cssName` per css-output.md, DEP-04.
- **E-07** In the `.d.ts`, each property of `TokenRefs` carries JSDoc with the token's `$description`,
  when present (with `*/` escaped), and `@deprecated` with the message of `$deprecated`, when the token
  is deprecated.
- **E-08** The build's `dist-parity` check confirms that the keys of `tokens`, the `TokenName` union,
  the keys of each map in `values`, the names declared in the CSS, the manifest and the API report list
  the same set of tokens; the `private-segment-leak` check
  ([tools-cli.md](tools-cli.md), §2.2) confirms that no name with the segment `_` appears in the ESM,
  the `.d.ts` or the API report. A divergence exits with code 1.
- **E-09** The byte-for-byte determinism of the four files is covered by `pnpm check:determinism`
  (css-output.md, D-09).

## 8. `package.json` of the published package

```json
{
  "name": "@<prefixo>/tokens",
  "version": "<single version of the published packages>",
  "type": "module",
  "license": "UNLICENSED",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "default": "./dist/esm/index.js"
    },
    "./values": {
      "types": "./dist/esm/values.d.ts",
      "default": "./dist/esm/values.js"
    },
    "./css/base.css": "./dist/css/base.css",
    "./css/brand-*.css": "./dist/css/brand-*.css",
    "./meta/*": "./dist/meta/*"
  },
  "files": ["dist/css/", "dist/esm/", "dist/meta/", "THIRD-PARTY-NOTICES.md"],
  "engines": { "node": ">=22" },
  "scripts": {
    "tokens:build": "tokens-build build",
    "tokens:validate": "tokens-build validate"
  },
  "devDependencies": {
    "@<prefixo>/color": "workspace:*",
    "@<prefixo>/tokens-build": "workspace:*"
  }
}
```

- **PK-01** `exports` is the only resolution map: no `main`, `module` nor top-level `types`. In each
  JavaScript entry, `types` comes before `default`. The `node10` resolution, which ignores `exports`, is
  not supported (removed in TypeScript 7).
- **PK-02** `./css/brand-*.css` uses a subpath pattern so that a new brand does not change the
  `package.json` (FR-009, SC-005). `./meta/*` exposes the manifests and the build report to tools; apps
  do not import them.
- **PK-03** `sideEffects` is exactly `["**/*.css"]` (ENG-04): the ESM modules have no side effect, and
  the CSS is not dropped in the production build.
- **PK-04** No `dependencies`, `peerDependencies`, `optionalDependencies` nor `bundledDependencies`. The
  `devDependencies` follow the allowed edges of the layers file (tokens →(dev) `tools/tokens-build`,
  `tools/color`), and the `workspace:` protocols are rewritten by `pnpm pack`.
- **PK-05** No install lifecycle script (`preinstall`, `install`, `postinstall`, `prepare`) (ENG-17).
  The `tokens:build` and `tokens:validate` scripts are the Turborepo tasks triggered from the root
  (`pnpm tokens:build`, `pnpm tokens:validate`) and referenced in the graph as
  `@<prefixo>/tokens#tokens:build` ([tools-cli.md](tools-cli.md), section 7). The name `build` is
  reserved for compiling the tool packages, which those tasks depend on (`^build`).
- **PK-06** `license` follows the current assumption of ENG-22: the requester's proprietary license,
  with no external redistribution (`UNLICENSED` as a marker).
- **PK-07** `engines.node` tracks the floor of the current assumption "Node on LTS" (Node 22 LTS, D2);
  changing the floor follows ENG-08. The value of `version` follows the single-version assumption
  (GOV-01).

## 9. Tarball content (ENG-17 allowlist)

The tarball produced by `pnpm pack` contains exactly:

| Path in the tarball | Source |
| --- | --- |
| `package/package.json` | Manifest, with `workspace:` rewritten |
| `package/README.md` | Purpose, installation, minimal usage and a link to the documentation (DOC-08) |
| `package/THIRD-PARTY-NOTICES.md` | Third-party notices (ENG-22; provisional name). The generated content includes no third-party code or asset; the DTCG schemas are outside the tarball |
| `package/dist/css/base.css` | css-output.md |
| `package/dist/css/brand-<id>.css` | Exactly one per brand of the resolver |
| `package/dist/esm/index.js`, `index.d.ts` | §4 |
| `package/dist/esm/values.js`, `values.d.ts` | §5 |
| `package/dist/meta/tokens.manifest.json`, `sync-manifest.json`, `report.json`, `report.md` | Build manifests and report |

Nothing else: no `src/`, `contrast/`, `schemas/`, `api/`, tests, configurations, source maps or
`.tsbuildinfo` files. The ENG-17 check is part of the CI and publishing feature; until it exists, the
`@<prefixo>/types-consumer` project checks in the tarball the presence of the four ESM and `.d.ts`
files (FR-016), the absence of any file outside this table and the absence of install scripts.

## 10. Type tests

### 10.1 Consumer project

`@<prefixo>/types-consumer` (`tests/types-consumer`, private, layer `apps`) installs the packaged
tarball, never the source code (QA-06, Principle VII): third-party dependencies via the frozen
lockfile, the tarball with scripts disabled and a check that the installed files match the tarball. Test
files: `src/refs.ts` and `src/values.ts` (positive) and `src/negative.ts` (negative). Run by
`pnpm test:types`.

Matrix: TypeScript 6.0.x and 7.0.x × resolution `bundler` and `nodenext`, four runs of `tsc --noEmit`,
all required. TS 7.0.x via the `typescript` package (binary `tsc`) and TS 6.0.x via
`@typescript/typescript6` (binary `tsc6`), at exact catalog versions. TS 6.0 is the provisional value of
`<version>` of the minimum-versions assumption (ENG-08, D2). The test uses only `tsc` diagnostics,
because TS 7.0 has no programmatic API.

### 10.2 `tsc` configuration

`tsconfig.bundler.json`:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "es2022",
    "lib": ["es2022"],
    "types": [],
    "module": "preserve",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedSideEffectImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": false
  },
  "include": ["src"]
}
```

`tsconfig.nodenext.json` is the same, with `"module": "nodenext"` and `"moduleResolution": "nodenext"`;
the project's `package.json` declares `"type": "module"`. `skipLibCheck: false` is required, so that the
package's `.d.ts` are checked in strict mode.

### 10.3 Positive cases

Written with `expect-type`, without depending on specific brand or token names, so that they hold for
the synthetic brands and for the real brands when they arrive.

```ts
import { expectTypeOf } from "expect-type";
import {
  attributes, brands, defaultBrand, defaultMode, modes, tokens,
  type Brand, type Mode, type TokenName, type TokenRef, type TokenRefs,
} from "@<prefixo>/tokens";
import { values, type TokenValues } from "@<prefixo>/tokens/values";

type DotToDash<S extends string> = S extends `${infer H}.${infer T}` ? `${H}-${DotToDash<T>}` : S;
declare const n: TokenName;
```

| Case | Assertion |
| --- | --- |
| P-01 | `expectTypeOf<TokenName>().not.toBeAny()` and `.not.toEqualTypeOf<string>()`: union of literals |
| P-02 | `expectTypeOf<TokenName>().toEqualTypeOf<keyof TokenRefs>()` and `expectTypeOf(tokens).toEqualTypeOf<TokenRefs>()` |
| P-03 | ``expectTypeOf<TokenRefs>().toEqualTypeOf<{ readonly [N in TokenName]: `var(--<prefixo>-${DotToDash<N>})` }>()``: each reference is the literal derived from the path |
| P-04 | `Brand` equal to `(typeof brands)[number]`; `Mode` equal to `"light" \| "dark"` and to `(typeof modes)[number]`; `defaultBrand` extends `Brand`; `defaultMode` equal to `"light"` |
| P-05 | `expectTypeOf(values).toEqualTypeOf<TokenValues>()`; `TokenValues` equal to `Readonly<Record<Brand, Readonly<Record<Mode, Readonly<Record<TokenName, string>>>>>>`; `values[defaultBrand][defaultMode][n]` is `string`, without `undefined`, even with `noUncheckedIndexedAccess` |
| P-06 | `tokens[n]` is `TokenRef`; `TokenRef` extends `` `var(--<prefixo>-${string})` `` |
| P-07 | `attributes` equal to `{ readonly brand: "data-<prefixo>-brand"; readonly mode: "data-<prefixo>-mode" }` |
| P-08 | No export is `any` (`.not.toBeAny()` on each one), and a text search in the tarball's `.d.ts` finds no `any` (Principle VI) |
| P-09 | The two entries, including the type-only import of `@<prefixo>/tokens/values`, compile in the four runs |

### 10.4 Negative cases

Each case uses `@ts-expect-error`. If a case stops failing, the unused directive produces the error
TS2578 and breaks the test, as QA-08 requires. The names used can never be valid: the first segment
`zzz` is not a category, and `__invalid__` is not a kebab id.

```ts
// N-01: nonexistent token in the references
// @ts-expect-error
void tokens["zzz.does-not-exist"];

// N-02: an arbitrary string is not TokenName
// @ts-expect-error
const name: TokenName = "anything";

// N-03: nonexistent brand
// @ts-expect-error
void values["__invalid__"];

// N-04: nonexistent mode
// @ts-expect-error
void values[defaultBrand]["sepia"];

// N-05: nonexistent token in the values map
// @ts-expect-error
void values[defaultBrand][defaultMode]["zzz.does-not-exist"];

// N-06: references are read-only
// @ts-expect-error
tokens[n] = tokens[n];

// N-07: the values map is read-only
// @ts-expect-error
values[defaultBrand][defaultMode][n] = "#000000";

// N-08: a private toggle is not a public token
// @ts-expect-error
const priv: TokenName = "_on-light";
```

In a separate file, because they are import declarations:

```ts
// N-09: `values` is not exported by the "." entry (separate entries)
// @ts-expect-error
import { values as v } from "@<prefixo>/tokens";

// N-10: internal path outside the exports map
// @ts-expect-error
import { tokens as t } from "@<prefixo>/tokens/dist/esm/index.js";
```

### 10.5 Package checks

- `publint` over the tarball, with no errors or warnings (ENG-05).
- Check of the tarball content (§9).
- Importing the CSS files is not part of the type test: the app imports them via the bundler, and their
  exports map is checked by `publint` and by the example app (css-output.md, §16).

## 11. API report (`api/tokens.api.json`)

File versioned at `packages/tokens/api/tokens.api.json`, generated by `pnpm tokens:build` from the same
model as the modules (not from analysis of the `.d.ts`: TS 7.0 has no API and the API Extractor embeds
an old version of TypeScript). `pnpm check:drift` regenerates it and requires `git diff --exit-code`; a
PR that changes the surface without updating the report fails (QA-08). The GOV-01 public API check, of
the CI and publishing feature, compares the report with that of the last published version and blocks a
break without a major bump.

### 11.1 Shape

Canonical JSON of [tools-cli.md](tools-cli.md), §1.4 (keys by code point at every level, two-space
indentation, LF, final line break), identified by the `format` and `version` fields. `entries` follows
the order of the `exports` map of the `package.json`; exports and tokens are ordered by `name` (code
point); `brands` by code point; `modes` in canonical order.

```json
{
  "css": {
    "layer": "<prefixo>.tokens",
    "layerOrder": ["<prefixo>.tokens"]
  },
  "entries": [
    {
      "exports": [
        { "kind": "type", "name": "Brand" },
        { "kind": "type", "name": "Mode" },
        { "kind": "type", "name": "TokenName" },
        { "kind": "type", "name": "TokenRef" },
        { "kind": "type", "name": "TokenRefs" },
        { "kind": "const", "name": "attributes" },
        { "kind": "const", "name": "brands" },
        { "kind": "const", "name": "defaultBrand" },
        { "kind": "const", "name": "defaultMode" },
        { "kind": "const", "name": "modes" },
        { "kind": "const", "name": "tokens" }
      ],
      "kind": "esm",
      "path": "."
    },
    {
      "exports": [
        { "kind": "type", "name": "Brand" },
        { "kind": "type", "name": "Mode" },
        { "kind": "type", "name": "TokenName" },
        { "kind": "type", "name": "TokenValues" },
        { "kind": "const", "name": "values" }
      ],
      "kind": "esm",
      "path": "./values"
    },
    { "kind": "css", "path": "./css/base.css" },
    { "files": ["./css/brand-a.css", "./css/brand-b.css"], "kind": "css", "path": "./css/brand-*.css" },
    {
      "files": [
        { "path": "./meta/report.json", "version": 1 },
        { "path": "./meta/report.md" },
        { "path": "./meta/sync-manifest.json", "version": 1 },
        { "path": "./meta/tokens.manifest.json", "version": 1 }
      ],
      "kind": "meta",
      "path": "./meta/*"
    }
  ],
  "format": "<prefixo>.tokens-api",
  "package": "@<prefixo>/tokens",
  "theme": {
    "attributes": { "brand": "data-<prefixo>-brand", "mode": "data-<prefixo>-mode" },
    "brands": ["a", "b"],
    "defaultBrand": "a",
    "defaultMode": "light",
    "modes": ["light", "dark"]
  },
  "tokens": [
    {
      "axis": "mode",
      "category": "color",
      "cssName": "--<prefixo>-color-bg-surface",
      "deprecated": false,
      "layer": "semantic",
      "name": "color.bg.surface",
      "placement": "base",
      "role": "public",
      "type": "color"
    },
    {
      "axis": "invariant",
      "category": "color",
      "cssName": "--<prefixo>-color-blue-600",
      "deprecated": false,
      "exclusiveBrand": "a",
      "layer": "primitive",
      "name": "color.blue.600",
      "placement": "brand-exclusive",
      "role": "public",
      "type": "color"
    }
  ],
  "version": 1
}
```

Token fields: `name` (path), `cssName`, `type` (DTCG `$type`), `category`, `layer`
(`primitive`, `semantic`, `component`), `axis` (`invariant`, `brand`, `mode`; primitives and components
are `invariant`), `role` (`public` or `brand-mode-source`), `placement` (`base`, `brand` or
`brand-exclusive`, with `exclusiveBrand`) and `deprecated` (`false`, `true` or the message). Token
values and descriptions are left out: a value change is not an API change and follows the visual
regression (QA-04). The private toggles are left out.

### 11.2 Change classification (input to GOV-01)

| Change in the report | Class |
| --- | --- |
| Remove or rename a token (rename = remove + add) | major |
| Change a token's `cssName`, `type`, `category`, `layer` or `role` | major |
| Change `placement` from `base` or `brand` to `brand-exclusive`, or switch `exclusiveBrand` | major |
| Remove a brand, add or remove a mode (data-model) | major |
| Change `defaultBrand`, `defaultMode`, attribute names, `layer` or the position of an existing layer in `layerOrder` | major |
| Remove an entry or export; increment the `version` of the format of a JSON file in `./meta/*` | major |
| Add a token, brand, entry or export; add a layer at the end of `layerOrder` | minor |
| Deprecate a token (`deprecated` stops being `false`) | minor |
| Change a token's `axis`, or `placement` from `brand-exclusive` to `base` or `brand` | minor |
| No change in the report | patch (value changes follow the changelog and the visual regression) |

### 11.3 Relationship with FR-009 and SC-005

Adding a brand changes the public surface (`Brand`, `brands` and the list of brand files), so the
regenerated report changes. The diff check of FR-009 and SC-005 MUST accept, besides
`packages/tokens/src/**`, the regenerated `packages/tokens/api/tokens.api.json`, a derived artifact of
the source that is never hand-edited. It is a token file in the sense of TOK-07, per the spec
Clarifications section (FR-009, SC-005).

## 12. Assumptions and pending items

Assumptions used, without deciding an open question of the requester:

- Synthetic brands `a` and `b` until the real brands are delivered; default brand designated by the
  requester (CMP-24); default mode `light`.
- Prefix `<prefixo>` (TODO(PREFIXO)); license `UNLICENSED` as a marker (ENG-22 assumption).
- TypeScript 6.0 as the provisional floor value and 7.0 as the latest; Node 22 LTS as the floor of
  `engines` (assumption "Node on LTS", D2).
- Single version of the published packages (GOV-01 assumption).
- CI platform: GitHub Actions, inferred from ENG-18 (D2).

Pending items:

- **P-01** Name of the third-party notices file (`THIRD-PARTY-NOTICES.md` is provisional) and location
  of the versioned ENG-17 allowlist, to be fixed with the CI and publishing feature.
- **P-02** The API report uses its own format; if the CI and publishing feature adopts a common format
  for all packages, this report migrates without changing the classification of §11.2.
- **P-03** Decided in the spec (Clarifications): the regenerated API report is a token file and enters
  the diff check of FR-009 and SC-005 (§11.3).
