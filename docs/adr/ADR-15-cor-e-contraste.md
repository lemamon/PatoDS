# ADR-15: Motor de cor e checagem de contraste

**Status**: Proposto | **Data**: 2026-10-21 | **Feature**: 001-design-tokens-themes | **Relaciona**: A11Y-01, A11Y-09 (nenhum ADR do contrato alterado)

## Contexto

O A11Y-09 exige que os tokens de cor de cada tema e modo atendam às razões de contraste do nível declarado no A11Y-01. A medição usa um manifesto versionado de pares e compõe a opacidade antes do cálculo, e uma checagem confirma que todo par usado no núcleo consta do manifesto. Este ADR decide o motor de cor, a serialização das cores emitidas, o algoritmo de medição, o formato do manifesto e a checagem estática de pares. Ele se apoia no ADR-02 (tokens como fonte única), no ADR-08 (navegador real) e no ADR-09 (fronteiras de camada) e não altera nenhum dos ADR-01 a ADR-10. As forças em jogo são estas:

- Premissa vigente do A11Y-01: WCAG 2.2 AA. Texto exige 4,5:1 e não texto, incluindo indicador de foco, 3:1. O WCAG 2.2 isenta componentes inativos e, quando o indicador de foco atravessa a borda do componente, aceita que qualquer dos lados forneça o contraste (Understanding 1.4.3 e 1.4.11). O spec já registra as duas leituras (Clarifications, FR-020).
- O DTCG 2025.10 (Color Module) descreve a cor como `{colorSpace, components, alpha?, hex?}`, com 14 espaços de cor, componentes `none`, `alpha` padrão 1 e `hex` como fallback opcional de 6 dígitos. O mapeamento de gamut é não normativo e fica a cargo da ferramenta, então o PatoDS precisa fixar uma política determinística.
- Os navegadores não aplicam de forma confiável o mapeamento do CSS Color 4 a cores fora do gamut (a maioria recorta ou usa o mapeamento da plataforma), e o CSSWG resolveu em 2025-08 acrescentar novos algoritmos de mapeamento. Só uma saída sRGB garante que o valor medido é o valor exibido.
- Navegadores e axe-core compõem source-over em sRGB codificado em gama, não em luz linear. Fundo translúcido sobre fundo desconhecido não tem pior caso garantido: texto branco sobre véu preto de 50% mede 3,94 sobre página branca (3,976 em ponto flutuante e 3,949 com arredondamento de 8 bits; vale o menor, decisão 4) e 21 sobre página preta.
- Há quatro restrições transversais: saída idêntica byte a byte (TOK-05, SC-002), medição em todas as permutações marca × modo do Resolver (ADR-11), limiares no arquivo do QA-14 e fronteiras de camada (ENG-01). O motor de cor serve ao gerador de CSS e ao checker sem criar ciclo no grafo.

## Decisão

**1. Motor de cor.** O `colorjs.io` 0.7.1 (MIT, sem dependências, sem scripts de instalação, com tipos próprios) entra em versão exata e só é importado pelo pacote privado folha `@<prefixo>/color` (`tools/color`), que não depende de nenhum pacote do workspace. O formatador de CSS de `@<prefixo>/tokens-build` (ADR-11) e o checker `@<prefixo>/tokens-contrast` chamam a mesma função `toEmittedSrgb()` para toda cor, inclusive as que estão dentro de sombra e borda. Assim, o valor medido é o valor emitido. O adaptador mapeia os ids DTCG para os do colorjs.io (`display-p3`→`p3`, `a98-rgb`→`a98rgb`, `prophoto-rgb`→`prophoto`; os demais são iguais) e converte `none` em `null`. Ele passa o método de gamut sempre de forma explícita, porque o `defaults` do colorjs.io é um objeto global mutável, e faz a própria serialização, sem a precisão padrão de 5 casas da biblioteca.

**2. Política de cor emitida.**

