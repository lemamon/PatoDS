# Contrato: CLIs das ferramentas e scripts da raiz

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) (D1 a D7) |
**Modelo**: [data-model.md](../data-model.md) | **Sincronização**: [design-sync.md](design-sync.md) |
**ADRs**: ADR-11, ADR-12, ADR-14, ADR-15 e ADR-16 em [docs/adr/](../../../docs/adr/) (todos Proposto) |
**Data**: 2026-10-21

Este contrato define cada comando das CLIs privadas `tokens-build`, `tokens-contrast`,
`repo-checks` e `design-sync`, a execução do lint de estilos e os scripts da raiz do monorepo:
propósito, argumentos, entradas, saídas, formato `--json`, códigos de saída, requisitos que cada
comando comprova e o job de CI que o executa. Formatos são esboços de interface; nenhuma
implementação é definida aqui. `<prefixo>` é o marcador da constituição (TODO(PREFIXO)).

## Premissas usadas

| Decisão em aberto | Premissa usada neste contrato |
| --- | --- |
| Plataforma de repositório e CI | GitHub e GitHub Actions (inferida do ENG-18), workflows `.github/workflows/tokens-ci.yml` e `design-sync.yml`, ações fixadas por SHA. |
| Versões mínimas (ENG-08) | Toolchain do repositório em Node 24.x (`.node-version`). Matriz noturna com o piso da premissa "Node em LTS" (Node 22) e o mais recente (Node 26 LTS a partir de 2026-10-28). TypeScript 6.0.x como valor provisório do `<versão>`; eixo 7.0.x só com `tsc`. |
| Lista de navegadores (ENG-08, QA-12) | Lista versionada ainda não definida. Chromium em todo PR; à noite e antes de publicar, todos os motores da lista. Enquanto ela não existe, os testes usam os três motores do Playwright fixado (Chromium, Firefox, WebKit) como premissa de trabalho, sem fixar a lista. |
| Ferramenta de design (DSN-01) | Nenhuma escolhida; só o adaptador `memory` existe. Jobs com adaptador real entram depois da decisão. |
| Limiares do CI (QA-14) | `quality/thresholds.json` com os valores da premissa; cobertura `<N>`% ainda indefinida; seção de contraste `{ "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }` (premissa do A11Y-01). |
| Marcas e marca padrão | Marcas sintéticas A e B (C no teste de marca nova), A como padrão de teste (QA-15). |
| TOK-12 | Não contratado até resposta do requerente: nenhum comando de tokens sem uso (FR-032 fora do plano). |

## 1. Convenções comuns

### 1.1 Invocação

Cada ferramenta é um pacote privado (`private: true`, nunca publicado) com `bin` apontando para a
saída compilada do pacote (tarefa `build` do turbo, TypeScript 6.0). Formas de execução:

- pelos scripts da raiz (seção 7), que chamam tarefas do turbo;
- diretamente: `pnpm --filter @<prefixo>/<pacote> exec <bin> <comando> [flags]`.

Argumentos depois de `--` num script da raiz são repassados ao comando (ex.:
`pnpm tokens:validate -- --json`).

### 1.2 Códigos de saída

| Código | Significado | Exemplos |
| --- | --- | --- |
| 0 | Sucesso, sem violação | Validação limpa; todos os pares aprovados; builds idênticos |
| 1 | Violações encontradas | Regra de validação, lint, par de contraste reprovado, divergência, saídas diferentes, arquivo gerado versionado |
| 2 | Erro de uso ou de configuração | Flag desconhecida, argumento ausente, arquivo de entrada inexistente, configuração inválida, checksum de schema divergente |
| 3 | Erro interno | Exceção não prevista, subprocesso que falhou por motivo alheio à regra |
| 4 | Só `design-sync`: falha de acesso à ferramenta | Credencial ausente, inválida, vencida ou sem escopo; 401 ou 403; rede; 5xx; limite de taxa esgotado |
| 5 | Só `design-sync`: verify divergente após apply | Snapshot lido depois de aplicar difere do manifesto |

Quando mais de uma condição ocorre, vale a mais grave, na ordem 3, 2, 4, 5, 1. Erros de classe 2,
3 e 4 interrompem a execução; violações (1) são todas coletadas antes de sair. `--json` não altera
o código.

Os scripts da raiz passam pelo turbo, que devolve zero quando todas as tarefas passam e diferente
de zero quando alguma falha, sem garantir o código específico. Jobs que precisam distinguir códigos
(por exemplo, os de `design-sync`) chamam o `bin` diretamente ou leem `exitCode` da saída `--json`.

### 1.3 Saída humana e `--json`

- Sem `--json`: saída legível em stdout, uma linha por achado no formato
  `arquivo:linha:coluna  erro|aviso  código  mensagem`, seguida de uma linha de resumo. Progresso e
  diagnóstico vão para stderr.
- Com `--json`: stdout contém exatamente um documento JSON canônico (seção 1.4) e nada mais;
  progresso continua em stderr.

Envelope comum a todos os comandos:

```json
{
  "format": "<prefixo>.cli-result",
  "version": 1,
  "tool": "tokens-build",
  "command": "validate",
  "ok": false,
  "exitCode": 1,
  "summary": {},
  "findings": [],
  "errors": []
}
```

`ok` é `exitCode === 0`. Cada comando acrescenta chaves próprias, descritas nas seções seguintes.

### 1.4 JSON canônico

Usado em toda saída `--json` e em todo arquivo JSON gerado pelas ferramentas (relatórios,
manifestos, plano e log da sincronização):

- UTF-8 sem BOM, fim de linha LF, newline final, indentação de 2 espaços;
- chaves de objeto ordenadas por code point; arrays na ordem definida por cada contrato, nunca pela
  ordem de inserção;
- números na forma mais curta de ida e volta do ECMAScript (`JSON.stringify`), sem `NaN`,
  `Infinity` nem `-0`;
- sem data, hora, caminho absoluto, nome de máquina, usuário ou valor de ambiente; caminhos são
  relativos à raiz do repositório, com `/`.

A única exceção é o envelope de execução do `design-sync` (`sync-envelope.json`), que carrega data
e URL da execução e fica fora do conteúdo canônico.

### 1.5 Achados e erros

```json
{
  "code": "TKN-ALIAS-UNRESOLVED",
  "rule": "V-03",
  "severity": "error",
  "message": "color.bg.surface: Alias para token inexistente {brand.color.bg.surface.dark} na marca \"b\". [V-03; FR-004]",
  "file": "packages/tokens/src/semantic/mode/dark.tokens.json",
  "line": 14,
  "column": 9,
  "token": "color.bg.surface",
  "context": { "brand": "b", "mode": "dark" },
  "data": { "permutations": [{ "brand": "b", "mode": "dark" }], "requirements": ["FR-004", "TOK-02"], "rules": ["V-03"] }
}
```

O exemplo é um achado de `tokens-build validate`; o formato de `data` de cada comando está no seu
contrato (para `tokens-build`, [token-source.md](token-source.md), seção 10.4).

- Obrigatórios: `code`, `severity` (`error` ou `warning`), `message`. Opcionais: `rule`, `file`,
  `line` e `column` (base 1; presentes sempre que o achado tem posição em arquivo), `token`,
  `context` (permutação em que ocorre), `data` (detalhe da regra, ex.: cadeia de alias).
