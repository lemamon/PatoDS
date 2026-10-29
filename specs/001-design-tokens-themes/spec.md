# Feature Specification: Design tokens e temas

**Feature Branch**: `001-design-tokens-themes`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Feature 001 — Design tokens e temas do PatoDS (Fase 1). Fonte: docs/requisitos.md, seção \"Design tokens e temas\" e itens ligados. Escopo: fonte única de tokens em DTCG com três camadas (primitivo, semântico, componente) e validação no CI (TOK-01, TOK-02, TOK-04, TOK-09, TOK-10, TOK-13); geração determinística de CSS custom properties prefixadas e módulos ESM tipados com mapas por marca e modo (TOK-05, TOK-06); múltiplas marcas e modos claro/escuro como eixos independentes por atributos, aplicáveis a qualquer subárvore com escopos aninhados no nível de CSS (TOK-07, TOK-08, TOK-14); CSS de cada marca importável sem as outras (ENG-06); manifesto de pares de contraste conforme nível alvo (A11Y-09); lint de estilos que barra token primitivo, valor literal e altura de controle fora da escala (TOK-03, TOK-13, aplicado ao núcleo quando existir); sincronização com a ferramenta de design na direção da premissa vigente, com restauração de edição manual, nomes e hierarquia idênticos, marca e modo trocáveis e detecção de divergência de tokens (DSN-01 a DSN-05, DSN-11 na parte de tokens). TOK-12 é Desejável: só entra se contratado. Fora desta feature: componentes, Provedor de tema e seus testes React/Vue de tema aninhado e SSR (feature de componentes), documentação dos fundamentos (DOC-05, feature de docs), mapeamento de tokens legados (MIG-03). Prefixo ainda indefinido: usar <prefixo>. Respeitar a constituição v1.0.0."

Fonte dos requisitos: [docs/requisitos.md](../../docs/requisitos.md). Os IDs entre parênteses
(TOK-xx, DSN-xx etc.) referem-se a ele. Princípios aplicáveis da constituição: I, II, III, V, VII,
IX, X e XI.

## Clarifications

### Session 2026-10-21

Ajustes vindos da pesquisa do plano ([research.md](research.md)); nenhum decide premissa em aberto.

- Q: Como o CSS cumpre "só seletores dessa marca" (ENG-06) se marca e modo são eixos independentes?
  → A: Distribuição em um `base.css` neutro de marca (ordem das camadas, primitivos compartilhados,
  modo padrão e resolvedor de tokens) mais um arquivo por marca só com seletores dela; a app importa
  `base.css` e o arquivo da marca (FR-013, FR-017).
- Q: O que conta como "variável sem valor" (ENG-06, FR-013, FR-014, SC-006)? → A: Token público
  `--<prefixo>-*` (nome sem o segmento privado `_`) vazio ou garantidamente inválido, ou `var()` sem
  fallback que resolva assim. Variáveis privadas do mecanismo de escopo, com segmento `_`, são vazias
  ou `initial` por desenho e ficam fora. Interpretação a confirmar com o aceitante.
- Q: Pares de estado inativo ou desabilitado falham a checagem de contraste? → A: Não. O WCAG 2.2 AA
  (premissa do A11Y-01) isenta componentes inativos: esses pares ficam no manifesto, são medidos e
  reportados, mas não falham o build (FR-020).
- Q: Indicador de foco que fica parte dentro e parte fora do componente precisa de 3:1 dos dois
  lados? → A: Não; basta um dos lados (Understanding 1.4.11). O manifesto declara esses pares como
  grupo em que ao menos um membro atinge o mínimo (FR-020).
- Q: Como um token que varia por marca e por modo aparece na ferramenta de design com marca e modo
  em coleções independentes e sem variáveis auxiliares (DSN-04, DSN-05)? → A: A fonte o expressa como
  token de eixo modo cujo valor em cada modo é alias para um token de eixo marca com as mesmas chaves
  em toda marca (FR-033).
- Q: Adicionar uma marca regenera o relatório de API de tokens, versionado por exigência do QA-08.
  Isso viola "apenas arquivos de tokens" (TOK-07)? → A: Não. O relatório é arquivo de tokens,
  derivado da fonte e nunca editado à mão; a checagem de diff aceita a fonte e esse relatório e
  rejeita qualquer outro arquivo (FR-009, SC-005).
