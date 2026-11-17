# ADR-12: Monorepo: gerenciador de pacotes, orquestrador e toolchain

**Status**: Proposto | **Data**: 2026-10-21 | **Feature**: 001-design-tokens-themes | **Relaciona**: ADR-09

## Contexto

O ADR-09 do contrato fixa um monorepo único com fronteiras de camada impostas por lint, mitigado por
ENG-01, ENG-02 e ENG-03. A feature 001 cria o esqueleto do monorepo (`@<prefixo>/tokens`, seis
pacotes privados em `tools/*`, `apps/tokens-example`, `tests/types-consumer`) e precisa de
gerenciador de pacotes, orquestrador, cache remoto e toolchain que atendam também ENG-08, ENG-13,
ENG-14, ENG-16, ENG-19, ENG-21, ENG-24, ENG-25, QA-06 e o TOK-05. Fatos de 2026-10-21 (research.md,
D2): o pnpm 12 (Rust) é `latest` desde 2026-08-26 e ainda estabiliza, e o pnpm 11 segue mantido; o
`turbo boundaries` é experimental e ignora `.vue`, `.mts` e `.cts`; o Node 24 é LTS (Maintenance
desde 2026-10-20), o 26 vira LTS em 2026-10-28 e o 22 é LTS até 2027-04-30; o TypeScript 7.0 não
tem API programática até a 7.1. Este ADR implementa o ADR-09 sem alterá-lo e não modifica nenhum
dos ADR-01 a ADR-10, portanto dispensa pedido de mudança (GOV-07).

## Decisão

**1. pnpm 11.** Versão 11.28.x exata em `packageManager` e `devEngines.packageManager`
(`pmOnFail: error`), instalada no CI por action fixada por SHA, nunca por `npm i -g`. O
`pnpm-workspace.yaml` declara os workspaces (`packages/*`, `tools/*`, `apps/*`, `tests/*`), `catalog`
com `catalogMode: strict`, `strictDepBuilds` com `allowBuilds` como allowlist do ENG-24 (hoje só
`fsevents`), `minimumReleaseAge: 1440`, `blockExoticSubdeps`, `trustPolicy: no-downgrade` e
`updateNotifier: false`. O CI instala com `pnpm install --frozen-lockfile` (ENG-16). Todo pino tem
idade maior ou igual ao `minimumReleaseAge` e muda só por PR de toolchain. `pnpm sbom` (ENG-19),
`pnpm licenses list --json` contra `quality/license-policy.json` (ENG-21) e `pnpm pack` (QA-06,
ENG-17) são nativos. CODEOWNERS cobre `pnpm-workspace.yaml` e todo `package.json` (ENG-25).

**2. Turborepo 2.** Versão 2.11.x exata, num patch que já cumpra a janela mínima (o 2.11.10, de
2026-10-20, só se qualifica depois dela). ENG-02: `turbo run <tarefas> --affected` com
`TURBO_SCM_BASE` igual ao SHA da base do PR e checkout com histórico suficiente; `globalDependencies`
lista `.node-version`, `pnpm-workspace.yaml`, `.github/workflows/**` e `.github/actions/**`, e um
passo de escopo compara `git diff --name-only BASE...HEAD` com essa lista e com `turbo.json` para
rodar sem `--affected` quando houver coincidência; cron diário completo na `main`. `envMode:
strict`, `TURBO_TELEMETRY_DISABLED=1` e `--summarize` como evidência de escopo e de cache. Os checks
de determinismo (TOK-05, IA-04) rodam sem cache de tarefas. Todos os scripts da raiz (`tokens:*`,
`contrast:check`, `lint:styles`, `test*`, `check:*`, `design-sync`) rodam via turbo.

**3. ENG-01 em três checks obrigatórios.** O arquivo versionado de camadas é o `turbo.json` raiz
(`boundaries.tags`), com exatamente uma tag de camada no `turbo.json` de cada pacote. Esta feature
cria três camadas; núcleo, frameworks, ícones, catálogo, lint, codemods e mapeamentos entram na
fase em que forem criados, com violação proposital no pacote de aceite (ACE-08).

