# Contrato: regras de lint de estilos

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) (D5, D6) |
**Modelo**: [data-model.md](../data-model.md) | **Contraste**: [contrast-manifest.md](contrast-manifest.md) |
**ADR**: [ADR-16](../../../docs/adr/ADR-16-lint-tokens-e-testes.md) e
[ADR-15](../../../docs/adr/ADR-15-cor-e-contraste.md) (Propostos) | **Data**: 2026-10-21

Este contrato define as duas regras Stylelint do pacote privado `@<prefixo>/stylelint-plugin`
(`tools/stylelint-plugin`): `<prefixo>/design-tokens`, que barra token primitivo, valor literal e
altura de controle fora da escala (FR-022, FR-023, FR-024; TOK-03, TOK-13), e
`<prefixo>/contrast-pairs`, que barra par de cores de frente e fundo ausente do manifesto de
contraste (FR-021; A11Y-09). Define também o harness de fixtures, o gate no CI e as restrições que
as regras impõem à feature do núcleo. Nesta feature as regras são entregues e provadas sobre
fixtures; passam a valer no núcleo de estilos quando ele existir (feature de componentes). Os
trechos são formatos, assinaturas e exemplos de CSS; nenhuma implementação é definida aqui.
`<prefixo>` é o marcador da constituição (TODO(PREFIXO)).

## 1. Premissas e garantias

**Premissas assumidas** (nenhuma é decidida aqui):

| Decisão em aberto | Premissa usada | Efeito neste contrato |
| --- | --- | --- |
| Prefixo do projeto | `<prefixo>` como marcador (TODO(PREFIXO)) | O namespace das regras, o prefixo da anotação de contraste e os atributos `data-<prefixo>-*` acompanham a emenda da constituição. A regra lê o prefixo real do manifesto de tokens. |
| Nível de conformidade alvo (A11Y-01) | WCAG 2.2 AA | Vocabulário de estados, isenção de inativos e grupos de foco do manifesto de contraste. |
| Contrato de DOM (CMP-14) e arquivo de orientação | Ainda não existem (feature de componentes) | Esta feature entrega só registros de controles de fixture (seção 3.7). |
| Marcas da versão 1.0 | Marcas sintéticas A e B até a entrega dos valores (QA-15) | O manifesto de tokens usado pelas fixtures vem do build real sobre essas marcas. |
| Plataforma de CI | GitHub Actions (inferida do ENG-18, pendente de confirmação) | Relatório JSON publicado como artefato e retido como evidência (ACE-02). |

A lista de navegadores (ENG-08) não afeta estas regras, que são análise estática.

**Garantias**:

- G-1 (FR-023): primitivo, literal e altura de controle são verificados pela **mesma** regra,
  `<prefixo>/design-tokens`, como exige o texto do FR-023.
- G-2: cada aviso carrega um código estável (seções 3.5 e 4.6). O conjunto de códigos é exportado
  pelo plugin; renomear ou remover código exige registro no ADR-16.
- G-3: para as mesmas entradas, os avisos são os mesmos, sem depender da ordem dos arquivos, de
  rede ou de relógio.
- G-4 (Princípio I): nenhuma lista de tokens é escrita à mão. Nomes, camadas, papéis, cadeias de
  alias e a escala de alturas vêm do manifesto gerado pelo build.

## 2. Pacote, entradas e formato do achado

### 2.1 Pacote

- `@<prefixo>/stylelint-plugin`, `private: true`, ESM, sobre stylelint 17.16.x, com
  `@csstools/css-tokenizer` e `@csstools/css-parser-algorithms` 4.x para valores e
  `postcss-selector-parser` 7.x para seletores (D6).
- Camada `tools`. Única aresta de workspace: `@<prefixo>/tokens` como devDependency, só pelo
  subcaminho `./meta/*` (ENG-01). Não é dependência de runtime de nenhum pacote de UI.

```ts
// Superfície pública do plugin (assinaturas)
import type { Plugin } from 'stylelint';

declare const plugins: Plugin[];               // as duas regras
export default plugins;

export type DesignTokensCode =
  | 'primitive-token' | 'brand-mode-source-token' | 'unknown-token'
  | 'literal-value' | 'var-fallback-literal' | 'token-definition'
  | 'control-height' | 'control-height-missing' | 'unclassified-component';

export type ContrastPairsCode =
  | 'pair-not-in-manifest' | 'missing-background' | 'missing-foreground'
  | 'unresolvable-color' | 'invalid-annotation' | 'unmapped-state';

export declare const designTokensCodes: readonly DesignTokensCode[];
export declare const contrastPairsCodes: readonly ContrastPairsCode[];
```

### 2.2 Caminhos nas opções e erros de configuração

- Caminho relativo resolve a partir do diretório do arquivo de configuração do Stylelint que o
  declara; caminho absoluto é aceito; especificador de pacote (por exemplo,
  `@<prefixo>/tokens/meta/tokens.manifest.json`) resolve a partir do pacote do plugin, que declara a
  dependência.
- Arquivo ausente, JSON inválido, `version` não suportado (envelope `format`/`version`,
  [build-manifests.md](build-manifests.md)) ou opção desconhecida produzem aviso
  de opção inválida do Stylelint. A CLI do Stylelint sai com código diferente de zero, e nenhum
  aviso de lint é emitido para o arquivo.

### 2.3 Manifesto de tokens consumido

As duas regras leem `dist/meta/tokens.manifest.json` de `@<prefixo>/tokens`. O formato normativo
está em [build-manifests.md](build-manifests.md); as regras usam, por token: caminho, `cssName`, camada (`primitive`,
`semantic`, `component`), categoria, `$type`, papel (`public` ou `brand-mode-source`), cadeia de
alias, pertença à escala de alturas (`scale: "control-height"`) e, para tokens compostos de borda e
sombra, as referências dos subvalores de cor. Variáveis privadas com segmento `_` (os toggles
`--<prefixo>-_on-light` e `--<prefixo>-_on-dark`) não constam do manifesto.

**Token permitido em CSS de componente**: token `semantic` com papel `public`, ou token
`component` (TOK-03, data-model "Camada"). Todo o resto é proibido: primitivo, token do grupo
reservado `brand.` (papel `brand-mode-source`), variável privada e qualquer nome fora do manifesto,
com ou sem prefixo.

### 2.4 Formato do achado

O achado lógico é `{ file, line, column, code, message }` ([modelo de dados](../data-model.md),
"Achado de lint"). No relatório JSON do Stylelint, cada aviso tem `rule`, `line`, `column` e
`text`; o código fica no início do texto:

```text
<code>: <mensagem legível> (<prefixo>/design-tokens)
```

Linha e coluna começam em 1. Uma regra nunca emite dois avisos com o mesmo código na mesma posição;
quando uma posição afeta mais de um caso (por exemplo, dois estados), a mensagem lista todos.

## 3. Regra `<prefixo>/design-tokens`

