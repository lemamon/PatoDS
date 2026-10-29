# Contrato: manifesto de contraste e checagem de pares

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) (D5, D6) |
**Modelo**: [data-model.md](../data-model.md) | **CLI**: [tools-cli.md](tools-cli.md) |
**Lint**: [lint-rules.md](lint-rules.md) |
**ADR**: [ADR-15](../../../docs/adr/ADR-15-cor-e-contraste.md) (Proposto) | **Data**: 2026-10-21

Este contrato define o formato do manifesto versionado de pares de contraste e do arquivo de
conjuntos de superfícies, as regras de validação V-14 a V-16, o algoritmo da checagem executada
pelo pacote privado `@<prefixo>/tokens-contrast` (`tools/tokens-contrast`, comando
`tokens-contrast check`), o formato do relatório e a conferência em navegador real. Ele cobre
FR-019 e FR-020, a parte de dados do FR-021, a User Story 4, SC-008 e, em parte, SC-009. A regra de
lint que confere se todo par usado em estilo consta do manifesto (FR-021) está em
[lint-rules.md](lint-rules.md). Os trechos são formatos e assinaturas; nenhuma implementação é
definida aqui. `<prefixo>` é o marcador da constituição (TODO(PREFIXO)).

## 1. Premissas e garantias

**Premissas assumidas** (nenhuma é decidida aqui):

| Decisão em aberto | Premissa usada | Efeito neste contrato |
| --- | --- | --- |
| Nível de conformidade alvo (A11Y-01) | WCAG 2.2 AA | Texto exige 4,5:1; não texto, incluindo indicador de foco, 3:1. Isenção de componente inativo e regra "basta um lado" para foco que atravessa a borda vêm desse nível (Clarifications do spec). |
| Marcas da versão 1.0 e marca padrão | Todas as marcas das apps atuais; até a entrega dos valores, marcas sintéticas A e B (QA-15) | O manifesto não lista marcas: as permutações vêm do resolver (`src/tokens.resolver.json`). A marca padrão não altera a checagem, que mede todas as permutações. |
| Paletas em cor de gamut amplo | Mapeamento determinístico para sRGB (pergunta aberta ao requerente em research.md) | O valor medido é o sRGB emitido por `toEmittedSrgb()` (seção 8). |
| Lista de navegadores (ENG-08) | Lista versionada ainda pendente | A conferência em navegador real roda em Chromium em todo PR e em todos os motores da lista à noite e antes de publicar (QA-12). |
| Plataforma de CI | GitHub Actions (inferida do ENG-18, pendente de confirmação) | O relatório é publicado como artefato do job e retido como evidência (ACE-02). |

**Garantias**:

- G-1 (FR-020): todo par do manifesto é medido em todas as permutações marca × modo, com a mesma
  lista de permutações que o gerador de CSS usa. Lista indefinida ou vazia é erro.
- G-2 (TOK-05, Princípio I): o valor medido é o valor emitido. O gerador de CSS e o checker chamam a
  mesma função `toEmittedSrgb()` de `@<prefixo>/color`, e o checker confere a sua saída contra a
  string emitida pelo build (código `emitted-mismatch`).
- G-3 (SC-002): para as mesmas entradas, o relatório é idêntico byte a byte, sem data, hora, caminho
  absoluto ou formatação dependente de localidade.
- G-4 (QA-14): os mínimos vêm do arquivo de limiares, nunca do código; o checker recusa valores que
  não batem com o nível declarado.

## 2. Arquivos

| Caminho | Papel | Versionado | Dono (GOV-09) |
| --- | --- | --- | --- |
| `packages/tokens/contrast/manifest.json` | Pares de contraste (FR-019) | Sim | Dono de acessibilidade |
| `packages/tokens/contrast/surfaces.json` | Conjuntos nomeados de superfícies opacas | Sim | Dono de acessibilidade |
| `packages/tokens/contrast/manifest.schema.json` | JSON Schema 2020-12 do manifesto e fonte única do vocabulário de estados | Sim | Dono de acessibilidade |
| `packages/tokens/contrast/surfaces.schema.json` | JSON Schema 2020-12 dos conjuntos | Sim | Dono de acessibilidade |
| `quality/thresholds.json`, seção `contrast` | Nível e mínimos (QA-14) | Sim | Pessoa indicada pelo requerente |
| `packages/tokens/dist/meta/tokens.manifest.json` | Entrada gerada pelo build (seção 13) | Não (gerado) | — |
| `<out>/contrast-report.json` e `<out>/contrast-report.md` | Relatório (seção 10) | Não (artefato do CI) | — |

