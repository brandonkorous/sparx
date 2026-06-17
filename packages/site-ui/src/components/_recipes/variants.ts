// Shared variant vocabulary for color-bearing site-ui components — the --st-*
// analog of @sparx/ui's _recipes/variants.ts (docs/35 §4, docs/46 §3.6).
//
// THIS IS THE FOUNDATION: every color-bearing component (Button first, then any
// Badge/Chip/Alert/Callout) composes `color × variant (× size)` off this recipe
// rather than a flat enum. The `color` axis is a thin mapping to the
// `.st-c-{color}` role-var classes (recipes.css); the `variant` (treatment)
// classes are authored ONCE in CSS against the generic role vars (--c-bg /
// --c-fg / --c-ink / --c-hover / --c-tint), so color × variant composes
// automatically — no cartesian product, no codegen. A runtime custom color
// works as long as a matching `.st-c-<name>` rule exists.
//
// AXES. `color` × `style` (treatment) × `size` are the SHARED axes standardized
// here. Components add their own axes where they need them — e.g. Card's `modifier`
// (side / image-full) and, later, a `behavior` axis (link / hoverable) — plus PARTS
// (a card's body/title/actions). The shared three are the floor, not the ceiling
// (docs/47 §3).

/** The known semantic color slots for the tenant site. Components type
 *  `color` as `ColorKey | (string & {})` so a runtime custom-color name is
 *  still accepted (it maps to `st-c-${color}`) while keeping autocomplete.
 *  `surface` is the neutral page-surface slot (base-100 fill / base-content
 *  ink) — the light-glass / chrome case. site-ui has no module colors (those
 *  are sparx-admin only, in @sparx/ui). */
export const COLOR_KEYS = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
  'highlight',
  'surface',
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

/** `color` → role-var class for the known slots. A runtime-custom color is
 *  handled by `colorClass` directly (`st-c-${color}`). */
export const colorVariants = {
  primary: 'st-c-primary',
  secondary: 'st-c-secondary',
  accent: 'st-c-accent',
  neutral: 'st-c-neutral',
  info: 'st-c-info',
  success: 'st-c-success',
  warning: 'st-c-warning',
  danger: 'st-c-danger',
  highlight: 'st-c-highlight',
  surface: 'st-c-surface',
} as const satisfies Record<ColorKey, string>;

/** Resolve any color (known or runtime-custom) to its role-var class. */
export function colorClass(color: string | null | undefined): string {
  if (!color) return '';
  return `st-c-${color}`;
}

// ── Treatment (the `variant` axis) ─────────────────────────────────────────
// Each value is the semantic CSS class (authored once in recipes.css against
// the --c-* role vars). Mirrors @sparx/ui's treatmentVariants shape, but the
// class is a token-driven `st-v-*` rule rather than a Tailwind utility string.

/** Full treatment set — for Button-like components. `glass` frosts `--c-bg` at
 *  low alpha + backdrop-blur (the legibility scrim over photos; e.g. `glass` ×
 *  `neutral` = the old dark CTA, `glass` × `surface` = the old light CTA). */
export const treatmentVariants = {
  solid: 'st-v-solid',
  soft: 'st-v-soft',
  outline: 'st-v-outline',
  dashed: 'st-v-dashed',
  ghost: 'st-v-ghost',
  link: 'st-v-link',
  glass: 'st-v-glass',
} as const;

export type TreatmentKey = keyof typeof treatmentVariants;

/** Reduced treatment set for chips / badges (no link, no glass, no ghost). */
export const chipTreatmentVariants = {
  solid: treatmentVariants.solid,
  soft: treatmentVariants.soft,
  outline: treatmentVariants.outline,
  dashed: treatmentVariants.dashed,
} as const;

export type ChipTreatmentKey = keyof typeof chipTreatmentVariants;

/** Field treatment set — the field-appropriate `variant` axis shared by Input,
 *  Textarea, NativeSelect and FileInput. `outline` (the bordered default),
 *  `filled` (a subtle surface fill) and `ghost` (chromeless until focus) are the
 *  treatments that make sense for a control you type into; `solid`/`link`/`dashed`
 *  do not. Authored once in input.css as `.st-fv-*` against the role vars, so the
 *  fill/border is the SOLE source on the field element (the `.st-input`/`.st-file`
 *  base is structure only) and color × treatment composes like the buttons do. */
export const fieldTreatmentVariants = {
  outline: 'st-fv-outline',
  filled: 'st-fv-filled',
  ghost: 'st-fv-ghost',
} as const;

export type FieldTreatmentKey = keyof typeof fieldTreatmentVariants;

// ── Size scale ──────────────────────────────────────────────────────────────
// The shared size vocabulary, xs…xl. What each step MEANS dimensionally is
// component-specific (a button's padding ≠ a card's), defined in the component's
// CSS partial (e.g. `.st-btn--sz-md`, `.st-card--sz-md`).

export const SIZE_KEYS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type SizeKey = (typeof SIZE_KEYS)[number];
