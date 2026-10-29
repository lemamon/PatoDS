# Contrato: módulos ESM e tipos dos tokens

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) (D1, D6, D7) |
**Modelo**: [data-model.md](../data-model.md) | **Data**: 2026-10-21

Decisões de origem: [ADR-11](../../../docs/adr/ADR-11-pipeline-build-tokens.md) (pipeline de build)
e [ADR-16](../../../docs/adr/ADR-16-lint-tokens-e-testes.md) (lint de tokens e pilha de testes),
ambas com status Proposto. Detalhes: [research/token-build.md](../research/token-build.md) e
[research/lint-test.md](../research/lint-test.md); onde divergem do [research.md](../research.md),
vale o research.md.

`<prefixo>` é o marcador do prefixo do projeto (TODO(PREFIXO) da constituição v1.0.0), usado
literalmente nos trechos abaixo. Marcas `a` e `b` são as marcas sintéticas das fixtures (QA-15).
O CSS, a serialização de valores e o mecanismo de escopo estão em [css-output.md](css-output.md).

## 1. Escopo e rastreabilidade

Este contrato fixa as entradas JavaScript do pacote `@<prefixo>/tokens`, a forma das exportações,
as declarações de tipo, o que fica de fora, os campos do `package.json`, o conteúdo do tarball, os
testes de tipos e o relatório de API.

| Requisito | Onde é atendido |
| --- | --- |
| FR-016, TOK-06 | §2 a §5: referências `var(--<prefixo>-*)` de todos os tokens e, em entrada separada, mapas por marca e modo, com `.d.ts`; §10: nome inexistente gera erro de tipos |
| ENG-04 | §8: ESM sem efeito colateral; `sideEffects` lista só CSS |
| ENG-05 | §8 e §10: tipos publicados junto do código, `publint` e consumidor estrito compilando cada entrada |
| ENG-17, ENG-22 | §8 e §9: allowlist do tarball, nenhum script de instalação, campo `license` e avisos de terceiros |
| QA-08 | §10: testes de tipos com casos negativos; §11: relatório de API versionado e conferido por drift |
| GOV-01 | §11: insumo da verificação de API pública |
| Princípio I | §4: marcas, modos e nomes de atributo exportados como constantes geradas, sem cópia à mão nos consumidores |

## 2. Entradas

| Subcaminho | Arquivo | Tipos | Conteúdo |
| --- | --- | --- | --- |
| `.` | `dist/esm/index.js` | `dist/esm/index.d.ts` | Objeto de referências `tokens`, constantes de tema e tipos `TokenName`, `Brand`, `Mode`, `TokenRef`, `TokenRefs` |
| `./values` | `dist/esm/values.js` | `dist/esm/values.d.ts` | Mapa `values` por marca × modo × token e tipo `TokenValues` |

- O pacote é só ESM (`"type": "module"`). Não há condição `require` nem build CommonJS.
- As duas entradas são independentes em runtime: `values.js` não importa `index.js`, e nenhuma
  delas importa CSS. O `.d.ts` de `./values` importa tipos de `./index.js` só em nível de tipo.
- Não há exportação padrão (`default`); só exportações nomeadas.
- `index.js` é pequeno e serve a apps; `values.js` cresce com marcas × modos × tokens e se destina a
  testes, SSR sem DOM, ferramentas e contextos fora do CSS (por exemplo, canvas). Para estilizar o
  DOM, use CSS ou as referências (css-output.md, O-06).

## 3. Forma das exportações: decisão

**Decisão**: a entrada `.` exporta um objeto congelado `tokens`, indexado pelo caminho do token,
com o valor literal `var(--<prefixo>-…)`, mais a união `TokenName` das chaves. Não há uma
exportação nomeada por token.

Motivos:

1. **Identidade com a fonte e com a ferramenta de design.** A chave é o caminho DTCG exato
   (`color.bg.surface`), o mesmo da convenção (TOK-04), do manifesto, do relatório de API e, com
   outro separador, da ferramenta de design (DSN-04). Exportações nomeadas exigiriam converter
   caminhos com `.`, `-` e segmentos iniciados por dígito em identificadores JavaScript, o que cria
   uma segunda convenção de nomes e colisões: com camelCase, `space.1-5` e `space.15` virariam ambos
   `space15`.