- Ordem: `file`, `line`, `column`, `code`, `token`, em code point.
- `errors[]` (códigos 2 a 5): `{ "code", "message", "file"?, "line"?, "column"? }`, com `code` em
  `USAGE`, `CONFIG`, `INTERNAL` ou um código de domínio documentado no comando.
- `warning` nunca muda o código de saída, salvo onde o comando disser o contrário.

### 1.6 Flags comuns

| Flag | Efeito |
| --- | --- |
| `--json` | Saída de máquina (seção 1.3). |
| `--help` | Uso do comando; código 0. |
| `--version` | Versão do pacote da ferramenta; código 0. |
| `--root <dir>` | Raiz do repositório; padrão: o diretório mais próximo com `pnpm-workspace.yaml`. Caminhos de outras flags são relativos a ela. |

Flag desconhecida, comando desconhecido ou argumento obrigatório ausente: código 2 com
`errors[0].code = "USAGE"`.

### 1.7 Determinismo e ambiente

- `tokens-build`, `tokens-contrast` e `repo-checks` não acessam a rede. `tokens-build` passa ao
  parser um `req` que rejeita `$ref` que não seja `file:` (D1).
- Para as mesmas entradas, arquivos gerados e saída `--json` são idênticos byte a byte,
  independentemente de `TZ`, `LC_ALL`, diretório corrente e caminho absoluto do checkout. Ordenação
  sempre por code point, nunca por localidade.
- Variáveis de ambiente lidas são só as declaradas nas tarefas do turbo (`envMode: strict`).
  `design-sync` lê também credenciais e variáveis de URL da execução do CI, que só vão para o
  envelope.

### 1.8 Schemas de saída

Cada pacote de ferramenta versiona, em `schemas/`, o JSON Schema (2020-12) da saída `--json` de
cada comando e dos arquivos JSON que gera. Testes unitários (QA-02) validam as saídas das fixtures
contra esses schemas. Mudança incompatível incrementa `version` no documento. Jobs de CI só dependem
dos campos descritos neste contrato.

## 2. `tokens-build` (`@<prefixo>/tokens-build`, `tools/tokens-build`)

Validação e geração a partir da fonte única, sobre `@terrazzo/parser` usado como biblioteca, com as
regras do PatoDS num adaptador próprio que roda sobre todas as permutações marca × modo (D1, D7).

### 2.1 `tokens-build validate`

**Uso**: `tokens-build validate [--resolver <arquivo>] [--schemas <dir>] [--json]`

**Propósito**: validar a fonte de tokens em todas as permutações, sem gerar arquivos.

| Flag | Padrão |
| --- | --- |
| `--resolver` | `packages/tokens/src/tokens.resolver.json` |
| `--schemas` | `packages/tokens/schemas/dtcg-2025.10` (`format.json`, `resolver.json`, `SHA256SUMS`) |

**Entradas**: o resolver; todos os `*.tokens.json` referenciados por seus sets
(`src/primitive/`, `src/semantic/invariant.tokens.json`, `src/semantic/brand/<id>.tokens.json`,
`src/semantic/mode/light.tokens.json` e `dark.tokens.json`, `src/component/`); cópias versionadas
dos schemas DTCG 2025.10 e seus sha256. A gramática de nomes e os vocabulários vêm de tabelas do
próprio `@<prefixo>/tokens-build`, conforme [token-source.md](token-source.md), seção 8; o documento
da convenção (`docs/tokens/convencao-de-nomes.md`) é derivado dessas tabelas e não é entrada do
validador (token-source.md, seção 11).

**Saídas**: nenhum arquivo.

**Regras e códigos**: os códigos de achado (`code`), a saída humana, o JSON e os códigos de saída
são os de [token-source.md](token-source.md), seções 10.2 a 10.5. O campo `rule` traz o id da
regra do data-model. Correspondência:

| `rule` (data-model) | `code` (token-source.md, seção 10.5) | Verifica | FR |
| --- | --- | --- | --- |
| V-01 | `TKN-JSON-PARSE`, `TKN-SCHEMA`, `TKN-RESOLVER-REF`, `TKN-ALIAS-TYPE` | Schema DTCG 2025.10 de cada arquivo e do resolver; JSON malformado com linha e coluna | FR-002 |
| V-02 | `TKN-LITERAL-OUTSIDE-PRIMITIVE` | Literal (inclusive subvalor de composto) fora da camada primitiva | FR-003 |
| V-03 | `TKN-ALIAS-UNRESOLVED`, `TKN-ALIAS-CYCLE`, `TKN-ALIAS-TYPE` | Alias inexistente ou ciclo em qualquer permutação; `data.chain` traz a cadeia | FR-004 |
| V-04 | `TKN-LAYER-DIRECTION` | Referência para camada acima | FR-004 |
| V-05 | `TKN-REF-OUTSIDE-PRIMITIVE`, `TKN-REF-NOT-LOCAL`, `TKN-ROOT-FORBIDDEN`, `TKN-EXTENDS-FORM` | `$ref` fora do primitivo ou não local; `$root`; `$extends` fora da forma com chaves | FR-003, FR-004 |
| V-06 | `TKN-NAME-SEGMENT`, `TKN-NAME-CATEGORY`, `TKN-NAME-GRAMMAR`, `TKN-NAME-RESERVED`, `TKN-NAME-COLLISION`, `TKN-TYPE-MISSING`, `TKN-TYPE-CATEGORY` | Gramática por categoria e segmentos em ordem fixa; colisão de nome CSS; `$type` ausente ou incompatível com a categoria | FR-005 |
| V-07 | `TKN-RESOLVER-STRUCTURE`, `TKN-FILE-LOCATION`, `TKN-PATH-DUPLICATE`, `TKN-AXIS-DEPENDENCY` | Eixo coerente com o set que define o token | FR-011 |
| V-08 | `TKN-AXIS-BOTH`, `TKN-BRAND-SOURCE-FORM`, `TKN-BRAND-SOURCE-REF` | Variação nos dois eixos fora da forma do FR-033; token sob `brand.` sem id de modo no fim ou sem as mesmas chaves em toda marca | FR-033 |
| V-09 | `TKN-PATH-DUPLICATE` | Set compartilhado com valor de eixo marca ou modo | FR-011 |
| V-10 | `TKN-COLOR-HEX-MISMATCH` | `hex` divergente da quantização de 8 bits dos componentes (cor dentro do gamut sRGB) | FR-015, FR-020 |
| V-11 | `TKN-CATEGORY-COVERAGE` | Categoria sem token semântico | FR-006 |
| V-12 | `TKN-CONTROL-SCALE` | Altura de controle fora da escala `size.control.<passo>`; passos diferentes entre permutações | FR-007 |
| V-13 | `TKN-PARITY-CONTEXT`, `TKN-PARITY-PERMUTATION` | Chave semântica ausente ou excedente, por permutação e por contexto | FR-011 |
| — | `TKN-FILE-UNREFERENCED` | `*.tokens.json` em `src/` que nenhum set referencia | FR-001 |

Erros de configuração (código 2, em `errors[]`): fonte ou resolver inexistente
(`TKN-CONFIG-INPUT`); sha256 dos schemas diferente de `SHA256SUMS` (`TKN-CONFIG-SCHEMA-HASH`); lista
de permutações indefinida por limite do parser ou diferente de marcas × modos
(`TKN-CONFIG-PERMUTATIONS`). Flag ou argumento inválidos usam `USAGE` (seção 1.6); erro interno,
`TKN-INTERNAL` (código 3).