- Q: Tokens compostos de tipografia são publicados? → A: Não. Só tokens com um valor CSS único são
  publicáveis; a categoria tipografia usa tokens atômicos (família, peso, tamanho, altura de linha,
  espaçamento), o que mantém um token por custom property, por entrada do mapa de valores e por
  variável na ferramenta de design (FR-006, FR-016, FR-028).

## User Scenarios & Testing *(mandatory)*

Atores:

- **Mantenedor do DS**: pessoa que cria e altera tokens no repositório do PatoDS.
- **Responsável de design da marca**: pessoa do requerente que define os valores de cada marca.
- **Dev de app consumidora**: pessoa que usa os tokens publicados numa aplicação React, Vue ou
  qualquer página web.
- **Designer**: pessoa que usa as variáveis do PatoDS na ferramenta de design.
- **Dono da sincronização**: papel do fornecedor que executa a sincronização com a ferramenta de
  design e corrige falhas (DSN-02).

### User Story 1 - Definir tokens numa fonte única validada (Priority: P1)

O mantenedor do DS define todos os tokens num único lugar, em formato aberto, organizados em
camadas primitiva, semântica e de componente, com nomes padronizados. Toda mudança proposta passa
por validação automática antes de ser integrada; token mal formado, mal nomeado, com valor literal
fora da camada primitiva ou com referência inválida é barrado.

**Why this priority**: tudo o mais (saídas geradas, temas, contraste, sincronização) depende de
uma fonte única confiável. Sem ela, não há "fonte única da aparência" (ADR-02, Princípio II).

**Independent Test**: propor mudanças com tokens válidos e inválidos (nome fora do padrão, literal
na camada semântica, alias para token inexistente, ciclo de alias, categoria sem token semântico) e
confirmar que só as válidas passam, com relatório por categoria.

**Acceptance Scenarios**:

1. **Given** a fonte de tokens válida, **When** o mantenedor propõe um token semântico com valor
   literal, **Then** a validação rejeita a mudança e aponta o token e a regra violada.
2. **Given** a fonte de tokens válida, **When** o mantenedor propõe um token com nome fora da
   convenção, **Then** a validação rejeita a mudança.
3. **Given** a fonte de tokens válida, **When** alguém tenta definir um token fora da fonte única
   (por exemplo, uma variável de cor declarada direto num arquivo de estilo), **Then** a busca da
   validação encontra a ocorrência e bloqueia a integração.
4. **Given** uma mudança válida, **When** a validação termina, **Then** o relatório lista a
   contagem de tokens por categoria e a escala de alturas de controle de cada tema.

---

### User Story 2 - Consumir tokens gerados com marca e modo por subárvore (Priority: P2)

A dev de app consumidora importa o CSS de uma marca e, opcionalmente, os módulos tipados de
referência. Ela escolhe marca e modo (claro ou escuro) marcando qualquer elemento da página, e pode
aninhar escopos: uma área em modo escuro dentro de uma página clara, ou uma marca diferente dentro
de outra. Ao digitar o nome de um token inexistente, recebe erro de tipos.

**Why this priority**: é a entrega de valor para quem usa o design system; sem ela os tokens não
saem do repositório.

**Independent Test**: numa app de exemplo que importa só o CSS da marca A, alternar modo e
aninhar escopos de marca e modo; verificar os valores aplicados em cada escopo, a ausência de
variáveis exclusivas da marca B e a ausência de variáveis sem valor; num projeto tipado, referenciar
um token inexistente e confirmar o erro de tipos.

**Acceptance Scenarios**:

1. **Given** uma app que importa só o CSS da marca A, selecionada conforme o FR-013, **When** o
   conteúdo é analisado, **Then** não há variável exclusiva da marca B nem variável usada sem valor.
2. **Given** um elemento com marca A e modo claro, **When** um descendente declara modo escuro,
   **Then** o descendente usa os valores de marca A e modo escuro, e o restante continua em marca A
   e modo claro.
3. **Given** escopos alternados marca A → marca B → marca A, **When** os valores são lidos no
   escopo mais interno, **Then** valem os da marca A.
4. **Given** um projeto tipado que usa os módulos de tokens, **When** o código referencia um nome de
   token inexistente, **Then** a verificação de tipos falha.
5. **Given** a mesma fonte de tokens, **When** o build roda duas vezes, **Then** as saídas são
   idênticas byte a byte.

