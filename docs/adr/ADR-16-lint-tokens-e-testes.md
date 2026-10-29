# ADR-16: Lint de tokens e pilha de testes

**Status**: Proposto | **Data**: 2026-10-21 | **Feature**: 001-design-tokens-themes | **Relaciona**: ADR-08, ADR-09

## Contexto

O ADR-08 do contrato exige validação em navegador real, e o ADR-09 exige monorepo com fronteiras de camada impostas por lint. A feature 001 não tem componentes nem stories: ela entrega a regra de lint que protege o núcleo de estilos, aplicada a ele quando existir (feature de componentes), e a pilha de testes que prova os tokens. Este ADR implementa o ADR-08 e o ADR-09 sem alterá-los e não modifica nenhum dos ADR-01 a ADR-10, portanto dispensa pedido de mudança (GOV-07). As forças em jogo são estas:

- O FR-022 precisa distinguir `var()` de primitivo de `var()` de semântico, e o FR-023 precisa saber se uma altura resolve, por alias, para a escala `size.control.<passo>`. Só a fonte de tokens sabe isso. Plugins existentes verificam "é variável", não "qual variável", e regex de nomes acoplaria o lint a uma convenção e a um prefixo ainda em aberto.
- FR-024 e SC-009 exigem exemplos que disparem 100% dos erros esperados com zero falsos positivos; o FR-001 exige busca automatizada comprovada por violação proposital.
- Princípio VII e QA-01 proíbem DOM simulado; FR-018 e QA-06 exigem app que consome o tarball; QA-02 exige teste unitário de toda lógica fora da UI; QA-08 exige testes de tipos com caso negativo e relatório de API.
- TOK-05 e SC-002 exigem saída idêntica byte a byte, e o cache de tarefas (ENG-03) pode servir o segundo build e mascarar a comparação.
- O TypeScript 7.0 (2026-07-08) não tem API programática até a 7.1, então ferramentas de teste de tipos baseadas nessa API não verificam o TS 7.
- A resolução real da árvore proposta (214 pacotes) mostrou licenças além de MIT e Apache-2.0 e um script de instalação (ENG-21, ENG-24).

## Decisão

**1. Regra `<prefixo>/design-tokens`.** Plugin ESM sobre stylelint 17.16.x no pacote privado `@<prefixo>/stylelint-plugin` (`tools/stylelint-plugin`), com `@csstools/css-tokenizer` e `@csstools/css-parser-algorithms` 4.x para valores e `postcss-selector-parser` 7.x para seletores. Os dados vêm de `dist/meta/tokens.manifest.json` (camada, categoria, eixo, papel, cadeia de alias e `scale: "control-height"`), lido de `@<prefixo>/tokens/meta/*` como devDependency. Um único ID de regra atende à exigência de "a mesma regra" do FR-023, com subcódigos estáveis; o formato exato fica em `specs/001-design-tokens-themes/contracts/lint-rules.md`.

| Código | Dispara quando |
| --- | --- |
| `primitive-token` | `var()` de token da camada primitiva |
| `brand-mode-source-token` | `var()` de token-fonte sob `brand.` (papel `brand-mode-source`, ADR-11 e ADR-13), que ignoraria o escopo de modo |
| `unknown-token` | `var()` de nome fora dos tokens semânticos públicos e de componente do manifesto, com ou sem prefixo, inclusive os toggles privados `_` |
| `literal-value` | Folha literal em propriedade governada |
| `var-fallback-literal` | Fallback literal em `var()`, como `var(--x, #fff)` |
| `token-definition` | Declaração de custom property, com qualquer nome, em CSS de componente |
| `control-height` | Altura de controle registrado que não resolve para a escala |
| `control-height-missing` | Controle ou variante de tamanho registrado sem altura da escala |
| `unclassified-component` | Arquivo de componente, ou seletor de classe ou de atributo `data-<prefixo>-*` dele, ausente do registro de controles |