Os dois nomes de arquivo de schema são propostos por este contrato. O diretório `contrast/` não
faz parte do tarball: fica fora de `exports` e da allowlist de arquivos publicados (ENG-17). Pela
camada, `@<prefixo>/tokens-contrast` depende de `@<prefixo>/tokens` só como devDependency e só lê
`./meta/*` e os arquivos de `contrast/` por caminho; `@<prefixo>/color` é folha, sem dependência do
workspace (ENG-01).

## 3. Formato do manifesto (`manifest.json`)

Exemplo (nomes de token ilustrativos; a gramática por categoria está em
`docs/tokens/convencao-de-nomes.md` e em [token-source.md](token-source.md)):

```json
{
  "$schema": "./manifest.schema.json",
  "schemaVersion": 1,
  "pairs": [
    {
      "id": "button.default.label",
      "fg": "color.button.fg.default",
      "bg": ["color.button.bg.default"],
      "state": "default",
      "kind": "text"
    },
    {
      "id": "button.disabled.label",
      "fg": "color.button.fg.disabled",
      "bg": ["color.button.bg.disabled"],
      "state": "disabled",
      "kind": "text",
      "exempt": "wcag-inactive"
    },
    {
      "id": "focus.ring.inner",
      "fg": "color.border.focus",
      "bg": ["color.button.bg.default"],
      "state": "focus-visible",
      "kind": "non-text",
      "group": "focus-ring-button"
    },
    {
      "id": "focus.ring.outer",
      "fg": "color.border.focus",
      "bg": "@surfaces",
      "state": "focus-visible",
      "kind": "non-text",
      "group": "focus-ring-button"
    },
    {
      "id": "overlay.scrim.text",
      "fg": "color.fg.inverse",
      "bg": ["@surfaces", "color.bg.scrim"],
      "state": "default",
      "kind": "text",
      "description": "Texto sobre véu translúcido aberto sobre qualquer superfície"
    }
  ]
}
```

Campos de cada par:

| Campo | Obrigatório | Tipo | Regra |
| --- | --- | --- | --- |
| `id` | Sim | string | ASCII minúsculo, segmentos kebab unidos por `.`; único; o arquivo é ordenado por `id` em ordem de code point. |
| `fg` | Sim | caminho de token | Token `semantic` com papel `public`, ou token `component`, de `$type` `color`. Nunca primitivo, nunca `brand-mode-source` (grupo `brand.`), nunca literal. |
| `bg` | Sim | pilha ou `@conjunto` | Pilha de baixo para cima. Forma de lista: o primeiro item é um caminho de token ou um `@conjunto`; os demais são caminhos de token. Forma curta: a string `"@conjunto"`, equivalente a `["@conjunto"]`. A base precisa ser opaca em toda permutação ou ser um conjunto de superfícies (V-16). |
| `state` | Sim | enum | Vocabulário de estados da seção 5. |
| `kind` | Sim | `text` \| `non-text` | Define o mínimo: `thresholds.text` ou `thresholds.nonText`. |
| `group` | Não | string kebab | Grupo `any-of`: passa quando ao menos um membro atinge o mínimo (seção 8, passo 9). Só para indicador de foco que atravessa a borda do componente. |
| `exempt` | Não | `"wcag-inactive"` | Só com `state` `disabled` ou `inactive`. O par é medido e reportado, mas não falha. |
| `description` | Não | string até 200 caracteres | Texto livre para revisão; sem efeito na checagem. |

Não existe forma "texto grande" com mínimo 3:1: sob a premissa, o FR-020 fixa 4,5:1 para todo
texto. Opacidade aplicada por propriedade CSS `opacity` também não é modelada neste contrato; a
translucidez vem do canal alfa do próprio token de cor (cenário 3 da User Story 4). O efeito de
`opacity` em elementos fica coberto pelo motor de regras em navegador real (A11Y-02).

