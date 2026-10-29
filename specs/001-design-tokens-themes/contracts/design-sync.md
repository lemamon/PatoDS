# Contrato: sincronização com a ferramenta de design

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) (D4, D7) |
**Modelo**: [data-model.md](../data-model.md) | **CLI**: [tools-cli.md](tools-cli.md) |
**ADR**: [ADR-14](../../../docs/adr/ADR-14-sincronizacao-ferramenta-design.md) (Proposto) |
**Data**: 2026-10-21

Este contrato define formatos, interfaces e regras do pacote privado `@<prefixo>/design-sync`
(`tools/design-sync`). Ele cobre FR-025 a FR-030, SC-010, SC-011 e a User Story 6 do spec. Os
trechos de código são assinaturas e formatos; nenhuma implementação é definida aqui. `<prefixo>` é
o marcador da constituição (TODO(PREFIXO)).

## 1. Escopo, premissas e garantias

**Premissas assumidas** (nenhuma é decidida aqui):

| Decisão em aberto | Premissa usada | Efeito neste contrato |
| --- | --- | --- |
| Ferramenta de design e direção da sincronização (DSN-01) | O repositório é a fonte; a ferramenta recebe as variáveis. Nenhuma ferramenta escolhida. | Só existem o núcleo, as portas e o adaptador `memory` (fake). O adaptador real é escrito depois da decisão do requerente e registrado no ADR-14. |
| Marcas da versão 1.0 e marca padrão | Todas as marcas das apps atuais; até a entrega dos valores, marcas sintéticas A e B (QA-15), com A como padrão de teste | Fixtures e exemplos usam só A, B e, no teste de marca nova, C. |
| Plataforma de repositório e CI | GitHub e GitHub Actions (inferida do ENG-18, pendente de confirmação) | Adaptadores de tracker e alerta para GitHub; o núcleo depende só das portas. |
| Plano do GitHub do requerente | Plano que permite environments com segredos e política de branch em repositório privado | Sem esse plano, vale o fallback da seção 11. |
| "Versão publicada" (ENG-26) | Versão promovida à tag principal; até o pipeline existir, execução manual pelo dono da sincronização | Gatilho manual com o mesmo log (seção 10). |

**Garantias por construção**:

- G-1 (FR-025, US6 cenário 6): nenhuma porta tem operação que leve dados da ferramenta para o
  repositório. A CLI não tem comando de importação. O único destino de escrita em disco é o
  diretório `--out`, que é recusado (código 2) quando resolve para dentro de `packages/tokens/`.
  `repo-checks layers` falha se o código de `tools/design-sync` importar `@<prefixo>/tokens` fora
  do subcaminho `./meta/*` ou referenciar `packages/tokens/src`.
- G-2 (FR-028, DSN-04): toda variável criada pelo núcleo corresponde a um token do
  `sync-manifest.json`. O núcleo nunca cria variável auxiliar; a variação marca × modo chega pronta
  na forma do FR-033 (validada por `tokens-build validate`, regra V-08).
- G-3 (TOK-05, Princípio I): plano, log e relatório de divergência têm conteúdo canônico idêntico
  byte a byte para as mesmas entradas. Data, hora e URL da execução ficam num envelope separado.
- G-4 (FR-026): toda falha (códigos 2 a 5) chama `AlertPort.raise` antes de o processo terminar.

**Fora do escopo**: ícones, componentes, variantes, propriedades e estágio (demais partes do
DSN-11 e DSN-06 a DSN-09).

## 2. Componentes e fluxo

```text
@<prefixo>/tokens (tokens-build build)
   └─► dist/meta/sync-manifest.json ......... estado desejado (determinístico, versão N)
       + sync-manifest.json da última versão verificada ... estado anterior (classificação)

design-sync plan    ─► DesignToolPort.readSnapshot() ─► diff ─► sync-plan.json
design-sync apply   ─► plan ─► DesignToolPort.apply(plan, {dryRun}) ─► verify (novo snapshot,
                       diff vazio) ─► DesignToolPort.requestPublish() ─► sync-log.json/.md
design-sync detect  ─► readSnapshot ─► divergências ─► TrackerPort.upsert / resolve
qualquer falha      ─► AlertPort.raise (dono da sincronização, FR-026)

Não existe seta ferramenta ─► repositório.
```

Pacote: `private: true`, nunca publicado, sem dependência de runtime (só `fetch`, `crypto`, `fs` e
`util.parseArgs` do Node). Camada `tools`; aresta permitida: `tools/design-sync -(dev)-> tokens`
(somente `./meta/*`).

## 3. Formato do `sync-manifest.json`

Gerado por `tokens-build build` em `packages/tokens/dist/meta/sync-manifest.json` e exposto pelo
export `./meta/*` de `@<prefixo>/tokens` (manifesto para ferramentas; apps não o importam). É o
único insumo de estado desejado do núcleo, que não lê a sintaxe do Resolver DTCG.

### 3.1 Estrutura

```json
{
  "format": "<prefixo>.sync-manifest",
  "version": 1,
  "source": { "package": "@<prefixo>/tokens", "version": "1.4.0" },
  "axes": [
    { "id": "brand", "contexts": ["a", "b"], "default": "a" },
    { "id": "mode", "contexts": ["dark", "light"], "default": "light" }
  ],
  "collections": [
    { "id": "primitive", "name": "Primitivos", "axis": null },
    { "id": "brand", "name": "Marca", "axis": "brand" },
    { "id": "mode", "name": "Modo", "axis": "mode" },
    { "id": "semantic", "name": "Semânticos invariantes", "axis": null },
    { "id": "component", "name": "Componentes", "axis": null }
  ],
  "variables": [
    {
      "key": "brand.color.bg.surface.dark",
      "path": ["brand", "color", "bg", "surface", "dark"],
      "collection": "brand",
      "layer": "semantic",
      "category": "color",
      "role": "brand-mode-source",
      "type": "color",
      "cssName": "--<prefixo>-brand-color-bg-surface-dark",
      "description": "",
      "values": {
        "a": { "alias": ["color", "neutral", "900"] },
        "b": { "alias": ["color", "sand", "950"] }
      }
    },
    {
      "key": "color.bg.surface",
      "path": ["color", "bg", "surface"],
      "collection": "mode",
      "layer": "semantic",
      "category": "color",
      "role": "public",
      "type": "color",
      "cssName": "--<prefixo>-color-bg-surface",
      "description": "Fundo padrão de superfície.",
      "values": {
        "dark": { "alias": ["brand", "color", "bg", "surface", "dark"] },
        "light": { "alias": ["brand", "color", "bg", "surface", "light"] }
      }
    },
    {
      "key": "color.neutral.900",
      "path": ["color", "neutral", "900"],
      "collection": "primitive",
      "layer": "primitive",
      "category": "color",
      "role": "public",
      "type": "color",
      "cssName": "--<prefixo>-color-neutral-900",
      "description": "",
      "values": { "*": { "literal": { "hex": "#16181d", "alpha": 1 } } }
    }
  ]
}
```

