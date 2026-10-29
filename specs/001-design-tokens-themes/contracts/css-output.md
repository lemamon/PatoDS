# Contrato: saída CSS dos tokens

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) (D3, D5, D7) |
**Modelo**: [data-model.md](../data-model.md) | **Data**: 2026-10-21

Decisões de origem: [ADR-13](../../../docs/adr/ADR-13-escopos-marca-modo-css.md) (escopos de marca
e modo em CSS), [ADR-15](../../../docs/adr/ADR-15-cor-e-contraste.md) (cor e contraste) e
[ADR-11](../../../docs/adr/ADR-11-pipeline-build-tokens.md) (pipeline de build), todas com status
Proposto. Evidências, fontes e reverificação: [research/css-scopes.md](../research/css-scopes.md) e
[research/color-contrast.md](../research/color-contrast.md). Onde esses relatórios divergem do
[research.md](../research.md), vale o research.md: há um `base.css` neutro de marca separado dos
arquivos de marca, os tokens de eixo marca são tokens públicos e as fontes de eixo marca que
dependem do modo ficam sob o grupo raiz reservado `brand.`. As únicas variáveis privadas são os
toggles de modo.

`<prefixo>` é o marcador do prefixo do projeto (TODO(PREFIXO) da constituição v1.0.0). Os trechos
deste contrato o usam literalmente; o gerador recebe o prefixo como parâmetro, e o valor será
definido pelo requerente. DEVE, NÃO DEVE e PODE seguem a convenção da constituição.

O contrato dos módulos ESM e dos tipos está em [esm-output.md](esm-output.md).

## 1. Escopo e rastreabilidade

Este contrato fixa o CSS gerado pelo pacote `@<prefixo>/tokens` (`packages/tokens/`): arquivos e
conteúdo, camada e ordem das camadas, seletores, mecanismo de escopo de marca e modo, serialização
de valores, determinismo, verificações do CSS gerado, orientação de sobrescrita e testes em
navegador real.

| Requisito | Onde é atendido |
| --- | --- |
| FR-010, TOK-08, CMP-05 (parte de tema) | §9: dois atributos distintos e prefixados; §7: saída válida para toda combinação |
| FR-011, TOK-09 | §4 e §13 (`css-combinations`): mesmo conjunto de nomes em todo arquivo de marca; resolvedor único |
| FR-012, TOK-14 (nível de CSS) | §7: todo escopo redeclara os tokens; §9, R-02 |
| FR-013, CMP-24 | §2 (U-01 a U-04) e §9, R-03 |
| FR-014 | §9, R-04 |
| FR-015, TOK-05 | §2 (U-05) e §12 |
| FR-017, ENG-06, SC-006 | §2, §4, §10 e §13 (`css-brand-selector`, `css-base-brand-value`) |
| FR-018 | §16 (BR-14, BR-15) |
| FR-020 (insumo) | §11: o valor medido pelo contraste é o valor emitido |
| ADR-03, MIG-07, MIG-14 (coordenação) | §3 |
| ENG-08 | §15: o mecanismo não exige nada além de `@layer` |

## 2. Arquivos publicados

| Arquivo gerado | Importação pela app | Conteúdo | Quantidade |
| --- | --- | --- | --- |
| `dist/css/base.css` | `@<prefixo>/tokens/css/base.css` | Declaração da ordem das camadas; primitivos compartilhados; toggles de modo com o modo padrão; resolvedor de tokens | Um |
| `dist/css/brand-<id>.css` | `@<prefixo>/tokens/css/brand-<id>.css` | Declaração da ordem das camadas; uma regra da marca `<id>` com os primitivos exclusivos dela, os tokens de eixo marca e as fontes marca-modo | Um por contexto do modificador `brand` de `src/tokens.resolver.json` |

O `base.css` não contém valor exclusivo de nenhuma marca, e cada `brand-<id>.css` contém só
seletores da sua marca (definições operacionais na §10).

Regras de uso, normativas para apps e testes:

- **U-01** A app DEVE importar `base.css` e ao menos um arquivo de marca. Nenhum dos dois funciona
  sozinho.
- **U-02** Se a app não importa o arquivo da marca padrão, DEVE marcar a raiz do documento com
  `data-<prefixo>-brand` igual a uma marca importada (FR-013). Sem isso, os tokens de marca não têm
  declaração aplicável, e a configuração não é suportada.
- **U-03** A ordem de importação entre `base.css` e os arquivos de marca, e entre arquivos de marca,
  não altera o resultado (§5).
- **U-04** A app PODE importar várias marcas. A marca padrão, se importada, vale nos escopos sem
  atributo de marca; as demais só têm efeito nos escopos que as selecionam.
- **U-05** O CSS de tokens é sempre gerado (FR-015). `packages/tokens/dist/` fica no `.gitignore`,
  `pnpm check:drift` falha se algum arquivo gerado estiver versionado, e `pnpm check:scan` acusa
  declaração de custom property com valor literal fora da fonte de tokens.
- **U-06** Adicionar uma marca cria um novo `brand-<id>.css` sem alterar o `package.json`, porque a
  exportação `./css/brand-*.css` já o cobre (FR-009, SC-005). O relatório de API regenerado também
  muda ([esm-output.md](esm-output.md), §11.3).

## 3. Camada e fonte única da ordem das camadas

- **L-01** Toda regra de estilo dos tokens fica dentro de `@layer <prefixo>.tokens { … }`. Nenhum
  arquivo dos tokens tem regra fora dessa camada, de modo que CSS da app fora de camada vence sem
  disputa de especificidade (ADR-03).
- **L-02** Todo arquivo publicado, depois do comentário de cabeçalho, começa com a mesma declaração
  de ordem das camadas, igual byte a byte no `base.css` e em todos os arquivos de marca. Na Fase 1 a
  declaração é `@layer <prefixo>.tokens;`. A ordem das camadas é fixada pela primeira aparição, e
  qualquer arquivo pode ser carregado primeiro; redeclarar camadas já conhecidas não muda a ordem.
