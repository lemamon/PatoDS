<!--
Sync Impact Report
- Versão: (template sem versão) → 1.0.0
- Princípios: todos novos (I a XIII); nenhum renomeado ou removido.
  I. Três fontes declaradas, todo o resto derivado; II. Tokens DTCG como fonte única da aparência;
  III. Núcleo agnóstico, implementação nativa por framework; IV. Paridade React e Vue verificada
  por máquina; V. Acessibilidade verificável (INEGOCIÁVEL); VI. Componentes robustos por padrão;
  VII. Qualidade comprovada em navegador real, com portões bloqueantes; VIII. Agentes de IA
  consomem o catálogo, nunca adivinham; IX. Cadeia de suprimentos e publicação seguras;
  X. Versionamento previsível e ciclo de vida explícito; XI. Monorepo com fronteiras de camada
  impostas; XII. Migração incremental com coexistência; XIII. Documentação única e verificada no CI.
- Seções adicionadas: Restrições de Escopo, Plataforma e Segurança; Fluxo de Desenvolvimento e
  Portões de Qualidade; Governança.
- Seções removidas: nenhuma.
- Templates dependentes: nenhum alterado (plan, spec e tasks leem esta constituição em runtime;
  o "Constitution Check" do plan-template é preenchido a partir da lista de portões desta
  constituição).
- TODOs adiados:
  - TODO(PREFIXO): prefixo do projeto (`<prefixo>` nos Requisitos) ainda não definido.
-->

# Constituição do PatoDS

O PatoDS é um design system único que entrega a mesma aparência, a mesma API e o mesmo nível de
acessibilidade em aplicações React e Vue, consultável por pessoas e por agentes de IA. A fonte de
requisitos é o documento "Requisitos de Design System Multi-framework" (versão de 2026-10-20),
doravante "Requisitos". Os IDs citados (ADR-xx, TOK-xx, CMP-xx, A11Y-xx etc.) referem-se a ele.

Convenção: DEVE e NÃO DEVE indicam regra obrigatória; DEVERIA indica recomendação cuja exceção
exige justificativa registrada; PODE indica opção.

TODO(PREFIXO): os Requisitos ainda não definem o prefixo do projeto. Até a definição, `<prefixo>`
é marcador intencional do prefixo usado em tokens, classes, atributos de dados e no escopo do
registro (TOK-04, TOK-05, CMP-05, ENG-20) e DEVE ser substituído por emenda quando o valor for
definido.

## Princípios Fundamentais

### I. Três fontes declaradas, todo o resto derivado

- Existem exatamente três fontes declaradas: tokens DTCG (aparência), tipos TypeScript exportados
  com comentários de API (contrato de API) e um arquivo de orientação de uso por componente
  (metadados escritos à mão: quando usar, estágio, categoria e demais campos).
- O catálogo DEVE ser compilado no build a partir dessas fontes, e site de documentação, MCP, CLI
  e o conteúdo factual de skills e instruções de uso DEVEM obter dele os dados dos componentes;
  extrator próprio por consumidor, serviço hospedado consultado em tempo real e site de
  documentação como fonte NÃO DEVEM ser usados (ADR-06, DOC-03, DOC-11, IA-02, IA-08, IA-13). Nada
  derivado é editado à mão.
- O texto procedural das skills, em templates versionados com dono, e o arquivo de instruções da
  raiz do repositório (IA-09) são escritos à mão e não são derivados (IA-08).
- Contrato de DOM e grafo de dependências DEVEM ser extraídos no build do núcleo e dos pacotes.
- Artefatos gerados que são versionados (catálogo, skills) DEVEM ser regenerados no CI, e o CI
  DEVE falhar em qualquer divergência (IA-02, IA-08).
- A geração do catálogo DEVE ser determinística: duas gerações sobre o mesmo commit, em máquinas
  diferentes, produzem o mesmo hash (IA-04). Dois builds da mesma fonte de tokens DEVEM produzir
  saída idêntica byte a byte (TOK-05).
- Nenhum consumidor (docs, MCP, CLI, skills, apps de exemplo) PODE manter tabela de props ou valor
  de token escrito à mão (DOC-03, DOC-11).

Motivo: cópias divergem. Uma fonte por fato e um catálogo único como intermediário mantêm docs,
agentes e pacotes alinhados à mesma versão (ADR-05, ADR-06).