---

### User Story 3 - Adicionar uma marca sem tocar em componentes (Priority: P3)

O responsável de design da marca entrega os valores de uma nova marca, e o mantenedor a adiciona
alterando apenas arquivos de tokens. A nova marca passa a existir nos modos claro e escuro, com o
mesmo conjunto de chaves semânticas das demais, e pode ser trocada em tempo de execução.

**Why this priority**: múltiplas marcas são requisito de contrato (TOK-07), mas dependem das
histórias 1 e 2.

**Independent Test**: adicionar uma marca sintética nova e conferir no diff que só arquivos de
tokens mudaram (fonte e relatório de API regenerado); conferir que a checagem de chaves passa e que a app de exemplo alterna
entre a marca nova e outra em tempo de execução.

**Acceptance Scenarios**:

1. **Given** duas marcas publicadas, **When** o mantenedor adiciona uma terceira, **Then** o diff
   altera apenas arquivos de tokens: a fonte e o relatório de API de tokens regenerado.
2. **Given** uma marca nova sem uma chave semântica que as demais têm, **When** a validação roda,
   **Then** a mudança é bloqueada e a chave ausente é apontada.
3. **Given** a app de exemplo, **When** a dev troca a marca em tempo de execução, **Then** os
   valores aplicados mudam sem recarregar a página e sem alterar código de componente.

---

### User Story 4 - Garantir contraste em todas as combinações (Priority: P4)

Cada par de cores de frente e fundo, em cada estado, é declarado num manifesto e medido em todas as
combinações de marca e modo. Par que não atinge a razão exigida pelo nível de acessibilidade alvo
falha o build.

**Why this priority**: acessibilidade é inegociável (Princípio V), mas a checagem só tem efeito
depois que existem tokens de cor e marcas.

**Independent Test**: incluir no manifesto um par sabidamente reprovado e outro com cor
translúcida; confirmar que o build falha no primeiro e que o segundo é medido com a opacidade
composta sobre o fundo.

**Acceptance Scenarios**:

1. **Given** um par de texto com razão abaixo de 4,5:1 em qualquer combinação, **When** o build
   roda, **Then** o build falha e aponta par, marca e modo.
2. **Given** um par não textual (incluindo indicador de foco) abaixo de 3:1, **When** o build roda,
   **Then** o build falha.
3. **Given** uma cor de frente com opacidade, **When** a razão é calculada, **Then** a cor é
   composta sobre o fundo antes do cálculo.
4. **Given** um estilo de exemplo que usa um par de cores ausente do manifesto, **When** a
   checagem roda, **Then** ela falha e aponta o par.

---

### User Story 5 - Barrar estilos fora dos tokens (Priority: P5)

O mantenedor que escreve estilos de componente recebe erro de lint ao usar token primitivo, valor
literal ou altura de controle fora da escala única.

**Why this priority**: a regra protege o núcleo de estilos, que nasce na feature de componentes;
aqui ela é entregue e provada por exemplos, e passa a valer no núcleo assim que ele existir.

**Independent Test**: rodar o lint sobre exemplos válidos e inválidos e confirmar 100% dos erros
esperados e zero falsos positivos.

**Acceptance Scenarios**:

1. **Given** um estilo de componente que usa token primitivo, **When** o lint roda, **Then** o
   merge é bloqueado.
2. **Given** um estilo de componente com valor literal de cor, espaço ou raio, **When** o lint
   roda, **Then** o merge é bloqueado.
3. **Given** um controle interativo com altura fora da escala, **When** o lint roda, **Then** o
   merge é bloqueado.
4. **Given** estilos que usam só tokens semânticos ou de componente, **When** o lint roda,
   **Then** não há erro.

---

### User Story 6 - Manter a ferramenta de design sincronizada com o repositório (Priority: P6)

A cada versão publicada, as variáveis da ferramenta de design recebem os tokens do repositório,
com os mesmos nomes e hierarquia, marca e modo como eixos independentes. Edição manual na
ferramenta é desfeita na sincronização seguinte. Divergências são detectadas por verificação
agendada e viram itens rastreáveis com responsável e prazo.

**Why this priority**: mantém design e código alinhados (seção DSN), mas depende de tokens
publicados e da decisão sobre a ferramenta.

