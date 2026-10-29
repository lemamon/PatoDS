# Contrato: fonte de tokens DTCG

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) |
**Modelo de dados**: [data-model.md](../data-model.md) | **Data**: 2026-10-21

Este contrato fixa o formato da fonte única de tokens do pacote `@<prefixo>/tokens`
(`packages/tokens/`): estrutura de diretórios, arquivo de resolução de marca e modo, regras de
camada e de eixo, gramática de nomes, derivação do nome CSS e do nome na ferramenta de design,
regras de valor de cor e formato dos erros de validação. Ele é a referência do validador
`tokens-build validate` (pacote privado `@<prefixo>/tokens-build`), do manifesto de tokens que o
lint de estilos e a checagem de contraste consomem e do documento da convenção de nomes (TOK-04).

Os termos DEVE, NÃO DEVE, DEVERIA e PODE seguem a convenção da constituição. `<prefixo>` é o
marcador intencional do prefixo do projeto (TODO(PREFIXO) da constituição v1.0.0).

Decisões de origem: D1 (pipeline), D3 (escopos CSS), D4 (sincronização), D5 (cor) e D7 (modelo
da fonte) de [research.md](../research.md). ADRs relacionados, todos com status **Proposto** e
aceitos só por aprovação de dono (GOV-07, GOV-09):
[ADR-11](../../../docs/adr/ADR-11-pipeline-build-tokens.md),
[ADR-13](../../../docs/adr/ADR-13-escopos-marca-modo-css.md),
[ADR-14](../../../docs/adr/ADR-14-sincronizacao-ferramenta-design.md),
[ADR-15](../../../docs/adr/ADR-15-cor-e-contraste.md) e
[ADR-16](../../../docs/adr/ADR-16-lint-tokens-e-testes.md).

## 1. Escopo e precedência

Este contrato rege o conteúdo de `packages/tokens/src/`, os schemas versionados em
`packages/tokens/schemas/dtcg-2025.10/` e a saída de diagnóstico de `tokens-build validate`.

Não rege, e apenas referencia:

- o CSS gerado (`base.css`, `brand-<id>.css`, resolvedor, toggles de modo): [css-output.md](css-output.md);
- as regras de lint de estilos (`<prefixo>/design-tokens`, `<prefixo>/contrast-pairs`):
  [lint-rules.md](lint-rules.md);
- o manifesto de contraste e o conjunto de superfícies (`contrast/manifest.json`,
  `contrast/surfaces.json`) e as regras V-14 a V-16, os módulos ESM, os manifestos de
  `dist/meta/`, o relatório de build e o relatório de API (`api/tokens.api.json`), cada um no seu
  contrato em `contracts/`;
- a varredura do repositório do FR-001 (`repo-checks scan-tokens`) e o check de arquivo gerado
  versionado (`repo-checks drift`).

Precedência: Requisitos > constituição > [spec.md](../spec.md) > [research.md](../research.md) >
[data-model.md](../data-model.md) > este contrato. Divergência deste contrato com um documento
de nível superior é defeito deste contrato. A seção 12 registra onde este contrato detalha ou
ajusta o data-model.

## 2. Premissas assumidas

Nenhuma decisão em aberto do requerente é tomada aqui. Valem as premissas abaixo.

| Tema | Premissa usada | Efeito neste contrato |
| --- | --- | --- |
| Prefixo do projeto | `<prefixo>`, marcador do TODO(PREFIXO) da constituição | Aparece no nome CSS, nos atributos `data-<prefixo>-*` e no escopo do pacote. A troca pelo valor definitivo não altera a gramática. |
| Marcas da versão 1.0 (TOK-07) | Premissa vigente: todas as marcas das apps consumidoras atuais, com claro e escuro | O formato aceita qualquer número de marcas (1 ou mais). Até a entrega dos valores, a fonte e as fixtures usam só as marcas sintéticas `a` e `b` (QA-15). |
| Marca padrão (CMP-24) | Indicada pelo requerente | Campo `default` do modificador `brand`. Valor provisório `a` em fixtures e exemplos (data-model, Marca). |
| Modo padrão | `light` (spec, Assumptions) | Campo `default` do modificador `mode`. |
| Ferramenta de design (DSN-01) | Nenhuma escolhida; o repositório é a fonte e a ferramenta recebe as variáveis | O mapeamento de nomes (seção 8.9) cobre Figma e Penpot como candidatos, sem escolher; outra ferramenta usa a mesma regra com o separador declarado pelo seu adaptador. |
| Paletas em cor de gamut amplo | Mapeamento determinístico para sRGB (research.md, Perguntas ao requerente) | Seção 9: cor fora do gamut sRGB é emitida pelo mapeamento do CSS Color 4. |
| Nível WCAG (A11Y-01) | WCAG 2.2 AA | Não afeta este contrato; vale na checagem de contraste. |
| TOK-12 | Não contratado | Não há regra de token sem referência. |
| Lista de navegadores, pisos de Node e TypeScript (ENG-08) | Premissas vigentes, sem valores fixados aqui | Não afetam o formato da fonte. |
| Plataforma de CI | GitHub Actions (inferido do ENG-18) | A validação roda no workflow `.github/workflows/tokens-ci.yml`, com actions fixadas por SHA. |

## 3. Termos

- **Caminho**: lista de segmentos de um token, escrita com `.` (ex.: `color.bg.surface`).
- **Camada**: `primitive`, `semantic` ou `component`, derivada do diretório do arquivo (seção 4).
- **Eixo**: `invariant`, `brand` ou `mode`. Só tokens semânticos têm eixo próprio; primitivos e
  componentes são `invariant` na fonte (D7).
- **Contexto**: valor de um modificador do resolver: um id de marca, ou `light` ou `dark`.
- **Permutação**: par marca × modo, escrito `<marca>/<modo>` (ex.: `a/light`).
- **Token público**: token cujo primeiro segmento é uma categoria (seção 8.3). Inclui os tokens
  de eixo marca, que estilos de componente podem consumir.
- **Token-fonte de marca por modo** (papel `brand-mode-source`): token de eixo marca sob o grupo
  raiz reservado `brand`, cujo último segmento é um id de modo (seção 7.3). Estilos de componente
  NÃO DEVEM consumi-lo.
- **Dependência de eixo**: conjunto de eixos de que o valor resolvido de um token depende, por
  localização ou por qualquer alias da sua cadeia (seção 7.2).
- **Nome CSS**: `--<prefixo>-` seguido dos segmentos unidos por `-` (seção 8.7).

## 4. Estrutura de diretórios

```text
packages/tokens/
├── package.json
├── src/
│   ├── tokens.resolver.json            # Resolver DTCG 2025.10 (seção 5)
│   ├── primitive/
│   │   └── *.tokens.json               # todos os primitivos, inclusive os usados por uma só marca
│   ├── semantic/
│   │   ├── invariant.tokens.json       # eixo invariante
│   │   ├── brand/
│   │   │   ├── a.tokens.json           # um arquivo por marca (contexto do modificador brand)
│   │   │   └── b.tokens.json
│   │   └── mode/
│   │       ├── light.tokens.json       # um arquivo por modo (contexto do modificador mode)
│   │       └── dark.tokens.json
│   ├── component/
│   │   └── <componente>.tokens.json    # um arquivo por componente
│   └── layers.json                     # ordem das camadas @layer; não é arquivo de tokens (css-output.md, L-03)
├── contrast/
│   ├── manifest.json                   # contrato de contraste
│   ├── surfaces.json
│   └── manifest.schema.json, surfaces.schema.json   # schemas propostos em contrast-manifest.md
├── schemas/dtcg-2025.10/
│   ├── format.json                     # cópia do JSON Schema oficial (Format)
│   ├── resolver.json                   # cópia do JSON Schema oficial (Resolver)
│   ├── SHA256SUMS
│   └── LICENSE-W3C.md
├── api/tokens.api.json                 # gerado e versionado de propósito (drift)
└── dist/                               # gerado, no .gitignore
```

| Caminho em `src/` | Camada | Eixo | Conteúdo permitido |
| --- | --- | --- | --- |
| `primitive/*.tokens.json` | `primitive` | `invariant` | Literais e aliases entre primitivos. |
| `semantic/invariant.tokens.json` | `semantic` | `invariant` | Aliases sem dependência de marca ou de modo. |
| `semantic/brand/<id>.tokens.json` | `semantic` | `brand` (contexto `<id>`) | Tokens públicos de eixo marca e tokens `brand.*`. |
| `semantic/mode/<modo>.tokens.json` | `semantic` | `mode` (contexto `<modo>`) | Tokens públicos de eixo modo. |
| `component/<componente>.tokens.json` | `component` | `invariant` | Aliases cujo segundo segmento é `<componente>`. |

