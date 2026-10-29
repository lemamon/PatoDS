# ADR-14: Sincronização com a ferramenta de design

**Status**: Proposto | **Data**: 2026-10-21 | **Feature**: 001-design-tokens-themes | **Relaciona**: ADR-02, ADR-07 (espírito somente leitura); premissa "Ferramenta de design e direção da sincronização de tokens"

## Contexto

O ADR-02 do contrato fixa tokens DTCG versionados como fonte única da aparência e deixa em aberto a ferramenta de design e a direção da sincronização. A premissa "Ferramenta de design e direção da sincronização de tokens", decisão de Design e engenharia do requerente com prazo antes do início da Fase 1, estabelece que o repositório é a fonte e a ferramenta recebe as variáveis. Este ADR decide a arquitetura que atende DSN-01 a DSN-05 e a parte de tokens do DSN-11 (FR-025 a FR-030 e FR-033) **sem escolher a ferramenta**, que continua com o requerente. Ele implementa o ADR-02, preserva o espírito somente leitura do ADR-07 e não altera nenhum dos ADR-01 a ADR-10, de modo que não há pedido de mudança (GOV-07). As forças em jogo são estas:

- A maior parte do FR-025 ao FR-030 não depende da ferramenta: diff, log, restauração de edição manual, itens rastreáveis com responsável e prazo, alertas e determinismo. Essa parte pode ser construída e testada agora, sem credenciais (QA-02), e os limites da ferramenta escolhida voltam ao plano depois, como pede o spec (Assumptions).
- A direção é única: nenhuma rotina importa variáveis da ferramenta para o repositório (DSN-01, FR-025, Princípio II, cenário 6 da US6). No espírito do ADR-07, a ferramenta de sincronização não altera código nem dados do repositório. O ADR-07 trata do MCP e da CLI para agentes, que continuam locais e somente leitura e não participam desta sincronização.
- As ferramentas candidatas diferem em API de escrita, plano exigido, limite de modos, escopo da troca de modo e publicação de biblioteca (fatos verificados em 2026-10-21, research D4). Nenhuma oferece credencial federada (ENG-13).
- O FR-033 (ADR-11) expressa toda variação marca × modo como token de eixo modo com alias para um token-fonte de eixo marca sob o grupo raiz reservado `brand.`, o que permite eixos ortogonais na ferramenta sem variáveis auxiliares (DSN-04, DSN-05).
- A plataforma de repositório e CI é premissa (GitHub e GitHub Actions, inferidos do ENG-18; ADR-12) e será decidida na feature de CI.

## Decisão

**1. Pacote e CLI.** `@<prefixo>/design-sync` em `tools/design-sync`, `private: true`, nunca publicado, camada `tools`. Não tem dependência de runtime: usa só `fetch`, `crypto`, `fs` e `util.parseArgs` do Node. Sua única aresta no workspace é `@<prefixo>/tokens` como devDependency, para ler `./meta/*` (ADR-12). A arquitetura é de portas e adaptadores: núcleo puro e determinístico, três portas e adaptadores (fake em memória, GitHub para tracker e alerta e, só após a decisão do requerente, o da ferramenta). Script raiz: `pnpm design-sync -- plan|apply|detect --adapter memory`.

```text
design-sync plan|apply|detect|check-access --adapter memory|<ferramenta> [--json]
exit 0 ok | 1 divergência, escrita manual pendente ou plano não vazio com --fail-on-changes | 2 uso ou configuração | 3 erro interno | 4 acesso ou credencial | 5 verify divergente após apply
```

**2. Contrato de entrada.** O núcleo depende só de `dist/meta/sync-manifest.json`, gerado pelo `tokens-build` (ADR-11), neutro de ferramenta e versionado como contrato; ele não lê a sintaxe do Resolver. O estado desejado é o manifesto da versão promovida, lido do pacote publicado, idêntico ao build da tag pelo TOK-05; o da versão anterior serve à classificação de divergência. Literais chegam serializados pelo build (cores por `toEmittedSrgb()`, ADR-15), e o adaptador só converte para o formato nativo. Forma ilustrativa (o contrato exato fica em `specs/001-design-tokens-themes/contracts/design-sync.md`):