Aplica-se a todo arquivo selecionado pela configuração do gate como CSS de componente (seção 6).
Não se aplica ao CSS gerado em `packages/tokens/dist/css/`, que tem lint próprio no build
([css-output.md](css-output.md)), nem ao CSS da app de exemplo.

### 3.1 Opções

```ts
interface DesignTokensOptions {
  manifestPath: string;                       // tokens.manifest.json
  controlRegistryPath: string;                // registro de controles (seção 3.7)
  governedProperties?: GovernedPropertiesMap; // padrão: mapa v1 versionado no plugin (seção 3.2)
  controlHeightProperties?: ReadonlyArray<
    'height' | 'min-height' | 'block-size' | 'min-block-size' | 'max-height' | 'max-block-size'
  >;                                          // padrão: height, min-height, block-size, min-block-size
}

type TokenCategory = 'color' | 'typography' | 'space' | 'size' | 'radius' | 'border'
  | 'shadow' | 'motion' | 'z-index' | 'breakpoint' | 'opacity';

interface GovernedPropertiesMap {
  schemaVersion: 1;
  properties: Record<string, TokenCategory>;                        // propriedade → categoria
  literalKeywords: Partial<Record<TokenCategory, readonly string[]>>; // palavras com valor de categoria
}
```

O mapa padrão vive no plugin (arquivo versionado, nome proposto
`tools/stylelint-plugin/src/governed-properties.json`). A configuração do gate usa o padrão;
mudar o mapa é mudança do plugin, revisada no PR e registrada no ADR-16.

### 3.2 Propriedades governadas (mapa v1)

| Categoria | Propriedades |
| --- | --- |
| `color` | `color`, `background-color`, `background`, `border-color`, `border-{top,right,bottom,left}-color`, `border-{block,inline}-color`, `border-{block,inline}-{start,end}-color`, `outline-color`, `text-decoration-color`, `text-emphasis-color`, `caret-color`, `accent-color`, `column-rule-color`, `fill`, `stroke`, `-webkit-text-fill-color` |
| `space` | `margin`, `margin-*`, `padding`, `padding-*`, `gap`, `row-gap`, `column-gap`, `scroll-margin*`, `scroll-padding*` |
| `size` | `width`, `height`, `inline-size`, `block-size` e as variantes `min-*` e `max-*` de cada uma |
| `radius` | `border-radius` e as longhands de canto, físicas e lógicas |
| `border` | `border`, `border-{top,right,bottom,left}`, `border-{block,inline}`, `border-{block,inline}-{start,end}`, `border-width` e longhands `*-width`, `outline`, `outline-width`, `outline-offset` |
| `shadow` | `box-shadow`, `text-shadow` |
| `typography` | `font`, `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing` |
| `motion` | `transition`, `transition-duration`, `transition-delay`, `transition-timing-function`, `animation`, `animation-duration`, `animation-delay`, `animation-timing-function` |
| `z-index` | `z-index` |
| `opacity` | `opacity` |
| `breakpoint` | Nenhuma propriedade; vale para `@media` e `@container` (seção 3.6) |

`literalKeywords` padrão: `typography`: `normal`, `bold`, `bolder`, `lighter`, `xx-small`,
`x-small`, `small`, `medium`, `large`, `x-large`, `xx-large`, `xxx-large`, `smaller`, `larger` e as
famílias genéricas (`serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`, `system-ui`,
`ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`, `math`, `emoji`, `fangsong`) e fontes
de sistema (`caption`, `icon`, `menu`, `message-box`, `small-caption`, `status-bar`); `motion`:
`ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear`, `step-start`, `step-end`; `border`: `thin`,
`medium`, `thick`.

Não governadas no mapa v1 (lista registrada para a feature do núcleo): deslocamentos de
posicionamento (`inset*`, `top`, `right`, `bottom`, `left`), `transform` e `translate`,
`flex-basis`, `grid-*`, `aspect-ratio`, `border-style`, `background-image`, `mask*` e `filter`.
Declarações de custom property são sempre tratadas pelo subcódigo `token-definition`, qualquer que
seja o mapa.

### 3.3 O que é valor literal

O valor de cada declaração é decomposto em folhas. Leitura de "valor literal" do TOK-03 adotada
por esta regra (registrada como restrição na seção 7):

**Allowlist de palavras-chave** (sempre aceitas, em qualquer propriedade): `transparent`,
`currentcolor`, `auto`, `none`, `0` e as palavras-chave globais do CSS (`inherit`, `initial`,
`unset`, `revert`, `revert-layer`). Identificadores são comparados sem diferenciar maiúsculas
(`currentColor` é aceito). `0` inclui zero com unidade (`0px`, `0%`, `0s`).

