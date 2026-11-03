// Negative type assertions (QA-08, ENG-05): each `@ts-expect-error` must be consumed by a real
// compile error — an unused directive is itself a TS error (TS2578), so this file fails the build
// if the published types ever stop rejecting a bad token, brand, or mode. Run under both
// moduleResolution modes and both TypeScript majors by scripts/check.mjs.
import { tokens, type TokenName } from '@patods/tokens'
import { values, type Brand, type Mode } from '@patods/tokens/values'

// --- Nonexistent token ---
// @ts-expect-error — 'not.a.token' is not a key of the token map
const badToken: TokenName = 'not.a.token'
// @ts-expect-error — property does not exist on the frozen token map
tokens['not.a.token']

// --- Nonexistent brand ---
// @ts-expect-error — 'c' is not a Brand
const badBrand: Brand = 'c'
// @ts-expect-error — the values map has no 'c' brand
values['c']

// --- Nonexistent mode ---
// @ts-expect-error — 'sepia' is not a Mode
const badMode: Mode = 'sepia'
// @ts-expect-error — brand 'a' has no 'sepia' mode
values.a['sepia']

// Reference the typed bindings so the directives above are the only diagnostics in play.
export { badToken, badBrand, badMode }