Esboço do schema (`manifest.schema.json`, JSON Schema 2020-12):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PatoDS: manifesto de pares de contraste",
  "type": "object",
  "additionalProperties": false,
  "required": ["$schema", "schemaVersion", "pairs"],
  "properties": {
    "$schema": { "type": "string" },
    "schemaVersion": { "const": 1 },
    "pairs": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/pair" } }
  },
  "$defs": {
    "segment": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
    "tokenPath": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+(-[a-z0-9]+)*)+$" },
    "setRef": { "type": "string", "pattern": "^@[a-z][a-z0-9]*(-[a-z0-9]+)*$" },
    "state": {
      "enum": ["default", "hover", "active", "focus-visible", "selected", "invalid", "disabled", "inactive"]
    },
    "bg": {
      "oneOf": [
        { "$ref": "#/$defs/setRef" },
        {
          "type": "array",
          "minItems": 1,
          "prefixItems": [{ "anyOf": [{ "$ref": "#/$defs/tokenPath" }, { "$ref": "#/$defs/setRef" }] }],
          "items": { "$ref": "#/$defs/tokenPath" }
        }
      ]
    },
    "pair": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "fg", "bg", "state", "kind"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+(-[a-z0-9]+)*)*$" },
        "fg": { "$ref": "#/$defs/tokenPath" },
        "bg": { "$ref": "#/$defs/bg" },
        "state": { "$ref": "#/$defs/state" },
        "kind": { "enum": ["text", "non-text"] },
        "group": { "$ref": "#/$defs/segment" },
        "exempt": { "const": "wcag-inactive" },
        "description": { "type": "string", "maxLength": 200 }
      },
      "allOf": [
        {
          "if": { "required": ["exempt"] },
          "then": { "properties": { "state": { "enum": ["disabled", "inactive"] } }, "not": { "required": ["group"] } }
        },
        {
          "if": { "required": ["group"] },
          "then": { "properties": { "state": { "const": "focus-visible" }, "kind": { "const": "non-text" } } }
        }
      ]
    }
  }
}
```

O schema cobre a forma. Ordenação, unicidade, camadas, existência dos tokens e opacidade são
regras semânticas do checker (seção 6), porque dependem do manifesto de tokens e das permutações.

## 4. Conjuntos de superfícies (`surfaces.json`)

Um conjunto nomeado lista, por modo, os tokens de superfície opaca sobre os quais um token
translúcido ou um elemento pode ficar. O checker expande um caso medido por superfície do modo da
permutação, e todos os casos precisam passar (pior caso por enumeração).

```json
{
  "$schema": "./surfaces.schema.json",
  "schemaVersion": 1,
  "sets": {
    "@raised": {
      "dark": ["color.bg.raised"],
      "light": ["color.bg.raised"]
    },
    "@surfaces": {
      "dark": ["color.bg.raised", "color.bg.surface"],
      "light": ["color.bg.raised", "color.bg.sunken", "color.bg.surface"]
    }
  }
}
```

Regras:

- Nome do conjunto: `@` seguido de segmento kebab; chaves de `sets` em ordem de code point.
- As chaves de cada conjunto são exatamente os ids de modo do resolver (`dark`, `light`), nem mais
  nem menos.
- Cada lista é não vazia (V-16), ordenada por code point e sem repetição.
- Cada item é token `semantic` público ou `component`, de `$type` `color`, opaco (alfa 1 no valor
  emitido) em toda permutação do modo correspondente (V-16).

Esboço do schema (`surfaces.schema.json`):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["$schema", "schemaVersion", "sets"],
  "properties": {
    "$schema": { "type": "string" },
    "schemaVersion": { "const": 1 },
    "sets": {
      "type": "object",
      "propertyNames": { "pattern": "^@[a-z][a-z0-9]*(-[a-z0-9]+)*$" },
      "additionalProperties": {
        "type": "object",
        "minProperties": 1,
        "additionalProperties": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*(\\.[a-z0-9]+(-[a-z0-9]+)*)+$" }
        }
      }
    }
  }
}
```

## 5. Vocabulário de estados

O vocabulário é versionado e tem uma única fonte: `$defs.state.enum` de `manifest.schema.json`.
A regra `<prefixo>/contrast-pairs` lê a mesma lista; todo destino do seu mapa de seletores para
estados precisa pertencer a ela ([lint-rules.md](lint-rules.md), seção 4.3).

| Estado | Significado | Pode ter `exempt` |
| --- | --- | --- |
| `default` | Repouso, sem interação | Não |
| `hover` | Ponteiro sobre o elemento | Não |
| `active` | Ativação em curso (pressionado) | Não |
| `focus-visible` | Foco visível, incluindo o indicador de foco | Não |
| `selected` | Selecionado, marcado, pressionado em alternância ou atual | Não |
| `invalid` | Valor inválido | Não |
| `disabled` | Desabilitado | Sim |
| `inactive` | Inativo por outro motivo que o WCAG trata como componente inativo | Sim |

Acrescentar estado é mudança `minor` do schema (`schemaVersion` inalterado, enum ampliado) e exige
atualização simultânea do mapa de estados da regra de lint. Remover ou renomear estado exige
`schemaVersion` novo.

## 6. Regras de validação