**`--json`** (além do envelope): `summary` conforme token-source.md, seção 10.4:

```json
{
  "summary": {
    "byCategory": { "border": 9, "breakpoint": 5, "color": 180, "motion": 12, "opacity": 6, "radius": 8, "shadow": 7, "size": 30, "space": 22, "typography": 120, "z-index": 13 },
    "controlHeightScale": { "a/dark": [ { "step": "sm", "value": "32px" }, { "step": "md", "value": "40px" } ] },
    "errors": 0,
    "files": 11,
    "permutations": ["a/dark", "a/light", "b/dark", "b/light"],
    "tokens": { "component": 96, "primitive": 210, "semantic": 106 }
  }
}
```

**Códigos**: 0, 1, 2, 3.

**Comprova**: FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-011, FR-033; FR-001 do lado da
fonte (complementa `scan-tokens`); FR-009 (marca nova sem chave é barrada, US3 cenário 2); SC-001,
SC-003, SC-004; SC-009 (literal fora do primitivo, nome fora do padrão, chave ausente); US1
cenários 1 e 2.

**Jobs**: PR (job `validate`, obrigatório), noturno, release.

### 2.2 `tokens-build build`

**Uso**: `tokens-build build [--resolver <arquivo>] [--schemas <dir>] [--out <dir>] [--api-report <arquivo>] [--json]`

**Propósito**: executar a validação completa da seção 2.1 (nada é emitido se houver violação),
gerar todos os artefatos e conferir a saída gerada.

| Flag | Padrão |
| --- | --- |
| `--out` | `packages/tokens/dist` (no `.gitignore`) |
| `--api-report` | `packages/tokens/api/tokens.api.json` (versionado) |

`--out` dentro de `packages/tokens/src/` é recusado (código 2).

**Saídas**:

| Arquivo | Conteúdo | FR |
| --- | --- | --- |
| `dist/css/base.css` | Ordem das camadas, primitivos compartilhados, toggles de modo privados, resolvedor, tudo em `@layer <prefixo>.tokens` | FR-015, FR-017 |
| `dist/css/brand-<id>.css` | Um por marca: só seletores `[data-<prefixo>-brand="<id>"]`; só a marca padrão acrescenta `:where(:root)` | FR-013, FR-017 |
| `dist/esm/index.js` + `index.d.ts` | Referências `var(--<prefixo>-*)` dos tokens públicos, com tipos literais | FR-016 |
| `dist/esm/values.js` + `values.d.ts` | Mapas de valores por marca × modo | FR-016 |
| `dist/meta/tokens.manifest.json` | Token → nome CSS, camada, categoria, eixo, papel, cadeia de alias, escala; insumo do lint e do contraste | FR-020, FR-022, FR-023 |
| `dist/meta/sync-manifest.json` | Estado desejado da ferramenta de design ([design-sync.md](design-sync.md), seção 3) | FR-025, FR-028 |
| `dist/meta/report.json` + `report.md` | Contagem por categoria e camada; escala de alturas por permutação | FR-008 |
| `api/tokens.api.json` | Superfície pública (nomes, tipos, entradas); conferida por `repo-checks drift` | FR-016 |

Formato e mecanismo do CSS: [css-output.md](css-output.md). Esboço de `report.json`:

```json
{
  "format": "<prefixo>.tokens-report",
  "version": 1,
  "package": { "name": "@<prefixo>/tokens", "version": "1.4.0" },
  "categories": {
    "color": { "component": 30, "primitive": 120, "semantic": 48 },
    "space": { "component": 4, "primitive": 14, "semantic": 6 }
  },
  "controlHeightScale": [
    { "brand": "a", "mode": "dark", "steps": [ { "token": "size.control.md", "value": "40px" }, { "token": "size.control.sm", "value": "32px" } ] }
  ],
  "permutations": [ { "brand": "a", "mode": "dark" }, { "brand": "a", "mode": "light" } ]
}
```

**Escrita atômica**: os arquivos são gerados num diretório temporário ao lado de `--out`, passam
pelas checagens abaixo e só então substituem `--out` e o relatório de API. Com violação, os arquivos
existentes ficam intactos.

**Checagens da saída gerada** (definição detalhada das checagens de CSS em
[css-output.md](css-output.md), seção 13, e da serialização na seção 11):

| `code` | Verifica | FR |
| --- | --- | --- |
| `css-brand-selector` | Arquivo de marca só com seletores dessa marca; `:where(:root)` só no arquivo da marca padrão | FR-013, FR-017 |
| `css-base-brand-value` | `base.css` sem valor exclusivo de alguma marca | FR-017 |
| `css-toggle-form` | Token de eixo modo na forma `var(--<prefixo>-_on-light, L)var(--<prefixo>-_on-dark, D)`, sem espaço entre os toggles; toggles com o literal `initial` ou vazio, nunca `var()` | FR-012, FR-014 |
| `css-var-undeclared` | Todo alvo de `var()` declarado em `base.css` ou no arquivo da marca | FR-013, FR-014 |
| `css-public-outside-resolver` | Token público declarado só no resolvedor ou no escopo de marca | FR-012 |
| `css-layer` | Toda regra em `@layer <prefixo>.tokens`, com a declaração de ordem das camadas | FR-015 |
| `css-combinations` | CSS válido e completo para toda combinação marca × modo | FR-010 |
| `css-syntax` | CSS válido, só cabeçalho, declaração de ordem das camadas e um bloco `@layer` com regras simples; sem `!important` nem at-rules proibidas | FR-015 |
| `css-var-fallback` | Nenhum `var()` com fallback, exceto os toggles | FR-013, FR-014 |
| `css-scope-dependency` | Declarações da regra de marca sem dependência de token de eixo modo ou de componente; fonte marca-modo só na forma de toggles | FR-012, FR-033 |
| `css-value-format` | Cores, números e compostos na forma única de serialização | FR-015, FR-020 |
| `css-format` | Cabeçalho, ordenação, indentação, LF e quebra de linha final | FR-015 |
| `unserializable-value` | Token publicado sem representação num único valor CSS (`typography` composto, `strokeStyle` em objeto; css-output.md, S-04) | FR-015, FR-016 |
| `private-segment-leak` | Segmento privado `_` ausente do ESM, do `.d.ts` e do relatório de API | FR-016 |
| `dist-parity` | CSS, chaves do ESM, união `TokenName`, manifesto e relatório de API listam o mesmo conjunto de tokens | FR-016, FR-017 |

**`--json`** (além do envelope): `summary` igual ao da seção 2.1 e

```json
{
  "files": [
    { "path": "packages/tokens/dist/css/base.css", "bytes": 18234, "sha256": "…" },
    { "path": "packages/tokens/dist/css/brand-a.css", "bytes": 5120, "sha256": "…" }
  ]
}
```

com `files` ordenado por `path`.

**Códigos**: 0; 1 (violação da fonte ou da saída gerada); 2; 3.

**Comprova**: FR-008, FR-010, FR-013 e FR-017 (parte estática), FR-015, FR-016 (arquivos das duas
entradas), SC-003 (relatório); US1 cenário 4; SC-002 e US2 cenário 5 junto com
`repo-checks determinism`.

