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

// ── Skin families (docs/61 §5.2, Phase 3) — component-builder only ────────────
// The FULL appearance surface for a reusable component: free background/text color
// (beyond the recipe's color×variant), free type, and motion. Tokenized → every
// option resolves to a tenant `--sf-*` value at compile time. Gated to the
// component builder (the page builder gets a component's skin from its recipe, not
// per-instance re-skinning) and driven through the same single-token group model
// as every other control — so the context selector re-prefixes them for free.

export const BACKGROUND_CONTROL: ClassControl = {
  id: 'bg',
  label: 'Background',
  options: [
    { value: 'none', label: 'None', token: 'bg-transparent' },
    { value: 'page', label: 'Page', token: 'bg-base-100' },
    { value: 'subtle', label: 'Subtle', token: 'bg-base-200' },
    { value: 'muted', label: 'Muted', token: 'bg-base-300' },
    { value: 'primary', label: 'Primary', token: 'bg-primary' },
    { value: 'secondary', label: 'Secondary', token: 'bg-secondary' },
    { value: 'accent', label: 'Accent', token: 'bg-accent' },
    { value: 'neutral', label: 'Neutral', token: 'bg-neutral' },
  ],
};

export const TEXT_COLOR_CONTROL: ClassControl = {
  id: 'textColor',
  label: 'Text color',
  // No explicit base-content option — the control's empty "Default" already
  // inherits the base text color (an explicit `text-base-content` would just
  // duplicate it as a second "Default" entry). These are the overrides.
  options: [
    { value: 'primary', label: 'Primary', token: 'text-primary' },
    { value: 'on-primary', label: 'On primary', token: 'text-primary-content' },
    { value: 'on-neutral', label: 'On dark', token: 'text-neutral-content' },
    { value: 'white', label: 'White', token: 'text-white' },
    { value: 'black', label: 'Black', token: 'text-black' },
  ],
};

export const FONT_FAMILY_CONTROL: ClassControl = {
  id: 'fontFamily',
  label: 'Font',
  options: [
    { value: 'heading', label: 'Heading', token: 'font-heading' },
    { value: 'body', label: 'Body', token: 'font-body' },
  ],
};

// Distinct token namespace from TEXT_COLOR_CONTROL (text-sm vs text-primary) — the
// groups never overlap, so a node can carry both a size and a color independently.
export const FONT_SIZE_CONTROL: ClassControl = {
  id: 'fontSize',
  label: 'Text size',
  options: [
    { value: 'sm', label: 'S', token: 'text-sm' },
    { value: 'base', label: 'M', token: 'text-base' },
    { value: 'lg', label: 'L', token: 'text-lg' },
    { value: 'xl', label: 'XL', token: 'text-xl' },
    { value: '2xl', label: '2XL', token: 'text-2xl' },
    { value: '4xl', label: '4XL', token: 'text-4xl' },
    { value: '6xl', label: '6XL', token: 'text-6xl' },
  ],
};

export const FONT_WEIGHT_CONTROL: ClassControl = {
  id: 'fontWeight',
  label: 'Weight',
  options: [
    { value: 'normal', label: 'Normal', token: 'font-normal' },
    { value: 'medium', label: 'Medium', token: 'font-medium' },
    { value: 'semibold', label: 'Semibold', token: 'font-semibold' },
    { value: 'bold', label: 'Bold', token: 'font-bold' },
  ],
};

export const TRACKING_CONTROL: ClassControl = {
  id: 'tracking',
  label: 'Letter spacing',
  options: [
    { value: 'tight', label: 'Tight', token: 'tracking-tight' },
    { value: 'normal', label: 'Normal', token: 'tracking-normal' },
    { value: 'wide', label: 'Wide', token: 'tracking-wide' },
  ],
};

export const TEXT_CASE_CONTROL: ClassControl = {
  id: 'textCase',
  label: 'Case',
  options: [
    { value: 'normal', label: 'Normal', token: 'normal-case' },
    { value: 'upper', label: 'UPPER', token: 'uppercase' },
    { value: 'caps', label: 'Caps', token: 'capitalize' },
  ],
};

export const TRANSITION_CONTROL: ClassControl = {
  id: 'transition',
  label: 'Transition',
  options: [
    { value: 'none', label: 'None', token: 'transition-none' },
    { value: 'all', label: 'Smooth', token: 'transition' },
    { value: 'colors', label: 'Colors', token: 'transition-colors' },
    { value: 'transform', label: 'Transform', token: 'transition-transform' },
  ],
};

// Pairs with a state CONTEXT (Hover/Focus): set Transition (base) + Transform
// (Hover) for a smooth interactive effect. Bare at base = a static transform.
export const TRANSFORM_CONTROL: ClassControl = {
  id: 'transform',
  label: 'Transform',
  options: [
    { value: 'none', label: 'None', token: 'scale-100' },
    { value: 'grow', label: 'Grow', token: 'scale-105' },
    { value: 'shrink', label: 'Shrink', token: 'scale-95' },
    { value: 'up', label: 'Nudge up', token: '-translate-y-1' },
    { value: 'down', label: 'Nudge down', token: 'translate-y-1' },
  ],
};

