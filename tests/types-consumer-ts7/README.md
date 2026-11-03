# @patods/types-consumer-ts7

The **TypeScript 7.0** axis of the T040 type-consumer gate (catalog `typescript7`).

It owns nothing but the TS 7 compiler. Its `test:types` runs `tsc --noEmit` over the consumer
sources and `tsconfig.bundler.json` / `tsconfig.nodenext.json` that live in the sibling
[`@patods/types-consumer`](../types-consumer); module resolution walks up to that package's
`node_modules` for the `@patods/tokens` tarball and `expect-type`.

See the sibling's README for why the TypeScript 6.0 and 7.0 axes are split across two packages.