- **L-03** A lista ordenada de camadas do PatoDS é um fato único com uma fonte única, mantida pela
  camada mais baixa (tokens), da qual o núcleo pode depender e que nunca depende do núcleo.
  Local decidido no plano (research.md, D8): arquivo versionado `packages/tokens/src/layers.json`, na
  forma `{ "order": ["<prefixo>.tokens"] }`. O gerador emite a declaração da L-02 a partir dele e
  copia a lista para o campo `layerOrder` de `dist/meta/tokens.manifest.json`.
- **L-04** Coordenação com o MIG-14 (Fase 2): o núcleo de estilos acrescenta as suas camadas nesse
  mesmo arquivo, depois de `<prefixo>.tokens`, e emite a mesma declaração lendo `layerOrder` do
  manifesto. A checagem de CI do MIG-14, que compara a lista documentada com a declaração `@layer`
  do CSS distribuído, DEVE cobrir também `base.css` e todo `brand-<id>.css`. Na Fase 1, a verificação
  `css-layer` (§13) compara a declaração emitida com a fonte.
- **L-05** `<prefixo>.tokens` é sempre o primeiro item da lista (camada mais baixa). Os nomes seguem
  a forma `<prefixo>.<segmento-kebab>`. Reordenar, renomear ou remover uma camada é mudança
  incompatível (major); acrescentar uma camada no fim é compatível (classificação no relatório de
  API, [esm-output.md](esm-output.md), §11).
- **L-06** Nenhuma declaração dos tokens usa `!important`, e nenhum arquivo usa `@import`, `@media`,
  `@supports`, `@container`, `@scope` ou `@property`.

## 4. Onde cada tipo de token é declarado

"Regra da marca X" é a regra de `brand-X.css` cujo seletor é `[data-<prefixo>-brand="X"]`; no
arquivo da marca padrão, e só nele, o seletor é `:where(:root), [data-<prefixo>-brand="X"]`.

| Tipo de token (data-model) | Arquivo | Regra | Forma do valor |
| --- | --- | --- | --- |
| Primitivo compartilhado | `base.css` | `:where(:root)` | Literal serializado (§11) ou `var()` de outro primitivo do `base.css` |
| Primitivo exclusivo da marca X | `brand-X.css` | Regra da marca X | Literal ou `var()` de primitivo do `base.css` ou do mesmo arquivo |
| Semântico de eixo marca, papel `public` | `brand-<id>.css` de toda marca | Regra da marca | `var()` de primitivo, de token semântico invariante ou de outra declaração da regra da mesma marca (DEP-01) |
| Fonte marca-modo, papel `brand-mode-source` (`brand.<categoria>….<modo>`) | `brand-<id>.css` de toda marca | Regra da marca | Igual à linha anterior |
| Semântico de eixo modo | `base.css` | Resolvedor | Forma de toggles (§7) |
| Semântico invariante | `base.css` | Resolvedor | `var()` ou valor composto com `var()` |
| Componente | `base.css` | Resolvedor | `var()` ou valor composto com `var()` |
| Toggle privado de modo | `base.css` | Regras de modo | Literal `initial` ou vazio (§6) |

**Partição dos primitivos** (D7). Um primitivo P é exclusivo da marca X quando (a) existe ao menos
um token não primitivo que depende de P, direta ou transitivamente; (b) todo token não primitivo
que depende de P pertence ao contexto da marca X (token de eixo marca ou fonte marca-modo de X); e
(c) todo primitivo que depende de P também é exclusivo de X. Os demais primitivos, inclusive os que
não têm referência, vão para o `base.css`. Primitivos são invariantes (D7): têm o mesmo valor em
toda permutação, e a partição decide só em que arquivo a declaração aparece. Consequências: o
`base.css` nunca referencia primitivo exclusivo; as únicas declarações de arquivo de marca que o
`base.css` referencia são as de nomes presentes em todos os arquivos de marca (tokens de eixo marca
e fontes marca-modo).

**Restrições de dependência impostas pela forma de saída.** A fonte já as garante
([token-source.md](token-source.md), seções 7.2 e 7.3); o build as confere de novo na saída
(`css-scope-dependency`, §13):

- **DEP-01** Declarações da regra da marca só dependem de primitivos, de tokens semânticos
  invariantes e de outras declarações da regra da mesma marca; nunca de token de eixo modo nem de
  componente (AX-2, `TKN-AXIS-DEPENDENCY`). A regra da marca não é reavaliada num escopo só de
  modo, e uma dependência de modo congelaria o modo vigente no escopo de marca. Ler um token
  invariante no escopo de marca é seguro: ele não depende de eixo nenhum (AX-1) e o resolvedor o
  declara no mesmo elemento.
- **DEP-02** Tokens do resolvedor só referenciam uma fonte marca-modo dentro da forma de toggles do
  token de eixo modo correspondente, com o sufixo de modo igual ao modo do toggle (V-08). Nenhum
  token invariante ou de componente referencia `brand.…` (`TKN-BRAND-SOURCE-REF`).
- **DEP-03** Todo alias de token inteiro vira `var(--<prefixo>-<alvo>)` sem fallback. Alias em
  subvalor de composto vira `var()` na posição do subvalor. `$ref` (só na camada primitiva, V-05) é
  resolvido no build e emitido como literal.
- **DEP-04** Cada token publicado corresponde a exatamente uma custom property, de nome
  `--<prefixo>-` seguido dos segmentos do caminho unidos por `-` (ex.: `color.bg.surface` →
  `--<prefixo>-color-bg-surface`; `brand.color.bg.surface.light` →
  `--<prefixo>-brand-color-bg-surface-light`). Colisão de nome CSS entre caminhos distintos é erro de
  validação (`TKN-NAME-COLLISION`). Segmentos públicos são kebab ASCII minúsculo sem `_`, então o
  espaço privado `--<prefixo>-_*` é disjunto por construção.

O manifesto `dist/meta/tokens.manifest.json` ([build-manifests.md](build-manifests.md)) DEVE expor,
por token, `cssName` e `placement`
(`base`, `brand` ou `brand-exclusive`, com `exclusiveBrand` no último caso). Esses campos alimentam
o lint de estilos, os testes em navegador (§16) e a checagem do ENG-06.

## 5. Seletores e níveis de especificidade

O CSS gerado usa só os seletores abaixo; qualquer outro é violação (`css-brand-selector` ou
`css-syntax`).