- Os componentes DTCG são a fonte de verdade. A cor é convertida para sRGB codificado em gama, mapeada para o gamut pelo algoritmo do CSS Color 4 (`toGamut` com método `css`, deltaEOK e JND 0,02) e quantizada para 8 bits por canal.
- Para cor dentro do gamut sRGB, um `hex` informado precisa igualar a quantização dos componentes, ou a validação falha (V-10). Assim, um `hex` desatualizado ou editado à mão não diverge do CSS, do checker nem do estado enviado à ferramenta de design (ADR-14).
- Para cor fora do gamut, vale o mapeamento do CSS Color 4, e o `hex` autoral nunca substitui os componentes. O relatório de build lista cada cor fora do gamut com o valor autoral, o valor emitido e a distância deltaEOK, como evidência para a aceitação da aparência (ver Pendências).
- A serialização é única: `#rrggbb` (hexadecimal minúsculo) quando `alpha` vale 1 depois da quantização, e `rgb(R G B / A)`, com canais inteiros e `A` com exatamente três casas decimais, quando é menor (formato exato em `contracts/css-output.md`, seção 11). Não se emite CSS de gamut amplo (`oklch()`, `color(display-p3 …)`). O checker compõe com o alfa lido de volta dessa string, e um teste unitário garante a ida e volta exata.

**3. Módulo WCAG 2.2 próprio** em `@<prefixo>/color`, sem a função de contraste da biblioteca: linearização com limiar 0,04045, coeficientes 0,2126/0,7152/0,0722 e razão (L1 + 0,05)/(L2 + 0,05). A razão não é arredondada antes da comparação, e a aprovação exige razão ≥ mínimo (4,499 reprova contra 4,5).

**4. Algoritmo do checker** (`tokens-contrast check`). O checker percorre as permutações marca × modo do Resolver, as mesmas do gerador, lidas de `@<prefixo>/tokens/meta/tokens.manifest.json`. Para cada permutação e cada par do manifesto:

1. Resolve as referências para valores DTCG. Token ausente em qualquer permutação é erro (V-14), o que complementa a paridade do FR-011.
2. Passa cada valor por `toEmittedSrgb()` e lê de volta canais e alfa da string emitida.
3. Compõe o fundo. A pilha é ordenada de baixo para cima e a base precisa ser opaca (V-16). A dobra segue B = a·L + (1 − a)·B por canal, em sRGB codificado em gama, que é a composição simples do CSS Compositing usada por navegadores e pelo axe-core. Um conjunto nomeado de superfícies (`@surfaces`) gera um caso por superfície opaca do modo, e todos precisam passar. O checker nunca presume fundo branco.
4. Compõe a frente: F = a·fg + (1 − a)·B.
5. Calcula a razão em ponto flutuante e numa variante que arredonda cada canal para 8 bits após cada dobra, inclusive a final, como o `flattenColors` do axe-core. Vale a menor das duas.
6. Lê os mínimos por `kind` em `quality/thresholds.json`: `{ "level": "WCAG22-AA", "text": 4.5, "nonText": 3 }`. O checker confere que os valores batem com a tabela do nível declarado. Divergência ou nível desconhecido é erro de configuração, então nenhum mínimo baixa em silêncio, e mudar o arquivo exige a aprovação do QA-14.
7. Dá o veredito. Par sem `exempt` e fora de grupo, abaixo do mínimo, falha o build (V-15). Par com `exempt: "wcag-inactive"` é medido e reportado, sem falhar. Um grupo any-of passa quando ao menos um membro atinge o mínimo, e todos os membros são reportados.

O indicador de foco é medido contra a cor adjacente (Understanding 1.4.11): o anel externo contra a superfície onde o componente está e o anel interno contra o fundo do componente. Um indicador que fica todo de um lado gera pares independentes, todos obrigatórios. Só o indicador que atravessa a borda usa grupo any-of.

**5. Manifesto (FR-019).** Os arquivos `packages/tokens/contrast/manifest.json` e `packages/tokens/contrast/surfaces.json` são validados por JSON Schemas versionados ao lado deles (`packages/tokens/contrast/manifest.schema.json` e `surfaces.schema.json`, nomes propostos no contrato) e levam `$schema` e `schemaVersion`. As entradas ficam ordenadas por `id`, duplicatas são rejeitadas, e todo erro aponta arquivo, linha e coluna.

