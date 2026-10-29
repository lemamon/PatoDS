# Data Model: Design tokens e temas

**Feature**: [spec.md](spec.md) | **Pesquisa**: [research.md](research.md) | **Data**: 2026-10-21

Entidades do spec (Key Entities) com campos, regras de validação, relações e transições. Formatos
de arquivo e gramática detalhada ficam em [contracts/](contracts/). `<prefixo>` é o marcador da
constituição (TODO(PREFIXO)).

## Visão geral

```text
Resolver (packages/tokens/src/tokens.resolver.json)
 ├─ modificador brand ──► Marca (1..n, uma padrão)
 ├─ modificador mode  ──► Modo (light, dark; padrão light)
 └─ sets ──► arquivos *.tokens.json por camada ──► Token (1..n)

Permutação = Marca × Modo ──► mapa resolvido Token → valor
Build ──► Artefatos gerados (base.css, brand-<id>.css, ESM refs/values, manifestos, relatório)
Manifesto de contraste ──► Par de contraste (1..n) ──► Conjunto de superfícies (0..n)
sync-manifest.json ──► Variável da ferramenta ──► Execução de sincronização ──► Divergência
```

## Token

Unidade de decisão visual, definida só na fonte DTCG (FR-001).

| Campo | Tipo | Regra |
| --- | --- | --- |
| `path` | lista de segmentos | Caminho DTCG (`color.bg.surface`). Segmentos em ASCII minúsculo kebab, sem `$`, `{`, `}` ou `.` internos (DTCG 2025.10, FR-005). |
| `cssName` | string | `--<prefixo>-` + segmentos unidos por `-`. Único entre todos os tokens; colisão é erro (FR-005). |
| `layer` | `primitive` \| `semantic` \| `component` | Derivada do diretório da fonte e registrada no índice do adaptador (D1, D7). |
| `category` | enum Categoria | Primeiro segmento do caminho; segundo, sob o grupo reservado `brand` (FR-006). |
| `type` | `$type` DTCG | Declarado ou herdado do grupo, nunca inferido. Deve ser compatível com a categoria. |
| `axis` | `invariant` \| `brand` \| `mode` | Só para `semantic`. Primitivos e componentes são `invariant` na fonte (D7). |
| `role` | `public` \| `brand-mode-source` | `brand-mode-source` = token de eixo marca sob o grupo raiz reservado `brand`, cujo último segmento é o id de um modo (ex.: `brand.color.bg.surface.light`), fonte de um token de eixo modo (FR-033). Não consumível por estilo de componente. O grupo é necessário porque, no DTCG, um token não pode ter filhos. |
| `values` | mapa contexto → valor | Primitivo: literal DTCG. Semântico e componente: alias `{caminho}` (FR-003). Chaves do mapa seguem o eixo: um valor (`invariant`), um por marca (`brand`), um por modo (`mode`). |
| `description` | string | Opcional; texto livre sujeito à varredura de Unicode invisível do catálogo (IA-18, feature do catálogo). |
| `deprecated` | booleano ou string | Campo DTCG `$deprecated`; remoção segue SemVer major (Princípio X). |
| `source` | arquivo, linha, coluna | Do índice montado na leitura do Ajv; usado em toda mensagem de erro. |

**Regras de validação**:

- V-01 Schema DTCG 2025.10 (`format.json`, `resolver.json`) sem erro (FR-002).
- V-02 Literal só em `primitive` (FR-003). Composto (sombra, tipografia, borda) em `semantic` ou
  `component` não pode ter subvalor literal.
- V-03 Alias resolve para token existente, sem ciclo, em todas as permutações (FR-004).
- V-04 Direção de referência: `primitive → primitive`; `semantic → primitive | semantic`;
  `component → semantic | component | primitive` (FR-004).
- V-05 `$ref` (JSON Pointer) proibido fora de `primitive`; `$root` proibido; `$extends` só na forma
  com chaves (D1).
- V-06 Nome segue a gramática da convenção, por categoria, com segmentos em ordem fixa (FR-005;
  [contracts/token-source.md](contracts/token-source.md)).
- V-07 Eixo coerente com os contextos que definem o token: `brand` só em sets de contexto de marca,
  `mode` só em sets de contexto de modo, `invariant` só em sets compartilhados (D7).
- V-08 Variação nos dois eixos num único token é erro; a forma aceita é token de eixo modo cujo
  valor em cada modo é alias para o token `brand-mode-source` correspondente
  (`color.bg.surface` → `{brand.color.bg.surface.light}` no modo `light`), com as mesmas chaves em
  toda marca (FR-033). Todo token sob `brand.` é `brand-mode-source`, tem eixo `brand` e termina num
  id de modo.
- V-09 Sets compartilhados não têm valores de eixo marca ou modo (paridade não mascarada, D1).
- V-10 `hex` informado em cor dentro do gamut sRGB deve igualar a quantização de 8 bits dos
  componentes (D5).