```json
{ "format": "<prefixo>.sync-manifest", "version": 1, "source": { "package": "@<prefixo>/tokens", "version": "1.2.0" },
  "axes": [ { "id": "brand", "contexts": ["a", "b"], "default": "a" }, { "id": "mode", "contexts": ["dark", "light"], "default": "light" } ],
  "variables": [ { "key": "color.bg.surface", "path": ["color", "bg", "surface"], "collection": "mode", "type": "color", "cssName": "--<prefixo>-color-bg-surface",
    "values": { "dark": { "alias": ["brand", "color", "bg", "surface", "dark"] }, "light": { "alias": ["brand", "color", "bg", "surface", "light"] } } } ] }
```

**3. Topologia na ferramenta.** Uma coleção, ou grupo de tema, por eixo; marca e modo nunca dividem a mesma coleção:

| Coleção | Modos | Conteúdo |
| --- | --- | --- |
| Primitivos | sem modos | Camada primitiva, com literais |
| Marca | um por marca | Tokens públicos de eixo marca, inclusive os tokens-fonte `brand.<categoria>…<modo>` (papel `brand-mode-source`) |
| Modo | `light`, `dark` | Tokens de eixo modo, cujo valor em cada modo é alias para o token-fonte `brand.…<modo>` |
| Semânticos invariantes | sem modos | Tokens semânticos invariantes |
| Componentes | sem modos | Tokens de componente |

- **Zero variáveis auxiliares**: toda variável corresponde a um token real (FR-033, DSN-04), e o núcleo recusa criar variável sem token. Se os dados de marca tornarem o FR-033 impossível, o caso vai ao requerente ou a pedido de mudança, nunca a exceção autodeclarada no relatório. Os toggles privados `--<prefixo>-_on-light` e `--<prefixo>-_on-dark` (ADR-13) são mecanismo de CSS, não tokens, e não vão para a ferramenta.
- Nomes: os mesmos segmentos do token, unidos pelo separador da ferramenta definido em `docs/tokens/convencao-de-nomes.md` (`/` no Figma, que não aceita `.`, `{` nem `}` em nomes; `.` no Penpot). A convenção também fixa onde a coleção fica em relação ao caminho; o relatório compara arrays de segmentos normalizados.
- Onde houver a capacidade `hiddenVariables`, os tokens-fonte `brand.` ficam ocultos da publicação, espelhando a regra `brand-mode-source-token` (ADR-16), sem mudar nome nem hierarquia; o spike do adaptador confirma que isso preserva os seletores de modo independentes por quadro.

**4. Portas.** Nenhuma operação leva dados da ferramenta para o repositório; `readSnapshot` serve só ao plano, ao verify e à detecção. Isso garante o FR-025 e o cenário 6 da US6 por construção.

```ts
// Assinaturas resumidas; os tipos completos (DesignToolCapabilities, SyncPlan, TrackedItem, SyncAlert etc.)
// ficam em specs/001-design-tokens-themes/contracts/design-sync.md, seção 4.
interface DesignToolPort { capabilities(): DesignToolCapabilities; // modos por eixo, axisScope, aliases, read, write, publish, lotes
  checkAccess(): Promise<AccessReport>; // autenticação, escopos, plano, validade
  readSnapshot(): Promise<ToolSnapshot>; // estado normalizado, local e publicado separados
  apply(plan: SyncPlan, options: { dryRun: boolean }): Promise<ApplyResult>; requestPublish(release: ReleaseRef): Promise<PublishOutcome> }
interface TrackerPort { upsert(item: TrackedItem): Promise<UpsertResult>; // {fingerprint, kind, title, body, owner: RoleRef, due, labels}
  resolve(fingerprint: Fingerprint, note: string): Promise<ResolveResult>; listOpen(filter?: { kinds?: TrackedItemKind[] }): Promise<readonly OpenItem[]> }
interface AlertPort { raise(alert: SyncAlert): Promise<void> } // {fingerprint, severity, error: SyncError, owner: RoleRef, tool, runUrl}
```