- `fg` e `bg` referenciam só tokens semânticos públicos ou de componente. Primitivo, token-fonte `brand.` e literal são erro (TOK-02, TOK-03). O vocabulário de estados tem fonte única no schema do manifesto (`$defs.state.enum` de `manifest.schema.json`), e o checker e a regra do FR-021 o leem dali, sem dependência entre os dois pacotes.
- `exempt` só é aceito com estado `disabled` ou `inactive`. `group` só é aceito com `kind: "non-text"`, estado `focus-visible` e ao menos dois membros. Essa restrição é proposta deste ADR e limita o any-of ao caso previsto no FR-020.
- `surfaces.json` mapeia cada nome de conjunto para a lista de superfícies opacas de cada modo. Conjunto vazio num modo, ou superfície translúcida em alguma permutação, é erro (V-16). O CODEOWNERS atribui o diretório `contrast/` ao dono de acessibilidade (GOV-09).

O formato exato fica em `contracts/contrast-manifest.md`. Os nomes do esboço são ilustrativos:

```json
{ "$schema": "./manifest.schema.json", "schemaVersion": 1,
  "pairs": [
    { "id": "button-disabled-label", "fg": "color.button.fg.disabled", "bg": ["color.bg.surface", "color.button.bg.disabled"], "state": "disabled", "kind": "text", "exempt": "wcag-inactive" },
    { "id": "focus-ring-inner", "fg": "color.border.focus", "bg": ["color.button.bg.default"], "state": "focus-visible", "kind": "non-text", "group": "focus-ring-straddle" },
    { "id": "focus-ring-outer", "fg": "color.border.focus", "bg": "@surfaces", "state": "focus-visible", "kind": "non-text", "group": "focus-ring-straddle" } ] }
```

**6. Checagem de pares em estilos (FR-021).** A regra `<prefixo>/contrast-pairs` fica no `@<prefixo>/stylelint-plugin`, o mesmo plugin da regra `<prefixo>/design-tokens` (ADR-16). Ela roda sobre o stylelint 17.16.x com `@csstools/css-tokenizer` e `@csstools/css-parser-algorithms` 4.x e reaproveita a resolução `var()` → token feita a partir do manifesto de tokens.

- O sujeito é o seletor sem os segmentos de estado (`:hover`, `:focus-visible`, `:disabled`, `[aria-*]`, `[data-<prefixo>-state=…]`). Dentro do sujeito, regras de estado sobrepõem a regra base e são mapeadas para o vocabulário do manifesto.
- As propriedades de frente vêm de uma lista versionada: `color` e `-webkit-text-fill-color` para texto; `border-*-color`, `outline-color`, `fill`, `stroke` e `accent-color` para não texto. O fundo vem de `background-color` e da cor do atalho `background`. `currentColor` resolve para o `color` do sujeito. Custom property local não é resolvida: a declaração dela é barrada por `token-definition` (ADR-16), e o uso dela como cor é expressão não resolvível.
- Quando o fundo não está no sujeito, e sempre para `outline` ou anel de foco, a regra exige anotação explícita, por exemplo `/* <prefixo>-contrast: on --<prefixo>-color-bg-surface */` ou `/* <prefixo>-contrast: on @surfaces */` (gramática em `contracts/lint-rules.md`, seção 4.4). Isso segue a nota do WCAG de que declarar cor de texto sem cor de fundo é falha.
- A tupla canônica (fg, bg, estado, tipo) precisa existir no manifesto. Expressão não resolvível (`color-mix()`, `light-dark()`, sintaxe de cor relativa, gradiente ou imagem sob texto, `var()` de outro arquivo) é erro, nunca silêncio. Blocos `@media (forced-colors: active)` ficam de fora. Seletores de estado desabilitado nunca são pulados, então par desabilitado ausente do manifesto é erro.
- Fixtures válidas e inválidas comparam multiconjuntos de {arquivo, linha, coluna, código}, com 100% dos erros esperados e zero falsos positivos. A regra passa a valer no núcleo quando ele existir (feature de componentes).