### 3.2 Regras

| Campo | Regra |
| --- | --- |
| `format`, `version` | Constantes. Mudança incompatível no formato incrementa `version`; o núcleo recusa versão desconhecida (código 2). |
| `source` | Nome e versão do pacote de origem. Sem commit, data ou caminho absoluto. |
| `axes` | Exatamente `brand` e `mode`, com `contexts` em ordem de code point e `default` presente em `contexts`. |
| `collections` | Exatamente as cinco coleções, nesta ordem (ordem de dependência dos aliases). `name` vem da convenção de nomes ([token-source.md](token-source.md), seção 8.9, publicada em `docs/tokens/convencao-de-nomes.md`). A coleção não é segmento do caminho. |
| `variables[].key` | Id do token na versão: segmentos unidos por `.`. Único. Guardado na ferramenta para detectar renomeação manual (seção 5.3). |
| `variables[].path` | Segmentos do caminho DTCG, ASCII minúsculo kebab. O nome na ferramenta é `path` unido pelo separador da ferramenta (`/` no Figma, `.` no Penpot), fixado na convenção. |
| `variables[].collection` | `primitive` para camada primitiva; `brand` para token semântico de eixo marca (público ou `brand-mode-source`); `mode` para semântico de eixo modo; `semantic` para semântico invariante; `component` para camada de componente. |
| `variables[].role` | `public` ou `brand-mode-source` (data-model). O adaptador pode aplicar política própria da ferramenta a `brand-mode-source` (ex.: ocultar da publicação), registrada no ADR-14. |
| `variables[].type` | `$type` DTCG resolvido (nunca inferido). |
| `variables[].values` | Chaves = contextos do eixo da coleção (ids de marca em `brand`; `light` e `dark` em `mode`; a chave reservada `*` nas coleções sem eixo). Cada valor é `{ "literal": … }` ou `{ "alias": [segmentos] }`. |
| `literal` | Só na coleção `primitive` (FR-003). Cor: `hex` de 6 dígitos minúsculos igual à quantização de 8 bits de `toEmittedSrgb()` e `alpha` com a mesma serialização decimal do CSS, de modo que ferramenta, CSS e contraste mostram o mesmo valor (D5). Dimensão e duração: `{ "value", "unit" }` do DTCG. Número e peso: `{ "value" }`. Família tipográfica: `{ "value": [nomes] }`. Curva: `{ "value": [x1, y1, x2, y2] }`. Compostos (`border`, `shadow`, `typography`, `transition`): `{ "composite": { … } }` com subvalores na mesma forma. |
| `alias` | Caminho do token alvo, que existe no mesmo manifesto (V-03). Um único salto, como escrito na fonte. |
| Ordem e serialização | `variables` ordenadas por `key` em code point; chaves de objeto em code point; JSON canônico (ver [tools-cli.md](tools-cli.md), seção 1.4). |

O manifesto é validado na leitura contra um JSON Schema versionado junto ao gerador
(`tools/tokens-build`); falha de schema é erro de configuração (código 2).

## 4. Portas

Assinaturas em TypeScript, sem corpo. Nenhuma operação devolve dados destinados a arquivos do
repositório.

### 4.1 Tipos de apoio

```ts
export type TokenPath = readonly string[];
export type TokenKey = string;                     // segmentos unidos por '.'
export type ContextId = string;                    // id de marca, 'light' | 'dark', ou '*'
export type CollectionId = 'primitive' | 'brand' | 'mode' | 'semantic' | 'component';
export type NativeRef = string;                    // identificador opaco da ferramenta
export type Sha256 = `sha256:${string}`;
export type IsoDate = string;                      // AAAA-MM-DD, vindo do relógio injetado
export type Fingerprint = Sha256;

export type SyncValueType =
  | 'color' | 'dimension' | 'number' | 'fontFamily' | 'fontWeight' | 'duration'
  | 'cubicBezier' | 'strokeStyle' | 'border' | 'shadow' | 'typography' | 'transition';

export type LiteralValue =
  | { readonly hex: string; readonly alpha: number }
  | { readonly value: number; readonly unit: 'px' | 'rem' | 'ms' | 's' }
  | { readonly value: number }
  | { readonly value: string | readonly string[] }
  | { readonly value: readonly [number, number, number, number] }
  | { readonly composite: Readonly<Record<string, unknown>> };

export type SyncValue = { readonly literal: LiteralValue } | { readonly alias: TokenPath };

export interface ReleaseRef {
  readonly version: string;
  readonly changelogExcerpt: string;               // trecho do changelog da versão (GOV-03)
}

export type SyncErrorCode =
  | 'USAGE' | 'CONFIG_INVALID' | 'MANIFEST_INVALID' | 'CAPABILITY_EXCEEDED'
  | 'ALIASES_UNSUPPORTED' | 'READ_UNAVAILABLE' | 'MASS_DELETE_BLOCKED' | 'OUT_DIR_FORBIDDEN'
  | 'ACCESS_DENIED' | 'CREDENTIAL_MISSING' | 'CREDENTIAL_EXPIRED' | 'RATE_LIMITED'
  | 'TOOL_UNAVAILABLE' | 'VERIFY_MISMATCH' | 'INTERNAL';

export interface SyncError {
  readonly code: SyncErrorCode;
  readonly phase: 'config' | 'access' | 'snapshot' | 'plan' | 'apply' | 'verify' | 'publish' | 'report';
  readonly message: string;                        // estável, sem segredo nem resposta crua
  readonly completedOperations: number | null;     // em falha durante apply
}
```

### 4.2 `DesignToolPort`