## Camada

Enum `primitive`, `semantic`, `component` (TOK-02). Define literal permitido e direção de referência
(V-02, V-04). Estilos de componente só consomem `semantic` (com `role = public`) e `component`
(TOK-03, FR-022).

## Categoria

Enum fechado do TOK-10, com o `$type` DTCG permitido:

| Categoria (1º segmento) | `$type` permitido |
| --- | --- |
| `color` | `color` |
| `typography` | `fontFamily`, `fontWeight`, `dimension`, `number` (só tokens atômicos; o composto `typography` não é publicável, decisão do plano) |
| `space` | `dimension` |
| `size` (dimensão) | `dimension` |
| `radius` | `dimension` |
| `border` | `border`, `strokeStyle` (só em forma de string), `dimension` |
| `shadow` | `shadow` |
| `motion` | `duration`, `cubicBezier`, `transition` |
| `z-index` | `number` |
| `breakpoint` | `dimension` |
| `opacity` | `number` |

Regra: cada categoria tem ao menos um token `semantic` publicado (V-11, FR-006). Os nomes exatos dos
primeiros segmentos são fixados na convenção de nomenclatura (TOK-04) e só mudam por versão major.

## Escala de alturas de controle

Conjunto fechado e ordenado de tokens `semantic` da categoria `size` sob um grupo reservado (ex.:
`size.control.<passo>`), com o mesmo conjunto de passos em toda permutação (FR-007, TOK-13).

- V-12 Todo token cujo nome indica altura de controle pertence à escala; nenhum passo fora dela.
- O relatório de build lista a escala resolvida por permutação (FR-008).
- O manifesto de tokens marca `scale: "control-height"` nos membros, para a regra de lint (FR-023).

## Marca

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | string ASCII kebab | Contexto do modificador `brand`; vira valor de `data-<prefixo>-brand` e nome do arquivo `brand-<id>.css`. |
| `default` | booleano | Exatamente uma marca padrão, indicada pelo requerente (CMP-24). Até lá, a marca sintética A nos testes. |
| `sets` | arquivos | Só tokens semânticos de eixo `brand` (incluindo os `brand.*`). Todos os primitivos ficam em `src/primitive/`; o build deriva quais são exclusivos de uma marca pelas referências e os emite no arquivo dela (`placement: brand-exclusive`, [contracts/build-manifests.md](contracts/build-manifests.md)). |

Adicionar uma marca = novo contexto no resolver + novos arquivos de tokens; nenhum outro arquivo
muda (FR-009, SC-005). Marcas sintéticas (A, B, C) existem só em fixtures e exemplos (QA-15).

## Modo

Enum `light`, `dark`; padrão `light` (premissa do spec, Assumptions). Valor de
`data-<prefixo>-mode`. Um novo modo exigiria regenerar o resolvedor CSS e muda a API (major).

## Permutação (combinação de tema)

Par marca × modo. Para cada permutação o build tem o mapa resolvido token → valor final.

- V-13 Toda permutação tem exatamente o mesmo conjunto de chaves de tokens `semantic` (FR-011,
  SC-004); a paridade também é verificada por contexto (o que cada marca e cada modo contribuem).
- O build falha se a lista de permutações vier indefinida (limite do parser) ou incompleta.

## Escopo de tema (runtime)

Elemento HTML com `data-<prefixo>-brand`, `data-<prefixo>-mode` ou ambos.

- Resolução por eixo: vale o escopo mais próximo daquele eixo (FR-012).
- Sem atributo no elemento nem em ancestral: marca padrão e modo padrão (FR-013).
- Valor inexistente ou de marca não importada: mantém o valor do ancestral mais próximo (FR-014).
- Mecanismo: [contracts/css-output.md](contracts/css-output.md).

## Par de contraste

Item do manifesto versionado de contraste (FR-019).

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | string | Único; manifesto ordenado por `id`. |
| `fg` | ref de token | Só `semantic` público ou `component`; nunca primitivo ou literal. |
| `bg` | lista ordenada de refs ou nome de conjunto de superfícies | Pilha de baixo para cima; a base precisa ser opaca ou ser um conjunto de superfícies. |
| `state` | enum vocabulário de estados | `default`, `hover`, `active`, `focus-visible`, `selected`, `invalid`, `disabled`, `inactive` (vocabulário versionado, compartilhado com a regra do FR-021). |
| `kind` | `text` \| `non-text` | Define o mínimo (4,5 ou 3 sob WCAG 2.2 AA). |
| `group` | string opcional | Pares do mesmo grupo "any-of": o grupo passa se ao menos um membro atinge o mínimo. |
| `exempt` | `"wcag-inactive"` opcional | Permitido só com `state` `disabled` ou `inactive`; medido e reportado, não falha. |

