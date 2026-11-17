// Naming vocabularies (token-source.md section 8, TOK-04). Single source in code for the closed word lists of
// the name grammar. docs/tokens/convencao-de-nomes.md documents them and `repo-checks naming-doc` fails when
// the document and this module diverge (Principle I: one source per fact).
import { CATEGORIES } from './model.ts'

export { CATEGORIES }

/** Segment pattern (section 8.1), as source text so the document can be compared literally. */
export const SEGMENT_PATTERN_SOURCE = '^[a-z0-9]+(-[a-z0-9]+)*$'

/** Reserved root group (section 8.5). */
export const RESERVED_GROUPS = ['brand'] as const

/** Mode ids: an axis, never a name segment except the last of `brand.*` (section 8.5). */
export const MODE_IDS = ['light', 'dark'] as const

/** Component ids that are forbidden (section 8.5). */
export const RESERVED_COMPONENT_IDS = ['control'] as const

/** Size scale SZ, ordered ascending (section 8.4). */
export const SZ = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const

/** States (section 8.4), shared with the contrast manifest and the FR-021 pairs rule. */
export const STATES = [
  'default',
  'hover',
  'active',
  'focus-visible',
  'selected',
  'invalid',
  'disabled',
  'inactive',
] as const

/** Variants: the SZ words plus the semantic variants (section 8.4). Disjoint from STATES. */
export const VARIANTS = [
  ...SZ,
  'subtle',
  'strong',
  'inverse',
  'primary',
  'secondary',
  'tertiary',
  'neutral',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
] as const

/** Non-numeric primitive step words besides SZ (section 8.4). */
export const STEP_WORDS = ['full', 'none'] as const

/** Marker used in ROLES for "every SZ word". */
export const SZ_REF = 'SZ'

/** Properties allowed in the semantic layer, per category (section 8.3). */
export const SEMANTIC_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  color: ['bg', 'fg', 'border'],
  typography: ['text', 'family', 'weight', 'size', 'line-height', 'letter-spacing'],
  space: ['inset', 'stack', 'inline'],
  size: ['control', 'icon', 'container'],
  radius: ['control', 'container', 'indicator'],
  border: ['width', 'style', 'stroke'],
  shadow: ['elevation', 'focus'],
  motion: ['duration', 'easing', 'transition'],
  'z-index': ['layer'],
  breakpoint: ['viewport', 'container'],
  opacity: ['state', 'overlay'],
}

/** Properties allowed in the component layer, per category (section 8.3). */
export const COMPONENT_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  color: ['bg', 'fg', 'border'],
  typography: ['text', 'family', 'weight', 'size', 'line-height', 'letter-spacing'],
  space: ['inset', 'stack', 'inline'],
  size: ['control-height', 'height', 'width', 'min-width', 'icon'],
  radius: [],
  border: ['width', 'style', 'stroke'],
  shadow: [],
  motion: ['duration', 'easing', 'transition'],
  'z-index': [],
  breakpoint: [],
  opacity: [],
}

/** Roles of the semantic layer, per `category.property` (`*` = every property); SZ_REF expands to SZ. */
export const ROLES: Readonly<Record<string, readonly string[]>> = {
  'color.bg': ['surface', 'raised', 'sunken', 'overlay', 'inverse', 'accent', 'neutral', 'success', 'warning', 'danger', 'info', 'scrim'],
  'color.fg': ['default', 'muted', 'subtle', 'inverse', 'accent', 'on-accent', 'link', 'success', 'warning', 'danger', 'info'],
  'color.border': ['default', 'muted', 'strong', 'focus', 'inverse', 'accent', 'success', 'warning', 'danger', 'info'],
  'typography.*': ['display', 'heading', 'title', 'body', 'label', 'caption', 'code'],
  'space.*': ['none', SZ_REF],
  'size.control': [SZ_REF],
  'size.icon': [SZ_REF],
  'size.container': [SZ_REF],
  'radius.*': ['none', 'default', 'full', SZ_REF],
  'border.*': ['default', 'strong', 'focus', 'divider'],
  'shadow.elevation': ['raised', 'floating', 'overlay', 'modal'],
  'shadow.focus': ['default', 'inset'],
  'motion.duration': ['instant', 'fast', 'moderate', 'slow'],
  'motion.easing': ['standard', 'enter', 'exit', 'emphasized'],
  'motion.transition': ['fade', 'slide', 'scale'],
  'z-index.layer': ['base', 'raised', 'dropdown', 'sticky', 'overlay', 'modal', 'popover', 'toast', 'tooltip'],
  'breakpoint.*': [SZ_REF],
  'opacity.state': ['hover', 'active', 'disabled'],
  'opacity.overlay': ['scrim', 'backdrop'],
}

/**
 * Registry consumed by `repo-checks naming-doc`. Key = block id used in the document's
 * `<!-- vocab:ID -->` markers. A string[] is a flat word list; a Record maps a key to its words.
 */
export const VOCABULARIES: Readonly<Record<string, readonly string[] | Readonly<Record<string, readonly string[]>>>> = {
  categories: CATEGORIES,
  'reserved-groups': RESERVED_GROUPS,
  'segment-pattern': [SEGMENT_PATTERN_SOURCE],
  sz: SZ,
  states: STATES,
  variants: VARIANTS,
  'step-words': STEP_WORDS,
  'mode-ids': MODE_IDS,
  'reserved-component-ids': RESERVED_COMPONENT_IDS,
  'semantic-properties': SEMANTIC_PROPERTIES,
  'component-properties': COMPONENT_PROPERTIES,
  roles: ROLES,
}

/** Block ids whose word order is part of the contract (SZ is ordered). */
export const ORDERED_VOCABULARIES: readonly string[] = ['sz']