| Folha | Em propriedade governada | Em propriedade não governada |
| --- | --- | --- |
| `var()` de token permitido | Aceita | Aceita |
| `var()` de outro nome | `primitive-token`, `brand-mode-source-token` ou `unknown-token` | Idem |
| Palavra da allowlist | Aceita | Aceita |
| `calc()`, `min()`, `max()`, `clamp()` | Avaliadas folha a folha; número sem unidade é aceito só como operando de `*` ou `/` | Avaliadas folha a folha |
| Cor hexadecimal; função de cor (`rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `color`, `color-mix`, `light-dark`, `contrast-color`, inclusive sintaxe relativa) | `literal-value` | `literal-value` |
| Cor nomeada (lista do CSS, exceto `transparent` e `currentcolor`) | `literal-value` | `literal-value` só como argumento de função de gradiente |
| Cor de sistema (`Canvas`, `CanvasText`, `ButtonText`, `Highlight` e as demais) | Aceita só dentro de `@media (forced-colors: active)`; fora dele, `literal-value` | Aceita |
| Dimensão não nula (qualquer unidade, inclusive `%`, tempo, ângulo) | `literal-value` | Aceita |
| Número puro não nulo (fora do caso de `calc`) | `literal-value` | Aceita |
| Função de easing (`cubic-bezier()`, `steps()`, `linear()`) | `literal-value` | Aceita |
| Palavra de `literalKeywords` da categoria da propriedade | `literal-value` | Aceita |
| String entre aspas | `literal-value` | Aceita |
| Outra função (`url()`, `image-set()`, `env()`, `attr()`) | `literal-value` | Aceita |
| Outro identificador (nome de propriedade em `transition`, `solid`, `inset`, nome de animação) | Aceito (estrutural) | Aceito |

### 3.4 Ordem de avaliação e posição dos avisos

Para cada declaração, nesta ordem:

1. Custom property (`--*`, com qualquer nome): `token-definition` na posição da propriedade; o
   valor não é analisado. As at-rules `@property` e `@custom-media` recebem o mesmo código na
   posição da at-rule.
2. Folhas do valor (seção 3.3). Cada `var()` é classificado pelo nome; as folhas do seu fallback
   seguem os mesmos critérios da propriedade, mas um literal ali recebe `var-fallback-literal` em
   vez de `literal-value`; um `var()` aninhado no fallback é classificado normalmente. O aviso de
   folha fica na coluna do início da folha (no `var()`, o início da função).
3. Altura de controle: só se o passo 2 não gerou aviso para a declaração (seção 3.7). Aviso
   `control-height` na coluna do início do valor.

Depois de percorrer o arquivo: `unclassified-component` e `control-height-missing` (seção 3.7).
Consequência da ordem: uma altura literal num controle (`height: 28px`) gera só `literal-value`;
`height: auto` ou um token fora da escala gera `control-height`; um primitivo gera só
`primitive-token`.

Declarações dentro de `@font-face` e `@page` não são analisadas. Declarações dentro de
`@keyframes` são analisadas como as demais.

### 3.5 Subcódigos

#### `primitive-token`

Dispara com `var()` de token da camada primitiva, em qualquer propriedade.

```css
/* inválido */
.<prefixo>-badge {
  background-color: var(--<prefixo>-color-blue-500);   /* ← primitive-token */
  padding: var(--<prefixo>-space-2);                   /* ← primitive-token */
}
/* válido */
.<prefixo>-badge {
  background-color: var(--<prefixo>-color-bg-accent);
  padding: var(--<prefixo>-space-inset-sm);
}
```

#### `brand-mode-source-token`

Dispara com `var()` de token do grupo reservado `brand.` (papel `brand-mode-source`). Esses tokens
são fontes de um token de eixo modo (FR-033) e ignorariam o escopo de modo mais próximo.

```css
/* inválido */
.<prefixo>-card {
  background-color: var(--<prefixo>-brand-color-bg-surface-light);   /* ← brand-mode-source-token */
}
/* válido: o token público de eixo modo resolve marca e modo pelo escopo mais próximo */
.<prefixo>-card {
  background-color: var(--<prefixo>-color-bg-surface);
}
```

#### `unknown-token`

Dispara com `var()` de qualquer nome que não seja token `semantic` público nem `component` no
manifesto, com ou sem prefixo, inclusive variáveis privadas e referências a custom properties
locais.

```css
/* inválido */
.<prefixo>-card {
  color: var(--brand-blue);                          /* ← unknown-token: sem prefixo, fora do manifesto */
  padding: var(--<prefixo>-space-inset-mdd);         /* ← unknown-token: nome inexistente */
  border-color: var(--<prefixo>-_on-dark);           /* ← unknown-token: variável privada */
}
/* válido */
.<prefixo>-card {
  color: var(--<prefixo>-color-fg-default);
  padding: var(--<prefixo>-space-inset-md);
}
```

#### `literal-value`

Dispara com folha literal conforme a seção 3.3, inclusive em parâmetros de `@media` e
`@container` (seção 3.6).

```css
/* inválido */
.<prefixo>-card {
  color: #1a1a1a;                       /* ← literal-value */
  padding: 12px;                        /* ← literal-value */
  border-radius: 4px;                   /* ← literal-value */
  z-index: 10;                          /* ← literal-value */
  font-weight: bold;                    /* ← literal-value */
  transition: opacity 150ms ease;       /* ← literal-value (150ms) e literal-value (ease) */
}
/* válido */
.<prefixo>-card {
  color: var(--<prefixo>-color-fg-default);
  padding: var(--<prefixo>-space-inset-md);
  margin: 0;
  border-color: transparent;
  margin-inline-start: calc(var(--<prefixo>-space-inline-sm) * -1);
  transition: opacity var(--<prefixo>-motion-duration-fast) var(--<prefixo>-motion-easing-standard);
}
```

#### `var-fallback-literal`

Dispara com literal no fallback de `var()`. Tokens públicos sempre têm valor (FR-013), então o
fallback literal só esconde um literal.

```css
/* inválido */
.<prefixo>-card {
  color: var(--<prefixo>-color-fg-default, #1a1a1a);   /* ← var-fallback-literal */
}
/* válido */
.<prefixo>-card {
  color: var(--<prefixo>-color-fg-default);
}
```

#### `token-definition`

Dispara com qualquer declaração de custom property em CSS de componente, com qualquer nome e
qualquer valor, e com `@property` e `@custom-media`. Protege o FR-001 (nenhum token fora da fonte
única) e impõe a proibição de remapear custom properties em variantes (seção 7, R-1).

```css
/* inválido */
.<prefixo>-button--danger {
  --<prefixo>-color-button-bg-default: var(--<prefixo>-color-bg-danger);   /* ← token-definition */
}
.<prefixo>-card {
  --card-gap: var(--<prefixo>-space-stack-md);                             /* ← token-definition */
}
@custom-media --bp-md (min-width: 768px);                                  /* ← token-definition */

/* válido: a variante troca a própria declaração por outro token de componente */
.<prefixo>-button--danger {
  background-color: var(--<prefixo>-color-button-bg-danger);
}
```

#### `control-height`

Dispara quando uma propriedade de `controlHeightProperties`, numa regra que dimensiona a caixa de
um controle (seção 3.7), não tem como valor exatamente um `var()` de token permitido marcado com
`scale: "control-height"` no manifesto de tokens (FR-007). O build marca assim os membros da escala
`size.control.<passo>` e os tokens de componente com propriedade `control-height`, que são alias
direto de um membro ([token-source.md](token-source.md), seção 8.6).

```css
/* registro: .<prefixo>-button (root) e .<prefixo>-button--sm (sizing) de um controle */
/* inválido */
.<prefixo>-button--sm {
  block-size: var(--<prefixo>-size-icon-md);       /* ← control-height: token fora da escala */
}
.<prefixo>-button {
  min-block-size: auto;                            /* ← control-height */
}
/* válido */
.<prefixo>-button--sm {
  block-size: var(--<prefixo>-size-control-sm);
}
.<prefixo>-button {
  block-size: var(--<prefixo>-size-button-control-height-md);  /* componente: alias de size.control.md */
}
```

#### `control-height-missing`

Dispara quando o seletor `root` ou um seletor `sizing` de um controle registrado para o arquivo não
tem, no próprio arquivo, regra de composto único (sem combinador, sem pseudoclasse e sem
pseudoelemento) que declare uma propriedade de `controlHeightProperties` com valor válido da
escala. Cobre o controle dimensionado só por `padding-block` e `line-height` e a variante de
tamanho escrita como classe isolada. Posição: início do seletor da primeira regra cujo composto
mais à direita contém o seletor registrado; sem essa regra, linha 1, coluna 1. Um aviso por seletor
registrado.

```css
/* registro: .<prefixo>-input (root) e .<prefixo>-input--lg (sizing) de um controle */
/* inválido */
.<prefixo>-input {                                 /* ← control-height-missing (root) */
  padding-block: var(--<prefixo>-space-inset-sm);
  line-height: var(--<prefixo>-typography-line-height-body);
}
.<prefixo>-input--lg {                             /* ← control-height-missing (sizing) */
  padding-block: var(--<prefixo>-space-inset-md);
}
/* válido */
.<prefixo>-input {
  min-block-size: var(--<prefixo>-size-control-md);
}
.<prefixo>-input--lg {
  min-block-size: var(--<prefixo>-size-control-lg);
}
```

#### `unclassified-component`

Dispara (a) uma vez, em linha 1, coluna 1, quando o arquivo analisado não é o `file` de nenhuma
entrada do registro; ou (b) em cada seletor de classe ou de atributo `data-<prefixo>-*`, em qualquer
composto do arquivo (inclusive dentro de `:is()`, `:where()`, `:not()` e `:has()`), que não aparece
em nenhum composto registrado de nenhuma entrada. No caso (a), os avisos do caso (b) não são
emitidos para o arquivo. A classificação usa a lista explícita do registro, nunca um padrão de nome
de classe, porque a convenção de classes (CMP-05, CMP-14) ainda não está fechada.

```css
/* registro: entrada button com root .<prefixo>-button e part .<prefixo>-button__icon */
/* inválido */
.<prefixo>-button__spinner {                       /* ← unclassified-component */
  inline-size: var(--<prefixo>-size-icon-sm);
}
/* válido: a classe passa a constar de classes.parts da entrada button */
```

### 3.6 `@media` e `@container`

`var()` não é válido em condição de media query, então valor de breakpoint não pode vir de token por
`var()`. Regra:

- Nos parâmetros de `@media` e `@container`, número, dimensão, razão e resolução não nulos são
  `literal-value`, inclusive na sintaxe de intervalo (`(width >= 48rem)`).
- Tipos de mídia, operadores, nomes de recurso, valores por palavra-chave (`hover`, `none`, `fine`,
  `coarse`, `dark`, `light`, `reduce`, `active`, `more`, `portrait`, `landscape`) e nomes de
  container são aceitos.
- Referência a custom media (`(--nome)`) é aceita só quando `--nome` é o `cssName` de um token
  público da categoria `breakpoint` (por exemplo, `(--<prefixo>-breakpoint-viewport-md)`);
  primitivo gera `primitive-token`, e outro nome, `unknown-token`. A geração e a compilação dessas
  definições são decisão da feature do núcleo (D6).
- Consulta `style()` em `@container` é tratada como declaração: o nome segue as regras de `var()`
  e o valor, as de folha.
- Parâmetros de `@supports`, `@layer` e `@import` não são analisados.

```css
/* inválido */
@media (min-width: 768px) { /* ... */ }                        /* ← literal-value */
@container card (inline-size > 30rem) { /* ... */ }            /* ← literal-value */
/* válido */
@media (--<prefixo>-breakpoint-viewport-md) { /* ... */ }
@media (prefers-reduced-motion: reduce) { /* ... */ }
```

### 3.7 Registro de controles

O registro diz quais seletores dimensionam a caixa de cada controle interativo. Em produção ele é
**derivado** do contrato de DOM (CMP-14) ou do arquivo de orientação de uso, nunca mantido à mão
(Princípio I); a derivação é entregue pela feature de componentes. Esta feature entrega só registros
de fixture.

```ts
interface ControlRegistry {
  $schema: string;                    // nome proposto: tools/stylelint-plugin/schemas/control-registry.schema.json
  schemaVersion: 1;
  source: 'fixture' | 'dom-contract' | 'orientation';
  components: ReadonlyArray<{
    id: string;                       // kebab, único; lista ordenada por id
    kind: 'control' | 'non-control';
    file: string;                     // CSS do componente, relativo à raiz, POSIX; único no registro
    classes: {
      root: readonly string[];        // compostos da caixa do componente (control: ao menos um)
      sizing: readonly string[];      // variantes que definem a altura da caixa (non-control: vazio)
      other: readonly string[];       // demais modificadores e estados da caixa
      parts: readonly string[];       // partes internas, que não são a caixa do controle
    };
  }>;
}
```

```json
{
  "$schema": "../schemas/control-registry.schema.json",
  "schemaVersion": 1,
  "source": "fixture",
  "components": [
    {
      "id": "button",
      "kind": "control",
      "file": "tools/stylelint-plugin/fixtures/design-tokens/valid/button.css",
      "classes": {
        "root": [".<prefixo>-button"],
        "sizing": [".<prefixo>-button--sm", ".<prefixo>-button[data-<prefixo>-size=\"lg\"]"],
        "other": [".<prefixo>-button--danger"],
        "parts": [".<prefixo>-button__icon"]
      }
    }
  ]
}
```

Regras do registro:

- Cada item de `classes` é um seletor composto formado só por seletores de classe e de atributo
  `data-<prefixo>-*`, comparado de forma normalizada (aspas duplas, simples ordenados no composto).
  Um mesmo composto aparece uma única vez no registro.
- `source: "fixture"` só é aceito para arquivos sob `tools/stylelint-plugin/fixtures/`; aplicado a
  outro arquivo, é erro de configuração (seção 2.2). O gate do núcleo usa registro com `source`
  `dom-contract` ou `orientation`.

Semântica:

- **Regra que dimensiona a caixa de um controle**: regra com ao menos um seletor complexo (depois
  de resolver aninhamento e expandir `:is()` e `:where()`) cujo composto mais à direita contém um
  simples classificado como `root`, `sizing` ou `other` de uma entrada `control`, não contém simples
  classificado como `parts` e não tem pseudoelemento. Pseudoclasses são permitidas: uma altura
  alterada em `:hover` também precisa vir da escala. Essas regras recebem a verificação
  `control-height`.
- **Presença**: para cada composto `root` e `sizing` de uma entrada `control` cujo `file` é o
  arquivo analisado, exige-se a regra de composto único descrita em `control-height-missing`.
- **Exaustividade**: `unclassified-component` garante que nenhuma classe nem atributo de
  componente escape da classificação, o que fecha o falso negativo silencioso de uma anotação
  esquecida (alternativa rejeitada em D6).

## 4. Regra `<prefixo>/contrast-pairs`

Confere que todo par de frente e fundo usado num estilo de componente consta do manifesto de
contraste (FR-021, A11Y-09). Reutiliza a resolução `var()` → token da seção 2.3. A medição das
razões é feita pela checagem de [contrast-manifest.md](contrast-manifest.md); esta regra só exige a
presença da tupla.

### 4.1 Opções

```ts
interface ContrastPairsOptions {
  manifestPath: string;              // tokens.manifest.json
  contrastManifestPath: string;      // packages/tokens/contrast/manifest.json no núcleo
  surfacesPath: string;              // packages/tokens/contrast/surfaces.json no núcleo
  controlRegistryPath: string;       // o mesmo registro da seção 3.7
  stateMap?: StateMap;               // padrão: mapa v1 versionado no plugin (seção 4.3)
  colorProperties?: ColorPropertyMap;// padrão: mapa v1 versionado no plugin (seção 4.2)
}

type State = 'default' | 'hover' | 'active' | 'focus-visible'
  | 'selected' | 'invalid' | 'disabled' | 'inactive';   // lido de manifest.schema.json

interface StateMap {
  schemaVersion: 1;
  selectors: ReadonlyArray<{ selector: string; state: State | 'none' }>; // pseudoclasse ou atributo
  stateLike: readonly string[];      // seletores tratados como estado; sem mapeamento → unmapped-state
  precedence: readonly State[];      // ordem de precedência quando há mais de um estado
}

interface ColorPropertyMap {
  schemaVersion: 1;
  text: readonly string[];           // frente de texto, interior
  nonText: readonly string[];        // frente não textual, interior
  border: readonly string[];         // frente não textual de borda: só em controles ou em focus-visible
  edge: readonly string[];           // anel e contorno: exigem anotação sempre
  focusEdge: readonly string[];      // como edge, mas só no estado focus-visible
  background: readonly string[];     // fundo (componente de cor)
  backgroundImage: readonly string[];// imagem de fundo
}
```

O manifesto de contraste e os conjuntos são validados pelos schemas de `packages/tokens/contrast/`
([contrast-manifest.md](contrast-manifest.md), seções 3 e 4). Os nomes de estado do `stateMap`
precisam pertencer ao vocabulário de `manifest.schema.json`.

### 4.2 Propriedades de cor (mapa v1)

| Grupo | Propriedades | Tipo do par |
| --- | --- | --- |
| `text` | `color`, `-webkit-text-fill-color` | `text` (ou `non-text` com `as non-text`, seção 4.4) |
| `nonText` | `fill`, `stroke`, `accent-color` | `non-text` |
| `border` | `border-color`, longhands `border-*-color`, e o componente de cor de `border` e `border-*` | `non-text`; só em regra que dimensiona ou estiliza um controle (simples de entrada `control`, inclusive `parts`) ou no estado `focus-visible` |
| `edge` | `outline`, `outline-color` | `non-text`; anotação obrigatória |
| `focusEdge` | `box-shadow` | `non-text`; só quando a declaração efetiva vem de regra `focus-visible`; anotação obrigatória; a frente é a cor da última camada da sombra |
| `background` | `background-color`, componente de cor de `background` | Fundo do sujeito |
| `backgroundImage` | `background-image`, camadas de imagem de `background` | Imagem sob texto é `unresolvable-color` |

Restringir bordas a controles segue o Understanding 1.4.11: a borda é exigida quando identifica um
componente de interface; em componentes que não são controles ela é tratada como decorativa. Essa
leitura fica registrada na seção 7 (R-7).

Resolução do valor de uma declaração de cor:

- `var()` de token permitido de `$type` `color`: esse token.
- `var()` de token composto de borda ou sombra: a referência do subvalor de cor no manifesto de
  tokens (na sombra, a da última camada).
- `currentcolor` numa propriedade não textual: o token de `color` efetivo do sujeito no estado; sem
  ele, `unresolvable-color`.
- `transparent`: nenhuma cor (frente sem par; fundo ausente).
- Palavra-chave global (`inherit`, `initial`, `unset`, `revert`, `revert-layer`): declaração tratada
  como ausente.
- Qualquer outro valor (literal, função de cor, `color-mix()`, `light-dark()`, sintaxe relativa,
  `var()` de nome não permitido, de outra categoria ou de custom property local): `unresolvable-color`.

### 4.3 Sujeito, estado e contexto

**Normalização dos seletores**: resolver o aninhamento; expandir listas de seletores e os
argumentos de `:is()` e `:where()` em seletores complexos separados.

**Sujeito**: o seletor complexo depois de remover os segmentos de estado de todos os compostos,
serializado de forma normalizada (espaços colapsados, simples ordenados em cada composto).
Pseudoelementos fazem parte do sujeito (`::placeholder` é sujeito distinto). Pseudoclasses
estruturais (`:first-child`, `:nth-*`, `:empty`, `:has()`, `:not()` de seletor sem estado) também
fazem parte do sujeito.

**Estado**: vem dos segmentos removidos, pelo mapa v1:

| Seletor | Estado |
| --- | --- |
| `:hover` | `hover` |
| `:active` | `active` |
| `:focus-visible`, `:focus`, `:focus-within` | `focus-visible` |
| `:checked`, `:indeterminate`, `[aria-selected="true"]`, `[aria-checked="true"]`, `[aria-checked="mixed"]`, `[aria-pressed="true"]`, `[aria-current]` (exceto `="false"`) | `selected` |
| `:invalid`, `:user-invalid`, `[aria-invalid="true"]` | `invalid` |
| `:disabled`, `[disabled]`, `[aria-disabled="true"]` | `disabled` |
| `[data-<prefixo>-state="<estado>"]`, com estado do vocabulário | o próprio estado |
| `:enabled`, `:link`, `:any-link` e `:not(<seletor só de estado>)` | `none`: removido do sujeito, sem estado |

`stateLike` v1 (estado sem mapeamento, que gera `unmapped-state`): `:visited`, `:target`,
`:target-within`, `:open`, `:popover-open`, `:modal`, `:placeholder-shown`, `:read-only`,
`:read-write`, `:autofill`, todo `[aria-*]` não listado acima e `[data-<prefixo>-state]` com valor
fora do vocabulário. O atributo `data-<prefixo>-state` é ilustrativo: o mapa é versionado e será
alinhado ao contrato de DOM (CMP-14) quando ele existir.

Precedência, quando um seletor tem mais de um estado mapeado: `disabled` > `inactive` > `invalid` >
`selected` > `focus-visible` > `active` > `hover` > `default`. Vale o estado de maior precedência.

**Contexto**: a cadeia de at-rules condicionais e de escopo que envolve a regra (`@media`,
`@container`, `@supports`, `@scope`), com parâmetros normalizados. `@layer` é transparente. Blocos
`@media (forced-colors: active)` são ignorados (seção 4.7).

**Declaração efetiva** de uma propriedade num sujeito, contexto C e estado S, da menor para a maior
precedência: regras sem condição no estado `default`; regras do contexto C no `default`; regras sem
condição no estado S; regras do contexto C no estado S. Dentro do mesmo grupo, vale a última no
arquivo; `!important` vence declaração normal da mesma propriedade. É uma aproximação da cascata
que não calcula especificidade completa; divergências ficam cobertas pelo axe (seção 4.8).

### 4.4 Anotação de fundo

Gramática (o comentário inteiro; `<prefixo>` é o prefixo real):

```text
anotação  = "<prefixo>-contrast:" ws "on" ws pilha [ ws "as" ws "non-text" ]
pilha     = base { ws camada }
base      = conjunto | token
camada    = token
conjunto  = "@" segmento-kebab              ; nome de surfaces.json
token     = "--<prefixo>-" nome             ; cssName de token público de cor
```

A forma `on <token> | @<conjunto>` usada na pesquisa descreve a alternativa da base (token **ou**
conjunto); a barra vertical não é sintaxe da anotação. Exemplos:

```css
/* <prefixo>-contrast: on --<prefixo>-color-bg-surface */
/* <prefixo>-contrast: on @surfaces */
/* <prefixo>-contrast: on @surfaces --<prefixo>-color-bg-scrim */
/* <prefixo>-contrast: on @surfaces as non-text */
```

- **Posição**: o comentário é o nó irmão imediatamente anterior à declaração de cor que anota, na
  mesma regra, com só espaço em branco entre os dois. Uma anotação descreve o que fica **por baixo
  ou por fora** do sujeito, de baixo para cima.
- **Herança entre estados**: a anotação de uma propriedade vale para a declaração efetiva dessa
  propriedade em todos os estados; se a declaração efetiva no estado S não tem anotação, vale a da
  declaração da mesma propriedade no estado `default`.
- **`as non-text`**: só numa declaração de `color` cujo sujeito não renderiza texto (por exemplo,
  ícone que herda `currentcolor`); muda o tipo do par para `non-text`.
- **Anotação em declaração de fundo**: marca o fundo como objeto gráfico não textual (trilho,
  indicador, marcador); o par passa a ser a cor desse fundo sobre a pilha anotada.

### 4.5 Formação dos pares e casamento com o manifesto

Para cada sujeito, contexto e estado presentes no arquivo:

1. **Frente interior** (`text`, `nonText`, `border`): pilha = anotação efetiva (se houver) seguida do
   fundo efetivo do sujeito no estado (se houver e não for `transparent`). Sem nenhum dos dois:
   `missing-background`.
2. **Frente de borda externa** (`edge`, `focusEdge`): pilha = anotação efetiva. Sem anotação:
   `missing-background`, mesmo que o sujeito declare fundo.
3. **Fundo gráfico** (declaração de fundo anotada): frente = cor do fundo; pilha = anotação; tipo
   `non-text`.
4. **Fundo sem frente**: declaração de fundo não anotada, num estado e contexto em que o sujeito não
   tem frente de texto efetiva: `missing-foreground` na declaração de fundo. Segue a falha F24 do
   WCAG (fundo sem cor de frente, ou o inverso).
5. **Imagem sob texto**: imagem de fundo diferente de `none` num estado em que o sujeito tem frente
   de texto: `unresolvable-color` na declaração da imagem.

   Uma declaração de cor com valor irresolvível conta como presente nos passos 4 e 5 (não gera
   `missing-foreground`), mas não forma par: o aviso dela é o `unresolvable-color` da folha.
6. **Avaliação única**: no estado `default` sem condição, todos os pares são avaliados. Num estado S
   ou contexto C, um par só é avaliado se ao menos uma das declarações de que depende vem de regra
   do estado S e, quando há condição, ao menos uma vem de regra do contexto C. Um par que não muda
   num estado é coberto pelo par do `default`, e o manifesto não precisa repeti-lo.
7. **Tupla canônica**: (caminho do token de frente, pilha como lista de caminhos de token, com o
   `@conjunto` na base quando houver, estado, tipo). Ela precisa ser igual à tupla de um par do
   manifesto, com `bg` normalizado para lista. `group`, `exempt` e `description` não entram no
   casamento: par isento conta como presente.
8. **Posição do aviso de par**: a declaração de que o par depende que vem do grupo de maior
   precedência da seção 4.3; em empate, a declaração de frente.

Exemplo de fusão por sujeito e estado:

```css
.<prefixo>-button {
  color: var(--<prefixo>-color-button-fg-default);
  background-color: var(--<prefixo>-color-button-bg-default);
}
.<prefixo>-button:hover {
  background-color: var(--<prefixo>-color-button-bg-hover);
}
```

Pares exigidos no manifesto: (`color.button.fg.default`, [`color.button.bg.default`], `default`,
`text`), com aviso possível na declaração de `color`; e (`color.button.fg.default`,
[`color.button.bg.hover`], `hover`, `text`), com aviso possível no `background-color` do `:hover`.

### 4.6 Subcódigos

Posições: `pair-not-in-manifest` conforme o passo 8 da seção 4.5; `missing-background` no início da
declaração de frente; `missing-foreground` no início da declaração de fundo; `unresolvable-color` no
início da folha (na imagem sob texto, no início da declaração); `invalid-annotation` no início do
comentário; `unmapped-state` no início do segmento de seletor.

#### `pair-not-in-manifest`

Dispara quando a tupla canônica de um par não existe no manifesto (cenário 4 da User Story 4).

```css
/* inválido: o manifesto não tem (color.fg.muted, [color.bg.raised], default, text) */
.<prefixo>-tag {
  color: var(--<prefixo>-color-fg-muted);              /* ← pair-not-in-manifest */
  background-color: var(--<prefixo>-color-bg-raised);
}
/* válido: o par passa a constar do manifesto (e a checagem de contraste o mede) */
```

#### `missing-background`

Dispara com frente interior sem fundo no sujeito e sem anotação, e com anel ou contorno sem
anotação.

```css
/* inválido */
.<prefixo>-link {
  color: var(--<prefixo>-color-fg-link);               /* ← missing-background */
}
.<prefixo>-button:focus-visible {
  outline: var(--<prefixo>-border-stroke-focus);              /* ← missing-background */
}
/* válido */
.<prefixo>-link {
  /* <prefixo>-contrast: on @surfaces */
  color: var(--<prefixo>-color-fg-link);
}
.<prefixo>-button:focus-visible {
  /* <prefixo>-contrast: on @surfaces */
  outline: var(--<prefixo>-border-stroke-focus);
}
```

#### `missing-foreground`

Dispara com fundo não anotado num sujeito sem frente de texto efetiva naquele estado.

```css
/* inválido */
.<prefixo>-card {
  background-color: var(--<prefixo>-color-bg-raised);   /* ← missing-foreground */
}
/* válido: declarar a frente no mesmo sujeito, ou anotar o fundo como objeto gráfico */
.<prefixo>-card {
  color: var(--<prefixo>-color-fg-default);
  background-color: var(--<prefixo>-color-bg-raised);
}
.<prefixo>-switch__track {
  /* <prefixo>-contrast: on @surfaces */
  background-color: var(--<prefixo>-color-switch-track-bg-default);
}
```

#### `unresolvable-color`

Dispara com expressão de cor que não resolve estaticamente para um token permitido (seção 4.2) e
com imagem sob texto. Nunca há silêncio: o que a regra não resolve é erro.

```css
/* inválido */
.<prefixo>-badge {
  color: color-mix(in srgb, var(--<prefixo>-color-fg-default) 80%, transparent);   /* ← unresolvable-color */
  background-color: var(--<prefixo>-color-bg-accent);
  background-image: linear-gradient(var(--<prefixo>-color-bg-accent), var(--<prefixo>-color-bg-raised)); /* ← unresolvable-color */
}
.<prefixo>-checkbox__box {
  border-color: currentcolor;                          /* ← unresolvable-color: parte de controle sem color */
}
/* válido */
.<prefixo>-badge {
  color: var(--<prefixo>-color-fg-on-accent);
  background-color: var(--<prefixo>-color-bg-accent);
}
```

#### `invalid-annotation`

Dispara com anotação de sintaxe inválida; com token inexistente, não público ou que não é cor; com
`@conjunto` inexistente ou fora da base; com `as non-text` fora de declaração de `color`; e com
anotação órfã (que não precede imediatamente uma declaração de cor). Anotação inválida é
desconsiderada na formação dos pares, então a declaração anotada segue as regras sem anotação e
costuma gerar também `missing-background`.

```css
/* inválido */
.<prefixo>-link {
  /* <prefixo>-contrast: over @surfaces */             /* ← invalid-annotation: sintaxe */
  color: var(--<prefixo>-color-fg-link);               /* ← missing-background */
}
.<prefixo>-tag {
  /* <prefixo>-contrast: on --<prefixo>-color-gray-50 */  /* ← invalid-annotation: primitivo */
  color: var(--<prefixo>-color-fg-muted);              /* ← missing-background */
  /* <prefixo>-contrast: on @cards */                  /* ← invalid-annotation: órfã e conjunto inexistente */
}
```

#### `unmapped-state`

Dispara, numa regra que declara propriedade de cor, com segmento de seletor da lista `stateLike`
sem mapeamento para o vocabulário. A regra com estado não mapeado fica fora da formação de pares.
Força a decisão explícita de ampliar o vocabulário (versionado,
[contrast-manifest.md](contrast-manifest.md), seção 5) em vez de deixar o estado sem par.

```css
/* inválido */
.<prefixo>-link:visited {                              /* ← unmapped-state */
  color: var(--<prefixo>-color-fg-link);
}
/* válido: regra de :visited sem propriedade de cor, ou vocabulário ampliado antes */
```

### 4.7 Estados isentos e `forced-colors`

- Seletores de estado desabilitado ou inativo **nunca** são ignorados. O par correspondente
  precisa constar do manifesto, normalmente com `exempt: "wcag-inactive"`: medido e reportado, sem
  falhar a checagem (FR-020). Assim a cobertura do A11Y-09 ("todo par usado no núcleo consta do
  manifesto") vale também para esses estados.
- Blocos `@media` cuja condição exige `forced-colors: active` (sem negação), e tudo o que eles
  contêm, inclusive anotações, são ignorados por esta regra: no modo de cores forçadas o sistema
  operacional substitui a paleta, e os pares de marca e modo não se aplicam.

### 4.8 Limites da análise estática

A regra não vê o aninhamento de DOM entre componentes, sobrescritas da app consumidora, estilos
inline, `opacity`, filtros e modos de mistura em ancestrais, nem imagens. A fusão por sujeito
aproxima a cascata, e uma anotação pode estar errada. Esses limites são cobertos pelo motor de
regras em navegador real do A11Y-02 e pela conferência de amostras de
[contrast-manifest.md](contrast-manifest.md) (seção 11). Anotações são revisadas no PR, com o dono
de acessibilidade como dono do manifesto (GOV-09).

## 5. Harness de fixtures

Prova os FR-021 e FR-024 e o SC-009: 100% dos erros esperados e zero falsos positivos.

```text
tools/stylelint-plugin/fixtures/
├── registry.fixture.json        # registro de controles, source "fixture", cobre todo arquivo abaixo
├── contrast/
│   ├── manifest.json            # pares sintéticos, validados pelo schema de packages/tokens/contrast
│   └── surfaces.json
├── design-tokens/
│   ├── valid/*.css
│   └── invalid/*.css
├── contrast-pairs/
│   ├── valid/*.css
│   └── invalid/*.css
└── gate-probe/
    └── probe.css                # violação proposital que prova o bloqueio do gate (seção 6)
```

O manifesto de tokens das fixtures é o `tokens.manifest.json` real de `@<prefixo>/tokens`, gerado
pelo build sobre as marcas sintéticas A e B (QA-15); as fixtures referenciam só tokens que existem
nele, sem lista escrita à mão. Renomear token publicado quebra as fixtures, o que é desejado
(mudança major, Princípio X).

**Comentário de expectativa** (só em `invalid/`):

```text
expectativa = "/*" ws "expect:" ws item { ws? "," ws? item } ws "*/"
item        = código "@" coluna
```

- A linha esperada é a linha em que o comentário começa; a coluna é obrigatória, contada a partir
  de 1, porque o casamento inclui a coluna.
- Repetir o mesmo `código@coluna` no comentário significa dois avisos esperados.
- O comentário fica no fim da linha, depois do `;` ou da `{`, para não se interpor entre uma
  anotação de contraste e a declaração que ela anota.
- Para avisos em linha 1, coluna 1 (`unclassified-component` de arquivo não registrado,
  `control-height-missing` sem regra), o comentário fica na linha 1.

Exemplo (`design-tokens/invalid/literal-value.css`):

```css
/* tools/stylelint-plugin/fixtures/design-tokens/invalid/literal-value.css */
.<prefixo>-card {
  padding: 12px; /* expect: literal-value@12 */
  color: #1a1a1a; /* expect: literal-value@10 */
  margin: 4px 8px; /* expect: literal-value@11, literal-value@15 */
}
```

Exemplo (`contrast-pairs/invalid/missing-background.css`):

```css
/* tools/stylelint-plugin/fixtures/contrast-pairs/invalid/missing-background.css */
.<prefixo>-link {
  color: var(--<prefixo>-color-fg-link); /* expect: missing-background@3 */
}
```

**Regras do harness** (Vitest, ambiente Node, via `stylelint.lint()` com `cache: false` e
`ignoreDisables: true`):

1. Cada regra roda isolada, com uma configuração que habilita só ela e aponta para os dados de
   fixture.
2. Todo arquivo de `valid/` produz zero avisos de qualquer tipo, inclusive aviso de opção inválida,
   erro de parse e aviso de depreciação. Arquivo de `valid/` com comentário `expect:` é erro do
   harness.
3. Para cada arquivo de `invalid/`, o multiconjunto de `{file, line, column, code}` dos avisos reais
   é igual ao multiconjunto das expectativas. Aviso a mais, a menos ou duplicado falha o teste.
   Arquivo de `invalid/` sem expectativa, ou com código desconhecido, é erro do harness.
4. Cobertura: todo código de `designTokensCodes` aparece em ao menos uma fixture inválida de
   `design-tokens/`, e todo código de `contrastPairsCodes`, em `contrast-pairs/`.
5. Combinação: os arquivos de `valid/` das duas regras passam também com as duas regras habilitadas
   juntas (é o que o gate executa), o que prova zero falsos positivos cruzados.
6. Fixtures obrigatórias além da cobertura mínima: variante de tamanho escrita como classe isolada
   e controle dimensionado só por padding (D6, correção do revisor); nomes sem prefixo
   (`--brand-blue`); remapeamento de custom property em variante; estado desabilitado com par isento
   presente (válido) e ausente (inválido); fundo translúcido do mesmo sujeito sem anotação de base
   opaca (`pair-not-in-manifest`); `@media (forced-colors: active)` com cores de sistema (válido).

## 6. Gate no CI

Configuração do gate (esboço do arquivo da raiz `stylelint.config.mjs`):

```js
// stylelint.config.mjs (raiz): configuração do gate
export default {
  plugins: ['@<prefixo>/stylelint-plugin'],
  overrides: [
    {
      files: [
        'tools/stylelint-plugin/fixtures/*/valid/*.css',
        'tools/stylelint-plugin/fixtures/gate-probe/*.css',
      ],
      rules: {
        '<prefixo>/design-tokens': [true, {
          manifestPath: '@<prefixo>/tokens/meta/tokens.manifest.json',
          controlRegistryPath: './tools/stylelint-plugin/fixtures/registry.fixture.json',
        }],
        '<prefixo>/contrast-pairs': [true, {
          manifestPath: '@<prefixo>/tokens/meta/tokens.manifest.json',
          contrastManifestPath: './tools/stylelint-plugin/fixtures/contrast/manifest.json',
          surfacesPath: './tools/stylelint-plugin/fixtures/contrast/surfaces.json',
          controlRegistryPath: './tools/stylelint-plugin/fixtures/registry.fixture.json',
        }],
      },
    },
    // Feature do núcleo: acrescenta um override para o CSS do núcleo, com o registro derivado
    // (source "dom-contract" ou "orientation") e o manifesto real de packages/tokens/contrast/.
  ],
};
```

Execução (`pnpm lint:styles`, tarefa raiz do turbo que depende de `@<prefixo>/tokens#tokens:build`):

```text
stylelint "tools/stylelint-plugin/fixtures/*/valid/*.css" \
  --config stylelint.config.mjs --ignore-disables --max-warnings 0 \
  --formatter json --output-file reports/lint-styles/stylelint.json
```

- `--ignore-disables` (equivalente a `ignoreDisables: true`): nenhum comentário
  `stylelint-disable` contorna o gate.
- `--max-warnings 0`: qualquer aviso falha, além dos erros.
- Relatório JSON em `reports/lint-styles/stylelint.json` (diretório proposto, fora do controle de
  versão, publicado como artefato do CI): é o relatório de zero violações do TOK-03 e evidência
  ligada na matriz do ACE-02. Sem cache do Stylelint no gate.
- Entrada vazia não é permitida: um glob sem arquivos falha.
- Códigos de saída: os da CLI do Stylelint, exceção documentada em [tools-cli.md](tools-cli.md)
  (seção 6): 0 sem problema; 2 com problema de regra (equivale ao 1 canônico); 64 erro de uso e 78
  configuração inválida (equivalem ao 2); 1 erro inesperado (equivale ao 3). O CI trata qualquer
  código diferente de zero como falha.
- Alvos nesta feature: as fixtures válidas e a sonda. O CSS da app de exemplo não é estilo de
  componente (o TOK-03 trata de estilo de componente), não tem entrada no registro de controles nem
  pares no manifesto de contraste, e por isso fica fora do gate, como registra também a seção 6 de
  [tools-cli.md](tools-cli.md).
- **Violação proposital** (constituição, "Rastreabilidade e aceite"): um passo do CI roda o mesmo
  comando sobre `tools/stylelint-plugin/fixtures/gate-probe/probe.css`, que começa com
  `/* stylelint-disable */` e contém um literal, e exige código de saída diferente de zero. Prova o
  bloqueio e o efeito de `--ignore-disables`.
- Na feature do núcleo, o glob do CSS do núcleo entra no mesmo comando, e o check passa a ser
  obrigatório na proteção de branch com relatório de zero violações (FR-024, TOK-03).

## 7. Restrições registradas para a feature do núcleo

Restrições que estas regras impõem ao núcleo de estilos, registradas no ADR-16 e no ADR-15 para o
aceitante:

- **R-1 Sem remapeamento de custom properties em variantes.** CSS de componente não declara custom
  property (`token-definition`). Variante troca a própria declaração por outro token de componente
  (`.<prefixo>-button--danger { background-color: var(--<prefixo>-color-button-bg-danger) }`); os
  tokens de cada variante nascem na fonte DTCG.
- **R-2 Allowlist de palavras-chave como leitura de "valor literal" (TOK-03).** Só `transparent`,
  `currentcolor`, `auto`, `none`, `0` (inclusive com unidade) e as palavras-chave globais são
  aceitas onde a propriedade é governada. Consequências: porcentagens (`width: 100%`), números como
  `opacity: 1`, `z-index: 1` e `line-height: 1`, `normal`, `bold`, palavras de easing, famílias
  genéricas, cores nomeadas, `env()` e `url()` em propriedade governada são literais. Cores de
  sistema só dentro de `@media (forced-colors: active)`.
- **R-3 Breakpoints.** Nenhum literal em `@media` ou `@container`; o caminho é custom media com o
  nome de um token de breakpoint, cuja geração e compilação a feature do núcleo decide.
- **R-4 Altura de controle.** Toda raiz de controle e toda variante de tamanho declaram `height`,
  `min-height`, `block-size` ou `min-block-size` com token da escala, direto ou por token de
  componente que é alias dela. Padding e line-height sozinhos não bastam.
- **R-5 Registro derivado.** O registro de controles do núcleo é gerado do contrato de DOM (CMP-14)
  ou do arquivo de orientação; registro mantido à mão não é aceito (Princípio I).
- **R-6 Pares de contraste explícitos.** Toda frente tem fundo no mesmo sujeito ou anotação; todo
  fundo tem frente de texto no mesmo sujeito ou anotação de objeto gráfico (F24); contorno e anel de
  foco sempre têm anotação; estado só por seletor mapeado; estado desabilitado nunca é omitido;
  `color-mix()`, `light-dark()`, cor relativa e gradiente ou imagem sob texto não são usados em
  estilo de componente.
- **R-7 Bordas.** O contraste de borda é exigido em controles (e em `focus-visible`); em
  componentes que não são controles a borda é tratada como decorativa (leitura do Understanding
  1.4.11, a confirmar com o aceitante).
- **R-8 Propriedades não governadas no mapa v1** (seção 3.2). Incluí-las depois é mudança
  versionada do plugin, revisada no PR.

## 8. Testes e rastreabilidade

| Teste | Onde | Prova |
| --- | --- | --- |
| Unitários da classificação de folhas, da resolução `var()` → token, da cadeia de alias até a escala, da normalização de seletores, da fusão por sujeito e estado e do parser da anotação | `tools/stylelint-plugin`, Vitest | QA-02 |
| Harness de fixtures (seção 5) | `tools/stylelint-plugin`, Vitest | FR-021, FR-024, SC-009, US5 cenários 1 a 4, US4 cenário 4 |
| Gate e violação proposital (seção 6) | CI, `pnpm lint:styles` | FR-022, FR-023, TOK-03, TOK-13 |
| Aresta de camada do plugin (`tools` → `tokens` só por `./meta/*`) | `pnpm check:layers` | ENG-01 |

| ID | Coberto por |
| --- | --- |
| FR-021, A11Y-09 | Seção 4 (regra de pares) e seção 5 |
| FR-022, TOK-03 | Seções 3.2 a 3.6 |
| FR-023, TOK-13 | Seções 3.5 (`control-height`, `control-height-missing`) e 3.7 |
| FR-024 | Seções 5 e 6 |
| FR-001 (defesa em profundidade) | `token-definition`; a varredura do repositório é `repo-checks scan-tokens` |
| ACE-02 | Relatório JSON do gate ligado na matriz de rastreabilidade |
