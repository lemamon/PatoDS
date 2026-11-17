# Convenção de nomes de tokens

Documento de convenção exigido por TOK-04 e DOC-08. O contrato normativo é
[`token-source.md`](../../specs/001-design-tokens-themes/contracts/token-source.md), seções 8.1 a 8.10. Este
documento o resume para leitura humana. Em caso de conflito, o contrato vence.

## Fonte única das listas de palavras

As listas fechadas abaixo (categorias, escala SZ, estados, variantes, papéis, propriedades e palavras
reservadas) têm uma única fonte no código: `tools/tokens-build/src/vocabulary.ts` (registro `VOCABULARIES`).
Os blocos entre marcadores `<!-- vocab:ID -->` e `<!-- /vocab:ID -->` são lidos por
`pnpm check:naming-doc`, que falha com `TOK04-*` quando o documento e o validador divergem (todo termo
documentado deve existir no validador e vice-versa). Não edite uma lista só aqui nem só no código.

## 1. Segmentos e categorias

Todo segmento do caminho casa com o padrão abaixo (minúsculas ASCII em kebab; sem `$`, `{`, `}`, `.`, `/`,
`_` ou espaço). Violação: `TKN-NAME-SEGMENT`.

<!-- vocab:segment-pattern -->
- Padrão: `^[a-z0-9]+(-[a-z0-9]+)*$`
<!-- /vocab:segment-pattern -->

O primeiro segmento é uma categoria da lista fechada TOK-10 (`TKN-NAME-CATEGORY`):

<!-- vocab:categories -->
`color`, `typography`, `space`, `size`, `radius`, `border`, `shadow`, `motion`, `z-index`, `breakpoint`, `opacity`
<!-- /vocab:categories -->

Grupo raiz reservado (apenas em `src/semantic/brand/*.tokens.json`, na forma `brand.<caminho semântico>.<modo>`):

<!-- vocab:reserved-groups -->
`brand`
<!-- /vocab:reserved-groups -->

## 2. Ordem dos segmentos por categoria

Notação: `<x>` obrigatório; `[.<x>]` opcional; `|` alternativas. A análise é posicional: após `<comp>`, o
próximo segmento é `<part>` se não pertencer às propriedades da categoria, às variantes ou aos estados; caso
contrário é `<prop>`. Segmento a mais, a menos ou fora do vocabulário: `TKN-NAME-GRAMMAR`. Quando um prefixo
tem tokens com estado, o estado padrão é escrito explicitamente (`color.button.bg.default` ao lado de
`color.button.bg.hover`).

| Categoria | Primitivo | Semântico (público) | Componente |
| --- | --- | --- | --- |
| color | `color.<palette>.<step>` | `color.<prop>.<role>[.<variant>][.<state>]` | `color.<comp>[.<part>].<prop>[.<variant>][.<state>]` |
| typography | `typography.<prop>.<step>\|<name>` | `typography.<prop>.<role>[.<variant>]` | `typography.<comp>[.<part>].<prop>[.<variant>][.<state>]` |
| space | `space[.<scale>].<step>` | `space.<prop>.<role>` | `space.<comp>[.<part>].<prop>[.<variant>]` |
| size | `size[.<scale>].<step>` | `size.<prop>.<role>` | `size.<comp>[.<part>].<prop>[.<variant>][.<state>]` |
| radius | `radius[.<scale>].<step>` | `radius.<prop>.<role>` | `radius.<comp>[.<part>][.<variant>][.<state>]` |
| border | `border.<prop>.<step>\|<name>` | `border.<prop>.<role>[.<variant>][.<state>]` | `border.<comp>[.<part>].<prop>[.<variant>][.<state>]` |
| shadow | `shadow[.<scale>].<step>` | `shadow.<prop>.<role>` | `shadow.<comp>[.<part>][.<variant>][.<state>]` |
| motion | `motion.<prop>.<step>\|<name>` | `motion.<prop>.<role>` | `motion.<comp>[.<part>].<prop>[.<variant>][.<state>]` |
| z-index | `z-index[.<scale>].<step>` | `z-index.layer.<role>` | `z-index.<comp>[.<part>][.<variant>]` |
| breakpoint | `breakpoint[.<scale>].<step>` | `breakpoint.<prop>.<role>` | `breakpoint.<comp>[.<part>][.<variant>]` |
| opacity | `opacity[.<scale>].<step>` | `opacity.<prop>.<role>` | `opacity.<comp>[.<part>][.<variant>][.<state>]` |

