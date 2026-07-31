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

/** The silicaui PLUGIN COLOR NAME for a color slot. The semantic slots are named
 *  identically on both sides (`success` → `success`); the per-module slots carry
 *  a `module-` prefix in the plugin (`commerce` → `module-commerce`), because
 *  that is how each app registers them in `@plugin '@wizeworks/silicaui'`.
 *
 *  Feeding this into a class (`bg-${pluginColor(c)}`) is the ONLY sanctioned way
 *  to color for a named module. It replaced `colorVars()`, which resolved a slot
 *  to a raw `var(--color-…)` string for a pair of `--sx-sel` custom properties —
 *  a second, sparx-only vocabulary for something the plugin already emits, and
 *  the last of the parallel token sets. See docs/implementation/st-token-retirement.md §7.
 *
 *  Prefer `<ModuleProvider module="…">` + `color="module"` over naming a module
 *  here: the provider works in every app, while `module-<name>` resolves only
 *  where that app registered the full module palette (workbench + web do; admin
 *  and site register only `module`). */
export function pluginColor(color: string): string {
  return (MODULE_COLOR_KEYS as readonly string[]).includes(color) ? `module-${color}` : color;
}
