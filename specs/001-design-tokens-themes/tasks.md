---
description: "Lista de tarefas da feature 001 — Design tokens e temas"
---

# Tasks: Design tokens e temas

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Testes**: obrigatórios nesta feature. O Princípio VII da constituição e os requisitos QA-01,
QA-02, QA-08 e FR-024 exigem testes de unidade, de tipos, em navegador real e fixtures de lint com
violação proposital. As tarefas de teste de cada história estão no corpo da história.

**Marcador `<prefixo>`**: marcador da constituição (TODO(PREFIXO)). **Marcas** `a` (padrão) e `b`
são sintéticas até a entrega das marcas reais (QA-15). Caminhos e nomes seguem [plan.md](plan.md) e
os contratos.

## Format: `[ID] [P?] [Story] Descrição com caminho`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente).
- **[Story]**: US1 a US6; Setup, Foundational e Polish não levam rótulo.

---

## Phase 1: Setup (esqueleto do monorepo)

**Objetivo**: inicializar o monorepo e a configuração compartilhada (ADR-09, ADR-12).

- [x] T001 Rodar `git init`, criar `.gitignore` (ignorar `node_modules/`, `**/dist/`, `.turbo/`,
  `*.tsbuildinfo`) e definir `main` como branch na raiz `/`
- [x] T002 Criar `package.json` na raiz com `"packageManager": "pnpm@11.28.x"` (versão exata),
  `devEngines.packageManager` com `pmOnFail: "error"`, `private: true`, e scripts que delegam ao
  turbo (`tokens:validate`, `tokens:build`, `contrast:check`, `lint:styles`, `test`, `test:types`,
  `test:e2e`, `check:determinism`, `check:drift`, `check:scan`, `check:layers`, `design-sync`)
- [x] T003 [P] Criar `pnpm-workspace.yaml` com `packages`, `tools`, `apps`, `tests`; `catalog` com
  versões exatas (terrazzo 2.9.0, ajv, colorjs.io 0.7.1, stylelint 17.16.x, vitest 5.0.x,
  @playwright/test 1.64.x, typescript 6.0.x e catálogo nomeado `typescript7` para 7.0.x);
  `catalogMode: strict`; `allowBuilds` (allowlist do ENG-24, só `fsevents`); `minimumReleaseAge:
  1440`; `blockExoticSubdeps: true`; `trustPolicy: no-downgrade`
- [x] T004 [P] Criar `.node-version` (24.x) e `.gitattributes` forçando `* text=auto eol=lf`
- [x] T005 [P] Criar `tsconfig.base.json` estrito (`strict`, `moduleResolution: "bundler"`,
  `verbatimModuleSyntax`, `noEmit` por padrão), alvo compatível com TS 6.0