**5. Núcleo.**
- Plano com ordenação por code point (nunca `localeCompare`), JSON canônico e sha256 do snapshot. Operações idempotentes na ordem coleções → modos → variáveis → valores → remoções, fatiadas pelo `maxAtomicBatchBytes` do adaptador.
- Renomeação manual é desfeita pela chave do token guardada em campo da ferramenta (descrição ou code syntax), o que preserva as ligações de camada dos designers. Mudança de tipo é recriação, sinalizada no log como quebra (no Figma, `resolvedType` é imutável). Remoções vêm por último e só dentro das coleções gerenciadas; variável extra nelas é edição manual, removida e registrada (DSN-03).
- A classificação compara o estado real com o desejado da versão anterior e da atual, e separa "mudança de release" de "edição manual restaurada" (FR-027).
- `apply` repete em 429 respeitando `Retry-After`. O verify relê a ferramenta e exige diff vazio; caso contrário, sai com código 5 e alerta. Execução interrompida converge na seguinte, planejada a partir de snapshot novo.
- Log em JSON canônico e Markdown: versão, link do changelog (GOV-03), mudanças por caminho, edições restauradas e digests da fonte e do snapshot. Timestamp e URL da execução ficam num envelope separado, e o conteúdo é idêntico byte a byte para as mesmas entradas. O log segue como asset da release e artefato do workflow.
- Capacidade `manual` de escrita ou publicação não falha em silêncio: abre item rastreável para o dono da sincronização, com prazo e instruções prontas (por exemplo, "publicar biblioteca vX.Y.Z" com trecho do changelog), fechado pela detecção que encontrar as variáveis publicadas iguais ao manifesto.

**6. Detecção (FR-030).** `detect` roda no cron semanal e depois de cada sincronização, comparando o manifesto com as variáveis locais e publicadas. Cada divergência (`missing`, `extra`, `value`, `alias`, `name`, `hierarchy`, `type`) recebe a impressão digital sha256(tipo | caminho | modo | ferramenta) e vira item deduplicado, com responsável igual ao papel dono da sincronização lido do CODEOWNERS (DSN-02) e prazo igual à data de detecção mais o SLA de uma configuração versionada. O item fecha sozinho quando a execução seguinte vê diff vazio.

**7. Gatilhos, CI e credenciais.**
- `.github/workflows/design-sync.yml` tem três gatilhos num só grupo de concorrência: job posterior à promoção à tag principal (ENG-26), cron semanal e `workflow_dispatch` pelo dono da sincronização enquanto o ENG-26 não existir. Nunca roda em `pull_request` nem `pull_request_target`, e PR de fork não recebe segredo (ENG-14). Ações de terceiros fixadas por SHA (ENG-18).
- Environments `design-sync-write` (`apply`) e `design-sync-read` (`detect`, `check-access`), restritos à branch padrão e às tags de release; o arquivo do workflow tem o time dono da sincronização no CODEOWNERS. Em repositório privado, secrets de environment e políticas de branch exigem GitHub Pro, Team ou Enterprise, e revisores obrigatórios não existem em Free, Pro e Team; por isso a proteção se apoia nas políticas de branch e de tag.
- Tracker e alerta usam token de instalação de GitHub App, de curta duração, gerado no job (`actions/create-github-app-token`), com Issues:write e org Members:read, mais acesso de push se a escrita de campos de issue exigir. A falha abre ou atualiza o issue `design-sync:failure`, que menciona o time, e o check também falha. O campo "Owner" depende de criação por admin da organização; o fallback é rótulo de papel e linha de responsável no corpo, com "Target date". O `GITHUB_TOKEN` só anexa o log à release, com `contents: write` apenas nesse job.
- A credencial da ferramenta e a chave privada da App são segredos fixos no inventário do ENG-13, com a justificativa de que o provedor não oferece credencial federada, dono (papel dono da sincronização), escopo e rotação dentro do máximo do provedor. Leitura e escrita usam credenciais separadas onde a ferramenta permitir. Se o requerente tiver cofre de segredos em nuvem, o runner o acessa por OIDC do GitHub, embora a credencial da ferramenta continue fixa.