2. **Um tipo só para nomes de token.** `TokenName` é exatamente `keyof TokenRefs`; tipa props e
   funções da app que recebem nomes de token, e `Object.keys(tokens)` permite iterar em docs e
   testes.
3. **Superfície de API pequena e estável.** Uma exportação e uma união, em vez de centenas de
   exportações no relatório do GOV-01.
4. **Imutabilidade coerente com os tipos.** `Object.freeze` em runtime e propriedades `readonly` no
   `.d.ts`.

Custo aceito: não há tree-shaking por token. Quem importa `tokens` recebe todas as referências
(cerca de 45 bytes por token antes de compressão; a medir contra o orçamento do QA-07, cujo valor
está pendente na premissa de limiares). Mitigações: a anotação `/*#__PURE__*/` permite ao bundler
remover o objeto inteiro quando ele não é usado; apps que não precisam de JavaScript usam só o CSS; o
tree-shaking por componente do ENG-04 se aplica aos pacotes de UI, e o módulo de referências é uma
unidade.

Alternativas rejeitadas:

- **Uma exportação nomeada por token**: colisões e segunda convenção de nomes (motivo 1), centenas
  de entradas no relatório de API.
- **Módulos por categoria** (`./color`, `./space` etc.): mais entradas no mapa de exports e no
  relatório, sem ganho de tipos; categoria nova viraria entrada nova.
- **Função `token(name)` ou `Proxy`**: código de runtime sem vantagem de tipo sobre o literal; o
  `Proxy` ainda impede análise estática.
- **`enum` do TypeScript**: gera runtime próprio do TypeScript, não é ESM idiomático e, na forma
  `const enum`, conflita com `isolatedModules` e `verbatimModuleSyntax`.
- **Tipos literais nos valores de `values`**: cada ajuste de cor alteraria o `.d.ts` e o relatório
  de API, transformando mudança visual em mudança de API; `string` basta.

## 4. Entrada `.`

| Exportação | Tipo | Conteúdo |
| --- | --- | --- |
| `tokens` | `TokenRefs` | Objeto congelado: caminho do token → `"var(--<prefixo>-<segmentos unidos por ->)"` |
| `TokenName` | tipo | União literal de todos os caminhos de token publicados |
| `TokenRefs` | tipo | Objeto com uma propriedade `readonly` por token, de tipo literal `"var(--<prefixo>-…)"` |
| `TokenRef` | tipo | `TokenRefs[TokenName]`: união de todas as referências |
| `Brand` | tipo | União dos ids de marca (contextos do modificador `brand`) |
| `Mode` | tipo | `"light" \| "dark"` (contextos do modificador `mode`) |
| `brands` | `readonly [ … ]` | Tupla congelada dos ids de marca, por code point |
| `modes` | `readonly [ … ]` | Tupla congelada dos modos, na ordem canônica (modo padrão primeiro) |
| `defaultBrand` | literal de `Brand` | Marca padrão (premissa: indicada pelo requerente, CMP-24; `a` nas fixtures) |
| `defaultMode` | literal de `Mode` | Modo padrão (premissa do spec: `light`) |
| `attributes` | objeto congelado | `{ brand: "data-<prefixo>-brand", mode: "data-<prefixo>-mode" }` |

`TokenName` inclui todos os tokens publicados: primitivos, semânticos públicos, fontes marca-modo
(`brand.…`) e de componente. As regras de consumo (estilo de componente só com semânticos públicos e
de componente, TOK-03) são impostas pelo lint de estilos, não pelos tipos; uma referência a fonte
marca-modo ignora o modo, e uma referência a primitivo exclusivo de marca só resolve no escopo
daquela marca (css-output.md, §15).

Esboço de `dist/esm/index.js` (forma, não conteúdo completo):