// The custom entrance animations from the Surface theme (docs/61 §9) — base layer
// only (an entrance has no hover/breakpoint variant), so the panel hides it off-base.
export const ANIMATION_CONTROL: ClassControl = {
  id: 'animation',
  label: 'Entrance',
  options: [
    { value: 'none', label: 'None', token: 'animate-none' },
    { value: 'fade-in', label: 'Fade in', token: 'animate-fade-in' },
    { value: 'fade-up', label: 'Fade up', token: 'animate-fade-up' },
    { value: 'fade-down', label: 'Fade down', token: 'animate-fade-down' },
    { value: 'scale-in', label: 'Scale in', token: 'animate-scale-in' },
    { value: 'slide-left', label: 'Slide in left', token: 'animate-slide-in-left' },
    { value: 'slide-right', label: 'Slide in right', token: 'animate-slide-in-right' },
  ],
};

// ── Context (the responsive / state / theme layer a control writes into) ──────
// docs/61's "per-breakpoint editing via container queries, NOT iframe" + state/dark
// authoring. A context is just a Tailwind variant prefix; selecting one re-targets
// every control in its panel at that layer (`@lg:`, `hover:`, `dark:`).

export interface StyleContext {
  value: string;
  label: string;
  /** The Tailwind variant prefix (`hover:`, `@lg:`, `dark:`); '' for the base layer. */
  prefix: string;
}

export const BASE_CONTEXT: StyleContext = { value: 'base', label: 'Base', prefix: '' };

// Container-query breakpoints (key off the node's OWN width, docs/61 §7) — the
// same scale the box→class converter seeds (@2xl / @3xl / @4xl …).
const BREAKPOINT_CONTEXTS: StyleContext[] = ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'].map(
  (b) => ({ value: b, label: `@${b}`, prefix: `@${b}:` })
);

const STATE_CONTEXTS: StyleContext[] = [
  { value: 'hover', label: 'Hover', prefix: 'hover:' },
  { value: 'focus', label: 'Focus', prefix: 'focus:' },
  { value: 'active', label: 'Active', prefix: 'active:' },
];

const DARK_CONTEXT: StyleContext = { value: 'dark', label: 'Dark', prefix: 'dark:' };

/** Arrangement is responsive only (no hover/dark layout) — base + breakpoints. */
export const ARRANGEMENT_CONTEXTS: StyleContext[] = [BASE_CONTEXT, ...BREAKPOINT_CONTEXTS];

/** The full skin context set — base, interaction states, dark, and breakpoints. */
export const SKIN_CONTEXTS: StyleContext[] = [
  BASE_CONTEXT,
  ...STATE_CONTEXTS,
  DARK_CONTEXT,
  ...BREAKPOINT_CONTEXTS,
];

/** Look up a context by value (falls back to base). */
export function contextPrefix(contexts: StyleContext[], value: string): string {
  return contexts.find((c) => c.value === value)?.prefix ?? '';
}

/** The full appearance/skin controls for the component builder, in order. The
 *  entrance Animation is base-only (no variant), so it's dropped once a non-base
 *  context (a breakpoint / state / dark) is active. */
export function skinControlsFor(prefix: string): ClassControl[] {
  const out: ClassControl[] = [
    BACKGROUND_CONTROL,
    TEXT_COLOR_CONTROL,
    FONT_FAMILY_CONTROL,
    FONT_SIZE_CONTROL,
    FONT_WEIGHT_CONTROL,
    TRACKING_CONTROL,
    TEXT_CASE_CONTROL,
    RADIUS_CONTROL,
    BORDER_CONTROL,
    SHADOW_CONTROL,
    TRANSITION_CONTROL,
    TRANSFORM_CONTROL,
  ];
  if (prefix === '') out.push(ANIMATION_CONTROL);
  return out;
}

// ── Arrangement controls (docs/61 §5.2) ──────────────────────────────────────
// How a CONTAINER lays out its children. Tailwind-native, single-token groups —
// the same utilities a power user / AI writes. Per the arrange-vs-re-skin line
// these are the page-builder's structural surface (per-instance, no uniformity to
// protect); the SKIN families (corners / border / shadow / free type) stay gated
// to the component builder. `display` toggles flex↔grid; `direction` shows for
// flex, `columns` for grid (the inspector picks by the node's current `display`).

export const DISPLAY_CONTROL: ClassControl = {
  id: 'display',
  label: 'Layout',
  options: [
    { value: 'flex', label: 'Flex', token: 'flex' },
    { value: 'grid', label: 'Grid', token: 'grid' },
  ],
};

export const DIRECTION_CONTROL: ClassControl = {
  id: 'direction',
  label: 'Direction',
  options: [
    { value: 'col', label: 'Stack', token: 'flex-col' },
    { value: 'row', label: 'Row', token: 'flex-row' },
  ],
};