| Tag | Pacotes | Arestas permitidas |
| --- | --- | --- |
| `tokens` | `packages/tokens` | Só devDependency: `tools/tokens-build`, `tools/color` |
| `tools` | `tools/*` | `tokens-build` → `color`; `tokens-contrast` → `tokens` (meta) e `color`, dev; `stylelint-plugin` e `design-sync` → `tokens` (meta), dev; `color` e `repo-checks` sem dependência do workspace |
| `apps` | `apps/*`, `tests/*` | Nenhuma dependência do workspace; `tokens` só pelo tarball de `pnpm pack` |

```json
{ "boundaries": { "tags": {
  "tokens": { "dependencies": { "allow": ["@<prefixo>/tokens-build", "@<prefixo>/color"] } },
  "tools": { "dependencies": { "allow": ["tools", "@<prefixo>/tokens"] } },
  "apps": { "dependencies": { "allow": [] } } } } }
```

- (a) `turbo boundaries`: regras de tag sobre o grafo de pacotes, inclusive transitivas, import de
  arquivo fora do pacote e import de pacote não declarado.
- (b) Regras de import no ESLint que cobrem `.vue` via `vue-eslint-parser` (`eslint-plugin-import-x`
  com `no-relative-packages` e `no-extraneous-dependencies`, ou `eslint-plugin-boundaries`).
- (c) `repo-checks layers`, sobre `pnpm ls -r --prod --json` e as tags: falha com pacote de UI
  (hoje, `@<prefixo>/tokens`) no fechamento `--prod` de ferramenta (o Turbo não distingue
  dependency de devDependency), com pacote sem exatamente uma tag de camada, com `workspace:` em
  `apps/*` ou `tests/*`, com dependência do workspace num pacote folha e com `@boundaries-ignore`
  ou desativação equivalente no ESLint fora de registro versionado de exceções com dono.

Cada aresta proibida tem fixture de violação proposital em `.ts` e em `.vue`. `pnpm check:layers`
roda (a) e (c) (códigos de saída 0 a 3 e `--json`); (b) roda no lint. Esta feature entrega (a) e
(c) com fixtures `.ts`; (b) e as fixtures `.vue` chegam com a feature de CI, antes do primeiro `.vue`.

**4. Cache remoto do ENG-03: desenho decidido aqui, implementado na feature de CI** (até lá, só
cache local). Servidor auto-hospedado ducktors/turborepo-remote-cache (TRRC, MIT, linha v2.14),
imagem fixada por digest, sobre bucket S3, GCS ou Azure, conforme a OpenAPI aberta do protocolo.
- `AUTH_MODE=jwt` sobre o OIDC do GitHub, `JWT_AUDIENCE` dedicada e claims imutáveis
  (`repository_id`, `repository_owner_id`). Leitura: qualquer job do repositório. Escrita: só o
  `job_workflow_ref` do workflow de push e cron da branch protegida; PR, push em outra branch e fila
  de merge recebem 403 no PUT. Fora da `main`, o cliente usa também `--cache=local:rw,remote:r`.
- Sidecar local em `127.0.0.1`, apontado por `--api`, pede token OIDC novo por requisição via
  `ACTIONS_ID_TOKEN_REQUEST_URL` (o token dura cerca de 5 min e o turbo lê `TURBO_TOKEN` uma vez);
  tem teste unitário (QA-02), e o `envMode: strict` esconde `ACTIONS_ID_TOKEN_REQUEST_*` das tarefas.
- Sem segredo fixo (ENG-13; `TURBO_REMOTE_CACHE_SIGNATURE_KEY` não é recurso de segurança e não é
  usado). Fork sem `id-token` roda só com cache local (ENG-14). Lint proíbe `pull_request_target`.