### II. Tokens DTCG como fonte única da aparência

- Todo token DEVE estar na fonte única em formato W3C DTCG, validada por schema no CI (TOK-01).
- Tokens DEVEM seguir três camadas: primitivos, semânticos e de componente. Só primitivos têm
  valor literal; as demais camadas referenciam por alias (TOK-02).
- Estilos de componente DEVEM consumir somente tokens semânticos ou de componente. Token primitivo
  ou valor literal em estilo de componente bloqueia o merge (TOK-03).
- Nomes DEVEM seguir a convenção documentada, com prefixo `<prefixo>` e segmentos em ordem fixa;
  a saída DEVE incluir CSS custom properties `--<prefixo>-*` e módulos ESM tipados (TOK-04 a
  TOK-06).
- Marca e modo (claro/escuro) DEVEM ser eixos independentes, selecionados por atributos distintos,
  aplicáveis a qualquer subárvore com escopos aninhados (TOK-07, TOK-08, TOK-14).
- Toda combinação de marca e modo DEVE ter o mesmo conjunto de chaves semânticas (TOK-09).
- Adicionar uma marca DEVE alterar apenas arquivos de tokens, nunca código de componente (TOK-07).
- Controles interativos DEVEM usar uma escala única de alturas (TOK-13).
- A sincronização com a ferramenta de design DEVE ocorrer automaticamente a cada versão
  publicada, na direção definida em Premissas; vale a premissa vigente: o repositório é a fonte, a
  ferramenta recebe as variáveis e nenhuma rotina importa variáveis para o repositório (DSN-01).
  Edição manual no destino DEVE ser restaurada pela sincronização seguinte e registrada em log
  (DSN-03).
- Variáveis da ferramenta de design DEVEM ter nome e hierarquia idênticos aos tokens, com marca e
  modo como eixos trocáveis de forma independente (DSN-04, DSN-05). Divergências entre ferramenta
  e código em tokens, ícones, componentes, variantes, propriedades e estágio DEVEM ser detectadas
  automaticamente, ao menos semanalmente e a cada versão publicada, cada uma com item rastreável,
  responsável e prazo (DSN-11).
- Componente estável ou depreciado com representação visual DEVE ter correspondente com o mesmo
  nome e estágio na biblioteca de design (DSN-06); componente estável com representação visual
  DEVE ter mapeamento design-código com snippet que compila no CI (DSN-09).

Motivo: formato aberto, neutro de framework e legível por ferramentas e agentes (ADR-02); a
sincronização numa só direção impede que a ferramenta de design vire fonte não declarada.

### III. Núcleo agnóstico, implementação nativa por framework

- Estilos DEVEM viver num núcleo CSS agnóstico, com classes prefixadas e camadas `@layer`,
  publicado pelo pacote de estilos. Pacotes React e Vue NÃO DEVEM conter regras CSS e DEVEM
  aplicar as mesmas classes do núcleo para cada variante (ADR-03, CMP-04). CSS Modules, CSS-in-JS
  em runtime e classes utilitárias no markup NÃO DEVEM ser usados para estilizar componentes
  (ADR-03).
- Cada framework DEVE ter implementação nativa e idiomática, com reatividade e SSR nativos. Web
  Components, geração de código a partir de fonte única e wrappers de um framework para o outro
  NÃO DEVEM ser usados (ADR-01).
- Componentes interativos DEVEM ser construídos sobre primitivos headless de biblioteca mantida e
  acessível em cada framework (ADR-04, CMP-02). Exceção pontual ao CMP-02 exige ADR; construir
  primitivos headless próprios do zero, adotar biblioteca já estilizada ou reaproveitar componentes
  legados como abordagem contraria o ADR-04 e exige pedido de mudança aprovado e novo ADR
  (GOV-07). A escolha da biblioteca segue a prova de conceito do CMP-28 e a decisão em Premissas.
- Cada componente DEVE ter contrato de DOM versionado (classes, atributos `data-<prefixo>-*`,
  variáveis CSS). O núcleo NÃO DEVE estilizar seletores sobre atributos dos primitivos headless
  (CMP-14).
- Componentes, classes CSS e atributos públicos DEVEM usar o prefixo `<prefixo>` (CMP-05).

Motivo: API idiomática em cada app sem degradar tipos, eventos ou SSR; o custo de escrever o
comportamento duas vezes é contido pelos Princípios IV e VII.