- **Valor literal.** Um mapa versionado liga cada propriedade governada a uma categoria do TOK-10. Cada folha do valor deve ser `var()` de token permitido, palavra-chave da allowlist (`transparent`, `currentcolor`, `0`, `auto`, `none` e as palavras-chave globais do CSS) ou função matemática (`calc`, `min`, `max`, `clamp`) com folhas conformes; fator sem unidade é aceito dentro de `calc`. Hex, funções de cor, cores nomeadas, dimensões, tempos e números soltos falham. Como `var()` é inválido em `@media` e `@container`, dimensão nesses parâmetros também falha.
- **Altura de controle.** O registro lista, por controle, todo seletor que dimensiona a caixa: raiz, modificadores de tamanho e estado e variantes por atributo. `control-height` verifica `height`, `min-height`, `block-size` e `min-block-size` (`max-*` configurável) nas regras cujo composto mais à direita casa uma entrada do registro, por casamento exato de classe e com aninhamento resolvido; o valor deve ser `var()` de token cuja cadeia de alias chega a um membro da escala. `control-height-missing` exige essa declaração em todo controle e variante de tamanho registrados e aponta controle dimensionado só por `padding-block` ou `line-height`. Em produção, o registro é derivado do contrato de DOM (CMP-14) ou do arquivo de orientação; esta feature entrega só registros de fixture.
- **Fixtures (FR-024).** `valid/*.css` produz zero achados; em `invalid/*.css`, cada linha ofensora traz `/* expect: <código>@<coluna> */`, com a coluna obrigatória. O teste, em Vitest via `stylelint.lint()`, compara multiconjuntos de `{file, line, column, code}`, sem colapsar repetições. Todo código tem ao menos uma fixture inválida, há fixtures com nomes sem prefixo, e o manifesto das fixtures sai do build real sobre as marcas sintéticas A e B (QA-15).
- **Gate.** `pnpm lint:styles` usa configuração separada com `ignoreDisables: true`, `--max-warnings 0` e formatter JSON guardado como relatório de zero violações. Vale hoje para as fixtures e para o núcleo quando ele existir. O mesmo pacote hospeda a regra de pares `<prefixo>/contrast-pairs` do FR-021 (ADR-15), com o mesmo harness e o mesmo formato de achado.
- **Restrições registradas para a feature do núcleo.** `token-definition` proíbe remapear custom properties em variantes (ex.: `.<prefixo>-button--danger { --<prefixo>-…: … }`); a allowlist de palavras-chave é a leitura deste ADR para "valor literal" do TOK-03; breakpoint literal em `@media` falha até o núcleo adotar nomes `@custom-media` gerados dos tokens de breakpoint, decisão daquela feature.

```ts
// Resumo; as assinaturas completas ficam em specs/001-design-tokens-themes/contracts/lint-rules.md
interface LintFinding { file: string; line: number; column: number; code: DesignTokensCode | ContrastPairsCode; message: string }
interface DesignTokensOptions { manifestPath: string; controlRegistryPath: string; governedProperties?: GovernedPropertiesMap;
  controlHeightProperties?: readonly ('height' | 'min-height' | 'block-size' | 'min-block-size' | 'max-height' | 'max-block-size')[] }
interface ControlRegistryEntry { id: string; kind: 'control' | 'non-control'; file: string;
  classes: { root: readonly string[]; sizing: readonly string[]; other: readonly string[]; parts: readonly string[] } }
```

**2. Testes unitários.** Vitest 5.0.x com `@vitest/coverage-v8` na mesma versão, só em ambiente Node, para build, validadores, regras de lint, contraste, design-sync e scripts de CI (QA-02). Limiares de cobertura lidos de `quality/thresholds.json` (QA-03, QA-14). `pnpm test` inclui uma verificação que falha quando um módulo de lógica não tem arquivo de teste irmão. Os validadores (FR-002 a FR-008, FR-010, FR-011, FR-033) são testados por fixtures que conferem código de erro e caminho do token. Um teste de integração copia a fonte para um worktree temporário, adiciona a marca sintética C, executa o build e confere que `git diff --name-only` só toca a fonte e o relatório de API regenerado `packages/tokens/api/tokens.api.json` (FR-009, SC-005; leitura a confirmar com o aceitante, pendência P-03 de `contracts/esm-output.md`).

**3. Testes de tipos (`pnpm test:types`).** `@<prefixo>/types-consumer` (`tests/types-consumer`) instala o tarball e roda `tsc --noEmit` estrito com `moduleResolution` `bundler` e `nodenext`, em TS 6.0.x e 7.0.x (o eixo 7.0 usa só `tsc`, ADR-12). Positivos com `expect-type` 1.4 (tipos literais `var(--<prefixo>-…)`, `not.toBeAny`); negativos com `@ts-expect-error` para token inexistente em `.` e para token, marca e modo inexistentes em `./values`. Um `@ts-expect-error` que deixa de falhar vira erro TS2578, então negativo silencioso quebra o build. `publint` (0.3.x) e a allowlist de arquivos do ENG-17 confirmam ESM e `.d.ts` das duas entradas no tarball (FR-016).