- V-14 Toda referência existe em toda permutação (complementa V-13).
- V-15 Par sem `exempt`, fora de grupo, abaixo do mínimo em qualquer permutação falha o build
  (FR-020, SC-008).
- V-16 Pilha sem base opaca, ou conjunto de superfícies vazio no modo, é erro.

## Conjunto de superfícies

Nome (`@surfaces`, `@raised` etc.) → lista de tokens de superfície opaca por modo. O checker expande
um caso medido por superfície; todos precisam passar.

## Limiares de contraste

Seção do arquivo versionado de limiares do QA-14: `{ "level": "WCAG22-AA", "text": 4.5,
"nonText": 3 }`. O checker confere que os valores batem com o nível declarado (A11Y-01); alteração
exige a aprovação do QA-14.

## Artefatos gerados

Todos derivados, deterministas (FR-015, SC-002) e fora do controle de versão, exceto o relatório de
API de tokens, versionado de propósito e conferido por drift (QA-08). Formato dos manifestos e do
relatório: [contracts/build-manifests.md](contracts/build-manifests.md).

| Artefato | Conteúdo | Consumidor |
| --- | --- | --- |
| `dist/css/base.css` | Ordem das camadas, primitivos compartilhados, toggles de modo, resolvedor | Apps |
| `dist/css/brand-<id>.css` | Tokens de eixo marca e primitivos exclusivos da marca | Apps |
| `dist/esm/index.js` + `.d.ts` | Referências `var(--<prefixo>-*)` de todos os tokens públicos | Apps |
| `dist/esm/values.js` + `.d.ts` | Mapas de valores por marca × modo | Apps, testes |
| `dist/meta/tokens.manifest.json` | Token → cssName, camada, categoria, eixo, papel, cadeia de alias, escala | Lint, contraste |
| `dist/meta/sync-manifest.json` | Estado desejado para a ferramenta de design | design-sync |
| `dist/meta/report.json` e `.md` | Contagem por categoria, escala por permutação | CI, aceite |
| `api/tokens.api.json` | Superfície pública (nomes, tipos, entradas) | Verificação de API (GOV-01) |

## Variável da ferramenta de design

Espelho de um token na ferramenta (snapshot normalizado pelo adaptador).

| Campo | Regra |
| --- | --- |
| `path` | Mesmos segmentos do token; separador da ferramenta definido na convenção (FR-028). |
| `collection` | Uma por eixo: Primitivos, Marca, Modo, Semânticos invariantes, Componentes (FR-029). |
| `modes` | Marcas (coleção Marca), `light`/`dark` (coleção Modo); demais sem modos. |
| `value` | Literal ou alias por caminho, por modo. |
| `key` | Chave do token guardada em campo da ferramenta (ex.: descrição ou code syntax), para detectar renomeação manual. |
| `nativeRef` | Identificador opaco da ferramenta. |

Toda variável corresponde a um token real; não existe variável auxiliar (FR-033, DSN-04).

## Execução de sincronização

```text
planned ──--dry-run──► dry-run                         (nada aplicado; plano e log emitidos)
   │
   └──apply──► verify(diff vazio) ──► verified
        │            │
        └──erro──► failed ◄──verify(diff não vazio)    failed ──► alerta ao dono (FR-026)
```

Estados registrados no log: `planned`, `dry-run`, `verified`, `failed`
([contracts/design-sync.md](contracts/design-sync.md)).

| Campo | Regra |
| --- | --- |
| `version` | Versão publicada de origem (tag principal) ou execução manual sinalizada. |
| `changes[]` | Variáveis criadas, alteradas, renomeadas de volta e removidas, ordenadas por caminho. |
| `restored[]` | Edições manuais desfeitas (FR-027), distinguidas de mudanças de release. |
| `digests` | sha256 do manifesto de origem e do snapshot da ferramenta. |
| Envelope | Timestamp e URL da execução, fora do conteúdo canônico (conteúdo byte a byte idêntico). |

## Divergência

| Campo | Regra |
| --- | --- |
| `fingerprint` | sha256(tipo \| caminho \| modo \| ferramenta); deduplica itens. |
| `kind` | `missing`, `extra`, `value`, `alias`, `name`, `hierarchy`, `type`. |
| `owner` | Papel dono da sincronização (arquivo de donos, FR-026). |
| `due` | Data de detecção + SLA de configuração versionada. |
| `state` | `open` → `resolved` (fecha sozinho quando a próxima execução vê diff vazio) → `open` de novo se a mesma impressão digital reaparecer (o tracker reabre o item existente). |

Gerada pela verificação agendada, ao menos semanal e a cada versão publicada (FR-030, SC-011).

## Achado de lint

Saída das regras de estilo (FR-021 a FR-024): `{ file, line, column, code, message }`, com `code`
num conjunto estável ([contracts/lint-rules.md](contracts/lint-rules.md)). Fixtures comparam
multiconjuntos de `{file, line, column, code}`.
