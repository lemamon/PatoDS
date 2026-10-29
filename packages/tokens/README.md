# @patods/tokens

Fonte única de design tokens do PatoDS, em formato W3C DTCG 2025.10, compilada para CSS por marca e
módulos ESM tipados. Marca e modo (claro/escuro) são eixos independentes, selecionados por atributos
de dados. `patods` é o valor provisório do prefixo do projeto (ver `TODO(PREFIXO)` na constituição).

## Instalação

```bash
pnpm add @patods/tokens
```

## Uso mínimo

Importe o CSS base e o da marca, e selecione marca e modo por atributo:

```html
<link rel="stylesheet" href="@patods/tokens/css/base.css" />
<link rel="stylesheet" href="@patods/tokens/css/brand-a.css" />

<body data-patods-brand="a" data-patods-mode="dark">
  <div style="color: var(--patods-color-fg-default); background: var(--patods-color-bg-surface)">…</div>
</body>
```

Referências tipadas e mapas de valores em TypeScript:

```ts
import { tokens } from '@patods/tokens'
import { values } from '@patods/tokens/values'

element.style.color = tokens['color.fg.default'] // "var(--patods-color-fg-default)"
const surfaceDark = values.a.dark['color.bg.surface'] // "#101216"
```

## Documentação completa

Especificação da feature: [specs/001-design-tokens-themes](../../specs/001-design-tokens-themes/spec.md).
Contrato dos pacotes gerados: [contracts/](../../specs/001-design-tokens-themes/contracts/).