```js
/* @<prefixo>/tokens: generated file, do not edit. */
export const attributes = /*#__PURE__*/ Object.freeze({
  "brand": "data-<prefixo>-brand",
  "mode": "data-<prefixo>-mode"
});
export const brands = /*#__PURE__*/ Object.freeze(["a", "b"]);
export const defaultBrand = "a";
export const defaultMode = "light";
export const modes = /*#__PURE__*/ Object.freeze(["light", "dark"]);
export const tokens = /*#__PURE__*/ Object.freeze({
  "brand.color.bg.surface.dark": "var(--<prefixo>-brand-color-bg-surface-dark)",
  "color.bg.surface": "var(--<prefixo>-color-bg-surface)",
  "z-index.layer.modal": "var(--<prefixo>-z-index-layer-modal)"
});
```

Esboço de `dist/esm/index.d.ts`:

```ts
/* @<prefixo>/tokens: generated file, do not edit. */
export type Brand = "a" | "b";
export type Mode = "light" | "dark";
export type TokenName =
  | "brand.color.bg.surface.dark"
  | "color.bg.surface"
  | "z-index.layer.modal";
export type TokenRefs = {
  readonly "brand.color.bg.surface.dark": "var(--<prefixo>-brand-color-bg-surface-dark)";
  /** Superfície principal de conteúdo. */
  readonly "color.bg.surface": "var(--<prefixo>-color-bg-surface)";
  readonly "z-index.layer.modal": "var(--<prefixo>-z-index-layer-modal)";
};
export type TokenRef = TokenRefs[TokenName];
export declare const attributes: {
  readonly brand: "data-<prefixo>-brand";
  readonly mode: "data-<prefixo>-mode";
};
export declare const brands: readonly ["a", "b"];
export declare const defaultBrand: "a";
export declare const defaultMode: "light";
export declare const modes: readonly ["light", "dark"];
export declare const tokens: TokenRefs;
```

## 5. Entrada `./values`

`values[marca][modo][token]` é o valor final do token naquela permutação, resolvido até o literal e
serializado como no CSS (css-output.md, §11), sem `var()`. É igual ao valor computado da custom
property no navegador para aquela marca e modo efetivos (css-output.md, BR-18).

- Todo `(marca, modo)` contém todos os tokens de `TokenName`, de modo que o tipo
  `Record<TokenName, string>` é exato. Isso inclui os primitivos exclusivos de outra marca, que são
  invariantes e têm o mesmo valor em toda permutação (D7); em que arquivo CSS cada um é declarado
  está no campo `placement` do manifesto.
- Fontes marca-modo trazem o valor da marca, igual nos dois modos.

Esboço de `dist/esm/values.js`:

```js
/* @<prefixo>/tokens: generated file, do not edit. */
export const values = /*#__PURE__*/ Object.freeze({
  "a": /*#__PURE__*/ Object.freeze({
    "light": /*#__PURE__*/ Object.freeze({
      "color.bg.surface": "#ffffff",
      "color.button.bg.default": "#1f5fd1"
    }),
    "dark": /*#__PURE__*/ Object.freeze({ /* … */ })
  }),
  "b": /*#__PURE__*/ Object.freeze({ /* … */ })
});
```

Esboço de `dist/esm/values.d.ts`:

```ts
/* @<prefixo>/tokens: generated file, do not edit. */
import type { Brand, Mode, TokenName } from "./index.js";
export type { Brand, Mode, TokenName } from "./index.js";
export type TokenValues = Readonly<Record<Brand, Readonly<Record<Mode, Readonly<Record<TokenName, string>>>>>>;
export declare const values: TokenValues;
```

`TokenValues` é o tipo `Record<Brand, Record<Mode, Record<TokenName, string>>>` com `Readonly` em
cada nível; propriedades `readonly` continuam atribuíveis ao tipo sem `Readonly` para leitura.

## 6. O que fica de fora

- Toggles privados `--<prefixo>-_on-*` e qualquer nome com o segmento `_` (css-output.md, T-05).
- `$extensions`, local de origem na fonte, cadeia de alias, camada, eixo e papel: ficam no manifesto
  (`./meta/tokens.manifest.json`), para ferramentas.