**4. Navegador real (`pnpm test:e2e`).** `@playwright/test` 1.64.x contra `@<prefixo>/tokens-example` (`apps/tokens-example`, Vite 8 sem framework), construída só do tarball e servida por `vite preview` no `webServer`, na imagem `mcr.microsoft.com/playwright:v1.64.x-noble` fixada por digest, com rede externa bloqueada. A instalação faz `--frozen-lockfile` das dependências de terceiros, acrescenta o tarball com scripts desativados e confere que os arquivos instalados batem com ele. Valores esperados vêm de `@<prefixo>/tokens/values` do próprio tarball, nunca escritos à mão. Casos: sem atributos, escopo só de modo, escopo só de marca, A → B → A, valor de atributo inválido, troca em runtime sem navegação, marca C e nenhum token público sem valor; o CSS do `vite build` que importa `base.css` e só a marca A é analisado para ausência de seletor ou variável da marca B (FR-017). As amostras de contraste com axe (ADR-15) rodam na mesma app. Chromium em todo PR; todos os motores da lista à noite e antes de publicar (QA-12).

**5. Checks do repositório** em `@<prefixo>/repo-checks` (`tools/repo-checks`), só com `node:crypto`, `git ls-files` e `postcss` 8.5.x, cada um com fixtures de violação proposital. Saída 0 ok, 1 violação, 2 uso ou configuração, 3 erro interno; `--json` com schema estável e `arquivo:linha:coluna` quando aplicável (`contracts/tools-cli.md`).

| Comando | Decisão |
| --- | --- |
| `repo-checks determinism` (`pnpm check:determinism`) | Dois builds a partir de dois `git worktree` limpos, em caminhos, `TZ` e `LC_ALL` diferentes, sem cache de tarefas local ou remoto; empacota com `pnpm pack` (não `npm pack`, que não reescreve `workspace:` e `catalog:`); compara a lista ordenada de caminhos, o sha256 por arquivo e o dos tarballs, e mostra o primeiro arquivo divergente com diff. À noite, repete entre runners e entre Node piso e mais recente (ENG-08). |
| `repo-checks drift` (`pnpm check:drift`) | Saídas geradas ficam no `.gitignore`; falha se `git ls-files` listar caminho gerado ou arquivo com cabeçalho de gerado. `packages/tokens/api/tokens.api.json`, versionado de propósito, é regenerado e exige `git diff --exit-code` e `git status --porcelain` vazio (QA-08). |
| `repo-checks scan-tokens` (`pnpm check:scan`) | Varre `git ls-files` e sinaliza declaração de custom property com valor literal, com qualquer nome, em CSS (PostCSS), `<style>` e `style=` de SFC e HTML fora da fonte; chaves `--<prefixo>-` e `setProperty` em TS, JS e JSON; documento DTCG fora de `packages/tokens/src/`. Allowlist em `quality/scan-allowlist.json`, com justificativa por entrada; fixtures em CSS, SFC Vue, TSX e JSON detectadas em 100% (FR-001). |

O `turbo.json` declara que `lint:styles`, `contrast:check`, `test:types` e `test:e2e` dependem do build de `@<prefixo>/tokens`, para que `--affected` inclua lint e testes quando os tokens mudam (ENG-02). Plugin e scripts ficam na tag `tools`; as apps só recebem o tarball (ADR-12).

**6. Cadeia de suprimentos.** Toda dependência direta entra em versão exata no lockfile congelado (ENG-16), com idade maior ou igual ao `minimumReleaseAge` (o Vite 8.3.5 saiu em 2026-10-21, então entra o patch mais recente que cumpra a janela), sem depreciação (ENG-07) e com aprovação de dono (ENG-25). O conjunto transitivo de licenças da árvore escolhida, somado ao dos ADR-11 e ADR-15, define `quality/license-policy.json` (ENG-21), escrito pelo fornecedor e aprovado por dono no PR que o cria. Licença fora da política ou desconhecida falha o check.

