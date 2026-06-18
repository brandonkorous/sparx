// Brand "shape & feel" presets (Token Model v2 brand-owned shape/rhythm/effect,
// docs/33). The Brand pane exposes these as a few approachable knobs rather than
// raw CSS lengths: Corners drives the three radii together, plus border weight,
// spacing rhythm, control size, and depth. They serialize into the brand
// `tokens` JSONB (shape/rhythm/effect branches) and compile through
// `compileThemeForTenant` exactly like the storefront does.
//
// Semantics: an UNSET knob (sentinel '') means "inherit the theme preset" — we
// omit that branch from the doc so the brand never silently pins a default. A
// set knob WINS over the preset (brand owns shape/rhythm/effect).

import type { BrandTokenDoc } from '@sparx/site-themes';

export type BrandTokens = Pick<BrandTokenDoc, 'shape' | 'rhythm' | 'effect'>;

export const UNSET = '';

// Corner roundness → the three radii at once (selector = pills/badges, field =
// inputs/buttons, box = cards/panels). The scale rounds the FIELD radius (the
// most prominent control) in lockstep with the selector, so each step reads
// clearly on buttons; "Pill" takes both fully round (a true pill button/input),
// while cards (box) cap at a generous finite radius — a card can't be a pill.
export const CORNER_OPTIONS = [
  { key: 'sharp', label: 'Sharp', selector: '0px', field: '0px', box: '0px' },
  { key: 'subtle', label: 'Subtle', selector: '0.25rem', field: '0.25rem', box: '0.375rem' },
  { key: 'rounded', label: 'Rounded', selector: '0.5rem', field: '0.5rem', box: '0.75rem' },
  { key: 'soft', label: 'Soft', selector: '0.75rem', field: '0.75rem', box: '1rem' },
  { key: 'pill', label: 'Pill', selector: '9999px', field: '9999px', box: '1.5rem' },
] as const;

// Per-axis corner scale (daisyUI parity, docs/33 §3). Each of the THREE radius
// tokens is dialed INDEPENDENTLY from this one shared scale, so an author can set
// e.g. boxes = XL while fields stay Pill — instead of the bundled CORNER_OPTIONS
// presets above (kept for back-compat). The key IS the CSS value (mirrors
// BORDER_OPTIONS), so the control writes it straight onto the token. Every
// site-ui component reads its matching `--st-radius-{box,field,selector}`, so a
// change here cascades to all of them; per-node `rounded-*` classes still override.
export const RADIUS_SCALE = [
  { key: '0px', label: 'None' },
  { key: '0.25rem', label: 'XS' },
  { key: '0.5rem', label: 'Small' },
  { key: '0.75rem', label: 'Medium' },
  { key: '1rem', label: 'Large' },
  { key: '1.5rem', label: 'XL' },
  { key: '9999px', label: 'Pill' },
] as const;

export const BORDER_OPTIONS = [
  { key: '0px', label: 'None' },
  { key: '1px', label: 'Hairline' },
  { key: '1.5px', label: 'Thin' },
  { key: '2px', label: 'Bold' },
] as const;

export const SPACING_OPTIONS = [
  { key: '0.2rem', label: 'Compact' },
  { key: '0.25rem', label: 'Default' },
  { key: '0.3rem', label: 'Roomy' },
] as const;

// Control size → field (inputs/buttons) + selector (pills/toggles) heights.
// LEGACY combined preset (kept for back-compat); the live controls now dial
// `--st-size-field` / `--st-size-selector` independently from SIZE_SCALE below.
export const SIZE_OPTIONS = [
  { key: 'sm', label: 'Small', field: '2.25rem', selector: '1.75rem' },
  { key: 'md', label: 'Default', field: '2.5rem', selector: '2rem' },
  { key: 'lg', label: 'Large', field: '2.75rem', selector: '2.25rem' },
] as const;