- `$description` aparece só como comentário JSDoc no `.d.ts`, sem efeito de tipo.
- Runtime de resolução (por exemplo, `resolver.apply()`), funções, classes e `Proxy`.
- Importação de CSS a partir do ESM; o CSS é importado pela app (css-output.md, U-01).
- Valores com tipo literal no mapa `values` (§3).

## 7. Regras de geração e determinismo

- **E-01** Os módulos são gerados por `tokens-build build` a partir do mesmo modelo resolvido que gera
  o CSS, e nunca editados à mão (FR-015, FR-016).
- **E-02** Sintaxe de módulo ES2015, sem recursos posteriores: só `export const`, literais e
  `Object.freeze`. Nenhum `import` em runtime.
- **E-03** Chaves de tokens e de marcas ordenadas por code point; modos na ordem canônica
  (css-output.md, RS-03). Todo caminho de token contém `.`, então nenhuma chave é índice numérico e a
  ordem de enumeração é a de inserção.
- **E-04** Strings escritas com `JSON.stringify` (escapes determinísticos), chaves sempre entre aspas
  duplas, indentação de dois espaços, fim de linha LF, quebra de linha final, cabeçalho fixo sem
  data nem versão, sem source map.
- **E-05** Toda chamada a `Object.freeze` leva `/*#__PURE__*/`; `values` é congelado em todos os
  níveis.
- **E-06** `tokens[N]` é `"var(" + cssName(N) + ")"`, com `cssName` conforme css-output.md, DEP-04.
- **E-07** No `.d.ts`, cada propriedade de `TokenRefs` leva JSDoc com o `$description` do token,
  quando houver (com `*/` escapado), e `@deprecated` com a mensagem de `$deprecated`, quando o token
  estiver depreciado.
- **E-08** A verificação `dist-parity` do build confirma que as chaves de `tokens`, a união
  `TokenName`, as chaves de cada mapa em `values`, os nomes declarados no CSS, o manifesto e o
  relatório de API listam o mesmo conjunto de tokens; a verificação `private-segment-leak`
  ([tools-cli.md](tools-cli.md), §2.2) confirma que nenhum nome com o segmento `_` aparece no ESM,
  no `.d.ts` nem no relatório de API. Divergência sai com código 1.
- **E-09** O determinismo byte a byte dos quatro arquivos é coberto por `pnpm check:determinism`
  (css-output.md, D-09).

## 8. `package.json` do pacote publicado

```json
{
  "name": "@<prefixo>/tokens",
  "version": "<versão única dos pacotes publicados>",
  "type": "module",
  "license": "UNLICENSED",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "default": "./dist/esm/index.js"
    },
    "./values": {
      "types": "./dist/esm/values.d.ts",
      "default": "./dist/esm/values.js"
    },
    "./css/base.css": "./dist/css/base.css",
    "./css/brand-*.css": "./dist/css/brand-*.css",
    "./meta/*": "./dist/meta/*"
  },
  "files": ["dist/css/", "dist/esm/", "dist/meta/", "THIRD-PARTY-NOTICES.md"],
  "engines": { "node": ">=22" },
  "scripts": {
    "tokens:build": "tokens-build build",
    "tokens:validate": "tokens-build validate"
  },
  "devDependencies": {
    "@<prefixo>/color": "workspace:*",
    "@<prefixo>/tokens-build": "workspace:*"
  }
}
```

- **PK-01** `exports` é o único mapa de resolução: sem `main`, `module` nem `types` no topo. Em cada
  entrada JavaScript, `types` vem antes de `default`. A resolução `node10`, que ignora `exports`, não
  é suportada (removida no TypeScript 7).
- **PK-02** `./css/brand-*.css` usa padrão de subcaminho para que uma marca nova não altere o
  `package.json` (FR-009, SC-005). `./meta/*` expõe os manifestos e o relatório de build para
  ferramentas; apps não os importam.
- **PK-03** `sideEffects` é exatamente `["**/*.css"]` (ENG-04): os módulos ESM não têm efeito
  colateral, e o CSS não é descartado no build de produção.
