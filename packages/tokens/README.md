# @patods/tokens

Single source of PatoDS design tokens, in W3C DTCG 2025.10 format, compiled to per-brand CSS and
typed ESM modules. Brand and mode (light/dark) are independent axes, selected by data
attributes. `patods` is the provisional value of the project prefix (see `TODO(PREFIXO)` in the constitution).

## Installation

```bash
pnpm add @patods/tokens
```

## Minimal usage

Import the base CSS and the brand CSS, and select brand and mode by attribute:

```html
<link rel="stylesheet" href="@patods/tokens/css/base.css" />
<link rel="stylesheet" href="@patods/tokens/css/brand-a.css" />

<body data-patods-brand="a" data-patods-mode="dark">
  <div style="color: var(--patods-color-fg-default); background: var(--patods-color-bg-surface)">…</div>
</body>
```

Typed references and value maps in TypeScript:

```ts
import { tokens } from '@patods/tokens'
import { values } from '@patods/tokens/values'

element.style.color = tokens['color.fg.default'] // "var(--patods-color-fg-default)"
const surfaceDark = values.a.dark['color.bg.surface'] // "#101216"
```

## Full documentation

Feature specification: [specs/001-design-tokens-themes](../../specs/001-design-tokens-themes/spec.md).
Contract of the generated packages: [contracts/](../../specs/001-design-tokens-themes/contracts/).
