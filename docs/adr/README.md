# Registro de decisões de arquitetura (ADR)

Toda decisão de arquitetura é registrada em ADR numerado, com status e data, antes de ser
implementada (GOV-07). PR com rótulo de arquitetura vincula um ADR aceito. ADR que altere ADR-01 a
ADR-10 cita pedido de mudança aprovado pelo requerente.

Status possíveis: **Proposto** (aguarda aprovação de dono, GOV-09), **Aceito**, **Substituído por
ADR-NN**, **Rejeitado**.

## ADRs do contrato

ADR-01 a ADR-10 estão em [docs/requisitos.md](../requisitos.md), seção "Decisões de arquitetura".
São decisões tomadas pelo requerente; mudar qualquer uma exige pedido de mudança e novo ADR.

| ID | Decisão |
| --- | --- |
| ADR-01 | Núcleo agnóstico de tokens e CSS, implementação nativa em cada framework sobre primitivos headless |
| ADR-02 | Tokens DTCG como fonte única da aparência |
| ADR-03 | CSS com classes prefixadas e `@layer`, publicado pelo núcleo |
| ADR-04 | Biblioteca headless mantida em cada framework (escolha via CMP-28) |
| ADR-05 | Contrato de API nos tipos TypeScript exportados |
| ADR-06 | Catálogo único compilado no build |
| ADR-07 | MCP local e CLI somente leitura |
| ADR-08 | Stories como testes em navegador real |
| ADR-09 | Monorepo único com fronteiras de camada por lint |
| ADR-10 | Migração incremental com coexistência |

## ADRs do projeto

| ID | Título | Status | Data | Feature |
| --- | --- | --- | --- | --- |
| [ADR-11](ADR-11-pipeline-build-tokens.md) | Pipeline de build de tokens | Proposto | 2026-10-21 | 001 |
| [ADR-12](ADR-12-monorepo-toolchain.md) | Monorepo: gerenciador de pacotes, orquestrador e toolchain | Proposto | 2026-10-21 | 001 |
| [ADR-13](ADR-13-escopos-marca-modo-css.md) | Escopos de marca e modo em CSS | Proposto | 2026-10-21 | 001 |
| [ADR-14](ADR-14-sincronizacao-ferramenta-design.md) | Sincronização com a ferramenta de design | Proposto | 2026-10-21 | 001 |
| [ADR-15](ADR-15-cor-e-contraste.md) | Motor de cor e checagem de contraste | Proposto | 2026-10-21 | 001 |
| [ADR-16](ADR-16-lint-tokens-e-testes.md) | Lint de tokens e pilha de testes | Proposto | 2026-10-21 | 001 |
