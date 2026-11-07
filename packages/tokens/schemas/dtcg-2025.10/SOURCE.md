# DTCG 2025.10 JSON Schemas — provenance

Vendored copies of the official Design Tokens Community Group (DTCG) 2025.10 JSON Schemas, used by
`tokens-build validate` for V-01 (FR-002 / TOK-01). The build validates against these local copies and
never fetches them at build time (offline, deterministic — FR-025, SC-002).

| File | Source URL | Draft |
| --- | --- | --- |
| `format.json` | <https://www.designtokens.org/schemas/2025.10/format.json> | JSON Schema draft-07 |
| `resolver.json` | <https://www.designtokens.org/schemas/2025.10/resolver.json> | JSON Schema draft-07 |

- **Specs**: Design Tokens Format Module 2025.10 (W3C CG Final Report, 2025-10-28,
  <https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/>) and Design Tokens
  Resolver Module 2025.10 (<https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/>).
- **Fetched**: 2026-11-07.
- **Self-contained bundles**: each file embeds every sub-schema it references (e.g.
  `…/format/token.json`, `…/format/values/color.json`, `…/resolver/modifier.json`) inline under its own
  `$id`, so the external `$ref` URLs resolve from within the file. Those sub-schema URLs are **not**
  published as standalone files (they 404); only the two bundled roots exist. `format.json` carries 18
  bundled `$id`s and `resolver.json` 22, with no dangling reference.
- **Canonicalization**: re-serialized as 2-space JSON with a trailing LF for deterministic vendoring; the
  content is otherwise byte-faithful to the source. Integrity hashes of the vendored copies are in
  `SHA256SUMS` (hashes of these canonical files, not of the raw downloads).
- **License**: see `LICENSE-W3C.md`; recorded in `quality/license-policy.json` (W3C, DTCG schema copy).
