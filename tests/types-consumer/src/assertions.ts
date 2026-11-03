// Positive type assertions (QA-08, ENG-05, FR-016): the published .d.ts must expose the
// token map as precise string literals, and the values map keyed by the Brand/Mode unions.
// Compiled under both moduleResolution modes and both TypeScript majors by scripts/check.mjs.
import { expectTypeOf } from 'expect-type'
import { tokens, type TokenName } from '@patods/tokens'
import { values, type Brand, type Mode } from '@patods/tokens/values'

// Each token resolves to its exact `var(--patods-…)` string literal, not a widened `string`.
expectTypeOf(tokens['space.4']).toEqualTypeOf<'var(--patods-space-4)'>()
expectTypeOf(tokens['color.bg.surface']).toEqualTypeOf<'var(--patods-color-bg-surface)'>()
expectTypeOf(tokens['radius.md']).toEqualTypeOf<'var(--patods-radius-md)'>()

// Every value in the map is a `var(--patods-…)` custom-property reference, not a widened string.
expectTypeOf<(typeof tokens)[TokenName]>().toExtend<`var(--patods-${string})`>()

// TokenName is a string-literal union of real keys: a real key is a member (and `toEqualTypeOf`
// is avoided here — it mis-reports on this 60+ member union; `.branded` would be the escape hatch).
const realName: TokenName = 'space.4'
expectTypeOf(realName).toExtend<string>()
expectTypeOf<'space.4'>().toExtend<TokenName>()
expectTypeOf<'radius.md'>().toExtend<TokenName>()

// Brand/Mode are the orthogonal axis unions (values.d.ts).
expectTypeOf<Brand>().toEqualTypeOf<'a' | 'b'>()
expectTypeOf<Mode>().toEqualTypeOf<'dark' | 'light'>()

// values is Readonly<Record<Brand, Record<Mode, Record<string, string>>>>: every cell is a string.
expectTypeOf(values).toEqualTypeOf<Readonly<Record<Brand, Record<Mode, Record<string, string>>>>>()
expectTypeOf(values.a.light).toEqualTypeOf<Record<string, string>>()
expectTypeOf(values.b.dark).toEqualTypeOf<Record<string, string>>()