- **PK-04** Sem `dependencies`, `peerDependencies`, `optionalDependencies` nem
  `bundledDependencies`. As `devDependencies` seguem as arestas permitidas do arquivo de camadas
  (tokens →(dev) `tools/tokens-build`, `tools/color`), e os protocolos `workspace:` são reescritos
  pelo `pnpm pack`.
- **PK-05** Nenhum script de ciclo de vida de instalação (`preinstall`, `install`, `postinstall`,
  `prepare`) (ENG-17). Os scripts `tokens:build` e `tokens:validate` são as tarefas do Turborepo
  acionadas pela raiz (`pnpm tokens:build`, `pnpm tokens:validate`) e referenciadas no grafo como
  `@<prefixo>/tokens#tokens:build` ([tools-cli.md](tools-cli.md), seção 7). O nome `build` fica
  reservado à compilação dos pacotes de ferramenta, de que essas tarefas dependem (`^build`).
- **PK-06** `license` segue a premissa vigente do ENG-22: licença proprietária do requerente, sem
  redistribuição externa (`UNLICENSED` como marcador).
- **PK-07** `engines.node` acompanha o piso da premissa vigente "Node em LTS" (Node 22 LTS, D2); mudar
  o piso segue o ENG-08. O valor de `version` segue a premissa de versão única (GOV-01).

## 9. Conteúdo do tarball (allowlist do ENG-17)

O tarball produzido por `pnpm pack` contém exatamente:

| Caminho no tarball | Origem |
| --- | --- |
| `package/package.json` | Manifesto, com `workspace:` reescrito |
| `package/README.md` | Propósito, instalação, uso mínimo e link para a documentação (DOC-08) |
| `package/THIRD-PARTY-NOTICES.md` | Avisos de terceiros (ENG-22; nome provisório). O conteúdo gerado não inclui código nem ativo de terceiros; os schemas DTCG ficam fora do tarball |
| `package/dist/css/base.css` | css-output.md |
| `package/dist/css/brand-<id>.css` | Exatamente um por marca do resolver |
| `package/dist/esm/index.js`, `index.d.ts` | §4 |
| `package/dist/esm/values.js`, `values.d.ts` | §5 |
| `package/dist/meta/tokens.manifest.json`, `sync-manifest.json`, `report.json`, `report.md` | Manifestos e relatório de build |

Nada mais: sem `src/`, `contrast/`, `schemas/`, `api/`, testes, configurações, source maps ou
arquivos `.tsbuildinfo`. O check do ENG-17 é da feature de CI e publicação; até ele existir, o
projeto `@<prefixo>/types-consumer` confere no tarball a presença dos quatro arquivos ESM e `.d.ts`
(FR-016), a ausência de arquivo fora desta tabela e a ausência de scripts de instalação.

## 10. Testes de tipos

### 10.1 Projeto consumidor

`@<prefixo>/types-consumer` (`tests/types-consumer`, privado, camada `apps`) instala o tarball
empacotado, nunca o código-fonte (QA-06, Princípio VII): dependências de terceiros pelo lockfile
congelado, o tarball com scripts desativados e conferência de que os arquivos instalados batem com o
tarball. Arquivos de teste: `src/refs.ts` e `src/values.ts` (positivos) e `src/negative.ts`
(negativos). Executado por `pnpm test:types`.

Matriz: TypeScript 6.0.x e 7.0.x × resolução `bundler` e `nodenext`, quatro execuções de
`tsc --noEmit`, todas obrigatórias. TS 7.0.x pelo pacote `typescript` (binário `tsc`) e TS 6.0.x
pelo `@typescript/typescript6` (binário `tsc6`), em versões exatas do catálogo. TS 6.0 é o valor
provisório do `<versão>` da premissa de versões mínimas (ENG-08, D2). O teste usa só diagnósticos
do `tsc`, porque o TS 7.0 não tem API programática.

### 10.2 Configuração do `tsc`