```ts
export type WriteCapability = 'api' | 'agent-mcp' | 'manual';
export type ReadCapability = 'api' | 'agent-mcp' | 'manual';
export type PublishCapability = 'api' | 'manual' | 'none';

export interface DesignToolCapabilities {
  readonly toolId: string;                         // id do adaptador, ex.: 'memory'
  readonly maxModesPerAxis: number;                // limite de modos por coleção do plano contratado
  readonly maxVariablesPerCollection: number | null;
  readonly axisScope: 'frame' | 'file';            // troca de modo por quadro ou só no arquivo inteiro
  readonly aliases: boolean;                       // variável pode apontar para outra variável
  readonly valueTypes: readonly SyncValueType[];   // tipos representáveis como variável
  readonly separator: '/' | '.';                   // separador de segmentos (convenção TOK-04)
  readonly keyField: 'description-suffix' | 'code-syntax' | 'native-metadata';
  readonly hiddenVariables: boolean;
  readonly codeSyntax: boolean;
  readonly localPublishedSplit: boolean;           // distingue estado local e publicado
  readonly maxAtomicBatchBytes: number | null;     // tamanho máximo de um lote atômico
  readonly read: ReadCapability;
  readonly write: WriteCapability;
  readonly publish: PublishCapability;
}

export interface AccessProblem {
  readonly code: 'ACCESS_DENIED' | 'CREDENTIAL_MISSING' | 'CREDENTIAL_EXPIRED'
    | 'SCOPE_MISSING' | 'PLAN_INSUFFICIENT' | 'TOOL_UNAVAILABLE';
  readonly message: string;
}

export interface AccessReport {
  readonly ok: boolean;
  readonly problems: readonly AccessProblem[];
  readonly scopes: readonly string[];
  readonly plan: string | null;                    // plano ou assento, quando a ferramenta informa
  readonly credentialExpiresOn: IsoDate | null;
}

export interface SnapshotCollection {
  readonly ref: NativeRef;
  readonly name: string;
  readonly modes: readonly { readonly ref: NativeRef; readonly name: string }[];
}

export interface SnapshotVariable {
  readonly ref: NativeRef;
  readonly collectionRef: NativeRef;
  readonly path: TokenPath;                        // nome dividido pelo separador, sem outra normalização
  readonly type: SyncValueType | 'unknown';
  readonly key: TokenKey | null;                   // lida de keyField; null se ausente
  readonly description: string;                    // sem o marcador de chave
  readonly hidden: boolean;
  readonly values: Readonly<Record<string, SyncValue | { readonly unresolved: string }>>;
}

export interface ToolSnapshot {
  readonly tool: string;                           // '<adapterId>:<targetId>'
  readonly collections: readonly SnapshotCollection[];
  readonly variables: readonly SnapshotVariable[];
  readonly published: { readonly variables: readonly SnapshotVariable[] } | null;
}

export interface ApplyResult {
  readonly status: 'applied' | 'dry-run' | 'partial' | 'manual';
  readonly completedOperations: number;
  readonly failedAtSeq: number | null;
  readonly error: SyncError | null;
}

export type PublishOutcome =
  | { readonly status: 'published' }
  | { readonly status: 'manual'; readonly instructions: string }
  | { readonly status: 'none' };

export interface DesignToolPort {
  capabilities(): DesignToolCapabilities;
  checkAccess(): Promise<AccessReport>;
  readSnapshot(): Promise<ToolSnapshot>;
  apply(plan: SyncPlan, options: { readonly dryRun: boolean }): Promise<ApplyResult>;
  requestPublish(release: ReleaseRef): Promise<PublishOutcome>;
}
```

Obrigações do adaptador:

- `readSnapshot()` normaliza valores da ferramenta de volta para `SyncValue` (cor em `hex` e
  `alpha`, dimensão na unidade do manifesto). A ida e a volta precisam ser exatas; a regra de
  conversão de unidades de cada ferramenta fica no ADR-14 e é coberta pela suíte de contrato.
- `apply()` executa as operações na ordem de `seq`, pode dividir em lotes de até
  `maxAtomicBatchBytes` sem reordenar, para no primeiro lote com falha e devolve `partial` com
  `failedAtSeq`. Reexecutar com um plano novo, feito sobre snapshot novo, converge (idempotência).
- Respostas 429 são repetidas respeitando `Retry-After`, até o limite da configuração; depois,
  `RATE_LIMITED`. 401 e 403 viram `ACCESS_DENIED`; credencial vencida, `CREDENTIAL_EXPIRED`;
  rede e 5xx, `TOOL_UNAVAILABLE`.
- Nenhuma mensagem, log ou snapshot contém a credencial.

### 4.3 `TrackerPort`

```ts
export interface RoleRef {
  readonly kind: 'team';
  readonly slug: string;                           // ex.: '@<org>/<time-dono-da-sincronizacao>'
  readonly source: 'CODEOWNERS';
}

export type TrackedItemKind =
  | 'divergence' | 'manual-write' | 'manual-publish' | 'capability' | 'credential' | 'failure';

export interface TrackedItem {
  readonly fingerprint: Fingerprint;
  readonly kind: TrackedItemKind;
  readonly title: string;
  readonly body: string;                           // Markdown determinístico
  readonly owner: RoleRef;
  readonly due: IsoDate;                           // detecção + SLA da configuração
  readonly labels: readonly string[];
}

export interface OpenItem {
  readonly fingerprint: Fingerprint;
  readonly kind: TrackedItemKind;
  readonly detectedOn: IsoDate;
  readonly due: IsoDate;
  readonly url: string | null;
}

export type UpsertResult = { readonly action: 'created' | 'updated' | 'reopened' | 'unchanged' };
export type ResolveResult = { readonly action: 'resolved' | 'not-found' };

export interface TrackerPort {
  upsert(item: TrackedItem): Promise<UpsertResult>;
  resolve(fingerprint: Fingerprint, note: string): Promise<ResolveResult>;
  listOpen(filter?: { readonly kinds?: readonly TrackedItemKind[] }): Promise<readonly OpenItem[]>;
}
```

Semântica: `upsert` cria o item se não existe; se está aberto, atualiza título, corpo e rótulos e
preserva `detectedOn` e `due` originais; se estava resolvido, reabre como nova ocorrência, com nova
data de detecção e novo prazo. `resolve` fecha com nota que cita a execução que viu a convergência.

### 4.4 `AlertPort`

```ts
export interface SyncAlert {
  readonly fingerprint: Fingerprint;               // sha256('failure|' + code + '||' + tool)
  readonly severity: 'error' | 'warning';
  readonly error: SyncError;
  readonly owner: RoleRef;
  readonly tool: string;
  readonly runUrl: string | null;                  // do envelope; nunca no conteúdo canônico
}

export interface AlertPort {
  raise(alert: SyncAlert): Promise<void>;
}
```

O adaptador GitHub de alerta abre ou atualiza um item com rótulo `design-sync:failure`, que
menciona o time dono e preenche o responsável (seção 11). Como ele usa o mesmo repositório de itens
do tracker, a execução seguinte verificada (`verified`) resolve os alertas abertos dessa ferramenta
por `TrackerPort.resolve`. O job também termina com código diferente de zero (segundo sinal).

## 5. Plano e diff

### 5.1 Entradas

Manifesto atual (obrigatório), manifesto da versão anterior (opcional, ver seção 6), snapshot,
capacidades e configuração (seção 15). A saída é um `SyncPlan` em JSON canônico.