### IV. Paridade React e Vue verificada por máquina

- Todo componente publicado DEVE existir nos dois frameworks com a mesma API conceitual, expressa
  no idioma nativo: `v-model` em Vue, `value` com callback em React (CMP-03).
- Cada componente DEVE ter tabela de equivalência de props, eventos, slots, modelos e APIs
  imperativas, com regras de normalização versionadas (CMP-03).
- O CI DEVE comparar automaticamente a superfície pública dos dois pacotes. Divergência sem
  exceção aprovada bloqueia o merge (CMP-12).
- O snapshot normalizado de DOM de cada estado DEVE ser idêntico entre React e Vue e coincidir com
  o contrato de DOM (CMP-14).
- Cada componente DEVE ter uma única especificação de comportamento, executada nos dois
  frameworks; falha em qualquer um bloqueia o merge (CMP-15).
- Componentes com estado DEVEM aceitar uso controlado e não controlado (CMP-07); componentes de
  coleção DEVEM inferir o tipo do item, inclusive em template Vue (CMP-25).

Motivo: sem paridade verificável, os frameworks divergem e as apps herdam inconsistências.

### V. Acessibilidade verificável (INEGOCIÁVEL)

- O PatoDS DEVE declarar um único nível de conformidade alvo; vale a premissa vigente, WCAG 2.2
  AA (A11Y-01).
- Cada componente DEVE ter zero violações do motor de regras automatizado em toda a matriz
  framework × tema × modo, inclusive após passos de interação (A11Y-02).
- Lint de acessibilidade DEVE estar ativo nos dois frameworks, falhando com erro ou aviso
  (A11Y-03).
- Componentes interativos DEVEM ser operáveis só por teclado conforme o padrão APG aplicável e
  exibir foco visível (A11Y-04, A11Y-05).
- Tokens de cor DEVEM atender às razões de contraste do nível alvo, medidas sobre manifesto
  versionado de pares e com opacidade composta (A11Y-09).
- Estado e significado NÃO DEVEM depender só de cor (A11Y-23).
- Cada componente DEVE manter conteúdo e função a 320 px de largura, com zoom de texto de 200% e
  espaçamento de texto aumentado, na matriz do QA-05, salvo a rolagem interna da Tabela
  (A11Y-21); cada alvo de ponteiro DEVE medir ao menos 24 por 24 px, salvo a exceção de
  espaçamento do critério 2.5.8 (A11Y-19); conteúdo do próprio sistema NÃO DEVE encobrir
  totalmente o elemento com foco (A11Y-18).
- Cada componente DEVE publicar, na sua página e no catálogo, declaração de conformidade com os
  critérios atendidos, as limitações conhecidas e a data da última revisão (A11Y-12); cada
  animação automática DEVE atender ao critério 2.2.2 ou declarar no catálogo a exceção aplicável
  (A11Y-24).
- Promoção a estável DEVE exigir auditoria manual por pessoa diferente do autor (A11Y-16) e, para
  os componentes listados no Inventário, teste manual com leitor de tela em React e Vue (A11Y-08).
- Toda exceção DEVE estar em arquivo versionado com justificativa, responsável e prazo, visível na
  documentação do componente. Exceção vencida falha o CI. Regra desativada sem exceção registrada é
  proibida (A11Y-11).

Motivo: conformidade exigível em contrato precisa ser comprovada por teste e auditoria, não
declarada.

### VI. Componentes robustos por padrão

- Renderização no servidor: nenhum componente PODE usar APIs do navegador no render ou no setup;
  zero erros e zero avisos de hidratação; CSS presente no HTML inicial (CMP-08).
- React Server Components: todo módulo com hooks ou manipuladores de evento DEVE ter `use client`;
  o catálogo DEVE marcar cada componente como seguro no servidor ou só cliente (CMP-22).
- Segurança: HTML cru (`v-html`, `dangerouslySetInnerHTML`) DEVE ser bloqueado por lint
  (CMP-16); atributos de URL DEVEM aceitar só esquemas de allowlist versionada, igual nos dois
  frameworks (CMP-17); componentes DEVEM funcionar sob CSP sem `unsafe-eval` nem `unsafe-inline`
  em `script-src`, com nonce configurável (CMP-26).
- Estado de APIs imperativas DEVE ser isolado por requisição no SSR (CMP-20); sobreposições em
  Portal DEVEM herdar marca e modo da origem (CMP-21).