Regras:

1. Todo arquivo `*.tokens.json` sob `src/` DEVE estar num dos caminhos da tabela e ser
   referenciado por `tokens.resolver.json` (códigos `TKN-FILE-LOCATION` e
   `TKN-FILE-UNREFERENCED`). O nome de arquivo de marca e de modo DEVE ser igual ao id do
   contexto. Um arquivo de componente DEVE conter só tokens cujo segundo segmento é o nome do
   arquivo.
2. Nenhum token PODE existir fora de `packages/tokens/src/` (FR-001). A varredura do repositório
   (`pnpm check:scan`) cobre o restante do repositório, com exceções justificadas em
   `quality/scan-allowlist.json` (por exemplo, as fixtures do validador).
3. Os arquivos DEVEM ser JSON válido em UTF-8 sem BOM e sem chave duplicada no mesmo objeto
   (`TKN-JSON-PARSE`). O fim de linha LF é garantido pelo `.gitattributes`.
4. Os arquivos de primitivos DEVERIAM ser organizados um por categoria
   (`primitive/<categoria>.tokens.json`), podendo uma categoria se dividir em arquivos com
   qualificador (`primitive/<categoria>.<qualificador>.tokens.json`). A localização de um
   primitivo não indica marca: a exclusividade de um primitivo para uma marca é derivada das
   referências pelo build (D7) e decide se ele vai para `base.css` ou para `brand-<id>.css`
   ([css-output.md](css-output.md)).
5. `schemas/dtcg-2025.10/` guarda cópias dos JSON Schemas oficiais do DTCG 2025.10. O validador
   confere o sha256 de cada cópia contra `SHA256SUMS` antes de usá-la e valida sem rede (D1).
   `LICENSE-W3C.md` registra a W3C Software and Document License, que entra nos avisos de
   terceiros e na política de licenças versionada (`quality/license-policy.json`, ENG-21).
6. `dist/` é gerado e nunca versionado (FR-015). `api/tokens.api.json` é gerado, versionado de
   propósito e conferido por `pnpm check:drift`.
7. A fonte só muda por pull request revisado. Nenhuma rotina escreve em `src/` a partir da
   ferramenta de design (DSN-01, FR-025): `@<prefixo>/design-sync` lê apenas
   `dist/meta/sync-manifest.json`, e o arquivo de camadas (ENG-01) não tem aresta que permita o
   contrário.

## 5. Arquivo `tokens.resolver.json`

### 5.1 Forma

O arquivo segue o Resolver Module do DTCG 2025.10. O esboço abaixo mostra a forma adotada com as
marcas sintéticas `a` e `b`. A forma normativa das propriedades é a do schema versionado
`schemas/dtcg-2025.10/resolver.json` (V-01); se o esboço divergir do schema em nome ou aninhamento
de propriedade, prevalece o schema e o esboço é corrigido, mantidas as regras da seção 5.2.

```json
{
  "version": "2025.10",
  "sets": {
    "primitive": {
      "sources": [
        { "$ref": "primitive/color.tokens.json" },
        { "$ref": "primitive/space.tokens.json" }
      ]
    },
    "semantic-invariant": {
      "sources": [{ "$ref": "semantic/invariant.tokens.json" }]
    },
    "component": {
      "sources": [{ "$ref": "component/button.tokens.json" }]
    }
  },
  "modifiers": {
    "brand": {
      "contexts": {
        "a": [{ "$ref": "semantic/brand/a.tokens.json" }],
        "b": [{ "$ref": "semantic/brand/b.tokens.json" }]
      },
      "default": "a"
    },
    "mode": {
      "contexts": {
        "dark": [{ "$ref": "semantic/mode/dark.tokens.json" }],
        "light": [{ "$ref": "semantic/mode/light.tokens.json" }]
      },
      "default": "light"
    }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/primitive" },
    { "$ref": "#/sets/semantic-invariant" },
    { "$ref": "#/modifiers/brand" },
    { "$ref": "#/modifiers/mode" },
    { "$ref": "#/sets/component" }
  ]
}
```

### 5.2 Regras

1. `version` DEVE ser `"2025.10"`, o valor constante do schema versionado. O texto do Resolver
   2025.10 tem inconsistência interna no valor de versão; vale o schema copiado.
2. Os modificadores DEVEM ser exatamente `brand` e `mode`, ortogonais.
3. `mode.contexts` DEVE ter exatamente `light` e `dark`, e `mode.default` DEVE ser `"light"`.
   Acrescentar um modo muda a API pública e o resolvedor CSS (versão major, data-model).