Exemplos: `color.blue.600`, `color.bg.surface`, `color.bg.danger.subtle`, `color.button.bg.primary.hover`,
`space.inset.md`, `size.button.control-height.md`, `motion.duration.fast`, `z-index.layer.modal`.

### Propriedades por categoria

Em categorias sem propriedade de componente, o segmento de propriedade do semântico designa a classe de
elemento (por exemplo `radius.control`) e o componente a omite. A propriedade `control-height` só existe em
componente da categoria `size`, como alias direto de `size.control.<step>` (`TKN-CONTROL-SCALE`).

Propriedades na camada semântica:

<!-- vocab:semantic-properties -->
| Categoria | Propriedades |
| --- | --- |
| `color` | `bg`, `fg`, `border` |
| `typography` | `text`, `family`, `weight`, `size`, `line-height`, `letter-spacing` |
| `space` | `inset`, `stack`, `inline` |
| `size` | `control`, `icon`, `container` |
| `radius` | `control`, `container`, `indicator` |
| `border` | `width`, `style`, `stroke` |
| `shadow` | `elevation`, `focus` |
| `motion` | `duration`, `easing`, `transition` |
| `z-index` | `layer` |
| `breakpoint` | `viewport`, `container` |
| `opacity` | `state`, `overlay` |
<!-- /vocab:semantic-properties -->

Propriedades na camada de componente (`—` = nenhuma):

<!-- vocab:component-properties -->
| Categoria | Propriedades |
| --- | --- |
| `color` | `bg`, `fg`, `border` |
| `typography` | `text`, `family`, `weight`, `size`, `line-height`, `letter-spacing` |
| `space` | `inset`, `stack`, `inline` |
| `size` | `control-height`, `height`, `width`, `min-width`, `icon` |
| `radius` | — |
| `border` | `width`, `style`, `stroke` |
| `shadow` | — |
| `motion` | `duration`, `easing`, `transition` |
| `z-index` | — |
| `breakpoint` | — |
| `opacity` | — |
<!-- /vocab:component-properties -->

## 3. Vocabulários (v1)

Escala de tamanho SZ, em ordem crescente (a ordem faz parte do contrato):

<!-- vocab:sz -->
`2xs` < `xs` < `sm` < `md` < `lg` < `xl` < `2xl` < `3xl`
<!-- /vocab:sz -->

Estados (vocabulário compartilhado com o manifesto de contraste e a regra de pares FR-021):

<!-- vocab:states -->
`default`, `hover`, `active`, `focus-visible`, `selected`, `invalid`, `disabled`, `inactive`
<!-- /vocab:states -->

Variantes: as palavras SZ mais as semânticas. Variantes e estados são disjuntos, o que torna a análise
posicional inequívoca.