- Internacionalização: textos internos e nomes acessíveis DEVEM vir de props ou mensagens
  traduzíveis (CMP-09).
- Cada componente DEVE renderizar sem provedores, com padrões documentados de tema, localidade e
  roteamento (CMP-24).
- Avisos de uso incorreto DEVEM sair só em desenvolvimento, com código estável e link para a
  documentação; o bundle de produção NÃO DEVE conter seus textos (CMP-23).
- Tipos públicos DEVEM ser exportados sem `any` (CMP-11) e publicados como declarações junto do
  código compilado (ENG-05); pacotes DEVEM ser ESM com tree-shaking por componente, sem perder CSS
  no build de produção (ENG-04); ícones DEVEM ser carregáveis sob demanda com nomes tipados
  (CMP-10).

Motivo: o design system roda em apps SPA, SSR e RSC sob políticas de segurança variadas; cada
garantia precisa valer sem configuração extra.

### VII. Qualidade comprovada em navegador real, com portões bloqueantes

- Comportamento e acessibilidade DEVEM ser validados por stories executadas como testes de
  interação e de acessibilidade em navegador real, nunca em DOM simulado, com navegador e fontes
  de ambiente versionado e sem rede externa (ADR-08, QA-01).
- Os testes de interação DEVEM rodar em todos os motores da lista de navegadores definida em
  Premissas, à noite e antes de cada publicação; falha em qualquer motor DEVE bloquear a
  publicação e abrir issue automaticamente, e o pull request PODE rodar em um só motor (QA-12).
- Toda lógica fora da UI (utilitários, hooks, composables, scripts de build) DEVE ter teste
  unitário (QA-02).
- Regressão visual DEVE ser check obrigatório de merge sobre o subconjunto do PR e da fila de merge
  fixado na matriz versionada de frameworks, temas, modos, larguras e estados, e a matriz completa
  DEVE estar verde antes da promoção à tag principal; diferença só passa com aprovação de revisor
  visual que seja dono de design e não autor do PR (QA-04, QA-05, ENG-26).
- Tipos públicos DEVEM ter testes, com ao menos um caso negativo por componente, e relatório de API
  versionado (QA-08).
- Apps de exemplo DEVEM consumir o pacote empacotado (tarball) ou o registro, nunca o código-fonte
  (QA-06, ENG-10).
- Cobertura, orçamento de bundle, tolerância visual, taxa de testes instáveis e demais limiares
  DEVEM viver num único arquivo versionado, alterável só com aprovação de pessoa indicada pelo
  requerente (QA-14). Os valores seguem Premissas.
- Checks obrigatórios DEVEM bloquear o merge, não apenas avisar. A taxa de testes instáveis DEVE
  ser medida por reexecuções com resultado divergente, incluídos os testes em quarentena, e ficar
  no limite do arquivo de limiares (QA-09); teste em quarentena NÃO DEVE contar como aprovado
  (QA-01). Se o QA-10 (Desejável) for contratado, cada teste em quarentena DEVE ter issue
  vinculada, dono e prazo de correção.
- Stories, fixtures, exemplos e snapshots DEVEM usar só dados sintéticos (QA-15).

Motivo: foco, layout e contraste só são confiáveis com renderização real; avisos ignorados viram
regressões.

### VIII. Agentes de IA consomem o catálogo, nunca adivinham

- O catálogo DEVE ser legível por máquina, validado por JSON Schema publicado e versionado com o
  pacote, e conter os campos exigidos pelos Requisitos (IA-01, IA-03).
- O catálogo DEVE ser publicado dentro dos pacotes de UI que descreve, gerado do mesmo commit
  (IA-06), e ficar fora do código importado pela app (ADR-06, QA-07).
- Servidor MCP e CLI DEVEM ser locais e somente leitura, sem escrita em disco, sem rede e sem
  credenciais (salvo telemetria ativada conforme Premissas), e responder com o catálogo do pacote
  instalado, informando sua versão (ADR-07, IA-05, IA-07, IA-13, IA-16).
- Cada ferramenta MCP DEVE ter schemas de entrada e saída versionados (IA-17); cada comando da CLI
  DEVE ter saída JSON validada contra JSON Schema e códigos de saída documentados (IA-07). A
  verificação de API pública cobre os schemas do MCP e da CLI (IA-17, GOV-01).