**7. Respaldo em navegador real.** Os testes Playwright de `@<prefixo>/tokens-example`, instalada a partir do tarball, renderizam uma amostra por par do manifesto em cada marca × modo. A pilha de fundo opaca é pintada em ancestrais reais que carregam `data-<prefixo>-brand` e `data-<prefixo>-mode`, para que o axe nunca recorra ao fundo branco padrão. Os testes conferem que `getComputedStyle` iguala o sRGB emitido em `dist/esm/values.js` e rodam a regra `color-contrast` do axe-core via `@axe-core/playwright`. O Chromium roda em todo PR, e todos os motores da lista rodam à noite e antes de publicar (ADR-16).

**8. Determinismo, fronteiras e interface.** As funções são puras, a iteração é ordenada, o pino é exato e o lockfile é congelado. Os bytes publicados saem do Node do `.node-version` (24.x). O `pnpm check:determinism` compara byte a byte as saídas de tokens e o relatório de contraste entre o Node piso e o mais recente da matriz do ENG-08. O relatório é ordenado por par, marca e modo, não tem timestamp e usa formatação independente de localidade. As razões exibidas são truncadas a duas casas, então 4,4996 aparece como 4,49, nunca como 4,50. O CI retém a saída `--json` como evidência (ACE-02). As arestas ficam no arquivo de camadas (`turbo.json`, ADR-12): `tokens` →(dev) `color`; `tokens-build` → `color`; `tokens-contrast` →(dev) `tokens` (meta) e `color`. O `color` não depende de nada do workspace, e uma fixture de violação da aresta inversa faz o `pnpm check:layers` falhar.