| Nível | Seletor | Especificidade | Arquivo | Declara |
| --- | --- | --- | --- | --- |
| N0 | `:where(:root)` | (0,0,0) | `base.css` | Primitivos compartilhados |
| N0 | `:where(:root)` na regra do modo padrão | (0,0,0) | `base.css` | Toggles do modo padrão e `color-scheme` |
| N0 | `:where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode])` | (0,0,0) | `base.css` | Resolvedor |
| N0 | `:where(:root)` na regra da marca padrão | (0,0,0) | `brand-<padrão>.css` | Valores da marca padrão |
| N1 | `[data-<prefixo>-mode="light"]`, `[data-<prefixo>-mode="dark"]` | (0,1,0) | `base.css` | Toggles do modo e `color-scheme` |
| N1 | `[data-<prefixo>-brand="<id>"]` | (0,1,0) | `brand-<id>.css` | Valores da marca `<id>` |

Por que a ordem de origem não importa (U-03):

1. As propriedades declaradas no `base.css` e nos arquivos de marca são disjuntas
   (`css-base-brand-value`), então a posição relativa entre `base.css` e arquivos de marca é
   indiferente.
2. Entre arquivos de marca os nomes de eixo marca se repetem, mas num mesmo elemento casa no máximo
   uma regra N1 de marca, porque o atributo tem um só valor, e ela vence qualquer regra N0. A única
   regra N0 de marca é a do arquivo da marca padrão, e existe uma só marca padrão.
3. Os toggles são declarados por uma regra N0 (`:where(:root)`) e por regras N1 de modo, e um
   elemento casa no máximo uma regra de modo.
4. Arquivos importados duas vezes repetem declarações idênticas.

## 6. Toggles privados de modo

- **T-01** Para cada modo `<m>` do modificador `mode` existe um toggle `--<prefixo>-_on-<m>`. Na
  versão atual: `--<prefixo>-_on-light` e `--<prefixo>-_on-dark`.
- **T-02** Toggle ligado vale o literal `initial` (valor garantidamente inválido, que faz o
  `var()` usar o fallback). Toggle desligado vale vazio, escrito `--<prefixo>-_on-<m>: ;` (o valor
  vazio é válido em css-variables-1 e substitui nada). Em cada regra de modo, exatamente um toggle
  está ligado.
- **T-03** O valor do toggle é sempre literal. Ele NUNCA é atribuído por indireção, como
  `--<prefixo>-_on-light: var(--algo-que-vale-initial)`, porque o WebKit não produz o valor
  garantidamente inválido nesse caso (bug 243247, aberto).
- **T-04** Toggles são declarados só nas regras de modo do `base.css`: a regra do modo padrão, cujo
  seletor é `:where(:root), [data-<prefixo>-mode="<padrão>"]`, e uma regra
  `[data-<prefixo>-mode="<m>"]` para cada outro modo. Essas regras também definem
  `color-scheme: <m>`, a única propriedade padrão (não custom) do CSS de tokens, para que controles
  nativos acompanhem o modo da subárvore.
- **T-05** Os toggles são privados: ficam fora do ESM, do `.d.ts`, do relatório de API, do contrato
  de DOM, da sincronização com a ferramenta de design e da definição de "variável sem valor"
  (§10.1). Apps NÃO DEVEM ler, declarar nem registrar (`@property`) variáveis `--<prefixo>-_*`.

## 7. Resolvedor

- **RS-01** O resolvedor é uma regra única no `base.css`, com o seletor exato
  `:where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode])`. Ele casa a raiz e todo elemento
  que tem um dos atributos, com valor válido ou não; esses elementos são os escopos de tema.
- **RS-02** O resolvedor declara todo token semântico de eixo modo, todo token semântico
  invariante e todo token de componente. Nenhum desses tokens é declarado em outro lugar. Tokens
  invariantes não dependem de eixo (AX-1) e funcionariam na raiz, mas ficam no resolvedor conforme
  o D3: há uma regra só para tudo o que não é de marca, e trocar o eixo de um token entre
  invariante e modo não move a declaração.
- **RS-03** Token de eixo modo usa a forma de toggles, com os modos na ordem canônica (modo padrão
  primeiro, depois os demais por code point; hoje `light`, `dark`) e sem nenhum caractere entre o `)`
  de um toggle e o `var(` do seguinte:

  ```css
  --<prefixo>-color-bg-surface: var(--<prefixo>-_on-light, var(--<prefixo>-brand-color-bg-surface-light))var(--<prefixo>-_on-dark, var(--<prefixo>-brand-color-bg-surface-dark));
  ```

  Cada fallback é o valor serializado daquele modo. Um espaço separando os toggles apareceria no
  valor computado (`"#ffffff "`), quebrando comparação exata, leitura por JavaScript e consultas de
  estilo; a forma sem espaço foi verificada em Chromium, Firefox e WebKit, com e sem minificação
  (research/css-scopes.md, reverificação).
- **RS-04** Token invariante ou de componente usa o valor serializado direto (alias como `var()`).
- **RS-05** Por que funciona: o valor computado de uma custom property é o valor especificado com
  os `var()` substituídos, e é esse valor que herda (css-variables-1). As declarações da regra da
  marca vêm do escopo de marca mais próximo; os toggles vêm do escopo de modo mais próximo; e o
  resolvedor recalcula todos os tokens em todo escopo de qualquer eixo. Assim, para cada eixo, vale o
  escopo mais próximo (FR-012), e "cada escopo redeclara os tokens semânticos" (TOK-14) vale
  literalmente. Um alias de componente também é recalculado em cada escopo, por isso tokens de
  componente nunca ficam congelados num escopo externo.
- **RS-06** O mecanismo vale para qualquer tipo de token (cor, sombra com várias camadas, opacidade,
  dimensão), porque o toggle escolhe o valor inteiro.

## 8. Esboço completo com as marcas sintéticas `a` (padrão) e `b`

Fonte sintética do esboço (QA-15). Ela é parcial: ilustra cada tipo de declaração, mas não cobre
as onze categorias. Os nomes seguem a gramática de [token-source.md](token-source.md), seção 8; os
valores são ilustrativos.

