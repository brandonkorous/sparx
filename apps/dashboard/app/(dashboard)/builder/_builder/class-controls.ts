// Phase C control registry (docs/47 §11): the structured colour / variant
// selectors shown in the inspector's Style panel. Each control owns a
// mutually-exclusive class group on `node.class`; reading & writing go through
// the pure class-group helpers in @sparx/builder-schemas.
//
// The vocabulary MIRRORS @sparx/site-ui's recipe (COLOR_KEYS / treatmentVariants,
// docs/46 §3.6) and is hardcoded here exactly like the other inspector option
// tables (model.ts: SURFACE_OPTIONS, GAP_OPTIONS, …). It is a versioned class
// contract (docs/47 §7) — keep it in sync if the recipe gains a slot.

import { readClassGroup, setClassGroup } from '@sparx/builder-schemas';

export interface ClassOption {
  value: string;
  label: string;
  /** The class token this option writes (e.g. `sf-c-primary`). */
  token: string;
}

export interface ClassControl {
  id: string;
  label: string;
  options: ClassOption[];
}

// Recipe vocabulary (docs/46 §3.6). `surface` is the neutral page-surface slot.
const COLOR_KEYS = [
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

const TREATMENT_KEYS = ['solid', 'soft', 'outline', 'dashed', 'ghost', 'link', 'glass'] as const;

// The shared xs…xl size steps (docs/46 §3.6, docs/47 §11). Element-namespaced in
// the recipe (e.g. a Button's size class is `sf-btn--sz-md`); `archetypeSizeBase`
// reads the prefix off a node's archetype so one control drives whatever element
// it's editing. Only shown when the node's archetype carries a size token.
const SIZE_KEYS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const SIZE_LABELS: Record<string, string> = {
  xs: 'XS',
  sm: 'S',
  md: 'M',
  lg: 'L',
  xl: 'XL',
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const COLOR_CONTROL: ClassControl = {
  id: 'color',
  label: 'Color',
  options: COLOR_KEYS.map((k) => ({ value: k, label: cap(k), token: `sf-c-${k}` })),
};

export const VARIANT_CONTROL: ClassControl = {
  id: 'variant',
  label: 'Variant',
  options: TREATMENT_KEYS.map((k) => ({ value: k, label: cap(k), token: `sf-v-${k}` })),
};

/** The controls rendered, in order, in the inspector's everyday Style panel. */
export const STYLE_CONTROLS: ClassControl[] = [COLOR_CONTROL, VARIANT_CONTROL];

const groupTokens = (control: ClassControl): string[] => control.options.map((o) => o.token);

/** The element prefix of a node's size axis (e.g. `sf-btn` from `sf-btn--sz-md`),
 *  or null when the archetype has no size step. Lets one Size control target
 *  whatever element it's editing without a per-component control table. */
function archetypeSizeBase(archetype: string | undefined): string | null {
  for (const token of (archetype ?? '').split(/\s+/)) {
    const m = /^(.+)--sz-[a-z]+$/.exec(token);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** The Size control for a node — its options write the node's own element-scoped
 *  size token (`<base>--sz-<step>`), or null when the node's archetype has no size
 *  axis (so the control is hidden rather than writing a meaningless class). */
export function sizeControlFor(archetype: string | undefined): ClassControl | null {
  const base = archetypeSizeBase(archetype);
  if (!base) return null;
  return {
    id: 'size',
    label: 'Size',
    options: SIZE_KEYS.map((k) => ({
      value: k,
      label: SIZE_LABELS[k] ?? k.toUpperCase(),
      token: `${base}--sz-${k}`,
    })),
  };
}

// Universal utilities — Tailwind-NATIVE class names (docs/61 §11), the same a power
// user or AI would type, compiled to the tenant `--sf-*` tokens by @sparx/surface-compile
// and rendered live in the canvas (useSurfacePreview). Corners/spacing/shadow therefore
// track the brand scale (`--sf-radius-*` / `--sf-space-base` / `--sf-shadow-*`), not
// hardcoded values. These write the same class on any node, shared across all archetypes.
// (The bespoke `sf-radius-*` / `sf-m-*` / … util-box dialect is retired — docs/61 §11.)
export const RADIUS_CONTROL: ClassControl = {
  id: 'radius',
  label: 'Corners',
  options: [
    { value: 'none', label: 'Square', token: 'rounded-none' },
    { value: 'sm', label: 'Small', token: 'rounded-field' },
    { value: 'md', label: 'Medium', token: 'rounded-box' },
    { value: 'lg', label: 'Large', token: 'rounded-2xl' },
    { value: 'pill', label: 'Pill', token: 'rounded-full' },
  ],
};

export const MARGIN_CONTROL: ClassControl = {
  id: 'margin',
  label: 'Margin',
  options: [
    { value: 'none', label: 'None', token: 'm-0' },
    { value: 'sm', label: 'S', token: 'm-2' },
    { value: 'md', label: 'M', token: 'm-4' },
    { value: 'lg', label: 'L', token: 'm-8' },
    { value: 'xl', label: 'XL', token: 'm-16' },
  ],
};

export const BORDER_CONTROL: ClassControl = {
  id: 'border',
  label: 'Border',
  options: [
    { value: 'none', label: 'None', token: 'border-0' },
    { value: 'thin', label: 'Hairline', token: 'border' },
    { value: 'strong', label: 'Strong', token: 'border-2' },
  ],
};

export const SHADOW_CONTROL: ClassControl = {
  id: 'shadow',
  label: 'Shadow',
  options: [
    { value: 'none', label: 'None', token: 'shadow-none' },
    { value: 'sm', label: 'Small', token: 'shadow-sm' },
    { value: 'md', label: 'Medium', token: 'shadow-md' },
    { value: 'lg', label: 'Large', token: 'shadow-lg' },
  ],
};

/** The advanced (collapsed) style controls applicable to a node, in order: the
 *  element-scoped Size (when the archetype has one) then the universal box
 *  utilities (corners / border / shadow). Spacing + position land here as the
 *  recipe gains their token classes (docs/47). The raw `class` textarea — the
 *  final escape hatch — is rendered alongside these by the inspector. */
export function advancedControlsFor(archetype: string | undefined): ClassControl[] {
  const out: ClassControl[] = [];
  const size = sizeControlFor(archetype);
  if (size) out.push(size);
  out.push(MARGIN_CONTROL, RADIUS_CONTROL, BORDER_CONTROL, SHADOW_CONTROL);
  return out;
}

/** The active option VALUE for a control given a node's class string, or null. */
export function activeValue(classStr: string | undefined, control: ClassControl): string | null {
  const token = readClassGroup(classStr, groupTokens(control));
  return token ? (control.options.find((o) => o.token === token)?.value ?? null) : null;
}

/** Apply an option value (or clear with null) → the new class string. */
export function applyValue(
  classStr: string | undefined,
  control: ClassControl,
  value: string | null
): string {
  const token = value ? (control.options.find((o) => o.value === value)?.token ?? null) : null;
  return setClassGroup(classStr, groupTokens(control), token);
}

/** The styling axis a recipe token belongs to (mutually-exclusive groups), or
 *  null for a structural BASE token like `sf-btn` (matched exactly, not by axis). */
function axisOf(token: string): string | null {
  if (token.startsWith('sf-c-')) return 'color';
  if (token.startsWith('sf-v-')) return 'variant';
  if (token.includes('--sz-')) return 'size';
  return null;
}

/**
 * Ensure a node keeps its archetype's structural base + a default for every
 * styling axis the author hasn't set (docs/47). When a Style control writes only
 * e.g. `sf-c-secondary` onto a node whose `class` predates class-first — a
 * template built before archetypes, so NO `sf-btn` base — the element collapses
 * to a bare, unstyled span. This merges in the archetype's base token(s) (e.g.
 * `sf-btn`) plus the default for any UNSET axis (variant, size), so a Button
 * stays a Button. Axes the author already set are left untouched; existing tokens
 * are preserved. No-op for nodes without an archetype (`archetype` undefined).
 */
export function ensureArchetypeDefaults(classStr: string, archetype: string | undefined): string {
  if (!archetype) return classStr;
  const tokens = classStr.split(/\s+/).filter(Boolean);
  const present = new Set(tokens);
  const setAxes = new Set(tokens.map(axisOf).filter((a): a is string => a !== null));
  const out = [...tokens];
  for (const token of archetype.split(/\s+/).filter(Boolean)) {
    const axis = axisOf(token);
    if (axis) {
      if (!setAxes.has(axis)) {
        out.push(token);
        setAxes.add(axis);
      }
    } else if (!present.has(token)) {
      out.push(token);
      present.add(token);
    }
  }
  return out.join(' ');
}