- Conteúdo factual de skills e instruções DEVE ser gerado do catálogo; texto procedural fica em
  templates versionados com dono, e lint DEVE barrar nome de componente, prop ou token escrito à
  mão neles (IA-08).
- A suíte determinística de roteamento DEVE rodar em todo pull request contra o catálogo real, sem
  chamar modelo de linguagem, e bloquear o merge com taxa abaixo do limiar do arquivo do QA-14
  (IA-10); evals de qualidade de resposta DEVEM rodar à noite e antes de cada release e bloquear o
  release abaixo do limiar, salvo release de correção de segurança, que segue com o resultado
  registrado (IA-14). Os limiares seguem a premissa vigente: são definidos sobre linha de base
  medida no início da Fase 3.
- Texto livre do catálogo com Unicode invisível ou URL fora de allowlist DEVE falhar o build
  (IA-18).

Motivo: agentes erram quando adivinham; um catálogo verificável e casado com a versão instalada
os mantém corretos.

### IX. Cadeia de suprimentos e publicação seguras

- Versões DEVEM ser publicadas somente pelo pipeline, após aprovação de duas pessoas com MFA;
  nenhum token pessoal PODE ter permissão de publicação (ENG-15, GOV-10).
- O escopo `@<prefixo>` DEVE estar reservado no registro público de pacotes, em conta indicada
  pelo requerente; check diário e antes de cada publicação DEVE falhar se o escopo não pertencer a
  essa conta (ENG-20).
- Toda versão DEVE sair primeiro sob tag de pré-release e só depois ser promovida à tag principal
  (ENG-26); a publicação DEVE ser idempotente, sem versão parcial após falha (ENG-27).
- Toda versão DEVE ter atestado de proveniência assinado e SBOM (ENG-09, ENG-19).
- Tarballs DEVEM conter só arquivos de allowlist versionada, sem scripts de instalação, e incluir
  avisos de terceiros e o campo `license` definido em Premissas (ENG-17, ENG-22).
- Dependências DEVEM ser instaladas do lockfile em modo congelado (ENG-16); scripts de instalação
  de dependências DEVEM ser bloqueados salvo allowlist (ENG-24); licenças DEVEM seguir política
  versionada (ENG-21); dependências diretas depreciadas NÃO DEVEM existir (ENG-07); dependência
  nova DEVE ter aprovação de dono (ENG-25).
- Ações de terceiros no CI DEVEM ser fixadas por digest SHA (ENG-18).
- Segredos DEVEM constar de inventário com dono, escopo, tipo e prazo de rotação; segredo fixo
  DEVE ter justificativa registrada de que o provedor não oferece credencial federada (ENG-13); PR
  de fork NÃO DEVE receber segredo de escrita, e secret scanning DEVE bloquear o merge (ENG-14);
  cache remoto DEVE ser gravável só pela branch protegida (ENG-03).
- Fontes, ícones e logotipos distribuídos DEVEM constar de inventário com origem, licença e direito
  de redistribuição (ENG-23).
- Vulnerabilidades em dependências DEVEM ser corrigidas nos prazos por severidade: crítica 7 dias,
  alta 30, média 90 (ENG-11). Vulnerabilidade confirmada no código do PatoDS DEVE ter advisory e
  versão corrigida em cada versão maior suportada, com as versões afetadas depreciadas no registro
  (GOV-15), seguindo a política de segurança publicada (GOV-14).

Motivo: um design system é dependência de todas as apps; comprometê-lo compromete todas.

### X. Versionamento previsível e ciclo de vida explícito

- Todos os pacotes publicados DEVEM seguir SemVer 2.0.0, e a verificação de API pública no CI DEVE
  bloquear quebra sem incremento de major (GOV-01). Essa verificação cobre também os schemas de
  MCP e CLI (IA-17) e a lista de códigos de aviso (CMP-23); alteração incompatível no JSON Schema
  do catálogo DEVE sair só em versão major (IA-03). A estratégia de versão única ou independente
  DEVE estar registrada em ADR; vale a premissa vigente de versão única.
- Mensagens de commit DEVEM seguir Conventional Commits, impostas por hook local e check de CI
  (GOV-02); o changelog DEVE ser gerado a cada versão, com mudanças incompatíveis em seção própria
  (GOV-03).
