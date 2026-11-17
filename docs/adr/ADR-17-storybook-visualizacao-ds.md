# ADR-17: Storybook como camada de visualização do DS

**Status**: Proposto | **Data**: 2026-11-12 | **Feature**: 002-components | **Relaciona**: ADR-16, ADR-08; Princípio XIII (DOC-01/03/11), Princípio I (ADR-06), Princípio VIII, Princípio VII (QA-01)

## Contexto

A feature de componentes precisa de uma camada de **visualização e organização** para designers e devs navegarem componentes isolados (padrão de indústria). A 002 já decidiu (research.md §5, task T022) que o comportamento é autorado como **CSF stories que rodam como teste** via Vitest Browser Mode + `@storybook/addon-vitest` (um só runner, navegador real). Falta a camada de **viewer/docs** sobre essas stories.

Forças da constituição em jogo:

- **Princípio XIII / DOC-01**: cada página de componente MUST mostrar exemplos **React e Vue** e a API; o CI falha se faltar um framework suportado. **DOC-03/DOC-11**: documentação derivada das fontes declaradas; tabela de props ou de tokens escrita à mão é uma **segunda fonte proibida**.
- **Princípio I (ADR-06) / Princípio VIII**: tudo que é derivado vem do **catálogo gerado + tipos exportados**, nunca mantido à mão; o catálogo é a fonte legível por ferramentas e agentes.
- **Princípio VII / QA-01**: validação em navegador real; nada de DOM simulado.
- **ENG (determinismo e cadeia de suprimentos)**: versão exata, sem script de instalação não aprovado, sem rede/telemetria de terceiros. O ADR-16 já antecipou isto: "stories como testes chegam com os componentes, no mesmo runner (`vitest ^4 || ^5`, addon-vitest)" e registrou **`esbuild` na allowlist do ENG-24 "quando o Storybook entrar"**.

Este ADR **não modifica os ADR-01 a ADR-10** e implementa ADR-08/Princípio XIII sem alterá-los, portanto dispensa pedido de mudança (GOV-07). Formaliza a adoção do Storybook como **DX adicional** — viewer, não fonte.

## Decisão

**1. Storybook = viewer sobre artefatos gerados, não fonte.** Renderiza as **mesmas CSF stories** que já rodam como teste (addon-vitest). Uma story, dois usos (teste + viewer). **Zero stories novas só para documentação.**

**2. Multi-framework — um Storybook por pacote/framework.** Storybook é single-framework por instância, então **cada pacote de framework tem o SEU Storybook**: `pato-react` (`@patods/react`) com `@storybook/react-vite`, `pato-vue` (`@patods/vue`) com `@storybook/vue3-vite`, cada um com o renderer e o docgen nativos; ambos consomem a base compartilhada `pato-core` (tokens + core CSS agnóstico). **NÃO existe um Storybook único renderizando os dois.** Para um portal unificado do DS, usar **Storybook Composition** (`refs` compondo o SB do React + o do Vue numa navegação só) — camada de cima **opcional**. A exigência de React E Vue por componente (Princípio XIII/DOC-01) é atendida pelo **docs site gerado do catálogo** (tabela de equivalência das duas superfícies + exemplos dos dois frameworks) e pelo portal de Composition — **não** forçando as duas renderizações numa mesma página de um Storybook único. A matriz **theme×mode** é um toolbar global (`globalTypes` + decorator) que seta `data-patods-brand`/`-mode` na raiz do preview, não por stories duplicadas.

**3. Autodocs derivado de tipos + catálogo (Princípio I/VIII).** A tabela de API vem do **docgen** (react-docgen / vue-docgen a partir dos `.d.ts`/TSDoc — fonte declarada, aceitável). Os dados do **catálogo gerado** (contrato de DOM, tokens consumidos, declaração de conformância a11y, tabela de equivalência, stage) entram por um **doc block gerado que LÊ o catálogo**. **Proibido** escrever tabela de props ou de tokens à mão em MDX (seria 2ª fonte; DOC-03/DOC-11). Todo MDX é casca gerada, não conteúdo à mão; o docs site é regenerado no CI e conferido por diff (determinismo, como os demais artefatos gerados).

**4. Determinismo e cadeia de suprimentos.** Versões **exatas** no catálogo pnpm (idade ≥ `minimumReleaseAge`, aprovação de dono, ENG-07/16/25). **Telemetria do Storybook desligada** (`core: { disableTelemetry: true }` + `STORYBOOK_DISABLE_TELEMETRY=1`), **sem analytics/tracker de terceiros**. **Build estático** (`storybook build`) servido **offline**, como as apps de exemplo (ADR-08/QA-01). `esbuild` fica na allowlist do ENG-24 com execução bloqueada; qualquer outro script de instalação falha o CI.

