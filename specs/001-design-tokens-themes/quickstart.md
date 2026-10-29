# Quickstart: Design tokens e temas

**Feature**: [spec.md](spec.md) | **Plano**: [plan.md](plan.md) | **Pesquisa**: [research.md](research.md) |
**Modelo de dados**: [data-model.md](data-model.md) | **Contratos**: [contracts/](contracts/) | **Data**: 2026-10-21

Guia de validação da feature 001. Ele mostra como preparar o ambiente e como comprovar, por user
story, que a implementação atende ao spec: comando, fixture ou violação proposital e resultado
esperado (código de saída e efeito observável). Não é guia de implementação. Formatos, gramáticas e
esquemas ficam nos contratos e no modelo de dados, citados em cada cenário, e não são repetidos
aqui:

| Assunto | Referência |
| --- | --- |
| Fonte DTCG, resolver, camadas, convenção de nomes | [contracts/token-source.md](contracts/token-source.md), `docs/tokens/convencao-de-nomes.md`, regras V-01 a V-13 do [data-model.md](data-model.md) |
| CSS gerado (`base.css`, `brand-<id>.css`) | [contracts/css-output.md](contracts/css-output.md), [ADR-13](../../docs/adr/ADR-13-escopos-marca-modo-css.md) |
| ESM gerado (`.` e `./values`) | [contracts/esm-output.md](contracts/esm-output.md), [ADR-11](../../docs/adr/ADR-11-pipeline-build-tokens.md) |
| Manifesto de contraste e superfícies | [contracts/contrast-manifest.md](contracts/contrast-manifest.md), regras V-14 a V-16, [ADR-15](../../docs/adr/ADR-15-cor-e-contraste.md) |
| Regras de lint e fixtures | [contracts/lint-rules.md](contracts/lint-rules.md), [ADR-16](../../docs/adr/ADR-16-lint-tokens-e-testes.md) |
| Sincronização com a ferramenta de design | [contracts/design-sync.md](contracts/design-sync.md), [ADR-14](../../docs/adr/ADR-14-sincronizacao-ferramenta-design.md) |
| Binários, flags, `--json` e códigos de saída | [contracts/tools-cli.md](contracts/tools-cli.md) |
| Monorepo, toolchain e camadas | [ADR-12](../../docs/adr/ADR-12-monorepo-toolchain.md) |

Os comandos passam a existir à medida que as tarefas de `tasks.md` forem implementadas. Até lá,
este documento serve de critério de aceite executável de cada história.

`<prefixo>` aparece literalmente como marcador do prefixo do projeto (TODO(PREFIXO) da constituição
v1.0.0). Nos artefatos gerados, ele corresponde ao parâmetro de prefixo do gerador, cujo valor o
requerente vai definir.

## 1. Premissas usadas neste guia

Nenhuma decisão em aberto do requerente é tomada aqui. Os cenários assumem as premissas vigentes
abaixo (spec, Assumptions; [research.md](research.md), "Perguntas ao requerente").

| Decisão em aberto | Premissa usada | Efeito na validação |
| --- | --- | --- |
| Ferramenta de design, plano e conta (DSN-01) | Nenhuma escolhida; só o adaptador `memory` (fake em memória) | US6 é validada contra o fake; os cenários com a ferramenta real estão na seção 11 |
| Direção da sincronização (DSN-01) | O repositório é a fonte; a ferramenta recebe as variáveis | O cenário Q6.17 comprova que não existe rotina de importação |
| Marcas da versão 1.0 e seus valores (TOK-07) | Todas as marcas das apps consumidoras atuais, com claro e escuro. Até a entrega, marcas de espaço reservado `a` e `b` com valores sintéticos (QA-15), não publicadas no registro; a marca `c` existe só no cenário da US3 | Todo valor esperado vem do mapa de valores gerado, nunca de número escrito à mão |
| Marca padrão (CMP-24) | Indicada pelo requerente; nos testes, `a` | Os cenários de combinação padrão usam `a` e `light` |
| Prefixo do projeto | `<prefixo>` | Nomes `--<prefixo>-*`, `data-<prefixo>-*`, `@<prefixo>/*` e `@layer <prefixo>.tokens` |
| TOK-12 (Desejável) | Não contratado | FR-032 fica fora; nenhum cenário |
| Lista de navegadores (ENG-08) | Lista versionada ainda não definida. O mecanismo CSS só exige `@layer`, já exigido pelo ADR-03. Como premissa de trabalho, os testes usam os motores da imagem fixada do Playwright (Chromium, Firefox, WebKit), sem com isso fixar a lista | Chromium em todo PR; os demais motores à noite e antes de publicar; o lint de compatibilidade de CSS aguarda a lista |
| Piso de Node (ENG-08) | Toolchain do repositório em Node 24.x (`.node-version`). Piso de `engines` e da matriz: Node 22 LTS, pela premissa "Node em LTS"; mais recente: Node 26 LTS a partir de 2026-10-28 | A comparação de determinismo entre piso e mais recente roda à noite no CI |
| Piso de TypeScript (ENG-08) | 6.0.x como valor provisório do `<versão>` da premissa; eixo 7.0.x só com `tsc` | `pnpm test:types` roda nas duas versões |
| Plataforma de repositório e CI | GitHub e GitHub Actions, inferidos do ENG-18 | Workflows `.github/workflows/tokens-ci.yml` e `design-sync.yml`; arquivo de donos em `.github/CODEOWNERS` |
| Nível WCAG (A11Y-01) | WCAG 2.2 AA | Mínimos 4,5 (texto) e 3 (não texto) em `quality/thresholds.json` |
| Licença dos pacotes publicados (ENG-22) | Proprietária; `UNLICENSED` como valor provisório | Conferida no tarball (CC-6) |
| Limiares do CI (QA-14) | Seção de contraste conforme o nível; cobertura `<N>`% ainda sem valor | O limiar de cobertura não é validável ainda (seção 11) |
| Interpretação de "variável sem valor" (ENG-06) | Só tokens públicos, sem o segmento privado `_`; os toggles `--<prefixo>-_on-light` e `--<prefixo>-_on-dark` ficam fora (spec, Clarifications) | Usada em Q2.3, Q2.4 e Q2.9; a confirmação do aceitante está pendente |

## 2. Pré-requisitos

| Item | Versão e origem | Como conferir |
| --- | --- | --- |
| Node.js | 24.x, fixado em `.node-version` | `node --version` coincide com a linha de `.node-version` (use o gerenciador de versões de sua preferência) |
| pnpm | 11.28.x exata, fixada no campo `packageManager` do `package.json` raiz; `devEngines.packageManager` com `pmOnFail: error` recusa outra versão | `corepack enable` e depois `pnpm --version` |
| Docker | Engine ou Desktop recente | `docker version`; a imagem `mcr.microsoft.com/playwright:v1.64.<patch>-noble` é usada pelo digest fixado em `.github/workflows/tokens-ci.yml`, na mesma versão de `@playwright/test` |
| Git | Com suporte a `git worktree` | O repositório precisa ter ao menos um commit: o check de determinismo constrói a partir de worktrees limpas do `HEAD` |

