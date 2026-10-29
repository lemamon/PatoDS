# token-build

## DECISION
Terrazzo 2.x usado só como biblioteca: `@terrazzo/parser` (parse DTCG 2025.10, Resolver Module, aliases `{}`, `$extends`, `$root`, `$ref`, detecção de alias quebrado e de ciclo, hooks `lint` e `build`) mais `@terrazzo/token-tools` (subpath `/css`, serialização de valores para CSS). Versão exata fixada na faixa >=2.9.0 <3.0.0. Pela janela mínima de publicação, hoje entra a 2.9.0; a 2.10.0 saiu em 2026-10-21. Não usar `@terrazzo/cli` nem os plugins de saída prontos (`plugin-css`, `plugin-css-in-js`, `plugin-js`). Somar `ajv` ^8.20 (draft-07) para validar a fonte contra cópia versionada, com sha256, dos JSON Schemas oficiais DTCG 2025.10 (`https://www.designtokens.org/schemas/2025.10/format.json` e `resolver.json`). Os formatos `uri-reference` e `json-pointer-uri-fragment` entram como validadores próprios; `ajv-formats` é opcional.

Formato da fonte: arquivos `*.tokens.json` (DTCG 2025.10) mais um `*.resolver.json` (`version: "2025.10"`) com os modificadores `brand` e `mode`. Cor em objeto `{colorSpace, components, alpha?, hex?}`. Dimensão em `{value, unit}`. Aliases só com chaves `{grupo.token}` nas camadas semântica e de componente.

O PatoDS escreve um pacote privado de ferramentas (ex.: `tools/tokens-build`, camada "ferramentas" no arquivo de camadas do ENG-01). O pacote publicado `@<prefixo>/tokens` depende dele só como devDependency e sai sem nenhuma dependência de runtime. O pacote de ferramentas contém:

(1) Regras de lint próprias no hook `lint`:
- literal fora da camada primitiva (FR-003);
- direção de alias entre camadas, por `aliasOf`, `aliasChain` e `dependencies` (FR-004);
- nomenclatura: prefixo, segmentos em ordem fixa por categoria, só kebab ASCII, colisão de nome CSS (FR-005);
- cobertura das 11 categorias (FR-006);
- escala única de alturas de controle (FR-007);
- paridade de chaves semânticas em todas as permutações marca×modo via `resolver.apply` (FR-011);
- proibição de `$ref` JSON Pointer fora da camada primitiva.

(2) Formatadores próprios no hook `build`:
- um CSS por marca, com seletores `[data-<prefixo>-brand]` e `[data-<prefixo>-mode]`; a combinação padrão só no arquivo da marca padrão; a estratégia de escopos aninhados dos FR-012 a FR-014 é implementada aqui (FR-015, FR-017);
- módulo ESM de referências `var(--<prefixo>-*)` com .d.ts (união literal de nomes) e entrada separada com mapas de valores por marca×modo, também com .d.ts (FR-016);
- manifesto token → nome CSS/camada/categoria, consumido pelo lint de estilos (FR-022, FR-023) e pela checagem de pares (FR-020, FR-021);
- relatório JSON e Markdown com contagem por categoria e escala de alturas por tema (FR-008).

(3) Writer determinístico: ordenação por code point, nunca por locale; LF; sem timestamp, caminho absoluto ou dado de ambiente. O CI roda dois builds e compara os sha256.

## RATIONALE
1) Status do DTCG em 2026-10-21. A versão 2025.10 é a primeira estável: Final Community Group Report de 28/10/2025, com três módulos (Format, Color e Resolver). É relatório de Community Group, não padrão W3C. Não há versão estável posterior; existe só o rascunho vivo em /TR/drafts/.

O formato fixa:
- arquivos `.tokens` ou `.tokens.json`, media type `application/design-tokens+json`;
- cor como objeto `{colorSpace, components, alpha?, hex?}`, com 14 espaços (srgb, oklch, display-p3 etc.), palavra-chave `none` e `hex` de 6 dígitos como fallback;
- dimensão `{value, unit: px|rem}` e duração `{value, unit: ms|s}`;
- alias `{a.b}` só para token inteiro, `$ref` JSON Pointer para subvalores, `$extends` para herança de grupo, `$root` como valor-base de grupo, `$type` herdado do grupo e nunca inferido;
- nomes sem `$` inicial e sem `{`, `}` ou `.`.

O Resolver (`.resolver.json`, `version` "2025.10") tem `sets`, `modifiers` (com `contexts` e `default`) e `resolutionOrder`. A entrada é `{modificador: contexto}`. Esse é o mecanismo padrão para modelar marca e modo como eixos sem duplicar arquivos (FR-009, FR-010). O site da DTCG publica JSON Schemas draft-07 (`format.json` e `resolver.json`), que o próprio texto da spec trata como não normativos. Por isso a fonte é validada pelo schema oficial versionado (prova literal do FR-002) e, em segunda linha, pelo parser.