| Token | Camada e eixo | Valor na fonte |
| --- | --- | --- |
| `color.black-alpha.400` | primitivo | sRGB (0, 0, 0), alfa 0,4 |
| `color.neutral.0`, `color.neutral.900` | primitivo | `#ffffff`, `#101418` |
| `color.blue.600`, `color.blue.950` | primitivo (só usado por `a`) | `#1f5fd1`, `#0a1a3a` |
| `color.green.700`, `color.green.950` | primitivo (só usado por `b`) | `#1d6b45`, `#0b2a1b` |
| `radius.2`, `radius.4` | primitivo (só `a`; só `b`) | `4px`, `8px` |
| `size.40`, `space.4`, `z-index.400` | primitivo | `40px`, `16px`, `400` |
| `color.bg.accent` | semântico, eixo marca | `a`: `{color.blue.600}`; `b`: `{color.green.700}` |
| `radius.control.default` | semântico, eixo marca | `a`: `{radius.2}`; `b`: `{radius.4}` |
| `brand.color.bg.surface.light` | fonte marca-modo | `a` e `b`: `{color.neutral.0}` |
| `brand.color.bg.surface.dark` | fonte marca-modo | `a`: `{color.blue.950}`; `b`: `{color.green.950}` |
| `color.bg.surface` | semântico, eixo modo | `light` → `{brand.color.bg.surface.light}`; `dark` → `{brand.color.bg.surface.dark}` |
| `color.fg.default` | semântico, eixo modo | `light` → `{color.neutral.900}`; `dark` → `{color.neutral.0}` |
| `color.bg.scrim` | semântico invariante | `{color.black-alpha.400}` |
| `size.control.md`, `space.inset.md`, `z-index.layer.modal` | semântico invariante | `{size.40}`, `{space.4}`, `{z-index.400}` |
| `color.button.bg.default`, `radius.button`, `size.button.control-height.md` | componente | `{color.bg.accent}`, `{radius.control.default}`, `{size.control.md}` |
| `color.card.bg.default` | componente | `{color.bg.surface}` |

`dist/css/base.css`:

```css
/* @<prefixo>/tokens: generated file, do not edit. */
@layer <prefixo>.tokens;
@layer <prefixo>.tokens {
  :where(:root) {
    --<prefixo>-color-black-alpha-400: rgb(0 0 0 / 0.400);
    --<prefixo>-color-neutral-0: #ffffff;
    --<prefixo>-color-neutral-900: #101418;
    --<prefixo>-size-40: 40px;
    --<prefixo>-space-4: 16px;
    --<prefixo>-z-index-400: 400;
  }

  :where(:root), [data-<prefixo>-mode="light"] {
    --<prefixo>-_on-dark: ;
    --<prefixo>-_on-light: initial;
    color-scheme: light;
  }

  [data-<prefixo>-mode="dark"] {
    --<prefixo>-_on-dark: initial;
    --<prefixo>-_on-light: ;
    color-scheme: dark;
  }

  :where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode]) {
    --<prefixo>-color-bg-scrim: var(--<prefixo>-color-black-alpha-400);
    --<prefixo>-color-bg-surface: var(--<prefixo>-_on-light, var(--<prefixo>-brand-color-bg-surface-light))var(--<prefixo>-_on-dark, var(--<prefixo>-brand-color-bg-surface-dark));
    --<prefixo>-color-button-bg-default: var(--<prefixo>-color-bg-accent);
    --<prefixo>-color-card-bg-default: var(--<prefixo>-color-bg-surface);
    --<prefixo>-color-fg-default: var(--<prefixo>-_on-light, var(--<prefixo>-color-neutral-900))var(--<prefixo>-_on-dark, var(--<prefixo>-color-neutral-0));
    --<prefixo>-radius-button: var(--<prefixo>-radius-control-default);
    --<prefixo>-size-button-control-height-md: var(--<prefixo>-size-control-md);
    --<prefixo>-size-control-md: var(--<prefixo>-size-40);
    --<prefixo>-space-inset-md: var(--<prefixo>-space-4);
    --<prefixo>-z-index-layer-modal: var(--<prefixo>-z-index-400);
  }
}
```

`dist/css/brand-a.css` (marca padrão):

```css
/* @<prefixo>/tokens: generated file, do not edit. */
@layer <prefixo>.tokens;
@layer <prefixo>.tokens {
  :where(:root), [data-<prefixo>-brand="a"] {
    --<prefixo>-brand-color-bg-surface-dark: var(--<prefixo>-color-blue-950);
    --<prefixo>-brand-color-bg-surface-light: var(--<prefixo>-color-neutral-0);
    --<prefixo>-color-bg-accent: var(--<prefixo>-color-blue-600);
    --<prefixo>-color-blue-600: #1f5fd1;
    --<prefixo>-color-blue-950: #0a1a3a;
    --<prefixo>-radius-2: 4px;
    --<prefixo>-radius-control-default: var(--<prefixo>-radius-2);
  }
}
```

`dist/css/brand-b.css`:

```css
/* @<prefixo>/tokens: generated file, do not edit. */
@layer <prefixo>.tokens;
@layer <prefixo>.tokens {
  [data-<prefixo>-brand="b"] {
    --<prefixo>-brand-color-bg-surface-dark: var(--<prefixo>-color-green-950);
    --<prefixo>-brand-color-bg-surface-light: var(--<prefixo>-color-neutral-0);
    --<prefixo>-color-bg-accent: var(--<prefixo>-color-green-700);
    --<prefixo>-color-green-700: #1d6b45;
    --<prefixo>-color-green-950: #0b2a1b;
    --<prefixo>-radius-4: 8px;
    --<prefixo>-radius-control-default: var(--<prefixo>-radius-4);
  }
}
```

Leitura do esboço:

- `color.neutral.*` é usado pelas duas marcas e por `color.fg.default` (fora do eixo marca), por
  isso fica no `base.css`. `color.blue.*` e `radius.2` são exclusivos de `a`; `color.green.*` e
  `radius.4`, de `b`; cada grupo fica no arquivo da sua marca.
- `brand-a.css` e `brand-b.css` declaram o mesmo conjunto de nomes de eixo marca e de fontes
  marca-modo (paridade estrutural, TOK-09); só os primitivos exclusivos diferem.