### 5.2 Pré-condições (plano recusado, nada é escrito)

| Condição | Código de erro | Saída |
| --- | --- | --- |
| Manifesto inválido ou de versão desconhecida | `MANIFEST_INVALID` | 2 |
| `capabilities.aliases = false` (a topologia por eixos depende de alias, FR-033) | `ALIASES_UNSUPPORTED` | 2 |
| `maxModesPerAxis` menor que o número de marcas ou de modos | `CAPABILITY_EXCEEDED` | 2 |
| `read = 'manual'` (sem snapshot automático, não há diff nem verify) | `READ_UNAVAILABLE` | 2 |
| Remoções acima do limite configurado sem `--allow-mass-delete` | `MASS_DELETE_BLOCKED` | 2 |

Toda recusa é registrada no log em `capabilityChecks` e dispara alerta. O resultado da checagem de
modos entra em todo log, aprovado ou não (registro de limites do FR-029 e do DSN-05).

### 5.3 Casamento entre manifesto e snapshot

Só as coleções gerenciadas (as cinco da seção 3, identificadas pelo nome da convenção) são lidas
para diff. Variáveis de outras coleções nunca são alteradas, renomeadas ou removidas.

1. Por chave: variável do snapshot cuja `key` é igual à `key` desejada.
2. Sem chave, por caminho: variável sem `key` cujo `path` normalizado (segmentos do nome divididos
   pelo separador, comparação exata, sem mudança de caixa) é igual ao desejado, na mesma coleção.
   Ela é adotada (`setMetadata` grava a chave), o que preserva os vínculos de camadas.
3. Empate (duas variáveis com a mesma chave): fica a de caminho igual ao desejado; se nenhuma,
   a de menor `ref` em code point. As demais são extras.
4. Sem correspondência: `missing` (criação). Variável de coleção gerenciada sem correspondência:
   `extra` (remoção).

### 5.4 Operações e ordem

As operações são numeradas por `seq` e agrupadas em fases, sempre nesta ordem. Dentro de cada fase,
a ordem é: coleção (ordem da seção 3), `path` unido por `.` em code point, contexto em code point.

| Fase | Operações | Observação |
| --- | --- | --- |
| 1 `collections` | `createCollection` | Coleções nunca são removidas. |
| 2 `modes` | `createMode`, `renameMode` | Modos = contextos do eixo. |
| 3 `renames` | `renameVariable` | Renomeação de volta por chave, dentro da mesma coleção. Antes das criações, para liberar nomes. |
| 4 `recreates` | `recreateVariable` | Mudança de `type` (tipo imutável em algumas ferramentas) ou de coleção: remove e cria na mesma operação. Sempre `breaking: true`. |
| 5 `creates` | `createVariable` | Sem valores; aliases ainda podem apontar para variáveis não criadas. |
| 6 `metadata` | `setMetadata` | Chave, descrição, code syntax e ocultação. |
| 7 `values` | `setValue` | Literal ou alias por contexto, depois que todas as variáveis existem. Alvos de alias são referenciados por caminho; o adaptador traduz para `NativeRef` (inclusive ids temporários de criação). |
| 8 `deletes` | `deleteVariable`, depois `deleteMode` | Por último e só em coleções gerenciadas. Extras contam como edição manual (DSN-03) salvo remoção de release. |

```ts
interface PlanOperationBase {
  readonly seq: number;
  readonly phase: 'collections' | 'modes' | 'renames' | 'recreates' | 'creates'
    | 'metadata' | 'values' | 'deletes';
  readonly collection: CollectionId;
  readonly cause: 'release' | 'manual' | 'initial' | 'unclassified';
  readonly breaking: boolean;                      // quebra vínculos de camadas no destino
}

export type PlanOperation = PlanOperationBase & (
  | { readonly op: 'createCollection'; readonly modes: readonly ContextId[] }
  | { readonly op: 'createMode' | 'deleteMode'; readonly mode: ContextId; readonly ref?: NativeRef }
  | { readonly op: 'renameMode'; readonly ref: NativeRef; readonly from: string; readonly to: ContextId }
  | { readonly op: 'renameVariable'; readonly ref: NativeRef; readonly key: TokenKey;
      readonly from: TokenPath; readonly to: TokenPath }
  | { readonly op: 'recreateVariable'; readonly ref: NativeRef; readonly key: TokenKey;
      readonly path: TokenPath; readonly reason: 'type' | 'collection'; readonly type: SyncValueType }
  | { readonly op: 'createVariable'; readonly key: TokenKey; readonly path: TokenPath;
      readonly type: SyncValueType }
  | { readonly op: 'setMetadata'; readonly key: TokenKey; readonly path: TokenPath;
      readonly fields: readonly ('key' | 'description' | 'codeSyntax' | 'hidden')[] }
  | { readonly op: 'setValue'; readonly key: TokenKey; readonly path: TokenPath;
      readonly mode: ContextId; readonly value: SyncValue; readonly before: SyncValue | null }
  | { readonly op: 'deleteVariable'; readonly ref: NativeRef; readonly key: TokenKey | null;
      readonly path: TokenPath }
);

export interface SyncPlan {
  readonly format: '<prefixo>.sync-plan';
  readonly version: 1;
  readonly tool: string;
  readonly source: { readonly package: string; readonly version: string };
  readonly previous: { readonly version: string } | null;
  readonly digests: { readonly manifest: Sha256; readonly previousManifest: Sha256 | null;
    readonly snapshot: Sha256 };
  readonly capabilityChecks: readonly CapabilityCheck[];
  readonly summary: Readonly<Record<'create' | 'rename' | 'recreate' | 'update' | 'delete'
    | 'unchanged' | 'unsupported', number>>;
  readonly operations: readonly PlanOperation[];
  readonly outcomes: readonly CapabilityOutcome[];  // seção 9
}

export interface CapabilityCheck {
  readonly check: 'maxModesPerAxis' | 'maxVariablesPerCollection' | 'aliases' | 'axisScope'
    | 'read' | 'write' | 'publish' | 'valueTypes';
  readonly subject: string;                        // ex.: 'brand', 'mode', 'shadow'
  readonly required: number | string;
  readonly limit: number | string;
  readonly ok: boolean;
}
```

Regras adicionais:

- Token removido ou renomeado no repositório aparece como `deleteVariable` (e, no renomeado,
  `createVariable`) com `cause: "release"` e `breaking: true`. Isso só é esperado em versão major
  (GOV-01, Princípio X); o log destaca a operação, e a verificação de API pública é da feature de
  CI e publicação.