Regras de estrutura, verificadas antes da medição (prefixo CM, de "contrast manifest"). Os códigos
são os da tabela de achados de [tools-cli.md](tools-cli.md) (seção 3.1), que inclui
`unknown-surface-set`, `duplicate-pair`, `invalid-group` e `emitted-mismatch`.

| Regra | Descrição | Código |
| --- | --- | --- |
| CM-01 | `manifest.json` e `surfaces.json` validam contra os schemas; `schemaVersion` suportado (hoje, 1). | `manifest-schema` |
| CM-02 | `pairs` ordenado por `id` em ordem de code point; `id` único. | `unsorted-manifest`, `duplicate-id` |
| CM-03 | `fg`, itens de `bg` e itens de conjuntos referenciam token `semantic` público ou `component` de `$type` `color`. Primitivo, `brand-mode-source`, variável privada, literal ou outro tipo é erro. | `forbidden-reference` |
| CM-04 | `@conjunto` só aparece na primeira posição de `bg` e existe em `surfaces.json`. | `unknown-surface-set` |
| CM-05 | Nenhum par repete a tupla canônica (`fg`, `bg` normalizado para lista, `state`, `kind`) de outro par. A unicidade da tupla permite à regra de lint casar pares sem ambiguidade. | `duplicate-pair` |
| CM-06 | Grupo tem ao menos dois membros, todos com `state` `focus-visible`, `kind` `non-text`, o mesmo `fg` e `bg` distintos; nenhum membro tem `exempt`. | `invalid-group` |
| CM-07 | `exempt` só com `state` `disabled` ou `inactive` (também imposto pelo schema). | `exempt-invalid-state` |
| CM-08 | `state` pertence ao vocabulário (seção 5). Reportado com este código, e não como `manifest-schema`, para apontar o vocabulário. | `unknown-state` |

Regras V-14 a V-16 do [modelo de dados](../data-model.md), na forma operacional:

- **V-14** Toda referência do par (`fg`, cada item de `bg`, cada superfície dos conjuntos usados)
  existe e resolve para um valor de cor em toda permutação. Complementa a paridade de chaves
  (V-13): um token ausente em uma permutação é erro que aponta par, marca e modo. Código
  `unknown-token`.
- **V-15** Um par sem `exempt` e fora de grupo cuja razão fica abaixo do mínimo do seu `kind` em
  qualquer permutação falha o build (FR-020, SC-008). Um grupo em que nenhum membro atinge o mínimo
  numa permutação falha o build. Par com `exempt` nunca falha, mesmo abaixo do mínimo. Códigos
  `pair-below-minimum` e `group-below-minimum`.
- **V-16** A base da pilha precisa ter alfa 1 em toda permutação, conferido no valor emitido; um
  conjunto de superfícies precisa ter ao menos uma superfície no modo da permutação, e cada
  superfície precisa ser opaca. O checker nunca presume fundo branco, porque o padrão do WCAG
  ("branco presumido") é inseguro com modo escuro. Códigos `stack-not-opaque` (base ou superfície
  translúcida) e `empty-surface-set`.

Erro de consistência do build: `emitted-mismatch`, quando a string que `toEmittedSrgb()` produz
para um token numa permutação difere da string emitida que o build registrou no manifesto de
tokens. Indica divergência entre gerador e checker e bloqueia como violação.

Todo achado desta seção tem `severity` `error` e leva o comando a sair com código 1. O formato
segue [tools-cli.md](tools-cli.md) (seção 1.5): `token` com o caminho do token, `context` com
`{ brand, mode }` quando o achado depende da permutação e `data` com `{ pair, ratio, minimum,
surface }` quando houver medição. Achados vindos de arquivo JSON trazem arquivo, linha e coluna do
nó ofensor.

## 7. Limiares

O checker lê só a seção `contrast` de `quality/thresholds.json` (QA-14):

```json
{
  "contrast": { "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }
}
```

O checker contém uma tabela interna dos valores normativos por nível. Hoje ela tem só
`WCAG22-AA` (texto 4,5; não texto 3), que é a premissa vigente do A11Y-01. Nível desconhecido, ou
valor que difira da tabela para o nível declarado, é erro de configuração (código de saída 2, erro
`THRESHOLDS_MISMATCH`): os mínimos não podem ser rebaixados em silêncio. Trocar de nível exige
mudança aprovada do arquivo de limiares (QA-14) e da tabela do checker, registrada no ADR-15.

## 8. Algoritmo da checagem

Entradas: manifesto e conjuntos validados (seção 6, CM-01 a CM-08), manifesto de tokens gerado,
limiares. Todas as iterações seguem ordem de code point, e todas as funções são puras.

