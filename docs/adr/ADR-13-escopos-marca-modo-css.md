# ADR-13: Escopos de marca e modo em CSS

**Status**: Proposto | **Data**: 2026-10-21 | **Feature**: 001-design-tokens-themes | **Relaciona**: ADR-02, ADR-03

## Contexto

O ADR-02 compila os tokens DTCG para variáveis CSS, e o ADR-03 exige CSS em camadas `@layer`, sem CSS-in-JS em runtime. Este ADR decide como o CSS gerado aplica marca e modo a qualquer subárvore. Ele implementa o ADR-02 e o ADR-03 e não altera nenhum dos ADR-01 a ADR-10. As forças em jogo são estas:

- Os atributos `data-<prefixo>-brand` (id da marca) e `data-<prefixo>-mode` (`light` ou `dark`) valem em qualquer elemento, cada escopo redeclara os tokens semânticos e, em escopos aninhados, vale o escopo mais próximo de cada eixo (FR-010, FR-012, TOK-14).
- Sem atributo, valem a marca padrão e o modo claro, e valores de marca aplicados sem atributo vêm só do CSS da marca padrão. Valor de atributo inexistente mantém o ancestral, e nenhum token público fica sem valor (FR-013, FR-014, CMP-24).
- Cada marca é importável sem as outras, num arquivo só com seletores dela, e o que é neutro de marca fica num arquivo base comum (FR-017, ENG-06).
- O modo varia tokens de vários tipos: cor, sombra com várias camadas, opacidade e dimensão.
- O seletor descendente casa qualquer ancestral, não o mais próximo. Por isso, combinar seletores de marca e de modo não resolve escopos alternados.
- O SSR precisa funcionar sem JS e sem troca visual na hidratação (critério do TOK-14). A lista de navegadores segue em aberto (ENG-08), então o mecanismo não pode exigir nada além do que o ADR-03 já exige.
- A fonte segue o modelo do research D7 (ADR-11): cada token semântico tem um só eixo (invariante, marca ou modo), e a variação marca × modo é um token de eixo modo que aponta, em cada modo, para um token-fonte público sob o grupo raiz reservado `brand.` (FR-033).

## Decisão

**1. Mecanismo.** CSS puro, sem dependência nova, gerado pelo formatador próprio de `@<prefixo>/tokens-build` (ADR-11), com tudo em `@layer <prefixo>.tokens`. O modo é selecionado por um par de toggles de espaço privados, `--<prefixo>-_on-light` e `--<prefixo>-_on-dark`, cujo valor é sempre o literal `initial` (ativa o fallback do `var()`) ou vazio (desativa). Um bloco resolvedor, neutro de marca, recalcula os tokens dependentes de modo em todo elemento que é escopo de qualquer eixo. O token de eixo modo é emitido sem espaço entre os toggles: `var(--<prefixo>-_on-light, <valor claro>)var(--<prefixo>-_on-dark, <valor escuro>)`.

O valor computado de uma custom property é o valor especificado com `var()` substituído, e é esse valor que herda (css-variables-1). Tokens de eixo marca e tokens-fonte vêm do escopo de marca mais próximo, os toggles vêm do escopo de modo mais próximo, e o resolvedor recalcula em todo escopo; um elemento que não é escopo herda do escopo mais próximo. Valor inválido (`data-<prefixo>-brand="zzz"`, vazio, modo `sepia`, marca não importada) casa só o resolvedor, que recalcula com as entradas herdadas e mantém o ancestral (FR-014). A ordem de importação não altera o resultado: os padrões têm especificidade (0,0,0), as regras de marca e de modo têm (0,1,0), e `base.css` e os arquivos de marca declaram conjuntos disjuntos de propriedades.

**2. Distribuição.** A app importa `@<prefixo>/tokens/css/base.css` e um ou mais `@<prefixo>/tokens/css/brand-<id>.css`. App que importa só uma marca diferente da padrão a seleciona com o atributo na raiz do documento (FR-013).