<!-- vocab:variants -->
`2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `subtle`, `strong`, `inverse`, `primary`, `secondary`, `tertiary`, `neutral`, `accent`, `success`, `warning`, `danger`, `info`
<!-- /vocab:variants -->

Passo primitivo (`<step>`): inteiro (`[0-9]+`), fração com hífen (`0-5` = 0,5), palavra SZ, ou uma destas:

<!-- vocab:step-words -->
`full`, `none`
<!-- /vocab:step-words -->

`<name>` primitivo é kebab livre, só em `typography.family`, `border.style` e `motion.easing`. `<palette>` e
`<scale>` são kebab livres que NÃO podem ser propriedade semântica da categoria.

### Papéis (`<role>`) na camada semântica

`SZ` significa todas as palavras da escala SZ acima; `*` significa qualquer propriedade da categoria.

<!-- vocab:roles -->
| Categoria e propriedade | Papéis |
| --- | --- |
| `color.bg` | `surface`, `raised`, `sunken`, `overlay`, `inverse`, `accent`, `neutral`, `success`, `warning`, `danger`, `info`, `scrim` |
| `color.fg` | `default`, `muted`, `subtle`, `inverse`, `accent`, `on-accent`, `link`, `success`, `warning`, `danger`, `info` |
| `color.border` | `default`, `muted`, `strong`, `focus`, `inverse`, `accent`, `success`, `warning`, `danger`, `info` |
| `typography.*` | `display`, `heading`, `title`, `body`, `label`, `caption`, `code` |
| `space.*` | `none`, `SZ` |
| `size.control` | `SZ` |
| `size.icon` | `SZ` |
| `size.container` | `SZ` |
| `radius.*` | `none`, `default`, `full`, `SZ` |
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
<!-- /vocab:roles -->

`<comp>` (id do componente) é kebab, sempre na segunda posição, e diferente de `control`. `<part>` é um único
segmento kebab fora das propriedades da categoria, das variantes e dos estados.

## 4. Palavras e segmentos reservados

Ids de modo. Não podem ser segmento de nenhum nome, exceto o último segmento de `brand.*`; o modo é um eixo,
não parte do nome (`TKN-NAME-RESERVED`):

<!-- vocab:mode-ids -->
`light`, `dark`
<!-- /vocab:mode-ids -->

Ids de componente proibidos (`TKN-NAME-RESERVED`):

<!-- vocab:reserved-component-ids -->
`control`
<!-- /vocab:reserved-component-ids -->

Demais regras de reserva (contrato, seção 8.5):

| Reservado | Regra | Código |
| --- | --- | --- |
| Grupo `size.control` | Só para a escala de altura de controle, só na camada semântica | `TKN-NAME-RESERVED`, `TKN-CONTROL-SCALE` |
| Propriedade `control-height` | Só em componente de `size`, como alias direto de `size.control.<step>` | `TKN-CONTROL-SCALE` |
| `$root` | Proibido em qualquer camada | `TKN-ROOT-FORBIDDEN` |
| `$ref` | Só na camada primitiva, só local | `TKN-REF-OUTSIDE-PRIMITIVE`, `TKN-REF-NOT-LOCAL` |
| `$extends` | Só na forma com chaves | `TKN-EXTENDS-FORM` |
| Segmento privado `_` | Reservado ao gerador (`--<prefixo>-_*`); nenhum token o ocupa | `TKN-NAME-SEGMENT` |

## 5. Nome CSS

O nome CSS é `--<prefixo>-` seguido dos segmentos do caminho unidos por `-`:

| Caminho | Nome CSS |
| --- | --- |
| `color.bg.surface` | `--<prefixo>-color-bg-surface` |
| `z-index.layer.modal` | `--<prefixo>-z-index-layer-modal` |
| `space.0-5` | `--<prefixo>-space-0-5` |
| `brand.color.bg.surface.light` | `--<prefixo>-brand-color-bg-surface-light` |

O nome CSS é único entre todos os tokens de todas as camadas, inclusive `brand.*`. Como um segmento pode ter
hífen, caminhos distintos podem colidir (`color.bg.surface-raised` e `color.bg.surface.raised`); a colisão
gera `TKN-NAME-COLLISION`. `<prefixo>` é parâmetro de build.

## 6. Evolução da convenção

- Adicionar palavra a um vocabulário é mudança compatível: nenhum token muda de nome.
- Remover ou renomear palavra usada por token publicado, ou mudar a ordem dos segmentos, exige renomear
  tokens publicados: mudança incompatível da API pública (GOV-01, Princípio X). Exige versão major,
  `$deprecated` antes da remoção e guia de migração (GOV-05, GOV-06).
- Toda mudança de gramática começa por emenda do contrato `token-source.md`, aprovada pelo responsável do
  pacote de tokens (GOV-09). O validador (`vocabulary.ts`) e este documento a seguem, e
  `pnpm check:naming-doc` garante que os dois coincidam.
