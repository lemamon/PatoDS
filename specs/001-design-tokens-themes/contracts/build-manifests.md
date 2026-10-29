# Contrato: manifestos e relatório do build de tokens

**Feature**: [spec.md](../spec.md) | **Modelo**: [data-model.md](../data-model.md) | **Data**: 2026-10-21

Formato normativo dos arquivos de `packages/tokens/dist/meta/` produzidos por
`tokens-build build` ([tools-cli.md](tools-cli.md)). Este contrato é o dono do formato; os
consumidores citam esta página:

| Arquivo | Consumidores | Requisitos |
| --- | --- | --- |
| `tokens.manifest.json` | `<prefixo>/design-tokens` e `<prefixo>/contrast-pairs` ([lint-rules.md](lint-rules.md)), `tokens-contrast` ([contrast-manifest.md](contrast-manifest.md)), testes em navegador ([css-output.md](css-output.md), §16), checagem do ENG-06 | FR-017, FR-020 a FR-023 |
| `sync-manifest.json` | `design-sync` (formato em [design-sync.md](design-sync.md)) | FR-025 a FR-030 |
| `report.json` e `report.md` | CI, pacote de aceite | FR-008 |

Todos são derivados, gerados a cada build, fora do controle de versão e publicados em `./meta/*`
para ferramentas; apps não os importam ([esm-output.md](esm-output.md)). `<prefixo>` é o marcador
da constituição.

## 1. Regras comuns

- **M-01** Envelope: todo arquivo JSON começa com `format` (identificador estável) e `version`
  (inteiro). Mudança incompatível no formato incrementa `version` e é mudança major do pacote
  ([esm-output.md](esm-output.md), §11.2).
- **M-02** JSON canônico: chaves de objeto ordenadas por code point, arrays na ordem definida neste
  contrato, indentação de 2 espaços, LF, newline final, sem timestamp, sem caminho absoluto, sem dado
  de ambiente. Dois builds da mesma fonte produzem arquivos idênticos byte a byte (FR-015, SC-002).
- **M-03** Caminhos de arquivo são relativos a `packages/tokens/` e usam `/`.
- **M-04** Chave de permutação: `"<marca>/<modo>"` (ex.: `"a/light"`). Permutações ordenadas por marca
  e depois por modo, ambas por code point.
- **M-05** Variáveis privadas do mecanismo de escopo (segmento `_`, como `--<prefixo>-_on-light`)
  nunca aparecem nos manifestos ([css-output.md](css-output.md), §6).

## 2. `tokens.manifest.json`

### 2.1 Raiz

```json
{
  "format": "<prefixo>.tokens-manifest",
  "version": 1,
  "attributes": { "brand": "data-<prefixo>-brand", "mode": "data-<prefixo>-mode" },
  "brands": [
    { "default": true, "file": "dist/css/brand-a.css", "id": "a" },
    { "default": false, "file": "dist/css/brand-b.css", "id": "b" }
  ],
  "layerOrder": ["<prefixo>.tokens"],
  "modes": [
    { "default": false, "id": "dark" },
    { "default": true, "id": "light" }
  ],
  "package": "@<prefixo>/tokens",
  "permutations": ["a/dark", "a/light", "b/dark", "b/light"],
  "scales": {
    "control-height": ["size.control.lg", "size.control.md", "size.control.sm"]
  },
  "tokens": []
}
```

| Campo | Regra |
| --- | --- |
| `brands[]` | Uma entrada por contexto do modificador `brand`, ordenada por `id`; exatamente uma com `default: true` (FR-013, CMP-24). |
| `modes[]` | `light` e `dark`, ordenados por `id`; `light` é o padrão (premissa do spec). |
| `layerOrder` | Cópia de `src/layers.json` ([css-output.md](css-output.md), L-03); `<prefixo>.tokens` primeiro. |
| `permutations` | Todas as combinações marca × modo (M-04). O build falha se a lista vier incompleta. |
| `scales.control-height` | Caminhos dos membros da escala única de alturas (FR-007), ordenados por caminho. A ordem de tamanho fica no relatório (§4). |
| `tokens[]` | Todos os tokens públicos e `brand-mode-source`, ordenados por `path` (code point). |

### 2.2 Token

