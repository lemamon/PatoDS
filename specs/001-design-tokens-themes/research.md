# Research: Design tokens e temas (Phase 0)

**Feature**: [spec.md](spec.md) | **Data**: 2026-10-21

Método: seis tópicos pesquisados na web por agentes independentes, cada resultado reverificado por
um revisor cético (versões, suporte de navegador, licenças, aderência ao spec, à constituição e aos
requisitos). Os seis voltaram com correções, todas incorporadas abaixo. Versões citadas foram
conferidas no registro npm e nas fontes oficiais em 2026-10-21.

Regras transversais adotadas em todas as decisões:

- Versões exatas no lockfile congelado (ENG-16); todo pino tem idade maior ou igual ao
  `minimumReleaseAge` do pnpm (1440 min), registrado no repositório (D2).
- Nenhuma dependência nova sem licença revisada na política versionada do ENG-21, sem script de
  instalação fora da allowlist do ENG-24 e sem aprovação de dono (ENG-25).
- Nenhuma decisão em aberto do requerente é decidida aqui: ferramenta de design, marcas, prefixo,
  TOK-12, lista de navegadores e pisos de versão seguem as premissas vigentes (seção "Perguntas ao
  requerente").

## D1. Pipeline de build de tokens

**Decisão**: `@terrazzo/parser` e `@terrazzo/token-tools` (subpath `/css`) usados só como
biblioteca, todos os `@terrazzo/*` na mesma versão exata via `overrides` do pnpm (hoje 2.9.0; a
2.10.0 saiu em 2026-10-21 e ainda não cumpre a janela mínima). Validação de schema com `ajv` (versão
exata) contra cópias versionadas, com sha256, de `format.json` e `resolver.json` do DTCG 2025.10.
Regras e formatadores do PatoDS num pacote privado `tools/tokens-build`, que roda depois de
`parse()` sobre **todas** as permutações marca × modo (`resolver.listPermutations()` +
`resolver.apply()`), com falha se a lista vier indefinida. Writer determinístico próprio: ordenação
por code point, LF, sem timestamp nem caminho absoluto.

**Motivo**:

- DTCG 2025.10 (Final Community Group Report de 2025-10-28) é a primeira versão estável, com os
  módulos Format, Color e Resolver; não há versão estável posterior. O Resolver modela marca e modo
  como modificadores ortogonais, sem duplicar arquivos (FR-009, FR-010).
- Terrazzo 2.x é o único parser JS maduro com suporte completo ao 2025.10, incluindo Resolver,
  `$extends`, `$root` e `$ref`; licença MIT; dependências leves, sem scripts de instalação.
- Os requisitos do PatoDS (três camadas e direção de alias, segmentos em ordem fixa, paridade de
  chaves, arquivo por marca, escopos aninhados, manifestos para lint e contraste, relatório) não
  existem em nenhuma ferramenta; seriam escritos de qualquer jeito. Como funções puras sobre um
  modelo interno, cada regra tem teste unitário (QA-02).
- Achado do revisor: o hook `lint` do Terrazzo só vê a permutação padrão, não recebe o resolver e,
  em modo resolver, perde a origem por arquivo. Por isso as regras rodam no adaptador próprio, com
  índice id → arquivo → linha → camada montado na leitura do Ajv.

**Salvaguardas**:

- `parse()` recebe um `req` próprio que rejeita `$ref` não `file:` (o padrão faz `fetch()`).
- A test-suite oficial do DTCG 2025.10 (`design-tokens/community-group/test-suite`) e saídas de
  ouro são portão a cada upgrade do Terrazzo.
- O Terrazzo remove `.$root` dos ids e só aceita `$extends` em string: a convenção proíbe `$root` e
  aceita `$extends` só com chaves; fixtures cobrem os dois casos.
- Schemas DTCG estão sob a W3C Software and Document License: origem e licença entram nos avisos de
  terceiros e na política do ENG-21.
- Sets compartilhados não carregam valores semânticos, para que a paridade (FR-011) não seja
  mascarada por herança de um set base.
- Determinismo comparado entre dois builds e entre o Node piso e o mais recente da matriz (ENG-08),
  porque o Terrazzo ordena com collator dependente de ICU.

**Alternativas rejeitadas**:

- Style Dictionary 5.7.0: suporte ao 2025.10 incompleto (issue #1590 aberta; sem Resolver, sem
  `$extends`/`$ref`). Fica como troca via adaptador quando o Resolver sair.
- Terrazzo completo (CLI + plugins): o `plugin-css` exige `@terrazzo/cli` como peer, que traz vite,
  vite-node, chokidar, escodegen e prompts; o `plugin-js` gera runtime `resolver.apply()` em vez de
  mapa estático (ENG-04).
- Compilador 100% próprio: reimplementaria a parte mais sensível do spec DTCG sem ganho.
- Style Dictionary + sd-transforms: acoplado ao formato do Tokens Studio (ferramenta em aberto).

**Riscos**: bus factor do Terrazzo (um publicador no npm) e cadência rápida de releases. Mitigação:
adaptador fino, versão exata, saídas de ouro, test-suite oficial, MIT (fork viável).

**ADR**: [ADR-11](../../docs/adr/ADR-11-pipeline-build-tokens.md).

## D2. Monorepo: gerenciador de pacotes, orquestrador e toolchain

**Decisão**:

- pnpm 11.28.x em versão exata (`packageManager`, `devEngines.packageManager` com
  `pmOnFail: error`), instalado por action fixada por SHA. `strictDepBuilds` + mapa `allowBuilds`
  (allowlist do ENG-24), `--frozen-lockfile` (ENG-16), `catalog` com `catalogMode: strict`,
  `minimumReleaseAge: 1440`, `blockExoticSubdeps`, `trustPolicy: no-downgrade`.
- Turborepo 2.11.x em versão exata (respeitando a janela mínima), `--affected` com
  `TURBO_SCM_BASE`, `globalDependencies` + passo de escopo para execução completa (ENG-02),
  `envMode: strict`, telemetria desligada.
- ENG-01 em três checks obrigatórios: (a) `turbo boundaries` para as regras de tag sobre o grafo de
  pacotes; (b) regras de import no ESLint que cobrem `.vue` via vue-eslint-parser
  (`turbo boundaries` ignora `.vue`, `.mts` e `.cts`); (c) check de manifesto pnpm que falha com
  pacote de UI no fechamento `--prod` de uma ferramenta, com pacote sem exatamente uma tag de camada
  e com `@boundaries-ignore` fora do registro de exceções. Esta feature entrega (a) e (c) com
  fixtures em `.ts` para as camadas que cria; (b) e as fixtures em `.vue` chegam com a feature de CI
  e governança, quando existir código Vue (o aceite do ENG-01 não é reivindicado aqui).
- Toolchain do repositório: Node 24.x LTS (`.node-version`) e TypeScript 6.0.x como compilador único
  de emissão. Piso de `engines` e da matriz ENG-08 conforme a premissa vigente ("Node em LTS"):
  Node 22 LTS; "mais recente": Node 26 LTS a partir de 2026-10-28. TS 6.0 é valor provisório do
  `<versão>` da premissa; o eixo TS 7.0 roda só `tsc` (vue-tsc fica no 6.0 até a API da 7.1).

**Motivo**: pnpm 11 traz pronto o conjunto de supply chain que ENG-16, ENG-19 (`pnpm sbom`),
ENG-21 (`pnpm licenses`) e ENG-24 exigem; o pnpm 12 (reescrita em Rust, GA em 2026-08-26) ainda
estabiliza e seu pacote npm tem `preinstall`/`postinstall`. Turborepo dá execução só do afetado e
um protocolo de cache remoto aberto (OpenAPI), que permite servidor próprio com escrita restrita.

**Cache remoto (ENG-03)**: desenho registrado no ADR, implementação na feature de CI. Servidor
auto-hospedado ducktors/turborepo-remote-cache (MIT, imagem fixada por digest) com `AUTH_MODE=jwt`
sobre OIDC do GitHub: leitura para o repositório, escrita só para o `job_workflow_ref` do workflow
da branch protegida, `JWT_AUDIENCE` dedicada, claims imutáveis (`repository_id`). Um sidecar local
renova o token a cada requisição (tokens OIDC duram cerca de 5 min). Teste recorrente: PUT a partir
de PR recebe 403. Plano B: instâncias READ_ONLY e de escrita separadas, ou servidor mínimo que
responde 409 para chave existente.

**Alternativas rejeitadas**: Nx 23 (cache auto-hospedado depreciado pelo CVE-2025-36852; pacote com
postinstall; caminho recomendado é SaaS proprietário); pnpm 12 (maturidade e scripts de
instalação); pnpm sozinho (sem cache de tarefas no 11; sem fronteiras); moon 2 (cache remoto
instável, autenticação por segredo fixo); Rush (envolve o pnpm, sem lint de fronteiras); Vercel
Remote Cache (OIDC sem distinção leitura/escrita no servidor); npm ou Yarn workspaces (sem o
conjunto de supply chain nativo).

**Riscos**: `turbo boundaries` é experimental (mitigado pelos checks b e c); maturidade e bus factor
do servidor de cache (plano B registrado); pnpm 11 pode sair de manutenção (migração barata).

**ADR**: [ADR-12](../../docs/adr/ADR-12-monorepo-toolchain.md).

## D3. Estratégia CSS de escopos de marca e modo

**Decisão**: CSS puro, sem dependência nova, tudo em `@layer <prefixo>.tokens`, com toggles de
espaço (space toggles). Arquivos distribuídos:

- `base.css`, neutro de marca: declaração da ordem das camadas, primitivos compartilhados em
  `:where(:root)`, toggles de modo privados (`--<prefixo>-_on-light` e `--<prefixo>-_on-dark`, com
  valor literal `initial` ou vazio) com padrão claro em `:where(:root)` e regras
  `[data-<prefixo>-mode="light"|"dark"]` (que também definem `color-scheme`), e o bloco resolvedor
  `:where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode])`, que redeclara todo token público
  semântico de eixo modo ou invariante e todo token de componente.
- `brand-<id>.css`, um por marca: só seletores `[data-<prefixo>-brand="<id>"]` com os tokens de
  eixo marca e os primitivos exclusivos dessa marca; só o arquivo da marca padrão acrescenta
  `:where(:root)` ao seletor.

Token de eixo modo no resolvedor, sem espaço entre os toggles:
`var(--<prefixo>-_on-light, <valor claro>)var(--<prefixo>-_on-dark, <valor escuro>)`.

**Motivo**:

- O valor computado de uma custom property é o valor especificado com `var()` substituído, e é ele
  que herda (css-variables-1). Tokens de marca vêm do escopo de marca mais próximo; toggles vêm do
  escopo de modo mais próximo; o resolvedor recalcula em todo elemento que é escopo de qualquer eixo.
  Resultado: para cada eixo vale o escopo mais próximo (FR-012), e "cada escopo redeclara os tokens
  semânticos" (TOK-14) vale literalmente.
- Valor inválido (`data-<prefixo>-brand="zzz"`, vazio, modo "sepia", marca não importada) casa só o
  resolvedor, que recalcula com as entradas herdadas: mantém o ancestral (FR-014).
- Funciona para qualquer tipo de token (cor, sombra com várias camadas, opacidade, dimensão).
- Só exige o que o ADR-03 já exige (`@layer`). Prova: harness em Chromium 156, Firefox 157 e WebKit
  26.4, 6 configurações de importação × 3 sementes, cerca de 2.500 checagens por passada com mutações
  aleatórias em runtime, zero falhas com comparação exata de strings.
- Separar `base.css` dos arquivos de marca cumpre a leitura literal do ENG-06 ("só seletores dessa
  marca") e dispensa regra de modo padrão por marca: o padrão claro vem de `:root` no `base.css`.

**Salvaguardas**: escrever sempre o literal `initial` (bug WebKit 243247 com indireção por `var()`);
lint do CSS gerado garante forma sem espaço, literal `initial` e que todo alvo de `var()` é
declarado; todo token público semântico ou de componente é declarado só no resolvedor ou no escopo
de marca, nunca fora (evita valor congelado em escopo aninhado), e primitivos, invariantes por
definição, ficam em `:where(:root)` do `base.css` ou no escopo da marca que os usa com
exclusividade; o segmento privado `_` fica fora do ESM, do `.d.ts`, do
contrato de DOM e do relatório de API.

**Definições operacionais** (incorporadas ao spec, ver "Ajustes ao spec"): "variável sem valor" é
token público `--<prefixo>-*` (sem o segmento privado `_`) vazio ou garantidamente inválido; os
toggles privados são, por desenho, vazios ou `initial`.

**Alternativas rejeitadas**: `light-dark()` + `color-scheme` (só cores e imagens; prende o eixo modo
a uma propriedade que apps e widgets também definem); container style queries (o elemento avalia o
container ancestral, então o próprio escopo não recebe seus valores; falhou no harness); `@scope`
com proximidade (correto, mas Baseline só desde 2026-03-24 e saída 1,4 a 2,1 vezes maior; anteciparia
a decisão da lista de navegadores); combinações enumeradas de seletores (descendente casa qualquer
ancestral, não o mais próximo; centenas de falhas no harness); `if()` (só Chromium 137+; fica como
alvo futuro sem mudar a API); provedor JS ou CSS-in-JS (quebra SSR sem JS e o ADR-03).

**Riscos e documentação**: override em elemento que não é escopo não atualiza aliases de componente
(documentar: override no elemento de escopo, fora de camada); portais precisam dos dois atributos
resolvidos da origem (feature de componentes, CMP-21); tamanho de cerca de 5,6 KB gzip por marca
com 350 tokens sintéticos, a medir contra o orçamento do QA-07.

**ADR**: [ADR-13](../../docs/adr/ADR-13-escopos-marca-modo-css.md).

## D4. Sincronização com a ferramenta de design

**Decisão**: pacote privado `tools/design-sync`, sem dependência de runtime (só `fetch`, `crypto`,
`fs` e `util.parseArgs` do Node), em portas e adaptadores:

- Núcleo puro e determinístico: estado desejado lido do `sync-manifest.json` gerado pelo build de
  tokens; topologia; diff e plano; log em JSON canônico com envelope separado para timestamp e URL
  da execução; classificação de divergência contra a versão anterior e a atual; impressões digitais
  de divergência.
- Portas `DesignToolPort`, `TrackerPort` e `AlertPort`, **sem nenhuma operação que leia da
  ferramenta para o repositório** (garante FR-025 e o cenário 6 da US6 por construção).
- `InMemoryDesignTool` com injeção de falhas e suíte de contrato compartilhada, que roda contra o
  fake em todo PR e contra o adaptador real num arquivo sandbox à noite.
- Topologia na ferramenta: coleção ou grupo de tema por eixo (Primitivos sem modos; Marca com modos
  = marcas; Modo com modos claro/escuro; Semânticos invariantes e Componentes sem modos). **Zero
  variáveis auxiliares**: toda variação marca × modo é expressa na fonte como token de eixo modo que
  aponta para tokens de eixo marca com as mesmas chaves (FR-033), então toda variável da ferramenta
  corresponde a um token real (DSN-04).
- Gatilhos: depois da promoção à tag principal, cron semanal e `workflow_dispatch` (até o ENG-26
  existir), num mesmo grupo de concorrência.
- Tracker e alerta: adaptadores GitHub com token de instalação de GitHub App de curta duração
  (Issues:write, org Members:read), porque o `GITHUB_TOKEN` não notifica times. A chave privada da
  App entra no inventário do ENG-13 como segredo fixo justificado.
- O adaptador da ferramenta real só é escrito depois da decisão do requerente.

**Restrições registradas por ferramenta** (para a decisão do requerente, sem escolher):

- Figma: REST de variáveis (GET e POST) só no plano Enterprise, com assento Full e escopo
  `file_variables:write`; POST atômico, corpo até 4 MB, até 40 modos e 5.000 variáveis por coleção;
  sem endpoint de publicação de biblioteca (publicação manual, vira item rastreável); limites de
  modos: Professional 10, Organization 20; coleções estendidas acoplam marca e modo (não usar como
  topologia padrão). Em Professional e Organization, o caminho de escrita seria o servidor MCP remoto
  (`use_figma`, beta, OAuth atrelado a usuário, sem uso em CI documentado): candidato não comprovado,
  exige spike. Credenciais: PAT até 90 dias, token de plano até 1 ano (não escreve variáveis).
- Penpot: MPL-2.0, auto-hospedável, tokens DTCG nativos; ativação de tema vale para o arquivo
  inteiro (sem escopo por quadro em 2026-07), o que não atende o DSN-05 por quadro; sem API headless
  documentada para tokens.
- Tokens Studio: temas e Git sync pagos; exportação manual; modos acima do limite são ignorados em
  silêncio; o plugin pode empurrar para Git (exigiria bloqueio para respeitar o DSN-01).
- Nenhuma ferramenta oferece credencial federada: a credencial da ferramenta é segredo fixo com a
  justificativa do ENG-13, dono (papel dono da sincronização), escopo e prazo de rotação.

**Alternativas rejeitadas**: Tokens Studio como mecanismo (manual, pago, bidirecional); script só
Figma derivado do exemplo oficial (presume a ferramenta, importa para o repositório, não remove
variáveis); plataforma SaaS intermediária (quarta fonte de fatos, contra o Princípio I e o ADR-02);
coleções estendidas do Figma; coleção única com modos marca × modo (não são eixos independentes e
estoura o limite de modos); importação DTCG manual; sincronização bidirecional (contra a premissa).

**ADR**: [ADR-14](../../docs/adr/ADR-14-sincronizacao-ferramenta-design.md).

## D5. Motor de cor e checagem de contraste

**Decisão**: `colorjs.io` 0.7.1 (MIT, sem dependências) em versão exata, envolto num pacote folha
`tools/color` sem dependências do workspace. O formatador de CSS e o checker de contraste chamam a
mesma função `toEmittedSrgb()`.

- Componentes DTCG são a fonte de verdade: emite-se a quantização de 8 bits dos componentes mapeados
  para sRGB pelo algoritmo do CSS Color 4 (método `css`, deltaEOK JND 0,02, sempre passado
  explicitamente). Um `hex` informado que divirja dos componentes, para cor dentro do gamut, falha a
  validação.
- Uma única serialização de alfa (`rgb(r g b / a)` com casas decimais fixas); o checker compõe com o
  alfa lido de volta dessa string, de modo que o medido é o emitido.
- Módulo WCAG 2.2 próprio: limiar 0,04045, coeficientes 0,2126/0,7152/0,0722, razão sem
  arredondamento, aprovação com ≥ mínimo.
- Composição source-over em sRGB codificado em gama sobre uma pilha de fundo que termina em
  superfície opaca, ou num conjunto nomeado de superfícies, expandido em um caso por superfície.
  Calcula-se a razão em ponto flutuante e numa variante que arredonda para 8 bits a cada dobra
  (como o axe-core); vale o menor dos dois.
- Pares de estado inativo ou desabilitado ficam no manifesto e na checagem de cobertura, com
  `exempt: "wcag-inactive"`: medidos e reportados, sem falhar o build (isenção do WCAG 2.2 AA,
  premissa do A11Y-01). Indicador de foco que atravessa a borda do componente usa grupo "any-of"
  (basta um lado atingir 3:1, conforme Understanding 1.4.11).
- Mínimos lidos do arquivo de limiares do QA-14 por nível (`WCAG22-AA`: texto 4,5; não texto 3).
- FR-021: regra Stylelint própria que agrupa declarações por sujeito e estado e exige anotação de
  fundo quando ele não está no mesmo sujeito; expressões não resolvíveis são erro. Respaldo em
  navegador real: amostras de cada par renderizadas do tarball, `getComputedStyle` igual ao sRGB
  emitido, mais axe (que exige pintar a pilha opaca em ancestrais reais).

**Alternativas rejeitadas**: culori 4.0.2 (sem release há 16 meses; segundo motor ao lado do
Terrazzo); @texel/color (sem Lab, LCH, HSL, HWB; gamut não CSS Color 4); chroma-js (sem vários
espaços DTCG); color, tinycolor2, wcag-contrast (só sRGB); @csstools/css-color-parser (analisa
strings CSS, não objetos DTCG; MIT-0 exigiria entrada na política); APCA (não é a métrica do WCAG
2.2; licença restrita); regra `a11y/min-contrast` do Terrazzo ou `contrastWCAG21` (sem composição
alfa, sem iterar permutações, luminância por matriz XYZ); compor em luz linear (diverge do que o
navegador mostra).

**ADR**: [ADR-15](../../docs/adr/ADR-15-cor-e-contraste.md).

## D6. Lint de estilos e pilha de testes

**Decisão (lint)**: uma regra Stylelint própria, `<prefixo>/design-tokens`, plugin ESM sobre
stylelint 17.16.x, com `@csstools/css-tokenizer` e `@csstools/css-parser-algorithms` 4.x e
`postcss-selector-parser` 7.x, guiada pelo manifesto de tokens do build. Subcódigos estáveis:
`primitive-token`, `brand-mode-source-token`, `unknown-token` (qualquer `var()` fora dos tokens
semânticos e de componente do manifesto, com ou sem prefixo), `literal-value`,
`var-fallback-literal`, `token-definition` (toda declaração de custom property em CSS de componente
é governada), `control-height`, `control-height-missing` e `unclassified-component`.

- Controles interativos vêm de um registro de seletores que dimensionam o controle (raiz,
  modificadores de tamanho e estado, variantes por atributo). Em produção o registro é derivado do
  contrato de DOM (CMP-14) ou do arquivo de orientação; esta feature entrega só registros de fixture.
- Fixtures comparam multiconjuntos de {arquivo, linha, coluna, código}: 100% dos erros esperados e
  zero falsos positivos, e todo código tem ao menos uma fixture inválida.
- Gate com `ignoreDisables`, `--max-warnings 0` e relatório JSON.
- Restrições registradas para a feature do núcleo: proibição de remapear custom properties em
  variantes e allowlist de palavras-chave (`transparent`, `currentcolor`, `0`, `auto`, `none` e
  palavras-chave globais do CSS) como leitura de "valor literal" do TOK-03.

**Decisão (testes)**:

- Unidade: Vitest 5.0.x com coverage-v8, só ambiente Node (QA-02); script que falha quando um módulo
  de lógica não tem arquivo de teste.
- Tipos: projeto consumidor que instala o tarball, `tsc --noEmit` estrito com `moduleResolution`
  `bundler` e `nodenext`, em TS 6.0.x e 7.0.x, `expect-type` 1.4 para casos positivos e
  `@ts-expect-error` para negativos (nome de token, marca e modo inexistentes); `publint` no tarball.
- Navegador real: `@playwright/test` 1.64.x contra uma app de exemplo Vite 8 sem framework,
  construída só a partir do tarball, servida por `vite preview`, na imagem
  `mcr.microsoft.com/playwright:v1.64.x-noble` fixada por digest, sem rede externa. Valores esperados
  vêm do mapa de valores do tarball, nunca escritos à mão. Chromium em todo PR; todos os motores da
  lista à noite e antes de publicar.
- Determinismo: dois builds a partir de dois `git worktree` limpos, em caminhos, `TZ` e `LC_ALL`
  diferentes, sem cache de tarefas, empacotando com `pnpm pack`; compara sha256 por arquivo e dos
  tarballs; repetição noturna entre runners e entre Node piso e mais recente.
- Drift: saídas geradas ficam no `.gitignore`; o check falha se `git ls-files` listar arquivo
  gerado; artefatos versionados de propósito (relatório de API de tokens) são regenerados e exigem
  `git diff --exit-code`.
- Varredura do FR-001: arquivos de `git ls-files`; sinaliza declaração de custom property com valor
  literal, com qualquer nome, em CSS, `<style>` de SFC e HTML fora da fonte de tokens, chaves
  `--<prefixo>-` e `setProperty` em TS/JS/JSON e documentos DTCG fora da fonte; allowlist versionada
  com justificativa; fixtures de autoteste.

**Licenças da árvore transitiva** (para a política do ENG-21, escrita pelo fornecedor com aprovação
de dono): MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, MIT-0, CC0-1.0 e Python-2.0 (via
stylelint), MPL-2.0 só como dependência de desenvolvimento não modificada (lightningcss via Vite 8;
axe-core) e W3C Software and Document License (cópia dos schemas DTCG). `svg-tags` declara MIT só
pelo campo legado `licenses` e precisa de override revisado. Allowlist do ENG-24: `fsevents`
(opcional, darwin) agora; `esbuild` quando o Storybook entrar.

**Alternativas rejeitadas**: stylelint-declaration-strict-value (não distingue `var()` primitivo de
semântico); regras nativas com regex de nomes (acopla à convenção ainda aberta); plugins Primer ou
Carbon (presos aos tokens deles; Carbon tem postinstall de telemetria); @eslint/css (ecossistema
menor); Biome (plugins JS em preview instável); anotação por comentário para controles (falso
negativo silencioso); Vitest browser mode para a app de exemplo (não testa app construída do
tarball); Jest 30; jsdom ou happy-dom (proibidos pelo Princípio VII); TSTyche 7 e tsd (dependem da
API do TS ou de fork defasado); arethetypeswrong (fixa TS 5.6 internamente); diffoscope e Semgrep
(GPL/LGPL e binários extras).

**ADR**: [ADR-16](../../docs/adr/ADR-16-lint-tokens-e-testes.md).

## D7. Modelo da fonte de tokens (consolidação de D1, D3 e D4)

**Decisão**:

- Um arquivo `packages/tokens/src/tokens.resolver.json` (DTCG Resolver 2025.10) com dois
  modificadores ortogonais,
  `brand` (contextos = marcas) e `mode` (`light`, `dark`), e sets por camada.
- Camada por diretório da fonte (`primitive/`, `semantic/`, `component/`), registrada no índice do
  adaptador. Só a camada primitiva tem literal.
- Eixo de variação de cada token semântico: invariante, eixo marca ou eixo modo. Variação nos dois
  eixos é proibida num único token: expressa-se como token de eixo modo cujo valor em cada modo é
  alias para um token-fonte de eixo marca com as mesmas chaves em toda marca (sufixo de modo
  reservado no nome). Isso dá, ao mesmo tempo, a forma de toggles do CSS (D3) e coleções ortogonais
  sem variáveis auxiliares na ferramenta (D4).
- Tokens-fonte de eixo marca com sufixo de modo não são consumíveis por estilos de componente (lint
  `brand-mode-source-token`), porque ignorariam o escopo de modo.
- Primitivos são invariantes. Os referenciados por mais de uma marca, ou por tokens fora do eixo
  marca, vão para o `base.css`; os exclusivos de uma marca vão para o arquivo dessa marca (ENG-06).
- Sets compartilhados (primitivos, invariantes, componentes) não têm valores de eixo marca ou modo;
  a paridade (FR-011) roda por contexto e por permutação resolvida.

**Motivo**: é a única forma, entre as estudadas, que atende juntos FR-011, FR-012, FR-017, DSN-04 e
DSN-05 sem exceção autodeclarada.

## D8. Decisões de fechamento do design (Phase 1)

- **Ordem das camadas**: fonte única em `packages/tokens/src/layers.json`, mantida pela camada mais
  baixa; o núcleo acrescenta as suas camadas no mesmo arquivo (MIG-14).
- **Tipos compostos**: só tokens com um valor CSS único são publicáveis. `typography` composto e
  `strokeStyle` em objeto são rejeitados no build; a categoria `typography` usa tokens atômicos.
  Motivo: um token, uma custom property e uma string no mapa de valores (correspondência um para um
  com CSS, ESM e ferramenta de design).
- **Relatório de API e diff de nova marca**: o TOK-07 exige que adicionar uma marca altere "apenas
  arquivos de tokens". O relatório de API de tokens (`api/tokens.api.json`), derivado e versionado
  por exigência do QA-08, é arquivo de tokens; a checagem de diff aceita a fonte e esse relatório
  regenerado e rejeita qualquer outro arquivo (spec, Clarifications).
- **Formato dos manifestos**: dono único em
  [contracts/build-manifests.md](contracts/build-manifests.md).

## Ajustes ao spec decorrentes da pesquisa

Registrados em [spec.md](spec.md), seção Clarifications, sessão 2026-10-21:

1. FR-013, FR-014, FR-017 e SC-006: distribuição em `base.css` neutro mais um arquivo por marca;
   definição operacional de "variável sem valor" (tokens públicos; toggles privados excluídos).
2. FR-020: isenção de pares de estado inativo (`exempt: "wcag-inactive"`, medidos e reportados) e
   grupos "any-of" para indicador de foco que atravessa a borda, ambos derivados do nível WCAG 2.2 AA
   da premissa (A11Y-01).
3. Novo FR-033: forma obrigatória da variação marca × modo (D7), que sustenta FR-011, FR-012, DSN-04
   e DSN-05.
4. FR-009, SC-005 e cenário 1 da US3: "apenas arquivos de tokens" (fonte e relatório de API
   regenerado), como no TOK-07 (D8).

## Perguntas ao requerente

Decisões que só o requerente pode tomar. Até a resposta, valem as premissas indicadas.

| Tema | Premissa usada no plano | Impacto |
| --- | --- | --- |
| Lista de navegadores e piso de TypeScript (ENG-08) | Mecanismo CSS exige só `@layer` (já exigido pelo ADR-03); TS 6.0 provisório | Saída de cor e motores dos testes noturnos |
| Piso de Node (ENG-08) | Node 22 LTS (premissa vigente); proposta: subir para 24 (EOL do 22 em 2027-04-30) | `engines` e matriz; subir depois força major |
| Plataforma de repositório e CI | GitHub e GitHub Actions (inferido do ENG-18) e plano com environments | OIDC, cache, tracker, alertas |
| Hospedagem do cache remoto (ENG-03) | Conta e região a indicar (feature de CI) | Prova do ENG-03 |
| Ferramenta de design, plano e conta de serviço (DSN-01) | Nenhuma escolhida; adaptador fake | Figma exige Enterprise para escrita automática por REST; publicação de biblioteca manual |
| Credencial fixa da ferramenta (ENG-13) | Aceita com justificativa, dono e rotação | Nenhuma ferramenta oferece federação |
| Interpretação de aceite do ENG-06 | "Variável sem valor" = token público; toggles privados excluídos | Evidência do aceite da Fase 1 |
| Paletas em cor de gamut amplo | Mapeamento determinístico para sRGB | Aparência das marcas |
| Marcas, valores, marca padrão, prefixo, TOK-12 | Já pendentes no spec | Conteúdo da fonte e nomes |

## Fontes principais

- DTCG 2025.10: https://www.designtokens.org/tr/2025.10/ (Format, Color, Resolver) e
  https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- Terrazzo: https://terrazzo.app/docs/reference/js-api/ e código do `@terrazzo/parser` 2.10.0 em
  https://unpkg.com/@terrazzo/parser@2.10.0/dist/
- Style Dictionary #1590: https://github.com/style-dictionary/style-dictionary/issues/1590
- pnpm 11: https://github.com/pnpm/pnpm/releases/tag/v11.0.0 e https://pnpm.io/supply-chain-security
- Turborepo: https://turborepo.dev/docs/reference/boundaries e
  https://turborepo.dev/docs/core-concepts/remote-caching
- Nx CVE-2025-36852: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages
- Node release schedule: https://github.com/nodejs/Release
- TypeScript 7.0: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- css-variables-1: https://drafts.csswg.org/css-variables-1/; space toggle:
  https://lea.verou.me/blog/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property/;
  WebKit 243247: https://bugs.webkit.org/show_bug.cgi?id=243247
- Baseline: https://web-platform-dx.github.io/web-features-explorer/ (cascade-layers, scope,
  container-style-queries, light-dark, if)
- Figma Variables REST: https://developers.figma.com/docs/rest-api/variables/; MCP write:
  https://developers.figma.com/docs/figma-mcp-server/write-to-canvas
- Penpot tokens: https://help.penpot.app/user-guide/design-tokens/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ e Understanding 1.4.3 e 1.4.11
- colorjs.io: https://colorjs.io/docs/gamut-mapping; axe-core color:
  https://github.com/dequelabs/axe-core/tree/develop/lib/commons/color
- Stylelint 17: https://stylelint.io/developer-guide/plugins; Vitest 5:
  https://vitest.dev/blog/vitest-5; Playwright Docker: https://playwright.dev/docs/docker

Relatórios completos de cada tópico, com todas as fontes e a reverificação do revisor cético:
[research/](research/) (um arquivo por tópico).