4. `brand.contexts` DEVE ter ao menos um contexto. Cada chave é um id de marca
   (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`), que também é o valor de `data-<prefixo>-brand`, o nome de
   `brand-<id>.css` e o nome do modo na ferramenta de design. Cada contexto DEVE listar exatamente
   o arquivo `semantic/brand/<id>.tokens.json` do mesmo id. `brand.default` DEVE nomear um
   contexto existente: a marca padrão (premissa da seção 2).
5. Os sets DEVEM usar os nomes canônicos `primitive`, `semantic-invariant` e `component`, e cada
   um DEVE listar exatamente os arquivos do diretório correspondente. Set sem arquivo é omitido,
   junto com sua entrada em `resolutionOrder`.
6. `resolutionOrder` DEVE seguir a ordem canônica `primitive`, `semantic-invariant`, `brand`,
   `mode`, `component`, com as entradas presentes. Como nenhum caminho é definido em dois lugares
   (`TKN-PATH-DUPLICATE`, seção 7.1), a ordem não decide nenhum valor; ela é fixa para que não
   existam configurações equivalentes divergentes e para manter os modificadores ortogonais, como o
   Resolver recomenda.
7. Todo `$ref` do resolver DEVE ser caminho relativo POSIX dentro de `src/` (sem `..`, sem
   caminho absoluto, sem esquema de URL) ou ponteiro interno `#/sets/<nome>` ou
   `#/modifiers/<nome>` (`TKN-RESOLVER-REF`). O build passa ao parser um carregador que recusa
   qualquer outra origem (D1).
8. Listas de fontes e chaves de contexto DEVERIAM estar em ordem de code point. O build não
   depende disso: ele ordena por code point antes de qualquer saída.

Desvios das regras 2 a 6 geram `TKN-RESOLVER-STRUCTURE`.

### 5.3 Permutações

O conjunto de permutações é o produto dos contextos de `brand` e `mode`. O validador e o build
obtêm a lista pelo resolver (`listPermutations()`) e resolvem cada uma (`apply()`); todas as
regras das seções 6 a 9 rodam sobre todas as permutações, e não só sobre a padrão (D1). Lista
indefinida (limite do parser) ou diferente de marcas × modos gera `TKN-CONFIG-PERMUTATIONS`.

### 5.4 Adicionar uma marca

Adicionar a marca `c` exige apenas:

1. criar `src/semantic/brand/c.tokens.json` com o mesmo conjunto de caminhos das demais marcas
   (seção 7.4);
2. acrescentar o contexto `c` em `modifiers.brand.contexts`;
3. se necessário, acrescentar primitivos em `src/primitive/`.

Nada fora de `packages/tokens/src/` é editado à mão, o que o diff comprova (FR-009, SC-005). O
arquivo `brand-c.css` e as entradas da marca no ESM saem do build; o relatório de API versionado
(`api/tokens.api.json`) é regenerado por ele. Esse relatório é arquivo de tokens, e a checagem de
diff o aceita junto com a fonte (spec, Clarifications; [esm-output.md](esm-output.md), §11.3).

## 6. Camadas e direção de referência (V-02 a V-05)

| Camada | Valor literal | PODE referenciar por alias | `$ref` (ponteiro JSON) | `$extends` |
| --- | --- | --- | --- | --- |
| `primitive` | Sim | `primitive` | Sim, só local | Só com chaves |
| `semantic` | Não | `primitive`, `semantic` | Não | Só com chaves |
| `component` | Não | `semantic`, `component`, `primitive` | Não | Só com chaves |

Regras:

1. **Literal só no primitivo (V-02, FR-003)**. Literal é todo `$value`, ou subvalor de composto,
   que não seja alias `{caminho}`. Em `semantic` e `component`, a forma recomendada para compostos
   (sombra, tipografia, borda, transição) é o alias do token inteiro; composição por subvalores só
   é aceita quando todo subvalor é alias. O subvalor `inset` da sombra, que não tem tipo próprio no
   DTCG, obriga o alias inteiro. Violação: `TKN-LITERAL-OUTSIDE-PRIMITIVE`.
2. **Alias resolvido e sem ciclo (V-03, FR-004)**. Todo alias DEVE resolver para um token
   existente em todas as permutações, sem ciclo (`TKN-ALIAS-UNRESOLVED`, `TKN-ALIAS-CYCLE`, este
   com a cadeia completa). O tipo do alvo DEVE ser igual ao `$type` do token (`TKN-ALIAS-TYPE`).
3. **Direção de referência (V-04, FR-004)**: conforme a tabela (`TKN-LAYER-DIRECTION`). Duas
   restrições adicionais valem dentro dessas arestas: as regras de eixo da seção 7.2 e a regra de
   que tokens `brand.*` só são referenciados pelo token de eixo modo correspondente (seção 7.3).
4. **`$ref`, `$root` e `$extends` (V-05)**. `$ref` só é aceito na camada primitiva, apontando
   para fragmento local (`#/...`) ou arquivo relativo dentro de `src/primitive/`
   (`TKN-REF-OUTSIDE-PRIMITIVE`, `TKN-REF-NOT-LOCAL`). `$root` é proibido em qualquer camada
   (`TKN-ROOT-FORBIDDEN`), porque o parser o remove do caminho e o caminho deixaria de ser igual ao
   nome CSS e ao nome na ferramenta. `$extends` só é aceito na forma com chaves, apontando para um
   grupo (`"$extends": "{color.blue}"`); a forma de objeto é recusada (`TKN-EXTENDS-FORM`). As
   regras deste contrato valem sobre os tokens já expandidos, com o erro apontado no `$extends`.
5. **Tipo**. Todo token DEVE ter `$type` declarado em si ou num grupo ancestral, nunca inferido do
   alvo do alias (`TKN-TYPE-MISSING`), e compatível com a categoria e a propriedade
   (`TKN-TYPE-CATEGORY`, seção 8.3).
6. `$description` e `$deprecated` PODEM ser usados. O texto de `$description` passa pela varredura
   de Unicode invisível do catálogo (IA-18, feature do catálogo). `$extensions` PODE existir, mas
   não altera camada, eixo, papel nem nome de nenhum token.

## 7. Eixos de variação e forma `brand.*` (V-07 a V-09, V-13, FR-011, FR-033)

### 7.1 Eixo por localização (V-07, V-09)

O eixo de um token semântico vem do arquivo que o define (seção 4). Cada caminho DEVE ser
definido em exatamente um destes lugares:

- um único arquivo de um set compartilhado (`primitive`, `semantic-invariant`, `component`); ou
- os arquivos de contexto de exatamente um modificador (todos os arquivos de marca, ou os dois
  arquivos de modo).

Caminho presente em set compartilhado e também num contexto, em contextos dos dois modificadores
ou em dois arquivos do mesmo set gera `TKN-PATH-DUPLICATE`. Com isso, sets compartilhados nunca
carregam valores de eixo marca ou modo (V-09), e uma marca não herda em silêncio um valor que não
definiu.

### 7.2 Dependência de eixo

A dependência de eixo de um token é calculada estaticamente sobre o grafo de aliases, em todos os
contextos:

- primitivo: vazia;
- token de eixo marca: `{brand}` mais a dependência dos alvos;
- token de eixo modo: `{mode}` mais a dependência dos alvos;
- token invariante ou de componente: a dependência dos alvos.

Regras:

1. **AX-1**: token semântico invariante DEVE ter dependência vazia.
2. **AX-2**: token de eixo marca, público ou `brand.*`, NÃO DEVE depender de `mode`. Tokens de
   marca são declarados no escopo de marca ([css-output.md](css-output.md), D3); depender do modo
   congelaria, num escopo de modo aninhado, o modo do escopo de marca (FR-012).
3. **AX-3**: token de eixo modo só PODE depender de `brand` na forma da seção 7.3.
4. Tokens de componente PODEM depender de qualquer eixo, porque o resolvedor CSS os redeclara em
   todo escopo (D3), mas NÃO DEVEM referenciar tokens `brand.*`.

Violação de AX-1 ou AX-2: `TKN-AXIS-DEPENDENCY`. Violação de AX-3: `TKN-AXIS-BOTH`. Em ambos, o
diagnóstico traz a cadeia de alias até o token que introduz o eixo.

### 7.3 Forma `brand-mode-source` (V-08, FR-033)

Token semântico que varia por marca e por modo DEVE ser expresso como token de eixo modo cujo
valor em cada modo é alias para um token de eixo marca com as mesmas chaves em toda marca. A fonte
fixa essa forma assim:

1. **Nome**: `brand.<P>.<m>`, em que `<P>` é o caminho de um token público semântico válido
   (seção 8.3) e `<m>` é `light` ou `dark`. Exemplo: `brand.color.bg.surface.light`.
2. **Local**: só em `src/semantic/brand/<id>.tokens.json` (eixo marca). Todo token sob `brand.`
   tem papel `brand-mode-source`, eixo `brand` e termina num id de modo.
3. **Forma**: se o token de eixo modo `<P>` depende de marca, então, em cada modo `<m>`, seu valor
   DEVE ser exatamente o alias `{brand.<P>.<m>}`, sem intermediário. Assim, `brand.<P>.light` e
   `brand.<P>.dark` existem em toda marca.
4. **Correspondência**: se `brand.<P>.<m>` existe, `<P>` DEVE existir nos arquivos de modo e seu
   valor no modo `<m>` DEVE ser `{brand.<P>.<m>}`. Token `brand.*` órfão é erro.
5. **Referência**: `brand.<P>.<m>` só PODE ser referenciado por `<P>` no arquivo do modo `<m>`.
   Referência por componente, por outro token semântico, por outro `brand.*` ou por `<P>` em outro
   modo gera `TKN-BRAND-SOURCE-REF`. A regra de lint `brand-mode-source-token`
   ([lint-rules.md](lint-rules.md)) impõe a mesma proibição nos estilos de componente.
6. **Alvos**: `brand.<P>.<m>` obedece a AX-2 e PODE referenciar primitivos, tokens semânticos
   invariantes e tokens públicos de eixo marca.

Violações dos itens 1, 2 e 4: `TKN-BRAND-SOURCE-FORM`; do item 3: `TKN-AXIS-BOTH`; do item 5:
`TKN-BRAND-SOURCE-REF`; do item 6: `TKN-AXIS-DEPENDENCY`.

O grupo raiz é necessário porque, no DTCG, um token não pode ter filhos: `color.bg.surface.light`
não pode coexistir com o token `color.bg.surface`. Ele também isola o papel para o lint e para o
manifesto de tokens (`role: "brand-mode-source"`).

Nas saídas, tokens `brand.*` são tokens públicos (nome sem o segmento privado `_`), com nome CSS
`--<prefixo>-brand-…` declarado no arquivo da marca, e aparecem na coleção Marca da ferramenta com o
mesmo nome. Só os toggles de modo `--<prefixo>-_on-light` e `--<prefixo>-_on-dark` são privados
(seção 8.8).

### 7.4 Paridade de chaves (V-13, FR-011, TOK-09)

1. **Por contexto**: o conjunto de caminhos definido por cada arquivo de marca DEVE ser igual ao
   das demais marcas, e o de cada arquivo de modo, igual ao do outro modo
   (`TKN-PARITY-CONTEXT`). O diagnóstico aponta o arquivo do contexto em que a chave falta (ou
   sobra) e relaciona os arquivos que a têm.
2. **Por permutação**: o conjunto de caminhos semânticos resolvidos, incluindo `brand.*`, DEVE ser
   igual em todas as permutações (`TKN-PARITY-PERMUTATION`, SC-004).

A checagem por contexto não é mascarada por herança porque sets compartilhados não carregam
valores de eixo (seção 7.1).

### 7.5 Exemplo trabalhado (marcas sintéticas `a` e `b`)

Primitivos (`src/primitive/color.tokens.json`); os `hex` são coerentes com os componentes
(seção 9):

```json
{
  "color": {
    "$type": "color",
    "gray": {
      "0": { "$value": { "colorSpace": "srgb", "components": [1, 1, 1], "hex": "#ffffff" } },
      "100": { "$value": { "colorSpace": "srgb", "components": [0.933333, 0.933333, 0.933333], "hex": "#eeeeee" } },
      "900": { "$value": { "colorSpace": "srgb", "components": [0.066667, 0.066667, 0.066667], "hex": "#111111" } }
    },
    "blue": {
      "600": { "$value": { "colorSpace": "srgb", "components": [0, 0.333333, 0.8], "hex": "#0055cc" } },
      "900": { "$value": { "colorSpace": "srgb", "components": [0, 0.133333, 0.333333], "hex": "#002255" } }
    },
    "green": {
      "700": { "$value": { "colorSpace": "srgb", "components": [0, 0.4, 0.2], "hex": "#006633" } },
      "900": { "$value": { "colorSpace": "srgb", "components": [0, 0.2, 0.133333], "hex": "#003322" } }
    }
  }
}
```

Marca `a` (`src/semantic/brand/a.tokens.json`):

```json
{
  "color": {
    "$type": "color",
    "bg": { "accent": { "$value": "{color.blue.600}" } }
  },
  "brand": {
    "color": {
      "$type": "color",
      "bg": {
        "surface": {
          "light": { "$value": "{color.gray.0}" },
          "dark": { "$value": "{color.blue.900}" }
        }
      }
    }
  }
}
```

Marca `b` (`src/semantic/brand/b.tokens.json`): mesmas chaves, com `color.bg.accent` →
`{color.green.700}`, `brand.color.bg.surface.light` → `{color.gray.100}` e
`brand.color.bg.surface.dark` → `{color.green.900}`.

Modos (`src/semantic/mode/light.tokens.json`; `dark.tokens.json` é igual, com
`{brand.color.bg.surface.dark}` e `{color.gray.0}`):

```json
{
  "color": {
    "$type": "color",
    "bg": { "surface": { "$value": "{brand.color.bg.surface.light}" } },
    "fg": { "default": { "$value": "{color.gray.900}" } }
  }
}
```

Valores resolvidos por permutação:

| Token | Eixo e dependência | `a/light` | `a/dark` | `b/light` | `b/dark` |
| --- | --- | --- | --- | --- | --- |
| `color.bg.surface` | modo; {brand, mode} pela forma 7.3 | `#ffffff` | `#002255` | `#eeeeee` | `#003322` |
| `color.fg.default` | modo; {mode} | `#111111` | `#ffffff` | `#111111` | `#ffffff` |
| `color.bg.accent` | marca; {brand} | `#0055cc` | `#0055cc` | `#006633` | `#006633` |
| `brand.color.bg.surface.light` | marca (`brand-mode-source`) | `#ffffff` | `#ffffff` | `#eeeeee` | `#eeeeee` |
| `brand.color.bg.surface.dark` | marca (`brand-mode-source`) | `#002255` | `#002255` | `#003322` | `#003322` |

Pela classificação do D7, `color.blue.*` é exclusivo de `a`, `color.green.*` e `color.gray.100` são
exclusivos de `b`, e `color.gray.0` e `color.gray.900` são compartilhados.

Esboço do CSS resultante, só para ilustrar; a forma normativa está em
[css-output.md](css-output.md):

```css
/* brand-a.css (a é a marca padrão provisória, por isso também :where(:root)) */
@layer <prefixo>.tokens {
  :where(:root), [data-<prefixo>-brand="a"] {
    --<prefixo>-color-bg-accent: var(--<prefixo>-color-blue-600);
    --<prefixo>-brand-color-bg-surface-light: var(--<prefixo>-color-gray-0);
    --<prefixo>-brand-color-bg-surface-dark: var(--<prefixo>-color-blue-900);
  }
}
/* base.css, bloco resolvedor */
@layer <prefixo>.tokens {
  :where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode]) {
    --<prefixo>-color-bg-surface: var(--<prefixo>-_on-light, var(--<prefixo>-brand-color-bg-surface-light))var(--<prefixo>-_on-dark, var(--<prefixo>-brand-color-bg-surface-dark));
    --<prefixo>-color-fg-default: var(--<prefixo>-_on-light, var(--<prefixo>-color-gray-900))var(--<prefixo>-_on-dark, var(--<prefixo>-color-gray-0));
  }
}
```

Na ferramenta de design (separador do Figma; seção 8.9):

| Coleção | Variável | Modos e valores |
| --- | --- | --- |
| Primitivos | `color/blue/600` e demais | Sem modos |
| Marca | `color/bg/accent` | `a` → `color/blue/600`; `b` → `color/green/700` |
| Marca | `brand/color/bg/surface/light` | `a` → `color/gray/0`; `b` → `color/gray/100` |
| Marca | `brand/color/bg/surface/dark` | `a` → `color/blue/900`; `b` → `color/green/900` |
| Modo | `color/bg/surface` | `light` → `brand/color/bg/surface/light`; `dark` → `brand/color/bg/surface/dark` |
| Modo | `color/fg/default` | `light` → `color/gray/900`; `dark` → `color/gray/0` |

Trocar só a marca de um quadro muda `color/bg/accent` e as fontes de `color/bg/surface`; trocar só
o modo escolhe a fonte. Toda variável corresponde a um token, sem variável auxiliar (FR-028,
FR-029).

Mudanças que a validação barra neste exemplo:

| Mudança | Código |
| --- | --- |
| Em `dark.tokens.json`, `color.bg.surface` → `{color.bg.accent}` | `TKN-AXIS-BOTH` |
| Em `dark.tokens.json`, `color.bg.surface` → `{brand.color.bg.surface.light}` | `TKN-BRAND-SOURCE-REF`, com `TKN-AXIS-BOTH` (forma) e `TKN-BRAND-SOURCE-FORM` (`dark` órfão) |
| Remover `brand.color.bg.surface.dark` de `b.tokens.json` | `TKN-PARITY-CONTEXT` (e `TKN-ALIAS-UNRESOLVED` em `b/dark`) |
| Definir também `color.fg.default` em `a.tokens.json` | `TKN-PATH-DUPLICATE` |
| Em `a.tokens.json`, `brand.color.bg.surface.light` → `{color.fg.default}` | `TKN-AXIS-DEPENDENCY` |
| Em `component/button.tokens.json`, `color.button.bg.default` → `{brand.color.bg.surface.light}` | `TKN-BRAND-SOURCE-REF` |
| Criar o primitivo `color.dark.900` (paleta com id de modo) | `TKN-NAME-RESERVED` |

## 8. Gramática de nomes (V-06, FR-005, TOK-04)

### 8.1 Segmentos

Todo segmento DEVE casar com `^[a-z0-9]+(-[a-z0-9]+)*$`: ASCII minúsculo em kebab, sem `$`, `{`,
`}`, `.`, `/`, `_` ou espaço (`TKN-NAME-SEGMENT`). Isso é um subconjunto das restrições de nome do
DTCG 2025.10 e garante que o nome CSS e o nome na ferramenta são derivações sem perda.

O primeiro segmento DEVE ser uma categoria da lista fechada do TOK-10 (`color`, `typography`,
`space`, `size`, `radius`, `border`, `shadow`, `motion`, `z-index`, `breakpoint`, `opacity`) ou
o grupo reservado `brand` (`TKN-NAME-CATEGORY`). Sob `brand`, a categoria é o segundo segmento.

### 8.2 Notação

`<x>` é segmento obrigatório; `[.<x>]`, opcional; `|` separa alternativas. `<comp>` é o id do
componente; `<parte>`, uma parte do componente; `<prop>`, `<papel>`, `<variante>` e `<estado>`
vêm dos vocabulários da seção 8.4. A ordem dos segmentos é fixa e a análise é posicional: em
componentes, depois de `<comp>`, o segmento seguinte é `<parte>` se não pertencer às propriedades
da categoria, às variantes nem aos estados; senão é `<prop>`. Segmento excedente, ausente ou fora
do vocabulário gera `TKN-NAME-GRAMMAR`.

Como no DTCG um token não pode ter filhos, quando um prefixo tem tokens com estado, o estado
padrão é escrito explicitamente (`color.button.bg.default` ao lado de `color.button.bg.hover`).

### 8.3 Ordem dos segmentos por categoria

| Categoria | Primitivo | Semântico (público) | Componente |
| --- | --- | --- | --- |
| `color` | `color.<paleta>.<passo>` — `color.blue.600` | `color.<prop>.<papel>[.<variante>][.<estado>]` — `color.bg.surface`, `color.fg.default`, `color.border.focus`, `color.bg.danger.subtle` | `color.<comp>[.<parte>].<prop>[.<variante>][.<estado>]` — `color.button.bg.default`, `color.button.bg.primary.hover` |
| `typography` | `typography.<prop>.<passo>\|<nome>` — `typography.size.300`, `typography.family.sans` | `typography.<prop>.<papel>[.<variante>]` — `typography.size.body.md`, `typography.family.code` | `typography.<comp>[.<parte>].<prop>[.<variante>][.<estado>]` — `typography.button.label.size.md` |
| `space` | `space[.<escala>].<passo>` — `space.4`, `space.0-5` | `space.<prop>.<papel>` — `space.inset.md`, `space.stack.lg` | `space.<comp>[.<parte>].<prop>[.<variante>]` — `space.button.inset.md` |
| `size` | `size[.<escala>].<passo>` — `size.40` | `size.<prop>.<papel>` — `size.control.md`, `size.icon.sm` | `size.<comp>[.<parte>].<prop>[.<variante>][.<estado>]` — `size.button.control-height.md` |
| `radius` | `radius[.<escala>].<passo>` — `radius.2`, `radius.full` | `radius.<prop>.<papel>` — `radius.control.default` | `radius.<comp>[.<parte>][.<variante>][.<estado>]` — `radius.button.md` |
| `border` | `border.<prop>.<passo>\|<nome>` — `border.width.1`, `border.style.solid` | `border.<prop>.<papel>[.<variante>][.<estado>]` — `border.width.default`, `border.stroke.focus` | `border.<comp>[.<parte>].<prop>[.<variante>][.<estado>]` — `border.input.stroke.invalid` |
| `shadow` | `shadow[.<escala>].<passo>` — `shadow.2` | `shadow.<prop>.<papel>` — `shadow.elevation.raised` | `shadow.<comp>[.<parte>][.<variante>][.<estado>]` — `shadow.button.focus-visible` |
| `motion` | `motion.<prop>.<passo>\|<nome>` — `motion.duration.200`, `motion.easing.standard` | `motion.<prop>.<papel>` — `motion.duration.fast` | `motion.<comp>[.<parte>].<prop>[.<variante>][.<estado>]` — `motion.tooltip.duration.default` |
| `z-index` | `z-index[.<escala>].<passo>` — `z-index.100` | `z-index.layer.<papel>` — `z-index.layer.modal` | `z-index.<comp>[.<parte>][.<variante>]` — `z-index.tooltip` |
| `breakpoint` | `breakpoint[.<escala>].<passo>` — `breakpoint.md` | `breakpoint.<prop>.<papel>` — `breakpoint.viewport.md` | `breakpoint.<comp>[.<parte>][.<variante>]` — `breakpoint.table.md` |
| `opacity` | `opacity[.<escala>].<passo>` — `opacity.40` | `opacity.<prop>.<papel>` — `opacity.state.disabled`, `opacity.overlay.scrim` | `opacity.<comp>[.<parte>][.<variante>][.<estado>]` — `opacity.button.disabled` |
| `brand` (reservado) | — | `brand.<caminho semântico>.<modo>` — `brand.color.bg.surface.light` (seção 7.3) | — |

Propriedades e `$type` permitido por propriedade (refina a tabela de categorias do data-model;
`TKN-TYPE-CATEGORY`):

| Categoria | Propriedades no semântico | Propriedades no componente | 2º segmento do primitivo | `$type` |
| --- | --- | --- | --- | --- |
| `color` | `bg`, `fg`, `border` | `bg`, `fg`, `border` | `<paleta>` obrigatória | `color` |
| `typography` | `text`, `family`, `weight`, `size`, `line-height`, `letter-spacing` | as mesmas | `<prop>` obrigatória, exceto `text` | `text` → `typography`; `family` → `fontFamily`; `weight` → `fontWeight`; `size` e `letter-spacing` → `dimension`; `line-height` → `number` |
| `space` | `inset`, `stack`, `inline` | as mesmas | `<escala>` opcional | `dimension` |
| `size` | `control`, `icon`, `container` | `control-height`, `height`, `width`, `min-width`, `icon` | `<escala>` opcional | `dimension` |
| `radius` | `control`, `container`, `indicator` | nenhuma | `<escala>` opcional | `dimension` |
| `border` | `width`, `style`, `stroke` | as mesmas | `<prop>` obrigatória: `width` ou `style` | `width` → `dimension`; `style` → `strokeStyle`; `stroke` → `border` |
| `shadow` | `elevation`, `focus` | nenhuma | `<escala>` opcional | `shadow` |
| `motion` | `duration`, `easing`, `transition` | as mesmas | `<prop>` obrigatória: `duration` ou `easing` | `duration` → `duration`; `easing` → `cubicBezier`; `transition` → `transition` |
| `z-index` | `layer` | nenhuma | `<escala>` opcional | `number` |
| `breakpoint` | `viewport`, `container` | nenhuma | `<escala>` opcional | `dimension` |
| `opacity` | `state`, `overlay` | nenhuma | `<escala>` opcional | `number` |

Em categorias sem propriedade de componente, o segmento de propriedade do semântico designa a
classe de elemento a que o token se aplica (por exemplo, `radius.control`), e o componente o
omite. Tokens `brand.*` têm o `$type` do token público correspondente.

Pela regra S-04 de [css-output.md](css-output.md) (P-02, decidida no plano), o `$type` `typography`
composto (propriedade `text`) e o `strokeStyle` em forma de objeto não são
publicáveis: a validação os aceita na fonte, mas `tokens-build build` os rejeita com o código
`unserializable-value` (saída 1). A cobertura da categoria `typography` (V-11) usa tokens atômicos
(`family`, `weight`, `size`, `line-height`, `letter-spacing`).

Cada categoria DEVE ter ao menos um token semântico público publicado (V-11, FR-006;
`TKN-CATEGORY-COVERAGE`).

### 8.4 Vocabulários (v1)

Os vocabulários abaixo são a proposta inicial deste contrato; serão revistos quando chegarem os
valores das marcas. A evolução segue a seção 8.10.

**Escala de tamanho (`SZ`, ordenada)**: `2xs` < `xs` < `sm` < `md` < `lg` < `xl` < `2xl` < `3xl`.

**Estados** (vocabulário versionado compartilhado com o manifesto de contraste e com a regra de
pares do FR-021): `default`, `hover`, `active`, `focus-visible`, `selected`, `invalid`,
`disabled`, `inactive`.

**Variantes**: as palavras de `SZ` e `subtle`, `strong`, `inverse`, `primary`, `secondary`,
`tertiary`, `neutral`, `accent`, `success`, `warning`, `danger`, `info`. Variantes e estados são
disjuntos, o que torna a análise posicional inequívoca.

**Passo de primitivo** (`<passo>`): número inteiro (`[0-9]+`), fração escrita com hífen
(`0-5` = 0,5), palavra de `SZ`, `full` ou `none`. **Nome de primitivo** (`<nome>`): kebab livre,
só em `typography.family`, `border.style` e `motion.easing`. **Paleta e escala de primitivo**
(`<paleta>`, `<escala>`): kebab livre que NÃO DEVE ser propriedade semântica da categoria (evita
`color.bg.500` ou `size.control.md` na camada primitiva).

**Papéis no semântico** (`<papel>`):

| Categoria e propriedade | Papéis |
| --- | --- |
| `color.bg` | `surface`, `raised`, `sunken`, `overlay`, `inverse`, `accent`, `neutral`, `success`, `warning`, `danger`, `info`, `scrim` |
| `color.fg` | `default`, `muted`, `subtle`, `inverse`, `accent`, `on-accent`, `link`, `success`, `warning`, `danger`, `info` |
| `color.border` | `default`, `muted`, `strong`, `focus`, `inverse`, `accent`, `success`, `warning`, `danger`, `info` |
| `typography.*` | `display`, `heading`, `title`, `body`, `label`, `caption`, `code` |
| `space.*` | `none` e `SZ` |
| `size.control` | `SZ` (escala de alturas de controle, seção 8.6) |
| `size.icon`, `size.container` | `SZ` |
| `radius.*` | `none`, `default`, `full` e `SZ` |
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

**Id de componente** (`<comp>`): kebab, sempre na segunda posição, diferente de `control`. Nesta
feature há apenas componentes sintéticos de fixture; a lista válida de ids passa
a vir do arquivo de orientação de uso, na feature de componentes. **Parte** (`<parte>`): um único
segmento kebab fora das propriedades da categoria, das variantes e dos estados.

### 8.5 Grupos, palavras e segmentos reservados

| Reservado | Regra | Código |
| --- | --- | --- |
| Grupo raiz `brand` | Só em `src/semantic/brand/*.tokens.json`, só na forma `brand.<P>.<modo>` (seção 7.3) | `TKN-NAME-RESERVED`, `TKN-BRAND-SOURCE-FORM` |
| Ids de modo `light`, `dark` | NÃO DEVEM ser segmento de nenhum nome, exceto o último segmento de `brand.*`; o modo é eixo, não parte do nome | `TKN-NAME-RESERVED` |
| Grupo `size.control` | Só para a escala de alturas de controle, só na camada semântica (seção 8.6) | `TKN-NAME-RESERVED`, `TKN-CONTROL-SCALE` |
| Propriedade `control-height` | Só em componente da categoria `size`, como alias direto de `size.control.<passo>` | `TKN-CONTROL-SCALE` |
| Id de componente `control` | Proibido | `TKN-NAME-RESERVED` |
| `$root` | Proibido em qualquer camada | `TKN-ROOT-FORBIDDEN` |
| `$ref` | Só na camada primitiva, só local | `TKN-REF-OUTSIDE-PRIMITIVE`, `TKN-REF-NOT-LOCAL` |
| `$extends` | Só na forma com chaves | `TKN-EXTENDS-FORM` |
| Segmento CSS privado `_` | Reservado ao gerador (`--<prefixo>-_*`); nenhum token o ocupa (seção 8.8) | `TKN-NAME-SEGMENT` |

### 8.6 Escala de alturas de controle (V-12, FR-007, TOK-13)

1. Os membros são os tokens semânticos `size.control.<passo>`, com `<passo>` em `SZ` e `$type`
   `dimension`. DEVE existir ao menos um membro.
2. O conjunto de passos é o mesmo em todas as permutações (garantido pela paridade, seção 7.4).
3. Em cada permutação, todos os membros DEVEM usar a mesma unidade, e os valores DEVEM crescer
   estritamente na ordem de `SZ`.
4. A escala PODE ter qualquer eixo; o relatório de build lista a escala resolvida por permutação
   (FR-008).
5. Token de componente com propriedade `control-height` DEVE ser alias direto de um membro da
   escala.
6. O manifesto de tokens marca membros e tokens `control-height` com `scale: "control-height"`,
   que a regra de lint do FR-023 consome ([lint-rules.md](lint-rules.md)).

Violação de qualquer item: `TKN-CONTROL-SCALE`.

### 8.7 Nome CSS e colisão

O nome CSS de um token é `--<prefixo>-` seguido dos segmentos do caminho unidos por `-`:

| Caminho | Nome CSS |
| --- | --- |
| `color.bg.surface` | `--<prefixo>-color-bg-surface` |
| `z-index.layer.modal` | `--<prefixo>-z-index-layer-modal` |
| `space.0-5` | `--<prefixo>-space-0-5` |
| `brand.color.bg.surface.light` | `--<prefixo>-brand-color-bg-surface-light` |

O nome CSS DEVE ser único entre todos os tokens de todas as camadas, incluídos os `brand.*`. Como
um segmento pode conter hífen, caminhos distintos podem colidir (por exemplo,
`color.bg.surface-raised` e `color.bg.surface.raised`); a colisão gera `TKN-NAME-COLLISION`,
apontada no caminho que vem por último em ordem de code point e relacionada aos demais. Nenhuma
categoria começa por `brand`, então tokens `brand.*` não colidem com tokens de categoria.

O valor de `<prefixo>` é parâmetro do build. A atribuição do nome CSS e a forma dos módulos ESM
derivados estão nos contratos de saída.

### 8.8 Segmento privado

O espaço `--<prefixo>-_*` é reservado a variáveis internas do mecanismo de escopo. Hoje são só os
toggles de modo `--<prefixo>-_on-light` e `--<prefixo>-_on-dark` (D3). Como nenhum segmento de
token aceita `_`, nenhum token ocupa esse espaço. Variáveis privadas não são tokens: ficam fora do
manifesto de tokens, do ESM, dos `.d.ts`, do contrato de DOM e do relatório de API, e fora da
definição operacional de "variável sem valor" (spec, Clarifications).

### 8.9 Mapeamento para a ferramenta de design (FR-028, FR-029)

1. **Nome**: o nome da variável na ferramenta é o caminho do token com os segmentos unidos pelo
   separador da ferramenta: `/` no Figma e `.` no Penpot. Para outra ferramenta, o adaptador
   declara o separador quando a ferramenta for escolhida (ADR-14). O separador DEVE ser um
   caractere que não aparece em segmentos, portanto nunca `-`.
2. **Comparação**: a verificação de divergência (FR-030) divide o nome da variável pelo separador e
   compara o arranjo de segmentos com o caminho do token, sem normalização de caixa, espaço ou
   Unicode; qualquer diferença é divergência do tipo `name`.
3. **Hierarquia**: a coleção (ou grupo de tema) não é segmento do nome. Ela é determinada pela
   camada e pelo eixo; variável em coleção diferente da esperada é divergência do tipo
   `hierarchy`.

| Camada e eixo | Coleção | Modos |
| --- | --- | --- |
| `primitive` | Primitivos | Nenhum |
| `semantic`, eixo `invariant` | Semânticos invariantes | Nenhum |
| `semantic`, eixo `brand` (inclui `brand.*`) | Marca | Ids de marca |
| `semantic`, eixo `mode` | Modo | `light`, `dark` |
| `component` | Componentes | Nenhum |

4. **Modos**: os nomes de modo na ferramenta são iguais aos ids dos contextos.
5. **Sem variável auxiliar**: pela forma da seção 7.3, toda variação marca × modo existe como
   token; toda variável da ferramenta corresponde a um token, e o núcleo da sincronização não cria
   variável sem token (D4).

A forma do `sync-manifest.json`, a chave de renomeação guardada na ferramenta e os limites de modos
por plano ficam no contrato da sincronização e no ADR-14.

### 8.10 Evolução da convenção

- Acrescentar palavra a um vocabulário é mudança compatível: nenhum token muda de nome.
- Remover ou renomear palavra usada por token publicado, ou mudar a ordem dos segmentos, exige
  renomear tokens publicados, o que é mudança incompatível de API pública (GOV-01, Princípio X):
  versão major, `$deprecated` antes da remoção e guia de migração (GOV-05, GOV-06).
- Toda mudança de gramática começa por emenda deste contrato, aprovada pelo dono do pacote de
  tokens (GOV-09); validador e documento da convenção a seguem (seção 11).

## 9. Valores de cor (V-10)

1. O valor literal de cor só existe na camada primitiva, como objeto DTCG
   `{ colorSpace, components, alpha?, hex? }`, com `colorSpace` entre os 14 espaços do DTCG
   2025.10, `components` numéricos ou `"none"`, `alpha` de 0 a 1 (padrão 1) e `hex` opcional com
   6 dígitos.
2. **Os componentes são a fonte de verdade** (D5). O valor emitido, que é também o valor medido
   pela checagem de contraste, sai da função `toEmittedSrgb()` do pacote `@<prefixo>/color`:
   conversão para sRGB com mapeamento de gamut do CSS Color 4 (método `css`, deltaEOK com JND
   0,02, sempre passado explicitamente) e quantização de 8 bits por canal,
   `round(clamp(c, 0, 1) × 255)`. A serialização do alfa é única e definida em
   [css-output.md](css-output.md) e no ADR-15.
3. **Coerência do `hex` (V-10)**: se a cor está dentro do gamut sRGB e traz `hex`, o `hex`
   (comparado sem distinção de caixa) DEVE ser igual à quantização de 8 bits dos componentes. A
   divergência gera `TKN-COLOR-HEX-MISMATCH`, com o valor esperado na mensagem. O `hex` nunca
   substitui os componentes na emissão.
4. **Cor fora do gamut sRGB**: sob a premissa vigente, a cor é emitida pelo mapeamento do item 2;
   o `hex`, se houver, não é usado nem comparado. O build registra esses tokens no relatório de
   build, com o valor emitido, para revisão do responsável de design da marca. Usar um `hex`
   informado como política de emissão para cor fora do gamut exigiria emenda do ADR-15.
5. Tokens semânticos e de componente de cor são sempre alias (V-02); cores dentro de compostos
   (borda, sombra) seguem as mesmas regras.

## 10. Validação e formato de erro

### 10.1 Execução

`tokens-build validate [--json]` roda no diretório `packages/tokens`, chamado pelo script raiz
`pnpm tokens:validate` (via turbo) e pelo check obrigatório do workflow `tokens-ci.yml`.
`tokens-build build` executa a mesma validação antes de gerar; com erro, não grava nada em `dist/`
e sai com o mesmo código. Os testes chamam a mesma função com outra raiz de fonte.

Etapas, sem rede e com resultado determinístico:

1. integridade dos schemas contra `SHA256SUMS`;
2. leitura de cada arquivo com posições de linha e coluna (índice caminho → arquivo → linha →
   camada, D1) e validação Ajv contra `format.json` e `resolver.json`;
3. regras estruturais do resolver e dos arquivos (seções 4 e 5);
4. análise pelo parser com carregador só local, resolução de todas as permutações e regras das
   seções 6 a 9.

Erro nas etapas 1 a 3 interrompe a validação ao fim da etapa, depois de reportar todos os erros
dela, porque o modelo resolvido não seria confiável.

### 10.2 Códigos de saída

| Código | Significado |
| --- | --- |
| 0 | Fonte válida. |
| 1 | Violações encontradas (códigos da seção 10.5 com saída 1). |
| 2 | Erro de uso ou de configuração (argumento inválido, fonte ausente, schema adulterado, limite de permutações). |
| 3 | Erro interno; o rastreamento vai para stderr. |

### 10.3 Saída humana

Cada diagnóstico ocupa uma linha principal, seguida de linhas recuadas opcionais. A linha
principal segue a forma comum de [tools-cli.md](tools-cli.md) (seção 1.3), adequada a problem
matchers; a mensagem começa pelo caminho do token e termina com as regras e os requisitos:

```text
<arquivo>:<linha>:<coluna>  erro  <CÓDIGO>  <caminho-do-token>: <mensagem> [<V-xx>; <FR-xxx>]
```

```text
packages/tokens/src/semantic/mode/dark.tokens.json:4:13  erro  TKN-AXIS-BOTH  color.bg.surface: O token varia por marca e por modo; no modo "dark" o valor deve ser {brand.color.bg.surface.dark}. [V-08; FR-033]
  cadeia: color.bg.surface -> color.bg.accent (eixo marca)
  relacionado: packages/tokens/src/semantic/brand/a.tokens.json:4:13 color.bg.accent
packages/tokens/src/semantic/brand/b.tokens.json:1:1  erro  TKN-PARITY-CONTEXT  brand.color.bg.surface.dark: Chave ausente na marca "b" e presente nas demais. [V-13; FR-011]
  relacionado: packages/tokens/src/semantic/brand/a.tokens.json:12:11 brand.color.bg.surface.dark
tokens-build validate: 2 erros em 2 arquivos; 4 permutações verificadas (a/dark, a/light, b/dark, b/light).
```

Regras da saída:

- caminhos relativos à raiz do workspace, com separador `/`, nunca absolutos;
- linha e coluna começam em 1; a coluna conta unidades de código UTF-16, como os editores
  baseados em LSP;
- local apontado: a chave do token para erros de nome, tipo, camada e eixo; o início do `$value`
  (ou do subvalor) para erros de valor, alias e `hex`; a chave da propriedade para `$ref`,
  `$extends` e `$root`; o nó correspondente de `tokens.resolver.json` para erros do resolver; o
  arquivo do contexto em que a chave falta, em 1:1, para paridade; sem arquivo para erros globais
  (`TKN-CATEGORY-COVERAGE`), caso em que a linha começa por `packages/tokens/src` sem linha e
  coluna;
- mensagens em português, com modelo fixo por código; código, caminho, arquivo, linha e coluna são
  estáveis, e o texto da mensagem PODE ser refinado sem mudar o schema;
- ordem dos diagnósticos: arquivo (sem arquivo por último), linha, coluna, código e caminho, todos
  por code point. A saída não tem horário nem dado de ambiente.

### 10.4 Saída JSON

Com `--json`, só o documento abaixo vai para stdout. Ele usa o envelope comum e o formato de
achado de [tools-cli.md](tools-cli.md) (seções 1.3 a 1.5), em JSON canônico. Mudança incompatível
no formato incrementa `version`.

```ts
type Mode = "light" | "dark";
type Category =
  | "color" | "typography" | "space" | "size" | "radius" | "border"
  | "shadow" | "motion" | "z-index" | "breakpoint" | "opacity";

interface RelatedLocation {
  file: string;        // relativo à raiz do workspace, separador "/"
  line: number;        // 1-based
  column: number;      // 1-based, unidades UTF-16
  token: string | null;
  note: string;
}

// Achado (tools-cli.md, seção 1.5); só códigos com saída 1
interface TokenFinding {
  code: TokenValidationCode;        // seção 10.5
  rule: string;                     // regra principal do data-model, ex.: "V-08"
  severity: "error";                // todos os códigos deste contrato bloqueiam
  message: string;
  file?: string;                    // ausente em erro global
  line?: number;                    // 1-based
  column?: number;                  // 1-based, unidades UTF-16
  token?: string;                   // caminho com ".", ex.: "color.bg.surface"
  context?: { brand: string; mode: Mode }; // presente quando o achado ocorre numa única permutação
  data: {
    rules: readonly string[];        // ex.: ["V-08"]
    requirements: readonly string[]; // ex.: ["FR-033", "TOK-09"]
    permutations: readonly { brand: string; mode: Mode }[]; // vazio: independe de permutação
    chain?: readonly string[];       // ciclo, direção de camada, dependência de eixo
    related?: readonly RelatedLocation[];
  };
}

// Erro (tools-cli.md, seção 1.5); saídas 2 e 3
interface CliError {
  code: "USAGE" | "TKN-CONFIG-INPUT" | "TKN-CONFIG-SCHEMA-HASH" | "TKN-CONFIG-PERMUTATIONS" | "TKN-INTERNAL";
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

interface ValidateOutput {
  format: "<prefixo>.cli-result";
  version: 1;
  tool: "tokens-build";
  command: "validate";
  ok: boolean;
  exitCode: 0 | 1 | 2 | 3;
  summary: {
    errors: number;
    files: number;
    tokens: { primitive: number; semantic: number; component: number };
    permutations: readonly string[];               // ["a/dark", "a/light", ...]
    byCategory?: Readonly<Record<Category, number>>; // presente quando ok
    controlHeightScale?: Readonly<Record<string, readonly { step: string; value: string }[]>>;
  };
  findings: readonly TokenFinding[];
  errors: readonly CliError[];
}
```

Quando `ok` é verdadeiro, `byCategory` e `controlHeightScale` (chaveado por `<marca>/<modo>`)
trazem os mesmos valores que o build grava no relatório de build em `dist/meta/report.json`
(US1, cenário 4; FR-008).

### 10.5 Códigos de validação

| Código | O que barra | Regra | Requisitos | Saída |
| --- | --- | --- | --- | --- |
| `TKN-CONFIG-INPUT` | Fonte ou `tokens.resolver.json` ausente (argumento ou flag inválidos usam o código comum `USAGE`, [tools-cli.md](tools-cli.md), seção 1.6) | — | — | 2 |
| `TKN-CONFIG-SCHEMA-HASH` | Cópia de schema com sha256 diferente de `SHA256SUMS` | V-01 | FR-002, TOK-01 | 2 |
| `TKN-CONFIG-PERMUTATIONS` | Lista de permutações indefinida ou diferente de marcas × modos | V-13 | FR-010, FR-011 | 2 |
| `TKN-JSON-PARSE` | JSON inválido, BOM ou chave duplicada | V-01 | FR-002 | 1 |
| `TKN-SCHEMA` | Violação de `format.json` ou `resolver.json` | V-01 | FR-002, TOK-01 | 1 |
| `TKN-RESOLVER-STRUCTURE` | Modificadores, contextos, `default`, sets ou ordem fora da forma canônica | V-07 | FR-009, FR-010, TOK-08 | 1 |
| `TKN-RESOLVER-REF` | `$ref` do resolver não local, fora de `src/` ou inexistente | V-01 | FR-002 | 1 |
| `TKN-FILE-LOCATION` | Arquivo de tokens fora da estrutura; nome de arquivo diferente do id do contexto ou do componente | V-07 | FR-001, FR-009 | 1 |
| `TKN-FILE-UNREFERENCED` | Arquivo de tokens em `src/` não referenciado pelo resolver | — | FR-001, TOK-01 | 1 |
| `TKN-PATH-DUPLICATE` | Caminho definido em mais de um lugar (seção 7.1) | V-07, V-09 | FR-011, TOK-09 | 1 |
| `TKN-LITERAL-OUTSIDE-PRIMITIVE` | Literal, ou subvalor literal de composto, fora da camada primitiva | V-02 | FR-003, TOK-02 | 1 |
| `TKN-ALIAS-UNRESOLVED` | Alias para token inexistente em alguma permutação | V-03 | FR-004, TOK-02 | 1 |
| `TKN-ALIAS-CYCLE` | Ciclo de alias (com a cadeia) | V-03 | FR-004, TOK-02 | 1 |
| `TKN-ALIAS-TYPE` | Alvo do alias com tipo diferente do token | V-01, V-03 | FR-002, FR-004 | 1 |
| `TKN-LAYER-DIRECTION` | Referência para camada acima | V-04 | FR-004, TOK-02 | 1 |
| `TKN-REF-OUTSIDE-PRIMITIVE` | `$ref` fora da camada primitiva | V-05 | FR-003, FR-004 | 1 |
| `TKN-REF-NOT-LOCAL` | `$ref` remoto ou fora de `src/primitive/` | V-05 | FR-002 | 1 |
| `TKN-ROOT-FORBIDDEN` | Uso de `$root` | V-05 | FR-005 | 1 |
| `TKN-EXTENDS-FORM` | `$extends` fora da forma com chaves ou apontando para token | V-05 | FR-005 | 1 |
| `TKN-TYPE-MISSING` | `$type` não declarado no token nem em grupo ancestral | Token.type (data-model) | FR-002, FR-005 | 1 |
| `TKN-TYPE-CATEGORY` | `$type` incompatível com a categoria ou a propriedade | Categoria (data-model) | FR-005, FR-006 | 1 |
| `TKN-NAME-SEGMENT` | Segmento fora de `^[a-z0-9]+(-[a-z0-9]+)*$` | V-06 | FR-005, TOK-04 | 1 |
| `TKN-NAME-CATEGORY` | Primeiro segmento fora das categorias e de `brand` | V-06 | FR-005, FR-006, TOK-04, TOK-10 | 1 |
| `TKN-NAME-GRAMMAR` | Ordem, quantidade ou vocabulário de segmentos fora da seção 8.3 | V-06 | FR-005, TOK-04 | 1 |
| `TKN-NAME-RESERVED` | Grupo, palavra ou id reservado fora do lugar (seção 8.5) | V-06, V-08, V-12 | FR-005, FR-007, FR-033 | 1 |
| `TKN-NAME-COLLISION` | Dois caminhos com o mesmo nome CSS | V-06 | FR-005, FR-015, TOK-05 | 1 |
| `TKN-AXIS-DEPENDENCY` | Invariante com dependência de eixo; token de marca dependente de modo | V-07 | FR-011, FR-012 | 1 |
| `TKN-AXIS-BOTH` | Variação nos dois eixos fora da forma da seção 7.3 | V-08 | FR-033, TOK-09, DSN-04, DSN-05 | 1 |
| `TKN-BRAND-SOURCE-FORM` | Token `brand.*` com nome, local ou correspondência inválidos, ou órfão | V-08 | FR-033 | 1 |
| `TKN-BRAND-SOURCE-REF` | Token `brand.*` referenciado por quem não é o token de modo correspondente | V-08 | FR-033, FR-022 | 1 |
| `TKN-COLOR-HEX-MISMATCH` | `hex` diferente da quantização dos componentes em cor dentro do gamut | V-10 | FR-015, FR-020 | 1 |
| `TKN-CATEGORY-COVERAGE` | Categoria sem token semântico público | V-11 | FR-006, TOK-10 | 1 |
| `TKN-CONTROL-SCALE` | Escala de alturas de controle inválida ou `control-height` fora dela | V-12 | FR-007, TOK-13 | 1 |
| `TKN-PARITY-CONTEXT` | Chave ausente ou excedente num contexto de marca ou de modo | V-13 | FR-011, TOK-09 | 1 |
| `TKN-PARITY-PERMUTATION` | Conjunto de chaves semânticas diferente entre permutações | V-13 | FR-011, TOK-09, SC-004 | 1 |
| `TKN-INTERNAL` | Falha inesperada do validador | — | — | 3 |

As regras V-14 a V-16 (pares de contraste) são verificadas por `tokens-contrast check`, com
códigos próprios no contrato de contraste. O FR-001 fora de `src/` é verificado por
`repo-checks scan-tokens`.

`TokenValidationCode` é a união literal dos códigos desta tabela com saída 1, que vão em
`findings`; os códigos com saída 2 ou 3 vão em `errors` (seção 10.4). Acrescentar código é mudança
compatível; remover ou renomear incrementa `version`.

### 10.6 Fixtures

Em `tools/tokens-build`, cada código com saída 1 tem ao menos uma fixture inválida, e as fixtures
válidas produzem zero diagnósticos. Os testes comparam multiconjuntos de
`{file, line, column, code}`: 100% dos erros esperados e zero falsos positivos (SC-009, QA-02).
Fixtures obrigatórias incluem uma violação plantada só no arquivo da marca `b` e outra só no modo
`dark`, que provam a validação sobre todas as permutações (D1). A test-suite oficial do DTCG
2025.10 e as saídas de ouro são portão a cada atualização do parser (D1). As fixtures usam só
dados sintéticos (QA-15) e constam de `quality/scan-allowlist.json` com justificativa.

## 11. Documento da convenção

`docs/tokens/convencao-de-nomes.md` é o documento da convenção de nomenclatura exigido pelo TOK-04
("a convenção está publicada na documentação"). Ele é derivado deste contrato: seções 8.1 a 8.10,
regras de camada e de eixo das seções 6 e 7 que afetam nomes, derivação do nome CSS, segmento
privado, mapeamento para a ferramenta de design e exemplos.

- A forma preferida é a geração pelo `@<prefixo>/tokens-build` a partir da mesma tabela de
  gramática e vocabulários que o validador usa, o que mantém uma fonte por fato (Princípio I). Como
  arquivo gerado e versionado, ele é conferido por `pnpm check:drift`.
- Enquanto o gerador não existir, o documento PODE ser mantido em sincronia com este contrato por
  revisão, com um check que compara os vocabulários do documento com os do validador. Divergência
  entre documento e validador é defeito.
- Mudança de convenção começa por emenda deste contrato (seção 8.10), nunca pelo documento.
- A publicação no site de documentação cabe à feature de documentação (TOK-04, parte de
  publicação; spec, Dependências). Esta feature entrega o documento e a validação que rejeita
  nomes fora do padrão (FR-005).

## 12. Notas de alinhamento

1. **Nome do arquivo do resolver**: `packages/tokens/src/tokens.resolver.json`, neutro do prefixo
   (data-model e research alinhados).
2. **Primitivos exclusivos de marca**: arquivos de marca são da camada semântica e não aceitam
   literal (V-02), então todos os primitivos ficam no set compartilhado `primitive` e o build deriva
   a exclusividade pelas referências (D7; data-model, Marca). Adicionar marca continua alterando só
   arquivos de tokens (FR-009).
3. **Variáveis brutas privadas**: o relatório bruto de escopos CSS propunha variáveis privadas
   `--<prefixo>-_l-*`, `_d-*` e `_v-*`. O research.md (D3, D7) as substituiu por tokens públicos
   de eixo marca e pelo grupo reservado `brand.`; só os toggles de modo são privados.
4. **Variáveis auxiliares na ferramenta**: o relatório bruto de sincronização admitia variáveis
   auxiliares como exceção declarada. Não há exceção: a forma da seção 7.3 (FR-033) elimina a
   necessidade.
5. **Prioridade do `hex`**: o relatório bruto de cor fazia o `hex` prevalecer. Prevalecem os
   componentes, com checagem de coerência (D5, V-10).
6. **Vocabulários**: nenhum requisito fixa as palavras da seção 8.4; elas são proposta deste
   contrato, sujeitas à aprovação de dono e revisáveis quando chegarem os valores das marcas.

## 13. Rastreabilidade

| Requisito | Seções | Códigos principais |
| --- | --- | --- |
| FR-001 (TOK-01) | 4 | `TKN-FILE-LOCATION`, `TKN-FILE-UNREFERENCED`; varredura em `repo-checks scan-tokens` |
| FR-002 (TOK-01) | 4, 5, 10 | `TKN-SCHEMA`, `TKN-JSON-PARSE`, `TKN-CONFIG-SCHEMA-HASH` |
| FR-003, FR-004 (TOK-02) | 6 | `TKN-LITERAL-OUTSIDE-PRIMITIVE`, `TKN-ALIAS-*`, `TKN-LAYER-DIRECTION`, `TKN-REF-*` |
| FR-005 (TOK-04) | 8, 11 | `TKN-NAME-*`, `TKN-ROOT-FORBIDDEN`, `TKN-EXTENDS-FORM` |
| FR-006 (TOK-10) | 8.3 | `TKN-CATEGORY-COVERAGE`, `TKN-TYPE-CATEGORY` |
| FR-007 (TOK-13) | 8.6 | `TKN-CONTROL-SCALE` |
| FR-009, FR-010 (TOK-07, TOK-08) | 5 | `TKN-RESOLVER-STRUCTURE`, `TKN-CONFIG-PERMUTATIONS` |
| FR-011 (TOK-09) | 7.1, 7.4 | `TKN-PARITY-*`, `TKN-PATH-DUPLICATE` |
| FR-012 a FR-014 (TOK-14, ENG-06) | 7.2 (AX-2), 8.8 | `TKN-AXIS-DEPENDENCY` |
| FR-015 (TOK-05) | 8.7, 9 | `TKN-NAME-COLLISION`, `TKN-COLOR-HEX-MISMATCH` |
| FR-028, FR-029 (DSN-04, DSN-05) | 7.3, 8.9 | `TKN-AXIS-BOTH`, `TKN-BRAND-SOURCE-*` |
| FR-033 | 7.3 | `TKN-AXIS-BOTH`, `TKN-BRAND-SOURCE-FORM`, `TKN-BRAND-SOURCE-REF` |