**Independent Test**: publicar uma versão e conferir o log de variáveis alteradas; editar à mão
uma variável na ferramenta e conferir que a sincronização seguinte restaura o valor e registra a
ocorrência; trocar só a marca ou só o modo de um quadro e conferir que os valores mudam sem religar
camadas; provocar uma divergência e conferir o item gerado.

**Acceptance Scenarios**:

1. **Given** uma versão publicada, **When** a sincronização roda, **Then** as variáveis da
   ferramenta refletem os tokens e o log lista as variáveis alteradas.
2. **Given** uma variável editada à mão na ferramenta, **When** a sincronização seguinte roda,
   **Then** o valor da origem é restaurado e a ocorrência fica no log.
3. **Given** um quadro na ferramenta, **When** o designer troca só a marca ou só o modo, **Then**
   os valores mudam sem religar camadas.
4. **Given** uma divergência de nome, hierarquia ou valor entre ferramenta e repositório, **When**
   a verificação agendada roda, **Then** é criado um item rastreável com responsável e prazo.
5. **Given** uma falha de sincronização, **When** ela ocorre, **Then** um alerta é atribuído ao
   dono da sincronização.
6. **Given** a premissa vigente, **When** o repositório é inspecionado, **Then** não existe rotina
   que importe variáveis da ferramenta para o repositório.

---

### Edge Cases

- Alias que aponta para token inexistente ou que forma ciclo: a validação falha e aponta a cadeia.
- Token que referencia camada acima da sua (por exemplo, primitivo referenciando semântico): a
  validação falha.
- Marca ou modo com chave semântica a mais ou a menos que as demais combinações: bloqueado (TOK-09).
- Escopo interno que define só o modo: herda a marca do ancestral mais próximo e aplica o modo
  novo; o mesmo vale ao definir só a marca (cada eixo resolve pelo escopo mais próximo).
- Escopos de marca alternados (A → B → A): vale o escopo mais próximo.
- Atributo de marca ou modo com valor inexistente: o escopo continua com os valores do ancestral
  mais próximo, sem variável sem valor.
- Página sem nenhum atributo de marca ou modo que importa o CSS da marca padrão: aplica-se a
  combinação padrão, sem variável sem valor; app que importa só outra marca a seleciona por
  atributo na raiz do documento (FR-013).
- Página que importa o CSS de duas marcas: a marca padrão, se for uma delas, vale nos escopos sem
  atributo de marca, e a outra só tem efeito nos escopos que a selecionam.
- Arquivo de CSS de tokens editado à mão no repositório: a validação falha, pois esse arquivo é
  gerado.
- Cor com opacidade em par de contraste: compõe-se sobre o fundo antes de medir.
- Remoção ou renomeação de token publicado: é mudança incompatível de API pública e segue SemVer
  (Princípio X).
- Plano da ferramenta de design com limite de modos menor que o número de marcas × modos: o limite
  e a solução adotada ficam registrados (DSN-05).
- Sincronização interrompida no meio: a próxima execução converge para o estado da origem, sem
  deixar variáveis parciais divergentes sem registro.
- Edição manual na ferramenta entre duas sincronizações: a divergência é detectada pela verificação
  agendada e desfeita na sincronização seguinte.

## Requirements *(mandatory)*

### Functional Requirements

**Fonte única e estrutura**

- **FR-001**: O sistema DEVE definir todos os tokens numa fonte única no formato W3C Design Tokens
  (DTCG); nenhum token PODE ser definido fora dela, e uma busca automatizada no repositório DEVE
  confirmar isso (TOK-01).
- **FR-002**: O sistema DEVE validar a fonte contra o schema DTCG em toda mudança proposta; erro de
  schema DEVE bloquear o merge (TOK-01).
- **FR-003**: O sistema DEVE organizar os tokens em três camadas: primitivos, semânticos e de
  componente. Só tokens primitivos PODEM ter valor literal; semânticos e de componente DEVEM
  referenciar outros tokens por alias, e a validação DEVE rejeitar literal fora da camada
  primitiva (TOK-02).
- **FR-004**: Todo alias DEVE resolver para um token existente, sem ciclo (TOK-01, TOK-02). Nenhuma
  camada PODE referenciar camada acima dela (primitivo → primitivo; semântico → primitivo ou
  semântico; componente → semântico, componente ou primitivo). Justificativa, sem ID próprio:
  referência de camada inferior para camada superior inverte as três camadas do TOK-02 e faria o
  valor de um primitivo depender de marca ou modo.