| Licença | Origem conhecida | Condição na política |
| --- | --- | --- |
| MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause | Maior parte da árvore (stylelint, Vitest, Vite, Playwright, TypeScript, `expect-type`) | Permitida |
| MIT-0 | Três pacotes `@csstools/*`, via stylelint | Permitida |
| CC0-1.0 | `mdn-data`, via `css-tree`, via stylelint | Permitida |
| Python-2.0 | `argparse`, via `js-yaml` e `cosmiconfig`, via stylelint | Permitida |
| MPL-2.0 | `lightningcss` e seus pacotes de plataforma, via Vite 8; `axe-core` e `@axe-core/playwright` (ADR-15) | Só devDependency, sem modificação, nunca no tarball publicado |
| W3C Software and Document License | Cópia dos schemas DTCG em `packages/tokens/schemas/dtcg-2025.10/` | Entrada por arquivo; origem e licença em `LICENSE-W3C.md` e nos avisos de terceiros (ADR-11) |
| Sem campo SPDX (só o legado `licenses`) | `svg-tags` 1.0.0, via stylelint | Override revisado para MIT, preso à versão |

Allowlist do ENG-24 (`allowBuilds` do `pnpm-workspace.yaml`, ADR-12): `fsevents` agora (opcional do Vite 8, só darwin, `install: node-gyp rebuild`) e `esbuild` quando o Storybook entrar. As duas entradas podem manter a execução bloqueada; qualquer outro script de instalação falha o CI.

```json
{ "allow": ["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "MIT-0", "CC0-1.0", "Python-2.0"],
  "allowDevOnly": [{ "license": "MPL-2.0", "condition": "unmodified", "packages": ["lightningcss", "lightningcss-*", "axe-core", "@axe-core/playwright"] }],
  "overrides": [{ "package": "svg-tags@1.0.0", "license": "MIT", "reason": "campo legado licenses", "approvedBy": "<dono>" }],
  "files": [{ "path": "packages/tokens/schemas/dtcg-2025.10/", "license": "W3C Software and Document License" }] }
```

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| `stylelint-declaration-strict-value` 1.12.1 com regras nativas | Só verifica "é variável": não distingue primitivo de semântico, não resolve alias nem conhece controle; `ignoreFunctions` é tudo ou nada; não olha `@media`; puxa `es-abstract` via `regexp.escape` |
| Regras nativas com regex de nomes | Acopla o lint à convenção e ao prefixo em aberto; não verifica a escala por alias |
| `@primer/stylelint-config` 13.6.0, `stylelint-plugin-carbon-tokens` 5.0.6 | Presos aos tokens de cada projeto; o Carbon tem `postinstall` de telemetria (ENG-24); servem só de precedente |
| `stylelint-value-no-unknown-custom-properties` 6.1.1 | Redundante com `unknown-token`, que já usa o manifesto |
| `@eslint/css` 2.0.1 com ESLint 10; Biome 2.6 | ESLint CSS tem ecossistema e utilitários de teste menores; plugins JS do Biome estão em Developer Preview, com quebra possível em patch e sem API documentada de leitura de arquivo |
| Anotação por comentário para controles; altura verificada em todo componente | Comentário esquecido passa calado; verificar todo componente dá falso positivo em avatar e divisor |
| Vitest browser mode para a app de exemplo | Roda módulos no dev server em iframe, não a app construída do tarball (FR-018); fica para as stories |
| Jest 30; jsdom ou happy-dom | Jest exige transform para ESM e TS e seria segundo runner; DOM simulado é proibido pelo Princípio VII e pelo QA-01 |
| TSTyche 7.2.5, tsd 0.33.0, `@arethetypeswrong/cli` 0.18.5, `vitest --typecheck` | Os três primeiros dependem da API do TS (TS 7 só no TSTyche 8.0.0-beta.0; fork defasado no tsd; TS 5.6.1-rc fixo no attw); `--typecheck` só chama `tsc`, sem comportamento documentado no TS 7 |
| Vitest 4.1.x | Viável como recuo, mas forçaria migração logo após a Fase 1 |
| Vite 7 para evitar MPL-2.0 | Traz esbuild com `postinstall` (entrada no ENG-24 do mesmo jeito) e não elimina o MPL-2.0, que vem também do axe-core |
| CSS gerado versionado, conferido só por `git diff` | TOK-05 e o spec tratam o CSS de tokens como gerado; mantê-lo fora do git e checar ausência é mais estrito |
| diffoscope, Semgrep ou ast-grep | Binários extras; diffoscope é GPL-3.0 e o motor do Semgrep é LGPL |