- Prova: teste recorrente de PUT a partir de PR com 403; job de mais de 15 min que grava tudo;
  reexecução sem mudança com 100% de acerto no `--summarize`. Plano B: instâncias `READ_ONLY=true`
  e de escrita (só de environment protegido da `main`) sobre o mesmo bucket, ou servidor mínimo
  próprio que responde 409 para chave existente.

**5. Toolchain do repositório separada do piso publicado.** A toolchain que roda o repositório é
Node 24.x LTS (`.node-version`) e TypeScript 6.0.x como compilador único de emissão e de API das
ferramentas (typescript-eslint 8.72 exige `typescript <6.1.0`; Vue e Volar seguem no 6.0). O piso
publicado e a matriz ENG-08 seguem a premissa vigente "Node em LTS": `engines.node` de
`@<prefixo>/tokens` coincide com o piso testado, Node 22 LTS, e o "mais recente" é Node 26 LTS a
partir de 2026-10-28; o determinismo é comparado também entre os dois (ADR-11). TS 6.0 é valor
provisório do `<versão>` da premissa; o eixo TS 7.0.x roda só `tsc` em `tests/types-consumer`, e o
`vue-tsc` fica no 6.0 até a API da 7.1. Nenhum valor diferente da premissa é fixado.

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| Nx 23 | Cache auto-hospedado depreciado pelo CVE-2025-36852, sem correção; caminho recomendado é SaaS proprietário; `postinstall` no pacote |
| pnpm 12 | Ainda estabilizando; pacote npm com `preinstall`/`postinstall`; migração posterior barata (mesmo lockfile e settings) |
| pnpm sozinho; npm ou Yarn 4 workspaces | Sem cache de tarefas no pnpm 11 nem fronteiras; npm e Yarn sem o conjunto nativo de supply chain do pnpm 11 |
| moon 2; Rush 5 | moon: cache remoto instável e autenticação por segredo fixo (ENG-13); Rush: envolve o pnpm e não tem lint de fronteiras por tags |
| Vercel Remote Cache ou cache do GitHub Actions | Vercel não distingue leitura de escrita no servidor; no Actions, o PR escreve no próprio escopo, contra o "só leem" do ENG-03 |
| eslint-plugin-boundaries ou dependency-cruiser no lugar de (a) e (c) | Olham só imports, não arestas do manifesto nem dev versus prod; podem compor o check (b) |
| Node 24 como piso de `engines` agora; TS 7.0 como compilador único | Node 24 difere da premissa vigente, e a constituição proíbe fixar outro valor sem pedido de mudança; o TS 7.0 não tem API até a 7.1, da qual dependem `vue-tsc` e typescript-eslint |

## Consequências

- **Positivas**: supply chain nativa, sem scripts de instalação no pnpm 11 e no turbo; só o afetado
  roda; escrita no cache imposta no servidor, com credencial federada; fronteiras em três níveis
  independentes; Node atual na toolchain sem antecipar decisão do requerente.
- **Negativas**: operar o servidor de cache e manter o sidecar, código próprio sensível; dois checks
  próprios além do turbo; matriz mais larga (Node 22 e 26, TS 6.0 e 7.0); sem a velocidade do tsgo.
- **Neutras**: migrar para pnpm 12 ou Node 26 na toolchain é PR futuro, com execução completa
  (ENG-02); `--affected` tem granularidade por pacote; o ENG-03 só é aceito na feature de CI.

## Requisitos atendidos