- **FR-005**: O sistema DEVE adotar convenção de nomenclatura documentada, com prefixo `<prefixo>`
  e segmentos em ordem fixa (ex.: categoria-propriedade-estado); a validação DEVE rejeitar nome
  fora do padrão, e 100% dos tokens publicados DEVEM passar (TOK-04).
- **FR-006**: O sistema DEVE cobrir as categorias cor, tipografia, espaço, dimensão, raio, borda,
  sombra, movimento, z-index, breakpoints e opacidade, com ao menos um token semântico publicado em
  cada uma (TOK-10).
- **FR-007**: O sistema DEVE definir uma escala única de alturas para controles interativos, usada
  por todos os controles (TOK-13).
- **FR-008**: O sistema DEVE emitir, a cada build, relatório com a contagem de tokens por categoria
  e a escala de alturas de controle de cada tema (TOK-10, TOK-13).

**Marcas, modos e escopos**

- **FR-009**: O sistema DEVE suportar múltiplas marcas e publicar os tokens de cada marca da decisão
  "Marcas e temas da versão 1.0" (premissa vigente: todas as marcas das apps consumidoras atuais),
  cada uma nos modos claro e escuro; adicionar uma marca DEVE alterar apenas arquivos de tokens (a
  fonte de tokens e o relatório de API de tokens regenerado pelo build), nunca código de componente
  ou de ferramenta, comprovado pelo diff (TOK-07).
- **FR-010**: O sistema DEVE oferecer modos claro e escuro como eixo independente da marca,
  combinável com qualquer marca; marca e modo DEVEM ser selecionados por atributos de dados
  distintos, ambos com o prefixo (`data-<prefixo>-*`), e o build DEVE gerar saída válida para todas
  as combinações (TOK-08, CMP-05).
- **FR-011**: Toda combinação de marca e modo DEVE ter exatamente o mesmo conjunto de chaves
  semânticas; uma checagem DEVE comparar todas as combinações, e chave ausente ou excedente DEVE
  bloquear o merge (TOK-09).
- **FR-012**: Os atributos de marca e modo DEVEM valer em qualquer elemento, cada escopo DEVE
  redeclarar os tokens semânticos, e em escopos aninhados DEVEM valer, para cada eixo, os valores
  do escopo mais próximo (TOK-14, no nível de CSS).
- **FR-013**: Sem atributo de modo no elemento nem em ancestral, DEVE valer o modo padrão; sem
  atributo de marca no elemento nem em ancestral, DEVE valer a marca padrão indicada pelo
  requerente (CMP-24). Valores de tokens de marca aplicados sem atributo de marca DEVEM vir somente
  do CSS da marca padrão; app que importa só o CSS de outra marca seleciona essa marca por atributo
  na raiz do documento, pois o arquivo de cada marca contém só seletores dela (ENG-06). Nessas
  condições, nenhuma variável PODE ficar sem valor, no sentido da definição operacional da seção
  Clarifications.
- **FR-014**: Valor de atributo de marca ou modo inexistente NÃO DEVE deixar variável sem valor; o
  escopo continua com os valores do ancestral mais próximo. Justificativa, sem ID próprio: estende a
  valores de atributo inválidos a exigência do ENG-06 de que a app não tenha variáveis CSS sem valor.

**Saídas geradas**

- **FR-015**: O sistema DEVE gerar, a partir da fonte única, CSS custom properties com prefixo
  `--<prefixo>-`; o repositório NÃO DEVE versionar arquivo CSS de tokens editado à mão, e dois
  builds da mesma fonte DEVEM produzir saída idêntica byte a byte (TOK-05).
- **FR-016**: O sistema DEVE gerar módulos JavaScript ESM com declarações de tipo TypeScript para
  todos os tokens: os módulos exportam referências `var(--<prefixo>-*)` e, em entrada separada,
  mapas de valores por marca e modo. O pacote publicado DEVE conter os módulos ESM e os arquivos
  .d.ts das duas entradas, e referenciar nome de token inexistente DEVE gerar erro de tipos,
  comprovado por teste de tipos (TOK-06).