2) Terrazzo 2.0.0 (2026-03-17) anuncia suporte completo ao DTCG 2025.10, com resolvers. O `@terrazzo/parser` expõe:
- API JS sem CLI (`defineConfig`, `parse`, `build`);
- `resolver.apply`, `listPermutations`, `isValidInput` e detecção de ortogonalidade;
- hook `lint` com `create({tokens, report})`, para regras próprias com severidade configurável;
- hook `build` com `outputFile` chamado várias vezes, o que permite um arquivo por marca.

As dependências do parser e do token-tools são poucas: momoa, colorjs.io, merge-anything, scule, picocolors, wildcard-match e pacotes @terrazzo. Todas têm licença MIT, ISC ou Apache-2.0, nenhuma está depreciada e nenhuma tem script de instalação, o que atende ENG-07, ENG-21 e ENG-24. Só os pacotes publicados foram inspecionados no registro; a árvore transitiva completa ainda precisa passar pelos checks do CI.

3) Usar só a biblioteca, e não a CLI nem os plugins prontos:
- O `plugin-css` junta as permutações num único arquivo por instância, com seletores montados por strings em `prepare`, e exige `@terrazzo/cli` como peer.
- A CLI traz vite, vite-node, chokidar, escodegen e @clack/prompts, e oferece importação nativa do Figma, que contraria a premissa vigente do DSN-01 (nenhuma rotina importa variáveis para o repositório).
- O `plugin-js` gera um runtime `resolver.apply()`, e não um mapa estático, o que põe código no bundle da app (ENG-04).

Os requisitos do PatoDS são específicos e nenhuma ferramenta os cobre: três camadas e direção de alias, segmentos em ordem fixa, paridade de chaves, arquivo por marca só com seletores dela, combinação padrão, escopos aninhados por eixo, manifesto para stylelint e contraste, relatório por categoria. Eles teriam de ser escritos de qualquer jeito. Escritos como plugins sobre o modelo normalizado do parser, cada regra e formatador é função pura com teste unitário (QA-02), e o .d.ts gerado é coberto por teste de tipos (QA-08).

4) O Style Dictionary 5.7.0 (2026-10-16, Apache-2.0) é maduro e muito usado, mas o suporte ao 2025.10 está incompleto. A issue #1590 segue aberta: cor desde a 5.3.0, dimensão desde a 5.4.0, duração e parte do `$root` desde a 5.7.0; gradiente pendente; Resolver sem PR; `$extends` e `$ref` não tratados. Sem Resolver, marca×modo exigiria laços próprios com várias instâncias, fora do padrão.

5) O isolamento limita o risco. As regras e os formatadores do PatoDS operam sobre um modelo interno (id, camada, categoria, `$type`, valor por permutação, cadeia de alias), atrás de um adaptador fino. Trocar o Terrazzo pelo Style Dictionary, quando ele tiver Resolver, ou por um parser próprio custa só o adaptador. Testes de saída de ouro detectam mudança de comportamento a cada atualização.

## ALTERNATIVES
- Style Dictionary 5.7.0 (Apache-2.0, 3 mantenedores, cerca de 1,15 milhão de downloads por semana): Suporte ao DTCG 2025.10 incompleto: a issue #1590 segue aberta, sem Resolver, com gradiente pendente e sem tratamento de `$extends` ou `$ref`. Marca×modo exigiria laço próprio sobre várias instâncias, fora do padrão do Resolver. O cabeçalho padrão dos arquivos traz data de geração e quebra o byte a byte se não for desligado. Não valida schema DTCG nem regras de camada e nomenclatura, então os validadores e formatadores próprios seriam necessários do mesmo jeito. Traz dependências de runtime mais pesadas (prettier, tinycolor2 sem release desde 2023). Fica como alternativa de troca via adaptador quando o Resolver sair.
- Terrazzo completo: @terrazzo/cli com plugin-css, plugin-css-in-js e plugin-js como vêm: O plugin-css junta as permutações num arquivo por instância e não garante sozinho arquivo por marca só com seletores dela, combinação padrão e escopos aninhados por eixo (FR-012, FR-013, FR-014, FR-017). O plugin-js gera um runtime `resolver.apply()` em vez de um mapa estático (ENG-04). Os nomes e o formato do plugin-css-in-js ficam presos ao plugin-css. O plugin-css exige a CLI como peer, e a CLI traz vite, vite-node, chokidar, escodegen e prompts para o toolchain, além de oferecer importação do Figma, contrária à premissa do DSN-01. Fica só a reutilização dos serializadores de @terrazzo/token-tools/css.
- Compilador 100% próprio: JSON, Ajv e implementação própria de alias, $extends, $ref, $root e Resolver: Exigiria reimplementar a parte mais sensível à spec: herança de $type, merge de $extends, $root, JSON Pointer, ordem de resolução e ortogonalidade do Resolver, serialização de 14 espaços de cor. Não há parser JS maduro e independente do 2025.10 além do Terrazzo; o Asimonim é em Go e o resto é imaturo. Custo e risco de divergência da spec altos, sem ganho funcional. Fica como plano B, porque as regras e formatadores próprios rodam sobre modelo interno atrás de adaptador.
- Style Dictionary com @tokens-studio/sd-transforms: Pensado para o formato do Tokens Studio e acoplado a uma ferramenta de design, escolha que é decisão em aberto do requerente. Herda as lacunas do Style Dictionary no 2025.10 (sem Resolver).
- Asimonim (parser e validador DTCG em Go): Toolchain fora de TypeScript e Node num monorepo TS, maturidade não comprovada, e não gera saídas. Só cobriria a validação.