- Variável cujo `type` não está em `capabilities.valueTypes` não gera operação; entra em
  `summary.unsupported` e no resultado de capacidade `unsupported-type` (seção 9). O núcleo nunca a
  aproxima com variáveis auxiliares.
- Plano vazio significa ferramenta igual ao manifesto em todas as coleções gerenciadas (excluídos
  os tipos `unsupported`).

### 5.5 Verificação após aplicar

Depois de `apply` com status `applied`, o núcleo lê um snapshot novo e refaz o diff. Diff vazio:
resultado `verified`. Diff não vazio: `VERIFY_MISMATCH`, alerta e código 5. Falha no meio de
`apply` (status `partial`): resultado `failed`, alerta e código conforme o erro (4 para acesso,
rede, 5xx ou limite de taxa esgotado; 3 para erro interno). A execução seguinte parte de snapshot
novo e converge; os itens reparados aparecem no log dela com a causa calculada na seção 6.

## 6. Classificação de divergência (drift)

Para cada diferença entre o estado real (snapshot) e o desejado da versão atual, o núcleo compara o
mesmo elemento (variável, campo e contexto) com o desejado da versão anterior:

| Real = desejado(anterior)? | Desejado(anterior) = desejado(atual)? | Classe | Tratamento |
| --- | --- | --- | --- |
| Sim | Não | `release` | Mudança da versão; vai para `changes[]` do log. |
| Não | Qualquer | `manual` | Edição manual no destino; restaurada e registrada em `restored[]` (FR-027, DSN-03). |
| Sim | Sim | (sem diferença) | Não ocorre: real = atual. |
| Sem versão anterior (primeira sincronização) | n/a | `initial` | Vai para `changes[]`. |
| Manifesto anterior não fornecido | n/a | `unclassified` | Restaurado e registrado em `restored[]`, com o log marcando `previous: null`. |

O manifesto anterior é o `sync-manifest.json` da última versão sincronizada com resultado
`verified` naquele destino (registrada no log retido dessa versão). Em geral é a versão promovida
imediatamente antes; se uma sincronização intermediária falhou, usar a última verificada evita
classificar como `manual` o atraso de release. O workflow obtém o arquivo do pacote publicado dessa
versão (export `./meta/*`) e o passa em `--previous`; o log registra a versão usada. No gatilho de
release, a ausência do manifesto anterior, fora da primeira sincronização, é erro de configuração
(código 2).

## 7. Registro de sincronização (log)

Cada execução de `apply` (inclusive `--dry-run`) grava três arquivos no diretório `--out`:

| Arquivo | Conteúdo | Determinístico |
| --- | --- | --- |
| `sync-log.json` | Conteúdo canônico (abaixo) | Sim, byte a byte para as mesmas entradas |
| `sync-log.md` | Renderização Markdown gerada só a partir de `sync-log.json` | Sim |
| `sync-envelope.json` | Data e hora, URL da execução, gatilho, sha256 de `sync-log.json`, detalhe cru de erro da ferramenta (sem segredo) | Não |

```json
{
  "format": "<prefixo>.sync-log",
  "version": 1,
  "command": "apply",
  "tool": "memory:sandbox",
  "source": { "package": "@<prefixo>/tokens", "version": "1.4.0", "changelog": "<referência à entrada do changelog da versão (GOV-03)>" },
  "previous": { "version": "1.3.2" },
  "result": "verified",
  "digests": {
    "manifest": "sha256:…",
    "previousManifest": "sha256:…",
    "snapshotBefore": "sha256:…",
    "snapshotAfter": "sha256:…",
    "plan": "sha256:…"
  },
  "capabilityChecks": [
    { "check": "maxModesPerAxis", "subject": "brand", "required": 2, "limit": 10, "ok": true },
    { "check": "maxModesPerAxis", "subject": "mode", "required": 2, "limit": 10, "ok": true }
  ],
  "changes": [
    { "op": "setValue", "collection": "brand", "path": ["brand", "color", "bg", "surface", "dark"], "mode": "b", "before": { "alias": ["color", "sand", "900"] }, "after": { "alias": ["color", "sand", "950"] }, "cause": "release", "breaking": false }
  ],
  "restored": [
    { "op": "setValue", "collection": "primitive", "path": ["color", "neutral", "900"], "mode": "*", "before": { "literal": { "hex": "#000000", "alpha": 1 } }, "after": { "literal": { "hex": "#16181d", "alpha": 1 } }, "cause": "manual", "breaking": false },
    { "op": "renameVariable", "collection": "mode", "path": ["color", "bg", "surface"], "from": ["color", "bg", "surfce"], "cause": "manual", "breaking": false }
  ],
  "outcomes": [
    { "kind": "manual-publish", "fingerprint": "sha256:…" }
  ],
  "divergenceAfter": { "missing": 0, "extra": 0, "value": 0, "alias": 0, "name": 0, "hierarchy": 0, "type": 0 },
  "error": null
}
```

Regras:

- `result`: `planned` (só plano ou saída manual), `dry-run`, `verified` ou `failed` (máquina de
  estados do data-model).
- `changes[]` e `restored[]` ordenados por caminho (code point), depois contexto, depois `op`.
  Uma mudança de release nunca aparece em `restored[]`, e vice-versa.
- `divergenceAfter` vem do diff de verificação; após cada sincronização verificada, `name` e
  `hierarchy` são zero (SC-010).
- `error`: `SyncError` da seção 4.1, sem texto variável de resposta da ferramenta (que fica no
  envelope).
- Retenção: o log vai como asset da versão (evidência retida do ACE-02 e do FR-031) e como artefato
  do workflow.
- `sync-log.md` tem as seções Resumo, Mudanças da versão, Edições manuais restauradas, Resultados de
  capacidade, Limites registrados e Digests, com as mesmas ordenações do JSON.

## 8. Item de divergência e impressão digital

`design-sync detect` gera `divergence-report.json`, `divergence-report.md` e envelope. Cada item:

```json
{
  "fingerprint": "sha256:…",
  "kind": "value",
  "field": "value",
  "collection": "mode",
  "path": ["color", "bg", "surface"],
  "mode": "dark",
  "tool": "memory:sandbox",
  "expected": { "alias": ["brand", "color", "bg", "surface", "dark"] },
  "actual": { "alias": ["brand", "color", "bg", "raised", "dark"] },
  "classification": "manual",
  "sourceVersion": "1.4.0"
}
```

