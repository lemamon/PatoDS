# Implementation Plan: Design tokens e temas

**Branch**: `001-design-tokens-themes` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-design-tokens-themes/spec.md`

## Summary

Entregar a fonte única de tokens do PatoDS em DTCG 2025.10, com três camadas, marca e modo como
modificadores ortogonais do Resolver, validação completa no CI, saídas determinísticas (CSS por
marca com escopos aninhados, ESM tipado, manifestos, relatório), checagem de contraste em todas as
combinações, lint de estilos guiado por manifesto e sincronização com a ferramenta de design em
portas e adaptadores, sem escolher a ferramenta.

Abordagem técnica ([research.md](research.md)):

- Build sobre `@terrazzo/parser` como biblioteca, com regras e formatadores próprios rodando sobre
  todas as permutações marca × modo (D1).
- Monorepo pnpm 11 + Turborepo 2, Node 24 LTS na toolchain (D2).
- CSS puro com toggles de espaço, um `base.css` neutro e um arquivo por marca, `@layer
  <prefixo>.tokens` (D3).
- Sincronização em portas e adaptadores com fake em memória; adaptador real só após a decisão do
  requerente (D4).
- colorjs.io atrás de adaptador único, WCAG 2.2 próprio, composição alfa sobre pilha opaca (D5).
- Regra Stylelint própria, Vitest, tsc sobre tarball, Playwright em navegador real (D6).
- Modelo da fonte que atende juntos FR-011, FR-012, FR-017, DSN-04 e DSN-05 (D7, FR-033).

Decisões registradas como ADR-11 a ADR-16 ([docs/adr/](../../docs/adr/README.md)), status
Proposto até aprovação de dono (GOV-07, GOV-09).

## Technical Context

**Language/Version**: TypeScript 6.0.x (compilador único de emissão) sobre Node.js 24.x LTS
(`.node-version`). Piso de `engines` e da matriz ENG-08 pela premissa vigente: Node 22 LTS;
"mais recente": Node 26 LTS a partir de 2026-10-28. Eixo TS 7.0.x só para `tsc` nos testes de tipos.

**Primary Dependencies**: `@terrazzo/parser` e `@terrazzo/token-tools` 2.9.0 (exatos, via
`overrides`), `ajv` 8.x exato, `colorjs.io` 0.7.1, `stylelint` 17.16.x com `@csstools/*` 4.x e
`postcss-selector-parser` 7.x. Todas como devDependencies de pacotes `tools/*`; o pacote publicado
`@<prefixo>/tokens` não tem dependência de runtime.

**Storage**: arquivos versionados (fonte DTCG, manifestos, configurações em `quality/`); saídas
geradas em `dist/` fora do controle de versão; log de sincronização como asset de release.

**Testing**: Vitest 5.0.x (unidade, ambiente Node), `tsc --noEmit` + `expect-type` em projeto
consumidor do tarball (TS 6.0.x e 7.0.x), `publint`, `@playwright/test` 1.64.x em imagem oficial
fixada por digest, scripts próprios de determinismo, drift, varredura e camadas. TS 7.0.x entra só
no projeto consumidor de tipos, por catálogo nomeado do pnpm (`catalogs.typescript7`), sem conflito
com o `catalogMode: strict` do TS 6.0 da toolchain.

**Target Platform**: navegadores da lista versionada (premissa ENG-08, valores pendentes); o
mecanismo CSS exige só `@layer`, já exigido pelo ADR-03. CI em GitHub Actions (premissa a
confirmar).

**Project Type**: biblioteca (pacote de tokens) + ferramentas de build e CI em monorepo.

**Performance Goals**: build e validação curtos o bastante para o pipeline caber no limite do QA-11
se ele for contratado (Desejável; premissa: mediana de 15 min no PR inteiro); CSS de tokens medido contra o orçamento de bundle do QA-07 (cerca de
5,6 KB gzip por marca com 350 tokens sintéticos).

**Constraints**: saída byte a byte idêntica entre builds, caminhos, fusos, locales, runners e Node
piso/mais recente (FR-015, SC-002); nenhuma rede no build (`$ref` remoto bloqueado); nenhum token
fora da fonte (FR-001); lockfile congelado e nenhum script de instalação fora da allowlist (ENG-16,
ENG-24); nenhuma rotina importa variáveis da ferramenta para o repositório (FR-025).

**Scale/Scope**: N marcas × 2 modos (N pendente com o requerente); 11 categorias; ordem de centenas
de tokens; 1 pacote publicado e 6 pacotes privados de ferramenta.

Sem NEEDS CLARIFICATION técnico em aberto: todos resolvidos em [research.md](research.md). Itens
que só o requerente decide seguem premissas vigentes (research.md, "Perguntas ao requerente").

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliação inicial (antes da pesquisa) e reavaliação após o design (Phase 1). Todas as respostas
"sim"; nenhuma violação.

| # | Pergunta (Constituição, Fluxo Spec Kit) | Inicial | Pós-design | Evidência no design |
| --- | --- | --- | --- | --- |
| 1 | Todo dado de componente ou de token vem das três fontes e todo consumidor o obtém do derivado, sem cópia à mão? (I) | Sim | Sim | Fonte DTCG única; CSS, ESM, manifestos e sync-manifest derivados; valores esperados dos testes vêm do mapa gerado; varredura do FR-001 |
| 2 | Estilos consomem só semânticos ou de componente, e a sincronização segue a direção vigente com divergências detectadas? (II) | Sim | Sim | Lint `primitive-token`, `literal-value`, `brand-mode-source-token`; porta sem operação ferramenta → repositório; detecção semanal e por versão |
| 3 | Pacotes de framework sem CSS, núcleo sem seletor de primitivo headless, interativos sobre headless? (III) | Sim | Sim | Não se aplica diretamente (sem componentes); CSS de tokens fica no pacote de tokens, em `@layer`, com prefixo |
| 4 | Paridade de API, DOM e comportamento React/Vue mantida? (IV) | Sim | Sim | Tokens são neutros de framework; testes React/Vue de tema aninhado ficam na feature de componentes |
| 5 | Cobertura de motor de regras, teclado, foco, reflow, alvo, contraste, declaração e exceções? (V) | Sim | Sim | Contraste de todos os pares em todas as permutações (FR-019 a FR-021); demais itens são de componentes |
| 6 | SSR, RSC, CSP, i18n e uso sem provedor válidos? (VI) | Sim | Sim | CSS puro por atributos, sem JS e sem estilo injetado; combinação padrão sem provedor (FR-013) |
| 7 | Testes em navegador real, matriz de motores, limiares do arquivo do QA-14? (VII) | Sim | Sim | Playwright em Chromium/Firefox/WebKit; mínimos de contraste em `quality/thresholds.json`; app de exemplo consome o tarball |
| 8 | Dados para agentes do catálogo, ferramentas somente leitura? (VIII) | Sim | Sim | Não se aplica (catálogo e MCP em outras features); manifestos de tokens serão insumo do catálogo |
| 9 | Dependências, segredos, publicação e ativos seguem a cadeia de suprimentos? (IX) | Sim | Sim | Pinos exatos, `minimumReleaseAge`, `allowBuilds`, política de licenças, actions por SHA, credenciais em environments, segredos fixos justificados |
| 10 | SemVer, estágio e depreciação respeitados? (X) | Sim | Sim | Remoção ou renomeação de token = major; relatório de API de tokens versionado |
| 11 | Fronteiras de camada válidas? (XI) | Sim | Sim | Tags `tokens`, `tools`, `apps` em `turbo.json`; ferramentas só como devDependency; `tools/color` folha |
| 12 | Coexistência com legados sem conflito? (XII) | Sim | Sim | Prefixo em variáveis e atributos; `@layer <prefixo>.tokens`; ordem das camadas de fonte única (MIG-14) |
| 13 | Documentação cobre React e Vue, gerada do catálogo, exemplos, README, links? (XIII) | Sim | Sim | README do pacote de tokens (DOC-08) e convenção de nomes; site e fundamentos na feature de docs |
| 14 | Dentro do escopo e do Inventário, prioridade respeitada, premissas citadas? (Restrições) | Sim | Sim | TOK-12 condicional; premissas citadas em spec, research e ADRs; nenhuma decisão do requerente tomada |

## Project Structure

### Documentation (this feature)

```text
specs/001-design-tokens-themes/
├── plan.md              # Este arquivo
├── research.md          # Phase 0: decisões D1 a D7
├── research/            # Relatórios brutos por tópico, com reverificação
├── data-model.md        # Phase 1: entidades e regras V-01 a V-16
├── quickstart.md        # Phase 1: guia de validação
├── contracts/           # Phase 1
│   ├── token-source.md
│   ├── css-output.md
│   ├── esm-output.md
│   ├── contrast-manifest.md
│   ├── lint-rules.md
│   ├── build-manifests.md
│   ├── design-sync.md
│   └── tools-cli.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)

docs/adr/                # ADR-11 a ADR-16 (Proposto)
```

### Source Code (repository root)

```text
package.json                 # scripts raiz via turbo; packageManager pnpm 11 exato
pnpm-workspace.yaml          # workspaces, catalog strict, allowBuilds, minimumReleaseAge
stylelint.config.mjs         # gate do lint de estilos (fixtures nesta feature)
turbo.json                   # tarefas, globalDependencies, boundaries.tags (arquivo de camadas)
.node-version                # 24.x
.gitattributes               # LF
quality/
├── thresholds.json          # QA-14 (seção de contraste nesta feature)
├── license-policy.json      # ENG-21
└── scan-allowlist.json      # varredura do FR-001
packages/
└── tokens/                  # @<prefixo>/tokens (publicado)
    ├── src/
    │   ├── tokens.resolver.json
    │   ├── layers.json         # fonte única da ordem das camadas @layer
    │   ├── primitive/*.tokens.json
    │   ├── semantic/invariant.tokens.json
    │   ├── semantic/brand/<id>.tokens.json
    │   ├── semantic/mode/{light,dark}.tokens.json
    │   └── component/*.tokens.json
    ├── contrast/{manifest.json,surfaces.json,manifest.schema.json,surfaces.schema.json}
    ├── schemas/dtcg-2025.10/  # cópias versionadas + SHA256SUMS + licença W3C
    ├── api/tokens.api.json    # relatório de API versionado
    └── dist/                  # gerado, fora do git
tools/
├── tokens-build/            # adaptador do parser, validadores, formatadores, writer
├── color/                   # folha: toEmittedSrgb, WCAG, composição
├── tokens-contrast/         # checker do manifesto de contraste
├── stylelint-plugin/        # <prefixo>/design-tokens e <prefixo>/contrast-pairs + fixtures
├── design-sync/             # núcleo, portas, fake em memória, adaptadores GitHub; design-sync.config.json (SLA)
└── repo-checks/             # determinismo, drift, varredura do FR-001, camadas
apps/
└── tokens-example/          # Vite 8 sem framework, instala o tarball; testes Playwright
tests/
└── types-consumer/          # tsc estrito sobre o tarball (TS 6.0 e 7.0)
docs/
├── adr/
└── tokens/convencao-de-nomes.md
.github/
├── CODEOWNERS               # donos por área, incluindo o papel dono da sincronização (DSN-02)
└── workflows/
    ├── tokens-ci.yml        # validação, build, testes, checks (PR, noturno)
    └── design-sync.yml      # pós-promoção, cron semanal, dispatch manual
```

**Structure Decision**: monorepo do ADR-09 com três camadas nesta feature: `tokens` (pacote
publicado), `tools` (privados, só devDependency) e `apps` (consumidores do tarball). Esta é a
primeira feature, então ela cria o esqueleto do monorepo (workspace, turbo, toolchain, arquivo de
camadas com as tags que usa). Os checks completos do ENG-01 (fixtures em `.vue`, regras de import no
ESLint) e o cache remoto do ENG-03 ficam na feature de CI e governança, que reaproveita esta base.
Até o requerente entregar as marcas, `packages/tokens/src` usa marcas de espaço reservado (`a`,
padrão, e `b`) com valores sintéticos; elas não são publicadas no registro.

## Phase 0: Research (concluída)

[research.md](research.md): sete decisões (D1 a D7), alternativas, riscos, ajustes ao spec e
perguntas ao requerente. Cada tópico foi pesquisado na web e reverificado por revisor cético;
relatórios brutos em [research/](research/).

## Phase 1: Design & Contracts (concluída)

- [data-model.md](data-model.md): entidades do spec, campos, regras V-01 a V-16, estados da
  sincronização e da divergência.
- [contracts/](contracts/): fonte DTCG e convenção, CSS gerado, ESM gerado, manifestos e relatório
  do build, manifesto de contraste, regras de lint, sincronização e CLIs.
- [quickstart.md](quickstart.md): cenários de validação por user story, com comandos e resultados
  esperados.
- ADR-11 a ADR-16 em [docs/adr/](../../docs/adr/README.md).
- Spec ajustado com as clarificações da pesquisa e do design (seção Clarifications; FR-009, FR-013,
  FR-017, FR-020, SC-005, SC-006 e novo FR-033).
- Decisões de fechamento (research.md, D8): ordem das camadas em `src/layers.json`; só tokens
  atômicos publicáveis (sem `typography` composto); relatório de API regenerado conta como arquivo de
  tokens no diff de nova marca.

## Implementation Strategy (insumo para /speckit-tasks)

Ordem sugerida, alinhada às prioridades das user stories:

1. **Fundação** (bloqueia tudo): `git init`, esqueleto do monorepo (pnpm, turbo, toolchain,
   `quality/`, arquivo de camadas), CI mínimo com actions por SHA, cópias dos schemas DTCG.
2. **US1 (P1)**: `tools/tokens-build validate` com índice de origem, regras V-01 a V-13, relatório;
   fonte inicial com marcas de espaço reservado; varredura do FR-001.
3. **US2 (P2)**: formatadores CSS (`base.css`, `brand-<id>.css`) e ESM; manifestos; determinismo e
   drift; app de exemplo do tarball com os casos de navegador real; testes de tipos.
4. **US3 (P3)**: teste de marca adicional (C) com diff restrito à fonte; troca em runtime.
5. **US4 (P4)**: `tools/color`, manifesto de contraste, `tools/tokens-contrast`, amostras em
   navegador real com axe.
6. **US5 (P5)**: `tools/stylelint-plugin` com fixtures e gate.
7. **US6 (P6)**: `tools/design-sync` (núcleo, portas, fake, suíte de contrato, adaptadores GitHub),
   workflow com gatilhos; adaptador real após a decisão do requerente.
8. **Fechamento**: entradas na matriz de rastreabilidade (FR-031), README do pacote, convenção de
   nomes, revisão de conformidade com a constituição.

Paralelizável depois da fundação: US4 (`tools/color`) e US6 (`tools/design-sync`) não tocam os
arquivos de US2 e US3 até a integração com o manifesto.

## Riscos principais

| Risco | Mitigação |
| --- | --- |
| Bus factor e cadência do Terrazzo | Adaptador fino, versão exata, saídas de ouro, test-suite oficial DTCG, Style Dictionary como troca |
| `turbo boundaries` experimental | Check de manifesto pnpm e regras de import no ESLint como checks obrigatórios |
| Interpretação de "variável sem valor" no aceite do ENG-06 | Definição operacional no spec, confirmação com o aceitante |
| Ferramenta de design sem escrita automática no plano contratado | Capacidades `manual` e `agent-mcp` criam item rastreável; decisão e eventual pedido de mudança com o requerente |
| Determinismo entre versões de Node e ICU | Ordenação própria por code point; comparação entre Node piso e mais recente |
| Licenças transitivas fora de MIT/Apache/BSD | Política do ENG-21 com o conjunto real (MPL-2.0 só dev, MIT-0, CC0, Python-2.0, W3C) e override revisado do `svg-tags` |

## Complexity Tracking

Nenhuma violação da constituição a justificar.
