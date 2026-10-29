# ADR-11: Pipeline de build de tokens

**Status**: Proposto | **Data**: 2026-10-21 | **Feature**: 001-design-tokens-themes | **Relaciona**: ADR-02, ADR-05, ADR-06, ADR-09

## Contexto

O ADR-02 fixa tokens DTCG versionados, compilados para variáveis CSS e módulos ESM, como fonte única da aparência. Este ADR decide como a fonte é organizada, validada e compilada na feature 001. Ele implementa o ADR-02, o ADR-05, o ADR-06 e o ADR-09 e não altera nenhum dos ADR-01 a ADR-10. As forças em jogo são estas:

- O DTCG 2025.10 é a primeira versão estável (Final Community Group Report de 2025-10-28, com os módulos Format, Color e Resolver). Os JSON Schemas publicados pela DTCG são declarados não normativos.
- Marca e modo são eixos independentes (TOK-07, TOK-08, TOK-14), com paridade de chaves (TOK-09), um CSS por marca (ENG-06) e forma obrigatória para a variação marca × modo (FR-033).
- As regras do PatoDS não existem em nenhuma ferramenta e serão código próprio em qualquer cenário. São elas: três camadas e direção de alias, segmentos em ordem fixa, paridade, arquivo por marca, manifestos para lint, contraste e sincronização, e relatório por categoria.
- ADR-05 e ADR-06: o contrato público do pacote de tokens são os tipos gerados e o relatório de API. Os manifestos são dados derivados no build e ficam fora do código importado pela app.
- Há quatro restrições transversais: saída idêntica byte a byte (TOK-05, SC-002), nenhum runtime no bundle da app (ENG-04), cadeia de suprimentos (ENG-07, ENG-16, ENG-21, ENG-24, ENG-25) e fronteiras de camada (ENG-01).

## Decisão

**1. Modelo da fonte (research D7).** A fonte fica em `packages/tokens/src/`, no formato DTCG 2025.10:

```text
tokens.resolver.json                 # Resolver 2025.10: modificadores brand e mode, sets por camada
primitive/*.tokens.json              # única camada com literal; sempre invariante
semantic/invariant.tokens.json       # set compartilhado
semantic/brand/<id>.tokens.json      # contexto <id> do modificador brand
semantic/mode/light.tokens.json      # contextos light e dark do modificador mode
semantic/mode/dark.tokens.json
component/*.tokens.json              # aliases para semântico, componente ou primitivo
```

- Há dois modificadores ortogonais: `brand`, cujos contextos são as marcas, e `mode`, com os contextos `light` e `dark`. O diretório define a camada, que fica registrada no índice do adaptador.
- Cada token semântico tem um único eixo: invariante, marca ou modo. Um token que varia por marca e por modo vira um token de eixo modo cujo valor, em cada modo, é alias para um token-fonte de eixo marca. O token-fonte fica sob o grupo raiz reservado `brand.` e termina no id do modo (`color.bg.surface` → `{brand.color.bg.surface.light}`). Toda marca tem as mesmas chaves (FR-033). Esses tokens-fonte são tokens públicos da fonte, não variáveis privadas, mas têm papel `brand-mode-source`, e estilos de componente não podem consumi-los (ADR-16). Só os toggles `--<prefixo>-_on-light` e `--<prefixo>-_on-dark` são privados (ADR-13).
- Sets compartilhados (primitivos, invariantes e componentes) não têm valores de eixo marca ou modo. Assim, a herança de um set base não esconde uma chave que falta numa marca.
- O uso decide onde fica cada primitivo. Um primitivo usado por mais de uma marca, ou por tokens fora do eixo marca, vai para `base.css`. Um primitivo exclusivo de uma marca vai para `brand-<id>.css`.