## REQUIREMENT FIT
- FR-001 / TOK-01: Fonte única em `tokens/**/*.tokens.json` mais um `*.resolver.json`, no formato DTCG 2025.10. A busca no repositório por tokens fora da fonte (custom properties `--<prefixo>-` declaradas fora dos arquivos gerados) é um check à parte que usa o manifesto gerado.
- FR-002 / TOK-01: Ajv valida cada arquivo contra o format.json e o resolver.json oficiais do DTCG 2025.10, versionados com sha256 e sem rede no CI. As regras `core/valid-*` do parser servem de segunda linha. Erro de schema dá código de saída diferente de zero e bloqueia o merge.
- FR-003 / TOK-02: Regra de lint própria: token fora da camada primitiva sem `aliasOf`, ou composto com subvalor literal, é rejeitado com o token e a regra apontados. A camada vem do set ou diretório de origem, conforme o data-model.
- FR-004 / TOK-02: O parser falha em alias inexistente ou em ciclo. Uma regra própria percorre `aliasChain` e `dependencies` e rejeita referência de camada inferior para superior. Outra regra proíbe `$ref` fora da camada primitiva.
- FR-005 / TOK-04: Regra própria com a gramática de segmentos por categoria (ordem fixa), só kebab ASCII, e detecção de colisão de nome CSS entre ids distintos. A `core/consistent-naming` do Terrazzo cobre só a caixa e não basta.
- FR-006, FR-008 / TOK-10, TOK-13: Regra própria exige ao menos um token semântico por categoria. O formatador gera o relatório (JSON e Markdown no CI) com a contagem por categoria e a escala de alturas por permutação marca×modo.
- FR-007 / TOK-13: Regra própria valida que os tokens de altura de controle formam o conjunto fechado definido. O manifesto exporta essa escala para a regra de stylelint do FR-023.
- FR-009, FR-010 / TOK-07, TOK-08: Marca e modo são modificadores do Resolver DTCG 2025.10. Adicionar uma marca é adicionar o contexto e os arquivos de tokens dela, sem tocar em código, o que o diff comprova. O build itera todas as permutações via `resolver.apply`.
- FR-011 / TOK-09: Regra própria compara os conjuntos de chaves semânticas de todas as permutações e aponta chave ausente ou excedente.
- FR-012, FR-013, FR-014 / TOK-14, ENG-06: O formatador CSS é próprio, então a estratégia de seletores e redeclaração por escopo (eixo mais próximo, valor inválido sem variável vazia, combinação padrão) pode ser implementada como o design exigir. A estratégia em si é decidida em tópico separado.
- FR-015 / TOK-05: Custom properties `--<prefixo>-*` geradas no build e não versionadas, com check de arquivo gerado editado à mão. O writer é determinístico e o CI compara os sha256 de dois builds.
- FR-016 / TOK-06: Formatador próprio emite ESM de referências `var(--<prefixo>-*)` com .d.ts de tipos literais e, em entrada separada, ESM de mapas por marca×modo com .d.ts, gerados como texto e sem runtime. Nome inexistente falha no teste de tipos com @ts-expect-error (QA-08).
- FR-017 / ENG-06: Um arquivo CSS por marca via várias chamadas de `outputFile`, cada um só com seletores daquela marca e os dois modos; a combinação padrão vai só no arquivo da marca padrão. Um check automatizado lê o manifesto e confirma.
- FR-019, FR-020, FR-021 / A11Y-09: Checker próprio sobre o modelo resolvido por permutação, usando colorjs.io, que já é dependência transitiva. Compõe o alfa sobre o fundo e aplica 4,5:1 para texto e 3:1 para não texto. O manifesto de pares e o manifesto de tokens alimentam a checagem do FR-021.
- FR-022, FR-023, FR-024 / TOK-03, TOK-13: O manifesto token → camada/categoria e a escala de alturas gerados no build são a entrada da regra de stylelint, que é escrita à parte.
- FR-025, FR-028 / DSN-01, DSN-04: A sincronização lê os mesmos ids normalizados e as mesmas permutações (mesmo nome e hierarquia). Sem @terrazzo/cli, não existe rotina de importação do Figma no repositório, o que atende a premissa vigente.
- ENG-01 / Princípio XI: O gerador fica no pacote de ferramentas, devDependency do pacote de tokens, que é publicado sem dependências de runtime. A aresta ferramentas → tokens entra no arquivo de camadas.
- ENG-07, ENG-16, ENG-17, ENG-21, ENG-24 / Princípio IX: Dependências diretas (@terrazzo/parser, @terrazzo/token-tools, ajv) com licença MIT, sem depreciação e sem preinstall, install ou postinstall. A árvore transitiva verificada no registro só tem MIT, ISC, Apache-2.0 e BSD. Versões exatas no lockfile congelado. O tarball de tokens contém só a saída gerada, sem scripts.
- QA-02, QA-08 / Princípio VII: Regras e formatadores são funções puras com teste unitário e fixtures de violação proposital (SC-009). Saídas de ouro e .d.ts são cobertos por teste de tipos.
- SC-002: Ordenação por code point nos formatadores próprios, Node fixado (`engines` e `.nvmrc`), nomes só ASCII e build duplo no CI com LANG e TZ diferentes e comparação de sha256.