- **FR-017**: O sistema DEVE distribuir o CSS de cada marca, com os modos claro e escuro, num
  arquivo próprio que contém só seletores dessa marca, incluídos, no arquivo da marca padrão, os que
  aplicam a combinação padrão (FR-013), conforme checagem automatizada; o que é neutro de marca
  (ordem das camadas, primitivos compartilhados, modo padrão, resolvedor de tokens) DEVE ficar num
  arquivo base comum, sem valor exclusivo de nenhuma marca. Uma app de exemplo que importa o arquivo
  base e só a marca A NÃO DEVE conter variáveis exclusivas da marca B nem variáveis sem valor
  (ENG-06).
- **FR-018**: Uma app de exemplo, que DEVE consumir o pacote de tokens empacotado e nunca o
  código-fonte (Princípio VII, QA-06), DEVE alternar entre duas marcas e entre os dois modos em tempo
  de execução e demonstrar escopos aninhados, sem alterar código de componente (TOK-07, TOK-14). A
  app de exemplo do FR-017 segue a mesma regra.

**Contraste**

- **FR-019**: O sistema DEVE manter um manifesto versionado dos pares de cor de frente, fundo e
  estado, classificados como texto ou não texto (A11Y-09).
- **FR-020**: Uma checagem DEVE medir cada par do manifesto em todas as combinações de marca e
  modo, compondo a opacidade antes de calcular a razão; sob a premissa vigente (WCAG 2.2 AA), texto
  exige 4,5:1 e não texto, incluindo indicador de foco, 3:1; par reprovado DEVE falhar o build
  (A11Y-09). Pares de estado inativo ou desabilitado, isentos pelo WCAG 2.2 AA, DEVEM constar do
  manifesto e ser medidos e reportados, sem falhar o build; indicador de foco que fica parte dentro e
  parte fora do componente é aprovado quando ao menos um dos lados atinge 3:1 (A11Y-01, A11Y-09).
- **FR-021**: O sistema DEVE fornecer checagem que falha quando um estilo usa par de cores de frente
  e fundo ausente do manifesto, entregue com exemplos válidos e inválidos que disparam 100% dos
  erros esperados e zero falsos positivos; a checagem DEVE ser aplicada ao núcleo de estilos assim
  que ele existir (A11Y-09).

**Lint de estilos**

- **FR-022**: O sistema DEVE fornecer regra de lint de estilos que bloqueia o merge ao detectar
  token primitivo ou valor literal em estilo de componente (TOK-03).
- **FR-023**: A mesma regra DEVE rejeitar altura de controle interativo fora da escala única
  (TOK-13).
- **FR-024**: A regra DEVE ser entregue com exemplos válidos e inválidos que disparam 100% dos
  erros esperados e zero falsos positivos, e DEVE ser aplicada ao núcleo de estilos assim que ele
  existir, com relatório de zero violações no CI (TOK-03).

**Sincronização com a ferramenta de design**

- **FR-025**: Um pipeline versionado DEVE sincronizar automaticamente os tokens com as variáveis
  da ferramenta de design a cada versão publicada e registrar log das variáveis alteradas; sob a
  premissa vigente (o repositório é a fonte, a ferramenta recebe as variáveis), nenhuma rotina PODE
  importar variáveis da ferramenta para o repositório (DSN-01).
- **FR-026**: O arquivo de donos DEVE indicar o papel dono da sincronização, e toda falha de
  sincronização DEVE gerar alerta atribuído a esse papel (DSN-02).
- **FR-027**: Edição manual no destino DEVE ser restaurada pela sincronização seguinte para o valor
  da origem e registrada no log, comprovado por teste com alteração manual proposital (DSN-03).
- **FR-028**: Cada variável na ferramenta DEVE ter nome e hierarquia idênticos ao token
  correspondente; o relatório de divergência DEVE apontar zero diferenças de nome ou hierarquia
  (DSN-04).
- **FR-029**: Marca e modo DEVEM ser eixos trocáveis de forma independente na ferramenta: trocar só
  a marca ou só o modo de um quadro altera os valores sem religar camadas; os limites de modos do
  plano da ferramenta e a solução adotada DEVEM ficar registrados (DSN-05).
- **FR-030**: Uma verificação agendada, ao menos semanal e a cada versão publicada, DEVE comparar
  tokens do build e variáveis da ferramenta; cada divergência DEVE gerar item rastreável com
  responsável e prazo (DSN-11, parte de tokens).