**Jobs**: PR (job `build`; `dist/` e relatório sobem como artefatos para os jobs seguintes),
noturno (Node 24, 22 e 26), release.

## 3. `tokens-contrast` (`@<prefixo>/tokens-contrast`, `tools/tokens-contrast`)

### 3.1 `tokens-contrast check`

**Uso**: `tokens-contrast check [--manifest <arquivo>] [--surfaces <arquivo>] [--tokens <arquivo>] [--thresholds <arquivo>] [--out <dir>] [--json]`

**Propósito**: medir cada par do manifesto de contraste em toda permutação marca × modo (D5):
resolve frente e pilha de fundo; converte com `toEmittedSrgb()` de `@<prefixo>/color` (o mesmo
valor que o CSS emite); compõe source-over em sRGB codificado em gama sobre pilha com base opaca ou
sobre cada superfície de um conjunto nomeado; calcula a razão WCAG 2.2 em ponto flutuante e numa
variante que arredonda para 8 bits a cada dobra; vale o menor; aprova com razão maior ou igual ao
mínimo.

| Flag | Padrão |
| --- | --- |
| `--manifest` | `packages/tokens/contrast/manifest.json` |
| `--surfaces` | `packages/tokens/contrast/surfaces.json` |
| `--tokens` | `packages/tokens/dist/meta/tokens.manifest.json`, com os valores emitidos por permutação expostos pelo build em `./meta/*`; ausente: código 2 com orientação para rodar `pnpm tokens:build` |
| `--thresholds` | `quality/thresholds.json`, seção `contrast` |
| `--out` | nenhum; quando informado, grava `contrast-report.json` e `contrast-report.md` |

**Regras de medição** (premissa WCAG 2.2 AA, A11Y-01): texto 4,5:1 e não texto, inclusive foco,
3:1. Par com `exempt: "wcag-inactive"` (só em estado `disabled` ou `inactive`) é medido e
reportado, mas não falha. Grupo `any-of` (foco que atravessa a borda do componente) passa se algum
membro atinge o mínimo; todos os membros são reportados.

**Achados**:

| `code` | Regra do data-model | Situação |
| --- | --- | --- |
| `pair-below-minimum` | V-15 | Par sem isenção, fora de grupo, abaixo do mínimo em alguma permutação |
| `group-below-minimum` | V-15 | Nenhum membro do grupo atinge o mínimo |
| `unknown-token` | V-14 | Referência ausente em alguma permutação |
| `forbidden-reference` | Par de contraste | `fg` ou `bg` primitivo, `brand-mode-source` ou literal |
| `stack-not-opaque` | V-16 | Pilha sem base opaca |
| `empty-surface-set` | V-16 | Conjunto de superfícies vazio no modo |
| `exempt-invalid-state` | Par de contraste | `exempt` com estado diferente de `disabled` ou `inactive` |
| `unknown-state` | Par de contraste | Estado fora do vocabulário versionado |
| `manifest-schema`, `duplicate-id`, `unsorted-manifest` | FR-019 | Manifesto inválido, id repetido ou fora de ordem |
| `unknown-surface-set` | Par de contraste | `@conjunto` inexistente em `surfaces.json` ou fora da base da pilha |
| `duplicate-pair` | Par de contraste | Tupla canônica (`fg`, `bg`, `state`, `kind`) repetida |
| `invalid-group` | Par de contraste | Grupo `any-of` com menos de dois membros, estado ou tipo inválido, `fg` diferente ou membro com `exempt` |
| `emitted-mismatch` | Valor medido = emitido | String de `toEmittedSrgb()` diferente da emitida pelo build no manifesto de tokens |

Regras detalhadas desses códigos (CM-01 a CM-08, V-14 a V-16): [contrast-manifest.md](contrast-manifest.md), seção 6.

Erros de configuração (código 2): arquivo ausente (`CONFIG`); valores de `quality/thresholds.json`
que não batem com o nível declarado, ou nível desconhecido (`THRESHOLDS_MISMATCH`).

**`--json`** (além do envelope):

```json
{
  "level": "WCAG22-AA",
  "minimums": { "nonText": 3, "text": 4.5 },
  "summary": { "cases": 96, "exempt": 8, "failed": 0, "groups": { "failed": 0, "passed": 4 }, "pairs": 24, "passed": 88 },
  "cases": [
    {
      "pair": "text-default-on-surface",
      "brand": "a",
      "mode": "dark",
      "surface": null,
      "state": "default",
      "kind": "text",
      "fg": "color.fg.default",
      "bg": ["color.bg.surface"],
      "ratio": 12.6312,
      "ratioFloat": 12.6389,
      "ratio8bit": 12.6312,
      "minimum": 4.5,
      "result": "pass",
      "group": null,
      "flags": []
    }
  ],
  "groups": [ { "id": "focus-ring-button", "result": "pass", "members": ["focus-ring-button-inner", "focus-ring-button-outer"] } ]
}
```

`cases` ordenado por `pair`, `brand`, `mode`, `surface`. Razões truncadas (não arredondadas) em 4
casas no JSON e em 2 no Markdown; aprovação calculada sobre o valor não truncado. `result` de caso:
`pass`, `fail` ou `exempt`. `flags` de caso: lista, hoje só com `near-threshold` (sinal informativo,
não falha; contrast-manifest.md, seção 8, passo 11).

**Códigos**: 0 (todos aprovados; isentos não contam); 1 (par ou grupo reprovado, ou violação do
manifesto); 2; 3.

**Comprova**: FR-019, FR-020; SC-008; SC-009 (par reprovado); US4 cenários 1, 2 e 3; A11Y-09
(medição). A checagem de par usado em estilo e ausente do manifesto (FR-021) é a regra
`<prefixo>/contrast-pairs` (seção 6).

**Jobs**: PR (job `contrast`, obrigatório; relatório como artefato e evidência do ACE-02), noturno
(o relatório entra na comparação entre Node piso e mais recente), release.

## 4. `repo-checks` (`@<prefixo>/repo-checks`, `tools/repo-checks`)

Scripts próprios sem dependência do workspace (só `node:crypto`, `git`, `pnpm` e postcss), cada
um com fixtures de violação proposital (QA-02).

### 4.1 `repo-checks determinism`

**Uso**:

- `repo-checks determinism [--ref <git-ref>] [--package <nome>] [--keep] [--json]`
- `repo-checks determinism --hashes-out <arquivo> [--label <texto>] [--extra <caminho>]… [--json]`
- `repo-checks determinism --compare <arquivoA> <arquivoB> [--json]`

**Propósito**: provar que dois builds da mesma fonte produzem saída idêntica byte a byte.

- **Modo padrão (build duplo)**: cria dois `git worktree` limpos de `--ref` (padrão `HEAD`) em
  caminhos absolutos diferentes (o segundo com espaço e caractere não ASCII). Execução A com
  `TZ=UTC` e `LC_ALL=C`; execução B com `TZ=Pacific/Kiritimati` e `LC_ALL=tr_TR.UTF-8`. Em cada uma:
  `pnpm install --frozen-lockfile --offline`, `turbo run tokens:build --force` (sem cache local nem
  remoto) e `pnpm pack` do pacote `--package` (padrão `@<prefixo>/tokens`). Compara a lista ordenada
  de arquivos e o sha256 de cada arquivo de `packages/tokens/dist/**` e
  `packages/tokens/api/tokens.api.json`, e o sha256 dos tarballs. `--keep` preserva os worktrees.