**8. Testes.** `InMemoryDesignTool` com capacidades configuráveis (limite de modos 10, 20 ou 40; eixo por quadro ou por arquivo; lote atômico ou fatiado), injeção de falha (`faults`: falha após N operações, 429 com `Retry-After`, 403, credencial vencida, indisponibilidade) e auxiliares `simulateManualEdit`, `simulateRename`, `simulateExtraVariable`, `simulateDeleteVariable`, `simulateTypeChange`, `simulateModeRename` e `simulatePublish`, mais `InMemoryTracker`, `InMemoryAlert` e relógio injetado, só com marcas sintéticas A e B (QA-15). A suíte `describeDesignToolPortContract(factory)` roda contra o fake em todo PR e contra o adaptador real num arquivo sandbox à noite e sob demanda, só na branch protegida. Um teste roda o núcleo duas vezes e compara bytes. Teste de arquitetura e regra do ENG-01 com violação proposital barram escrita do `design-sync` em `packages/tokens/`.

**9. Adaptador real.** Só é escrito depois da decisão do requerente, precedido de spike no plano contratado; a escolha entra neste ADR ou num novo antes da implementação (GOV-07). Se for o Figma, os tipos vêm de `@figma/rest-api-spec` como devDependency só de tipos, em versão exata (spec em beta, versões 0.x frequentes). O campo `license` dele é a string não SPDX "MIT License" e exige alias revisado em `quality/license-policy.json` com aprovação de dono (ENG-21, ENG-25); a alternativa é gerar os tipos do arquivo OpenAPI.

### Restrições por ferramenta (registro para a decisão do requerente; nenhuma é escolhida aqui)