`tsconfig.bundler.json`:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "es2022",
    "lib": ["es2022"],
    "types": [],
    "module": "preserve",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedSideEffectImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": false
  },
  "include": ["src"]
}
```

`tsconfig.nodenext.json` é igual, com `"module": "nodenext"` e `"moduleResolution": "nodenext"`; o
`package.json` do projeto declara `"type": "module"`. `skipLibCheck: false` é obrigatório, para que
os `.d.ts` do pacote sejam verificados em modo estrito.

### 10.3 Casos positivos

Escritos com `expect-type`, sem depender de nomes de marca ou de token específicos, de modo que
valem para as marcas sintéticas e para as marcas reais quando chegarem.

```ts
import { expectTypeOf } from "expect-type";
import {
  attributes, brands, defaultBrand, defaultMode, modes, tokens,
  type Brand, type Mode, type TokenName, type TokenRef, type TokenRefs,
} from "@<prefixo>/tokens";
import { values, type TokenValues } from "@<prefixo>/tokens/values";

type DotToDash<S extends string> = S extends `${infer H}.${infer T}` ? `${H}-${DotToDash<T>}` : S;
declare const n: TokenName;
```

| Caso | Asserção |
| --- | --- |
| P-01 | `expectTypeOf<TokenName>().not.toBeAny()` e `.not.toEqualTypeOf<string>()`: união de literais |
| P-02 | `expectTypeOf<TokenName>().toEqualTypeOf<keyof TokenRefs>()` e `expectTypeOf(tokens).toEqualTypeOf<TokenRefs>()` |
| P-03 | ``expectTypeOf<TokenRefs>().toEqualTypeOf<{ readonly [N in TokenName]: `var(--<prefixo>-${DotToDash<N>})` }>()``: cada referência é o literal derivado do caminho |
| P-04 | `Brand` igual a `(typeof brands)[number]`; `Mode` igual a `"light" \| "dark"` e a `(typeof modes)[number]`; `defaultBrand` estende `Brand`; `defaultMode` igual a `"light"` |
| P-05 | `expectTypeOf(values).toEqualTypeOf<TokenValues>()`; `TokenValues` igual a `Readonly<Record<Brand, Readonly<Record<Mode, Readonly<Record<TokenName, string>>>>>>`; `values[defaultBrand][defaultMode][n]` é `string`, sem `undefined`, mesmo com `noUncheckedIndexedAccess` |
| P-06 | `tokens[n]` é `TokenRef`; `TokenRef` estende `` `var(--<prefixo>-${string})` `` |
| P-07 | `attributes` igual a `{ readonly brand: "data-<prefixo>-brand"; readonly mode: "data-<prefixo>-mode" }` |
| P-08 | Nenhuma exportação é `any` (`.not.toBeAny()` em cada uma), e uma busca textual nos `.d.ts` do tarball não encontra `any` (Princípio VI) |
| P-09 | As duas entradas, inclusive a importação só de tipos de `@<prefixo>/tokens/values`, compilam nas quatro execuções |

### 10.4 Casos negativos

Cada caso usa `@ts-expect-error`. Se um caso deixar de falhar, a diretiva sem uso gera o erro
TS2578 e quebra o teste, como exige o QA-08. Os nomes usados nunca podem ser válidos: o primeiro
segmento `zzz` não é categoria, e `__invalida__` não é id kebab.

```ts
// N-01: token inexistente nas referências
// @ts-expect-error
void tokens["zzz.nao-existe"];

// N-02: string arbitrária não é TokenName
// @ts-expect-error
const nome: TokenName = "qualquer-coisa";

// N-03: marca inexistente
// @ts-expect-error
void values["__invalida__"];

// N-04: modo inexistente
// @ts-expect-error
void values[defaultBrand]["sepia"];

// N-05: token inexistente no mapa de valores
// @ts-expect-error
void values[defaultBrand][defaultMode]["zzz.nao-existe"];

// N-06: referências são somente leitura
// @ts-expect-error
tokens[n] = tokens[n];

// N-07: mapa de valores é somente leitura
// @ts-expect-error
values[defaultBrand][defaultMode][n] = "#000000";