- **`--hashes-out`**: um build sem cache no checkout atual, que grava o manifesto de hashes
  (inclui os caminhos de `--extra`, como o relatório de contraste).
- **`--compare`**: compara dois manifestos de hashes produzidos em runners ou versões de Node
  diferentes. `label` identifica a origem e não entra na comparação.

```json
{
  "format": "<prefixo>.hash-manifest",
  "version": 1,
  "label": "node-22",
  "package": "@<prefixo>/tokens",
  "files": [ { "path": "packages/tokens/dist/css/base.css", "sha256": "…" } ],
  "tarball": { "sha256": "…" }
}
```

**`--json`** (além do envelope):

```json
{
  "runs": [ { "files": 14, "label": "a", "tarballSha256": "…" }, { "files": 14, "label": "b", "tarballSha256": "…" } ],
  "mismatches": [ { "path": "packages/tokens/dist/css/brand-a.css", "sha256A": "…", "sha256B": "…", "firstDiff": { "line": 41, "column": 3 } } ],
  "onlyInA": [],
  "onlyInB": []
}
```

A saída humana mostra o primeiro arquivo divergente e um trecho do diff.

**Códigos**: 0 (idênticos); 1 (divergência); 2 (não é repositório git, ref inexistente, store do
pnpm indisponível em modo offline, manifesto de hashes inválido); 3 (falha de um dos builds; o
código do subprocesso vai em `errors[0]`).

**Comprova**: FR-015 (byte a byte), SC-002, US2 cenário 5; salvaguarda do D1 entre Node piso e mais
recente.

**Jobs**: PR (job `determinism`, quando afetados `packages/tokens`, `tools/tokens-build`,
`tools/color`, lockfile ou toolchain, ENG-02); noturno (entre runners e entre Node 22 e Node 26,
com `--hashes-out` em cada job da matriz e `--compare` no job final); release.

### 4.2 `repo-checks drift`

**Uso**: `repo-checks drift [--no-regenerate] [--json]`

**Propósito**:

1. falhar se `git ls-files` listar caminho gerado (lista versionada de padrões no próprio pacote,
   que inclui `packages/tokens/dist/**`) ou arquivo versionado com o cabeçalho do gerador (cobre o
   edge case "arquivo de CSS de tokens editado à mão");
2. salvo `--no-regenerate`, regenerar os artefatos versionados de propósito
   (`packages/tokens/api/tokens.api.json`) com `tokens-build build` e exigir `git diff --exit-code`
   e `git status --porcelain` vazio.

**Achados**: `generated-file-tracked`, `generated-header-tracked`, `versioned-artifact-stale`,
`worktree-dirty`.

**`--json`** (além do envelope): `tracked` (`[{ "path", "reason" }]`), `regenerated`
(`[{ "path", "changed" }]`), `status` (linhas do `--porcelain`, ordenadas).

**Códigos**: 0, 1, 2, 3 (falha do build de regeneração).

**Comprova**: FR-015 (nenhum CSS de tokens versionado ou editado à mão); FR-016 (relatório de API
em dia, insumo do QA-08 e do GOV-01).

**Jobs**: PR (obrigatório), noturno, release.

### 4.3 `repo-checks scan-tokens`

**Uso**: `repo-checks scan-tokens [--allowlist <arquivo>] [--self-test] [--json]`

**Propósito**: varredura do FR-001 sobre os arquivos de `git ls-files`.

| `code` | Sinaliza |
| --- | --- |
| `custom-property-literal` | Declaração de custom property com valor literal, com qualquer nome (prefixado ou não), em CSS, bloco `<style>` de SFC `.vue`, HTML e atributo `style=` |
| `token-name-in-code` | Definição de `--<prefixo>-*` em TS, JS ou JSON: chave de objeto ou `setProperty('--<prefixo>-…', …)`. Leitura por `var(--<prefixo>-…)` é permitida |
| `dtcg-outside-source` | Documento JSON com `$value` ou `$type` DTCG fora de `packages/tokens/src/` |
| `allowlist-stale` | Entrada da allowlist que não casou com nada |

Allowlist versionada `quality/scan-allowlist.json`; entrada sem justificativa é erro de
configuração (código 2):

```json
{
  "version": 1,
  "entries": [
    { "path": "packages/tokens/src/**", "rules": ["dtcg-outside-source"], "justification": "Fonte única de tokens (FR-001)." },
    { "path": "tools/repo-checks/fixtures/**", "rules": ["custom-property-literal", "dtcg-outside-source", "token-name-in-code"], "justification": "Fixtures de autoteste da varredura." }
  ]
}
```

`--self-test` roda a varredura sobre as fixtures do pacote (CSS, SFC Vue, TSX, JSON e HTML, com
nomes prefixados e não prefixados) e exige o multiconjunto esperado de `{file, line, column, code}`,
sem achado a mais.

**`--json`** (além do envelope): `summary: { "filesScanned", "byRule" }`; cada achado traz `data.match`
com trecho de até 120 caracteres.

**Códigos**: 0, 1, 2, 3.

**Comprova**: FR-001; SC-001 (zero tokens fora da fonte); US1 cenário 3; SC-009 (parte).

**Jobs**: PR (obrigatório, com `--self-test` no mesmo job), noturno.

### 4.4 `repo-checks layers`

**Uso**: `repo-checks layers [--self-test] [--json]`

**Propósito**: check de manifesto do ENG-01 (parte c do D2), complementar a `turbo boundaries` e às
regras de import do ESLint.

**Entradas**: `turbo.json` da raiz (`boundaries.tags`, arquivo versionado de camadas e arestas),
tags do `turbo.json` de cada pacote, `package.json` de cada pacote, `pnpm ls -r --json` e
`pnpm ls -r --prod --json`, código-fonte dos pacotes de ferramenta, registro versionado de exceções
de fronteira (vazio nesta feature).

Arestas desta feature:

| Pacote | Tag | Pode depender de |
| --- | --- | --- |
| `packages/tokens` | `tokens` | dev: `tools/tokens-build`, `tools/color` |
| `tools/tokens-build` | `tools` | `tools/color` |
| `tools/color` | `tools` | nenhum pacote do workspace |
| `tools/tokens-contrast` | `tools` | dev: `tokens` (só `./meta/*`), `tools/color` |
| `tools/stylelint-plugin` | `tools` | dev: `tokens` (só `./meta/*`) |
| `tools/design-sync` | `tools` | dev: `tokens` (só `./meta/*`) |
| `tools/repo-checks` | `tools` | nenhum |
| `apps/tokens-example`, `tests/types-consumer` | `apps` | `tokens` só pelo tarball empacotado |

| `code` | Sinaliza |
| --- | --- |
| `missing-layer-tag`, `multiple-layer-tags` | Pacote sem exatamente uma tag de camada |
| `forbidden-edge` | Dependência fora das arestas permitidas, por tipo (`dependencies` ou `devDependencies`) |
| `dev-only-edge-in-prod` | Pacote `tools` com pacote de UI no fechamento `--prod` |
| `leaf-has-workspace-dep` | `tools/color` com dependência do workspace |
| `app-source-dependency` | App ou teste dependendo de `workspace:` ou `link:` em vez do tarball (QA-06) |
| `subpath-not-allowed` | Ferramenta importando `@<prefixo>/tokens` fora de `./meta/*` |
| `token-source-reference` | Ferramenta referenciando `packages/tokens/src` (garante a G-1 de [design-sync.md](design-sync.md)) |
| `boundaries-ignore-unregistered` | `@boundaries-ignore` ou desativação de regra de import fora do registro de exceções |