- `color.bg.surface` varia por marca e por modo, então é token de eixo modo cujo valor em cada modo
  é alias para a fonte marca-modo (FR-033). O resolvedor o recalcula em todo escopo com os toggles
  do escopo de modo mais próximo e as fontes do escopo de marca mais próximo.
- O resolvedor referencia `--<prefixo>-color-bg-accent`, `--<prefixo>-radius-control-default` e as
  fontes `--<prefixo>-brand-…`, declarados em todos os arquivos de marca; por isso o `base.css` não
  funciona sem um arquivo de marca (U-01).
- `color.card.bg.default` é alias de componente para um token de eixo modo; num escopo só de modo,
  ele acompanha o novo modo porque também é recalculado ali.
- O formato do esboço é normativo quanto a espaços e ordem: cabeçalho fixo, indentação de dois
  espaços, uma declaração por linha, `nome: valor;`, uma linha em branco entre regras, regras na
  ordem primitivos → regras de modo (padrão primeiro) → resolvedor, declarações ordenadas por code
  point e arquivo terminado por uma quebra de linha.

## 9. API de atributos e regras de resolução

| Atributo | Valores válidos | Onde | Efeito |
| --- | --- | --- | --- |
| `data-<prefixo>-brand` | Id de uma marca cujo arquivo a página importou (nas fixtures: `a`, `b`) | Qualquer elemento | Marca do elemento e da subárvore |
| `data-<prefixo>-mode` | `light`, `dark` | Qualquer elemento | Modo do elemento e da subárvore, inclusive `color-scheme` |

- **R-01** Marca e modo são eixos independentes: qualquer marca combina com qualquer modo, e um
  elemento PODE ter os dois atributos, um deles ou nenhum (FR-010).
- **R-02** Para cada eixo vale o escopo mais próximo daquele eixo, no próprio elemento ou no
  ancestral mais próximo com valor válido (FR-012). Escopo que define só o modo herda a marca do
  ancestral, e vice-versa.
- **R-03** Sem atributo válido de modo no elemento nem em ancestral, vale o modo padrão (`light`,
  premissa do spec). Sem atributo válido de marca, vale a marca padrão (indicada pelo requerente,
  CMP-24; `a` nas fixtures), desde que o arquivo dela esteja importado; caso contrário aplica-se a
  U-02 (FR-013).
- **R-04** Valor inválido é ignorado naquele eixo: o elemento continua sendo escopo (casa o
  resolvedor) e recalcula os tokens a partir das entradas herdadas, mantendo os valores do ancestral
  mais próximo, sem variável sem valor (FR-014). São inválidos: id inexistente, valor vazio, modo
  fora da lista e id de marca cujo arquivo não foi importado.
- **R-05** A comparação de valor é exata: sensível a maiúsculas e minúsculas (`Dark` é inválido) e
  sem aparar espaços (` dark` é inválido).
- **R-06** Definir, trocar ou remover atributos em tempo de execução atualiza os valores sem
  recarregar a página e sem código do PatoDS, porque o mecanismo é só CSS (FR-018). Pelo mesmo
  motivo, o HTML do servidor com os atributos já produz os valores certos, sem JavaScript.
- **R-07** Valor efetivo de um eixo num elemento: valor do ancestral mais próximo (inclusive o
  próprio elemento) cujo atributo daquele eixo tem valor válido; sem nenhum, o padrão da R-03. Essa é
  a definição do oráculo dos testes (§16).

## 10. Definições operacionais

### 10.1 Variável sem valor

Conforme a seção Clarifications do spec (interpretação a confirmar com o aceitante): é token
público `--<prefixo>-*` (nome sem o segmento privado `_`) vazio ou garantidamente inválido, ou
`var()` sem fallback que resolva assim. Os toggles privados `--<prefixo>-_on-*` são vazios ou
`initial` por desenho e ficam fora. Verificação:

- **Estática** (`css-var-undeclared`): todo `var()` sem fallback do CSS publicado aponta para uma
  declaração que existe no próprio arquivo; ou, a partir de um arquivo de marca, no `base.css`; ou, a
  partir do `base.css`, em todos os arquivos de marca (nomes de eixo marca e fontes marca-modo). Com
  U-01 e U-02, toda referência tem declaração aplicável em todo elemento. Os únicos `var()` com
  fallback são os toggles.
- **Em navegador** (BR-18): em toda configuração suportada (U-01 e U-02), para todo elemento E com
  marca efetiva b e modo efetivo m (R-07), e para todo token N do mapa `values[b][m]` exceto os
  primitivos exclusivos de outra marca, `getComputedStyle(E).getPropertyValue(cssName(N))` é não
  vazio e igual, sem aparar, a `values[b][m][N]` do tarball.

### 10.2 Só seletores dessa marca

- Em `brand-X.css`, toda regra de estilo tem o seletor exato `[data-<prefixo>-brand="X"]` ou, só no
  arquivo da marca padrão, `:where(:root), [data-<prefixo>-brand="X"]`. Não há outro seletor,
  combinador, pseudoclasse, atributo de modo nem atributo com outro id.
- O único conteúdo neutro de marca permitido num arquivo de marca é a declaração de ordem das
  camadas e o bloco `@layer`, que não são seletores.
- O `base.css` não tem seletor com valor de marca; o atributo de marca aparece nele só por presença,
  dentro do resolvedor.

### 10.3 Variável exclusiva de uma marca

Custom property declarada em `brand-X.css` e em nenhum outro arquivo publicado. Pela §4, são
exatamente os primitivos exclusivos de X; os nomes de eixo marca e de fontes marca-modo existem em
todos os arquivos de marca e não são exclusivos. A app de exemplo que importa `base.css` e só
`brand-a.css` (FR-017) é verificada assim: o CSS do bundle de produção não contém nenhum nome
exclusivo de outra marca nem seletor `[data-<prefixo>-brand="<outro id>"]`, e o BR-18 passa.

## 11. Serialização de valores

Toda serialização é feita pelo pacote de ferramentas e é a mesma no CSS, no mapa de valores do ESM
(`./values`) e na checagem de contraste.