## Consequências

**Positivas**: lint e build leem o mesmo manifesto, então não divergem; um ID de regra com subcódigos estáveis e prova por multiconjunto; testes de tipos válidos no TS 6 e no TS 7 sem depender de API; navegador real sobre o artefato publicado; checks do repositório sem binário extra; um só runner (Vitest), que o addon-vitest do Storybook também usa (`vitest ^4 || ^5`).

**Negativas**: plugin próprio para manter (mapa de propriedades, allowlist, registro); `token-definition` e a regra de `@media` restringem o núcleo; matriz mais larga (TS 6.0 e 7.0, Node piso e mais recente, motores à noite); política de licenças mais ampla que MIT e Apache-2.0; uma app de exemplo sem framework além das futuras apps React e Vue.

**Neutras**: a suíte de navegador pode migrar para as apps React e Vue quando existirem; TSTyche 8 ou relatório de API por API podem entrar na 7.1; `@custom-media` é decisão do núcleo.

## Requisitos atendidos

| ID | Como |
| --- | --- |
| ADR-08, QA-01 | Testes de tokens em navegador real, imagem fixada e sem rede; stories como testes chegam com os componentes, no mesmo runner |
| ADR-09, ENG-01, ENG-02 | Plugin e scripts na tag `tools`, manifesto como devDependency, apps só pelo tarball; dependência do manifesto no grafo de tarefas |
| TOK-03, FR-022, FR-024 | Seis subcódigos de token e literal, fixtures por multiconjunto, gate com `ignoreDisables` e relatório JSON; núcleo na feature de componentes |
| TOK-13, FR-023 | `control-height`, `control-height-missing` e `unclassified-component` sobre a cadeia de alias até `size.control.<passo>` |
| TOK-01, FR-001, SC-001 | `repo-checks scan-tokens` com nomes sem prefixo e allowlist justificada; `token-definition` como defesa em profundidade |
| TOK-05, FR-015, SC-002 | `repo-checks determinism` sem cache, comparando arquivos e tarballs; `repo-checks drift` |
| TOK-06, FR-016, QA-08 | Consumidor do tarball em TS 6.0 e 7.0, negativo por entrada e por eixo; `api/tokens.api.json` conferido por drift |
| TOK-07, TOK-14, FR-009, FR-012 a FR-014, FR-018, SC-007 | Casos de navegador real na app do tarball (TOK-14 no nível de CSS); marca C com diff restrito à fonte e ao relatório de API regenerado |
| ENG-06, FR-017, SC-006 | CSS construído só com a marca A analisado; token público sem valor verificado em runtime |
| QA-02, QA-03, QA-14 | Vitest em Node para toda lógica, verificação de teste irmão, limiares lidos do arquivo único |
| QA-06 | Parcial: a app sem framework cobre FR-017 e FR-018; apps React e Vue na feature de componentes |
| QA-12, ENG-08 | Chromium no PR, motores da lista à noite e antes de publicar; TS piso e recente; determinismo entre Node piso e mais recente |
| ENG-07, ENG-16, ENG-21, ENG-24, ENG-25 | Versões exatas, política com o conjunto transitivo real, `fsevents` na allowlist, aprovação de dono |
| FR-031, SC-009, QA-15 | Cada check é job obrigatório nomeado na matriz (ACE-02), com violação proposital e dados sintéticos |

## Riscos e mitigação