`--self-test` roda workspaces de fixture, cada um com uma aresta proibida proposital em `.ts`, e
exige o código esperado em cada um (evidência do ACE-08 para as camadas novas). As fixtures em
`.vue` e as regras de import do ESLint chegam com a feature de CI, antes do primeiro `.vue`
(ADR-12, decisão 3).

**Códigos**: 0, 1, 2, 3.

**Comprova**: ENG-01 nas camadas desta feature (Princípio XI); FR-018 (app consome só o tarball,
parte); FR-025 e US6 cenário 6 (parte: `design-sync` não alcança a fonte).

**Jobs**: PR (obrigatório), noturno.

## 5. `design-sync` (`@<prefixo>/design-sync`, `tools/design-sync`)

Formatos, portas, plano, log e itens: [design-sync.md](design-sync.md). Nenhum comando importa
variáveis da ferramenta para o repositório (FR-025).

### 5.1 Flags comuns

| Flag | Padrão | Uso |
| --- | --- | --- |
| `--adapter memory\|<ferramenta>` | `tool.adapter` da configuração | `memory` usa o `InMemoryDesignTool`. O adaptador real só existe depois da decisão do requerente. |
| `--config <arquivo>` | `tools/design-sync/design-sync.config.json` | Configuração versionada. |
| `--manifest <arquivo>` | `packages/tokens/dist/meta/sync-manifest.json` | Estado desejado atual. |
| `--previous <arquivo>` | nenhum | Manifesto da última versão verificada (classificação de drift). |
| `--out <dir>` | nenhum (só stdout) | Destino de plano, log e relatório; recusado dentro de `packages/tokens/` (código 2). |
| `--memory-state <arquivo>`, `--memory-out <arquivo>` | nenhum | Só com `--adapter memory`: estado inicial e final do fake. |
| `--tracker memory\|github`, `--alert memory\|github` | `memory` | `github` só nos jobs com token de instalação da GitHub App. |
| `--trigger release\|schedule\|manual\|pr` | `manual` | Vai só para o envelope. |
| `--run-url <url>` | derivado das variáveis do CI, quando presentes | Vai só para o envelope. |
| `--json` | | Saída de máquina. |

Credenciais chegam só por variáveis de ambiente registradas no inventário do ENG-13, nunca por
flag. Credencial ausente com adaptador real: código 4 (`CREDENTIAL_MISSING`). Toda saída 2 a 5
chama `AlertPort.raise`.

### 5.2 `design-sync plan`

**Uso**: `design-sync plan [flags comuns] [--fail-on-changes]`

**Propósito**: ler manifestos e snapshot e calcular o plano; não escreve na ferramenta nem no
tracker.

**Saídas** (com `--out`): `sync-plan.json` (`SyncPlan`) e `sync-plan.md`.

**`--json`** (além do envelope): `plan` com o `SyncPlan` completo.

**Códigos**: 0 (com ou sem mudanças); 1 (com `--fail-on-changes` e plano não vazio); 2 (configuração
ou pré-condição: manifesto inválido, `aliases` ausente, `maxModesPerAxis` insuficiente, `read`
manual, remoção em massa); 3; 4.

**Comprova**: FR-028 (casamento por chave e por segmentos); base de FR-027 e FR-029.

**Jobs**: PR (job `design-sync-fake`, `--adapter memory` sobre fixtures); `workflow_dispatch`.

### 5.3 `design-sync apply`

**Uso**: `design-sync apply [flags comuns] [--version <x.y.z>] [--dry-run] [--allow-mass-delete] [--no-publish]`

**Propósito**: planejar sobre snapshot novo, aplicar (`DesignToolPort.apply`), verificar com novo
snapshot, pedir publicação (salvo `--no-publish`), gravar o log, abrir itens de resultado de
capacidade e resolver alertas abertos após resultado `verified`. `--version` precisa igualar
`source.version` do manifesto (senão código 2). `--dry-run` chama `apply` com `dryRun: true` e não
altera a ferramenta.

**Saídas** (com `--out`): `sync-plan.json`, `sync-plan.md`, `sync-log.json`, `sync-log.md`,
`sync-envelope.json`.

**`--json`** (além do envelope): `log` com o conteúdo de `sync-log.json` e `envelope` com o conteúdo
de `sync-envelope.json` (não determinístico; comparações o ignoram).

**Códigos**: 0 (`verified` ou `dry-run`); 1 (`write: manual`: nada escrito, item `manual-write`
aberto); 2 (configuração ou pré-condição); 3; 4 (acesso, credencial, rede, 5xx ou limite de taxa
esgotado, inclusive no meio da aplicação, com resultado `failed`); 5 (verify divergente).

**Comprova**: FR-025, FR-026, FR-027, FR-028, FR-029; SC-010; US6 cenários 1, 2 e 5.

**Jobs**: release (job `sync` do `design-sync.yml`, environment `design-sync-write`, após a
promoção; até o ENG-26, `workflow_dispatch` pelo dono da sincronização); PR (`--adapter memory`).

### 5.4 `design-sync detect`

**Uso**: `design-sync detect [flags comuns] [--no-tracker]`

**Propósito**: comparar snapshot e manifesto atual (classificação com o anterior), gerar o
relatório de divergência, criar ou atualizar itens por impressão digital e resolver itens cuja
impressão digital sumiu, inclusive `manual-write` e `manual-publish` atendidos. Nunca escreve na
ferramenta. `--no-tracker` só gera o relatório.

**Saídas** (com `--out`): `divergence-report.json`, `divergence-report.md` e envelope.

**`--json`** (além do envelope):

```json
{
  "summary": {
    "divergences": 1,
    "byKind": { "alias": 1, "extra": 0, "hierarchy": 0, "missing": 0, "name": 0, "type": 0, "value": 0 },
    "nameOrHierarchy": 0
  },
  "divergences": [ { "fingerprint": "sha256:…", "kind": "alias", "field": "value", "collection": "mode", "path": ["color", "bg", "surface"], "mode": "dark", "tool": "memory:sandbox", "expected": {}, "actual": {}, "classification": "manual", "sourceVersion": "1.4.0" } ],
  "tracker": { "created": ["sha256:…"], "reopened": [], "resolved": [], "unchanged": [], "updated": [] }
}
```

**Códigos**: 0 (sem divergência); 1 (divergências; itens criados ou atualizados); 2; 3; 4.

**Comprova**: FR-028 (zero diferença de nome ou hierarquia após sincronizar), FR-030; SC-010,
SC-011; US6 cenário 4.

**Jobs**: agendado semanal (job `detect`, environment `design-sync-read`); após cada `sync`;
`workflow_dispatch`; PR (`--adapter memory`).

### 5.5 `design-sync check-access`

**Uso**: `design-sync check-access [--adapter …] [--config …] [--json]`

