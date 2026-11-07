// PatoDS Stylelint plugin. Exports the patods/design-tokens and patods/contrast-pairs rules, plus the
// stable sets of subcodes (lint-rules.md §2.1).
import designTokens, { designTokensCodes } from './design-tokens.ts'
import contrastPairs, { contrastPairsCodes } from './contrast-pairs.ts'

export { designTokensCodes, contrastPairsCodes }
export type { DesignTokensCode } from './design-tokens.ts'
export type { ContrastPairsCode } from './contrast-pairs.ts'

export default [designTokens, contrastPairs]