## RISKS
- Bus factor do Terrazzo: um único publicador no npm (drewpowers), cerca de 57 contribuidores e cerca de 76 mil downloads por semana do parser, contra 183 contribuidores e cerca de 1,15 milhão do Style Dictionary. Mitigação: uso só como biblioteca atrás de adaptador e modelo interno, versão exata, testes de saída de ouro, licença MIT (fork viável) e Style Dictionary como troca quando a issue #1590 entregar o Resolver.
- Cadência rápida de releases: da 2.8.0 à 2.10.0 em 8 dias, e a 2.10.0 saiu em 2026-10-21. Mitigação: versão exata, janela mínima de publicação antes de adotar (ex.: `minimumReleaseAge` do pnpm ou Renovate), revisão do changelog e saídas de ouro no CI.
- Determinismo: o Terrazzo ordena com `Intl.Collator('en-us', {numeric:true})` (PR #863, 2.10.0), que depende do ICU do Node, e o utility-css dele usa o locale padrão (não será usado). `build()` roda plugins em paralelo. Mitigação: formatadores próprios ordenam por code point e não dependem da ordem do parser, Node e ICU fixados, nomes só ASCII forçados por lint, build duplo com LANG e TZ distintos e comparação de sha256 no CI.
- O JSON Schema DTCG 2025.10 é não normativo e pode ter bugs ou atraso em relação ao texto da spec. Ele usa `definitions` com `$id` embutido e os formatos `uri-reference` e `json-pointer-uri-fragment`. Mitigação: cópia versionada com sha256, validação dupla com o parser e spike confirmando que o Ajv compila o schema empacotado.
- Spike necessário antes do plano: confirmar pela API JS (`parse`/`build` com plugins próprios, sem CLI) que os erros de lint das regras próprias saem com local de origem e código de saída diferente de zero, e que `resolver.apply` cobre todas as permutações marca×modo.
- Modelagem marca×modo no Resolver: valores semânticos que dependem dos dois eixos tornam os modificadores não ortogonais (a ordem decide o valor). A detecção de ortogonalidade do Terrazzo 2.4+ não cobre `$extends`. Decidir no data-model entre (a) dois modificadores ortogonais (marca define tokens semânticos de papel para os dois modos, modo escolhe por alias semântico → semântico) e (b) um único modificador combinado. A paridade do FR-011 roda sobre todas as permutações nos dois casos.
- A estratégia CSS de escopos aninhados por eixo (FR-012 a FR-014, alternância A → B → A, valor inválido sem variável vazia) não vem da ferramenta e é trabalho do formatador próprio. Depende da lista de navegadores (ENG-08) e deve ser decidida e testada em navegador real em tópico separado.
- A saída de cor (oklch(), color(display-p3) ou fallback sRGB/hex) depende da lista de navegadores ainda não fixada. Os serializadores do token-tools têm opções (ex.: profundidade de cor, hex legado), mas a escolha errada quebra navegadores antigos ou perde gamut.

## OPEN QUESTIONS
- Lista de navegadores alvo (ENG-08, premissa "lista versionada" sem valores): define se o CSS gerado pode usar oklch() e color(display-p3) direto ou precisa de fallback sRGB/hex. Muda a configuração do formatador de cor e a estratégia de escopos aninhados.
- Política de licenças do ENG-21: confirmar que ela aceita MIT, ISC, BSD-2-Clause, BSD-3-Clause e Apache-2.0 para ferramentas de build (devDependencies não distribuídas). A cadeia escolhida inclui @humanwhocodes/momoa, sob Apache-2.0.

## ADR
ADR-0NN — Pipeline de build de tokens: Terrazzo parser (DTCG 2025.10 + Resolver) como biblioteca, com validação por JSON Schema oficial e validadores/formatadores próprios do PatoDS

## SOURCES
- https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ — DTCG anuncia em 28/10/2025 a primeira versão estável (2025.10), com theming e multi-marca, espaços de cor modernos e aliases/herança.
- https://www.designtokens.org/tr/2025.10/ — Os Technical Reports 2025.10 têm três módulos (Format, Color, Resolver), formam Final Community Group Report considerado estável e não citam versão posterior.
- https://www.designtokens.org/TR/2025.10/format/ — Formato: alias {grupo.token} para token inteiro, $ref JSON Pointer, $extends para grupos, $root, dimensão {value, unit px|rem}, duração {value, unit ms|s}, .tokens.json e application/design-tokens+json, restrições de nome; a spec diz que um JSON Schema ainda está em estudo (não normativo).
- https://www.designtokens.org/TR/2025.10/color/ — Cor como {colorSpace, components, alpha?, hex?}, 14 espaços de cor, palavra-chave none e hex de 6 dígitos como fallback.
- https://www.designtokens.org/TR/2025.10/resolver/ — Resolver: .resolver.json, version "2025.10", sets, modifiers (contexts/default), resolutionOrder e entradas {modificador: contexto}; recomenda modificadores ortogonais.
- https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/ — Final CG Report do Format Module 2025.10, estável mas fora da trilha de padrões W3C.
- https://www.designtokens.org/schemas/2025.10/format.json — JSON Schema draft-07 empacotado do formato DTCG 2025.10, publicado pela DTCG, com subschemas por $id e formatos uri-reference e json-pointer-uri-fragment (sha256 32e93b78… baixado em 2026-10-21).
- https://www.designtokens.org/schemas/2025.10/resolver.json — JSON Schema draft-07 do Resolver 2025.10 (version const "2025.10", additionalProperties false).
- https://github.com/style-dictionary/style-dictionary/issues/1590 — Issue de suporte ao DTCG 2025.10 aberta: Resolver sem PR, gradiente pendente, $root em sub-issue, $extends e $ref não tratados (última atividade em 16/10/2026).
- https://github.com/style-dictionary/style-dictionary/releases — Style Dictionary 5.7.0 (16/10/2026) adiciona duração 2025.10 e tratamento de $root; cor 2025.10 entrou na 5.3.0 e dimensão em objeto na 5.4.0.
- https://styledictionary.com/info/dtcg/ — O Style Dictionary declara que o formato 2025.10 ainda não tem suporte completo.
- https://styledictionary.com/reference/hooks/formats/#file-headers — O cabeçalho padrão de arquivo do Style Dictionary inclui "Generated on <data>", o que quebra o byte a byte se não for desligado.
- https://app.unpkg.com/@terrazzo/parser@2.4.0/files/CHANGELOG.md — Terrazzo 2.0.0: suporte completo ao DTCG v2025.10 com resolvers, importação nativa do Figma, plugin-js refeito como API de resolver; 2.4.0 adiciona detecção de ortogonalidade (sem $extends).
- https://github.com/terrazzoapp/terrazzo/pull/863 — A 2.10.0 troca localeCompare por Intl.Collator('en-us',{numeric:true}) na ordenação; o utility-css usa Intl.Collator() com locale padrão (risco de determinismo).
- https://terrazzo.app/docs/reference/js-api/ — API JS do @terrazzo/parser sem CLI: defineConfig, parse (retorna tokens, sources e resolver), build (arquivos em memória); métodos do resolver apply, listPermutations, isValidInput.
- https://terrazzo.app/docs/reference/plugin-api/ — Hooks config, lint, transform, build e buildEnd; regras de lint com create({tokens, report}); outputFile chamado várias vezes; build roda em paralelo; resolver.apply por permutação.
- https://terrazzo.app/docs/linting/ — Regras nativas (core/valid-*, core/consistent-naming só de caixa, core/required-modes, a11y/min-contrast com pairs e level); severidades error, warn e off.
- https://terrazzo.app/docs/guides/resolvers/ — O Terrazzo modela temas pelo Resolver DTCG; o plugin-css usa permutations {input, prepare}; recomenda um modificador combinado ou modificadores ortogonais.
- https://terrazzo.app/docs/integrations/css/ — O plugin-css gera um arquivo (filename) com as permutações combinadas; opções variableName, transform, skipBuild, colorDepth, legacyHex.
- https://terrazzo.app/docs/integrations/js/ — O plugin-js gera tokens.js e .d.ts com um resolver.apply() de runtime, e não um mapa estático.
- https://terrazzo.app/docs/integrations/css-in-js/ — O plugin-css-in-js exporta referências var(--…) com .d.ts, com nomes atrelados ao plugin-css.
- https://registry.npmjs.org/@terrazzo/plugin-css — O @terrazzo/plugin-css 2.10.0 exige @terrazzo/cli como peerDependency; a CLI depende de vite, vite-node, chokidar, escodegen e @clack/prompts.
- https://registry.npmjs.org/@terrazzo/parser — @terrazzo/parser 2.10.0 (MIT, 2026-10-21; 2.0.0 de 2026-03-17), dependências leves, sem scripts de instalação, um único mantenedor no npm.
- https://registry.npmjs.org/style-dictionary — style-dictionary 5.7.0 (Apache-2.0), engines node >=22, dependências de runtime incluem prettier e tinycolor2; 3 mantenedores.
- https://api.npmjs.org/downloads/point/last-week/style-dictionary — Cerca de 1,15 milhão de downloads semanais do Style Dictionary, contra cerca de 76 mil do @terrazzo/parser (semana de 12 a 18/10/2026).
- https://github.com/terrazzoapp/terrazzo — Repositório do Terrazzo: MIT, cerca de 479 estrelas, cerca de 57 contribuidores, push em 2026-10-21.
- https://registry.npmjs.org/ajv — ajv 8.20.0 (MIT, 2026-04-24), sem scripts de instalação.


# VERIFICATION: needs_changes
- [major] CLAIM: As regras próprias rodam no hook `lint` do Terrazzo: literal fora da camada primitiva (FR-003), direção de alias (FR-004), nomenclatura (FR-005) e paridade de chaves em todas as permutações marca×modo via `resolver.apply` (FR-011). A camada vem do set ou do diretório de origem. As regras `core/valid-*` servem de segunda linha.
  PROBLEM: Conferido no código do @terrazzo/parser 2.10.0, com o mesmo fluxo na 2.9.0. Quando a entrada é um resolver, `loadResolver` faz `tokens = resolver.apply(firstInput)`, ou seja, só a permutação padrão, e `lintRunner` recebe apenas esses tokens. O `create()` das regras recebe `{id, report, tokens, filename, sources, options}`, sem `resolver`, então a paridade via `resolver.apply` dentro do hook lint é impossível. Além disso, em modo resolver os arquivos são juntados (bundle + `destructiveMerge`) e reprocessados como um JSON sintético com o nome do arquivo do resolver. Com isso `token.source` não indica o `.tokens.json`, o set nem o diretório de origem. Consequência: tokens e violações que só existem em contextos não padrão (marca B, modo escuro) passam pelo lint sem erro, incluindo literal em semântico, alias proibido e nome fora do padrão. Alias quebrado ou ciclo nesses contextos só aparece se alguém chamar `apply` para eles. As `core/valid-*` também cobrem só a permutação padrão. Isso quebra SC-001 e SC-009 na prática, e o spike proposto não cobre esse caso.
  CORRECTION: Rodar as regras do PatoDS num adaptador próprio, depois de `parse()`, sobre todas as permutações (`resolver.listPermutations()` + `resolver.apply()`). O build falha se `listPermutations` voltar `undefined` por `permutationLimit`. A camada vem de um marcador explícito, como o grupo raiz no caminho do token ou uma chave em `$extensions`, ou de um índice próprio por arquivo (id → arquivo, linha, camada) montado na leitura que o Ajv já faz. Erros com arquivo e linha saem desse índice. Usar os hooks do Terrazzo, no máximo, para `build`, que recebe `resolver`. Critério do spike: uma violação plantada só no arquivo da marca B e outra só no modo escuro precisam ser barradas.
- [minor] CLAIM: Style Dictionary: o cabeçalho padrão dos arquivos traz data de geração e quebra o byte a byte se não for desligado.
  PROBLEM: Informação defasada (vem da v3). No style-dictionary 5.7.0, `lib/common/formatHelpers/fileHeader.js` define `fileHeaderTimestamp: false` por padrão. O cabeçalho padrão é só "Do not edit directly, this file was auto-generated.", sem data. A página de docs ainda mostra um exemplo antigo com timestamp.
  CORRECTION: Retirar esse motivo da rejeição do Style Dictionary. A rejeição continua de pé pelos outros motivos: sem Resolver, com `$extends`/`$ref` não tratados e gradiente pendente na issue #1590, que segue aberta.
- [minor] CLAIM: O plugin-css junta as permutações num único arquivo por instância e não garante sozinho arquivo por marca só com seletores dela. A CLI, com importação do Figma, contraria a premissa do DSN-01.
  PROBLEM: O `filename` é por instância e `prepare()` aceita qualquer seletor. Várias instâncias, cada uma com `permutations` de uma marca, dariam um arquivo por marca. O argumento do DSN-01 é fraco: a premissa proíbe rotina no repositório que importe variáveis, não um comando disponível numa CLI instalada. `core/consistent-naming` também aceita função validadora própria, não cobre só a caixa. O repositório tem cerca de 55 contribuidores (o número 57 é o de issues abertas).
  CORRECTION: Rejeitar o plugin-css pelos motivos que se sustentam. Ele exige `@terrazzo/cli` como peer, o que traz vite, vite-node, chokidar, escodegen e @clack/prompts. Os nomes e o plugin-css-in-js ficam acoplados a ele. E o PatoDS precisa de controle exato sobre escopos aninhados, combinação padrão, manifesto e relatório, que são formatadores próprios de qualquer jeito. Corrigir as afirmações sobre consistent-naming e contribuidores.
- [minor] CLAIM: O checker de contraste usa colorjs.io, que já é dependência transitiva.
  PROBLEM: Importar uma dependência transitiva é dependência fantasma. Com pnpm em isolamento estrito ela não resolve e burla ENG-21, ENG-25 e ENG-07. O colorjs.io está em 0.7.x (pré-1.0), sujeito a quebra de API em minor.
  CORRECTION: Declarar `colorjs.io` como devDependency direta do pacote de ferramentas, com versão exata alinhada à faixa `^0.7.1` do Terrazzo, aprovação de dono (ENG-25) e testes de ouro nas razões de contraste.
- [minor] CLAIM: Versão exata do Terrazzo na faixa >=2.9.0 <3.0.0 (hoje 2.9.0); `ajv` ^8.20.
  PROBLEM: O @terrazzo/parser 2.9.0 declara `@terrazzo/token-tools ^2.9.0` e `@terrazzo/token-types ^2.9.0`. Sem override, o lockfile pode resolver 2.10.0 como transitiva (publicada hoje), com cópias misturadas, apesar do pin direto. A janela mínima de publicação não está definida em nenhum requisito, e `ajv ^8.20` contradiz a política de versão exata.
  CORRECTION: Fixar todos os `@terrazzo/*` na mesma versão exata via `overrides` do pnpm, e o ajv também em versão exata. Configurar `minimumReleaseAge` (pnpm 10.16+; `minimumReleaseAgeStrict` no pnpm 11) com valor registrado no repositório, e fazer o upgrade só junto com o changelog e as saídas de ouro.
- [minor] CLAIM: Determinismo garantido por ordenação por code point, Node e ICU fixados e build duplo com LANG e TZ distintos. O risco de ICU vem do PR #863 na 2.10.0.
  PROBLEM: (a) O `defaultReq` do parser faz `fetch()` para `$ref` não `file:`, ou seja, rede no build, o que fere o determinismo e a cadeia de suprimentos. (b) A 2.9.0 já usava `localeCompare(b, 'en-us', {numeric:true})`, então a dependência de ICU não é novidade da 2.10.0. (c) O ENG-08 exige matriz com o piso e a versão mais recente do Node, e fixar uma única versão de Node não prova que as saídas são idênticas entre as duas.
  CORRECTION: Passar à `parse()` um `req` próprio que rejeite URLs não `file:` e `$ref` remoto. Comparar o sha256 das saídas também entre o Node piso e o mais recente da matriz. Manter a ordenação própria por code point.
- [minor] CLAIM: O parser cobre `$extends` e `$root` do DTCG 2025.10, e a sincronização usa os mesmos ids normalizados (FR-025, FR-028).
  PROBLEM: O Terrazzo remove `.$root` do id (`parse/token.js`: `replace(/\.\$root$/, '')`), enquanto a spec endereça `grupo.$root`. Ele também só aceita `$extends` como string, embora o schema oficial admita a forma de objeto JSON Pointer. Isso afeta a convenção de nomes, o mapeamento nome e hierarquia na ferramenta de design (DSN-04) e a validação: o Ajv aceita uma forma que o parser rejeita.
  CORRECTION: Na convenção e no lint: só `$extends` com chaves e regra explícita para `$root`, que pode ser proibir ou mapear de forma documentada para o nome CSS e o da ferramenta. Cobrir os dois casos com fixtures.
- [minor] CLAIM: O spike precisa confirmar que o Ajv compila o schema empacotado. Não há outra garantia de conformidade além do parser.
  PROBLEM: Ativo omitido: o repositório oficial design-tokens/community-group tem `test-suite/tests/2025.10` (fixtures positivas e negativas de format e resolver). O pacote `schemas` já testa os schemas empacotados com Ajv + ajv-formats (`validate-ajv.test.ts`), o que reduz o risco do spike. Os schemas copiados para o repositório estão sob a W3C Software and Document License, fora da lista MIT/Apache/BSD.
  CORRECTION: Usar a test-suite oficial como portão de conformidade do adaptador e a cada upgrade do Terrazzo, junto com as saídas de ouro. Registrar a origem e a licença W3C da cópia dos schemas nos avisos de terceiros e na política do ENG-21.
- [minor] CLAIM: Paridade de chaves semânticas (FR-011) checada sobre as permutações resolvidas.
  PROBLEM: Se algum set compartilhado tiver valores semânticos, uma chave que falta no contexto da marca B é herdada do set base. A permutação resolvida tem a chave e a paridade passa, mas a marca B usa um valor que não definiu, o que mascara a omissão que o TOK-09 quer barrar.
  CORRECTION: No data-model, proibir valores semânticos em sets compartilhados (só primitivos ou componentes) ou checar a paridade também sobre as chaves que cada contexto de marca e de modo contribui, além das permutações resolvidas.
- [minor] CLAIM: A aresta ferramentas → tokens entra no arquivo de camadas.
  PROBLEM: A dependência real é inversa: o pacote `@<prefixo>/tokens` depende, como devDependency de build, do pacote de ferramentas. O ENG-01 trata ferramentas dependendo da UI. Há risco de ciclo se o pacote que consome o manifesto (stylelint, checagem de pares) for o mesmo do gerador.
  CORRECTION: Declarar explicitamente a aresta "tokens → ferramentas/tokens-build (só dev)". Manter o gerador separado do pacote de lint e contraste, que consome o manifesto de `@<prefixo>/tokens` como devDependency, para não fechar ciclo.
- [minor] CLAIM: open_questions: política de licenças do ENG-21 (confirmar MIT, ISC, BSD e Apache-2.0).
  PROBLEM: O ENG-21 não aparece em "Premissas e decisões em aberto". Só a licença dos pacotes publicados (ENG-22) é decisão do requerente. A política de licenças é um arquivo versionado escrito pelo fornecedor, com aprovação de dono. A pergunta não é de responsabilidade exclusiva do requerente.
  CORRECTION: Tirar a pergunta de open_questions e criar uma tarefa no plano para escrever a política versionada. Manter só a lista de navegadores (ENG-08), que é decisão do Contratante.

## REVISED DECISION
Manter o @terrazzo/parser e o @terrazzo/token-tools (subpath /css) 2.x só como biblioteca. Todos os `@terrazzo/*` ficam na mesma versão exata via `overrides` do pnpm: hoje 2.9.0, com `minimumReleaseAge` registrado no repositório. Somam-se `ajv` em versão exata e cópias versionadas, com sha256, de `format.json` e `resolver.json` do DTCG 2025.10. Não usar `@terrazzo/cli` nem os plugins prontos: o plugin-css exige a CLI como peer, e a CLI traz vite, chokidar e escodegen. Mudança central: as regras do PatoDS (FR-003, FR-004, FR-005, FR-006, FR-007, FR-011 e a proibição de `$ref` fora da camada primitiva) não ficam no hook `lint`, que só vê a permutação padrão, não recebe o resolver e, em modo resolver, perde a origem por arquivo. Elas rodam num adaptador próprio depois de `parse()`, sobre todas as permutações (`resolver.listPermutations()` + `apply()`, com falha se a lista vier indefinida). A camada vem de marcador explícito (grupo raiz ou `$extensions`) ou de índice próprio por arquivo montado na leitura do Ajv, que também dá arquivo e linha nos erros. Os formatadores próprios (CSS por marca, ESM de `var()` e de mapas com .d.ts, manifesto, relatório) rodam no adaptador ou no hook `build`, que recebe o resolver. O writer é determinístico: code point, LF, sem timestamp e sem caminho absoluto. `parse()` recebe um `req` que bloqueia `$ref` não `file:`. O sha256 é comparado entre dois builds e entre o Node piso e o mais recente da matriz. A test-suite oficial do DTCG 2025.10 e as saídas de ouro servem de portão a cada upgrade. `colorjs.io` entra como devDependency direta para o contraste. A convenção só aceita `$extends` com chaves e tem regra explícita para `$root`. Os sets compartilhados não carregam valores semânticos, ou a paridade é checada também por contexto. Style Dictionary 5.7.0 fica como troca via adaptador quando entregar o Resolver (issue #1590), sem o argumento do timestamp, que é falso na v5. Pergunta em aberto ao requerente: só a lista de navegadores (ENG-08).

## EXTRA SOURCES
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/resolver/load.js — Em modo resolver, parse() carrega `tokens = resolver.apply(firstInput)`, só a permutação padrão. Esses são os tokens passados ao lint.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/parse/index.js — `lintRunner({tokens, sources, config, logger})` roda dentro de parse(), antes do resolver final, e não recebe resolver. `defaultReq` faz fetch() para URLs não file:.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/lint/index.js — `rule.create` recebe {id, report, tokens, filename, sources, options}, sem resolver.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/resolver/create-resolver.js — `apply()` junta as fontes com destructiveMerge e reprocessa como JSON sintético com o nome do arquivo do resolver, perdendo a origem por arquivo.
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/parse/token.js — O Terrazzo remove `.$root` do id do token e só aceita `$extends` como string.
- https://unpkg.com/@terrazzo/parser@2.9.0/dist/lib/array.js — A 2.9.0 já ordenava com localeCompare(b, 'en-us', {numeric:true}), dependente de ICU.
- https://registry.npmjs.org/@terrazzo/parser/2.9.0 — O parser 2.9.0 declara @terrazzo/token-tools ^2.9.0 e @terrazzo/token-types ^2.9.0 (faixas com circunflexo, que exigem override para alinhar).
- https://unpkg.com/style-dictionary@5.7.0/lib/common/formatHelpers/fileHeader.js — Style Dictionary 5.7.0: fileHeaderTimestamp é false por padrão, e o cabeçalho padrão não traz data.
- https://github.com/design-tokens/community-group/tree/main/test-suite — Test-suite oficial de conformidade DTCG 2025.10 (format e resolver, positivos e negativos).
- https://github.com/design-tokens/community-group/tree/main/schemas — Os schemas oficiais são empacotados e testados com Ajv + ajv-formats (validate-ajv.test.ts).
- https://raw.githubusercontent.com/design-tokens/community-group/main/LICENSE.md — Relatórios sob a W3C Software and Document License e software de teste sob a W3C 3-clause BSD.
- https://pnpm.io/settings — pnpm minimumReleaseAge (desde a 10.16.0), minimumReleaseAgeExclude e minimumReleaseAgeStrict (11.0).
- https://terrazzo.app/docs/integrations/js/ — O plugin-js gera um resolver.apply() de consulta com todas as permutações pré-computadas num módulo e é indicado para o servidor.
- https://api.github.com/repos/terrazzoapp/terrazzo — Repositório do Terrazzo com licença MIT, 479 estrelas e 57 issues abertas; cerca de 55 contribuidores pela API de contributors.