| Aspecto | Figma | Penpot | Tokens Studio (plugin do Figma) |
| --- | --- | --- | --- |
| Escrita automática | REST de variáveis (POST) só no Enterprise, com assento Full ou admin com edição e escopo `file_variables:write`. No Professional e no Organization, só o MCP remoto (`use_figma`): beta, OAuth atrelado a usuário, só clientes do catálogo, saída de até 20 KB por chamada, preço futuro por uso e sem uso em CI documentado. É candidato não comprovado (`agent-mcp`) e exige spike. | Sem API headless documentada para tokens: Plugins API desde a 2.14, MCP oficial exige aba aberta do navegador, RPC sem referência formal | Exportação manual por botão no plugin; temas e Git sync pagos (plano Team, €39 por editor por mês) |
| Leitura (detect e verify) | GET de variáveis também só no Enterprise. Token de plano (até 1 ano, não atrelado a usuário) não escreve variáveis; a leitura com ele precisa de spike | Exportação DTCG multiarquivo (`$themes`, `$metadata`); importação substitui todos os tokens | Depende do Figma |
| Limites | POST atômico, corpo até 4 MB; até 40 modos e 5.000 variáveis por coleção; nome de modo até 40 caracteres. Modos: Starter nenhum, Professional 10, Organization 20. Variáveis remotas não são graváveis. Limites de taxa por tier desde 2025-11-17, irrelevantes para cerca de 2 GETs e poucos POSTs por execução | Um tema ativo por grupo | Modos acima do limite do plano são ignorados em silêncio |
| Marca e modo independentes (DSN-05) | Atende com uma coleção por eixo e modo explícito por quadro, seção ou página, com herança Auto. Coleções estendidas (só Enterprise) acoplam marca e modo e perdem modos ao aceitar atualização da biblioteca; não são topologia padrão | Grupos de tema `brand` e `mode`, mas a ativação vale para o arquivo inteiro (sem escopo por quadro em 2026-07): não atende o DSN-05 por quadro | Grupo de tema vira coleção e tema vira modo; atende por meio do Figma |
| Publicação e direção | Sem endpoint de publicação de biblioteca: passo manual, vira item rastreável. O exemplo oficial `variables-github-action-example` é bidirecional e só serve de referência | Não levantado na pesquisa | O plugin pode empurrar para o Git e exigiria bloqueio para respeitar o DSN-01 |
| Credencial (nenhuma federada) | PAT até 90 dias, atrelado a usuário; app OAuth; token de plano até 1 ano | Token de acesso sem expiração ou com 30, 60, 90 ou 180 dias | Licença por editor e credencial do provedor Git |
| Capacidade provável na porta | Enterprise: `write: api`, `publish: manual`. Professional e Organization: `write: agent-mcp` se o spike passar, senão `manual`; `publish: manual` | `write: manual` até spike; `axisScope: file` | `write: manual` |

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| Tokens Studio como mecanismo de sincronização | Exportação manual (não atende o "automaticamente" do DSN-01), recursos pagos, plugin bidirecional, modos acima do limite ignorados em silêncio e segundo formato de tokens. Fica como fallback manual alimentado por arquivos gerados pelo núcleo. |
| Script só para Figma derivado do `variables-github-action-example` | Presume a decisão do requerente, traz fluxo ferramenta → repositório (proibido pela premissa), não remove variáveis (DSN-03 incompleto), casa só por nome e exige Enterprise. |
| Plataforma SaaS intermediária de tokens | Vira quarta fonte de fatos (Princípio I), em geral com formato proprietário (rejeitado pelo ADR-02), outra credencial e custo, e depende das mesmas APIs e planos. |
| Coleções estendidas do Figma como topologia marca × modo | Só Enterprise, não aceitam variáveis nem modos novos, relatos de marca e modo acoplados num seletor e modos perdidos ao aceitar atualização. Fica como opção condicionada a capacidade, a testar em spike. |
| Coleção única com modos marca × modo | Não forma eixos independentes (DSN-05) e dobra o número de modos por marca, estourando os limites 10, 20 e 40. |
| Variáveis auxiliares em namespace reservado, declaradas como exceção | DSN-04, FR-028 e SC-010 exigem zero diferenças; exceção autodeclarada relaxaria critério de aceite sem pedido de mudança. O FR-033 resolve na fonte. |
| Importação DTCG manual a cada versão | Sem restauração, verificação nem log confiável. Fica só como fallback para ferramenta sem API de escrita. |
| Sincronização bidirecional ou ferramenta como fonte | Contraria a premissa vigente, o DSN-01, o FR-025 e o Princípio II; exige pedido de mudança. |
| `GITHUB_TOKEN` para alertas e itens | Não lê times da organização, a menção a time não notifica e campos de issue exigem acesso de push; o alerta do DSN-02 poderia não chegar ao papel. |
| Octokit, axios e bibliotecas de retry no núcleo | `fetch` nativo cobre os poucos endpoints, e cada dependência amplia a superfície de ENG-07, ENG-21, ENG-24 e ENG-25. `@octokit/rest` 22 (MIT) fica como fallback do adaptador GitHub. |

## Consequências

- **Positivas**: o núcleo é testável agora, sem ferramenta nem credencial; a decisão do requerente troca só um adaptador; a direção única é garantida por construção; logs reprodutíveis servem de evidência; não há dependência de runtime.
- **Negativas**: código próprio a manter (núcleo, fake, suíte de contrato e adaptadores GitHub); dois segredos fixos com rotação manual; uma GitHub App a instalar na organização; a forma do FR-033 aumenta a coleção Marca, com um token-fonte por modo; a publicação da biblioteca pode continuar manual.
- **Neutras**: FR-025 a FR-030 só são aceitos de ponta a ponta com a ferramenta escolhida e o adaptador real, e até lá a evidência é a suíte de contrato sobre o fake. O gatilho "versão publicada" depende do pipeline de publicação (ENG-26).