**Propósito**: chamar `checkAccess()`, validar a configuração, resolver o time dono pelo arquivo de
donos e conferir as capacidades que não dependem do manifesto (`read`). Credencial que vence dentro
de `credentialExpiryWarnDays` gera aviso e item `credential` (rotação do ENG-13).

**`--json`** (além do envelope): `access` (`AccessReport`), `capabilities`
(`DesignToolCapabilities`), `owner` (`RoleRef`).

**Códigos**: 0 (inclusive com aviso de vencimento); 2 (configuração, dono ambíguo no arquivo de
donos, `read` manual); 4 (problema de acesso).

**Jobs**: primeiro passo de todo job com adaptador real (`sync`, `detect`, `contract-real`).

## 6. Lint de estilos (Stylelint)

Não é CLI própria: `pnpm lint:styles` executa a CLI do Stylelint 17 com o plugin
`@<prefixo>/stylelint-plugin` e uma configuração de gate:

```text
stylelint "<globs>" --config <config do gate> --ignore-disables --max-warnings 0 \
  --formatter json --output-file <relatório>
```

- Regras: `<prefixo>/design-tokens` (subcódigos `primitive-token`, `brand-mode-source-token`,
  `unknown-token`, `literal-value`, `var-fallback-literal`, `token-definition`, `control-height`,
  `control-height-missing`, `unclassified-component`) e `<prefixo>/contrast-pairs` (par de frente e
  fundo ausente do manifesto). Detalhe em [lint-rules.md](lint-rules.md).
- Entradas: `dist/meta/tokens.manifest.json` (via `./meta/*`), `contrast/manifest.json`, registro de
  controles de fixture (o registro de produção vem do contrato de DOM na feature de componentes).
- Alvos do gate nesta feature: as fixtures válidas e a sonda de violação proposital
  ([lint-rules.md](lint-rules.md), seção 6); o CSS de `apps/tokens-example` não é estilo de
  componente e fica fora. O núcleo de estilos entra no gate na feature de componentes. As fixtures
  válidas e inválidas rodam em `pnpm test`, comparando multiconjuntos de
  `{file, line, column, code}`.
- Códigos de saída: os do próprio Stylelint, exceção documentada à tabela da seção 1.2: 0 sem
  problema; 2 com problema de regra (equivale ao 1 canônico); 64 erro de uso e 78 configuração
  inválida (equivalem ao 2); 1 erro inesperado (equivale ao 3). O job trata qualquer valor diferente
  de zero como falha, e o relatório JSON é a evidência de zero violações (TOK-03).

**Comprova**: FR-021, FR-022, FR-023, FR-024; SC-009 (primitivo ou literal em estilo, altura fora da
escala); US5; US4 cenário 4.

**Jobs**: PR (obrigatório), noturno, release.

## 7. Scripts da raiz

Todos rodam via turbo (`envMode: strict`, telemetria desligada). Tarefas com efeito colateral ou que
precisam evitar cache (`check:determinism`, `design-sync`) têm `cache: false`.

| Script | Executa | Dependências no turbo | Propósito | Comprova |
| --- | --- | --- | --- | --- |
| `pnpm install --frozen-lockfile` | pnpm 11.28.x | n/a | Instala só do lockfile; falha com lockfile desatualizado; scripts de instalação bloqueados salvo `allowBuilds`; `minimumReleaseAge` 1440 | ENG-16, ENG-24 (provas na feature de CI) |
| `pnpm tokens:validate` | `tokens-build validate` | `^build` | Seção 2.1 | FR-002 a FR-007, FR-011, FR-033 |
| `pnpm tokens:build` | `tokens-build build` | `^build`; saídas `dist/**` e `api/**` | Seção 2.2 | FR-008, FR-010, FR-015 a FR-017 |
| `pnpm contrast:check` | `tokens-contrast check` | `@<prefixo>/tokens#tokens:build` | Seção 3.1 | FR-019, FR-020 |
| `pnpm lint:styles` | Stylelint com o gate | `@<prefixo>/tokens#tokens:build` | Seção 6 | FR-021 a FR-024 |
| `pnpm test` | `vitest run` (Node, coverage-v8) em cada pacote | `^build`; `tokens:build` onde a fixture usa o manifesto | Unidade de todas as ferramentas (regras, formatadores, cor, WCAG, composição, fixtures das regras de lint, varredura, drift, determinismo, núcleo do `design-sync` e suíte de contrato contra o fake); teste de integração da marca nova (copia a fonte para worktree temporário, acrescenta a marca sintética C, builda e exige que `git diff --name-only` só toque `packages/tokens/src/**` e o relatório de API regenerado `packages/tokens/api/tokens.api.json`, conforme [esm-output.md](esm-output.md), §11.3, pendência P-03); falha com módulo de lógica sem arquivo de teste (QA-02); limiares de cobertura de `quality/thresholds.json` (QA-03) | FR-009, SC-005, SC-009; QA-02 |
| `pnpm test:types` | Em `tests/types-consumer`: instala o tarball; `tsc --noEmit` estrito com `moduleResolution` `bundler` e `nodenext`, em TS 6.0.x e 7.0.x; `publint` no tarball | tarefa interna `pack` de `@<prefixo>/tokens` | Casos positivos com `expect-type`; negativos com `@ts-expect-error` para token, marca e modo inexistentes nas duas entradas | FR-016; SC-009 (nome inexistente); US2 cenário 4 |
| `pnpm test:e2e` | Em `apps/tokens-example`: instala dependências congeladas e o tarball com scripts desativados, confere integridade, `vite build`, Playwright contra `vite preview` na imagem fixada por digest, sem rede externa | tarefa interna `pack`; `contrast:check` com `--out` (o `contrast-report.json` é entrada das amostras de contraste, via `CONTRAST_REPORT`, [contrast-manifest.md](contrast-manifest.md), seção 11) | Escopos aninhados, padrões sem atributo, valor inválido, A → B → A, troca de marca e modo em runtime, marca nova (tarball da fixture com C), análise do bundle que importa só a marca A, nenhuma variável pública sem valor, amostras de cor iguais ao sRGB emitido com axe sobre superfície opaca; valores esperados lidos do mapa de valores do tarball | FR-012, FR-013, FR-014, FR-017, FR-018; SC-006, SC-007; US2 cenários 1 a 3; US3 cenário 3 |
| `pnpm check:determinism` | `repo-checks determinism` | `cache: false` | Seção 4.1 | FR-015, SC-002 |
| `pnpm check:drift` | `repo-checks drift` | nenhuma | Seção 4.2 | FR-015, FR-016 |
| `pnpm check:scan` | `repo-checks scan-tokens` e `--self-test` | nenhuma | Seção 4.3 | FR-001, SC-001 |
| `pnpm check:layers` | `turbo boundaries`, `repo-checks layers` e `--self-test`; as regras de import do ESLint (que cobrem `.vue`) entram com a feature de CI (ADR-12) | nenhuma | Seção 4.4 | ENG-01 |
| `pnpm design-sync -- plan\|apply\|detect --adapter memory` | `design-sync` | `cache: false`; `@<prefixo>/tokens#tokens:build` | Execução local e de PR com o fake | FR-025 a FR-030 (comportamento) |

A tarefa interna `pack` roda `pnpm pack` em `packages/tokens` para um diretório temporário; a
checagem de allowlist do tarball (ENG-17) é da feature de CI e publicação.

## 8. Jobs de CI