**Rastreabilidade e itens condicionais**

- **FR-031**: Cada ID atendido por esta feature DEVE ter check de CI ou evidência retida ligado na
  matriz de rastreabilidade (ACE-02).
- **FR-032**: Se o TOK-12 (Desejável) for contratado, o CI DEVE publicar a cada build relatório de
  tokens sem referência em componentes ou em outros tokens, e cada item DEVE ter decisão registrada
  antes do release: manter, depreciar ou remover (TOK-12). A contratação do TOK-12 está pendente com
  o requerente; até a resposta, este FR não entra no plano nem nas tarefas.
- **FR-033**: Token semântico que varia por marca e por modo DEVE ser expresso como token de eixo
  modo cujo valor em cada modo é alias para um token de eixo marca, com as mesmas chaves em toda
  marca; a validação DEVE rejeitar variação nos dois eixos que não siga essa forma (TOK-09, DSN-04,
  DSN-05). Justificativa: é a forma que permite marca e modo como eixos independentes no CSS
  (FR-012) e na ferramenta de design sem variáveis que não correspondam a tokens (FR-028, FR-029).

### Rastreabilidade dos Requisitos

| ID | Atendido por | Observação |
| --- | --- | --- |
| TOK-01 | FR-001, FR-002 | |
| TOK-02 | FR-003, FR-004 | |
| TOK-03 | FR-022, FR-024 | Zero violações no núcleo quando ele existir (feature de componentes) |
| TOK-04 | FR-005 | Publicação da convenção no site depende da feature de docs |
| TOK-05 | FR-015 | |
| TOK-06 | FR-016 | |
| TOK-07 | FR-009, FR-018 | |
| TOK-08 | FR-010 | |
| TOK-09 | FR-011, FR-033 | |
| TOK-10 | FR-006, FR-008 | |
| TOK-12 | FR-032 | Desejável; só se contratado |
| TOK-13 | FR-007, FR-008, FR-023 | |
| TOK-14 | FR-012, FR-018 | Parcial: testes React/Vue e SSR na feature de componentes |
| ENG-06 | FR-013, FR-014, FR-017 | |
| CMP-05 | FR-010 | Parcial: só atributos de tema; demais na feature de componentes |
| A11Y-09 | FR-019, FR-020, FR-021 | Aplicação do FR-021 ao núcleo na feature de componentes |
| DSN-01 | FR-025 | Gatilho "versão publicada" depende do pipeline de publicação |
| DSN-02 | FR-026 | |
| DSN-03 | FR-027 | |
| DSN-04 | FR-028, FR-033 | |
| DSN-05 | FR-029, FR-033 | |
| DSN-11 | FR-030 | Parcial: ícones, componentes, variantes, propriedades e estágio nas features respectivas |

### Key Entities *(include if feature involves data)*

- **Token**: unidade de decisão visual; tem nome, camada, categoria, valor literal (só primitivo)
  ou alias, e descrição.
- **Camada**: primitiva, semântica ou de componente; define o que um token pode referenciar.
- **Categoria**: uma das onze categorias do TOK-10.
- **Marca**: identidade visual; fornece valores para os tokens semânticos.
- **Modo**: claro ou escuro; eixo independente da marca.
- **Combinação de tema**: par marca × modo; todas têm o mesmo conjunto de chaves semânticas.
- **Escopo de tema**: elemento que seleciona marca, modo ou ambos para sua subárvore.
- **Escala de alturas de controle**: conjunto fechado de alturas permitidas para controles
  interativos.
- **Par de contraste**: frente, fundo, estado e tipo (texto ou não texto), com razão mínima.
- **Artefato gerado**: CSS por marca, módulo de referências tipado, mapa de valores por marca e
  modo, relatório de build.
- **Variável da ferramenta de design**: espelho de um token na ferramenta, com mesmo nome e
  hierarquia.
- **Registro de sincronização**: log de cada execução, com variáveis alteradas e edições manuais
  restauradas.
- **Divergência**: diferença detectada entre ferramenta e repositório, com tipo, responsável e
  prazo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos tokens publicados passam na validação de schema, de camadas e de
  nomenclatura, e zero tokens são encontrados fora da fonte única.