**2. Motor.** Os pacotes `@terrazzo/parser` e `@terrazzo/token-tools` (subpath `/css`) entram só como biblioteca, sem `@terrazzo/cli` e sem plugins de saída. Todos os `@terrazzo/*` ficam na mesma versão exata via `overrides` do pnpm. Hoje é a 2.9.0, porque a 2.10.0 saiu em 2026-10-21 e ainda não cumpre o `minimumReleaseAge` de 1440 min. O `ajv` entra em versão exata (8.20.0 no registro). Ele valida a fonte, sem rede, contra cópias versionadas de `format.json` e `resolver.json` do DTCG 2025.10 em `packages/tokens/schemas/dtcg-2025.10/`, conferidas por `SHA256SUMS`. Toda cor é serializada por `toEmittedSrgb()` de `@<prefixo>/color` (ADR-15). Os demais tipos podem reutilizar os serializadores de `token-tools/css` onde a saída coincide byte a byte com o contrato de CSS; havendo diferença, vale o contrato (`specs/001-design-tokens-themes/contracts/css-output.md`, S-05).

**3. Validação (`tokens-build validate`)** no pacote privado `@<prefixo>/tokens-build` (`tools/tokens-build`):

1. Confere os schemas pelo `SHA256SUMS` e valida cada arquivo com o Ajv (V-01). Na mesma leitura, monta o índice próprio `id → arquivo:linha:coluna → camada`, que aparece em toda mensagem de erro.
2. Chama `parse()` com um `req` próprio que rejeita todo `$ref` que não seja `file:`. O `req` padrão faz `fetch()`.
3. Percorre `resolver.listPermutations()` e chama `resolver.apply()` para cada combinação marca × modo. Lista indefinida (limite do parser) ou incompleta é erro.
4. Roda as regras V-02 a V-13 do data-model como funções puras sobre o modelo interno, por permutação e por contexto. Elas cobrem literal fora do primitivo, alias quebrado e ciclo, direção de camada, `$ref`/`$root`/`$extends`, gramática de nomes e colisão de nome CSS, eixo, forma do FR-033, sets compartilhados, `hex` × componentes, cobertura das categorias, escala `size.control.<passo>` e paridade.

O hook `lint` do Terrazzo não é usado. Ele só vê a permutação padrão, não recebe o resolver e, em modo resolver, perde a origem por arquivo.

**4. Geração (`tokens-build build`).** Formatadores próprios trabalham sobre o mesmo modelo. Um writer determinístico grava a saída em `packages/tokens/dist/`, que fica no `.gitignore`. O writer ordena por code point, usa LF e não grava timestamp, caminho absoluto nem dado do ambiente.

| Saída | Conteúdo |
| --- | --- |
| `css/base.css`, `css/brand-<id>.css` | `--<prefixo>-*` em `@layer <prefixo>.tokens`; seletores e toggles no ADR-13 |
| `esm/index.js` + `index.d.ts` | Referências `var(--<prefixo>-*)`, com união literal de nomes |
| `esm/values.js` + `values.d.ts` | Mapas estáticos por marca × modo, sem `resolver.apply()` em runtime |
| `meta/tokens.manifest.json` | Token → cssName, camada, categoria, eixo, papel, cadeia de alias e escala |
| `meta/sync-manifest.json` | Estado desejado para a ferramenta de design, neutro de ferramenta (ADR-14) |
| `meta/report.json`, `report.md` | Contagem por categoria e escala de alturas por permutação (FR-008) |

O mesmo build regenera `api/tokens.api.json`. Esse arquivo é versionado de propósito e o check de drift o confere com `git diff --exit-code` (QA-08, GOV-01).

**5. Pacote, fronteiras e interface.** O `@<prefixo>/tokens` exporta `.` (`dist/esm/index.js`, com tipos), `./values`, `./css/base.css`, `./css/brand-*.css` e `./meta/*`. As entradas `./meta/*` servem a ferramentas, e as apps não as importam. O pacote declara `sideEffects: ["**/*.css"]`, não tem dependência de runtime e usa o `license` da premissa do ENG-22. As arestas ficam no `turbo.json`:

- `tokens` → `tools/tokens-build` e `tools/color`, só como devDependency;
- `tools/tokens-build` → `tools/color`;
- lint, contraste e sincronização leem `./meta/*` como devDependency, em pacotes separados do gerador, sem ciclo.