## Requisitos atendidos

| ID | Como |
| --- | --- |
| DSN-01, FR-025 | Job versionado após a promoção (ou `workflow_dispatch` até o ENG-26) sincroniza a partir do manifesto da versão e anexa o log. A porta não tem operação ferramenta → repositório, o teste de arquitetura barra escrita na fonte e não há `@terrazzo/cli` com importação do Figma (ADR-11). |
| DSN-02, FR-026 | Papel dono como time no CODEOWNERS; toda falha (verify divergente, 4xx/5xx, credencial vencida no `check-access`) chama a `AlertPort`; check vermelho como segundo sinal; prova em sandbox de que o time é notificado. |
| DSN-03, FR-027 | Reconciliação completa nas coleções gerenciadas, com edição restaurada registrada como tal; teste com `simulateManualEdit` e edição proposital no sandbox, com evidência no log. |
| DSN-04, FR-028, FR-033 | Mesmos segmentos com o separador da convenção, comparação por arrays normalizados e zero variáveis auxiliares; relatório com zero diferenças de nome ou hierarquia após cada sincronização. |
| DSN-05, FR-029 | Eixos `brand` e `mode` em coleções separadas; `maxModesPerAxis` conferido contra o número de marcas no `plan`; limites por plano e topologia registrados aqui e no relatório da execução. |
| DSN-11 (tokens), FR-030 | Detecção semanal e após cada sincronização, com itens deduplicados, responsável, prazo e fechamento automático. |
| ENG-13, ENG-14, ENG-18 | Segredos fixos inventariados com justificativa; tokens de App de curta duração; segredos só em environments restritos, sem gatilho de PR; ações por SHA. |
| ENG-01, ADR-09, Princípio XI | Camada `tools`, só devDependency de `tokens` (meta); violação proposital falha no CI. |
| ENG-07, ENG-16, ENG-21, ENG-24, ENG-25 | Zero dependência de runtime; eventual pacote de tipos com pino exato, alias de licença revisado e aprovação de dono. |
| QA-02, QA-15 | Núcleo puro com teste unitário contra o fake com injeção de falhas; só marcas sintéticas. |
| TOK-05, Princípio I | Code point, JSON canônico, relógio injetado e envelope separado, com teste de execução dupla; variáveis e logs são derivados, nunca fonte. |
| FR-031, ACE-02, GOV-07 | Cada DSN liga a check (suíte de contrato, job de detecção) ou evidência retida (logs na release, prova de edição no sandbox); arquitetura registrada antes da implementação. |

## Riscos e mitigação

- **Escrita REST do Figma só no Enterprise, com credencial atrelada a usuário (PAT de até 90 dias), e sem API de publicação de biblioteca.** Assento de serviço dedicado, se o requerente fornecer; validade monitorada pelo `check-access`; publicação como item com prazo e detecção sobre as variáveis publicadas.
- **Caminho MCP do Figma em beta**, com preço futuro, clientes restritos, OAuth de usuário, cliente de IA e credencial de modelo no CI e sem uso headless documentado; só é determinístico se o código gerado passar inalterado e houver verify por releitura. Spike antes de qualquer adoção, com fallback `manual` e item rastreável.
- **Limites de modos restringem o eixo marca**, com o número de marcas ainda em aberto. O `plan` falha explicitamente antes de escrever.
- **Penpot sem escopo por quadro e sem API headless.** Registrado como desvio do DSN-05 que exigiria pedido de mudança.
- **Remover ou recriar variáveis quebra ligações de camada.** Renomeação por chave, recriação sinalizada no log e remoção de token só em major (GOV-01).
- **Corpo de 4 MB força fatiar, com atomicidade só por fatia.** Verify, alerta e convergência idempotente.
- **Fake diverge da ferramenta real.** A mesma suíte de contrato roda à noite contra o sandbox, que exige arquivo e credencial próprios.
- **Cron do GitHub atrasa, roda só na branch padrão e é desativado após 60 dias sem atividade em repositório público.** A detecção pós-release cobre "a cada versão publicada".
- **APIs mudam** (ex.: `VariableComposedColor` em 2026-09-17; modelo de limites de taxa em 2025-11-17). Pino dos tipos e suíte de contrato noturna.