```ts
// @<prefixo>/color (tools/color): única importadora de colorjs.io
export function toEmittedSrgb(color: DtcgColor): EmittedColor; // { r, g, b: 0..255; alpha; css; inGamut; deltaEOK }
export function parseEmitted(css: string): Rgba8;               // lê de volta a string emitida (ida e volta exata)
export function relativeLuminance(c: Rgb): number;              // WCAG 2.2
export function contrastRatio(l1: number, l2: number): number;  // sem arredondamento
export function composite(bg: readonly Rgba[], fg: Rgba, mode: 'float' | 'round8'): { bg: Rgb; fg: Rgb };
// tokens-contrast check [--json] [--manifest <arquivo>] [--surfaces <arquivo>] [--tokens <arquivo>] [--thresholds <arquivo>] [--out <dir>]
//   → exit 0 ok | 1 par reprovado ou manifesto inválido | 2 uso ou configuração (limiares) | 3 erro interno
interface ContrastCase { pair: string; brand: string; mode: 'light' | 'dark'; surface: string | null; ratio: number;
  minimum: number; result: 'pass' | 'fail' | 'exempt'; group: string | null } // forma completa em contracts/contrast-manifest.md
```

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| culori 4.0.2 | É preciso e MIT, mas está sem release desde 2025-06-27 (cerca de 16 meses), tem tipos em pacote separado e seria um segundo motor ao lado do Terrazzo, que trocou o culori pelo colorjs.io na 2.0. Fica como reserva atrás do adaptador. |
| @texel/color 1.1.11 | Não tem Lab, LCH, HSL e HWB nativos (4 dos 14 espaços DTCG) e usa o mapeamento de Ottosson, não o do CSS Color 4. |
| chroma-js 3.2.0 | Não documenta display-p3, a98-rgb, prophoto-rgb, rec2020, xyz-d50 nem hwb, não tem o mapeamento do CSS Color 4 e tem licença dupla. |
| color 5.x, tinycolor2 1.6.0, wcag-contrast 3.0.0 | Praticamente só sRGB. O tinycolor2 está sem release desde 2023 e o wcag-contrast desde 2019-11. |
| @csstools/css-color-parser 4.2.6 + @csstools/color-helpers 6.1.2 | Analisa strings CSS, não objetos DTCG, e exigiria montar strings `color()`. A licença MIT-0 pediria entrada própria na política do ENG-21, e nenhum builder DTCG o usa. |
| APCA (apca-w3 0.1.9) | Não é a métrica de conformidade do WCAG 2.2, usa a "Limited W3 License", fora da política, e a última publicação é de 2022. |
| Regra `a11y/min-contrast` do Terrazzo ou `contrastWCAG21` do colorjs.io | Medem só o `$value` padrão, sem iterar marca × modo, sem composição alfa e sem pilha de fundo. A luminância vem da matriz XYZ, não dos coeficientes do WCAG, e não há mapeamento de gamut. |
| `hex` com precedência sobre os componentes | Inverte o DTCG, em que o `hex` é fallback. Um `hex` velho mudaria em silêncio o CSS e o valor medido. |
| Emitir CSS de gamut amplo e medir o valor autoral | Navegadores recortam, mapeiam pela plataforma ou compõem em display-p3, e o valor medido deixaria de ser o exibido. |
| Compor em luz linear; presumir fundo branco ou pular pilhas translúcidas | Luz linear é fisicamente correta, mas mede algo que o navegador não mostra e diverge do axe (A11Y-02). Presumir branco é inseguro no modo escuro (3,94 contra 21 no exemplo do Contexto). |
| Barrar pares inativos e exigir os dois lados do foco | É mais estrito que o WCAG 2.2 AA da premissa e só entraria por pedido de mudança do requerente. |
| FR-021 só com `color` e `background-color` na mesma regra CSS | Perde pares em seletores ou estados diferentes e inventa pares falsos. Fica como uma das entradas da fusão por sujeito e estado. |
| FR-021 por anotação em toda declaração de cor ou por convenção de nomes (tokens `on-X`) | A anotação geral é verbosa e pode ficar desatualizada; por isso só é exigida quando o fundo não sai do sujeito. A convenção restringiria o TOK-04 e não cobre bordas, foco sobre várias superfícies nem tintas translúcidas. |
| FR-021 a partir do contrato de DOM (CMP-14) | O contrato pertence à feature de componentes e ainda não existe. O formato da anotação permite gerá-la desse contrato depois, sem mudar a regra. |
| FR-021 só em runtime (Playwright ou axe) | Mapear a cor computada de volta para o token é ambíguo quando tokens compartilham valor, e a cobertura depende das stories existentes. Fica como respaldo. |

## Consequências

**Positivas**: existe um só caminho de cor do token ao pixel: o gerador emite e o checker mede a mesma string, e o navegador a confirma. Todas as permutações e estados são medidos, com composição igual à do navegador e do axe. Mínimos e nível ficam num arquivo com aprovação controlada, não no código. Nenhuma dependência de runtime entra no pacote publicado, e trocar a biblioteca de cor custa só o adaptador.

**Negativas**: o projeto passa a manter código próprio (adaptador, módulo WCAG, composição, schema do manifesto e regra de pares). Paletas de gamut amplo perdem saturação ao virar sRGB. A anotação de fundo pesa sobre os autores do núcleo e pode incentivar o uso excessivo de `@surfaces`, que multiplica os casos medidos. A biblioteca é pré-1.0, e cada upgrade exige revisão das cores emitidas.

**Neutras**: texto grande não tem mínimo próprio, porque o A11Y-09 fixa 4,5:1 para todo texto e o token não conhece o tamanho de uso. Trocar o método de mapeamento ou a versão do colorjs.io muda os bytes emitidos e é tratado como mudança visual (QA-04). O colorjs.io (15,8 MB descompactado) é só devDependency da camada `tools` e nunca entra num tarball (ENG-17).

## Requisitos atendidos