| Campo | Regra |
| --- | --- |
| `kind` | Lista fechada do data-model: `missing`, `extra`, `value`, `alias`, `name` (só o último segmento difere), `hierarchy` (segmentos de grupo diferem ou a coleção difere), `type`. |
| `field` | Detalhe do campo: `value`, `description`, `key`, `codeSyntax`, `hidden`, `collection` ou `modes`. Não altera `kind`. |
| `mode` | Contexto afetado, ou `null` quando não se aplica. |
| `classification` | Classe da seção 6. |
| `fingerprint` | Fórmula abaixo. O valor fica fora da impressão digital, para que a mesma divergência atualize o mesmo item. |
| `tool` | `<adapterId>:<targetId>`; `targetId` é identificador não secreto do arquivo ou projeto, vindo da configuração. |

```text
fingerprint = "sha256:" + hex(sha256(utf8(kind + "|" + path.join(".") + "|" + (mode ?? "") + "|" + tool)))
```

O separador `|` não ocorre em segmentos (kebab ASCII), em `kind` nem em `tool`. A mesma fórmula
vale para os demais itens rastreáveis, com `kind` igual ao tipo do item: `failure` (caminho = código
do erro), `capability` (caminho = capacidade ou tipo de valor), `credential` (caminho = `read` ou
`write`), `manual-write` e `manual-publish` (caminho = versão), sempre sem modo.

O relatório é determinístico: itens ordenados por `kind`, caminho, contexto. Datas não entram no
relatório; elas existem só no item rastreável:

| Campo do item rastreável | Origem |
| --- | --- |
| `owner` | `RoleRef` do time dono da linha do arquivo de donos que cobre `ownerPath` da configuração (DSN-02). Linha ausente ou com mais de um time: código 2. |
| `detectedOn` | Relógio injetado na primeira detecção. |
| `due` | `detectedOn` + `slaDays.divergence` da configuração. |
| `state` | `open` → `resolved`, automaticamente quando a próxima execução de `apply` ou `detect` não vê mais a impressão digital. |

No GitHub, o título segue `[design-sync] <kind> <caminho> (<modo>)`, os rótulos são `design-sync`,
`design-sync:divergence` e `kind:<kind>`, e o corpo traz o marcador oculto
`<!-- <prefixo>-design-sync fingerprint: sha256:… -->`, usado por `listOpen` e `resolve`.

## 9. Resultados de capacidade e itens rastreáveis

Limitações da ferramenta são resultados de primeira classe, nunca falhas silenciosas.

| Capacidade | Valor | Efeito | Item rastreável (`kind`) |
| --- | --- | --- | --- |
| `write` | `api` | `apply` executa e verifica. | Nenhum. |
| `write` | `agent-mcp` | Escrita por agente via servidor MCP da ferramenta; candidata não comprovada. Exige verify por leitura de volta. Até o ADR-14 aceitar o caminho após spike, o núcleo a trata como `manual` em execução não interativa. | Como em `manual`, enquanto não aceita. |
| `write` | `manual` | `apply` não escreve; grava `sync-plan.md` como instrução passo a passo. Código 1. | `manual-write`: "Aplicar sincronização vX.Y.Z", prazo `slaDays.manualWrite`, fechado pela próxima execução com diff vazio. |
| `publish` | `api` | `requestPublish` publica após `verified`. | Nenhum. |
| `publish` | `manual` | Ferramenta sem endpoint de publicação. | `manual-publish`: "Publicar biblioteca vX.Y.Z", com descrição pronta (versão e trecho do changelog), prazo `slaDays.manualPublish`; `detect` fecha quando o estado publicado iguala o local (`localPublishedSplit`) ou o dono fecha com registro. |
| `publish` | `none` | Ferramenta sem conceito de publicação. | Nenhum; o log registra. |
| `axisScope` | `file` | Plano segue, mas troca de marca ou modo por quadro (DSN-05) não é atendida. | `capability`, um por ferramenta, para decisão do requerente. |
| `valueTypes` | tipo ausente | Tokens do tipo ficam `unsupported`, sem variável auxiliar. | `capability`, um por tipo e ferramenta (impressão digital da seção 8, caminho = tipo). |
| `read` | `manual` | Sem diff, verify ou detecção automática: recusa (código 2). | `capability` e alerta. |
| `aliases` | `false` | Recusa (código 2). | Alerta. |
| `maxModesPerAxis` | abaixo do necessário | Recusa (código 2). | Alerta. |
| Credencial | vence em até `credentialExpiryWarnDays` | `check-access` avisa, código 0. | `credential`, prazo = data de vencimento (rotação do ENG-13). |

O tratamento definitivo de tipos compostos (por exemplo, estilos em vez de variáveis) depende da
ferramenta e é registrado no ADR-14 depois da escolha.

## 10. Gatilhos e concorrência

Workflow `.github/workflows/design-sync.yml` (GitHub Actions como premissa; ações fixadas por SHA,
ENG-18):

| Gatilho | Comandos | Ambiente | Observação |
| --- | --- | --- | --- |
| Após promoção à tag principal (ENG-26) | `check-access` → `apply` → anexar log à versão → `detect` | `design-sync-write`, depois `design-sync-read` | O mecanismo de encadeamento com o workflow de publicação é da feature de CI. O `detect` pós-sincronização cobre "a cada versão publicada" (FR-030), já que o cron pode atrasar. |
| `schedule` semanal (FR-030) | `check-access` → `detect` | `design-sync-read` | Só detecta; a restauração acontece na sincronização seguinte (edge case do spec). Cron do GitHub roda só na branch padrão e pode atrasar. |
| `workflow_dispatch` | `plan`, `apply` ou `detect`, com entrada `version` | conforme o comando | Disparo manual pelo dono da sincronização enquanto o ENG-26 não existir, com o mesmo log. Restrito por CODEOWNERS no arquivo do workflow e pela política de branch do environment. |
| Pull request | `plan`, `apply`, `detect` com `--adapter memory` e suíte de contrato contra o fake | nenhum (sem segredo) | Prova de comportamento sem credencial (seção 12). |

Concorrência: todos os gatilhos que tocam o mesmo destino compartilham
`concurrency: { group: design-sync-<targetId>, cancel-in-progress: false }`. Execuções enfileiram;
um `apply` em andamento nunca é cancelado por outro gatilho. Fora do CI não há credencial do
adaptador real (seção 11), então execuções locais usam só o adaptador `memory`.

## 11. Credenciais e ambientes