`.github/workflows/tokens-ci.yml`. Gatilhos: `pull_request` (só o afetado, com `--affected` e
`TURBO_SCM_BASE`; execução completa quando mudam lockfile, toolchain ou workflows, ENG-02);
noturno (`schedule` diário na branch padrão, completo, `--force` nos testes); release (os mesmos
portões no commit da versão, antes da pré-release, chamados pelo pipeline de publicação da feature
de CI).

| Job | PR | Noturno | Release | Executa |
| --- | --- | --- | --- | --- |
| `validate` | sim | sim | sim | `pnpm tokens:validate` |
| `build` | sim (Node 24) | sim (Node 24, 22 e 26) | sim | `pnpm tokens:build`; artefatos `dist/` e relatório |
| `contrast` | sim | sim | sim | `pnpm contrast:check -- --out <dir>` |
| `lint-styles` | sim | sim | sim | `pnpm lint:styles` |
| `unit` | sim (Node 24) | sim (Node 24, 22 e 26) | sim | `pnpm test` |
| `types` | sim (TS 6.0.x e 7.0.x) | sim | sim | `pnpm test:types` |
| `e2e` | sim (Chromium) | sim (todos os motores) | sim (todos os motores) | `pnpm test:e2e` |
| `determinism` | sim (build duplo) | sim (entre runners e entre Node 22 e 26) | sim | `pnpm check:determinism` |
| `drift` | sim | sim | sim | `pnpm check:drift` |
| `scan` | sim | sim | sim | `pnpm check:scan` |
| `layers` | sim | sim | sim | `pnpm check:layers` |
| `design-sync-fake` | sim | sim | não | `pnpm design-sync -- plan`, `apply` e `detect` com `--adapter memory` sobre fixtures |

`.github/workflows/design-sync.yml` ([design-sync.md](design-sync.md), seção 10):

| Job | Gatilho | Environment | Executa |
| --- | --- | --- | --- |
| `sync` | Após promoção à tag principal; `workflow_dispatch` até o ENG-26 | `design-sync-write` | `check-access`, `apply --previous …`, anexa o log à versão, depois `detect` |
| `detect` | Agendado semanal; `workflow_dispatch` | `design-sync-read` | `check-access`, `detect` |
| `contract-real` | Noturno e sob demanda na branch protegida, só depois da escolha da ferramenta | sandbox | Suíte `describeDesignToolPortContract` contra o adaptador real |

Falha em job de PR bloqueia o merge; falha em qualquer motor no noturno ou no release bloqueia a
publicação (QA-12). Cada job é um check nomeado, ligado à matriz de rastreabilidade (FR-031,
ACE-02; o check da matriz é da feature de CI).

## 9. Rastreabilidade: requisito, comando e job

| Requisito | Comando | Job |
| --- | --- | --- |
| FR-001 | `repo-checks scan-tokens`; `tokens-build validate` (`unreferenced-file`); regra `token-definition` | `scan`, `validate`, `lint-styles` |
| FR-002 | `tokens-build validate` (V-01) | `validate` |
| FR-003 | `tokens-build validate` (V-02, V-05) | `validate` |
| FR-004 | `tokens-build validate` (V-03, V-04) | `validate` |
| FR-005 | `tokens-build validate` (V-06) | `validate` |
| FR-006 | `tokens-build validate` (V-11); relatório do build | `validate`, `build` |
| FR-007 | `tokens-build validate` (V-12) | `validate` |
| FR-008 | `tokens-build build` (`report.json`, `report.md`) | `build` |
| FR-009 | Teste de integração da marca C em `pnpm test`; `pnpm test:e2e` | `unit`, `e2e` |
| FR-010 | `tokens-build build` (`css-combinations`) | `build` |
| FR-011 | `tokens-build validate` (V-07, V-09, V-13) | `validate` |
| FR-012 | `pnpm test:e2e`; `tokens-build build` (`css-toggle-form`, `css-public-outside-resolver`) | `e2e`, `build` |
| FR-013 | `pnpm test:e2e`; `tokens-build build` (`css-brand-selector`, `css-var-undeclared`) | `e2e`, `build` |
| FR-014 | `pnpm test:e2e`; `tokens-build build` (`css-toggle-form`) | `e2e`, `build` |
| FR-015 | `tokens-build build`; `repo-checks determinism`; `repo-checks drift` | `build`, `determinism`, `drift` |
| FR-016 | `tokens-build build`; `pnpm test:types`; `repo-checks drift` | `build`, `types`, `drift` |
| FR-017 | `tokens-build build` (`css-brand-selector`, `css-base-brand-value`); `pnpm test:e2e` | `build`, `e2e` |
| FR-018 | `pnpm test:e2e`; `repo-checks layers` (`app-source-dependency`) | `e2e`, `layers` |
| FR-019 | `tokens-contrast check` (schema, ordem, ids) | `contrast` |
| FR-020 | `tokens-contrast check`; `tokens-build validate` (V-10: valor medido igual ao emitido) | `contrast`, `validate` |
| FR-021 | Regra `<prefixo>/contrast-pairs`; fixtures em `pnpm test` | `lint-styles`, `unit` |
| FR-022 | Regra `<prefixo>/design-tokens`; fixtures em `pnpm test` | `lint-styles`, `unit` |
| FR-023 | Subcódigos `control-height` e `control-height-missing` | `lint-styles`, `unit` |
| FR-024 | Fixtures com multiconjunto exato; relatório JSON de zero violações | `unit`, `lint-styles` |
| FR-025 | `design-sync apply`; `repo-checks layers` (`token-source-reference`) | `sync`, `layers` |
| FR-026 | `design-sync apply`, `detect`, `check-access` (alerta em toda saída 2 a 5) | `sync`, `detect` |
| FR-027 | `design-sync apply` (`restored[]`); suíte de contrato C-08 | `sync`, `unit`, `contract-real` |
| FR-028 | `design-sync detect` após `apply` | `sync`, `detect` |
| FR-029 | `design-sync plan` e `apply` (`capabilityChecks`); suíte C-12 e C-15 | `sync`, `unit` |
| FR-030 | `design-sync detect` | `detect`, `sync` |
| FR-031 | Todos os jobs acima como checks nomeados | matriz de rastreabilidade (feature de CI) |
| FR-032 | Fora do plano (TOK-12 não contratado) | n/a |
| FR-033 | `tokens-build validate` (V-08) | `validate` |
| SC-001 | `tokens-build validate`; `repo-checks scan-tokens` | `validate`, `scan` |
| SC-002 | `repo-checks determinism` | `determinism` |
| SC-003 | `tokens-build validate` (V-11); `report.json` | `validate`, `build` |
| SC-004 | `tokens-build validate` (V-13) | `validate` |
| SC-005 | Teste de integração da marca C | `unit` |
| SC-006 | `pnpm test:e2e` (bundle só com a marca A, nenhuma variável pública sem valor) | `e2e` |
| SC-007 | `pnpm test:e2e` (escopos aninhados) | `e2e` |
| SC-008 | `tokens-contrast check` | `contrast` |
| SC-009 | Fixtures de violação de cada comando; `pnpm test:types` (nome inexistente) | `unit`, `validate`, `contrast`, `lint-styles`, `types` |
| SC-010 | `design-sync apply` e `detect` | `sync` |
| SC-011 | `design-sync detect` agendado e pós-versão | `detect`, `sync` |