| Conteúdo | Arquivo | Seletor |
| --- | --- | --- |
| Ordem das camadas | `base.css` e cada `brand-<id>.css` | A mesma instrução `@layer` no topo de todo arquivo, gerada de fonte única da lista (MIG-14) |
| Primitivo usado por mais de uma marca ou fora do eixo marca | `base.css` | `:where(:root)` |
| Toggles de modo, com padrão claro | `base.css` | `:where(:root)`, mais `[data-<prefixo>-mode="light"]` e `[data-<prefixo>-mode="dark"]`, que também definem `color-scheme` |
| Semântico de eixo modo, semântico invariante e todo token de componente | `base.css` | Resolvedor `:where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode])` |
| Semântico de eixo marca, token-fonte `brand.` e primitivo exclusivo da marca | `brand-<id>.css` | `[data-<prefixo>-brand="<id>"]`; só o arquivo da marca padrão acrescenta `:where(:root)` |

**3. Esboço.** Nomes ilustrativos; a gramática fica em `docs/tokens/convencao-de-nomes.md` e o formato exato em `specs/001-design-tokens-themes/contracts/css-output.md`.

```css
/* base.css: neutro de marca */
@layer <prefixo>.tokens;
@layer <prefixo>.tokens {
  :where(:root) {
    --<prefixo>-color-neutral-950: #101010;   /* primitivo compartilhado */
    --<prefixo>-radius-2: 4px;
  }
  :where(:root), [data-<prefixo>-mode="light"] { --<prefixo>-_on-dark: ; --<prefixo>-_on-light: initial; color-scheme: light; }
  [data-<prefixo>-mode="dark"] { --<prefixo>-_on-dark: initial; --<prefixo>-_on-light: ; color-scheme: dark; }
  :where(:root, [data-<prefixo>-brand], [data-<prefixo>-mode]) {
    --<prefixo>-color-bg-surface: var(--<prefixo>-_on-light, var(--<prefixo>-brand-color-bg-surface-light))var(--<prefixo>-_on-dark, var(--<prefixo>-brand-color-bg-surface-dark));
    --<prefixo>-color-card-bg-default: var(--<prefixo>-color-bg-surface);   /* componente, recalculado em cada escopo */
  }
}
/* brand-a.css: marca padrão; brand-b.css tem a mesma forma, com "b", valores e primitivos exclusivos próprios e sem :where(:root) */
@layer <prefixo>.tokens;
@layer <prefixo>.tokens {
  :where(:root), [data-<prefixo>-brand="a"] {
    --<prefixo>-brand-color-bg-surface-dark: var(--<prefixo>-color-neutral-950);
    --<prefixo>-brand-color-bg-surface-light: var(--<prefixo>-color-sand-50);
    --<prefixo>-color-sand-50: #faf7f0;   /* primitivo exclusivo da marca */
    --<prefixo>-radius-control-default: var(--<prefixo>-radius-2);   /* eixo marca */
  }
}
```

**4. Regras do gerador**, verificadas por auditoria estática do CSS gerado dentro de `pnpm tokens:build` (saída 1 em violação):

- toggles sempre com o literal `initial` ou vazio, nunca por indireção `var()` (bug WebKit 243247), e token de eixo modo sem espaço entre os dois `var()`;
- todo alvo de `var()` declarado em `base.css` ou no arquivo de marca; token semântico ou de componente declarado só no resolvedor ou no escopo de marca, nunca em outro seletor, para não congelar valor em escopo aninhado;
- valores do arquivo de marca dependem só de primitivos, de tokens semânticos invariantes e de outras declarações da mesma marca, nunca de token de eixo modo nem de componente (regra AX-2 de `contracts/token-source.md` e DEP-01 de `contracts/css-output.md`);
- seletores conforme as definições operacionais abaixo;
- o segmento privado `_` fica fora do ESM, do `.d.ts`, dos manifestos, do contrato de DOM e de `api/tokens.api.json`;
- a instrução de ordem das camadas vem de uma fonte única: nesta feature ela lista só `<prefixo>.tokens`; a feature do núcleo acrescenta suas camadas na mesma fonte, e o check do MIG-14 passa a cobrir o CSS de tokens.

### Evidência (harness de [research/css-scopes.md](../../specs/001-design-tokens-themes/research/css-scopes.md), reverificado pelo revisor cético)