- [x] T006 Criar `turbo.json` com as tarefas do T002, `envMode: "strict"`, `globalDependencies`
  (`.node-version`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig.base.json`,
  `.github/**`), telemetria desligada, e o esqueleto de `boundaries.tags` (preenchido no T022)
- [x] T007 [P] Criar `quality/thresholds.json` (QA-14) com a seção de contraste
  `{ "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }` e espaço para orçamento de bundle do QA-07
  (valor pendente com o requerente)
- [x] T008 [P] Criar `quality/license-policy.json` (ENG-21) com as licenças permitidas (MIT, ISC,
  Apache-2.0, BSD-2-Clause, BSD-3-Clause, MIT-0, CC0-1.0, Python-2.0), MPL-2.0 só como dependência de
  desenvolvimento não modificada, W3C para a cópia dos schemas DTCG, e override revisado de
  `svg-tags` (MIT pelo campo legado)
- [x] T009 [P] Criar `quality/scan-allowlist.json` (varredura do FR-001) com a fonte de tokens e as
  fixtures dos scanners, cada entrada com justificativa
- [x] T010 [P] Criar `.github/CODEOWNERS` com donos por área, incluindo o papel dono da
  sincronização (DSN-02) e o dono de acessibilidade do manifesto de contraste (GOV-09)
- [x] T011 [P] Criar `stylelint.config.mjs` na raiz (esqueleto do gate: `ignoreDisables: true`,
  caminho do plugin, preenchido no T0 da US5)
- [x] T012 [P] Criar `.github/workflows/tokens-ci.yml` (esqueleto): `pnpm install --frozen-lockfile`,
  todas as actions fixadas por digest SHA (ENG-18), matriz de Node piso (22 LTS) e mais recente,
  `TURBO_TELEMETRY_DISABLED=1`, separação PR (Chromium) e noturno (todos os motores)

**Checkpoint**: monorepo instala com lockfile congelado e `turbo run` resolve as tarefas vazias.

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Objetivo**: pacote de tokens, schemas, modelo interno do build, motor de cor, checks de repo e
fronteiras de camada. **Nenhuma história começa antes disto.**

- [x] T013 Criar `packages/tokens/package.json` (`@<prefixo>/tokens`): `exports` `"."` →
  `dist/esm/index.js` (types `index.d.ts`), `"./values"` → `dist/esm/values.js`, `"./css/base.css"`,
  `"./css/brand-*.css"`, `"./meta/*"`; `sideEffects: ["**/*.css"]`; `files` allowlist (ENG-17);
  **zero dependências de runtime**; `license` `UNLICENSED` (marcador, ENG-22)
- [ ] T014 [P] Copiar `format.json` e `resolver.json` do DTCG 2025.10 para
  `packages/tokens/schemas/dtcg-2025.10/`, com `SHA256SUMS` e `LICENSE-W3C.md`; registrar origem e
  licença W3C em `quality/license-policy.json` e nos avisos de terceiros
- [x] T015 [P] Criar `packages/tokens/src/layers.json` na forma `{ "order": ["<prefixo>.tokens"] }`
  (fonte única da ordem das camadas, css-output L-03)
- [x] T016 Criar scaffold de `tools/tokens-build` (`@<prefixo>/tokens-build`, `private: true`):
  `package.json` com devDependency `@terrazzo/parser` e `@terrazzo/token-tools` 2.9.0 (alinhadas por
  `overrides` do pnpm), `ajv` exato e `@<prefixo>/color`; `bin` `tokens-build` com subcomandos
  `validate` e `build`; códigos de saída 0 ok, 1 violação, 2 uso/config, 3 interno; flag `--json`
  (tools-cli.md §1)
- [x] T017 Implementar em `tools/tokens-build/src/model.ts` o modelo interno de token (data-model,
  "Token": `path`, `cssName`, `layer`, `category`, `type`, `axis`, `role`, `values`, `source`) e o
  leitor com Ajv que valida contra os schemas DTCG versionados (V-01) e monta o índice
  `id → arquivo:linha:coluna` usado em toda mensagem de erro
- [x] T018 Implementar em `tools/tokens-build/src/resolver.ts` o carregamento via `@terrazzo/parser`
  com `req` próprio que rejeita `$ref` não `file:` (sem rede); expor `listPermutations()` e
  `apply()`; falhar (código 1) se a lista de permutações vier indefinida ou incompleta
- [ ] T019 [P] Criar `tools/color` (`@<prefixo>/color`, folha, sem dependências do workspace) com
  `toEmittedSrgb()` (mapeamento CSS Color 4 método `css`, sRGB de 8 bits; alfa `rgb(r g b / a)` com
  três casas), módulo WCAG 2.2 (limiar 0,04045; coeficientes 0,2126/0,7152/0,0722; sem
  arredondamento; aprova com ≥) e composição source-over em sRGB gama, variante float e variante que
  arredonda 8 bits a cada dobra; testes unitários com vetores de ouro (#767676/#fff = 4,54 passa,
  #777777/#fff = 4,48 falha, preto/branco = 21) — ADR-15, FR-020, QA-02
- [x] T020 [P] Criar scaffold de `tools/repo-checks` (`@<prefixo>/repo-checks`, sem dependências do
  workspace): `bin` `repo-checks` com `determinism`, `drift`, `scan-tokens`, `layers`; códigos de
  saída 0–3; `--json`
- [x] T021 Implementar `tools/repo-checks` subcomando `layers`: check de manifesto pnpm
  (`pnpm ls -r --prod --json`) que falha com pacote de UI no fechamento `--prod` de pacote `tools`,
  com pacote sem exatamente uma tag de camada e com `@boundaries-ignore` fora de registro versionado;
  mais fixture de violação proposital em `.ts` por aresta proibida (ENG-01, ADR-12 check c)
- [x] T022 Preencher `turbo.json` `boundaries.tags`: tags `tokens`, `tools`, `apps` e as arestas
  permitidas do plan (`tokens -(dev)-> tools/tokens-build, tools/color`; `tools/tokens-build ->
  tools/color`; `apps -> tokens só via tarball`); `tools/color` e `tools/repo-checks` sem dependência
  do workspace (ADR-12 check a)
- [ ] T023 Ligar no `.github/workflows/tokens-ci.yml` os jobs `install --frozen-lockfile` e
  `check:layers` (turbo boundaries + `repo-checks layers`), com a fixture de violação do T021 provando
  o bloqueio

**Checkpoint**: fundação pronta — as histórias podem começar; US4 e US6 podem correr em paralelo a
US2/US3 depois daqui.

---

## Phase 3: User Story 1 — Definir tokens numa fonte única validada (Priority: P1) 🎯 MVP

**Goal**: fonte única DTCG em três camadas, com nomes padronizados, validada no CI; token mal
formado, mal nomeado, com literal fora da camada primitiva ou referência inválida é barrado.

**Independent Test**: propor mudanças válidas e inválidas (nome fora do padrão, literal na camada
semântica, alias para token inexistente, ciclo, categoria sem token semântico) e confirmar que só as
válidas passam, com relatório por categoria (spec US1).

### Fixtures e testes (US1)

- [ ] T024 [P] [US1] Criar fixtures inválidas em `tools/tokens-build/fixtures/invalid/` com `expect`
  de código por caso: literal fora de primitivo (V-02), alias inexistente e ciclo (V-03), referência
  de camada acima (V-04: `primitive → primitive`, `semantic → primitive|semantic`, `component →
  semantic|component|primitive`), `$ref` fora de primitivo, `$root` e `$extends` fora da forma com
  chaves (V-05), nome fora da gramática (V-06), categoria sem token semântico (V-11), variação nos
  dois eixos fora da forma do `brand.` (V-08), valor semântico em set compartilhado (V-09), `hex`
  divergente dos componentes (V-10), altura de controle fora da escala (V-12), chave semântica
  ausente/excedente numa permutação (V-13)
- [ ] T025 [P] [US1] Criar fixtures válidas em `tools/tokens-build/fixtures/valid/` que passam com
  zero violações, cobrindo todas as 11 categorias e a escala de alturas
- [x] T026 [P] [US1] Testes unitários dos validadores em `tools/tokens-build/test/validate.test.ts`
  (Vitest), comparando o multiconjunto de `{arquivo, linha, coluna, código}` esperado e obtido (100%
  dos erros esperados, zero falsos positivos; FR-024, SC-009, QA-02)

### Implementação (US1)

- [x] T027 [US1] Implementar os validadores de camada e alias em
  `tools/tokens-build/src/rules/layer.ts`: literal só em `primitive` (V-02, FR-003); alias resolve e
  sem ciclo em todas as permutações (V-03, FR-004); direção de referência (V-04); `$ref` só em
  primitivo, `$root` proibido, `$extends` só com chaves (V-05) — códigos `TKN-*` da token-source.md
- [x] T028 [US1] Implementar o validador de nomenclatura em `tools/tokens-build/src/rules/naming.ts`:
  gramática de segmentos por categoria em ordem fixa, kebab ASCII, prefixo, colisão de nome CSS
  (V-06, FR-005, `TKN-NAME-*`)
- [x] T029 [US1] Implementar os validadores de eixo em `tools/tokens-build/src/rules/axis.ts`: eixo
  coerente com os contextos (V-07); forma do grupo `brand.` para variação marca × modo, com as mesmas
  chaves em toda marca (V-08, FR-033); sets compartilhados sem valor de eixo (V-09, `TKN-AXIS-*`,
  `TKN-BRAND-SOURCE-*`)
- [x] T030 [US1] Implementar cobertura e escala em `tools/tokens-build/src/rules/coverage.ts`: ao
  menos um token semântico por categoria (V-11, FR-006); escala única de alturas fechada (V-12,
  FR-007, `TKN-CATEGORY-COVERAGE`, `TKN-CONTROL-SCALE`)
- [x] T031 [US1] Implementar a paridade de chaves em `tools/tokens-build/src/rules/parity.ts`:
  comparar o conjunto de chaves semânticas de todas as permutações e por contexto, apontando chave
  ausente ou excedente (V-13, FR-011, `TKN-PARITY-*`)
- [x] T032 [US1] Ligar as regras ao `tokens-build validate`, emitindo um resumo de validação JSON com
  contagem por categoria e a escala de alturas por permutação (atende o cenário 4 da US1; relatório
  completo fica no build, FR-008)
- [x] T033 [P] [US1] Criar a fonte inicial em `packages/tokens/src/`: `tokens.resolver.json`
  (modificadores `brand` com contextos `a`/`b` e `mode` com `light`/`dark`, `default` `a` e `light`,
  `resolutionOrder`), `primitive/*.tokens.json`, `semantic/invariant.tokens.json`,
  `semantic/brand/{a,b}.tokens.json` (grupo `brand.`), `semantic/mode/{light,dark}.tokens.json`,
  `component/*.tokens.json`, cobrindo as 11 categorias e `size.control.*` com valores sintéticos
- [x] T034 [US1] Implementar `tools/repo-checks` subcomando `scan-tokens` (FR-001): varrer
  `git ls-files` por declaração de custom property com valor literal e qualquer nome em CSS, `<style>`
  de SFC e HTML fora da fonte, chaves `--<prefixo>-` e `setProperty` em TS/JS/JSON e documentos DTCG
  fora da fonte; respeitar `quality/scan-allowlist.json`; fixtures de autoteste em CSS, SFC, TSX e
  JSON detectadas 100% (SC-001, SC-009)
- [ ] T035 [US1] Adicionar o check de "módulo de lógica sem teste irmão" em `tools/repo-checks` e
  rodá-lo em `pnpm test` (QA-02)
- [ ] T036 [US1] Ligar `tokens:validate` e `check:scan` no `tokens-ci.yml` como checks obrigatórios
  de PR; rodar sobre a fonte real (100% dos tokens passam)

**Checkpoint**: US1 testável sozinha — `pnpm tokens:validate` aprova a fonte e barra cada violação.

---

## Phase 4: User Story 2 — Consumir tokens gerados com marca e modo por subárvore (Priority: P2)

**Goal**: CSS por marca e módulos tipados gerados de forma determinística; marca e modo por atributo,
com escopos aninhados; erro de tipos para token inexistente.

**Independent Test**: app de exemplo que importa `base.css` + a marca A, alterna modo e aninha
escopos, sem variável exclusiva de B nem variável sem valor; projeto tipado recebe erro em token
inexistente; dois builds byte a byte idênticos (spec US2).

### Testes (US2)

- [ ] T037 [P] [US2] Testes unitários dos formatadores em
  `tools/tokens-build/test/format-css.test.ts` e `format-esm.test.ts`: seletores, forma sem espaço
  entre toggles, `initial` literal, colocação por `placement`, saída ordenada (QA-02)
- [ ] T038 [P] [US2] Criar `apps/tokens-example` (Vite 8 sem framework, `@<prefixo>/tokens-example`)
  que instala o **tarball empacotado** do pacote de tokens (nunca o código-fonte; QA-06, Princípio
  VII), importa `./css/base.css` e `./css/brand-a.css`, e lê o mapa `./values`
- [ ] T039 [P] [US2] Testes em navegador real em `apps/tokens-example/tests/scopes.spec.ts`
  (@playwright/test, imagem `mcr.microsoft.com/playwright:v1.64.x-noble` fixada por digest, sem rede)
  cobrindo os 21 casos da css-output.md §16: sem atributo (marca padrão + claro), modo só na raiz,
  escopo só de modo aninhado, escopo só de marca herdando modo, A→B→A, alternância de modo, cadeia
  intercalada, dois atributos num elemento, valores inválidos herdam o ancestral, marca não
  importada, troca em runtime, comparação exata de strings; e importação só de A sem variável de B
  nem variável pública sem valor (ENG-06, FR-012 a FR-014, FR-017, SC-006, SC-007)
- [ ] T040 [P] [US2] Criar `tests/types-consumer` (`@<prefixo>/types-consumer`) que instala o tarball
  e roda `tsc --noEmit` estrito em `moduleResolution` `bundler` e `nodenext`, nas versões TS 6.0.x e
  7.0.x (catálogo `typescript7`), com `expect-type` nos casos positivos e `@ts-expect-error` nos
  negativos (token, marca e modo inexistentes); `publint` no tarball (FR-016, QA-08, ENG-05)

### Implementação (US2)

- [ ] T041 [US2] Implementar o formatador CSS em `tools/tokens-build/src/format/css.ts`: emitir
  `base.css` (declaração de camadas do `layers.json`, primitivos compartilhados em `:where(:root)`,
  toggles privados `--<prefixo>-_on-light`/`_on-dark` com `initial` literal, modo padrão, resolvedor
  `:where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode])` com os tokens de eixo modo,
  invariantes e de componente, na forma sem espaço) e `brand-<id>.css` (tokens de eixo marca públicos
  e primitivos exclusivos da marca; `:where(:root)` só na marca padrão) — css-output.md §4 a §8,
  FR-015, FR-017
- [ ] T042 [US2] Implementar o lint do CSS gerado em `tools/tokens-build/src/format/css-lint.ts`:
  forma sem espaço, `initial` literal (bug WebKit 243247), todo alvo de `var()` declarado, token
  público só no resolvedor ou no escopo de marca, `css-layer` vs `layers.json`, `dist-parity`
  (css-output.md §13) — falha no build
- [ ] T043 [P] [US2] Implementar o formatador ESM em `tools/tokens-build/src/format/esm.ts`: `index.js`
  com objeto congelado `tokens` por caminho + `.d.ts` com união `TokenName` e literais
  `var(--<prefixo>-…)`; `values.js` com `Readonly<Record<Brand, Record<Mode, Record<TokenName,
  string>>>>` + `.d.ts`; excluir o segmento privado `_` (esm-output.md, FR-016)
- [ ] T044 [US2] Implementar o emissor de `dist/meta/tokens.manifest.json` em
  `tools/tokens-build/src/format/manifest.ts` conforme [contracts/build-manifests.md](contracts/build-manifests.md)
  §2 (por token: `cssName`, `layer`, `category`, `type`, `axis`, `role`, `placement`,
  `exclusiveBrand`, `aliasOf`, `aliasChains` por permutação, `scale`, `color.emitted`/`subRefs`,
  `source`), com garantias M-06 a M-08
- [ ] T045 [P] [US2] Implementar o emissor de `dist/meta/sync-manifest.json` em
  `tools/tokens-build/src/format/sync-manifest.ts` (build-manifests.md §3, formato em
  [contracts/design-sync.md](contracts/design-sync.md)), do mesmo modelo resolvido
- [ ] T046 [P] [US2] Implementar o emissor de `dist/meta/report.json` e `report.md` em
  `tools/tokens-build/src/format/report.ts`: contagem por categoria e camada, escala de alturas por
  permutação, cores fora do gamut mapeadas, tamanho bruto e gzip de cada arquivo (build-manifests.md
  §4, FR-006, FR-008, QA-07)
- [ ] T047 [P] [US2] Implementar o emissor do relatório de API em
  `tools/tokens-build/src/format/api-report.ts` → `packages/tokens/api/tokens.api.json` (versionado),
  conforme esm-output.md §11 (superfície pública, classificação major/minor/patch do GOV-01)
- [ ] T048 [US2] Implementar o writer determinístico em `tools/tokens-build/src/write.ts` (ordenação
  por code point, LF, sem timestamp nem caminho absoluto; JSON canônico M-02) e ligar o pipeline
  `tokens-build build` que roda os formatadores T041 a T047
- [ ] T049 [US2] Implementar `tools/repo-checks` subcomando `determinism`: dois builds a partir de
  dois `git worktree` limpos, em caminhos, `TZ` e `LC_ALL` diferentes, com cache de tarefas
  desligado, empacotando com `pnpm pack`; comparar sha256 por arquivo e dos tarballs; variante entre
  Node piso e mais recente (FR-015, SC-002, ENG-08)
- [ ] T050 [US2] Implementar `tools/repo-checks` subcomando `drift`: `dist/` no `.gitignore`; falhar
  se `git ls-files` listar arquivo gerado; regenerar `api/tokens.api.json` e exigir
  `git diff --exit-code` (QA-08)
- [ ] T051 [US2] Ligar `tokens:build`, `test:types`, `test:e2e` (Chromium no PR; todos os motores no
  noturno), `check:determinism` e `check:drift` no `tokens-ci.yml`; gerar o tarball e instalar nas
  apps (QA-06)

**Checkpoint**: US2 testável — app de exemplo troca marca e modo, tipos barram token inexistente,
build byte a byte idêntico.

---

## Phase 5: User Story 3 — Adicionar uma marca sem tocar em componentes (Priority: P3)

**Goal**: adicionar uma marca altera apenas arquivos de tokens (a fonte e o relatório de API
regenerado), com as mesmas chaves semânticas e troca em runtime.

**Independent Test**: adicionar a marca sintética `c` e conferir no diff que só mudaram arquivos de
tokens; a checagem de chaves passa; a app alterna para `c` em runtime (spec US3).

- [ ] T052 [P] [US3] Teste de integração em `tools/tokens-build/test/add-brand.test.ts`: copiar a
  fonte para worktree temporária, acrescentar o contexto `c` e `semantic/brand/c.tokens.json`,
  rodar `tokens-build build`, e afirmar que `git diff --name-only` toca só `packages/tokens/src/**` e
  `packages/tokens/api/tokens.api.json` (FR-009, SC-005)
- [ ] T053 [P] [US3] Teste em navegador real em `apps/tokens-example/tests/add-brand.spec.ts`: com a
  marca `c` na worktree, a app alterna para `c` em runtime; valores mudam sem recarregar e sem
  alteração de código de componente (US3 cenário 3)
- [ ] T054 [US3] Confirmar que a paridade de chaves (T031) e o diff aceitam a marca `c`: fixture em
  que `c` tem chave ausente ou excedente é bloqueada (US3 cenário 2); documentar os passos de
  "adicionar uma marca" em [quickstart.md](quickstart.md) se ainda não cobertos

**Checkpoint**: US3 testável — marca nova entra só por arquivos de tokens.

---

## Phase 6: User Story 4 — Garantir contraste em todas as combinações (Priority: P4)

**Goal**: manifesto de pares de contraste medido em todas as combinações de marca e modo, com
opacidade composta; par reprovado falha o build; estado inativo é medido e reportado sem falhar.

**Independent Test**: incluir um par reprovado e um translúcido e confirmar que o build falha no
primeiro e compõe o segundo sobre o fundo (spec US4).

### Testes (US4)

- [ ] T055 [P] [US4] Fixtures de manifesto em `tools/tokens-contrast/fixtures/`: par reprovado, par
  translúcido composto, pilha sem base opaca (V-16), conjunto de superfícies vazio num modo, token
  ausente numa permutação (V-14), par isento `wcag-inactive` abaixo do mínimo (reportado, não falha),
  grupo "any-of" com um lado aprovado e outro sem lado aprovado, limiares incoerentes (código 2),
  `emitted-mismatch`
- [ ] T056 [P] [US4] Testes unitários em `tools/tokens-contrast/test/check.test.ts` da composição
  (float e 8 bits por dobra, menor dos dois), isenção, grupo any-of e truncamento/ordem do relatório
  (FR-020, SC-002, QA-02)

### Implementação (US4)

- [ ] T057 [P] [US4] Criar `packages/tokens/contrast/manifest.json`, `surfaces.json` e seus schemas
  (`manifest.schema.json`, `surfaces.schema.json`) conforme contrast-manifest.md: `pairs[]` com `id`,
  `fg`, `bg` (pilha ou `@conjunto`), `state` do vocabulário versionado, `kind`, `group`, `exempt`;
  referências só a tokens semânticos públicos ou de componente (FR-019); dono de a11y no CODEOWNERS
- [ ] T058 [US4] Criar `tools/tokens-contrast` (`@<prefixo>/tokens-contrast`, devDependency de
  `@<prefixo>/color` e dos manifestos de `@<prefixo>/tokens`): `bin` `tokens-contrast check`, códigos
  de saída 0–3
- [ ] T059 [US4] Implementar o checker em `tools/tokens-contrast/src/check.ts`: para cada par e
  permutação, resolver via `tokens.manifest.json` (`color.emitted`), compor alfa sobre pilha opaca ou
  `@conjunto` expandido, aplicar o módulo WCAG de `@<prefixo>/color`, mínimos de
  `quality/thresholds.json`, isenção `wcag-inactive`, grupo any-of, `emitted-mismatch`; par reprovado
  falha o build (FR-020, FR-021 parte de dados, A11Y-09, SC-008)
- [ ] T060 [US4] Emitir o relatório de contraste JSON e Markdown (ordenado por id, marca e modo, sem
  timestamp, razões truncadas a 2 casas na tabela) e retê-lo como evidência (ACE-02)
- [ ] T061 [P] [US4] Amostras em navegador real em `apps/tokens-example/tests/contrast.spec.ts`:
  renderizar um swatch por par e permutação do tarball, pintar a pilha opaca em ancestrais reais,
  afirmar `getComputedStyle` igual ao sRGB emitido e rodar axe (Princípio VII, QA-01; axe/@axe-core
  no `license-policy.json` como MPL-2.0 dev)
- [ ] T062 [US4] Ligar `contrast:check` no `tokens-ci.yml` sobre o manifesto real em todo PR e incluir
  o relatório na variante de determinismo entre Node piso e mais recente

**Checkpoint**: US4 testável — contraste de todos os pares em todas as combinações, com isenções.

---

## Phase 7: User Story 5 — Barrar estilos fora dos tokens (Priority: P5)

**Goal**: lint de estilos que barra token primitivo, valor literal e altura de controle fora da
escala, entregue com fixtures e provado.

**Independent Test**: rodar o lint sobre exemplos válidos e inválidos e confirmar 100% dos erros
esperados e zero falsos positivos (spec US5).

### Testes (US5)

- [ ] T063 [P] [US5] Fixtures em `tools/stylelint-plugin/fixtures/valid/` (zero avisos) e
  `invalid/` (um `/* expect: <código>@<coluna> */` por caso) cobrindo os 9 subcódigos:
  `primitive-token`, `brand-mode-source-token`, `unknown-token` (com e sem prefixo), `literal-value`,
  `var-fallback-literal`, `token-definition`, `control-height`, `control-height-missing`,
  `unclassified-component` (lint-rules.md §3)
- [ ] T064 [P] [US5] Harness de fixtures em `tools/stylelint-plugin/test/rule.test.ts` comparando
  multiconjunto de `{arquivo, linha, coluna, código}`, exigindo que todo código tenha fixture inválida
  (FR-024, SC-009)

### Implementação (US5)

- [ ] T065 [US5] Criar `tools/stylelint-plugin` (`@<prefixo>/stylelint-plugin`, devDependency de
  stylelint 17.16.x, `@csstools/*` 4.x, `postcss-selector-parser` 7.x; consome
  `@<prefixo>/tokens/meta/tokens.manifest.json`)
- [ ] T066 [US5] Implementar a regra `<prefixo>/design-tokens` em
  `tools/stylelint-plugin/src/design-tokens.ts`: mapa de propriedades governadas, allowlist de
  palavras-chave (`transparent`, `currentcolor`, `0`, `auto`, `none`, globais), os 9 subcódigos,
  registro de controles só de fixture, regra para `@media`/`@container` (lint-rules.md §3; FR-022,
  FR-023)
- [ ] T067 [P] [US5] Implementar a regra `<prefixo>/contrast-pairs` em
  `tools/stylelint-plugin/src/contrast-pairs.ts`: agrupar por sujeito e estado, exigir anotação de
  fundo `/* <prefixo>-contrast: on <token> | @<conjunto> */` quando não estiver no mesmo sujeito,
  erro em expressão não resolvível, pular `@media (forced-colors)` (FR-021)
- [ ] T068 [US5] Preencher `stylelint.config.mjs` e ligar `lint:styles` no `tokens-ci.yml` com
  `ignoreDisables`, `--max-warnings 0` e relatório JSON como prova de zero violações (aplicado às
  fixtures nesta feature; ao núcleo quando existir)

**Checkpoint**: US5 testável — o lint barra cada violação e não gera falso positivo.

---

## Phase 8: User Story 6 — Manter a ferramenta de design sincronizada (Priority: P6)

**Goal**: motor de sincronização repositório → ferramenta em portas e adaptadores, com fake em
memória, detecção de divergência e itens rastreáveis; sem operação que leia da ferramenta para o
repositório.

**Independent Test**: suíte de contrato contra o fake (edição manual restaurada, renomeação, divergência);
nenhuma rotina importa variáveis para o repositório (spec US6).

### Testes (US6)

- [ ] T069 [P] [US6] Implementar `InMemoryDesignTool` em `tools/design-sync/src/adapters/memory.ts`
  com capacidades configuráveis e injeção de falhas (falhar após N operações, 429 com Retry-After,
  403, credencial expirada) e os auxiliares `simulateManualEdit`, `simulateRename`,
  `simulateExtraVariable`, `faults.failAfterOperations` (design-sync.md)
- [ ] T070 [P] [US6] Implementar `describeDesignToolPortContract` em
  `tools/design-sync/test/port-contract.test.ts` (casos C-01 a C-18) e rodá-la contra o fake em todo
  PR (QA-02); `InMemoryTracker`, `InMemoryAlert` e `FakeClock`; marcas sintéticas A/B (QA-15)

### Implementação (US6)

- [ ] T071 [US6] Criar `tools/design-sync` (`@<prefixo>/design-sync`, `private: true`, **sem
  dependências de runtime**; só `fetch`, `crypto`, `fs`, `util.parseArgs`) com `bin` `design-sync`
  (`plan`, `apply`, `detect`, `check-access`, `--adapter memory|<tool>`); códigos 0–5 (4 acesso, 5
  verify)
- [ ] T072 [US6] Definir as portas em `tools/design-sync/src/ports.ts`: `DesignToolPort`
  (`capabilities`, `checkAccess`, `readSnapshot`, `apply(plan,{dryRun})`, `requestPublish`),
  `TrackerPort`, `AlertPort`, **sem operação ferramenta → repositório** (garante FR-025 e US6 cenário
  6)
- [ ] T073 [US6] Implementar o núcleo puro em `tools/design-sync/src/core/`: estado desejado do
  `sync-manifest.json`, topologia por eixo, diff e plano (renomeação por chave, recriar na troca de
  tipo, deletes por último só em coleções gerenciadas), classificação de divergência contra versão
  anterior e atual, log JSON canônico com envelope separado, impressão digital da divergência
  (DSN-01 a DSN-05, DSN-11, FR-025 a FR-030); estados `planned|dry-run|verified|failed`
- [ ] T074 [P] [US6] Implementar os adaptadores GitHub de tracker e alerta em
  `tools/design-sync/src/adapters/github/`: token de GitHub App de curta duração (Issues:write, org
  Members:read), item com dono (papel do CODEOWNERS) e prazo (detecção + SLA de
  `design-sync.config.json`), alerta ao dono em falha (DSN-02, FR-026); testes contra snapshots
  gravados
- [ ] T075 [US6] Criar `.github/workflows/design-sync.yml`: gatilhos pós-promoção à tag principal,
  cron semanal e `workflow_dispatch`, num grupo de concorrência; environments `design-sync-read` e
  `design-sync-write`; actions fixadas por SHA; sem segredo em PR de fork (ENG-14)
- [ ] T076 [US6] Adicionar teste de arquitetura (`tools/design-sync/test/no-repo-write.test.ts`) e
  aresta no arquivo de camadas que proíbem o `design-sync` escrever na fonte de tokens (ENG-01,
  FR-025)

**Checkpoint**: US6 testável — sincronização validada contra o fake; adaptador real fica para depois
da decisão do requerente.

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: fechamento, rastreabilidade e requisitos transversais.

- [ ] T077 [P] Escrever `packages/tokens/README.md` com propósito, instalação, uso mínimo e link para
  a documentação completa (DOC-08)
- [ ] T078 [P] Gerar/escrever `docs/tokens/convencao-de-nomes.md` a partir do contrato
  [token-source.md](contracts/token-source.md) e ligar o check que compara os vocabulários do
  documento com os do validador (TOK-04)
- [ ] T079 Criar a matriz de rastreabilidade versionada (`specs/001-design-tokens-themes/traceability.md`
  ou `quality/traceability.json`) ligando cada FR/ID desta feature a um check de CI ou evidência, e um
  check que falha com ID sem check (FR-031, ACE-02)
- [ ] T080 [P] Ligar `pnpm sbom` (ENG-19) e `pnpm licenses list --json` contra
  `quality/license-policy.json` (ENG-21) no `tokens-ci.yml`, incluindo os pacotes `tools/*`
- [ ] T081 [P] Ligar a medição do orçamento de bundle (QA-07) a partir de `report.json` (`files`)
  contra `quality/thresholds.json` (valor do orçamento pendente com o requerente)
- [ ] T082 Rodar a validação ponta a ponta do [quickstart.md](quickstart.md) e registrar o resultado
- [ ] T083 Revisão de conformidade com a constituição (as 14 perguntas do Constitution Check do
  plano) e anexar ao pacote de aceite da fase (ACE-01); obter aprovação de dono dos ADR-11 a ADR-16
  (GOV-07, GOV-09)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependência; começa já.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia todas as histórias**.
- **US1 (Phase 3)**: depende da Foundational. É o MVP.
- **US2 (Phase 4)**: depende da Foundational e da fonte válida da US1 (T033).
- **US3 (Phase 5)**: depende da US1 (paridade) e da US2 (build e app de exemplo).
- **US4 (Phase 6)**: depende da Foundational (`tools/color`, T019) e dos valores emitidos no
  `tokens.manifest.json` (T044); pode correr em paralelo à US2 depois do T044.
- **US5 (Phase 7)**: depende do `tokens.manifest.json` (T044).
- **US6 (Phase 8)**: depende do `sync-manifest.json` (T045); o núcleo e o fake não dependem de US3,
  US4 nem US5.
- **Polish (Phase 9)**: depende das histórias contratadas concluídas.

### Within Each User Story

- Fixtures e testes antes ou junto da implementação; comparar por multiconjunto.
- Validadores e formatadores são funções puras com teste unitário.
- História completa e testável antes da próxima prioridade.

### Parallel Opportunities

- Setup: T003, T004, T005, T007, T008, T009, T010, T011, T012 em paralelo.
- Foundational: T014, T015, T019, T020 em paralelo; T016→T017→T018 em sequência.
- US1: T024, T025, T026, T033 em paralelo antes das regras; as regras T027 a T031 tocam arquivos
  diferentes e podem correr em paralelo.
- US2: T037, T038, T039, T040 em paralelo; formatadores T043, T045, T046, T047 em paralelo após T044.
- Depois da Foundational, com `tokens.manifest.json` pronto (T044), **US4, US5 e o núcleo de US6**
  podem correr em paralelo a US3, por tocarem pacotes diferentes (`tools/tokens-contrast`,
  `tools/stylelint-plugin`, `tools/design-sync`).

---

## Parallel Example: User Story 1

```bash
# Fixtures e testes juntos:
Task: "Fixtures inválidas em tools/tokens-build/fixtures/invalid/ (T024)"
Task: "Fixtures válidas em tools/tokens-build/fixtures/valid/ (T025)"
Task: "Fonte inicial em packages/tokens/src/ (T033)"

# Regras de validação (arquivos diferentes):
Task: "Regras de camada e alias em tools/tokens-build/src/rules/layer.ts (T027)"
Task: "Nomenclatura em tools/tokens-build/src/rules/naming.ts (T028)"
Task: "Eixo e brand.* em tools/tokens-build/src/rules/axis.ts (T029)"
Task: "Cobertura e escala em tools/tokens-build/src/rules/coverage.ts (T030)"
Task: "Paridade em tools/tokens-build/src/rules/parity.ts (T031)"
```

---

## Implementation Strategy

### MVP (só US1)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → validar `pnpm tokens:validate` e
`check:scan` sozinhos. Entrega a fonte única validada.

### Entrega incremental

Setup + Foundational → US1 (fonte validada) → US2 (CSS/ESM/manifestos, app de exemplo) → US3 (marca
nova) → US4 (contraste) → US5 (lint) → US6 (sincronização). Cada história agrega valor sem quebrar as
anteriores.

### Estratégia de time paralelo

Depois do T044 (`tokens.manifest.json`), US4, US5 e o núcleo de US6 vão para pessoas diferentes, em
pacotes `tools/*` distintos; US2 e US3 continuam na trilha principal.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Marcas `a`/`b` sintéticas; marca padrão real, prefixo, ferramenta de design, lista de navegadores,
  pisos de Node/TS e contratação do TOK-12 pendentes com o requerente (plan.md, research.md). As
  tarefas usam as premissas vigentes.
- Os checks de `.vue` do ENG-01 e o cache remoto do ENG-03 (ADR-12) ficam para a feature de CI e
  governança; esta feature entrega os checks de camada em `.ts`.
- FR-032 (TOK-12, Desejável) não tem tarefa até a contratação.
- Commit após cada tarefa ou grupo lógico; parar em cada checkpoint para validar a história.
