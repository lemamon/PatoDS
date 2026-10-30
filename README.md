# PatoDS

PatoDS is a multi-framework (React + Vue) design system built on a single source of
[W3C DTCG](https://www.w3.org/community/design-tokens/) design tokens, with accessibility
(WCAG 2.2 AA), AI-agent tooling, design-tool sync, and a deterministic, supply-chain-hardened
build pipeline.

This repository currently contains the **design-token foundation** and its **build and quality
tooling** (feature `001-design-tokens-themes`). The component libraries and framework adapters are
specified and planned — see [the feature spec](specs/001-design-tokens-themes/spec.md) and the
[project constitution](.specify/memory/constitution.md).

> `patods` is the provisional value of the project prefix (see `TODO(PREFIXO)` in the constitution).

## Repository layout

| Path          | Contents                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| `packages/`   | Published packages (currently `@patods/tokens`).                         |
| `tools/`      | Internal build and quality tooling (not published).                      |
| `apps/`       | Reserved for example/documentation apps.                                 |
| `tests/`      | Reserved for cross-package end-to-end tests.                             |
| `specs/`      | Spec-driven development artifacts (spec, plan, tasks, contracts).        |
| `.specify/`   | GitHub Spec Kit setup and the project constitution.                      |

### Packages

- **[`@patods/tokens`](packages/tokens)** — the single source of design tokens in DTCG 2025.10
  format, compiled to per-brand CSS and typed ESM modules. Brand and mode (light/dark) are
  independent axes, selected by `data-patods-brand` / `data-patods-mode` attributes.

### Tools

- **`@patods/tokens-build`** — compiles the DTCG token source to CSS, ESM, and build manifests
  (on top of `@terrazzo/parser`), with offline, deterministic output.
- **`@patods/tokens-contrast`** — WCAG 2.2 contrast checker over the emitted token color pairs.
- **`@patods/color`** — color and WCAG contrast math (sRGB relative luminance, alpha compositing).
- **`@patods/stylelint-plugin`** — a Stylelint rule that enforces token usage (no literal values
  outside the primitive layer).
- **`@patods/design-sync`** — ports-and-adapters design-tool synchronization, with no runtime
  dependencies and no tool-to-repository writes.
- **`@patods/repo-checks`** — repository guards: literal-value scan, layer-boundary checks, and
  build determinism/drift verification.

## Requirements

- **Node.js** `^22.13.0 || ^24.0.0 || >=26.0.0`
- **pnpm** `11.28.6` (pinned via `packageManager`; run `corepack enable` to use it)

## Getting started

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm tokens:build
pnpm test
```

## Commands

Every command runs through [Turborepo](https://turbo.build/):

| Command                     | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `pnpm tokens:validate`      | Validate the token source against the DTCG rules.         |
| `pnpm tokens:build`         | Build CSS, ESM, and manifests from the token source.      |
| `pnpm contrast:check`       | Check WCAG 2.2 contrast for the token color pairs.        |
| `pnpm lint:styles`          | Lint CSS with the token-usage rule.                       |
| `pnpm test`                 | Run the unit test suites.                                 |
| `pnpm test:types`           | Type-check the packages.                                  |
| `pnpm check:scan`           | Scan for literal values outside the primitive layer.      |
| `pnpm check:layers`         | Enforce the package layer boundaries.                     |
| `pnpm check:determinism`    | Verify the build is byte-for-byte deterministic.          |
| `pnpm check:drift`          | Verify generated artifacts match the committed source.    |
| `pnpm design-sync`          | Run the design-tool synchronization.                      |

## Supply chain

Dependencies are installed with a frozen lockfile and a strict single-version catalog. Install
scripts run only via an allowlist, packages must meet a minimum release age, and downgrades are
blocked (see `pnpm-workspace.yaml`).

## Documentation

- **Feature specification:** [specs/001-design-tokens-themes](specs/001-design-tokens-themes/spec.md)
- **Generated-package contracts:** [specs/001-design-tokens-themes/contracts](specs/001-design-tokens-themes/contracts/)
- **Project constitution:** [.specify/memory/constitution.md](.specify/memory/constitution.md)

Architecture Decision Records live under `docs/adr/` (kept locally; not tracked in git).

## License

Private / `UNLICENSED`. Not for public distribution.