- Motores: builds do Playwright de Chromium 156, Firefox 157 e WebKit 26.4.
- Cobertura: 6 configurações de importação × 3 sementes, cerca de 195 elementos e 2.531 checagens por passada, no estado inicial e depois de 60 mutações aleatórias de atributo em runtime. O harness compara tokens públicos computados e valores usados de `background-color`, `box-shadow`, `border-radius` e `outline-color` com um oráculo que percorre o DOM (escopo válido mais próximo por eixo).
- Resultado: zero falhas com comparação exata de strings, com e sem a forma minificada `--x:;`. Com um espaço entre os toggles, o valor computado ficava com espaço sobrando nos três motores; a forma sem separador corrigiu isso. O esbuild 0.21.5 minificado preserva `--x: ;` e os `var()` adjacentes.
- Alternativas no mesmo harness: combinações de seletores tiveram centenas de falhas por configuração; container style queries erraram no `html` e em todo escopo; `@scope` só passou com `:where` em tudo e os padrões de `:root` numa subcamada.
- Tamanho com 350 tokens sintéticos: cerca de 43,6 KB sem compressão e 5,6 KB gzip por marca; `@scope` saiu 1,4 a 2,1 vezes maior.
- Limite: o harness usou o arranjo anterior da pesquisa, com blocos neutros repetidos em cada arquivo de marca e valores de marca em variáveis privadas. O arranjo adotado reorganiza as mesmas regras em arquivos e troca essas variáveis por tokens públicos de eixo marca, sem mudar o mecanismo de cascata. A revalidação está em Riscos.

### Definições operacionais (a confirmar pelo aceitante)

| Termo do requisito | Definição operacional | Verificação |
| --- | --- | --- |
| "Variável sem valor" (ENG-06; FR-013, FR-014, SC-006) | Token público `--<prefixo>-*` (nome sem o segmento `_`) vazio ou garantidamente inválido em algum elemento, ou `var()` sem fallback que resolva assim. Os toggles privados são vazios ou `initial` por desenho e ficam fora. Já registrada no spec (Clarifications). | Playwright: todo token público não vazio em todo elemento de toda configuração. Auditoria: todo alvo de `var()` declarado. |
| "Só seletores dessa marca" (ENG-06; FR-017) | Todo seletor de atributo de marca em `brand-<id>.css` nomeia só `<id>`; o único outro seletor é `:where(:root)`, só no arquivo da marca padrão; `base.css` não tem seletor com valor de marca nem valor exclusivo de marca. | Auditoria estática do CSS gerado. |
| "Arquivo que se importa sem as outras marcas, com os dois modos" (ENG-06) | A app importa `base.css` e `brand-<id>.css`. O arquivo da marca traz os valores dos dois modos (tokens-fonte `.light` e `.dark`); os toggles ficam no `base.css`. | App de exemplo com `base.css` e marca A: zero variáveis exclusivas da marca B. |
| "Cada escopo redeclara os tokens semânticos" (TOK-14; FR-012) | Todo escopo recalcula os tokens do resolvedor (eixo modo, invariantes, componentes); escopo de marca também redeclara os de eixo marca; escopo só de modo herda os de eixo marca do escopo de marca mais próximo, que é o valor exigido pelo FR-012. Proposta deste ADR. | Oráculo por eixo nos casos aninhados. |

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| `light-dark()` + `color-scheme` | Aceita só `<color>` ou `<image>`, então não serve a sombra, opacidade ou dimensão. Prende o eixo modo a uma propriedade que apps e widgets também definem: `color-scheme: light dark` faria o padrão seguir o sistema, contra o FR-013. |
| Container style queries | O elemento avalia o container ancestral, então o próprio escopo e a raiz não recebem seus valores; falhou no harness. Baseline só desde 2026-05-19 (Firefox 151). |
| `@scope` com proximidade | Correto só com `:where` em tudo e padrões numa subcamada; saída 1,4 a 2,1 vezes maior; Baseline só desde 2026-03-24 (Chrome 143, Firefox 146, Safari 26.4), o que anteciparia a decisão da lista de navegadores. |
| Combinações enumeradas de seletores de marca e modo | O seletor descendente casa qualquer ancestral, não o mais próximo: centenas de falhas no harness. Os padrões ainda se multiplicam com marcas × modos. |
| `if()` de CSS | Semântica mais limpa, mas só em Chromium/Edge 137+ e sem degradação graciosa. Fica como alvo futuro do gerador, sem mudar a API. |
| Provedor JS ou CSS-in-JS por subárvore | Quebra o SSR sem JS (TOK-14) e contraria o ADR-03. |
| Toggle numérico registrado (`@property`) com `calc()` ou `color-mix()` | Não seleciona listas de sombra nem palavras-chave; `color-mix()` converte o espaço de cor e desloca o valor medido pelo contraste (ADR-15). |
| Blocos neutros repetidos em cada arquivo de marca (arranjo inicial da pesquisa) | Seletores de modo e resolvedor no arquivo da marca ferem a leitura literal do ENG-06 e exigem regra de modo padrão por marca; o `base.css` dispensa as duas coisas. |
| Valores de marca em variáveis privadas (`--<prefixo>-_l-*`, `--<prefixo>-_d-*`) | Criam variáveis CSS sem token na fonte. Os tokens-fonte `brand.` do D7 dão a mesma entrada ao resolvedor e a mesma forma às coleções da ferramenta de design (ADR-14). |