- Cada componente DEVE declarar, no arquivo de orientação de uso, um estágio: experimental, beta,
  estável ou depreciado; estágio ausente ou inválido falha o build (GOV-04).
- Promoção a estável DEVE passar pela definição de pronto versionada, verificada no CI (GOV-13).
- Depreciação DEVE respeitar o prazo mínimo de Premissas antes da remoção (salvo remoção por
  segurança com advisory) e ter guia de migração com substituto e exemplo antes e depois
  (GOV-05, GOV-06).
- A major anterior DEVE ser suportada pelo prazo definido em Premissas, fixado em política
  publicada; correção de severidade crítica sem relação com segurança DEVE sair também na major
  anterior suportada, no prazo do ACE-04 (GOV-18).
- Cada mudança incompatível mecânica de uma major DEVE ter codemod com fixtures (GOV-17).

Motivo: apps consumidoras só atualizam com confiança quando quebras são raras, anunciadas e
assistidas.

### XI. Monorepo com fronteiras de camada impostas

- Tokens, núcleo, bibliotecas e ferramentas DEVEM viver num único monorepo (ADR-09).
- As camadas DEVEM seguir tokens → núcleo → frameworks. Ferramentas (gerador do catálogo, lint,
  codemods, mapeamentos, snippets do DSN-09) DEVEM depender da UI só como devDependency (ENG-01).
- Camadas e arestas permitidas DEVEM estar num arquivo versionado; aresta proibida falha o CI, e
  cada camada nova DEVE entrar nele na fase em que é criada (ENG-01, ACE-08).
- O CI DEVE executar só as tarefas dos pacotes afetados e seus dependentes, com execução completa
  diária e quando mudam lockfile, toolchain ou workflows (ENG-02).
- Se o ENG-12 (Desejável) for contratado, cada ativo compartilhado (ícones, fontes, CSS de tokens)
  DEVE ter um único pacote de origem, sem arquivo idêntico publicado em mais de um pacote (ENG-12).

Motivo: mudanças entre camadas saem num só PR e a paridade fica verificável, sem acoplamento
acidental entre pacotes.

### XII. Migração incremental com coexistência

- O PatoDS DEVE coexistir com os design systems legados na mesma página sem conflito de estilos:
  classes e variáveis só com `<prefixo>`, nomes e ordem das camadas `@layer` publicados, com guia
  para envolver o CSS legado em camada inferior (MIG-07, MIG-14).
- Codemods de migração dos legados DEVEM cobrir todas as trocas classificadas como exatas nas
  tabelas do MIG-02 e do MIG-03, e somente elas, ser idempotentes e produzir código que passa em
  typecheck, lint e testes sem edição manual (MIG-05, ADR-10).
- Trocas similares ou sem equivalente DEVEM usar skills de agente que abrem PR sem merge
  automático, sempre com aprovação humana registrada (MIG-06).
- A migração DEVE ser possível em lotes independentes, com deploy e rollback por lote (MIG-09).
- O fornecedor NÃO DEVE alterar arquivos das apps consumidoras: codemods rodam nelas só em modo de
  simulação, e o kit é validado em apps de teste próprias (MIG-13, Escopo).
- O progresso DEVE ser medido pelo inventário automatizado de uso (MIG-01, MIG-11).

Motivo: troca de uma vez concentra risco e trava os times; migração por lote entrega valor sem
parar o produto (ADR-10).

### XIII. Documentação única e verificada no CI

- O PatoDS DEVE ter um único site de documentação; cada página de componente DEVE exibir exemplos
  e API de React e Vue, e o CI DEVE falhar se faltar a versão de algum framework suportado
  (DOC-01).
- Cada componente DEVE ter exemplos executáveis para todas as variantes e estados documentados;
  exemplo que não compila contra os tipos atuais, não renderiza ou usa API depreciada DEVE falhar o
  build (DOC-04).
- Fundamentos de tokens, cores, tipografia e ícones DEVEM ser gerados dos pacotes publicados
  (DOC-05); link ou âncora interna quebrada DEVE bloquear o merge (DOC-12).
- Cada pacote publicável DEVE ter README com propósito, instalação, uso mínimo e link para a
  documentação completa (DOC-08); o guia de início rápido de cada framework DEVE ser executado no
  CI em projeto vazio (DOC-07).
- O changelog de cada versão publicada DEVE estar no site em até 24 horas (DOC-09), e cada major
  suportada DEVE manter documentação navegável gerada do catálogo do commit daquela versão
  (DOC-15).