```json
{
  "aliasChains": {
    "a/dark": ["color.bg.surface", "brand.color.bg.surface.dark", "color.neutral.900"],
    "a/light": ["color.bg.surface", "brand.color.bg.surface.light", "color.neutral.0"]
  },
  "aliasOf": {
    "dark": "brand.color.bg.surface.dark",
    "light": "brand.color.bg.surface.light"
  },
  "axis": "mode",
  "category": "color",
  "color": {
    "emitted": { "a/dark": "#16181d", "a/light": "#ffffff" },
    "subRefs": null
  },
  "cssName": "--<prefixo>-color-bg-surface",
  "deprecated": false,
  "description": "Fundo padrão de superfícies.",
  "exclusiveBrand": null,
  "layer": "semantic",
  "path": "color.bg.surface",
  "placement": "base",
  "role": "public",
  "scale": null,
  "source": { "column": 7, "file": "src/semantic/mode/light.tokens.json", "line": 4 },
  "type": "color"
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `path` | string | Caminho DTCG unido por `.` ([token-source.md](token-source.md)). |
| `cssName` | string | `--<prefixo>-` + segmentos unidos por `-` ([css-output.md](css-output.md), L-05). |
| `layer` | `primitive` \| `semantic` \| `component` | V-02, V-04. |
| `category` | string | Categoria do TOK-10 (data-model, "Categoria"). |
| `type` | string | `$type` DTCG resolvido. Compostos permitidos: `shadow`, `border`, `transition` (§2.3). |
| `axis` | `invariant` \| `brand` \| `mode` | V-07; primitivos e componentes são `invariant`. |
| `role` | `public` \| `brand-mode-source` | `brand-mode-source` = token sob o grupo `brand.` (FR-033). |
| `placement` | `base` \| `brand` \| `brand-exclusive` | Onde o CSS declara o token ([css-output.md](css-output.md), §4). |
| `exclusiveBrand` | string \| null | Id da marca quando `placement` é `brand-exclusive`; senão `null`. |
| `aliasOf` | objeto \| null | Alvo direto do alias por chave de contexto: `"*"` para `invariant`, id de marca para `brand`, id de modo para `mode`; `null` para primitivo. |
| `aliasChains` | objeto \| null | Por permutação (M-04), a cadeia do próprio token até o primitivo terminal, inclusive. `null` para primitivo. Usada pelo lint para conferir pertença à escala através de aliases (FR-023). |
| `scale` | `"control-height"` \| null | Membro da escala de alturas (FR-007). |
| `color` | objeto \| null | Só para `type` `color` ou composto com cor; senão `null` (§2.3). |
| `deprecated` | booleano \| string | De `$deprecated`. |
| `description` | string \| null | De `$description`. |
| `source` | objeto | Primeira definição do token: arquivo (M-03), linha e coluna, a partir de 1. |

### 2.3 Cor e compostos

- `color.emitted`: por permutação, a string exatamente como sai no CSS e no mapa `./values`
  (`#rrggbb` para opaco; `rgb(r g b / a)` com três casas no alfa), produzida por `toEmittedSrgb()`
  ([css-output.md](css-output.md), §11; ADR-15). O checker de contraste compõe a partir dessa string
  (`emitted-mismatch` se divergir do valor medido).
- `color.subRefs`: para `shadow` e `border`, por permutação, a lista ordenada (ordem das camadas da
  sombra) dos caminhos dos tokens de cor referenciados pelos subvalores; `null` para `color`.
- `typography` composto e `strokeStyle` em forma de objeto não são publicáveis
  ([css-output.md](css-output.md), S-04): `tokens-build build` os rejeita com
  `unserializable-value`, e a categoria `typography` usa tokens atômicos (decisão do plano).

### 2.4 Garantias

- **M-06** Todo token de `tokens[]` com `role: public` tem `cssName` declarado no CSS indicado por
  `placement`, e todo `cssName` público do CSS gerado consta do manifesto (`dist-parity` no build).
- **M-07** As chaves de `aliasChains` e `color.emitted` são exatamente `permutations`.
- **M-08** Nenhum token tem `placement: brand-exclusive` sem `exclusiveBrand`, nem o contrário.

## 3. `sync-manifest.json`

Formato normativo em [design-sync.md](design-sync.md). Este contrato só fixa que ele segue M-01 a
M-05, é gerado do mesmo modelo resolvido que `tokens.manifest.json` e lista as mesmas permutações.

## 4. `report.json` e `report.md`

```json
{
  "format": "<prefixo>.tokens-report",
  "version": 1,
  "categories": [
    { "category": "color", "component": 12, "primitive": 96, "semantic": 41 },
    { "category": "opacity", "component": 0, "primitive": 6, "semantic": 3 }
  ],
  "colorMapping": [
    { "outOfGamut": true, "path": "color.brand-a.500", "space": "oklch" }
  ],
  "controlHeight": {
    "a/light": [
      { "path": "size.control.sm", "value": "28px" },
      { "path": "size.control.md", "value": "36px" },
      { "path": "size.control.lg", "value": "44px" }
    ]
  },
  "files": [
    { "bytes": 0, "gzipBytes": 0, "path": "dist/css/base.css" }
  ],
  "permutations": ["a/dark", "a/light", "b/dark", "b/light"],
  "totals": { "component": 12, "primitive": 180, "semantic": 95 }
}
```

| Campo | Regra |
| --- | --- |
| `categories[]` | As 11 categorias do TOK-10, ordenadas por nome, com contagem por camada; categoria sem token semântico já falhou a validação (V-11). Evidência do FR-006 e do FR-008. |
| `controlHeight` | Por permutação, a escala resolvida em ordem crescente de valor (FR-008, TOK-13). |
| `colorMapping` | Cores fora do gamut sRGB mapeadas pelo algoritmo do CSS Color 4 (ADR-15); vazio quando não há. |
| `files[]` | Tamanho bruto e gzip de cada arquivo de `dist/css/` e `dist/esm/`, insumo do orçamento do QA-07 (gzip com nível fixo, para determinismo). |
| `permutations`, `totals` | Resumo. |

`report.md` traz as mesmas informações em tabelas, sem timestamp, e é anexado ao CI como evidência
(ACE-02).

## 5. Rastreabilidade

| ID | Coberto por |
| --- | --- |
| FR-006, FR-008 | §4 (`categories`, `controlHeight`) |
| FR-015 | M-02 |
| FR-017 | §2.2 (`placement`, `exclusiveBrand`), M-06, M-08 |
| FR-020, FR-021 | §2.3 (`color.emitted`, `subRefs`) |
| FR-022, FR-023 | §2.2 (`layer`, `role`, `aliasChains`, `scale`), §2.1 (`scales`) |
| FR-033 | `role`, `axis`, `aliasOf` |
| QA-07 | §4 (`files`) |