## Consequências

**Positivas**: cada eixo resolve pelo escopo mais próximo para qualquer tipo de token, com SSR sem JS e sem troca na hidratação. Não entra dependência nova nem script de instalação. O mecanismo só exige `@layer`, já exigido pelo ADR-03, então não antecipa a lista de navegadores. Trocar marca ou modo em runtime só muda atributos (FR-018), e marca nova gera só um `brand-<id>.css` a partir da fonte (FR-009). CSS e ferramenta de design partem do mesmo modelo de eixos, sem variável auxiliar.

**Negativas**: o CSS fica mais verboso, com 2 a 3 declarações por token e cadeias de `var()` que o DevTools mostra como valor especificado. Os toggles são garantidamente inválidos num dos estados, o que exige as definições operacionais e checagens restritas a tokens públicos. Override do consumidor tem semântica própria: num elemento que não é escopo, não atualiza aliases de componente, e todo escopo aninhado o desfaz; o padrão documentado é override no elemento de escopo, fora de camada, e override direto de token de componente. O `color-scheme` das regras de modo afeta widgets nativos e o fundo de iframes, e app que define o próprio `color-scheme` fora de camada vence. Um modo novo regenera o resolvedor e muda a API (major). A app importa dois arquivos.

**Neutras**: migrar para `if()` quando ele for Baseline muda bytes, não a API, e exige a matriz completa de motores. Os tokens-fonte `brand.` são públicos no ESM e no manifesto, mas o lint `brand-mode-source-token` os barra em estilo de componente (ADR-16). Portais recebem os dois atributos resolvidos da origem pelo Provedor, na feature de componentes (CMP-21).

## Requisitos atendidos

| ID | Como |
| --- | --- |
| FR-010, TOK-08, CMP-05 | Dois atributos distintos com prefixo; toda marca traz valores dos dois modos, então toda combinação é válida. |
| FR-011, TOK-09 | Resolvedor único e neutro de marca: toda combinação expõe as mesmas chaves públicas. A paridade da fonte está no ADR-11. |
| FR-012, TOK-14 (nível CSS) | Resolvedor em todo escopo e regras por eixo, conferidos pelo oráculo nos três motores. Testes React/Vue e SSR ficam na feature de componentes. |
| FR-013, CMP-24 | Padrão claro em `:where(:root)` no `base.css`; valores de marca sem atributo só no arquivo da marca padrão, que é parâmetro do gerador. |
| FR-014 | Valor inválido casa só o resolvedor e mantém o ancestral. |
| FR-017, ENG-06, SC-006 | `base.css` neutro e `brand-<id>.css` só com seletores da marca, com auditoria estática e app de exemplo. |
| FR-018, TOK-07 | Troca de atributo em runtime, conferida com mutações aleatórias na app de exemplo instalada do tarball. |
| FR-033 | Token de eixo modo vira um par de toggles sobre os tokens-fonte `brand.`. |
| FR-015, FR-016, TOK-05, TOK-06, GOV-01 | Saída do writer determinístico do ADR-11; segmento `_` fora do ESM, do `.d.ts` e do relatório de API. |
| ENG-08 | Só custom properties, fallback de `var()`, `:where()`, `@layer` e `color-scheme`. O piso é garantido pelo lint de compatibilidade de CSS, não por navegador real na versão de piso. |
| ADR-03, MIG-14 (Princípios III e XII) | Tudo em `@layer <prefixo>.tokens`, então CSS de app fora de camada vence; ordem das camadas de fonte única. |
| QA-01, QA-12 | Os 21 casos de navegador real da pesquisa e árvores aleatórias com semente: Chromium em todo PR, todos os motores da lista à noite e antes de publicar (ADR-16). |
| QA-07 | Tamanho de `base.css` mais uma marca medido contra o orçamento quando o limiar existir. |