| ID | Como |
| --- | --- |
| ADR-09 | Monorepo único com workspaces pnpm e fronteiras verificadas no CI, sem alterar o ADR |
| ENG-01, ACE-08 | `turbo.json` como arquivo de camadas; checks (a), (b) e (c) com violação proposital por aresta; cada camada nova entra na sua fase |
| ENG-02 | `--affected` com `TURBO_SCM_BASE`; `globalDependencies` e passo de escopo; cron diário completo |
| ENG-03 | Desenho TRRC com JWT sobre OIDC e escrita só pela branch protegida; implementação na feature de CI |
| ENG-08 | Piso Node 22 LTS, mais recente Node 26 LTS; TS 6.0 e 7.0 no consumidor de tipos; `engines` igual ao piso testado |
| ENG-13, ENG-14 | Cache com credencial federada; fork sem `id-token`, só cache local |
| ENG-16, ENG-24, ENG-25 | `--frozen-lockfile`; `strictDepBuilds` com `allowBuilds`; `catalogMode: strict` e CODEOWNERS; execuções propositais falham |
| ENG-17, ENG-19, ENG-21 | `pnpm pack`, `pnpm sbom` e `pnpm licenses list --json` contra a política versionada |
| ENG-18 | Setup de Node e pnpm por actions fixadas por SHA; OIDC sem action de terceiros |
| QA-02, QA-06 | Check de camadas, passo de escopo e sidecar com teste unitário; apps só com tarball |
| TOK-05, IA-04 | Lockfile congelado, toolchain exata, `envMode: strict`, determinismo sem cache |

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| `turbo boundaries` experimental | Versão exata; fixtures detectam mudança de comportamento; checks (b) e (c) independem dele |
| pnpm 11 sair de manutenção | Migração para o 12 por PR de toolchain; pnpm só por action fixada ou com integridade no lockfile |
| Maturidade e bus factor do TRRC (claims de papel desde 2026-09-17, um mantenedor); token OIDC curto; claims mal configurados | Teste recorrente de PUT com 403; imagem por digest no SBOM e no inventário; sidecar no desenho base; escrita atrelada ao `job_workflow_ref`; plano B |
| Cache indisponível; fork sem cache remoto | Segue com cache local, mais lento; risco à mediana de 15 min da premissa do QA-11 (Desejável, só vale se contratado) |
| Node 24 em Maintenance; TS 6.0 com poucas correções | Toolchain para Node 26 em até cerca de 12 meses; reavaliar TS na 7.1 |

## Pendências com o requerente

| Tema | Premissa usada | Impacto |
| --- | --- | --- |
| Piso de Node (ENG-08, decisão "Versões mínimas") | Node 22 LTS; proposta: subir para 24, pois o 22 tem EOL em 2027-04-30 e subir `engines` depois força major; MIG-01 como insumo | `engines` e matriz |
| Piso de TypeScript (`<versão>` da mesma decisão) | TS 6.0 provisório | Emissão e matriz de tipos |
| Plataforma de repositório e CI | GitHub e GitHub Actions, inferidos do ENG-18 | OIDC do cache, ENG-13, ENG-14, workflows |
| Hospedagem do cache remoto (ENG-03) | Conta, região, residência de dados e retenção a indicar na feature de CI | Prova do ENG-03 |

## Referências

- pnpm: https://registry.npmjs.org/pnpm; https://github.com/pnpm/pnpm/releases/tag/v11.0.0; https://pnpm.io/supply-chain-security; https://pnpm.io/settings/build; https://pnpm.io/catalogs; https://pnpm.io/cli/sbom; https://pnpm.io/cli/licenses
- Turborepo: https://registry.npmjs.org/turbo; https://turborepo.dev/docs/reference/boundaries; https://turborepo.dev/docs/reference/run; https://turborepo.dev/docs/reference/configuration; https://turborepo.dev/docs/core-concepts/remote-caching; https://github.com/vercel/turborepo/blob/main/crates/turborepo-boundaries/src/lib.rs
- Cache: https://github.com/ducktors/turborepo-remote-cache; https://ducktors.github.io/turborepo-remote-cache/environment-variables; https://docs.github.com/en/actions/reference/security/oidc; https://vercel.com/docs/monorepos/remote-caching/external-ci-cd
- Alternativas e toolchain: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages; https://moonrepo.dev/docs/guides/remote-cache; https://rushjs.io/pages/maintainer/build_cache/; https://registry.npmjs.org/eslint-plugin-import-x; https://github.com/nodejs/Release; https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/; https://registry.npmjs.org/typescript-eslint
