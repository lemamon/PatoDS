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
| `v06-bad-segment` | V-06 | name segment outside the kebab grammar |
| `v06-unknown-category` | V-06 | first segment not a TOK-10 category |
| `v06-css-collision` | V-06 | two ids mapping to the same CSS name |
| `v08-brand-source-form` | V-08 | token in a brand file outside the `brand.` group |
| `v08-brand-source-mode` | V-08 | `brand.*` source not ending in a mode id |
| `v10-hex-mismatch` | V-10 | hex diverging from the srgb components |
| `v11-missing-category` | V-11 | category with no public semantic token |
| `v12-control-scale` | V-12 | `size.control.*` outside the control-height scale |
| `v13-parity-missing` | V-13 | public semantic key missing from one permutation |

## Not covered (validator gaps)

V-04 (cross-layer direction), V-05 (`$ref`/`$root`/`$extends` form), V-07 (axis consistency) and
V-09 (shared-set axis value) are listed by T024 but are **not reachable through a token source** with
the current validators: `validateModel` does not implement V-05/V-07/V-09, and V-04's `direction`
check reads the resolved alias leaf (always a primitive), so a source alias to a higher layer resolves
down and never trips it (it is only covered by the synthetic-model unit test in `validate.test.ts`).
Fixtures for these need the corresponding validators (T027/T029) to enforce on the real pipeline first.