Motivo: documentação escrita à mão envelhece mais rápido que os componentes; gerada e verificada
no CI, ela acompanha a versão instalada.

## Restrições de Escopo, Plataforma e Segurança

**Escopo**

- Frameworks suportados: React e Vue. Angular e Web Components estão fora deste contrato.
- Fora do escopo, salvo pedido de mudança: componentes de gráficos e visualização de dados,
  paletas de dados, biblioteca de ilustrações, componentes específicos de um único produto,
  hospedagem de serviços de IA e migração do código das apps consumidoras.
- O Inventário de componentes dos Requisitos fecha a lista e as nove categorias (CMP-01).
  Componente fora do Inventário exige RFC (GOV-08) e pedido de mudança aprovado (GOV-16).
- Prioridade: ID ou item do Inventário Obrigatório bloqueia o aceite da fase a que pertence;
  Desejável só entra se contratado e, então, é aceito pelos mesmos critérios na fase indicada;
  Opcional só entra por pedido de mudança aprovado. Specs e planos NÃO DEVEM incluir item
  Desejável não contratado nem item Opcional sem pedido de mudança aprovado.

**Plataforma**

- O CI DEVE testar em matriz o piso e a versão mais recente de React, Vue, Node e TypeScript;
  `peerDependencies` e `engines` DEVEM coincidir com o piso testado; CSS DEVE ser validado contra
  lista de navegadores versionada (ENG-08).
- O CSS de cada marca, com os dois modos, DEVE ser importável sem as demais marcas (ENG-06).

**Privacidade e dados**

- Stories, fixtures, exemplos e snapshots NÃO DEVEM conter dados pessoais reais; documentos
  pessoais (ex.: CPF, CNPJ) e e-mails fora de domínio reservado DEVEM ser bloqueados por varredura
  no CI, e fotos DEVEM vir de banco sintético ou licenciado, com origem e licença em registro
  versionado (QA-15).
- Telemetria das ferramentas para agentes, se existir, DEVE ser desligada por padrão, sem dados
  pessoais, texto livre ou código-fonte (IA-12, premissa vigente).
- Exemplos editáveis do site DEVEM rodar em iframe com sandbox em origem separada; o site NÃO DEVE
  carregar rastreadores de terceiros sem aprovação registrada do requerente (DOC-16).

**Decisões em aberto**

Esta constituição não decide os itens da seção "Premissas e decisões em aberto" dos Requisitos.
Enquanto não houver decisão, vale a premissa vigente de cada linha. Specs e planos DEVEM citar a
premissa que assumem e NÃO DEVEM fixar valor diferente dela sem pedido de mudança.

## Fluxo de Desenvolvimento e Portões de Qualidade

**Fluxo Spec Kit**

- Toda feature DEVE seguir o fluxo Spec Kit (specify → plan → tasks → implement) e citar os IDs
  dos Requisitos que atende; requisito sem ID de origem exige justificativa no spec.
- O "Constitution Check" de cada plano DEVE responder com "sim" ou "não", no mínimo, às perguntas
  abaixo; toda resposta "não" é violação e segue a regra de exceção desta seção:
  1. Todo dado de componente ou de token (API, aparência, metadados de uso) vem das três fontes
     declaradas e todo consumidor o obtém do catálogo gerado, sem cópia mantida à mão? (I)
  2. Todo estilo de componente consome só tokens semânticos ou de componente, sem token primitivo
     nem valor literal, e a sincronização com a ferramenta de design segue a direção vigente, com
     divergências detectadas? (II)
  3. Os pacotes de framework seguem sem regras CSS, o núcleo sem seletor sobre atributo de
     primitivo headless, e todo componente interativo usa primitivo da biblioteca headless? (III)
  4. A mudança mantém paridade de API, DOM e comportamento entre React e Vue? (IV)
  5. Cada componente afetado tem testes do motor de regras, de teclado, de foco visível, de reflow
     e de tamanho de alvo, os tokens de cor passam no contraste, há declaração de conformidade e
     toda exceção de acessibilidade está registrada conforme o A11Y-11? (V)
  6. SSR, RSC, CSP, i18n e uso sem provedor continuam válidos? (VI)
  7. Os testes rodam em navegador real, na matriz de motores exigida, e os limiares vêm do arquivo
     do QA-14? (VII)
  8. Dados para agentes vêm do catálogo e as ferramentas seguem somente leitura, sem rede nem
     credenciais? (VIII)
  9. Dependências, segredos, publicação e ativos seguem as regras de cadeia de suprimentos? (IX)
  10. A mudança respeita SemVer, estágio de ciclo de vida e política de depreciação? (X)
  11. As fronteiras de camada continuam válidas? (XI)
  12. A coexistência com legados continua sem conflito? (XII)
  13. A documentação cobre React e Vue, é gerada do catálogo, tem exemplos que compilam contra os
      tipos atuais, README por pacote e links válidos? (XIII)
  14. A feature está dentro do escopo e do Inventário de componentes, respeita a prioridade
      contratada e cita a premissa vigente de cada decisão em aberto que assume? (Restrições de
      Escopo, Plataforma e Segurança)