```ts
// tokens-build validate|build [--json]  → exit 0 ok | 1 violações | 2 uso/config | 3 erro interno
interface TokenRecord {
  id: string; path: readonly string[]; cssName: string;
  layer: 'primitive' | 'semantic' | 'component'; category: Category; type: DtcgType;
  axis: 'invariant' | 'brand' | 'mode'; role: 'public' | 'brand-mode-source';
  values: Readonly<Record<PermutationKey, ResolvedValue>>; aliasChain: readonly string[];
  source: { file: string; line: number; column: number };
}
```

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| Style Dictionary 5.7.0 | O suporte ao 2025.10 está incompleto (issue #1590 aberta): falta o Resolver, `$extends` e `$ref` não são tratados e o gradiente está pendente. Fica como troca via adaptador quando o Resolver sair. |
| Terrazzo completo (`@terrazzo/cli`, `plugin-css`, `plugin-js`) | O `plugin-css` exige a CLI como peer, e a CLI traz vite, vite-node, chokidar, escodegen e prompts. O `plugin-js` gera `resolver.apply()` em runtime em vez de mapa estático (ENG-04). |
| Regras no hook `lint` do Terrazzo | O hook só vê a permutação padrão, sem resolver e sem origem por arquivo. Uma violação só na marca B ou só no modo escuro passaria (SC-001, SC-009). |
| Compilador 100% próprio | Reimplementaria a parte mais sensível do DTCG (herança de `$type`, `$extends`, Resolver, 14 espaços de cor) sem ganho. Fica como plano B atrás do adaptador. |
| Style Dictionary + `@tokens-studio/sd-transforms` | Fica acoplado ao formato do Tokens Studio, o que anteciparia a escolha da ferramenta de design, ainda em aberto. |
| Asimonim (parser em Go) | Fica fora do toolchain Node/TS, sem maturidade comprovada, e só cobriria a validação. |
| Modificador único marca × modo | Trata os eixos como dependentes, multiplica os contextos a cada marca e tira da ferramenta as coleções ortogonais (DSN-05). |
| Token semântico variando nos dois eixos | Deixa o Resolver não ortogonal, com a ordem decidindo o valor, e exigiria variáveis auxiliares na ferramenta (DSN-04). |

## Consequências

**Positivas**: toda regra vê todas as permutações e aponta arquivo, linha e coluna. Um só modelo alimenta CSS, ESM, manifestos e relatório, de modo que lint, contraste e sincronização leem os mesmos ids. O pacote publicado sai sem dependência de runtime. Trocar o motor custa só o adaptador.

**Negativas**: o projeto passa a manter código próprio (adaptador, índice de origem, regras, formatadores e writer). O motor depende de um projeto com um único publicador no npm e releases frequentes, e cada upgrade exige revisão de saídas de ouro. A forma do FR-033 deixa a fonte mais verbosa, com um token-fonte `brand.` por modo em cada marca.

**Neutras**: `dist/` não é versionado e o CI reconstrói toda a saída. A cópia dos schemas só muda com uma nova versão estável do DTCG, por PR com novo `SHA256SUMS`.

## Requisitos atendidos

| ID | Como |
| --- | --- |
| TOK-01 | Fonte única DTCG em `src/`, com Ajv sobre schemas versionados que bloqueia o merge (FR-001, FR-002). A varredura fora da fonte (`repo-checks scan-tokens`, ADR-16) complementa a validação. |
| TOK-02 | V-02 a V-05 rodam em todas as permutações (FR-003, FR-004). |
| TOK-04 | V-06 aplica a gramática da convenção (`specs/001-design-tokens-themes/contracts/token-source.md`, seção 8), kebab ASCII e colisão de nome CSS (FR-005). O documento `docs/tokens/convencao-de-nomes.md` é derivado das mesmas tabelas do validador. |
| TOK-05 | Writer determinístico, `dist/` fora do git e sha256 comparado entre builds e entre Node piso e mais recente (FR-015, SC-002). |
| TOK-06 | Gera `esm/index` e `esm/values` com `.d.ts` como texto. Os testes de tipos estão no ADR-16 (FR-016). |
| TOK-07, TOK-08 | Marca e modo são modificadores do Resolver. Marca nova = contexto + arquivos em `src/` (FR-009, FR-010, SC-005). |
| TOK-09 | V-13 por permutação e por contexto, mais V-08 e V-09 (FR-011, FR-033). |
| TOK-10, TOK-13 | V-11, V-12 e relatório por categoria e por escala (FR-006 a FR-008). |
| ENG-06 | `base.css` neutro e um `brand-<id>.css` por marca, com primitivos alocados pelo uso (FR-017; seletores no ADR-13). |
| ENG-04, ENG-05 | ESM estático sem runtime, `sideEffects` só com CSS e `.d.ts` publicados em cada entrada. |
| ENG-01 | O gerador fica em pacote `tools`, e `tokens` só depende dele como dev. |
| ENG-07, ENG-16, ENG-21, ENG-24, ENG-25 | Dependências diretas de dev MIT, em versão exata, sem scripts de instalação e com aprovação de dono. Os schemas sob licença W3C entram na política. |
| QA-02 | Regras e formatadores são funções puras com teste unitário e fixtures de violação. |
| QA-08, GOV-01 | `api/tokens.api.json` é regenerado e conferido por drift. |

## Riscos e mitigação

- **Bus factor do Terrazzo (um publicador no npm).** Adaptador fino, versão exata, saídas de ouro, test-suite oficial do DTCG 2025.10 e licença MIT, que torna o fork viável.
- **Cadência rápida (da 2.8.0 à 2.10.0 em 8 dias).** O pino precisa ter idade ≥ `minimumReleaseAge`. O upgrade só entra por PR, com changelog, saídas de ouro e test-suite.
- **Determinismo.** O Terrazzo ordena com collator dependente do ICU (`'en-us'`, numérico). A mitigação é ordenar por code point, aceitar só nomes ASCII e comparar o sha256 entre dois builds e entre Node piso e mais recente (ENG-08).
- **Schema e parser divergem.** O Ajv aceita `$extends` em objeto, e o Terrazzo remove `.$root` do id. A convenção proíbe `$root` e só aceita `$extends` com chaves, com fixtures para os dois casos.
- **Dependência fantasma.** Todo import é dependência direta declarada (ENG-25), nunca um pacote transitivo do Terrazzo.
- **Spike antes da implementação completa.** Uma violação plantada só em `semantic/brand/<id-B>.tokens.json` e outra só em `semantic/mode/dark.tokens.json` precisam ser barradas.

## Pendências com o requerente

Valem as premissas citadas até a decisão do requerente:

- Prefixo (TODO(PREFIXO)): `<prefixo>` como marcador. O valor muda nomes CSS, atributos e escopo do pacote.
- Marcas, valores e marca padrão (CMP-24): marcas sintéticas A e B nos testes, com A como padrão. A marca padrão define qual `brand-<id>.css` aplica a combinação padrão.
- Lista de navegadores (ENG-08): o mecanismo exige só `@layer`. Cor de gamut amplo é mapeada de forma determinística para sRGB.
- Pisos de Node e TypeScript (ENG-08): Node 22 LTS como piso na comparação de determinismo. TS 6.0 provisório.
- Ferramenta de design (DSN-01): nenhuma escolhida. O `sync-manifest.json` é neutro de ferramenta, e o separador de nomes vem da convenção.
- Licença (ENG-22): `UNLICENSED` como marcador. Plataforma de CI: GitHub Actions presumido.
- TOK-12: fora do plano. Se for contratado, o relatório de tokens sem referência vira um novo formatador sobre o mesmo modelo.

## Referências

- https://www.designtokens.org/tr/2025.10/ e https://www.designtokens.org/TR/2025.10/resolver/
- https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- https://www.designtokens.org/schemas/2025.10/format.json e https://www.designtokens.org/schemas/2025.10/resolver.json
- https://github.com/design-tokens/community-group/tree/main/test-suite e https://raw.githubusercontent.com/design-tokens/community-group/main/LICENSE.md
- https://terrazzo.app/docs/reference/js-api/ e https://terrazzo.app/docs/reference/plugin-api/
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/resolver/load.js e https://unpkg.com/@terrazzo/parser@2.10.0/dist/lint/index.js
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/parse/index.js e https://unpkg.com/@terrazzo/parser@2.10.0/dist/parse/token.js
- https://github.com/terrazzoapp/terrazzo/pull/863 e https://registry.npmjs.org/@terrazzo/parser/2.9.0
- https://registry.npmjs.org/@terrazzo/plugin-css e https://terrazzo.app/docs/integrations/js/
- https://github.com/style-dictionary/style-dictionary/issues/1590
- https://registry.npmjs.org/ajv e https://pnpm.io/settings
