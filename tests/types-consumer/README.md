# @patods/types-consumer

Downstream type-consumer gate for `@patods/tokens` (feature 001, task T040 — FR-016, QA-08, ENG-05).

It installs the **packed tarball** (`vendor/patods-tokens-0.0.0.tgz`, the exact bytes npm would
publish — not the workspace source, per Principle VII / QA-06) and proves the published type
surface holds for a real consumer:

- **`tsc --noEmit`, strict**, under both `moduleResolution: bundler` and `moduleResolution: nodenext`.
- In **TypeScript 6.0** (this package, default catalog) and **TypeScript 7.0** (the sibling
  [`@patods/types-consumer-ts7`](../types-consumer-ts7), catalog `typescript7`).
- [`src/assertions.ts`](src/assertions.ts) — positive cases via `expect-type`: each token is its
  exact `var(--patods-…)` literal, `TokenName`/`Brand`/`Mode` are the expected unions, `values` has
  the `Readonly<Record<Brand, Record<Mode, Record<string, string>>>>` shape.
- [`src/errors.ts`](src/errors.ts) — negative cases via `@ts-expect-error`: a nonexistent token,
  brand, and mode must each be rejected. An unused directive is itself a compile error (TS2578), so
  the file fails the moment the types stop rejecting bad input.
- **`publint`** on the extracted tarball — fails on any error or warning.

## Why two packages

pnpm cannot hold two `typescript` versions in one package, and the named catalog `typescript7`
only resolves under the `typescript` key. So TypeScript 7.0 runs from the thin sibling
`@patods/types-consumer-ts7`, which owns only the TS 7 compiler and type-checks **these same**
sources and `tsconfig.*.json` (module resolution walks up to this package's `node_modules` for the
tarball and `expect-type`).

## Running

```bash
pnpm pack:tokens   # rebuild + repack the tarball into the consumer vendor dirs
pnpm install       # wire the fresh tarball
pnpm test:types    # runs this package and the TS 7 sibling via turbo
```

The tarball is git-ignored; regenerate it with `pnpm pack:tokens` after any change to the tokens
source. CI generates and installs it before the gate (T051).