Nenhum cenário deste guia exige credencial. Rede só é usada para instalar dependências do registro;
os testes em navegador bloqueiam rede externa.

## 3. Preparação

### 3.1 Instalação e primeiro build

```bash
pnpm install --frozen-lockfile
pnpm tokens:validate
pnpm tokens:build
```

Resultado esperado:

- `pnpm install --frozen-lockfile`: saída 0. Nenhum script de instalação fora do mapa `allowBuilds`
  de `pnpm-workspace.yaml` é executado.
- `pnpm tokens:validate`: saída 0. O resumo mostra os tokens por camada e por categoria, com zero
  violações em todas as permutações marca × modo (`a` e `b` × `light` e `dark`). Antes das regras, a
  validação confere `packages/tokens/schemas/dtcg-2025.10/SHA256SUMS`.
- `pnpm tokens:build`: saída 0. Gera em `packages/tokens/dist/`, fora do git: `css/base.css`,
  `css/brand-a.css`, `css/brand-b.css`, `esm/index.js` com `index.d.ts`, `esm/values.js` com
  `values.d.ts`, `meta/tokens.manifest.json`, `meta/sync-manifest.json` e `meta/report.json` com
  `report.md`. O mesmo build regenera `packages/tokens/api/tokens.api.json`.
- `git status --porcelain` continua vazio: `dist/` está no `.gitignore`, e o relatório de API só muda
  quando muda a superfície pública.

### 3.2 Convenções de execução

Códigos de saída de todas as CLIs próprias (`tokens-build`, `tokens-contrast`, `design-sync`,
`repo-checks`):

| Código | Significado |
| --- | --- |
| 0 | Sucesso |
| 1 | Violações encontradas (validação, lint, contraste, divergência) |
| 2 | Erro de uso ou de configuração |
| 3 | Erro interno |
| 4 | Só `design-sync`: erro de acesso ou de credencial da ferramenta de design |
| 5 | Só `design-sync`: divergência no verify depois do `apply` |

- Toda CLI aceita `--json`: saída de máquina em stdout, com esquema estável. Sem a flag, imprime
  saída para pessoas. Erros trazem `arquivo:linha:coluna` quando aplicável.
- Nas tabelas, "saída N" é o código do binário. Os scripts da raiz passam por pnpm e turbo: o código
  específico aparece na mensagem de falha da tarefa, e o processo da raiz termina com código
  diferente de zero sempre que N ≠ 0.
- Para ler o código exato ou consumir `--json`, invoque o binário fora do turbo, que prefixa as
  linhas de log. Exemplo: `pnpm -C packages/tokens exec tokens-build validate --json`. A forma de
  invocação de cada binário está em [contracts/tools-cli.md](contracts/tools-cli.md).
- Ferramentas de terceiros mantêm seus códigos: `tsc` e Playwright terminam com código diferente de
  zero em falha; o Stylelint usa 2 para violação de regra.
- Testes unitários de um pacote rodam com `pnpm test --filter=<pacote>`; o argumento chega ao turbo.

### 3.3 Violações propositais