- Violação NÃO DEVE avançar sem exceção formal prevista nos Requisitos (ex.: registro do A11Y-11,
  exceção aprovada do CMP-12, ADR de exceção pontual do CMP-02, motivo aprovado pelo requerente do
  GOV-17), registrada em "Complexity Tracking" do plano. Contrariar ADR-01 a ADR-10 não é exceção
  de plano: exige pedido de mudança aprovado pelo requerente e novo ADR (GOV-07).

**Decisões e revisão**

- Toda decisão de arquitetura DEVE ser registrada em ADR numerado, com status e data, antes de ser
  implementada; PR com rótulo de arquitetura DEVE vincular ADR aceito. ADR que altere ADR-01 a
  ADR-10 DEVE citar pedido de mudança aprovado pelo requerente, e o check de CI DEVE rejeitar PR
  sem essa aprovação (GOV-07).
- Todo componente novo ou mudança incompatível de API DEVE ter RFC aprovada, com funcionalidades,
  estados, padrão APG aplicável e mapa de teclado (GOV-08).
- Arquivo de donos DEVE cobrir 100% dos diretórios; merge exige aprovação de dono da área; snapshots
  visuais têm ao menos um dono de design (GOV-09).

**Rastreabilidade e aceite**

- Cada ID contratado DEVE constar de uma matriz de rastreabilidade versionada que o liga a check de
  CI ou evidência retida, com IDs de fases futuras marcados como planejados; ID de fase em curso ou
  já aceita sem check ou evidência, ou com check inexistente, falha o CI (ACE-02).
- Cada fase DEVE terminar num pacote de aceite com a evidência de cada ID (ACE-01).
- Todo check que promete bloqueio DEVE ser comprovado por violação proposital registrada, quando os
  Requisitos assim exigirem.
- A Fase 1 só começa após aprovação do relatório da prova de conceito headless (CMP-28) e do plano
  de entrega (ACE-09); cada fase só começa com as saídas das fases de que depende aceitas.

## Governança

- Precedência: Requisitos e pedidos de mudança aprovados > esta constituição > specs, planos e
  tarefas > demais práticas. Conflito entre esta constituição e os Requisitos se resolve emendando
  a constituição.
- Emendas DEVEM ser feitas por PR que altere `.specify/memory/constitution.md`, com o Sync Impact
  Report na descrição do PR e aprovação do dono desse arquivo no arquivo de donos (GOV-09).
- Emenda que reflita mudança em ADR-01 a ADR-10, em premissa vigente, em limiar, em requisito
  Obrigatório ou inclusão de requisito Opcional DEVE citar o pedido de mudança aprovado pelo
  requerente e, quando arquitetural, o novo ADR (GOV-07).
- Versionamento desta constituição segue SemVer: MAJOR para remoção ou redefinição incompatível de
  princípio ou regra de governança; MINOR para princípio ou seção nova ou orientação ampliada de
  forma material; PATCH para esclarecimento e redação sem mudança de sentido.
- Conformidade: `/speckit-plan` aplica os portões do "Constitution Check"; `/speckit-analyze`
  trata conflito com esta constituição como CRÍTICO; revisores de PR DEVEM verificar os princípios
  afetados; cada pacote de aceite de fase DEVE incluir revisão de conformidade com esta
  constituição.
- Orientação de runtime para agentes de código fica no arquivo de instruções da raiz do
  repositório (ex.: `AGENTS.md`, IA-09), que NÃO PODE contradizer esta constituição.

**Version**: 1.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