- **SC-002**: Dois builds da mesma fonte produzem saídas idênticas em 100% das execuções.
- **SC-003**: Cada uma das onze categorias tem ao menos um token semântico publicado.
- **SC-004**: Todas as combinações de marca e modo têm o mesmo conjunto de chaves semânticas (zero
  chaves ausentes ou excedentes).
- **SC-005**: Uma marca nova é adicionada com zero arquivos alterados além da fonte de tokens e do
  relatório de API de tokens regenerado.
- **SC-006**: Uma aplicação que importa o arquivo base e só uma marca, selecionada conforme o
  FR-013, carrega zero variáveis exclusivas de outras marcas e zero variáveis sem valor (definição
  operacional na seção Clarifications).
- **SC-007**: Em escopos aninhados, 100% dos valores lidos correspondem ao escopo mais próximo de
  cada eixo.
- **SC-008**: 100% dos pares do manifesto atingem a razão mínima em todas as combinações de marca e
  modo.
- **SC-009**: Cada tipo de violação coberto por esta feature (literal fora da camada primitiva,
  nome fora do padrão, chave ausente, par reprovado, primitivo ou literal em estilo, altura fora da
  escala, nome de token inexistente) é barrado em 100% dos casos provocados de propósito.
- **SC-010**: Após cada sincronização, o relatório de divergência aponta zero diferenças de nome ou
  hierarquia, e 100% das edições manuais no destino são restauradas e registradas.
- **SC-011**: A verificação de divergência roda ao menos uma vez por semana e a cada versão
  publicada, e 100% das divergências têm responsável e prazo.

## Assumptions

- Marcas da versão 1.0: vale a premissa vigente, todas as marcas das apps consumidoras atuais, com
  claro e escuro. Os valores vêm do responsável de design de cada marca antes da Fase 1; até lá,
  testes e exemplos usam duas marcas sintéticas (A e B), sem dados reais (QA-15).
- Nível de acessibilidade: vale a premissa vigente, WCAG 2.2 AA (A11Y-01).
- Direção da sincronização: vale a premissa vigente, o repositório é a fonte e a ferramenta recebe
  as variáveis (DSN-01).
- Combinação padrão: marca indicada pelo requerente (CMP-24) e modo padrão claro, até decisão em
  contrário.
- Prefixo: `<prefixo>` é marcador intencional do prefixo do projeto, conforme o TODO(PREFIXO) da
  constituição v1.0.0; o valor será definido pelo requerente e incorporado por emenda da
  constituição, sem alterar os requisitos desta feature.
- Ferramenta de design: a escolha é decisão em aberto do requerente, com prazo antes do início da
  Fase 1 (Premissas); os requisitos desta feature valem para qualquer ferramenta escolhida, e os
  limites dela, como o número de modos do plano, são registrados conforme o FR-029. A escolha é
  insumo do plano.
- "Versão publicada" é a versão promovida à tag principal do registro (ENG-26). Enquanto o pipeline
  de publicação não existir, a sincronização PODE ser disparada manualmente pelo dono da
  sincronização, com o mesmo log.
- Navegadores alvo seguem a lista versionada da premissa de versões mínimas (ENG-08).
- Remover ou renomear token publicado é mudança incompatível de API pública e exige versão major
  (GOV-01).

**Dependências**

- Feature de CI e publicação: pré-release e promoção (ENG-26), verificação de API pública
  (GOV-01) e arquivo de donos (GOV-09) para o gatilho e os portões desta feature.
- Feature de núcleo e componentes: aplicação do lint ao núcleo (FR-024), aplicação ao núcleo da
  checagem de pares (FR-021), Provedor de tema e testes React/Vue de tema aninhado e SSR (TOK-14).
- Feature de documentação: publicação da convenção de nomenclatura no site (TOK-04) e fundamentos
  de tokens (DOC-05).
- Requerente: lista e valores das marcas, marca padrão, escolha da ferramenta de design, acesso à
  conta da ferramenta, valor do prefixo e resposta sobre a contratação do TOK-12 (FR-032).

**Fora do escopo**

- Componentes, Provedor de tema e seus testes React/Vue de tema aninhado e SSR.
- Documentação dos fundamentos no site (DOC-05).
- Mapeamento de tokens legados (MIG-03) e temas que reproduzem marcas legadas (MIG-08).
- Sincronização de ícones, componentes, variantes, propriedades e estágio com a ferramenta de
  design (demais partes do DSN-11 e DSN-06 a DSN-09).