**5. Fronteira de fonte.** Catálogo + app de exemplo (consumidora do tarball, QA-06) + docs site **continuam a fonte**. Storybook **não substitui nem duplica** nada: é camada de DX sobre o que já é gerado.

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| Docusaurus / VitePress com páginas à mão | Conteúdo de API/tokens escrito à mão = 2ª fonte (DOC-03/DOC-11); não roda a story como teste |
| MDX de documentação com tabelas à mão | Mesma violação de fonte única; diverge do catálogo |
| Um Storybook "multi-framework" único | Storybook é single-framework por instância; forçar um renderer único quebra "nativo em cada framework" (ADR-01/ADR-04) e o docgen nativo |
| Histoire (viewer Vue) | Só Vue; não atende React na mesma ferramenta (DOC-01) |
| Só a app de exemplo, sem viewer | Não dá navegação por componente isolado nem autodocs; DX pobre para designers |
| Storybook com telemetria/tracker ligado | Viola ENG (sem rede/terceiros); desligado por config |

## Consequências

**Positivas**: um só runner (Vitest) serve teste e viewer (addon-vitest, já no ADR-16); a mesma story prova e documenta; API e dados vêm do catálogo/tipos, então docs não diverge do código; React e Vue na mesma página satisfazem DOC-01; build estático offline respeita ADR-08.

**Negativas**: um Storybook por framework (dois) + o portal de Composition opcional; o docs site precisa reunir React e Vue a partir do catálogo (mecanismo de composição/embed a fechar na implementação); mais superfície de dependência (pin + allowlist).

**Neutras**: o docs site pode ganhar busca/versões depois; o mecanismo de composição (refs vs embed por iframe) pode evoluir sem mudar a decisão de fonte.

## Requisitos atendidos

| ID | Como |
| --- | --- |
| Princípio XIII, DOC-01 | React e Vue na mesma página de componente; CI falha se faltar framework |
| DOC-03, DOC-11, Princípio I, ADR-06 | Autodocs de docgen (tipos) + doc block que lê o catálogo; proibida tabela à mão |
| Princípio VIII | O catálogo gerado alimenta as páginas; Storybook não cria fonte nova |
| Princípio VII, QA-01, ADR-08 | Stories rodam em navegador real (addon-vitest); build estático servido offline |
| ENG-07, ENG-16, ENG-24, ENG-25 | Pin exato, telemetria off, esbuild na allowlist, aprovação de dono |

## Riscos e mitigação

- **React e Vue no mesmo DS**: cada framework tem o seu Storybook (single-framework por instância). Mitigação: **Storybook Composition** (`refs`) para o portal unificado, e o **docs site gerado do catálogo** reúne os exemplos dos dois frameworks por componente (DOC-01); o mecanismo exato de composição/embed se confirma no setup (T073–T075).
- **Autodocs virar 2ª fonte**: lint/CI que falha se houver MDX com tabela de props/tokens à mão; só docgen + doc block do catálogo são permitidos.
- **Telemetria/rede**: `disableTelemetry` + variável de ambiente + check de rede no build offline.
- **Versão nova do Storybook**: pin exato; a entrada do `esbuild` no ENG-24 já prevista.

## Pendências com o requerente

- Mecanismo exato do portal (Storybook Composition por `refs`) e de como o docs site reúne React+Vue por componente a partir do catálogo — a confirmar no aceite da Fase 1.
- **Estrutura de pacotes (decisão do Deyvid, 2026-11-12 — RESOLVIDA)**: `pato-core` = **`@patods/core`** (base: core CSS agnóstico), consumido por `pato-react` (`@patods/react`) e `pato-vue` (`@patods/vue`); mantém-se o scope **`@patods/*`**. `@patods/core` **DEPENDE** de `@patods/tokens` (001 intacto, NÃO absorvido) → camada `tokens → core → frameworks` preservada (ENG-01). Reflexo em `plan.md` (Project Structure).
- Versão do Storybook e do builder Vite a pinar (a mais recente que cumpra `minimumReleaseAge`).
- Se o docs site é publicado (e onde) ou só gerado/servido offline no CI.

## Referências

- https://storybook.js.org/docs/writing-stories ; https://storybook.js.org/docs/writing-docs/autodocs ; https://storybook.js.org/docs/api/main-config/main-config-refs ; https://storybook.js.org/docs/configure/telemetry ; https://www.npmjs.com/package/@storybook/addon-vitest ; https://registry.npmjs.org/storybook
- [research.md](../../specs/002-components/research.md) §5, [plan.md](../../specs/002-components/plan.md), [spec.md](../../specs/002-components/spec.md); ADR-16 ([lint-tokens-e-testes](./ADR-16-lint-tokens-e-testes.md))