| `$type` DTCG | Forma emitida |
| --- | --- |
| `color` opaca (alfa 1 depois da quantização) | `#rrggbb`, seis dígitos hexadecimais minúsculos |
| `color` com alfa < 1 | `rgb(r g b / a)`, com r, g e b inteiros de 0 a 255 e `a` com exatamente três casas decimais (ex.: `rgb(0 0 0 / 0.400)`) |
| `dimension` | Número seguido da unidade da fonte (`px` ou `rem`), sempre com unidade, inclusive zero (`0px`) |
| `duration` | Número em `ms` (fonte em `s` é convertida) |
| `number` | Número |
| `fontWeight` | Número de 1 a 1000 (nomes DTCG convertidos para o número correspondente) |
| `fontFamily` | Nomes separados por `, `; palavras-chave genéricas do CSS sem aspas, demais nomes entre aspas duplas com `"` e `\` escapados |
| `cubicBezier` | `cubic-bezier(x1, y1, x2, y2)` |
| `strokeStyle` (palavra-chave) | A palavra-chave (`solid`, `dashed` etc.) |
| `border` | `<width> <style> <color>` |
| `shadow` | `[inset ]<offsetX> <offsetY> <blur> <spread> <color>`; lista separada por `, ` na ordem da fonte |
| `transition` | `<duration> <timingFunction> <delay>` |

Regras:

- **S-01 Cor** (D5): os componentes DTCG são a fonte de verdade. O valor emitido é a saída de
  `toEmittedSrgb()` do pacote `@<prefixo>/color`: conversão para sRGB e mapeamento de gamut pelo
  algoritmo do CSS Color 4 (método `css`, deltaEOK com JND 0,02, sempre passado explicitamente),
  seguido de quantização em 8 bits. O alfa é quantizado para três casas decimais; se o resultado for
  1,000, emite-se a forma opaca. Não se emitem cores nomeadas, `transparent`, `oklch()` nem
  `color(display-p3 …)`. O checker de contraste compõe com o alfa lido de volta da string emitida,
  de modo que o medido é o emitido.
- **S-02 Números**: notação decimal sem expoente, sem `+`, sem zeros à direita, com zero antes do
  ponto (`0.5`) e `-0` escrito `0`. Valor que exigiria expoente ou mais de quatro casas decimais é
  rejeitado na validação, em vez de arredondado em silêncio.
- **S-03 Aliases**: alias vira `var(--<prefixo>-<alvo>)` (DEP-03). O mapa de valores do ESM traz
  sempre o valor final resolvido, sem `var()`, que é igual ao valor computado da custom property no
  navegador.
- **S-04 Sem serialização fiel**: o `$type` `typography` composto e o `strokeStyle` em forma de
  objeto não têm representação num único valor CSS sem perda (o shorthand `font` não carrega
  `letterSpacing` e redefine outras subpropriedades). Como cada token corresponde a exatamente uma
  custom property (DEP-04), o build rejeita esses valores em token publicado (código
  `unserializable-value`, saída 1), e a tipografia é publicada por tokens atômicos (`fontFamily`,
  `fontWeight`, `dimension`, `number`), que a gramática da fonte já prevê (`typography.family`,
  `.weight`, `.size`, `.line-height`, `.letter-spacing`). Ver §17, P-02 (decidida).
- **S-05** Os serializadores de `@terrazzo/token-tools/css` PODEM ser reutilizados onde a saída
  coincide byte a byte com este contrato; havendo diferença, vale o contrato, e as saídas de ouro do
  pacote de ferramentas detectam a mudança a cada atualização (D1).

## 12. Determinismo

Dois builds da mesma fonte produzem CSS idêntico byte a byte (FR-015, SC-002).

- **D-01** Arquivos em UTF-8 sem BOM e sem `@charset`, com fim de linha LF e uma quebra de linha
  final.
- **D-02** Cabeçalho fixo, igual em todos os arquivos, sem data, versão, caminho ou dado de ambiente.
- **D-03** Declarações ordenadas por nome, por code point, nunca por locale. Marcas processadas por
  id, por code point. Modos na ordem canônica da RS-03. Ordem das regras fixa (§8).
- **D-04** Formatação fixa (§8); a saída publicada não é minificada nem tem source map. A
  minificação é da app; a variante minificada faz parte dos testes (BR-19).
- **D-05** Regra vazia é omitida.
- **D-06** `dist/css/` é limpo antes de cada build: existe exatamente um `brand-<id>.css` por marca
  do resolver, sem arquivo residual.
- **D-07** Números e cores seguem a §11, sem formatação dependente de locale; a cor passa pela mesma
  versão exata de `colorjs.io`, com o método de gamut sempre explícito.
- **D-08** A geração não depende da ordem de iteração do parser: o modelo interno é ordenado antes
  de serializar.
- **D-09** `pnpm check:determinism` compara o sha256 de cada arquivo e dos tarballs entre dois builds
  em worktrees limpos, em caminhos, `TZ` e `LC_ALL` diferentes, sem cache de tarefas, empacotando
  com `pnpm pack`; à noite, também entre runners e entre o Node piso e o mais recente da matriz
  (D1, D6).

## 13. Verificações do CSS gerado

As verificações rodam dentro de `tokens-build build` (script `pnpm tokens:build`), depois de gerar
o conteúdo em memória e antes de gravar `dist/`. Com qualquer violação, o build sai com código 1,
não grava nenhum artefato e reporta cada achado com arquivo gerado, linha e coluna, mais o token e
o local na fonte (`arquivo:linha:coluna`) quando houver; com `--json`, os achados saem no stdout em
schema estável. Erro de configuração (por exemplo, `layers.json` inválido) sai com código 2, e erro
interno com código 3. Cada código tem ao menos uma fixture de violação proposital nos testes
unitários de `tools/tokens-build` (QA-02, SC-009).

Os códigos são os mesmos de [tools-cli.md](tools-cli.md), §2.2, que também lista
`unserializable-value` (S-04) e `private-segment-leak` ([esm-output.md](esm-output.md), E-08).

| Código | Regra verificada |
| --- | --- |
| `css-layer` | Toda regra de estilo fica dentro de `@layer <prefixo>.tokens`; a declaração de ordem das camadas é a primeira instrução de todo arquivo, igual em todos e igual à fonte única (L-01 a L-03) |
| `css-toggle-form` | Todo token de eixo modo está na forma da RS-03 (um toggle por modo, na ordem canônica, sem caractere entre os toggles); todo toggle vale literalmente `initial` ou vazio, nunca `var()`; exatamente um `initial` por regra de modo; toggles só nas regras de modo do `base.css` (T-02 a T-04) |
| `css-var-undeclared` | Todo alvo de `var()` tem declaração conforme a §10.1 (verificação estática) |
| `css-public-outside-resolver` | Semântico de eixo modo, invariante e de componente só no resolvedor; eixo marca e fonte marca-modo só na regra da marca; primitivo só na regra de primitivos do `base.css` ou na regra da marca; cada nome declarado uma vez por arquivo. A exigência do D3 de declarar tokens públicos só no resolvedor ou no escopo de marca vale para os não primitivos; primitivos são literais invariantes e não ficam congelados em escopo aninhado |
| `css-base-brand-value` | O `base.css` não tem seletor com valor de marca, primitivo exclusivo nem nome declarado em arquivo de marca (§10.2, §10.3) |
| `css-brand-selector` | Arquivo de marca só com os seletores da §5; `:where(:root)` só no arquivo da marca padrão (§10.2) |
| `css-combinations` | Para toda marca X e todo modo, `base.css` mais `brand-X.css` declaram todo token publicado, exceto os primitivos exclusivos de outra marca; todos os arquivos de marca declaram o mesmo conjunto de nomes de eixo marca e de fontes marca-modo (FR-010, FR-011) |
| `css-syntax` | CSS válido, só com o comentário de cabeçalho, a declaração de ordem das camadas e um bloco `@layer` com regras de estilo simples; sem `!important` nem as at-rules proibidas da L-06 |
| `css-var-fallback` | Nenhum `var()` tem fallback, exceto os toggles |
| `css-scope-dependency` | DEP-01 e DEP-02 conferidas na saída |
| `css-value-format` | Cores, números e compostos na forma da §11 |
| `css-format` | Cabeçalho, ordenação, indentação, LF e quebra de linha final conforme §8 e §12 |

A verificação cruzada `dist-parity` confirma que os nomes declarados no CSS, as chaves do ESM, a
união `TokenName` do `.d.ts`, o manifesto e o relatório de API listam o mesmo conjunto de tokens
públicos ([esm-output.md](esm-output.md), §7).

## 14. Sobrescrita pelo consumidor

Padrões suportados:

- **O-01** Sobrescrever fora de camada (ou numa camada declarada depois de `<prefixo>.tokens`). CSS
  em camada anterior à dos tokens perde.
- **O-02** Para sobrescrever um token semântico numa área, declarar a sobrescrita no próprio
  elemento de escopo (a raiz ou um elemento com `data-<prefixo>-brand` ou `data-<prefixo>-mode`).
  No mesmo elemento, os aliases de componente do resolvedor passam a usar o valor novo, e os
  descendentes herdam os dois.
- **O-03** Para mudar um componente específico, sobrescrever diretamente o token de componente,
  em qualquer elemento.
- **O-04** Escopos de tema aninhados abaixo de uma sobrescrita recalculam os tokens e a desfazem:
  um escopo aninhado é um tema novo, por desenho. Para manter a sobrescrita, repeti-la no seletor
  do escopo interno.
- **O-05** Sobrescrever primitivos é possível (os aliases são recalculados a partir do valor
  herdado), mas não é API de tema: afeta todas as marcas e não tem garantia de estabilidade de
  valor.
- **O-06** Para estilizar com tokens, usar `var(--<prefixo>-…)` ou as referências do ESM; o mapa de
  valores do ESM não acompanha escopos e não serve para estilizar o DOM.
- **O-07** A app que define `color-scheme` fora de camada vence a do token; isso é permitido, mas
  então os controles nativos deixam de acompanhar o modo do PatoDS.

## 15. Limitações conhecidas

- **Aliases congelados em elemento que não é escopo**: sobrescrever um token semântico num elemento
  sem atributo de tema muda o token para os descendentes, mas não os aliases de componente, que
  foram calculados no escopo mais próximo e herdados como valor (verificado nos três motores). Use
  O-02 ou O-03.
- **Portais**: o contêiner de um portal fora da subárvore de origem recebe os valores do seu próprio
  lugar no DOM. Ele precisa carregar os dois atributos com os valores efetivos da origem (R-07),
  responsabilidade do Provedor de tema na feature de componentes (CMP-21).
- **Primitivo exclusivo**: a referência a um primitivo exclusivo da marca X só resolve dentro de um
  escopo de X com `brand-X.css` importado. Estilos de componente não usam primitivos (TOK-03).
- **App só com marca não padrão**: exige o atributo de marca na raiz (U-02).
- **Shadow DOM e iframes**: o CSS de tokens no documento não casa elementos dentro de shadow roots,
  e cada iframe é um documento à parte, com importação e atributos próprios. Web Components estão
  fora do contrato (constituição).
- **Custom properties registradas**: registrar `--<prefixo>-*` com `@property` muda a herança e a
  serialização e pode quebrar os toggles; não é suportado.
- **Breakpoints**: tokens da categoria `breakpoint` são emitidos como custom properties, mas `var()`
  não vale em `@media`; o uso em media queries depende do mecanismo do núcleo (feature de núcleo).
- **DevTools**: o valor especificado aparece como cadeia de `var()`; o valor computado é o final.
- **Uma versão por documento**: duas versões do pacote na mesma página competem pelos mesmos nomes.
- **Novo modo**: exige regenerar o resolvedor e muda a API (major, data-model).
- **Tamanho**: cerca de 5,6 KB gzip por arquivo de marca com 350 tokens sintéticos no desenho
  original; a divisão em `base.css` muda a distribuição e deve ser medida contra o orçamento do
  QA-07, cujo valor está pendente na premissa de limiares.
- **Compatibilidade**: o mecanismo usa só custom properties, fallback de `var()`, `:where()` e
  `@layer`, o que não exige nada além do `@layer` já exigido pelo ADR-03. A lista de navegadores
  continua decisão em aberto (premissa ENG-08); o lint de compatibilidade CSS do ENG-08 valida a
  lista adotada, e os testes em navegador real rodam nos motores dela. A forma vazia minificada
  `--x:;` faz parte da matriz (BR-19).
- **`if()` no futuro**: quando houver suporte amplo, o gerador PODE trocar os toggles por `if()` sem
  mudar a API de atributos; os bytes mudam e a matriz completa de motores roda de novo.

## 16. Testes em navegador real

Executados com `@playwright/test` contra a app de exemplo `@<prefixo>/tokens-example`
(`apps/tokens-example`, Vite 8 sem framework), construída só a partir do tarball empacotado e
servida por `vite preview`, sem rede externa (`pnpm test:e2e`; testes em
`apps/tokens-example/tests`). Chromium em todo PR; todos os motores da lista de navegadores à noite
e antes de publicar (QA-12, premissa ENG-08; a pesquisa usou Chromium, Firefox e WebKit).

- **Valores esperados** vêm do mapa `values` e do manifesto do tarball, nunca escritos à mão.
- **Oráculo**: para cada elemento, marca e modo efetivos pela R-07, considerando as marcas
  importadas na configuração.
- **Comparação**: custom properties por igualdade exata de string, sem aparar; valores usados
  (`background-color`, `box-shadow`, `border-radius`, `outline-color`, `height`) contra o literal de
  referência normalizado pelo próprio navegador num elemento sonda.

| Caso | Configuração | Esperado |
| --- | --- | --- |
| BR-01 | Sem atributos; `base.css` + marca padrão | Raiz e descendentes com marca padrão e `light` |
| BR-02 | Só `data-<prefixo>-mode="dark"` na raiz | Marca padrão e `dark` em toda a árvore |
| BR-03 | Escopo só de modo interno: `a`-`light` > `[mode=dark]` | O elemento e o filho em `a`-`dark`; o irmão seguinte volta a `a`-`light` |
| BR-04 | Escopo só de marca herda o modo: `a`-`dark` > `[brand=b]` | `b`-`dark` no elemento e no filho |
| BR-05 | `a` > `b` > `a` | O `a` interno usa os valores de `a` com o modo mais próximo |
| BR-06 | Modo alternado `light` > `dark` > `light` | Cada nível com o seu modo |
| BR-07 | Cadeia `dark` > `b` > `a` > `[mode=light]` > `[brand=b]` > `[mode=dark]` | Valor certo em cada nível |
| BR-08 | Os dois atributos no mesmo elemento e o par trocado aninhado nele | Cada elemento com a sua combinação |
| BR-09 | Escopo só de marca no topo, sem ancestral de modo | Aquela marca com `light` (padrão do `base.css`) |
| BR-10 | Valores inválidos: marca `zzz`, marca vazia, modo `sepia`, modo vazio, `Dark` e ` dark` | O elemento mantém o valor do ancestral válido mais próximo naquele eixo |
| BR-11 | Marca presente no markup sem o seu arquivo importado | Igual a valor inválido |
| BR-12 | Irmão depois de um escopo aninhado já fechado | Valores do escopo externo |
| BR-13 | Marca alternada em quatro ou mais níveis, depois escopo só de modo dentro | Valores pelo escopo mais próximo de cada eixo |
| BR-14 | Importações: `base` + `a`; `base` + `b` com raiz `brand=b`; `base` + `a` + `b` e `base` + `b` + `a`, com raiz sem atributo e com raiz `brand=b`; arquivo de marca importado antes do `base.css`; raiz com marca e modo | Mesmo resultado em qualquer ordem; marca padrão só onde não há atributo de marca |
| BR-15 | Definir e remover atributos em tempo de execução, na raiz e em elementos aninhados | Valores atualizados sem recarregar nem navegar |
| BR-16 | Tokens que não são cor: sombra com várias camadas, opacidade, dimensão de eixo marca e token invariante em escopos só de modo; alias de componente em escopos aninhados | Valores do escopo mais próximo |
| BR-17 | Valores usados das propriedades listadas | Iguais ao literal de referência (detecta valor inválido no momento do valor computado) |
| BR-18 | Todas as configurações acima | Definição da §10.1 em todo elemento: token público não vazio e igual ao mapa de valores; toggles `_` e primitivos exclusivos de outra marca excluídos |
| BR-19 | CSS do bundle de produção da app (minificado pelo Vite 8, inclusive a forma `--x:;`), além da variante não minificada | Mesmos resultados de BR-01 a BR-18 |
| BR-20 | Árvores aleatórias com semente fixa e registrada: profundidade de seis ou mais, valores válidos e inválidos, 60 mutações em tempo de execução | Zero divergências contra o oráculo |
| BR-21 | Sobrescrita da app fora de camada: na raiz, num elemento de escopo e num elemento que não é escopo | A sobrescrita vence a camada; no elemento de escopo propaga para os aliases de componente; no elemento que não é escopo não propaga para eles (fixa a limitação da §15) |

Complementos estáticos: a checagem do ENG-06 sobre o bundle (§10.3) e as verificações da §13.

## 17. Premissas e pendências

Premissas usadas, sem decidir questão em aberto do requerente:

- Marcas: premissa vigente "Marcas e temas da versão 1.0"; até a entrega dos valores, marcas
  sintéticas `a` e `b` (QA-15). Marca padrão: indicada pelo requerente (CMP-24); `a` nas fixtures.
  Modo padrão: `light` (Assumptions do spec).
- Prefixo: `<prefixo>`, TODO(PREFIXO) da constituição.
- Navegadores (ENG-08): lista versionada ainda não definida; o mecanismo exige só `@layer` (ADR-03).
- Nível de acessibilidade para o contraste que consome a §11: WCAG 2.2 AA (A11Y-01).

Pendências e decisões deste contrato:

- **P-01** Decidida (research.md, D8): a fonte única da ordem das camadas é
  `packages/tokens/src/layers.json` (L-03).
- **P-02** Decidida (research.md, D8): vale a S-04. Só tokens com valor CSS único são publicáveis;
  `typography` composto e `strokeStyle` em objeto são rejeitados no build (`unserializable-value`) e a
  categoria `typography` usa tokens atômicos, mantendo a correspondência um para um (DEP-04) e a forma
  `Record<TokenName, string>` do [esm-output.md](esm-output.md).
- **P-03** A definição de "variável sem valor" (§10.1) segue a interpretação registrada no spec, a
  confirmar com o aceitante.