| Item | Regra |
| --- | --- |
| Credencial da ferramenta (escrita) | Segredo fixo no environment `design-sync-write`. Entrada no inventário do ENG-13 com tipo "fixa", justificativa "nenhuma ferramenta candidata oferece credencial federada (OIDC)", dono = papel dono da sincronização, escopo mínimo (escrita só no arquivo da biblioteca), prazo de rotação conforme o limite da ferramenta escolhida. |
| Credencial da ferramenta (leitura) | Separada da escrita quando a ferramenta permite; environment `design-sync-read`. Mesmo registro no inventário. |
| Tracker e alerta | Token de instalação de GitHub App de curta duração, emitido no job por ação fixada por SHA, com Issues:write e Members:read da organização (o `GITHUB_TOKEN` não notifica times). Escrita adicional no repositório só se a gravação de campos de issue exigir, a confirmar em spike. A chave privada da App é segredo fixo no inventário do ENG-13, com justificativa, dono, escopo e rotação. |
| Cofre de segredos | Opcional: se o requerente tiver gerenciador de segredos em nuvem, o job obtém a credencial da ferramenta por OIDC do GitHub; a credencial em si continua fixa. |
| Pull requests (ENG-14) | O workflow não tem gatilho `pull_request` nem `pull_request_target` com segredo. PR de fork recebe só `GITHUB_TOKEN` de leitura. Jobs de PR usam apenas o adaptador `memory`. Secret scanning ativo. |
| Environments | `design-sync-write` e `design-sync-read`, com política de implantação restrita à branch padrão e às tags de versão. Revisores obrigatórios só se o plano do GitHub permitir; o fallback é CODEOWNERS no workflow e a política de branch. |
| Permissões de job | `contents: read` por padrão; `contents: write` só no job que anexa o log à versão; `id-token: write` só se o cofre for usado. |
| Passagem ao processo | Credenciais só por variável de ambiente, nunca por flag; nomes no inventário do ENG-13. Plano, log, envelope, relatório e itens nunca contêm credencial nem dado pessoal (só `RoleRef`). |
| Responsável | `owner` vem do campo de issue "Owner" quando um admin da organização o cria; senão, rótulo `owner:<time>`, linha no corpo e menção ao time. `due` usa o campo padrão "Target date" ou, sem ele, linha no corpo. As duas formas são cobertas por teste de contrato do tracker. |
| Evidência do DSN-02 | Prova única em sandbox de que o time dono é notificado pelo alerta, retida no pacote de aceite. |

## 12. Fake `InMemoryDesignTool`

Exportado por `@<prefixo>/design-sync` (subcaminho de teste do pacote privado), junto com
`InMemoryTracker`, `InMemoryAlert` e `FakeClock`. Sem aleatoriedade e sem relógio real: `NativeRef`
vem de contador, e esperas de `Retry-After` avançam o `FakeClock`.

```ts
export interface InMemoryDesignToolOptions {
  readonly capabilities?: Partial<DesignToolCapabilities>;  // padrão: api/api, frame, 40 modos
  readonly initial?: ToolSnapshot;                          // fixture com marcas sintéticas
  readonly clock?: FakeClock;
}

export interface FaultPlan {
  failAfterOperations(n: number, error: SyncErrorCode): void;   // apply parcial
  rateLimit(times: number, retryAfterSeconds: number): void;    // 429
  forbidden(): void;                                            // 403
  expireCredential(): void;
  unavailable(times: number): void;                             // rede ou 5xx
}

export declare class InMemoryDesignTool implements DesignToolPort {
  constructor(options?: InMemoryDesignToolOptions);
  readonly faults: FaultPlan;
  simulateManualEdit(path: TokenPath, mode: ContextId, value: SyncValue): void;
  simulateRename(path: TokenPath, newPath: TokenPath): void;
  simulateExtraVariable(collection: CollectionId, path: TokenPath, type: SyncValueType): void;
  simulateDeleteVariable(path: TokenPath): void;
  simulateTypeChange(path: TokenPath, type: SyncValueType): void;
  simulateModeRename(collection: CollectionId, from: ContextId, to: string): void;
  simulatePublish(): void;
  resolve(path: TokenPath, brand: ContextId, mode: ContextId): SyncValue;  // segue a cadeia de alias
  operationsLog(): readonly PlanOperation[];
  // métodos do DesignToolPort omitidos (mesmas assinaturas da seção 4.2)
}
```

Capacidades configuráveis cobrem os cenários das ferramentas candidatas: limites de modos 10, 20 e
40; `axisScope` `frame` ou `file`; `write` `api`, `agent-mcp` ou `manual`; `publish` `api`,
`manual` ou `none`; lotes atômicos ou divididos; `valueTypes` sem compostos. Pela CLI, o fake é
selecionado com `--adapter memory`, lê o estado de `--memory-state <arquivo>` e grava o estado
final em `--memory-out <arquivo>` (ver [tools-cli.md](tools-cli.md)).

## 13. Suíte de contrato `describeDesignToolPortContract`

```ts
export interface ContractHarness {
  readonly port: DesignToolPort;
  seed(snapshot: ToolSnapshot): Promise<void>;     // prepara o destino (sandbox ou memória)
  readonly manual: {                               // edições "manuais" pelo meio nativo da ferramenta
    edit(path: TokenPath, mode: ContextId, value: SyncValue): Promise<void>;
    rename(path: TokenPath, newPath: TokenPath): Promise<void>;
    addExtra(collection: CollectionId, path: TokenPath): Promise<void>;
  };
  teardown(): Promise<void>;
}

export declare function describeDesignToolPortContract(
  name: string,
  factory: () => Promise<ContractHarness>,
): void;
```

Casos (ids estáveis, citados na matriz de rastreabilidade):

| Id | Caso | Prova |
| --- | --- | --- |
| C-01 | Capacidades estáticas e válidas (enums, `maxModesPerAxis` ≥ 1). | Base |
| C-02 | `checkAccess` aprova credencial válida e aponta problema tipado com credencial inválida. | ENG-13, código 4 |
| C-03 | Duas leituras seguidas dão o mesmo snapshot e o mesmo sha256. | G-3 |
| C-04 | Sincronização inicial a partir da fixture termina `verified`. | FR-025 |
| C-05 | Segunda execução gera plano vazio (idempotência). | Edge case de interrupção |
| C-06 | `dryRun` não altera o destino e devolve as operações previstas. | Base |
| C-07 | Ordem das fases respeitada (`operationsLog`). | Seção 5.4 |
| C-08 | Edição manual de valor é restaurada e classificada `manual`. | FR-027, DSN-03 |
| C-09 | Renomeação manual é desfeita por chave, preservando `NativeRef` (vínculos). | FR-028, DSN-04 |
| C-10 | Variável extra em coleção gerenciada é removida por último; coleção não gerenciada fica intacta. | DSN-03 |
| C-11 | Mudança de tipo vira `recreateVariable` com `breaking: true`. | Seção 5.4 |
| C-12 | Duas coleções de eixo com modos independentes: para todo par marca × modo, seguir a cadeia de alias no destino dá o mesmo valor que seguir a cadeia no próprio manifesto, trocando só um eixo por vez; toda variável tem chave do manifesto (zero auxiliares). A troca visual num quadro real é evidência retida do sandbox. | FR-029, FR-033, DSN-05 |
| C-13 | Falha após N operações deixa `partial`; a execução seguinte converge e registra os itens reparados. | Edge case de interrupção |
| C-14 | 429 com `Retry-After` é respeitado até o limite; depois, `RATE_LIMITED`. | Seção 4.2 |
| C-15 | `maxModesPerAxis` abaixo do número de marcas recusa o plano sem escrita. | FR-029 |
| C-16 | `requestPublish` devolve o resultado da capacidade `publish`. | Seção 9 |
| C-17 | Ida e volta de valores (cor, dimensão, duração, número) é exata. | Seção 4.2 |
| C-18 | Mesmas entradas, duas execuções: plano e log byte a byte iguais. | G-3, TOK-05 |

