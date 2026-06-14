// Token Model v2 → CSS custom properties (docs/33-token-model-v2.md §6).
//
// Emits the canonical `--st-*` vocabulary from a compiled token set, plus:
//   • derived expressions (hover/active/tint, text tiers) as `color-mix(in
//     oklab …)` referencing the canonical base vars — no precompute needed,
//   • a `--st-space-*` scale derived from `--st-space-base`,
//   • depth-scaled shadow vars,
//   • LEGACY ALIASES (`--st-bg`, `--st-surface`, `--st-radius`, …) mapping the
//     names today's storefront.css reads onto the canonical vars. The aliases
//     are `var()` references, so they follow each canonical var's per-mode
//     value automatically. §4 refactors storefront.css onto the canonical names
//     and these aliases go away.

import type { CompiledColorTokensV2, CompiledThemeV2, SharedTokensV2 } from './types';

// Named container widths → the CSS length they compile to (a raw length passes
// through unchanged).
const CONTAINER_WIDTHS: Record<string, string> = {
  narrow: '52rem',
  medium: '72rem',
  wide: '90rem',
  full: '100%',
};

// The --st-space-N scale (Tailwind-aligned multiples of the base unit). Each is
// a calc() off --st-space-base, so shifting the base reflows the whole site.
const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;

function fontStack(name: string): string {
  return `'${name.replace(/'/g, '')}', var(--st-font-fallback)`;
}

function containerLength(width: string): string {
  return CONTAINER_WIDTHS[width] ?? width;
}

/** Canonical per-mode color vars (base + every resolved `-content`). */
export function colorVars(c: CompiledColorTokensV2): Record<string, string> {
  return {
    '--st-base-100': c.base100,
    '--st-base-200': c.base200,
    '--st-base-300': c.base300,
    '--st-base-content': c.baseContent,
    '--st-primary': c.primary,
    '--st-primary-content': c.primaryContent,
    '--st-secondary': c.secondary,
    '--st-secondary-content': c.secondaryContent,
    '--st-accent': c.accent,
    '--st-accent-content': c.accentContent,
    '--st-neutral': c.neutral,
    '--st-neutral-content': c.neutralContent,
    '--st-info': c.info,
    '--st-info-content': c.infoContent,
    '--st-success': c.success,
    '--st-success-content': c.successContent,
    '--st-warning': c.warning,
    '--st-warning-content': c.warningContent,
    '--st-danger': c.danger,
    '--st-danger-content': c.dangerContent,
    '--st-highlight': c.highlight,
    '--st-highlight-content': c.highlightContent,
    '--st-border': c.border,
  };
}

/** Shared (mode-independent) vars: type, shape, rhythm scale, depth, container,
 *  derived color expressions, and the legacy aliases. */
export function sharedVars(s: SharedTokensV2): Record<string, string> {
  const out: Record<string, string> = {
    // Type
    '--st-font-heading': fontStack(s.fontHeading),
    '--st-font-body': fontStack(s.fontBody),
    // Shape
    '--st-radius-selector': s.radiusSelector,
    '--st-radius-field': s.radiusField,
    '--st-radius-box': s.radiusBox,
    '--st-border-width': s.borderWidth,
    // Rhythm
    '--st-space-base': s.spaceBase,
    '--st-size-field': s.sizeField,
    '--st-size-selector': s.sizeSelector,
    // Effect
    '--st-depth': String(s.depth),
    // Layout
    '--st-container': containerLength(s.containerWidth),
  };

  for (const n of SPACE_STEPS) {
    out[`--st-space-${n}`] = `calc(var(--st-space-base) * ${n})`;
  }

  // Derived color expressions (follow the per-mode canonical vars).
  out['--st-primary-hover'] = 'color-mix(in oklab, var(--st-primary) 86%, black)';
  out['--st-primary-active'] = 'color-mix(in oklab, var(--st-primary) 74%, black)';
  out['--st-primary-tint'] = 'color-mix(in oklab, var(--st-primary) 8%, transparent)';
  out['--st-accent-tint'] = 'color-mix(in oklab, var(--st-accent) 8%, transparent)';
  out['--st-highlight-tint'] = 'color-mix(in oklab, var(--st-highlight) 8%, transparent)';

  // Depth-scaled shadows (override storefront.css's hardcoded set).
  out['--st-shadow-sm'] =
    '0 1px 2px rgb(0 0 0 / calc(0.04 * var(--st-depth))), 0 1px 3px rgb(0 0 0 / calc(0.06 * var(--st-depth)))';
  out['--st-shadow-md'] =
    '0 4px 12px -2px rgb(0 0 0 / calc(0.08 * var(--st-depth))), 0 2px 6px -2px rgb(0 0 0 / calc(0.05 * var(--st-depth)))';
  out['--st-shadow-lg'] = '0 18px 40px -12px rgb(0 0 0 / calc(0.18 * var(--st-depth)))';

  // ── Legacy aliases (removed in §4) ──────────────────────────────────────
  out['--st-bg'] = 'var(--st-base-100)';
  out['--st-surface'] = 'var(--st-base-200)';
  out['--st-bg-subtle'] = 'var(--st-base-300)';
  out['--st-text'] = 'var(--st-base-content)';
  out['--st-text-secondary'] =
    'color-mix(in oklab, var(--st-base-content) 78%, var(--st-base-100))';
  out['--st-text-muted'] = 'color-mix(in oklab, var(--st-base-content) 55%, var(--st-base-100))';
  out['--st-text-tertiary'] = 'color-mix(in oklab, var(--st-base-content) 40%, var(--st-base-100))';
  out['--st-on-primary'] = 'var(--st-primary-content)';
  out['--st-border-strong'] = 'color-mix(in oklab, var(--st-border), var(--st-base-content) 35%)';
  out['--st-radius'] = 'var(--st-radius-box)';
  out['--st-radius-sm'] = 'var(--st-radius-field)';
  out['--st-radius-lg'] = 'var(--st-radius-box)';
  out['--st-max'] = 'var(--st-container)';

  return out;
}

/** Merged shared + one mode's colors — convenient for a single :root injection
 *  when dark mode isn't being split out. */
export function compiledToCssVars(
  compiled: CompiledThemeV2,
  mode: 'light' | 'dark'
): Record<string, string> {
  return { ...sharedVars(compiled.shared), ...colorVars(compiled[mode]) };
}

function declBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}

export interface BuildThemeCssOptions {
  /** Selector for the light/shared block. Default `:root`. */
  rootSelector?: string;
}

/**
 * Build the full storefront theme stylesheet: shared + light at :root, dark
 * colors under an explicit `[data-theme="dark"]` opt-in AND the system
 * preference (unless the user forced light). Shared vars are emitted once.
 */
export function buildThemeCssV2(
  compiled: CompiledThemeV2,
  opts: BuildThemeCssOptions = {}
): string {
  const root = opts.rootSelector ?? ':root';
  const light = declBlock({ ...sharedVars(compiled.shared), ...colorVars(compiled.light) });
  const dark = declBlock(colorVars(compiled.dark));
  return [
    `${root}{${light}}`,
    `${root}[data-theme="dark"]{${dark}}`,
    `@media (prefers-color-scheme:dark){${root}:not([data-theme="light"]){${dark}}}`,
  ].join('');
}