1. **Permutações.** Ler a lista de permutações do manifesto de tokens (a mesma do gerador de CSS,
   vinda de `listPermutations()` do resolver). Lista ausente ou vazia é erro de configuração
   (código 2, erro `CONFIG`).
2. **Casos.** Para cada par (por `id`) e cada permutação (por marca, depois modo), normalizar `bg`
   para lista. Se a base é um `@conjunto`, expandir um caso por superfície do conjunto no modo da
   permutação (V-16 quando vazio), em ordem de caminho de token, com a superfície no lugar da base;
   senão há um único caso.
3. **Resolução.** Resolver cada referência para o valor DTCG de cor da permutação (V-14).
4. **Valor emitido.** Passar cada valor por `toEmittedSrgb()` de `@<prefixo>/color`: componentes
   DTCG como fonte de verdade, mapeamento de gamut do CSS Color 4 (método `css`, deltaEOK, JND
   0,02, sempre passado explicitamente) e quantização de 8 bits (ADR-15). A string segue a forma
   única de [css-output.md](css-output.md): `#rrggbb` para cor opaca e `rgb(r g b / a)`, com `a` em
   três casas decimais, para cor com alfa menor que 1. Conferir a string contra a emitida pelo
   build (`emitted-mismatch`). Ler de volta da string os canais inteiros `r, g, b` em 0..255 e o
   alfa `a`; o checker compõe com esse alfa lido de volta, de modo que o medido é o emitido.
5. **Base opaca.** Exigir `a = 1` na base da pilha e em cada superfície expandida (V-16).
6. **Composição.** Compor em sRGB codificado em gama (CSS Compositing, source-over sobre fundo
   opaco), por canal, de baixo para cima:
   `B₀ = base`; `Bᵢ = aᵢ · Lᵢ + (1 − aᵢ) · Bᵢ₋₁` para cada camada `Lᵢ` acima da base; e a frente
   `F = a_fg · fg + (1 − a_fg) · Bₙ`. Composição em luz linear não é usada, porque diverge do que o
   navegador mostra e do que o axe mede.
7. **Duas variantes.** Calcular a composição em duas variantes:
   - *ponto flutuante*: nenhum arredondamento entre as dobras;
   - *8 bits por dobra*: arredondar cada canal para inteiro (meio para cima, como `Math.round`)
     depois de **cada** dobra, tanto das camadas de fundo quanto da frente sobre o fundo, como o
     `flattenColors` do axe-core.
8. **Razão WCAG 2.2.** Para cada variante: `c = v / 255`; linearizar com
   `c ≤ 0,04045 ? c / 12,92 : ((c + 0,055) / 1,055)^2,4`; `L = 0,2126 R + 0,7152 G + 0,0722 B`;
   razão `(L_maior + 0,05) / (L_menor + 0,05)`, sem nenhum arredondamento. A razão do caso é a menor
   das duas variantes.
9. **Decisão por caso.** Mínimo `m = thresholds.text` para `kind` `text` e `thresholds.nonText`
   para `non-text`. O caso passa quando `razão ≥ m`, sem arredondar (4,499 reprova 4,5). Resultado
   do caso: `exempt` quando o par tem `exempt` (medido e reportado, nunca falha); senão `pass` ou
   `fail`.
10. **Decisão por par e por grupo.** Um par passa numa permutação quando todos os seus casos
    passam (pior caso entre superfícies). Par fora de grupo e sem `exempt` que não passa numa
    permutação gera `pair-below-minimum` com `context` dessa permutação. Um grupo passa numa
    permutação quando ao menos um membro passa nela (`any-of`, Understanding 1.4.11); senão gera
    `group-below-minimum` com `context`. Membro reprovado de grupo aprovado mantém `result` `fail`
    no caso, sem gerar achado. O `result` do grupo no relatório é `pass` só quando o grupo passa em
    todas as permutações.
11. **Sinal informativo.** Caso aprovado com `razão − m < 0,05` recebe a marca `near-threshold` em
    `flags`. Ela não falha a checagem; indica risco de divergência com o axe (seção 11) e com a
    quantização de alfa do motor.
12. **Saída.** Código 0 sem achados; 1 com qualquer achado das seções 6 e 8; 2 para uso ou
    configuração inválidos; 3 para erro interno. Casos `fail` de membros de grupo aprovado e casos
    `exempt` não mudam o código.

Exemplo de referência (vetor de teste unitário): texto branco opaco sobre véu preto com alfa 0,5,
aberto sobre superfície branca. Na variante de ponto flutuante o fundo composto vale 127,5 por
canal e a razão é cerca de 3,976 (exibida 3.97); na variante de 8 bits o fundo arredonda para 128 e
a razão é cerca de 3,949 (exibida 3.94). Vale 3,94: reprovado para texto. Sobre superfície preta, o
mesmo véu dá razão 21. Por isso um véu translúcido sobre fundo desconhecido não pode ser aprovado em
geral, e o manifesto exige base opaca ou conjunto de superfícies.