| ID | Como |
| --- | --- |
| A11Y-09 | Manifesto versionado, medição com opacidade composta em toda permutação e par reprovado que falha o build. A regra `<prefixo>/contrast-pairs` confirma que todo par usado consta do manifesto (FR-019 a FR-021). |
| A11Y-01 | Mínimos por nível em `quality/thresholds.json` (WCAG22-AA: 4,5 e 3), conferidos contra o nível declarado. Isenção de inativos e grupo any-of derivam do WCAG 2.2 AA. |
| FR-019 | `contrast/manifest.json` e `surfaces.json` com schema, `schemaVersion`, ordem, unicidade, vocabulário de estados e dono de acessibilidade. |
| FR-020, SC-008 | Passos 1 a 7 da decisão 4, com fixtures de par reprovado, par translúcido, pilha sem base opaca, par isento e grupo any-of (US4, cenários 1 a 3). |
| FR-021, SC-009 | Regra com fusão por sujeito e estado, anotações e fixtures com 100% dos erros esperados e zero falsos positivos (US4, cenário 4). |
| TOK-05, FR-015, SC-002 | `toEmittedSrgb()` única, método explícito, serialização própria, pino exato e comparação entre Node piso e mais recente. |
| TOK-09, FR-011, TOK-02, TOK-03 | Token do manifesto ausente em alguma permutação é erro (V-14), e o manifesto só referencia tokens semânticos públicos ou de componente. |
| QA-14 | Os mínimos ficam só no arquivo de limiares, alterável com aprovação de pessoa indicada pelo requerente. |
| QA-02 | Testes unitários do adaptador (14 espaços, `none`, gamut, `hex` × componentes da V-10, ida e volta da serialização), da composição e do módulo WCAG: #767676 sobre #fff = 4,54 passa, #777777 sobre #fff = 4,47 reprova, preto sobre branco = 21, e diferença ≤ 1e-4 contra o colorjs.io para cores opacas dentro do gamut. |
| QA-01, QA-06, QA-12, ADR-08 | Amostras em navegador real a partir do tarball, com `getComputedStyle` igual ao valor emitido e axe. |
| A11Y-02 | Parcial: o axe nas amostras é o respaldo para os limites da análise estática. O motor em toda a matriz de componentes fica na feature de componentes. |
| ENG-01, ADR-09 | `tools/color` é folha, as arestas estão declaradas e há fixture da aresta inversa. |
| ENG-07, ENG-16, ENG-21, ENG-24, ENG-25 | colorjs.io, stylelint e `@csstools/*` são MIT, sem scripts de instalação e em versão exata. axe-core e `@axe-core/playwright` (MPL-2.0, só dev, sem modificação) ganham entrada em `quality/license-policy.json`. Toda dependência nova tem aprovação de dono. |
| ACE-02, GOV-07 | Relatório determinístico e lint ligados como checks na matriz de rastreabilidade; decisão registrada neste ADR. |

## Riscos e mitigação

- **colorjs.io pré-1.0** (a 0.6 e a 0.7 tiveram minors incompatíveis) **e algoritmo de mapeamento do CSS Color 4 em mudança** (resolução do CSSWG de 2025-08). Pino exato, uso só via adaptador, vetores de ouro, e upgrade ou troca de método só em PR próprio, com diff das cores emitidas, tratado como mudança visual (QA-04).
- **Gerador e checker divergem** se algum caminho de cor não passar pelo adaptador (o Terrazzo traz o próprio uso do colorjs.io). Todo serializador de cor do `tokens-build` chama `toEmittedSrgb()` (ADR-11), o lockfile tem uma só versão do colorjs.io e a amostra em navegador confere que o emitido é igual ao medido.
- **Composição e gamut dependem da implementação nas bordas** (alguns navegadores no macOS compõem em display-p3). Saída só sRGB, menor razão entre as variantes flutuante e de 8 bits e axe em navegador real. Resta um risco pequeno para cores translúcidas em telas P3.
- **Pares perto do limiar.** O axe aprova só com razão estritamente maior que o mínimo e trunca a exibição, enquanto o checker usa ≥. A menor razão entre as variantes reduz a diferença, mas não a elimina. Divergência vira triagem registrada (A11Y-02).
- **Limites da análise estática**: aninhamento entre componentes, overrides do consumidor, estilos inline, opacidade ou blend de ancestrais, imagens e anotações erradas. Expressão não resolvível é erro, as anotações passam por revisão e o axe em navegador real serve de respaldo.
- **Último bit da matemática entre versões do V8** (cbrt, pow e atan2 no mapeamento). Com a quantização de 8 bits, uma troca de valor é improvável, e a comparação entre Node piso e mais recente a detecta.