// N-08: toggle privado não é token público
// @ts-expect-error
const privado: TokenName = "_on-light";
```

Em arquivo próprio, porque são declarações de importação:

```ts
// N-09: `values` não é exportado pela entrada "." (entradas separadas)
// @ts-expect-error
import { values as v } from "@<prefixo>/tokens";

// N-10: caminho interno fora do mapa de exports
// @ts-expect-error
import { tokens as t } from "@<prefixo>/tokens/dist/esm/index.js";
```

### 10.5 Verificações do pacote

- `publint` sobre o tarball, sem erros nem avisos (ENG-05).
- Conferência do conteúdo do tarball (§9).
- A importação dos arquivos CSS não faz parte do teste de tipos: a app os importa pelo bundler, e o
  mapa de exports deles é conferido pelo `publint` e pela app de exemplo (css-output.md, §16).

## 11. Relatório de API (`api/tokens.api.json`)

Arquivo versionado em `packages/tokens/api/tokens.api.json`, gerado por `pnpm tokens:build` a
partir do mesmo modelo dos módulos (não da análise do `.d.ts`: o TS 7.0 não tem API e o API
Extractor embute uma versão antiga do TypeScript). `pnpm check:drift` o regenera e exige
`git diff --exit-code`; PR que altera a superfície sem atualizar o relatório falha (QA-08). A
verificação de API pública do GOV-01, da feature de CI e publicação, compara o relatório com o da
última versão publicada e bloqueia quebra sem incremento de major.

### 11.1 Forma

JSON canônico de [tools-cli.md](tools-cli.md), §1.4 (chaves por code point em todos os níveis,
indentação de dois espaços, LF, quebra de linha final), identificado pelos campos `format` e
`version`. `entries` segue a ordem do mapa `exports` do `package.json`; exportações e tokens são
ordenados por `name` (code point); `brands` por code point; `modes` na ordem canônica.

```json
{
  "css": {
    "layer": "<prefixo>.tokens",
    "layerOrder": ["<prefixo>.tokens"]
  },
  "entries": [
    {
      "exports": [
        { "kind": "type", "name": "Brand" },
        { "kind": "type", "name": "Mode" },
        { "kind": "type", "name": "TokenName" },
        { "kind": "type", "name": "TokenRef" },
        { "kind": "type", "name": "TokenRefs" },
        { "kind": "const", "name": "attributes" },
        { "kind": "const", "name": "brands" },
        { "kind": "const", "name": "defaultBrand" },
        { "kind": "const", "name": "defaultMode" },
        { "kind": "const", "name": "modes" },
        { "kind": "const", "name": "tokens" }
      ],
      "kind": "esm",
      "path": "."
    },
    {
      "exports": [
        { "kind": "type", "name": "Brand" },
        { "kind": "type", "name": "Mode" },
        { "kind": "type", "name": "TokenName" },
        { "kind": "type", "name": "TokenValues" },
        { "kind": "const", "name": "values" }
      ],
      "kind": "esm",
      "path": "./values"
    },
    { "kind": "css", "path": "./css/base.css" },
    { "files": ["./css/brand-a.css", "./css/brand-b.css"], "kind": "css", "path": "./css/brand-*.css" },
    {
      "files": [
        { "path": "./meta/report.json", "version": 1 },
        { "path": "./meta/report.md" },
        { "path": "./meta/sync-manifest.json", "version": 1 },
        { "path": "./meta/tokens.manifest.json", "version": 1 }
      ],
      "kind": "meta",
      "path": "./meta/*"
    }
  ],
  "format": "<prefixo>.tokens-api",
  "package": "@<prefixo>/tokens",
  "theme": {
    "attributes": { "brand": "data-<prefixo>-brand", "mode": "data-<prefixo>-mode" },
    "brands": ["a", "b"],
    "defaultBrand": "a",
    "defaultMode": "light",
    "modes": ["light", "dark"]
  },
  "tokens": [
    {
      "axis": "mode",
      "category": "color",
      "cssName": "--<prefixo>-color-bg-surface",
      "deprecated": false,
      "layer": "semantic",
      "name": "color.bg.surface",
      "placement": "base",
      "role": "public",
      "type": "color"
    },
    {
      "axis": "invariant",
      "category": "color",
      "cssName": "--<prefixo>-color-blue-600",
      "deprecated": false,
      "exclusiveBrand": "a",
      "layer": "primitive",
      "name": "color.blue.600",
      "placement": "brand-exclusive",
      "role": "public",
      "type": "color"
    }
  ],
  "version": 1
}
```

Campos de token: `name` (caminho), `cssName`, `type` (`$type` DTCG), `category`, `layer`
(`primitive`, `semantic`, `component`), `axis` (`invariant`, `brand`, `mode`; primitivos e
componentes são `invariant`), `role` (`public` ou `brand-mode-source`), `placement` (`base`, `brand`
ou `brand-exclusive`, com `exclusiveBrand`) e `deprecated` (`false`, `true` ou a mensagem). Valores
de token e descrições ficam fora: mudança de valor não é mudança de API e segue a regressão visual
(QA-04). Os toggles privados ficam fora.

### 11.2 Classificação das mudanças (insumo do GOV-01)

| Mudança no relatório | Classe |
| --- | --- |
| Remover ou renomear token (renomear = remover + adicionar) | major |
| Mudar `cssName`, `type`, `category`, `layer` ou `role` de um token | major |
| Mudar `placement` de `base` ou `brand` para `brand-exclusive`, ou trocar `exclusiveBrand` | major |
| Remover marca, adicionar ou remover modo (data-model) | major |
| Mudar `defaultBrand`, `defaultMode`, nomes de atributo, `layer` ou a posição de camada existente em `layerOrder` | major |
| Remover entrada ou exportação; incrementar o `version` do formato de um arquivo JSON de `./meta/*` | major |
| Adicionar token, marca, entrada ou exportação; acrescentar camada no fim de `layerOrder` | minor |
| Depreciar token (`deprecated` deixa de ser `false`) | minor |
| Mudar `axis` de um token, ou `placement` de `brand-exclusive` para `base` ou `brand` | minor |
| Nenhuma mudança no relatório | patch (mudanças de valor seguem o changelog e a regressão visual) |

### 11.3 Relação com FR-009 e SC-005

Adicionar uma marca altera a superfície pública (`Brand`, `brands` e a lista de arquivos de marca),
então o relatório regenerado muda. A checagem de diff do FR-009 e do SC-005 DEVE aceitar, além de
`packages/tokens/src/**`, o `packages/tokens/api/tokens.api.json` regenerado, artefato derivado da
fonte que nunca é editado à mão. É arquivo de tokens no sentido do TOK-07, conforme a seção
Clarifications do spec (FR-009, SC-005).

## 12. Premissas e pendências

Premissas usadas, sem decidir questão em aberto do requerente:

- Marcas sintéticas `a` e `b` até a entrega das marcas reais; marca padrão indicada pelo requerente
  (CMP-24); modo padrão `light`.
- Prefixo `<prefixo>` (TODO(PREFIXO)); licença `UNLICENSED` como marcador (premissa do ENG-22).
- TypeScript 6.0 como valor provisório do piso e 7.0 como mais recente; Node 22 LTS como piso de
  `engines` (premissa "Node em LTS", D2).
- Versão única dos pacotes publicados (premissa do GOV-01).
- Plataforma de CI: GitHub Actions, inferida do ENG-18 (D2).

Pendências:

- **P-01** Nome do arquivo de avisos de terceiros (`THIRD-PARTY-NOTICES.md` é provisório) e local da
  allowlist versionada do ENG-17, a fixar com a feature de CI e publicação.
- **P-02** O relatório de API usa formato próprio; se a feature de CI e publicação adotar um formato
  comum para todos os pacotes, este relatório migra sem mudar a classificação da §11.2.
- **P-03** Decidida no spec (Clarifications): o relatório de API regenerado é arquivo de tokens e
  entra na checagem de diff do FR-009 e do SC-005 (§11.3).