Outros vetores obrigatórios (QA-02): `#767676` sobre `#ffffff` = 4,54 (aprovado para texto);
`#777777` sobre `#ffffff` = 4,47 (reprovado); preto sobre branco = 21,00; e conferência com o
colorjs.io dentro de 1e-4 para cores opacas dentro do gamut.

## 9. CLI `tokens-contrast check`

A interface de linha de comando é a de [tools-cli.md](tools-cli.md) (seção 3.1), com as convenções
comuns daquele contrato: `--json` com um único documento JSON canônico em stdout; saída humana nos
demais casos, uma linha por achado no formato `arquivo:linha:coluna  erro  código  mensagem` e uma
linha de resumo; `--root` para a raiz do repositório.

```text
tokens-contrast check [--manifest <arquivo>] [--surfaces <arquivo>] [--tokens <arquivo>]
                      [--thresholds <arquivo>] [--out <dir>] [--json]
```

| Opção | Padrão (relativo à raiz do repositório) |
| --- | --- |
| `--manifest` | `packages/tokens/contrast/manifest.json` |
| `--surfaces` | `packages/tokens/contrast/surfaces.json` |
| `--tokens` | `packages/tokens/dist/meta/tokens.manifest.json`; ausente: código 2 com orientação para rodar `pnpm tokens:build` |
| `--thresholds` | `quality/thresholds.json`, seção `contrast` |
| `--out` | Sem padrão; quando presente, grava `contrast-report.json` e `contrast-report.md` |

Códigos de saída: 0 sem achados; 1 achados (validação ou contraste); 2 uso ou configuração
(`USAGE`, `CONFIG`, `THRESHOLDS_MISMATCH`); 3 erro interno (`INTERNAL`). O script raiz
`pnpm contrast:check` roda o comando via turbo, depois de `@<prefixo>/tokens#tokens:build`; o job
`contrast` passa `--out <dir>`, publica os dois arquivos como artefato e os retém como evidência do
A11Y-09 na matriz do ACE-02.

## 10. Relatório

`contrast-report.json` (gravado em `--out`, com o mesmo conteúdo impresso por `--json`) e
`contrast-report.md` (tabela legível, gravada em `--out`) são ordenados, usam LF, não têm data, hora
nem caminho absoluto e formatam números sem depender de localidade (ponto como separador decimal).
O JSON segue as regras de JSON canônico de [tools-cli.md](tools-cli.md) (seção 1.4).

**Razões**: truncadas, nunca arredondadas. Na tabela, duas casas com zeros à direita (`4.49`,
`4.50`, `21.00`); no JSON, números truncados em quatro casas, como em tools-cli.md. O resultado vem
sempre da comparação sem truncamento, e um caso reprovado nunca exibe valor maior ou igual ao mínimo
(4,4996 é exibido `4.49` na tabela e `4.4996` no JSON).

Formato do JSON: o envelope comum de tools-cli.md (seção 1.3) mais as chaves do comando:

```ts
type State = 'default' | 'hover' | 'active' | 'focus-visible'
  | 'selected' | 'invalid' | 'disabled' | 'inactive';

interface ContrastCheckResult {
  format: '<prefixo>.cli-result'; version: 1;
  tool: 'tokens-contrast'; command: 'check';
  ok: boolean; exitCode: 0 | 1 | 2 | 3;
  level: 'WCAG22-AA';
  minimums: { nonText: number; text: number };
  summary: {
    cases: number; pairs: number;
    passed: number; failed: number; exempt: number;   // passed + failed + exempt = cases
    groups: { passed: number; failed: number };
  };
  cases: ContrastCase[];      // ordenado por pair, brand, mode, surface
  groups: ContrastGroup[];    // ordenado por id
  findings: Finding[];        // formato e ordem de tools-cli.md, seção 1.5
  errors: CliError[];         // códigos 2 e 3
}

interface ContrastCase {
  pair: string; brand: string; mode: string;
  surface: string | null;     // superfície expandida de um @conjunto
  state: State; kind: 'text' | 'non-text';
  fg: string;                 // caminho do token de frente
  bg: string[];               // pilha expandida, de baixo para cima (a superfície ocupa a base)
  ratio: number;              // menor das duas variantes, truncada em 4 casas
  ratioFloat: number; ratio8bit: number;
  minimum: number;            // 4.5 ou 3
  result: 'pass' | 'fail' | 'exempt';
  group: string | null;
  flags: Array<'near-threshold'>; // tools-cli.md, seção 3.1
}

interface ContrastGroup {
  id: string;
  members: string[];          // ids dos pares, ordenados
  result: 'pass' | 'fail';    // pass só quando o grupo passa em todas as permutações
}
```