Execução: contra o fake em todo PR (Vitest, dentro de `pnpm test`); contra o adaptador real num
arquivo sandbox à noite e sob demanda, só na branch protegida, depois que a ferramenta for escolhida.
Um teste de arquitetura confirma que `DesignToolPort` tem exatamente os cinco membros da seção 4.2
(G-1).

## 14. Restrições por ferramenta (registro para o requerente, sem escolha)

Resumo de [research.md](../research.md), D4, e do relatório
[research/design-sync.md](../research/design-sync.md). Este contrato não escolhe ferramenta nem
plano; a tabela só mostra como cada candidata se traduz em capacidades.

| Ferramenta e plano | `write` | `read` | `publish` | Modos por coleção | `axisScope` | Credencial (ENG-13) | Outras restrições |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Figma Enterprise (REST de variáveis) | `api` (POST com assento Full e escopo `file_variables:write`) | `api` (GET só no Enterprise) | `manual` (sem endpoint de publicação de biblioteca) | Até 40; até 5.000 variáveis por coleção | `frame` (spike deve confirmar seletores independentes com variáveis de marca ocultas da publicação) | PAT de até 90 dias, ligado a usuário, ou app OAuth; token de plano de até 1 ano não escreve variáveis e só é candidato à leitura (spike) | POST atômico por requisição, corpo até 4 MB (lotes); nomes sem `.`, `{`, `}` (separador `/`); variáveis remotas não são graváveis, só o arquivo da biblioteca; limites de taxa com `Retry-After`; coleções estendidas acoplam marca e modo e não servem como topologia padrão. |
| Figma Professional ou Organization | `agent-mcp` candidato não comprovado (servidor MCP remoto, `use_figma`, beta); senão `manual` (plugin executado por pessoa) | idem (REST GET indisponível) | `manual` | Professional 10; Organization 20 (Starter sem modos) | `frame` | OAuth ligado a usuário; clientes restritos ao catálogo do MCP | Beta com preço futuro por uso; saída de até 20 KB por chamada; sem uso em CI documentado; exige spike. Se falhar, a escrita é manual e "automaticamente" do DSN-01 dependeria de pedido de mudança. |
| Penpot (MPL-2.0, auto-hospedável) | `manual` (sem API headless documentada para tokens; Plugins API desde a 2.14; MCP exige aba aberta; RPC sem referência) | `manual` pelo mesmo motivo | `none` ou `manual` (a confirmar) | Grupos de tema (Marca, Modo), um tema ativo por grupo | `file` (sem escopo por quadro em 2026-07): não atende o DSN-05 por quadro | Tokens de acesso com validade nunca, 30, 60, 90 ou 180 dias | Tokens DTCG nativos; importação substitui todos os tokens; auto-hospedagem exige alcance dos runners de CI. |
| Tokens Studio (plugin do Figma) | `manual` (exportação por botão) | `manual` | herda o Figma | Herda o plano do Figma; modos acima do limite são ignorados em silêncio | herda o Figma | Herda o Figma | Temas e Git sync pagos; segundo formato (`$themes`); o plugin pode empurrar para o Git e exigiria bloqueio para respeitar o DSN-01. Rejeitado como mecanismo no D4; serve só como fallback manual alimentado por arquivos gerados pelo núcleo. |

Comum a todas: nenhuma oferece credencial federada, então a credencial é segredo fixo com a
justificativa do ENG-13. O núcleo confere `maxModesPerAxis` por conta própria porque algumas
ferramentas descartam modos excedentes sem erro.

## 15. Configuração versionada

`tools/design-sync/design-sync.config.json`, validada por JSON Schema do pacote e coberta pelo
arquivo de donos (papel dono da sincronização). Valores entre `<>` são definidos pelo dono, com
aprovação registrada; não são limiares do QA-14.

```json
{
  "version": 1,
  "tool": { "adapter": "memory", "target": "sandbox" },
  "managedCollections": ["primitive", "brand", "mode", "semantic", "component"],
  "ownerPath": "tools/design-sync/",
  "slaDays": { "divergence": "<dias>", "manualWrite": "<dias>", "manualPublish": "<dias>", "capability": "<dias>" },
  "credentialExpiryWarnDays": "<dias>",
  "retry": { "maxRetries": "<n>", "maxRetryAfterSeconds": "<s>" },
  "maxDeleteFraction": "<fração de variáveis gerenciadas removíveis numa execução sem --allow-mass-delete>"
}
```

## 16. Rastreabilidade

| Requisito | Mecanismo deste contrato | Check de CI ou evidência retida |
| --- | --- | --- |
| FR-025 (DSN-01) | `apply` após a promoção; G-1 | Job `sync`; log anexado à versão; `repo-checks layers`; teste de arquitetura da porta |
| FR-026 (DSN-02) | `AlertPort` e `RoleRef` do arquivo de donos | Testes do alerta com o fake; prova em sandbox da notificação ao time |
| FR-027 (DSN-03) | Classificação da seção 6; `restored[]` | C-08 e C-10 em todo PR; mesma suíte à noite no sandbox; log de edição proposital retido |
| FR-028 (DSN-04) | Casamento por chave e por segmentos; zero auxiliares | `detect` após cada `apply` com `name` e `hierarchy` iguais a zero; C-09, C-12 |
| FR-029 (DSN-05) | Duas coleções de eixo; `capabilityChecks` em todo log | C-12, C-15; limites e topologia no ADR-14 e no log |
| FR-030 (DSN-11, tokens) | `detect` semanal e pós-sincronização; itens com dono e prazo | Jobs `detect` agendado e pós-`sync`; itens no tracker |
| SC-010 | `divergenceAfter` e `restored[]` | Log de cada versão |
| SC-011 | Cron semanal e `detect` pós-versão; `owner` e `due` obrigatórios | Histórico do workflow e dos itens |