- **Vitest 5 jovem (5.0.0 em 2026-09-03).** Versão exata; a linha 4.1.x segue corrigida (4.1.12 em 2026-10-15) e o addon-vitest aceita as duas, então o recuo é barato.
- **TS 7.0 sem API.** Só diagnósticos de `tsc`; ponto de revisão na 7.1 estável (7.1.0-beta em 2026-10-20) para TSTyche 8, relatório de API e attw.
- **Plugin próprio e falso positivo** (ex.: `width: 100%` com governança larga demais). Mapa de propriedades versionado e harness por multiconjunto com cobertura por código.
- **Registro de controles à mão, em tensão com o Princípio I.** Só fixtures nesta feature; produção derivada do contrato de DOM ou do arquivo de orientação; `unclassified-component` pega omissões.
- **Tarball × lockfile congelado.** Terceiros instalam congelados, o tarball entra sem reescrever o lockfile, e a verificação de integridade prova que a app usou o tarball.
- **Imagem do Playwright diferente do pacote npm.** Os navegadores não são encontrados; os dois pinos mudam juntos no mesmo PR.
- **Serialização de custom property entre motores.** O gerador emite forma canônica (ADR-13) e o teste compara string exata; para cor, confere também a propriedade computada real (ADR-15).
- **Determinismo entre sistemas.** LF por `.gitattributes`, ordenação por code point e comparação noturna entre runners.
- **Falso positivo da varredura em TS e JS** (texto de documentação). Allowlist com justificativa e fixtures de autoteste.
- **MPL-2.0 na árvore.** Só devDependency sem modificação, fora do tarball, com check de licença e SBOM (ENG-19).

## Pendências com o requerente

Valem as premissas citadas até a decisão.

- Lista de navegadores e piso de TypeScript (ENG-08): TS 6.0 provisório; até a lista versionada existir, a matriz noturna usa Chromium, Firefox e WebKit do Playwright 1.64.x. A lista define motores e versões.
- Piso de Node (ENG-08): Node 22 LTS no determinismo noturno e na matriz; o Vitest 5 exige `^22.12.0 || ^24.0.0 || >=26.0.0`, compatível com a premissa.
- Limiares do QA-14: cobertura de `<N>`% de linhas e ramos por pacote (QA-03), valor pendente nas Premissas; o gate lê o arquivo.
- Leitura de "valor literal" do TOK-03 pela allowlist de palavras-chave: proposta deste ADR, a confirmar pelo aceitante no aceite da Fase 1.
- Prefixo (TODO(PREFIXO)) e marcas (CMP-24): `<prefixo>` no nome da regra, nos atributos e nas fixtures; marcas sintéticas A (padrão) e B, e C só no teste de marca nova.
- Plataforma de CI: GitHub Actions presumido (`.github/workflows/tokens-ci.yml`, actions e imagem fixadas por digest).

## Referências

- https://stylelint.io/developer-guide/plugins; https://stylelint.io/user-guide/options; https://stylelint.io/migration-guide/to-17; https://registry.npmjs.org/stylelint/17.16.0
- https://github.com/AndyOGo/stylelint-declaration-strict-value; https://registry.npmjs.org/stylelint-plugin-carbon-tokens; https://firefox-source-docs.mozilla.org/code-quality/lint/linters/stylelint-plugin-mozilla/rules/no-base-design-tokens.html; https://biomejs.dev/linter/plugins/
- https://developer.mozilla.org/en-US/docs/Web/CSS/var; https://lightningcss.dev/transpilation.html
- https://vitest.dev/blog/vitest-5; https://registry.npmjs.org/vitest/5.0.5; https://vitest.dev/guide/browser/; https://vitest.dev/guide/testing-types; https://www.npmjs.com/package/@storybook/addon-vitest
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/; https://registry.npmjs.org/typescript; https://registry.npmjs.org/@typescript/typescript6; https://www.npmjs.com/package/expect-type; https://www.npmjs.com/package/publint; https://github.com/tstyche/tstyche/releases; https://www.npmjs.com/package/@arethetypeswrong/core
- https://playwright.dev/docs/docker; https://playwright.dev/docs/test-webserver; https://mcr.microsoft.com/v2/playwright/tags/list
- https://registry.npmjs.org/vite; https://www.npmjs.com/package/lightningcss; https://registry.npmjs.org/fsevents/2.3.3; https://registry.npmjs.org/svg-tags; https://registry.npmjs.org/argparse; https://registry.npmjs.org/mdn-data; https://registry.npmjs.org/axe-core; https://registry.npmjs.org/storybook; https://esbuild.github.io/getting-started/
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
- [research.md](../../specs/001-design-tokens-themes/research.md) (D6), [research/lint-test.md](../../specs/001-design-tokens-themes/research/lint-test.md), [research/color-contrast.md](../../specs/001-design-tokens-themes/research/color-contrast.md) e [spec.md](../../specs/001-design-tokens-themes/spec.md)