// Per-group control-SIZE base unit (daisyUI parity, docs/33 §3). Field components
// (button/input/select/tab) and selector components (checkbox/toggle/badge) each
// multiply their own base unit, dialed independently. 0.25rem = the default that
// reproduces every component's stock size; the steps scale it 75%…125%.
export const SIZE_SCALE = [
  { key: '0.1875rem', label: 'XS' },
  { key: '0.21875rem', label: 'Small' },
  { key: '0.25rem', label: 'Default' },
  { key: '0.28125rem', label: 'Large' },
  { key: '0.3125rem', label: 'XL' },
] as const;

export const DEPTH_OPTIONS = [
  { key: '0', label: 'Flat', depth: 0 },
  { key: '0.5', label: 'Subtle', depth: 0.5 },
  { key: '1', label: 'Default', depth: 1 },
  { key: '1.5', label: 'Lifted', depth: 1.5 },
  { key: '2', label: 'Dramatic', depth: 2 },
] as const;

// Which Corners preset the stored radii currently match (else UNSET).
export function cornerKeyOf(tokens: BrandTokens): string {
  const s = tokens.shape;
  if (!s) return UNSET;
  const hit = CORNER_OPTIONS.find(
    (o) => o.selector === s.radiusSelector && o.field === s.radiusField && o.box === s.radiusBox
  );
  return hit?.key ?? UNSET;
}

// Which Control-size preset the stored sizes currently match (else UNSET).
export function sizeKeyOf(tokens: BrandTokens): string {
  const r = tokens.rhythm;
  if (!r) return UNSET;
  const hit = SIZE_OPTIONS.find((o) => o.field === r.sizeField && o.selector === r.sizeSelector);
  return hit?.key ?? UNSET;
}

// Resolved feel for the live board preview — brand value → a sensible default
// so a half-set brand never renders broken samples.
export interface ResolvedFeel {
  radiusSelector: string;
  radiusField: string;
  radiusBox: string;
  borderWidth: string;
  depth: number;
}

const DEFAULTS: ResolvedFeel = {
  radiusSelector: '9999px',
  radiusField: '0.5rem',
  radiusBox: '0.75rem',
  borderWidth: '1px',
  depth: 1,
};

export function resolveFeel(tokens: BrandTokens): ResolvedFeel {
  return {
    radiusSelector: tokens.shape?.radiusSelector ?? DEFAULTS.radiusSelector,
    radiusField: tokens.shape?.radiusField ?? DEFAULTS.radiusField,
    radiusBox: tokens.shape?.radiusBox ?? DEFAULTS.radiusBox,
    borderWidth: tokens.shape?.borderWidth ?? DEFAULTS.borderWidth,
    depth: tokens.effect?.depth ?? DEFAULTS.depth,
  };
}

// A box-shadow expressing the depth multiplier (mirrors the storefront's
// --st-shadow-md scaling so the board reads like the real card shadow).
export function depthShadow(depth: number): string | undefined {
  if (depth <= 0) return undefined;
  return `0 4px 12px -2px rgb(0 0 0 / ${0.08 * depth}), 0 2px 6px -2px rgb(0 0 0 / ${0.05 * depth})`;
}

// Strip empty branches so an all-unset feel serializes to `null` (clears the
// column) rather than `{ shape:{}, rhythm:{}, effect:{} }`. Stamps `v: 2` so the
// result is a complete BrandTokenDoc the brand PATCH accepts.
export function cleanTokens(tokens: BrandTokens): BrandTokenDoc | null {
  const shape = pruned(tokens.shape);
  const rhythm = pruned(tokens.rhythm);
  const effect = tokens.effect?.depth != null ? tokens.effect : undefined;
  if (!shape && !rhythm && !effect) return null;
  return {
    v: 2,
    ...(shape ? { shape } : {}),
    ...(rhythm ? { rhythm } : {}),
    ...(effect ? { effect } : {}),
  };
}

function pruned<T extends Record<string, unknown>>(obj: T | undefined): T | undefined {
  if (!obj) return undefined;
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}
