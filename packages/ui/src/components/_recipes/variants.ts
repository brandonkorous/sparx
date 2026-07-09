// Shared color vocabulary for color-bearing components (docs/35 §4).
//
// The `color` axis is a semantic slot name that maps 1:1 to silicaui's
// registered plugin colors: a component emits `${base}-${color}` (e.g.
// `btn-primary`, `badge-success`, `alert-danger`) and silicaui's plugin — which
// statically emits every color/component utility for the colors registered in
// each app's `@plugin '@wizeworks/silicaui'` config — styles it. `danger` and
// `module` are registered alongside the silica defaults, so `*-danger` (the
// statusTone vocabulary) and `*-module` (the active-<ModuleProvider> hue) both
// resolve. There is no sparx role-var recipe anymore — the treatment (`variant`)
// classes are silicaui's own (`btn-soft`, `badge-outline`, …).

/** The known semantic color slots. Components type `color` as
 *  `ColorKey | (string & {})` so a runtime custom-color name is still accepted
 *  (it emits `${base}-${color}`, styled once a matching plugin color exists)
 *  while keeping autocomplete for the known set. */
export const COLOR_KEYS = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
  'module',
] as const;

/** Per-module brand colors, addressable directly as a `color` slot (independent
 *  of the active ModuleProvider). Backed by `--color-module-{name}` in
 *  @sparx/brand; a direct `color="cms"` is a showcase/demo affordance — feature
 *  code wraps the region in `<ModuleProvider module="cms">` and uses
 *  `color="module"` instead. */
export const MODULE_COLOR_KEYS = [
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'invoicing',
  'ai',
  'dropship',
  'inventory',
  'chat',
  'scheduling',
  'automations',
  'seo',
] as const;

export type SemanticColorKey = (typeof COLOR_KEYS)[number];
export type ModuleColorKey = (typeof MODULE_COLOR_KEYS)[number];
export type ColorKey = SemanticColorKey | ModuleColorKey;

/** Every known color slot (semantic + per-module), for showcases/iteration. */
export const ALL_COLOR_KEYS: readonly ColorKey[] = [...COLOR_KEYS, ...MODULE_COLOR_KEYS];

/** The treatment (`variant`) axis vocabulary — the same set silicaui exposes.
 *  Each component maps these to its own silicaui modifier (`btn-soft`,
 *  `badge-outline`, …); `solid` is silicaui's default (no modifier class). */
export const TREATMENT_KEYS = ['solid', 'soft', 'outline', 'dashed', 'ghost', 'link'] as const;
export type TreatmentKey = (typeof TREATMENT_KEYS)[number];

/** Resolve a color slot to its silicaui token var + matching on-color content
 *  var. For Radix-based controls (Checkbox / Radio / Switch) whose checked or
 *  selected state must be set as a CSS *value* rather than a static utility
 *  class, so the accent can be driven off a per-instance custom property. The
 *  semantic slots resolve to `--color-<slot>`; the per-module slots to
 *  `--color-module-<slot>`; `module` (the active-ModuleProvider slot) resolves
 *  to `--color-module`. */
export function colorVars(color: string): { sel: string; selFg: string } {
  const isModule = (MODULE_COLOR_KEYS as readonly string[]).includes(color);
  const base = isModule ? `--color-module-${color}` : `--color-${color}`;
  const fg = isModule ? '--color-module-content' : `--color-${color}-content`;
  return { sel: `var(${base})`, selFg: `var(${fg}, #fff)` };
}