Todo check que promete bloqueio é comprovado por violação proposital (constituição, "Rastreabilidade
e aceite"). Há duas formas complementares:

1. **Automática**: fixtures de violação dentro de cada pacote de ferramenta, executadas por
   `pnpm test` em todo PR. Cada regra tem ao menos uma fixture válida e uma inválida.
2. **Demonstração manual**: aplicar a violação numa worktree descartável e rodar o script da raiz.

```bash
git worktree add ../patods-violacao HEAD
cd ../patods-violacao
pnpm install --frozen-lockfile
# aplicar a violação descrita no cenário e rodar o comando indicado
cd -
git worktree remove --force ../patods-violacao
```

### 3.4 Navegador real

`pnpm test:e2e` empacota `@<prefixo>/tokens` com `pnpm pack` e instala o tarball em
`apps/tokens-example`: dependências de terceiros pelo lockfile congelado, tarball com scripts
desativados e verificação de que os arquivos instalados são os do tarball. Depois gera o build da
app (Vite 8, sem framework) e roda os testes Playwright de `apps/tokens-example/tests` contra
`vite preview`. Os testes bloqueiam rede externa, e os valores esperados vêm de
`@<prefixo>/tokens/values` do próprio tarball. A app tem uma página por conjunto de importação (só
`a`; só `b` com atributo na raiz; `a` e `b` nas duas ordens). O comando termina com código 0 quando
todos os casos passam e com código diferente de zero se algum caso divergir; o relatório do
Playwright aponta o caso e o motor.

Execução local na imagem fixada (a invocação de referência é o job de e2e de `tokens-ci.yml`):

```bash
docker run --rm --ipc=host -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.64.<patch>-noble@sha256:<digest> \
  bash -lc 'corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e'
```

Use um clone ou uma worktree separada para não misturar o `node_modules` do host com o do contêiner.
No PR roda só Chromium. Para outro motor, depois de um `pnpm test:e2e`, rode
`pnpm -C apps/tokens-example exec playwright test --project=<motor>`, com os nomes de projeto da
configuração do Playwright da app.

## 4. US1: definir tokens numa fonte única validada (P1)

Pré-condição: seção 3.1 sem erro. Cobertura automática: `pnpm test --filter=@<prefixo>/tokens-build`
roda uma fixture válida e uma inválida por regra (V-01 a V-13) e a test-suite oficial do DTCG
2025.10. As demonstrações abaixo usam a worktree da seção 3.3. Toda violação de fonte é apontada com
caminho do token, `arquivo:linha:coluna` (índice de origem do ADR-11) e regra violada.

Exemplo de violação de Q1.2, em `packages/tokens/src/semantic/invariant.tokens.json` (o alias
existente de `opacity.state.disabled` trocado por um literal; o nome segue a gramática, para que só
a regra V-02 dispare):

```json
{ "opacity": { "state": { "disabled": { "$type": "number", "$value": 0.38 } } } }
```

| ID | Preparação (violação ou fixture) | Comando | Resultado esperado |
| --- | --- | --- | --- |
| Q1.1 | Fonte do repositório, sem alteração | `pnpm tokens:validate` | Saída 0; zero violações em todas as permutações e em todos os contextos |
| Q1.2 | Token semântico com valor literal (exemplo acima) | `pnpm tokens:validate` | Saída 1; aponta `opacity.state.disabled` e a regra V-02 (cenário de aceite 1) |
| Q1.3 | Nome fora da convenção: segmento `Surface_Raised` ou primeiro segmento `colour` | `pnpm tokens:validate` | Saída 1; V-06 com o segmento inválido (cenário de aceite 2) |
| Q1.4 | Alias para token inexistente, `"{color.blue.9999}"` | `pnpm tokens:validate` | Saída 1; V-03 com a referência não resolvida |
| Q1.5 | Ciclo: `color.fg.muted` → `{color.fg.subtle}` e `color.fg.subtle` → `{color.fg.muted}` | `pnpm tokens:validate` | Saída 1; V-03 com a cadeia completa do ciclo |
| Q1.6 | Primitivo em `src/primitive/color.tokens.json` com alias para `{color.bg.surface}` | `pnpm tokens:validate` | Saída 1; V-04 (referência para camada acima) |
| Q1.7 | Erro de schema: `$type` inexistente ou token sem `$value` | `pnpm tokens:validate` | Saída 1; V-01 com o caminho JSON e a posição no arquivo |
| Q1.8 | `$ref` num token semântico; grupo com `$root`; `$extends` em forma de objeto | `pnpm tokens:validate` | Saída 1; V-05 em cada caso |
| Q1.9 | Literal só em `src/semantic/brand/b.tokens.json` (por exemplo, em `brand.color.bg.surface.dark`) e, em outra execução, nome inválido só em `src/semantic/mode/dark.tokens.json` | `pnpm tokens:validate` | Saída 1 nos dois casos, com o contexto (`b` ou `dark`) apontado. Prova que as regras rodam sobre todas as permutações, não só sobre a padrão (critério do spike do ADR-11) |
| Q1.10 | `color.fg.default` definido ao mesmo tempo em `src/semantic/brand/a.tokens.json` e em `src/semantic/mode/dark.tokens.json`; em outra execução, token sob `brand.` sem id de modo no último segmento | `pnpm tokens:validate` | Saída 1; V-07 ou V-08 (forma obrigatória do FR-033) |
| Q1.11 | Remover todos os tokens semânticos de uma categoria (por exemplo, `z-index`) | `pnpm tokens:validate` | Saída 1; V-11 com a categoria sem token semântico (e V-03 para aliases que dependiam deles) |
| Q1.12 | Passo de `size.control.<passo>` fora da escala fechada da convenção, ou escala com passos diferentes entre permutações | `pnpm tokens:validate` | Saída 1; V-12 |
| Q1.13 | Cor primitiva dentro do gamut sRGB com `hex` diferente da quantização de 8 bits dos `components` | `pnpm tokens:validate` | Saída 1; V-10 |
| Q1.14 | Arquivo novo `apps/tokens-example/src/avulso.css` com `--brand-blue: #0055ff;`, adicionado ao índice com `git add` (a varredura percorre `git ls-files`) | `pnpm check:scan` | Saída 1; `arquivo:linha:coluna` da declaração, mesmo sem o prefixo (cenário de aceite 3). Demais formatos em CC-3 |
| Q1.15 | Fonte do repositório | `pnpm tokens:build` e leitura de `packages/tokens/dist/meta/report.md` | Saída 0; contagem de tokens por categoria nas 11 categorias, cada uma com ao menos um token semântico, e escala de alturas de controle resolvida por permutação marca × modo (cenário de aceite 4) |

## 5. US2: consumir tokens gerados com marca e modo por subárvore (P2)

Pré-condição: `pnpm tokens:build` sem erro. Os casos de navegador seguem os 21 casos e as árvores
aleatórias com semente fixa de [research/css-scopes.md](research/css-scopes.md), agora sobre a app
instalada do tarball. A comparação é de string exata, sem normalizar espaço, contra o mapa de
valores do tarball; qualquer diferença imprime elemento, token, valor esperado e valor obtido.

| ID | Preparação | Comando | Resultado esperado |
| --- | --- | --- | --- |
| Q2.1 | Fonte do repositório | `pnpm tokens:build` | Saída 0; artefatos da seção 3.1, com `exports` e `.d.ts` conforme os contratos de CSS e de ESM |
| Q2.2 | Fixtures de CSS gerado que quebram cada regra do gerador | `pnpm tokens:build` (auditoria estática do CSS gerado) e `pnpm test --filter=@<prefixo>/tokens-build` | Saída 0 com a fonte do repositório. A auditoria confere: em `brand-<id>.css`, todo seletor de marca nomeia só `<id>`; `:where(:root)` só no arquivo da marca padrão; `base.css` sem seletor de marca nem valor exclusivo de marca; toggles com o literal `initial` ou vazio, nunca por `var()`; tokens de eixo modo sem espaço entre os dois `var()`; todo alvo de `var()` declarado; token público declarado só no resolvedor ou no escopo de marca; tudo em `@layer <prefixo>.tokens`. Cada fixture quebrada dá saída 1 |
| Q2.3 | Página que importa `base.css` e `brand-a.css` | `pnpm test:e2e` | O CSS do bundle não tem seletor `[data-<prefixo>-brand="b"]` nem variável exclusiva de `b`; a varredura do CSSOM em todos os elementos não encontra token público vazio ou inválido (cenário de aceite 1) |
| Q2.4 | Página que importa `base.css` e `brand-b.css`, com `data-<prefixo>-brand="b"` em `<html>` | `pnpm test:e2e` | Nenhum token público sem valor; marca `b` em modo claro |
| Q2.5 | Página sem nenhum atributo, com `base.css` e `brand-a.css` | `pnpm test:e2e` | `<html>` e descendentes com os valores de `a` e `light`; `color-scheme: light` |
| Q2.6 | Elemento `a`/`light` com descendente `data-<prefixo>-mode="dark"`, um filho e um irmão posterior | `pnpm test:e2e` | Elemento e filho com valores de `a`/`dark`; irmão de volta a `a`/`light` (cenário de aceite 2) |
| Q2.7 | Elemento `a`/`dark` com descendente `data-<prefixo>-brand="b"` | `pnpm test:e2e` | `b`/`dark` no elemento e no filho (o eixo modo vem do ancestral) |
| Q2.8 | Escopos `a` → `b` → `a`; alternância de marca com quatro níveis ou mais, seguida de escopo só de modo | `pnpm test:e2e` | O escopo mais interno usa `a` com o modo do escopo de modo mais próximo (cenário de aceite 3) |
| Q2.9 | `data-<prefixo>-brand="zzz"`, `data-<prefixo>-brand=""`, `data-<prefixo>-mode="sepia"` e marca presente no markup sem CSS importado | `pnpm test:e2e` | O eixo inválido mantém o valor do ancestral válido mais próximo; nenhum token público fica sem valor |
| Q2.10 | Páginas que importam `a` e `b` nas duas ordens, com e sem atributo de marca na raiz | `pnpm test:e2e` | Resultados idênticos nas duas ordens; a marca padrão vale nos escopos sem atributo de marca |
| Q2.11 | Troca e remoção de atributos em runtime, na raiz e em escopos aninhados | `pnpm test:e2e` | Valores mudam sem recarregar (contador de navegação inalterado) e sem alterar código da app |
| Q2.12 | Tokens que não são cor em escopos só de modo: sombra com várias camadas, opacidade, dimensão de eixo marca, token invariante e alias de componente | `pnpm test:e2e` | Valores usados (`getComputedStyle` de propriedades reais como `box-shadow` e `border-radius`) iguais aos do mapa |
| Q2.13 | Cadeia intercalada (`dark` > `b` > `a` > `light` > `b` > `dark`) e árvores aleatórias com semente fixa, com mutações em runtime e variante minificada do CSS | `pnpm test:e2e` | 100% dos valores iguais ao oráculo (escopo mais próximo de cada eixo) |
| Q2.14 | Override de token sem camada, declarado no elemento de escopo | `pnpm test:e2e` | O override vence a camada `<prefixo>.tokens` (padrão de override documentado no contrato do CSS) |
| Q2.15 | Projeto `tests/types-consumer`, instalado do tarball | `pnpm test:types` | Código 0 em TS 6.0.x e 7.0.x, com `moduleResolution` `bundler` e `nodenext`. Casos positivos com `expect-type` (tipos literais `var(--<prefixo>-…)`, nunca `any`); casos negativos com `@ts-expect-error` para token inexistente na entrada `.` e para token, marca e modo inexistentes em `./values` (cenário de aceite 4) |
| Q2.16 | Em `tests/types-consumer`, remover um `@ts-expect-error` de caso negativo; em outra execução, trocar o nome inexistente de um caso negativo por um nome que existe | `pnpm test:types` | Código diferente de zero: no primeiro caso, erro de tipo no nome inexistente; no segundo, TS2578 (diretiva sem uso) |
| Q2.17 | Mesma fonte, dois builds | `pnpm check:determinism` | Ver CC-1 (cenário de aceite 5) |

## 6. US3: adicionar uma marca sem tocar em componentes (P3)

Pré-condição: a app de exemplo não lista marcas no código. Ela descobre as marcas pelo mapa de
valores do tarball e carrega `brand-<id>.css` sob demanda, o que permite trocar para uma marca nova
sem mudar a app. Cobertura automática: o teste de integração de `@<prefixo>/tokens-build` copia a
fonte para uma worktree temporária, adiciona `c`, gera o build e confere o diff
(`pnpm test --filter=@<prefixo>/tokens-build`).

| ID | Preparação | Comando | Resultado esperado |
| --- | --- | --- | --- |
| Q3.1 | Na worktree: contexto `c` no modificador `brand` de `packages/tokens/src/tokens.resolver.json`; `src/semantic/brand/c.tokens.json` com as mesmas chaves de `a.tokens.json` e valores sintéticos diferentes; primitivos exclusivos de `c` em `src/primitive/`, se houver | `pnpm tokens:validate && pnpm tokens:build`, depois `git status --porcelain` | Saída 0 nos dois; `dist/css/brand-c.css` gerado e mapa de valores com `c` × `light` e `dark`; `git status` lista só arquivos em `packages/tokens/src/` e o `packages/tokens/api/tokens.api.json` regenerado (cenário de aceite 1; ver a observação abaixo) |
| Q3.2 | Na mesma worktree, remover de `c.tokens.json` uma chave que `a` e `b` têm (por exemplo, `brand.color.fg.default.dark`); em outra execução, acrescentar uma chave que as outras marcas não têm | `pnpm tokens:validate` | Saída 1; V-13 aponta a chave ausente ou excedente, o contexto `c` e as permutações afetadas (cenário de aceite 2); a remoção também quebra o alias do modo escuro (V-03) |
| Q3.3 | Worktree de Q3.1 | `pnpm test:e2e` | A app troca entre `c` e `a` em runtime; os valores mudam sem recarregar a página e sem alteração de código (cenário de aceite 3) |
| Q3.4 | Worktree de Q3.1 | `pnpm contrast:check` | A marca `c` entra na checagem sem mudança no manifesto de contraste: saída 0 se os valores sintéticos atingem os mínimos, ou saída 1 com os pares reprovados em `c` |

Observação: a superfície pública registrada em `api/tokens.api.json` inclui os ids de marca e a
lista de arquivos de marca ([contracts/esm-output.md](contracts/esm-output.md), §11.3), então o
build o regenera no mesmo PR, e `git status` também o lista. É um artefato derivado e versionado de
propósito (QA-08), não um arquivo editado à mão. Pela seção Clarifications do spec, ele é arquivo
de tokens e entra no diff aceito pelo SC-005.

## 7. US4: garantir contraste em todas as combinações (P4)

Entradas: `packages/tokens/contrast/manifest.json`, `packages/tokens/contrast/surfaces.json` e a
seção de contraste de `quality/thresholds.json` (`{ "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }`).
Forma de um par (campos do data-model, formato completo no contrato):

```json
{ "id": "fg-default-on-surface", "fg": "color.fg.default", "bg": ["color.bg.surface"], "state": "default", "kind": "text" }
```

Cobertura automática: `pnpm test --filter=@<prefixo>/color` (luminância WCAG 2.2, composição alfa,
ida e volta da serialização de alfa) e `pnpm test --filter=@<prefixo>/tokens-contrast` (fixtures de
manifesto para cada cenário abaixo).

Valores de referência para preparar violações com primitivos sintéticos (razões truncadas em duas
casas, como no relatório):

| Frente | Fundo | Razão | Texto (4,5) | Não texto (3) |
| --- | --- | --- | --- | --- |
| `#767676` | `#ffffff` | 4,54 | Aprova | Aprova |
| `#777777` | `#ffffff` | 4,47 | Reprova | Aprova |
| `#949494` | `#ffffff` | 3,03 | Reprova | Aprova |
| `#959595` | `#ffffff` | 2,99 | Reprova | Reprova |
| `#000000` com alfa 0,5 | `#ffffff` | 3,94: menor valor entre a composição em ponto flutuante (3,976) e a variante arredondada a 8 bits a cada dobra (3,949) | Reprova | Aprova |
| `#000000` | `#ffffff` | 21 | Aprova | Aprova |

| ID | Preparação | Comando | Resultado esperado |
| --- | --- | --- | --- |
| Q4.1 | Manifesto e fonte do repositório | `pnpm contrast:check` | Saída 0; relatório JSON e tabela ordenados por par, marca e modo, sem timestamp; pares isentos aparecem medidos e marcados como não bloqueantes |
| Q4.2 | Na worktree, apontar o primitivo de `brand.color.fg.default.light` da marca `a` para `#777777`, com `color.bg.surface` em `#ffffff` no modo claro | `pnpm contrast:check` | Saída 1; aponta o par, a marca `a`, o modo `light`, a razão 4,47 e o mínimo 4,5 (cenário de aceite 1) |
| Q4.3 | Par `non-text` de indicador de foco (por exemplo, `color.border.focus` sobre `color.bg.surface`) com o primitivo do foco em `#959595` | `pnpm contrast:check` | Saída 1; razão 2,99 abaixo de 3 (cenário de aceite 2) |
| Q4.4 | Par de texto com frente `#000000` alfa 0,5 sobre superfície `#ffffff`; depois, o mesmo par como `non-text` | `pnpm contrast:check` | Como texto: saída 1, com razão 3,94 calculada sobre a cor composta (sem composição, a razão seria 21 e o par passaria). Como não texto: saída 0 (cenário de aceite 3) |
| Q4.5 | Pilha de fundo com base translúcida; conjunto de superfícies vazio num modo | `pnpm contrast:check` | Saída 1; V-16 |
| Q4.6 | Par `state: "disabled"` com `exempt: "wcag-inactive"` abaixo do mínimo; em outra execução, o mesmo `exempt` com `state: "default"` | `pnpm contrast:check` | Primeiro: saída 0, par reportado como isento com a razão medida. Segundo: saída 1, pois a isenção só vale para `disabled` e `inactive` |
| Q4.7 | Grupo any-of de indicador de foco que atravessa a borda, com um membro acima de 3 e outro abaixo; em outra execução, os dois abaixo | `pnpm contrast:check` | Primeiro: saída 0, com os dois membros reportados. Segundo: saída 1 |
| Q4.8 | Frente translúcida sobre conjunto de superfícies (`@surfaces`) em que uma das superfícies reprova | `pnpm contrast:check` | Saída 1; um caso medido por superfície, com a superfície reprovada apontada |
| Q4.9 | `fg` com referência inexistente numa permutação; em outra execução, `fg` apontando para um primitivo | `pnpm contrast:check` | Saída 1; V-14 no primeiro caso e regra de referência do manifesto no segundo |
| Q4.10 | `quality/thresholds.json` com `"text": 4`, mantido `"level": "WCAG22-AA"` | `pnpm contrast:check` | Saída 2; o mínimo incoerente com o nível declarado é erro de configuração, então não pode ser rebaixado em silêncio |
| Q4.11 | Fixtures da regra `<prefixo>/contrast-pairs`: válidas e inválidas, incluindo par em estado `disabled` ausente do manifesto e expressão não resolvível | `pnpm test --filter=@<prefixo>/stylelint-plugin` | Código 0 só se os achados coincidirem com as anotações (multiconjunto `{arquivo, linha, coluna, código}`); par ausente do manifesto é erro (cenário de aceite 4) |
| Q4.12 | Na worktree, copiar uma fixture inválida de pares para o conjunto governado pela configuração do gate | `pnpm lint:styles` | Código diferente de zero (Stylelint: 2), com o par ausente apontado |
| Q4.13 | Amostras renderizadas a partir do tarball, uma por par × marca × modo, com a pilha opaca pintada em ancestrais reais | `pnpm test:e2e` | `getComputedStyle` igual ao sRGB emitido por `toEmittedSrgb()`; axe sem violação de contraste nos pares não isentos |

## 8. US5: barrar estilos fora dos tokens (P5)

A regra `<prefixo>/design-tokens` é guiada por `dist/meta/tokens.manifest.json`, gerado das marcas
sintéticas; o turbo roda `pnpm tokens:build` antes. Os subcódigos e a sintaxe de anotação das
fixtures estão em [contracts/lint-rules.md](contracts/lint-rules.md). Nesta feature, o registro de
controles interativos é só de fixture; o de produção será derivado do contrato de DOM (CMP-14) ou do
arquivo de orientação, na feature de componentes.

Fixture inválida ilustrativa e incompleta (nomes de token apenas como exemplo). Os comentários
`expect:` omitem a coluna por brevidade; nas fixtures reais a forma é `código@coluna`, com todos os
avisos do arquivo listados ([contracts/lint-rules.md](contracts/lint-rules.md), seção 5):

```css
.<prefixo>-fixture-card {
  color: var(--<prefixo>-color-blue-500);                      /* expect: primitive-token */
  background: var(--<prefixo>-brand-color-bg-surface-light);   /* expect: brand-mode-source-token */
  padding: 16px;                                               /* expect: literal-value */
  border-radius: var(--<prefixo>-radius-control-default, 4px); /* expect: var-fallback-literal */
  --brand-blue: #0055ff;                                       /* expect: token-definition */
  border-color: var(--brand-blue);                             /* expect: unknown-token */
}
.<prefixo>-fixture-button--sm { block-size: var(--<prefixo>-size-icon-md); } /* expect: control-height */
.<prefixo>-fixture-switch { padding-block: var(--<prefixo>-space-inset-sm); } /* expect: control-height-missing */
.<prefixo>-fixture-novo { color: var(--<prefixo>-color-fg-default); }        /* expect: unclassified-component */
```

No registro de fixture, `button` (com o modificador `--sm`) e `switch` são controles, `card` não é
controle e `novo` não está classificado.

| ID | Preparação | Comando | Resultado esperado |
| --- | --- | --- | --- |
| Q5.1 | Fixtures `valid/` e `invalid/` da regra, com o registro de fixture | `pnpm test --filter=@<prefixo>/stylelint-plugin` | Código 0 só com 100% dos erros esperados e zero falsos positivos (multiconjunto `{arquivo, linha, coluna, código}`); falha também se algum subcódigo não tiver ao menos uma fixture inválida |
| Q5.2 | `var()` de token primitivo em estilo de componente | Coberto por Q5.1; demonstração por Q5.7 | `primitive-token` (cenário de aceite 1) |
| Q5.3 | Literal de cor, espaço ou raio; `var()` com fallback literal; custom property sem prefixo e seu uso | Coberto por Q5.1 | `literal-value`, `var-fallback-literal`, `token-definition` e `unknown-token` (cenário de aceite 2) |
| Q5.4 | Token-fonte `brand.<categoria>….<modo>` em estilo de componente | Coberto por Q5.1 | `brand-mode-source-token` |
| Q5.5 | Altura de controle com token fora da escala, na classe raiz e num modificador de tamanho; controle dimensionado só por `padding-block`, sem altura da escala; classe raiz fora do registro | Coberto por Q5.1 | `control-height`, `control-height-missing` e `unclassified-component` (cenário de aceite 3) |
| Q5.6 | Arquivo só com tokens semânticos e de componente, palavras-chave da allowlist (`transparent`, `currentcolor`, `0`, `auto`, `none` e palavras-chave globais do CSS) e `calc(var(--<prefixo>-space-inset-md) * -1)` | Coberto por Q5.1 | Zero achados (cenário de aceite 4) |
| Q5.7 | Na worktree, copiar uma fixture inválida para o conjunto governado, com `/* stylelint-disable */` no topo | `pnpm lint:styles` | Código diferente de zero (Stylelint: 2). O comentário não contorna o gate (`ignoreDisables`, `--max-warnings 0`), e o relatório JSON lista os achados |
| Q5.8 | Conjunto governado do repositório (nesta feature, só fixtures válidas; o núcleo entra na feature de componentes) | `pnpm lint:styles` | Código 0 e relatório JSON com zero violações |

## 9. US6: manter a ferramenta de design sincronizada (P6)

Todos os cenários usam o adaptador `memory`. Sem `--memory-state`, cada execução do CLI com
`--adapter memory` parte de uma ferramenta vazia. Cenários que dependem de estado entre duas
sincronizações rodam na suíte de contrato (`pnpm test --filter=@<prefixo>/design-sync`), que usa o
mesmo núcleo, o `InMemoryDesignTool` com injeção de falhas, o tracker e o alerta em memória. Pelo
CLI, os mesmos cenários podem ser encadeados à mão com `--memory-out <arquivo>` numa execução e
`--memory-state <arquivo>` na seguinte ([contracts/tools-cli.md](contracts/tools-cli.md), seção 5.1). Entidades e estados: data-model ("Variável da ferramenta de design",
"Execução de sincronização", "Divergência").

**CLI com o fake**

| ID | Preparação | Comando | Resultado esperado |
| --- | --- | --- | --- |
| Q6.1 | `pnpm tokens:build` feito | `pnpm design-sync -- plan --adapter memory` | Saída 0; plano ordenado (coleções, modos, variáveis, valores, remoções), sem escrita. Coleções: Primitivos (sem modos), Marca (modos `a` e `b`), Modo (`light` e `dark`), Semânticos invariantes e Componentes; zero variáveis auxiliares |
| Q6.2 | Idem | `pnpm design-sync -- apply --adapter memory` | Saída 0; execução `verified` (verify com diff vazio). Log em JSON canônico com `changes[]` (variáveis criadas, ordenadas por caminho), `restored[]` vazio e `digests`; timestamp e URL só no envelope (cenário de aceite 1) |
| Q6.3 | Idem | `pnpm design-sync -- detect --adapter memory` | Saída 1 contra a ferramenta vazia; uma divergência `missing` por variável, cada uma com `fingerprint`, `owner` (papel dono da sincronização lido do arquivo de donos) e `due` (detecção mais o SLA da configuração versionada), registrada no tracker em memória (cenário de aceite 4) |
| Q6.4 | Idem | `pnpm design-sync -- check-access --adapter memory` | Saída 0; capacidades do fake impressas (modos por eixo, escopo por quadro, escrita e publicação) |
| Q6.5 | Na worktree, remover do arquivo de donos a linha do papel dono da sincronização | `pnpm design-sync -- detect --adapter memory` | Saída 2 (configuração); nenhum item é criado sem responsável |

**Suíte de contrato** (`pnpm test --filter=@<prefixo>/design-sync`; código 0 com todos os casos)

| ID | Caso | Resultado esperado |
| --- | --- | --- |
| Q6.6 | `simulateManualEdit` numa variável depois de uma sincronização | A sincronização seguinte restaura o valor da origem e registra a ocorrência em `restored[]`, separada de mudança de release pela comparação com a versão anterior e a atual (cenário de aceite 2) |
| Q6.7 | `simulateRename` e `simulateExtraVariable` | Variável renomeada de volta pela chave do token, sem recriar; variável extra em coleção gerenciada removida e registrada |
| Q6.8 | Mudança de `$type` de um token entre versões | Recriação marcada no log |
| Q6.9 | Divergências de nome, hierarquia e valor plantadas no fake | Relatório com tipos `name`, `hierarchy` e `value`; depois da sincronização, zero diferenças de nome e hierarquia, comparando arrays de segmentos normalizados |
| Q6.10 | Capacidade `maxModesPerAxis` menor que o número de marcas | Limite e topologia registrados no relatório da execução; nenhuma coleção que combine marca e modo é criada |
| Q6.11 | `faults.failAfterOperations(n, …)` (falha depois de N operações) | Execução `failed` com alerta; a execução seguinte converge e registra os itens reparados |
| Q6.12 | Credencial expirada ou 403 em `checkAccess`; 429 com `Retry-After` | Credencial: o CLI sai com 4 e o alerta vai ao papel dono (FR-026). 429: a execução respeita `Retry-After` e conclui |
| Q6.13 | Verify com diff não vazio depois do `apply` | O CLI sai com 5; execução `failed`; alerta ao papel dono (cenário de aceite 5) |
| Q6.14 | Mesma divergência em duas detecções seguidas; depois, diff vazio | Item deduplicado pelo `fingerprint` e fechado sozinho quando a execução seguinte vê diff vazio |
| Q6.15 | Núcleo executado duas vezes com as mesmas entradas | Plano e log idênticos byte a byte, fora do envelope |
| Q6.16 | Capacidade `write: manual` ou `publish: manual` | Item rastreável com responsável e prazo, em vez de falha silenciosa |
| Q6.17 | Teste de arquitetura | `DesignToolPort` não tem operação que leia da ferramenta para o repositório, e `tools/design-sync` não escreve em `packages/tokens/src` (cenário de aceite 6) |

**Inspeção do workflow** (Q6.18): `.github/workflows/design-sync.yml` dispara depois da promoção à
tag principal, por `schedule` semanal e por `workflow_dispatch` (até existir o ENG-26), no mesmo
grupo de `concurrency`. Ações de terceiros são fixadas por SHA. Segredos ficam só nos environments
`design-sync-read` e `design-sync-write`. Não há gatilho `pull_request` nem `pull_request_target`, e
nenhum passo faz commit ou push no repositório.

O cenário de aceite 3 (trocar só a marca ou só o modo de um quadro sem religar camadas) só tem a
parte de topologia validada com o fake: marca e modo em coleções separadas e toda variável
correspondendo a um token real (Q6.1, Q6.9). A troca por quadro depende da ferramenta (seção 11).

## 10. Checagens transversais

| ID | Check | Comando | Resultado esperado e violação proposital |
| --- | --- | --- | --- |
| CC-1 | Determinismo | `pnpm check:determinism` | Saída 0: dois builds a partir de duas `git worktree` limpas do `HEAD`, em caminhos, `TZ` e `LC_ALL` diferentes, sem cache de tarefas, empacotados com `pnpm pack`; sha256 iguais por arquivo e entre os tarballs. Divergência: saída 1, com o primeiro arquivo diferente e o diff. Mudanças não commitadas ficam fora. Autoteste com fixture não determinística em `pnpm test --filter=@<prefixo>/repo-checks`. À noite, o CI repete a comparação entre runners e entre Node 22 e o mais recente da matriz |
| CC-2 | Drift de gerados | `pnpm check:drift` | Saída 0: `git ls-files` não lista arquivo gerado nem arquivo com cabeçalho de gerado, e `api/tokens.api.json` regenerado não tem diff. Violações: `git add -f packages/tokens/dist/css/base.css` dá saída 1 (edge case de CSS de tokens editado à mão); editar `api/tokens.api.json` à mão dá saída 1 com o diff. Remoção ou renomeação de token aparece como diff desse relatório; a verificação de SemVer (GOV-01) é da feature de CI |
| CC-3 | Varredura do FR-001 | `pnpm check:scan` | Saída 0 no repositório. Cada violação abaixo, adicionada ao índice do git, dá saída 1 com `arquivo:linha:coluna`: custom property com literal em CSS (com e sem prefixo), em `<style>` de SFC `.vue` e em `style=` de HTML; chave `"--<prefixo>-…"` em JSON; `setProperty('--<prefixo>-…', …)` em TS ou JS; documento DTCG (`$value`) fora de `packages/tokens/src`. Entrada de `quality/scan-allowlist.json` sem justificativa: saída 2 |
| CC-4 | Fronteiras de camada | `pnpm check:layers` | Saída 0 com `turbo boundaries` (tags `tokens`, `tools` e `apps` de `turbo.json`) e `repo-checks layers` (manifesto pnpm). Cada violação dá saída 1 com a aresta: `tools/color` com dependência do workspace; `@<prefixo>/tokens` em `dependencies` (não dev) de `tools/stylelint-plugin` ou `tools/design-sync`; pacote sem exatamente uma tag de camada; `workspace:` em `apps/tokens-example` ou `tests/types-consumer`; import de arquivo fora do pacote; `@boundaries-ignore` fora do registro de exceções |
| CC-5 | Tipos e exports | `pnpm test:types` | Q2.15 e Q2.16, mais `publint` sem erro sobre o tarball |
| CC-6 | Conteúdo do tarball | `pnpm -C packages/tokens pack --pack-destination "$TMPDIR/patods-pack"` e `tar -tzf` no `.tgz` gerado | O tarball contém só os arquivos da allowlist versionada (ENG-17): `package.json`, `dist/css/base.css`, `dist/css/brand-<id>.css`, `dist/esm/index.js`, `index.d.ts`, `values.js`, `values.d.ts`, `dist/meta/*`, README e avisos de terceiros (ENG-22). O `package.json` tem `exports` para `.`, `./values`, `./css/base.css`, `./css/brand-*.css` e `./meta/*`; `sideEffects: ["**/*.css"]`; nenhuma `dependencies`; nenhum script de instalação; `license` conforme a premissa (`UNLICENSED` provisório). Os pacotes de ferramenta são `private: true` e não geram tarball publicável |
| CC-7 | Testes unitários | `pnpm test` | Código 0; Vitest só em ambiente Node; o script do QA-02 falha quando um módulo de lógica não tem arquivo de teste; o limiar de cobertura é lido de `quality/thresholds.json` (valor `<N>` pendente) |
| CC-8 | Instalação congelada e scripts | `pnpm install --frozen-lockfile` | Violações: versão alterada num `package.json` sem atualizar o lockfile falha com `ERR_PNPM_OUTDATED_LOCKFILE` (ENG-16); dependência de fixture com `postinstall` fora de `allowBuilds` faz a instalação falhar (ENG-24) |
| CC-9 | Integridade dos schemas e licenças | `pnpm tokens:validate`; `pnpm licenses list -r --json` | Um byte alterado em `schemas/dtcg-2025.10/format.json` faz a validação sair com 2 (conferência do `SHA256SUMS`). As licenças da árvore são comparadas com `quality/license-policy.json` (MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, MIT-0, CC0-1.0, Python-2.0, MPL-2.0 só como dependência de desenvolvimento, W3C para os schemas e override revisado do `svg-tags`) |
| CC-10 | Rastreabilidade | Tabela da seção 12 | Cada linha vira entrada na matriz de rastreabilidade do ACE-02 (FR-031), ligada ao job do CI ou à evidência retida |

## 11. O que ainda não pode ser validado

- **Ferramenta de design real** (decisão pendente do requerente): adaptador real; suíte de contrato
  contra um arquivo sandbox à noite; troca de só marca ou só modo num quadro sem religar camadas
  (US6, cenário de aceite 3, FR-029); limites reais de modos do plano; publicação de biblioteca, que
  é manual no Figma; credencial fixa com dono e rotação (ENG-13); spike do caminho MCP em planos
  Professional e Organization. Hoje valem só o núcleo, a topologia e o fake.
- **Notificação real do papel dono** (FR-026): prova em sandbox com token de GitHub App. Depende da
  confirmação da plataforma e da configuração da organização (campo de responsável nos itens).
- **Gatilho "versão publicada"** (FR-025, FR-030): depende do pipeline de publicação (ENG-26, feature
  de CI). Até lá, o dono da sincronização dispara o workflow à mão, com o mesmo log. A execução
  semanal (SC-011) só se comprova com o histórico de execuções na plataforma.
- **Lint e checagem de pares no núcleo** (FR-021, FR-024): o núcleo nasce na feature de componentes.
  Hoje só há fixtures e registro de controles de fixture; o relatório de zero violações no núcleo e
  o registro derivado do contrato de DOM (CMP-14) ficam para lá.
- **Marcas reais** (TOK-07, CMP-24): lista, valores, marca padrão, número de marcas diante do limite
  de modos da ferramenta e eventual paleta em gamut amplo (mapeamento determinístico para sRGB a
  aceitar). SC-005 e SC-008 com marcas reais dependem dessa entrega; hoje valem `a` e `b`
  sintéticas.
- **Prefixo real**: nomes finais de variáveis, atributos, camada e escopo do registro (ENG-20).
- **TOK-12** (FR-032): fora do plano até a resposta do requerente.
- **Lista de navegadores** (ENG-08): lint de compatibilidade de CSS e motores definitivos da execução
  noturna e de pré-publicação.
- **Pisos de Node e TypeScript** (ENG-08): a matriz usa Node 22 e 26 e TS 6.0 e 7.0 como premissas
  provisórias.
- **React e Vue**: testes de tema aninhado, SSR e portais (TOK-14 parcial, CMP-21) e apps de exemplo
  React e Vue (QA-06 parcial) ficam na feature de componentes.
- **Limiares pendentes** (QA-14): orçamento de bundle do QA-07 (o tamanho do CSS por marca é medido,
  sem limiar) e cobertura do QA-03 (`<N>`%).
- **ENG-01 completo e cache remoto**: regras de import no ESLint com fixtures `.vue` e cache remoto
  do ENG-03 chegam com a feature de CI.
- **Interpretações a confirmar com o aceitante**: definição operacional de "variável sem valor"
  (ENG-06) e se `api/tokens.api.json` regenerado conta no SC-005 (Q3.1).

## 12. Mapeamento cenário → requisito

| Cenário | User story e cenário de aceite | FR | SC | Outros IDs |
| --- | --- | --- | --- | --- |
| Q1.1 | US1 | FR-002, FR-003, FR-004, FR-005 | SC-001 | TOK-01, TOK-02, TOK-04 |
| Q1.2 | US1, aceite 1 | FR-003 | SC-001, SC-009 | TOK-02 |
| Q1.3 | US1, aceite 2 | FR-005 | SC-001, SC-009 | TOK-04 |
| Q1.4, Q1.5, Q1.6 | US1, edge cases | FR-004 | SC-001 | TOK-01, TOK-02 |
| Q1.7 | US1 | FR-002 | SC-001 | TOK-01 |
| Q1.8 | US1 | FR-002, FR-004, FR-005 | SC-001 | TOK-02 |
| Q1.9 | US1 | FR-003, FR-004, FR-005 | SC-001, SC-009 | TOK-02, TOK-04 |
| Q1.10 | US1 | FR-011, FR-033 | SC-004 | TOK-09, DSN-04, DSN-05 |
| Q1.11 | US1 | FR-006 | SC-003 | TOK-10 |
| Q1.12 | US1 | FR-007 | — | TOK-13 |
| Q1.13 | US1 | FR-020 (valor medido igual ao emitido) | SC-008 | A11Y-09 |
| Q1.14, CC-3 | US1, aceite 3 | FR-001 | SC-001 | TOK-01 |
| Q1.15 | US1, aceite 4 | FR-006, FR-007, FR-008 | SC-003 | TOK-10, TOK-13 |
| Q2.1, Q2.2 | US2 | FR-010, FR-013, FR-015, FR-016, FR-017 | SC-006 | TOK-05, TOK-06, TOK-08, ENG-06 |
| Q2.3, Q2.4 | US2, aceite 1 | FR-013, FR-017, FR-018 | SC-006 | ENG-06, QA-06 (parcial) |
| Q2.5 | US2, edge case | FR-013 | SC-006 | CMP-24 |
| Q2.6, Q2.7, Q2.8 | US2, aceites 2 e 3 | FR-012 | SC-007 | TOK-14 |
| Q2.9 | US2, edge case | FR-014 | SC-006 | ENG-06 |
| Q2.10 | US2, edge case | FR-013, FR-017 | SC-006 | ENG-06 |
| Q2.11 | US2 | FR-010, FR-018 | — | TOK-07, TOK-08, TOK-14 |
| Q2.12, Q2.13 | US2 | FR-012 | SC-007 | TOK-14 |
| Q2.14 | US2 | FR-012 | — | ADR-03, MIG-14 |
| Q2.15, Q2.16, CC-5 | US2, aceite 4 | FR-016 | SC-009 | TOK-06, QA-08, ENG-05 |
| Q2.17, CC-1 | US2, aceite 5 | FR-015 | SC-002 | TOK-05 |
| Q3.1 | US3, aceite 1 | FR-009 | SC-005 | TOK-07 |
| Q3.2 | US3, aceite 2 | FR-011 | SC-004, SC-009 | TOK-09 |
| Q3.3 | US3, aceite 3 | FR-009, FR-018 | — | TOK-07 |
| Q3.4 | US3 | FR-011, FR-020 | SC-004, SC-008 | A11Y-09 |
| Q4.1 | US4 | FR-019, FR-020 | SC-008 | A11Y-01, A11Y-09 |
| Q4.2 | US4, aceite 1 | FR-020 | SC-008, SC-009 | A11Y-09 |
| Q4.3 | US4, aceite 2 | FR-020 | SC-008, SC-009 | A11Y-09 |
| Q4.4 | US4, aceite 3 | FR-020 | SC-008 | A11Y-09 |
| Q4.5 a Q4.9 | US4 | FR-019, FR-020 | SC-008 | A11Y-01, A11Y-09 |
| Q4.10 | US4 | FR-020 | — | QA-14, A11Y-01 |
| Q4.11, Q4.12 | US4, aceite 4 | FR-021 | SC-009 | A11Y-09 |
| Q4.13 | US4 | FR-020 | SC-008 | QA-01 |
| Q5.1, Q5.8 | US5 | FR-024 | SC-009 | TOK-03 |
| Q5.2 | US5, aceite 1 | FR-022 | SC-009 | TOK-03 |
| Q5.3 | US5, aceite 2 | FR-001, FR-022 | SC-009 | TOK-03 |
| Q5.4 | US5 | FR-022, FR-033 | SC-009 | TOK-03 |
| Q5.5 | US5, aceite 3 | FR-007, FR-023 | SC-009 | TOK-13 |
| Q5.6 | US5, aceite 4 | FR-022, FR-024 | SC-009 | TOK-03 |
| Q5.7 | US5 | FR-024 | SC-009 | TOK-03 |
| Q6.1 | US6 | FR-025, FR-028, FR-029, FR-033 | SC-010 | DSN-01, DSN-04, DSN-05 |
| Q6.2 | US6, aceite 1 | FR-025 | SC-010 | DSN-01 |
| Q6.3 | US6, aceite 4 | FR-030 | SC-011 | DSN-11 |
| Q6.4, Q6.10 | US6, edge case | FR-029 | — | DSN-05 |
| Q6.5 | US6 | FR-026, FR-030 | SC-011 | DSN-02 |
| Q6.6 | US6, aceite 2 | FR-027 | SC-010 | DSN-03 |
| Q6.7, Q6.8, Q6.9 | US6 | FR-027, FR-028 | SC-010 | DSN-03, DSN-04 |
| Q6.11 | US6, edge case | FR-025, FR-027 | SC-010 | DSN-03 |
| Q6.12, Q6.13 | US6, aceite 5 | FR-026 | — | DSN-02, ENG-13 |
| Q6.14 | US6, aceite 4 | FR-030 | SC-011 | DSN-11 |
| Q6.15 | US6 | FR-025 | — | Princípio I |
| Q6.16 | US6 | FR-025, FR-029 | — | DSN-01 |
| Q6.17 | US6, aceite 6 | FR-025 | — | DSN-01 |
| Q6.18 | US6 | FR-025, FR-030 | SC-011 | DSN-01, DSN-11, ENG-14, ENG-18 |
| CC-2 | Edge case (CSS editado à mão) | FR-015 | — | TOK-05, QA-08, GOV-01 |
| CC-4 | — | — | — | ENG-01 |
| CC-6 | — | FR-016, FR-017 | — | ENG-04, ENG-17, ENG-22 |
| CC-7 | — | — | — | QA-02 |
| CC-8 | — | — | — | ENG-16, ENG-24 |
| CC-9 | — | FR-002 | — | ENG-21 |
| CC-10 | — | FR-031 | — | ACE-02 |

FR-032 (TOK-12) não tem cenário: o requisito é Desejável e não foi contratado.