Tabela (`contrast-report.md`, esboço com valores ilustrativos; uma linha por caso, na ordem de
`cases`):

```markdown
# Relatório de contraste

Nível: WCAG22-AA. Mínimos: texto 4.50; não texto 3.00.

| pair | brand | mode | surface | state | kind | min | ratio | result | group |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| button.default.label | a | dark | - | default | text | 4.50 | 7.12 | pass | - |
| button.disabled.label | a | dark | - | disabled | text | 4.50 | 2.10 | exempt | - |
| focus.ring.inner | a | dark | - | focus-visible | non-text | 3.00 | 2.41 | fail | focus-ring-button |
| focus.ring.outer | a | dark | color.bg.raised | focus-visible | non-text | 3.00 | 3.37 | pass | focus-ring-button |
| overlay.scrim.text | a | light | color.bg.surface | default | text | 4.50 | 3.94 | fail | - |

## Grupos

| group | members | result |
| --- | --- | --- |
| focus-ring-button | focus.ring.inner, focus.ring.outer | pass |

## Achados

- `packages/tokens/contrast/manifest.json:41:7` `pair-below-minimum` overlay.scrim.text (a/light): 3.94 < 4.50

## Resumo

cases=32 pairs=5 passed=25 failed=3 exempt=4 groups.passed=1 groups.failed=0 findings=2
```

## 11. Conferência em navegador real (amostras)

A checagem estática prova a matemática; a conferência em navegador real prova que gerador,
cascata e checker concordam (Princípio VII, ADR-08, QA-06). Ela fica na app de exemplo
`@<prefixo>/tokens-example`, que instala só o tarball empacotado, e roda em `pnpm test:e2e`.

- **Página**: uma página dedicada da app de exemplo (nome proposto `contrast.html`) importa
  `@<prefixo>/tokens/css/base.css` e todos os `brand-<id>.css` do tarball, e estiliza as amostras
  com as referências `var(--<prefixo>-*)` exportadas por `@<prefixo>/tokens`. A página do FR-017,
  que importa só a marca A, é outra.
- **Entrada dos casos**: a lista `cases` do `contrast-report.json` do mesmo commit, recebida pelo job
  como arquivo (variável de ambiente `CONTRAST_REPORT`). É dado de teste, não dependência de pacote:
  a app continua sem aresta para `tools/*` (ENG-01). A tarefa `test:e2e` passa a depender, no grafo
  de tarefas do turbo, da tarefa que gera o relatório ([tools-cli.md](tools-cli.md), seção 7).
- **Valores esperados**: vêm do mapa de valores do tarball (`@<prefixo>/tokens/values`,
  `values[marca][modo][token]`), nunca escritos à mão. Como o checker já provou que a sua conversão
  é igual à string emitida (`emitted-mismatch`), a igualdade com o valor computado fecha a cadeia
  medido = emitido = renderizado.
- **Pilha pintada em ancestrais reais**: para cada caso, o ancestral mais externo recebe
  `data-<prefixo>-brand` e `data-<prefixo>-mode` da permutação e pinta a base opaca; cada camada de
  fundo seguinte é um elemento filho que pinta a sua cor; a amostra de frente fica no elemento mais
  interno. Assim o axe nunca chega ao fundo branco padrão da página, que ele compõe por último.
  Nenhum ancestral da amostra tem `opacity`, `filter`, `mix-blend-mode` ou `transform`.

```html
<section data-<prefixo>-brand="a" data-<prefixo>-mode="light" data-case="overlay.scrim.text|a|light|color.bg.surface">
  <div class="layer" data-token="color.bg.surface">       <!-- base opaca -->
    <div class="layer" data-token="color.bg.scrim">       <!-- camada translúcida -->
      <span class="sample-text" data-token="color.fg.inverse">Aa amostra</span>
    </div>
  </div>
</section>
```

- **Amostra de texto**: texto de tamanho normal (não "texto grande"), para que o axe aplique 4,5:1,
  o mesmo mínimo do checker. **Amostra não textual**: um bloco que pinta a cor de frente como fundo.