## Riscos e mitigação

- **Bug WebKit 243247 (aberto)**: toggle definido por `var()` falha no Safari. Literal `initial` obrigatório, conferido pela auditoria do CSS gerado.
- **Espaço sobrando no valor computado**: afetaria leitores de `getComputedStyle`, consultas `style()`/`if()` e a extração do contrato de DOM. Forma sem separador, e os testes comparam strings exatas, sem normalizar espaço.
- **Minificador reescreve `--x: ;` como `--x:;`**: forma válida pela especificação e verificada nos três motores. O PR 7303 do Svelte diz que o Chromium a aceita a partir do 99 (afirmação prospectiva, igual ao piso do `@layer`). A variante minificada fica na matriz de testes.
- **Valor congelado**: token dependente de eixo declarado fora do resolvedor ou do escopo de marca fica obsoleto em escopo aninhado. A auditoria estática barra.
- **Checagem ingênua de "variável sem valor"** acusaria os toggles. A checagem de runtime cobre só tokens públicos, complementada pela auditoria de alvos de `var()`.
- **Evidência no arranjo anterior**: os 21 casos e as árvores aleatórias rodam em `@<prefixo>/tokens-example`, instalada do tarball, com valores esperados de `dist/esm/values.js`, antes de este ADR passar a Aceito.
- **Motores pré-release**: o harness rodou em builds de desenvolvimento. A matriz noturna com `@playwright/test` 1.64.x cobre os motores da lista (QA-12).
- **Tamanho**: cerca de 5,6 KB gzip por marca com 350 tokens sintéticos, medido no arranjo anterior. Com o resolvedor no `base.css`, o total se redistribui; a medição vale no cenário do QA-07 (CSS do núcleo mais uma marca).

## Pendências com o requerente

Valem as premissas citadas até a decisão.

- Confirmação pelo aceitante (papel do contratante) das quatro definições operacionais, que entram na evidência do aceite da Fase 1 do ENG-06 e do TOK-14. Premissa: as definições da tabela acima.
- Lista de navegadores (ENG-08): o mecanismo exige só `@layer`. A lista define os motores da matriz noturna.
- Marcas e marca padrão (CMP-24): marcas sintéticas `a` (padrão) e `b`. A marca padrão decide qual `brand-<id>.css` leva `:where(:root)`.
- Prefixo (TODO(PREFIXO)): `<prefixo>` como marcador em variáveis, atributos e camada.
- Orçamento de bundle do QA-07 no arquivo de limiares (QA-14): valor pendente nas Premissas.

## Referências

- https://drafts.csswg.org/css-variables-1/ e https://lea.verou.me/blog/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property/
- https://bugs.webkit.org/show_bug.cgi?id=243247 e https://github.com/sveltejs/svelte/pull/7303
- https://web-platform-dx.github.io/web-features-explorer/features/cascade-layers/, `.../features/where/`, `.../features/not/` e `.../features/color-scheme/`
- https://web-platform-dx.github.io/web-features-explorer/features/light-dark/ e https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
- https://web-platform-dx.github.io/web-features-explorer/features/scope/ e https://developer.mozilla.org/en-US/docs/Web/CSS/@scope
- https://web-platform-dx.github.io/web-features-explorer/features/container-style-queries/ e https://drafts.csswg.org/css-conditional-5/#container-rule
- https://web-platform-dx.github.io/web-features-explorer/features/if/ e https://developer.mozilla.org/en-US/docs/Web/CSS/if
- [research.md](../../specs/001-design-tokens-themes/research.md) (D3, D7), [research/css-scopes.md](../../specs/001-design-tokens-themes/research/css-scopes.md) e [spec.md](../../specs/001-design-tokens-themes/spec.md) (Clarifications)