export const COLUMNS_CONTROL: ClassControl = {
  id: 'columns',
  label: 'Columns',
  options: [1, 2, 3, 4, 5, 6].map((n) => ({
    value: String(n),
    label: String(n),
    token: `grid-cols-${n}`,
  })),
};

export const GAP_CONTROL: ClassControl = {
  id: 'gap',
  label: 'Gap',
  options: [
    { value: 'none', label: 'None', token: 'gap-0' },
    { value: 'sm', label: 'S', token: 'gap-2' },
    { value: 'md', label: 'M', token: 'gap-4' },
    { value: 'lg', label: 'L', token: 'gap-6' },
    { value: 'xl', label: 'XL', token: 'gap-8' },
  ],
};

export const JUSTIFY_CONTROL: ClassControl = {
  id: 'justify',
  label: 'Justify',
  options: [
    { value: 'start', label: 'Start', token: 'justify-start' },
    { value: 'center', label: 'Center', token: 'justify-center' },
    { value: 'end', label: 'End', token: 'justify-end' },
    { value: 'between', label: 'Between', token: 'justify-between' },
  ],
};

export const ALIGN_ITEMS_CONTROL: ClassControl = {
  id: 'items',
  label: 'Align',
  options: [
    { value: 'start', label: 'Start', token: 'items-start' },
    { value: 'center', label: 'Center', token: 'items-center' },
    { value: 'end', label: 'End', token: 'items-end' },
    { value: 'stretch', label: 'Stretch', token: 'items-stretch' },
  ],
};

export const PADDING_CONTROL: ClassControl = {
  id: 'padding',
  label: 'Padding',
  options: [
    { value: 'none', label: 'None', token: 'p-0' },
    { value: 'sm', label: 'S', token: 'p-3' },
    { value: 'md', label: 'M', token: 'p-6' },
    { value: 'lg', label: 'L', token: 'p-10' },
    { value: 'xl', label: 'XL', token: 'p-16' },
  ],
};

/** The arrangement controls for a CONTAINER, in order. `direction` shows for a
 *  flex container, `columns` for a grid — chosen by the node's current `display`
 *  (default = flex, so a node with no display token still gets Direction). */
export function arrangementControlsFor(classStr: string | undefined): ClassControl[] {
  const display = activeValue(classStr, DISPLAY_CONTROL);
  const out: ClassControl[] = [DISPLAY_CONTROL];
  out.push(display === 'grid' ? COLUMNS_CONTROL : DIRECTION_CONTROL);
  out.push(GAP_CONTROL, JUSTIFY_CONTROL, ALIGN_ITEMS_CONTROL, PADDING_CONTROL);
  return out;
}

/** The advanced (collapsed) style controls applicable to a node, in order: the
 *  element-scoped Size (when the archetype has one) and Margin. These are universal
 *  (both surfaces). The SKIN families (corners / border / shadow / color / type /
 *  motion) live in the component-builder-only Appearance panel (`skinControlsFor`),
 *  not here — on the page builder a component's skin comes from its recipe, not
 *  per-instance re-skinning (docs/61 §5.2). The raw `class` textarea — the final
 *  escape hatch — is rendered alongside these by the inspector. */
export function advancedControlsFor(archetype: string | undefined): ClassControl[] {
  const out: ClassControl[] = [];
  const size = sizeControlFor(archetype);
  if (size) out.push(size);
  out.push(MARGIN_CONTROL);
  return out;
}

// Every control reads/writes a single token from a mutually-exclusive GROUP. A
// `prefix` (a Tailwind variant like `hover:`, `@lg:`, `dark:`) makes the SAME
// control target a different responsive/state/theme LAYER: the group becomes the
// prefixed tokens (`@lg:grid-cols-3`, `hover:bg-primary`), so base + each context
// are independent groups that never clobber each other (docs/61 §5.2 / §7). The
// default `''` prefix is the base layer — every existing caller is unchanged.
const prefixedGroup = (control: ClassControl, prefix: string): string[] =>
  control.options.map((o) => prefix + o.token);

/** The active option VALUE for a control given a node's class string, or null.
 *  `prefix` selects the context layer (base when ''). */
export function activeValue(
  classStr: string | undefined,
  control: ClassControl,
  prefix = ''
): string | null {
  const token = readClassGroup(classStr, prefixedGroup(control, prefix));
  if (!token) return null;
  const bare = token.slice(prefix.length);
  return control.options.find((o) => o.token === bare)?.value ?? null;
}

/** Apply an option value (or clear with null) → the new class string. `prefix`
 *  writes into the context layer (base when ''). */
export function applyValue(
  classStr: string | undefined,
  control: ClassControl,
  value: string | null,
  prefix = ''
): string {
  const bare = value ? (control.options.find((o) => o.value === value)?.token ?? null) : null;
  return setClassGroup(classStr, prefixedGroup(control, prefix), bare ? prefix + bare : null);
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