## Pendências com o requerente

Valem as premissas citadas até a decisão do requerente:

- Paletas em gamut amplo: se alguma marca da versão 1.0 vier em display-p3 ou OKLCH fora do sRGB, é preciso aceitar a renderização em sRGB com mapeamento determinístico do CSS Color 4. Premissa: mapeamento para sRGB. A alternativa é uma saída extra de gamut amplo, com cada variante medida separadamente e luminância por CIE Y, uma extensão documentada, porque o WCAG 2.x só define sRGB.
- Nível de conformidade (A11Y-01): premissa WCAG 2.2 AA. Outro nível muda a seção de contraste do arquivo de limiares, a isenção de inativos e o grupo any-of. A própria seção de contraste em `quality/thresholds.json` só entra com aprovação de pessoa indicada pelo requerente (QA-14).
- Marcas, valores e marca padrão (CMP-24): a checagem roda sobre as marcas sintéticas A e B (QA-15). Par reprovado com os valores reais volta ao responsável de design da marca.
- Lista de navegadores e pisos de versão (ENG-08): definem os motores da matriz noturna das amostras e o piso da comparação de determinismo. Premissas: mecanismo CSS que exige só `@layer` (ADR-13) e Node 22 LTS.
- Prefixo (TODO(PREFIXO)): `<prefixo>` como marcador no nome da regra e na anotação `<prefixo>-contrast`. Plataforma: CODEOWNERS e CI presumem GitHub e GitHub Actions.

## Referências

- https://www.designtokens.org/tr/2025.10/color/ e https://www.designtokens.org/tr/2025.10/resolver/
- https://www.w3.org/TR/WCAG22/, https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html e https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.w3.org/TR/compositing-1/, https://lists.w3.org/Archives/Public/public-colorweb/2021Jan/0024.html e https://lists.w3.org/Archives/Public/public-fxtf-archive/2023Jul/0007.html
- https://lists.w3.org/Archives/Public/public-css-archive/2025Aug/0486.html e https://lists.w3.org/Archives/Public/public-css-archive/2024Jan/0728.html
- https://colorjs.io/docs/gamut-mapping, https://colorjs.io/docs/spaces, https://registry.npmjs.org/colorjs.io, https://github.com/color-js/color.js/releases e https://unpkg.com/colorjs.io@0.7.1/src/ (`toGamut.js`, `defaults.js`, `contrast/WCAG21.js`)
- https://github.com/dequelabs/axe-core/tree/develop/lib/commons/color, https://raw.githubusercontent.com/dequelabs/axe-core/develop/lib/checks/color/color-contrast-evaluate.js e https://registry.npmjs.org/axe-core
- https://unpkg.com/@terrazzo/parser@2.10.0/dist/lint/plugin-core/rules/a11y-min-contrast.js, https://registry.npmjs.org/@terrazzo%2Ftoken-tools, https://registry.npmjs.org/stylelint e https://www.npmjs.com/package/@csstools/css-parser-algorithms
- https://www.npmjs.com/package/culori, https://github.com/texel-org/color, https://gka.github.io/chroma.js/, https://registry.npmjs.org/wcag-contrast, https://registry.npmjs.org/@csstools%2Fcss-color-parser e https://www.npmjs.com/package/apca-w3
- Arte prévia (Primer): https://github.blog/engineering/user-experience/unlocking-inclusive-design-how-primers-color-system-is-making-github-com-more-inclusive/
- [research.md](../../specs/001-design-tokens-themes/research.md) (D5), [research/color-contrast.md](../../specs/001-design-tokens-themes/research/color-contrast.md) e [spec.md](../../specs/001-design-tokens-themes/spec.md) (Clarifications, FR-019 a FR-021)