- **Asserções** (em todos os casos, inclusive isentos e de grupo):
  1. A cor computada (`getComputedStyle`: `background-color` das camadas e `color` ou
     `background-color` da amostra) é igual ao valor do mapa `./values` para aquele token e
     permutação: canais `r, g, b` exatamente iguais; alfa com tolerância de meio passo de 8 bits
     (1/510), porque motores podem quantizar o alfa.
  2. O axe `color-contrast` roda sobre as amostras de texto de pares sem `exempt` e não registra
     violação nem resultado incompleto. Amostras não textuais e isentas ficam fora do axe (o axe só
     mede texto, e o par isento pode estar abaixo do mínimo por desenho).
- **Desigualdade estrita do axe**: o axe aprova só quando `razão > esperado`, enquanto o WCAG e o
  checker aprovam com `≥`. Um caso exatamente no mínimo passa no checker e falha no axe. A
  divergência falha o teste em navegador real e é resolvida ajustando os tokens; a marca
  `near-threshold` do relatório aponta esses casos antes. O axe também trunca a razão exibida com
  `Math.floor(razão × 100) / 100`, a mesma convenção da tabela da seção 10.
- **Motores**: Chromium em todo PR; todos os motores da lista versionada à noite e antes de
  publicar (QA-12), na imagem do Playwright fixada por digest, sem rede externa (QA-01).
- **Licença**: `axe-core` e `@axe-core/playwright` são MPL-2.0, só de desenvolvimento e sem
  modificação; entram na política de licenças do ENG-21 conforme D6.

## 12. Testes e evidências

| Teste | Onde | Prova |
| --- | --- | --- |
| Unitário da composição, das duas variantes e do módulo WCAG (vetores da seção 8) | `tools/color`, Vitest | FR-020, QA-02 |
| Unitário do truncamento de razões e da ordenação do relatório | `tools/tokens-contrast`, Vitest | SC-002 |
| Fixtures de manifesto com marcas sintéticas A e B: par sabidamente reprovado; par translúcido composto sobre o fundo; pilha sem base opaca; conjunto vazio num modo; token ausente numa permutação; par isento abaixo do mínimo (reportado, não falha); grupo com um lado aprovado; grupo sem lado aprovado; limiares incoerentes (código 2); `emitted-mismatch` | `tools/tokens-contrast/fixtures/`, Vitest | US4 cenários 1 a 3, SC-009, V-14 a V-16 |
| `pnpm contrast:check` sobre o manifesto real em todo PR | CI | SC-008, A11Y-09 |
| Byte a byte do relatório entre Node piso e mais recente | CI noturno (`check:determinism`) | SC-002, ENG-08 |
| Amostras em navegador real com axe | `apps/tokens-example/tests`, Playwright | Princípio VII, QA-01 |

## 13. Requisitos sobre outros contratos

O checker e a regra de lint dependem destas informações do manifesto de tokens
(`dist/meta/tokens.manifest.json`), cujo formato normativo está em
[build-manifests.md](build-manifests.md):

- lista de permutações marca × modo, com ids de marca e de modo;
- por token: caminho, `cssName`, camada, categoria, `$type`, papel (`public` ou
  `brand-mode-source`), eixo, cadeia de alias e pertença à escala de alturas de controle;
- por token de cor e por permutação: o valor DTCG resolvido e a string emitida no CSS;
- por token composto de borda ou sombra: as referências dos subvalores de cor, em ordem de camada.

A string emitida registrada no manifesto de tokens é a mesma do CSS e do mapa `./values`, na forma
única de [css-output.md](css-output.md) (`#rrggbb` ou `rgb(r g b / a)` com três casas no alfa). Os
códigos `unknown-surface-set`, `duplicate-pair`, `invalid-group` e `emitted-mismatch`, o campo
`flags` dos casos e a dependência de `test:e2e` do relatório de contraste constam de
[tools-cli.md](tools-cli.md) (seções 3.1 e 7).

## 14. Rastreabilidade

| ID | Coberto por |
| --- | --- |
| FR-019 | Seções 3 a 6 (manifesto versionado, estados, classificação texto ou não texto) |
| FR-020 | Seções 7 e 8 (todas as permutações, composição antes da razão, isenção, grupo `any-of`) |
| FR-021 | Dados compartilhados com [lint-rules.md](lint-rules.md) (manifesto, conjuntos, vocabulário) |
| A11Y-09 | Seções 3 a 11; evidência: relatório retido |
| A11Y-01 | Premissa WCAG 2.2 AA aplicada pelos limiares (seção 7) |
| QA-14 | Mínimos lidos do arquivo de limiares |
| SC-008, SC-009 | Seções 8 e 12 |
| ACE-02 | `pnpm contrast:check` e o relatório ligados na matriz de rastreabilidade |
