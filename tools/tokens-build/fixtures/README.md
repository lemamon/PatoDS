# Validation fixtures (US1, T024/T025)

End-to-end fixtures for the `tokens-build` validator, exercised by [`test/fixtures.test.ts`](../test/fixtures.test.ts).

## Layout

- `valid/` — a complete, self-contained valid token source (a snapshot of `packages/tokens/src`),
  covering all 11 categories and the control-height scale. It must validate with **zero** findings (T025).
- `invalid/<case>/` — an **overlay**: only the file(s) that differ from `valid/`, plus `expect.json`.
  The test composes a case by copying `valid/` and overwriting it with the overlay files, then runs
  the real `loadTokens → buildModel → validateModel` pipeline (T024).

`expect.json` is either `{ "codes": ["TKN-…"] }` (the exact deduplicated finding codes the composed
source must produce) or `{ "throws": "<substring>" }` (the parser must reject the source — V-03 alias
errors are caught at parse time, before `validateModel`).

## Cases

| Case | Rule | Mechanism |
| --- | --- | --- |
| `v02-literal-in-semantic` | V-02 | literal value outside the primitive layer |
| `v03-alias-cycle` | V-03 | circular alias (parser throw) |
| `v03-nonexistent-alias` | V-03 | alias to a nonexistent token (parser throw) |
| `v04-direction` | V-04 | a primitive with a direct alias to a semantic token (the resolved leaf is still a primitive) |
| `v05-ref-outside-primitive` | V-05 | a `$ref` in a semantic token |
| `v05-root-forbidden` | V-05 | a `$root` on a group |
| `v05-extends-form` | V-05 | `$extends` in the object form (parser throw) |
| `v07-axis-dependency` | V-07 | an invariant token that depends on a mode-axis token (AX-1) |
| `v09-path-duplicate` | V-07/V-09 | the same path defined in two sets (shared set carries no axis value) |
| `v06-bad-segment` | V-06 | name segment outside the kebab grammar |
| `v06-unknown-category` | V-06 | first segment not a TOK-10 category |
| `v06-css-collision` | V-06 | two ids mapping to the same CSS name |
| `v08-brand-source-form` | V-08 | token in a brand file outside the `brand.` group |
| `v08-brand-source-mode` | V-08 | `brand.*` source not ending in a mode id |
| `v10-hex-mismatch` | V-10 | hex diverging from the srgb components |
| `v11-missing-category` | V-11 | category with no public semantic token |
| `v12-control-scale` | V-12 | `size.control.*` outside the control-height scale |
| `v13-parity-missing` | V-13 | public semantic key missing from one permutation |

## Notes

- **V-04** reads the **direct** alias (`{path}`) from the source, not the resolved leaf, so a primitive
  aliasing a semantic token is caught even though the leaf resolves back down to a primitive.
- **V-05**: `$ref` (outside the primitive layer) and `$root` are source-form findings; `$extends` in the
  object form is rejected by the parser, like V-01/V-03, so that case is a `throws` fixture.
- **V-07/V-09** are enforced together by the axis-by-location check (`TKN-PATH-DUPLICATE`) plus the
  axis-dependency check (`TKN-AXIS-DEPENDENCY`, AX-1/AX-2). The source-form facts come from
  `adapter.ts` → `scanSource`, which reads the raw JSON before @terrazzo merges it.

The remaining V-05/V-07/V-08 codes (`TKN-REF-NOT-LOCAL`, `TKN-AXIS-BOTH`, `TKN-BRAND-SOURCE-REF`,
`TKN-PARITY-CONTEXT`) are exercised by the unit tests in `test/validate.test.ts`; a fixture per code can
be added as those edges get their own end-to-end cases.