## Pendências com o requerente

- **Ferramenta de design e plano** (premissa: nenhuma escolhida; adaptador fake). No Figma, o Enterprise dá o caminho REST suportado para escrita e leitura; Professional e Organization dependeriam do caminho MCP em beta, com spike, e, se ele falhar, de plugin manual com pedido de mudança sobre o "automaticamente" do DSN-01.
- **Direção da sincronização** (premissa: o repositório é a fonte). Resposta diferente é pedido de mudança e revisão deste ADR, pois a porta não tem operação de leitura para o repositório.
- **Número de marcas da versão 1.0** (premissa "Marcas e temas da versão 1.0") frente ao limite de modos por coleção (Figma: Professional 10, Organization 20, REST 40).
- **Conta de serviço ou assento dedicado** na ferramenta, com direito de publicação da biblioteca para o papel dono da sincronização, e aceite de credencial fixa, não federada e rotacionada (ENG-13).
- **Se Figma**: aceite de que a publicação da biblioteca fica manual, feita pelo dono da sincronização e rastreada com prazo.
- **Se Penpot**: aceite, por pedido de mudança, da troca de marca e modo por arquivo inteiro como desvio do DSN-05; hospedagem em nuvem ou própria e, se própria, alcance pelos runners do CI.
- **Plataforma de CI e plano do GitHub** (premissa: GitHub Actions): secrets de environment em repositório privado, instalação da GitHub App na organização e criação do campo de issue "Owner" por admin.

## Referências

- Figma REST: https://developers.figma.com/docs/rest-api/variables/, https://developers.figma.com/docs/rest-api/variables-endpoints, https://developers.figma.com/docs/rest-api/variables-types, https://developers.figma.com/docs/rest-api/rate-limits/, https://developers.figma.com/docs/rest-api/plan-access-tokens/, https://developers.figma.com/docs/rest-api/authentication/, https://developers.figma.com/docs/rest-api/changelog e https://www.npmjs.com/package/@figma/rest-api-spec
- Figma MCP e modos: https://developers.figma.com/docs/figma-mcp-server/write-to-canvas, https://developers.figma.com/docs/figma-mcp-server/, https://help.figma.com/hc/en-us/articles/39216419318551, https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables, https://help.figma.com/hc/en-us/articles/36346281624471-Extend-a-variable-collection e https://www.figma.com/blog/schema-2025-design-systems-recap/
- Figma comunidade e exemplo: https://forum.figma.com/share-your-feedback-26/extended-collections-doesn-t-respect-mode-hierarchy-48123, https://forum.figma.com/suggest-a-feature-11/auto-publishing-and-updating-of-libraries-45271, https://forum.figma.com/suggest-a-feature-11/extended-no-expiration-personal-access-tokens-40595 e https://github.com/figma/variables-github-action-example
- Penpot: https://help.penpot.app/user-guide/design-tokens/, https://community.penpot.app/t/apply-different-tokens-sets-in-different-boards/9771, https://penpot.app/release-notes/2-14-come-together, https://github.com/penpot/penpot/issues/7916, https://help.penpot.app/mcp/, https://help.penpot.app/technical-guide/integration/ e https://github.com/penpot/penpot
- Tokens Studio: https://docs.tokens.studio/figma/export/themes, https://docs.tokens.studio/figma/export/variables-skipped, https://tokens.studio/pricing e https://github.com/tokens-studio/figma-plugin
- DTCG 2025.10: https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/ e https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
- GitHub: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows, https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments, https://docs.github.com/en/actions/concepts/security/openid-connect, https://docs.github.com/en/rest/issues/issue-field-values, https://github.blog/changelog/2026-07-02-issue-fields-are-now-generally-available e https://github.community/t/team-mention-from-bot-not-working/144323
