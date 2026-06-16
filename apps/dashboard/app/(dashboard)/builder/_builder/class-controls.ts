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
  /** The class token this option writes (e.g. `st-c-primary`). */
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

// Plain-language labels for the treatment axis (the values/tokens are the class
// contract; only the display text is humanized — docs UI redesign).
const TREATMENT_LABELS: Record<string, string> = {
  solid: 'Solid',
  soft: 'Soft',
  outline: 'Outline',
  dashed: 'Dashed',
  ghost: 'Subtle',
  link: 'Text link',
  glass: 'Frosted',
};

// The shared xs…xl size steps (docs/46 §3.6, docs/47 §11). Element-namespaced in
// the recipe (e.g. a Button's size class is `st-btn--sz-md`); `archetypeSizeBase`
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
  options: COLOR_KEYS.map((k) => ({ value: k, label: cap(k), token: `st-c-${k}` })),
};

export const VARIANT_CONTROL: ClassControl = {
  id: 'variant',
  label: 'Emphasis',
  options: TREATMENT_KEYS.map((k) => ({
    value: k,
    label: TREATMENT_LABELS[k] ?? cap(k),
    token: `st-v-${k}`,
  })),
};

/** The controls rendered, in order, in the inspector's everyday Style panel. */
export const STYLE_CONTROLS: ClassControl[] = [COLOR_CONTROL, VARIANT_CONTROL];

/** The element prefix of a node's size axis (e.g. `st-btn` from `st-btn--sz-md`),
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
// user or AI would type, compiled to the tenant `--st-*` tokens by @sparx/surface-compile
// and rendered live in the canvas (useSurfacePreview). Corners/spacing/shadow therefore
// track the brand scale (`--st-radius-*` / `--st-space-base` / `--st-shadow-*`), not
// hardcoded values. These write the same class on any node, shared across all archetypes.
// (The bespoke `st-radius-*` / `st-m-*` / … util-box dialect is retired — docs/61 §11.)
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
  label: 'Outer spacing',
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

// Power-user box controls (the inspector's Advanced panel). General display + CSS
// position — beyond the friendly Layout card's flex/grid arrangement. Tailwind-
// native, compiled like every other utility. Display is offered on LEAVES only
// (a container's display is driven by Layout's "Arrange as", same token group).
export const BOX_DISPLAY_CONTROL: ClassControl = {
  id: 'boxDisplay',
  label: 'Display',
  options: [
    { value: 'block', label: 'Block', token: 'block' },
    { value: 'inline-block', label: 'Inline block', token: 'inline-block' },
    { value: 'inline', label: 'Inline', token: 'inline' },
    { value: 'flex', label: 'Flex', token: 'flex' },
    { value: 'grid', label: 'Grid', token: 'grid' },
    { value: 'hidden', label: 'Hidden', token: 'hidden' },
  ],
};

// `fixed` is intentionally absent — the surface compiler's allowlist blocks it
// (a tenant element can't pin itself over the app chrome), so offering it would
// silently no-op. Static is the empty/default; the others reveal offsets + z.
export const POSITION_CONTROL: ClassControl = {
  id: 'position',
  label: 'Position',
  options: [
    { value: 'relative', label: 'Relative', token: 'relative' },
    { value: 'absolute', label: 'Absolute', token: 'absolute' },
    { value: 'sticky', label: 'Sticky', token: 'sticky' },
  ],
};

// Layer / z-index — SCALE ONLY (the allowlist blocks arbitrary `z-[9999]`); empty
// inherits auto. Capped at 50 so tenant content stays below the app chrome.
export const Z_INDEX_CONTROL: ClassControl = {
  id: 'z',
  label: 'Layer (front ↔ back)',
  options: [
    { value: '0', label: '0', token: 'z-0' },
    { value: '10', label: '10', token: 'z-10' },
    { value: '20', label: '20', token: 'z-20' },
    { value: '30', label: '30', token: 'z-30' },
    { value: '40', label: '40', token: 'z-40' },
    { value: '50', label: '50 (top)', token: 'z-50' },
  ],
};

export const ASPECT_CONTROL: ClassControl = {
  id: 'aspect',
  label: 'Aspect ratio',
  options: [
    { value: 'square', label: 'Square (1:1)', token: 'aspect-square' },
    { value: 'video', label: 'Wide (16:9)', token: 'aspect-video' },
    { value: '4/3', label: '4:3', token: 'aspect-[4/3]' },
    { value: '3/4', label: 'Tall (3:4)', token: 'aspect-[3/4]' },
  ],
};

export const OVERFLOW_CONTROL: ClassControl = {
  id: 'overflow',
  label: 'Overflow',
  options: [
    { value: 'visible', label: 'Visible', token: 'overflow-visible' },
    { value: 'hidden', label: 'Hidden (clip)', token: 'overflow-hidden' },
    { value: 'scroll', label: 'Scroll', token: 'overflow-scroll' },
    { value: 'auto', label: 'Auto', token: 'overflow-auto' },
  ],
};

export const TEXT_ALIGN_CONTROL: ClassControl = {
  id: 'textAlign',
  // `text-align` is where text sits inside its line, NOT where the element sits —
  // element placement lives under Flexbox & Grid (justify/items/self/mx-auto). The
  // label says "Text alignment" so the two are never confused (docs/98 §3.3).
  label: 'Text alignment',
  options: [
    { value: 'left', label: 'Left', token: 'text-left' },
    { value: 'center', label: 'Center', token: 'text-center' },
    { value: 'right', label: 'Right', token: 'text-right' },
    { value: 'justify', label: 'Justified', token: 'text-justify' },
  ],
};

export const LEADING_CONTROL: ClassControl = {
  id: 'leading',
  label: 'Line height',
  options: [
    { value: 'tight', label: 'Tight', token: 'leading-tight' },
    { value: 'snug', label: 'Snug', token: 'leading-snug' },
    { value: 'normal', label: 'Normal', token: 'leading-normal' },
    { value: 'relaxed', label: 'Relaxed', token: 'leading-relaxed' },
    { value: 'loose', label: 'Loose', token: 'leading-loose' },
  ],
};

export const BORDER_STYLE_CONTROL: ClassControl = {
  id: 'borderStyle',
  label: 'Style',
  options: [
    { value: 'solid', label: 'Solid', token: 'border-solid' },
    { value: 'dashed', label: 'Dashed', token: 'border-dashed' },
    { value: 'dotted', label: 'Dotted', token: 'border-dotted' },
  ],
};

// Border color — TOKEN colors only (arbitrary hex is blocked by the allowlist).
export const BORDER_COLOR_CONTROL: ClassControl = {
  id: 'borderColor',
  label: 'Border color',
  options: [
    { value: 'subtle', label: 'Subtle', token: 'border-base-300' },
    { value: 'primary', label: 'Primary', token: 'border-primary' },
    { value: 'secondary', label: 'Secondary', token: 'border-secondary' },
    { value: 'accent', label: 'Accent', token: 'border-accent' },
    { value: 'neutral', label: 'Neutral', token: 'border-neutral' },
  ],
};

// ── Skin families (docs/61 §5.2, Phase 3) — component-builder only ────────────
// The FULL appearance surface for a reusable component: free background/text color
// (beyond the recipe's color×variant), free type, and motion. Tokenized → every
// option resolves to a tenant `--st-*` value at compile time. Gated to the
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

// ── Motion (docs/61 §9) — entrance × trigger, BOTH surfaces ───────────────────
// Entrance and trigger interact: the SAME entrance plays through a different class
// shape per trigger — load `animate-<token>` (pure CSS, on paint), hover
// `hover:animate-<token>` (pure CSS), scroll `st-reveal st-reveal--<token>` (the
// MotionController island flips `.st-in` in view, against SCROLL_MOTION_CSS). So
// Motion is a small COMPOSITE over `node.class` rather than one flat group: the
// reader detects the shape, the writer clears the whole motion vocabulary and
// re-emits. Reduced motion is neutralized globally (REDUCED_MOTION_CSS) — no
// per-class opt-in. Available on both surfaces: an entrance is safe-because-visible
// like arrangement, not silent re-skin (docs/61 §5.2).

export interface MotionOption {
  value: string;
  label: string;
}

/** Entrance tokens — the canonical names shared by the compile-theme `--animate-*`
 *  set (surface-compile/theme.ts) and the `.st-reveal--*` scroll rules
 *  (surface-compile/motion.ts, SCROLL_MOTION_CSS). */
export const MOTION_ENTRANCES: MotionOption[] = [
  { value: 'fade-in', label: 'Fade in' },
  { value: 'fade-up', label: 'Fade up' },
  { value: 'fade-down', label: 'Fade down' },
  { value: 'scale-in', label: 'Scale in' },
  { value: 'slide-in-left', label: 'Slide in left' },
  { value: 'slide-in-right', label: 'Slide in right' },
];

export const MOTION_TRIGGERS: MotionOption[] = [
  { value: 'scroll', label: 'On scroll' },
  { value: 'load', label: 'On load' },
  { value: 'hover', label: 'On hover' },
];

export interface MotionState {
  /** null = no entrance motion. */
  entrance: string | null;
  /** 'scroll' | 'load' | 'hover'; defaults to 'scroll' when an entrance is set. */
  trigger: string;
}

/** The class(es) a given entrance + trigger emits. */
function entranceClasses(entrance: string, trigger: string): string[] {
  if (trigger === 'scroll') return ['st-reveal', `st-reveal--${entrance}`];
  if (trigger === 'hover') return [`hover:animate-${entrance}`];
  return [`animate-${entrance}`];
}

/** Every class token the Motion control may own — cleared before re-emit. */
function allMotionTokens(): Set<string> {
  const out = new Set<string>(['st-reveal', 'animate-none']);
  for (const e of MOTION_ENTRANCES) {
    out.add(`animate-${e.value}`);
    out.add(`hover:animate-${e.value}`);
    out.add(`st-reveal--${e.value}`);
  }
  return out;
}

/** Detect the current entrance + trigger from a node's class string. */
export function readMotion(classStr: string | undefined): MotionState {
  const tokens = new Set((classStr ?? '').split(/\s+/).filter(Boolean));
  for (const e of MOTION_ENTRANCES) {
    if (tokens.has(`st-reveal--${e.value}`)) return { entrance: e.value, trigger: 'scroll' };
    if (tokens.has(`hover:animate-${e.value}`)) return { entrance: e.value, trigger: 'hover' };
    if (tokens.has(`animate-${e.value}`)) return { entrance: e.value, trigger: 'load' };
  }
  return { entrance: null, trigger: 'scroll' };
}

/** Clear the whole motion vocabulary and re-emit the chosen shape (or none). */
export function applyMotion(classStr: string | undefined, next: MotionState): string {
  const remove = allMotionTokens();
  const tokens = (classStr ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !remove.has(t));
  if (next.entrance) tokens.push(...entranceClasses(next.entrance, next.trigger));
  return tokens.join(' ');
}

/** Container stagger (docs/61 §9): direct children fade-up in sequence as the
 *  container scrolls into view. Single-token group → drives through the standard
 *  activeValue/applyValue like any other control. Containers only. */
export const STAGGER_CONTROL: ClassControl = {
  id: 'stagger',
  label: 'Reveal one by one',
  options: [
    { value: 'subtle', label: 'Gentle', token: 'st-reveal-stagger' },
    { value: 'bold', label: 'Snappy', token: 'st-reveal-stagger--bold' },
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

/** The full appearance/skin controls for the component builder, in order. These
 *  are the per-instance INTERACTIVE skin: free color/type/edges + transition &
 *  transform (which pair with a hover/focus context). The ENTRANCE animation moved
 *  to the cross-surface Motion panel (docs/61 §9) — it's authored on both surfaces,
 *  not just here. */
export function skinControlsFor(): ClassControl[] {
  return [
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
  label: 'Space between',
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
  label: 'Distribute',
  options: [
    { value: 'start', label: 'Start', token: 'justify-start' },
    { value: 'center', label: 'Center', token: 'justify-center' },
    { value: 'end', label: 'End', token: 'justify-end' },
    { value: 'between', label: 'Spread apart', token: 'justify-between' },
    { value: 'around', label: 'Even around', token: 'justify-around' },
    { value: 'evenly', label: 'Even gaps', token: 'justify-evenly' },
  ],
};

export const ALIGN_ITEMS_CONTROL: ClassControl = {
  id: 'items',
  label: 'Line up',
  options: [
    { value: 'start', label: 'Start', token: 'items-start' },
    { value: 'center', label: 'Center', token: 'items-center' },
    { value: 'end', label: 'End', token: 'items-end' },
    { value: 'stretch', label: 'Fill', token: 'items-stretch' },
    { value: 'baseline', label: 'Baseline', token: 'items-baseline' },
  ],
};

export const PADDING_CONTROL: ClassControl = {
  id: 'padding',
  label: 'Inner spacing',
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

// ── Value (length / number) utilities ─────────────────────────────────────────
// The enum controls above carry a fixed, mutually-exclusive token LIST. The power
// panel also needs OPEN-ENDED value utilities — `top-4`, `w-1/2`, `top-[20px]`,
// `opacity-75` — whose value isn't a fixed list. These read/write a Tailwind
// utility GROUP keyed by an exact `prefix` (`top`, `w`, `p`, `opacity`, `rotate`,
// …); a token is in the group iff it starts with `<prefix>-`, so `p` never
// swallows `px-`/`pt-`. Arbitrary values (`[20px]`) and any scale step compile
// through the same JIT as everything else (docs/47 §5). A `ctx` variant (`@lg:`)
// targets a responsive/state layer, exactly like the enum path.

/** The value SUFFIX of a prefix group on a node's class — e.g. `top` → `4` from
 *  `top-4`, or `[20px]` from `top-[20px]`; null when unset. */
export function readValueGroup(
  classStr: string | undefined,
  prefix: string,
  ctx = ''
): string | null {
  const head = `${ctx}${prefix}-`;
  for (const token of (classStr ?? '').split(/\s+/).filter(Boolean)) {
    if (token.startsWith(head)) return token.slice(head.length);
  }
  return null;
}

/** Write a value group (or clear with null). `value` is the SUFFIX — a scale step
 *  (`4`), a keyword (`full`), or an arbitrary value (`[20px]`). Any existing token
 *  in the group is removed first. */
export function applyValueGroup(
  classStr: string | undefined,
  prefix: string,
  value: string | null,
  ctx = ''
): string {
  const head = `${ctx}${prefix}-`;
  const tokens = (classStr ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !t.startsWith(head));
  if (value) tokens.push(`${head}${value}`);
  return tokens.join(' ');
}

/** Coerce a free-typed length into a Tailwind value SUFFIX: a bare number stays a
 *  scale step (`4` → `top-4`); anything with a unit/percent (or a non-numeric
 *  token) becomes an arbitrary value (`20px` → `[20px]`, `50%` → `[50%]`). Spaces
 *  inside arbitrary values become underscores (Tailwind's escape). Empty → null. */
export function lengthSuffix(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return v; // bare number → scale step
  if (/^\[.+\]$/.test(v)) return v.replace(/\s+/g, '_'); // already bracketed
  return `[${v.replace(/\s+/g, '_')}]`; // wrap as arbitrary
}

/** The inverse of `lengthSuffix` for display in a text field: an arbitrary suffix
 *  `[20px]` shows as `20px`; a scale step shows as-is. */
export function lengthDisplay(suffix: string | null): string {
  if (!suffix) return '';
  const m = /^\[(.+)\]$/.exec(suffix);
  return m ? m[1]!.replace(/_/g, ' ') : suffix;
}

/** The styling axis a recipe token belongs to (mutually-exclusive groups), or
 *  null for a structural BASE token like `st-btn` (matched exactly, not by axis). */
function axisOf(token: string): string | null {
  if (token.startsWith('st-c-')) return 'color';
  if (token.startsWith('st-v-')) return 'variant';
  if (token.includes('--sz-')) return 'size';
  return null;
}

/**
 * Ensure a node keeps its archetype's structural base + a default for every
 * styling axis the author hasn't set (docs/47). When a Style control writes only
 * e.g. `st-c-secondary` onto a node whose `class` predates class-first — a
 * template built before archetypes, so NO `st-btn` base — the element collapses
 * to a bare, unstyled span. This merges in the archetype's base token(s) (e.g.
 * `st-btn`) plus the default for any UNSET axis (variant, size), so a Button
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

// ════════════════════════════════════════════════════════════════════════════
// Phase 4 — the full design surface (docs/builder/04). The controls below
// complete the structured Tailwind vocabulary so a power user reaches ~100% of
// the practical surface from the UI — per breakpoint and per state — instead of
// the raw-class hatch. EVERY token here is proven to compile against the real
// Tailwind v4 compiler by packages/surface-compile/src/phase4-utilities.test.ts
// (docs/builder/04 §5: a control that emits a class the compiler drops is worse
// than no control). They drive through the same single-token group model as
// every other control, so the context selector re-prefixes them for free.

// ── Typography — decoration / clamp / wrapping ────────────────────────────────
export const TEXT_DECORATION_CONTROL: ClassControl = {
  id: 'decoration',
  label: 'Decoration',
  options: [
    { value: 'underline', label: 'Underline', token: 'underline' },
    { value: 'line-through', label: 'Strikethrough', token: 'line-through' },
    { value: 'overline', label: 'Overline', token: 'overline' },
    { value: 'none', label: 'None', token: 'no-underline' },
  ],
};

// Truncate (single line, ellipsis) and line-clamp share one control — they're
// mutually exclusive in intent and the group model swaps cleanly between them.
export const LINE_CLAMP_CONTROL: ClassControl = {
  id: 'lineClamp',
  label: 'Limit lines',
  options: [
    { value: '1', label: '1 line (…)', token: 'truncate' },
    { value: '2', label: '2 lines', token: 'line-clamp-2' },
    { value: '3', label: '3 lines', token: 'line-clamp-3' },
    { value: '4', label: '4 lines', token: 'line-clamp-4' },
    { value: 'none', label: 'No limit', token: 'line-clamp-none' },
  ],
};

export const WHITESPACE_CONTROL: ClassControl = {
  id: 'whitespace',
  label: 'Wrapping',
  options: [
    { value: 'normal', label: 'Normal', token: 'whitespace-normal' },
    { value: 'nowrap', label: 'No wrap', token: 'whitespace-nowrap' },
    { value: 'pre-line', label: 'Keep breaks', token: 'whitespace-pre-line' },
    { value: 'pre-wrap', label: 'Keep spaces', token: 'whitespace-pre-wrap' },
    { value: 'pre', label: 'Exact', token: 'whitespace-pre' },
  ],
};

export const WORD_BREAK_CONTROL: ClassControl = {
  id: 'wordBreak',
  label: 'Break words',
  options: [
    { value: 'normal', label: 'Normal', token: 'break-normal' },
    { value: 'words', label: 'Between words', token: 'break-words' },
    { value: 'all', label: 'Anywhere', token: 'break-all' },
    { value: 'keep', label: 'Keep (CJK)', token: 'break-keep' },
  ],
};

// ── Layout — flex-wrap / grid rows / flow / item distribution ─────────────────
export const FLEX_WRAP_CONTROL: ClassControl = {
  id: 'flexWrap',
  label: 'Wrap',
  options: [
    { value: 'nowrap', label: 'No wrap', token: 'flex-nowrap' },
    { value: 'wrap', label: 'Wrap', token: 'flex-wrap' },
    { value: 'reverse', label: 'Wrap reverse', token: 'flex-wrap-reverse' },
  ],
};

export const GRID_ROWS_CONTROL: ClassControl = {
  id: 'gridRows',
  label: 'Rows',
  options: [1, 2, 3, 4, 5, 6].map((n) => ({
    value: String(n),
    label: String(n),
    token: `grid-rows-${n}`,
  })),
};

export const GRID_FLOW_CONTROL: ClassControl = {
  id: 'gridFlow',
  label: 'Fill order',
  options: [
    { value: 'row', label: 'Rows', token: 'grid-flow-row' },
    { value: 'col', label: 'Columns', token: 'grid-flow-col' },
    { value: 'row-dense', label: 'Rows (dense)', token: 'grid-flow-row-dense' },
    { value: 'col-dense', label: 'Columns (dense)', token: 'grid-flow-col-dense' },
  ],
};

export const JUSTIFY_ITEMS_CONTROL: ClassControl = {
  id: 'justifyItems',
  label: 'Item align (across)',
  options: [
    { value: 'start', label: 'Start', token: 'justify-items-start' },
    { value: 'center', label: 'Center', token: 'justify-items-center' },
    { value: 'end', label: 'End', token: 'justify-items-end' },
    { value: 'stretch', label: 'Fill', token: 'justify-items-stretch' },
  ],
};

export const ALIGN_CONTENT_CONTROL: ClassControl = {
  id: 'alignContent',
  label: 'Rows distribute',
  options: [
    { value: 'start', label: 'Start', token: 'content-start' },
    { value: 'center', label: 'Center', token: 'content-center' },
    { value: 'end', label: 'End', token: 'content-end' },
    { value: 'between', label: 'Spread apart', token: 'content-between' },
    { value: 'around', label: 'Even around', token: 'content-around' },
    { value: 'stretch', label: 'Fill', token: 'content-stretch' },
  ],
};

// ── Child layout — how a flex/grid CHILD sizes & orders itself ────────────────
export const FLEX_GROW_CONTROL: ClassControl = {
  id: 'grow',
  label: 'Grow',
  options: [
    { value: 'grow', label: 'Fill space', token: 'grow' },
    { value: 'none', label: "Don't grow", token: 'grow-0' },
  ],
};

export const FLEX_SHRINK_CONTROL: ClassControl = {
  id: 'shrink',
  label: 'Shrink',
  options: [
    { value: 'shrink', label: 'Allow', token: 'shrink' },
    { value: 'none', label: "Don't shrink", token: 'shrink-0' },
  ],
};

export const ALIGN_SELF_CONTROL: ClassControl = {
  id: 'self',
  label: 'Align self',
  options: [
    { value: 'auto', label: 'Auto', token: 'self-auto' },
    { value: 'start', label: 'Start', token: 'self-start' },
    { value: 'center', label: 'Center', token: 'self-center' },
    { value: 'end', label: 'End', token: 'self-end' },
    { value: 'stretch', label: 'Fill', token: 'self-stretch' },
  ],
};

// ── Background — gradient (direction + stops), fit / position / repeat ─────────
// The gradient stops + ring/shadow colors draw from the recipe palette (the same
// tenant `--st-*` colors); `from-transparent`/`to-transparent` enable fade-outs.
const STOP_COLOR_OPTIONS: ClassOption[] = [
  { value: 'primary', label: 'Primary', token: 'primary' },
  { value: 'secondary', label: 'Secondary', token: 'secondary' },
  { value: 'accent', label: 'Accent', token: 'accent' },
  { value: 'neutral', label: 'Neutral', token: 'neutral' },
  { value: 'base-100', label: 'Page', token: 'base-100' },
  { value: 'base-200', label: 'Subtle', token: 'base-200' },
  { value: 'base-300', label: 'Muted', token: 'base-300' },
  { value: 'transparent', label: 'Transparent', token: 'transparent' },
];
const stopControl = (id: string, label: string, util: 'from' | 'via' | 'to'): ClassControl => ({
  id,
  label,
  options: STOP_COLOR_OPTIONS.map((o) => ({ ...o, token: `${util}-${o.token}` })),
});

export const GRADIENT_DIRECTION_CONTROL: ClassControl = {
  id: 'gradientDir',
  label: 'Gradient',
  options: [
    { value: 'r', label: 'Left → right', token: 'bg-linear-to-r' },
    { value: 'l', label: 'Right → left', token: 'bg-linear-to-l' },
    { value: 'b', label: 'Top → bottom', token: 'bg-linear-to-b' },
    { value: 't', label: 'Bottom → top', token: 'bg-linear-to-t' },
    { value: 'br', label: 'To bottom-right', token: 'bg-linear-to-br' },
    { value: 'bl', label: 'To bottom-left', token: 'bg-linear-to-bl' },
    { value: 'tr', label: 'To top-right', token: 'bg-linear-to-tr' },
    { value: 'tl', label: 'To top-left', token: 'bg-linear-to-tl' },
    { value: 'radial', label: 'Radial', token: 'bg-radial' },
    { value: 'conic', label: 'Conic', token: 'bg-conic' },
  ],
};
export const GRADIENT_FROM_CONTROL = stopControl('gradientFrom', 'From', 'from');
export const GRADIENT_VIA_CONTROL = stopControl('gradientVia', 'Via (optional)', 'via');
export const GRADIENT_TO_CONTROL = stopControl('gradientTo', 'To', 'to');

export const BG_SIZE_CONTROL: ClassControl = {
  id: 'bgSize',
  label: 'Fit',
  options: [
    { value: 'auto', label: 'Auto', token: 'bg-auto' },
    { value: 'cover', label: 'Cover', token: 'bg-cover' },
    { value: 'contain', label: 'Contain', token: 'bg-contain' },
  ],
};

export const BG_POSITION_CONTROL: ClassControl = {
  id: 'bgPos',
  label: 'Position',
  options: [
    { value: 'center', label: 'Center', token: 'bg-center' },
    { value: 'top', label: 'Top', token: 'bg-top' },
    { value: 'bottom', label: 'Bottom', token: 'bg-bottom' },
    { value: 'left', label: 'Left', token: 'bg-left' },
    { value: 'right', label: 'Right', token: 'bg-right' },
  ],
};

export const BG_REPEAT_CONTROL: ClassControl = {
  id: 'bgRepeat',
  label: 'Repeat',
  options: [
    { value: 'no-repeat', label: 'No repeat', token: 'bg-no-repeat' },
    { value: 'repeat', label: 'Tile', token: 'bg-repeat' },
    { value: 'repeat-x', label: 'Tile across', token: 'bg-repeat-x' },
    { value: 'repeat-y', label: 'Tile down', token: 'bg-repeat-y' },
  ],
};

// ── Effects — shadow color / ring / blend / filters / origin ──────────────────
export const SHADOW_COLOR_CONTROL: ClassControl = {
  id: 'shadowColor',
  label: 'Shadow color',
  options: [
    { value: 'primary', label: 'Primary', token: 'shadow-primary' },
    { value: 'accent', label: 'Accent', token: 'shadow-accent' },
    { value: 'neutral', label: 'Neutral', token: 'shadow-neutral' },
    { value: 'black', label: 'Black', token: 'shadow-black' },
  ],
};

export const RING_CONTROL: ClassControl = {
  id: 'ring',
  label: 'Ring',
  options: [
    { value: 'none', label: 'None', token: 'ring-0' },
    { value: 'thin', label: 'Hairline', token: 'ring-1' },
    { value: 'medium', label: 'Medium', token: 'ring-2' },
    { value: 'thick', label: 'Thick', token: 'ring-4' },
  ],
};

export const RING_COLOR_CONTROL: ClassControl = {
  id: 'ringColor',
  label: 'Ring color',
  options: [
    { value: 'primary', label: 'Primary', token: 'ring-primary' },
    { value: 'accent', label: 'Accent', token: 'ring-accent' },
    { value: 'neutral', label: 'Neutral', token: 'ring-neutral' },
    { value: 'subtle', label: 'Subtle', token: 'ring-base-300' },
  ],
};

export const MIX_BLEND_CONTROL: ClassControl = {
  id: 'mixBlend',
  label: 'Blend mode',
  options: [
    { value: 'normal', label: 'Normal', token: 'mix-blend-normal' },
    { value: 'multiply', label: 'Multiply', token: 'mix-blend-multiply' },
    { value: 'screen', label: 'Screen', token: 'mix-blend-screen' },
    { value: 'overlay', label: 'Overlay', token: 'mix-blend-overlay' },
    { value: 'darken', label: 'Darken', token: 'mix-blend-darken' },
    { value: 'lighten', label: 'Lighten', token: 'mix-blend-lighten' },
    { value: 'difference', label: 'Difference', token: 'mix-blend-difference' },
  ],
};

export const BLUR_CONTROL: ClassControl = {
  id: 'blur',
  label: 'Blur',
  options: [
    { value: 'sm', label: 'Small', token: 'blur-sm' },
    { value: 'md', label: 'Medium', token: 'blur-md' },
    { value: 'lg', label: 'Large', token: 'blur-lg' },
  ],
};

export const BACKDROP_BLUR_CONTROL: ClassControl = {
  id: 'backdropBlur',
  label: 'Backdrop blur',
  options: [
    { value: 'sm', label: 'Small', token: 'backdrop-blur-sm' },
    { value: 'md', label: 'Medium', token: 'backdrop-blur-md' },
    { value: 'lg', label: 'Large', token: 'backdrop-blur-lg' },
  ],
};

export const GRAYSCALE_CONTROL: ClassControl = {
  id: 'grayscale',
  label: 'Grayscale',
  options: [
    { value: 'on', label: 'On', token: 'grayscale' },
    { value: 'off', label: 'Off', token: 'grayscale-0' },
  ],
};

export const TRANSFORM_ORIGIN_CONTROL: ClassControl = {
  id: 'origin',
  label: 'Transform origin',
  options: [
    { value: 'center', label: 'Center', token: 'origin-center' },
    { value: 'top', label: 'Top', token: 'origin-top' },
    { value: 'bottom', label: 'Bottom', token: 'origin-bottom' },
    { value: 'left', label: 'Left', token: 'origin-left' },
    { value: 'right', label: 'Right', token: 'origin-right' },
    { value: 'top-left', label: 'Top-left', token: 'origin-top-left' },
  ],
};

// ── Borders — per-side width / per-corner radius (factories) ──────────────────
// Each side / corner is its own mutually-exclusive group, so the 4-side widget
// (inspector) can set one edge without disturbing the others. The bare `border-t`
// is 1px; `-0/-2/-4` are the width steps. Corners reuse the same `--st-radius-*`
// scale as the all-corner RADIUS_CONTROL.
export const BORDER_SIDES = [
  { key: 't', label: 'Top' },
  { key: 'r', label: 'Right' },
  { key: 'b', label: 'Bottom' },
  { key: 'l', label: 'Left' },
] as const;
export type BorderSide = (typeof BORDER_SIDES)[number]['key'];

export function borderSideControl(side: BorderSide): ClassControl {
  return {
    id: `border-${side}`,
    label: BORDER_SIDES.find((s) => s.key === side)?.label ?? side,
    options: [
      { value: 'none', label: 'None', token: `border-${side}-0` },
      { value: 'thin', label: 'Hairline', token: `border-${side}` },
      { value: 'strong', label: 'Strong', token: `border-${side}-2` },
      { value: 'thick', label: 'Thick', token: `border-${side}-4` },
    ],
  };
}

export const RADIUS_CORNERS = [
  { key: 'tl', label: 'Top left' },
  { key: 'tr', label: 'Top right' },
  { key: 'br', label: 'Bottom right' },
  { key: 'bl', label: 'Bottom left' },
] as const;
export type RadiusCorner = (typeof RADIUS_CORNERS)[number]['key'];

export function radiusCornerControl(corner: RadiusCorner): ClassControl {
  return {
    id: `rounded-${corner}`,
    label: RADIUS_CORNERS.find((c) => c.key === corner)?.label ?? corner,
    options: [
      { value: 'none', label: 'Square', token: `rounded-${corner}-none` },
      { value: 'sm', label: 'Small', token: `rounded-${corner}-field` },
      { value: 'md', label: 'Medium', token: `rounded-${corner}-box` },
      { value: 'lg', label: 'Large', token: `rounded-${corner}-2xl` },
      { value: 'pill', label: 'Pill', token: `rounded-${corner}-full` },
    ],
  };
}

// ── Color + opacity (text / background / border) ──────────────────────────────
// A color utility may carry a Tailwind opacity modifier — `text-primary/75`. The
// slash breaks the exact-token group model (readClassGroup), so color-with-opacity
// reads/writes through these helpers: the active option is matched with OR without
// a trailing `/NN`, and the writer re-emits `<ctx><token>` plus `/NN` when < 100.
export interface ColorOpacityState {
  /** The active option VALUE of `control`, or null when no color is set. */
  value: string | null;
  /** 0–100; 100 = fully opaque (no modifier emitted). */
  opacity: number;
}

/** Read the active color option + its opacity modifier for a control at a layer. */
export function readColorOpacity(
  classStr: string | undefined,
  control: ClassControl,
  ctx = ''
): ColorOpacityState {
  for (const token of (classStr ?? '').split(/\s+/).filter(Boolean)) {
    for (const o of control.options) {
      const base = ctx + o.token;
      if (token === base) return { value: o.value, opacity: 100 };
      if (token.startsWith(`${base}/`)) {
        const n = Number(token.slice(base.length + 1));
        return { value: o.value, opacity: Number.isFinite(n) ? n : 100 };
      }
    }
  }
  return { value: null, opacity: 100 };
}

/** Write a color option (or clear with null) + opacity at a layer. Removes any
 *  existing member of the group (with or without a `/NN` modifier) first. */
export function applyColorOpacity(
  classStr: string | undefined,
  control: ClassControl,
  value: string | null,
  opacity: number,
  ctx = ''
): string {
  const bases = control.options.map((o) => ctx + o.token);
  const kept = (classStr ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !bases.some((b) => t === b || t.startsWith(`${b}/`)));
  const token = value ? control.options.find((o) => o.value === value)?.token : null;
  if (token) kept.push(ctx + token + (opacity < 100 ? `/${opacity}` : ''));
  return kept.join(' ');
}

// ════════════════════════════════════════════════════════════════════════════
// Phase 2 — the COMPLETE Tailwind surface, organized exactly like Tailwind's own
// documentation sections (docs/98 §3.3). The controls below fill the remaining
// gaps so every Tailwind utility is settable on every object: Filters,
// Interactivity, Tables, SVG, plus the missing Typography / Transitions /
// Transforms members. Every token here is a real Tailwind v4 utility, proven to
// compile by packages/surface-compile/src/phase4-utilities.test.ts (a control
// that emits a class the compiler drops is a bug). They drive through the same
// single-token group model as every other control, so the context selector
// re-prefixes them for free.

// ── Filters (Tailwind: Filters) ───────────────────────────────────────────────
// brightness / contrast / saturate are OPEN-ENDED value groups (read/write via
// LengthField + the filter presets), already wired in the Filters card. The enum
// toggles below cover the fixed-vocabulary filters; drop-shadow + hue-rotate ride
// LengthField value groups (`drop-shadow`, `hue-rotate`).
export const SEPIA_CONTROL: ClassControl = {
  id: 'sepia',
  label: 'Sepia',
  options: [
    { value: 'on', label: 'On', token: 'sepia' },
    { value: 'off', label: 'Off', token: 'sepia-0' },
  ],
};

export const INVERT_CONTROL: ClassControl = {
  id: 'invert',
  label: 'Invert',
  options: [
    { value: 'on', label: 'On', token: 'invert' },
    { value: 'off', label: 'Off', token: 'invert-0' },
  ],
};

export const DROP_SHADOW_CONTROL: ClassControl = {
  id: 'dropShadow',
  label: 'Drop shadow',
  options: [
    { value: 'sm', label: 'Small', token: 'drop-shadow-sm' },
    { value: 'md', label: 'Medium', token: 'drop-shadow-md' },
    { value: 'lg', label: 'Large', token: 'drop-shadow-lg' },
    { value: 'xl', label: 'XL', token: 'drop-shadow-xl' },
    { value: 'none', label: 'None', token: 'drop-shadow-none' },
  ],
};

// Backdrop filters (apply to what's BEHIND a translucent element — frosted glass).
// backdrop-blur already exists (BACKDROP_BLUR_CONTROL); these complete the set.
export const BACKDROP_GRAYSCALE_CONTROL: ClassControl = {
  id: 'backdropGrayscale',
  label: 'Backdrop grayscale',
  options: [
    { value: 'on', label: 'On', token: 'backdrop-grayscale' },
    { value: 'off', label: 'Off', token: 'backdrop-grayscale-0' },
  ],
};

// ── Transitions & Animation (Tailwind: Transitions & Animation) ───────────────
// transition / duration / delay already exist (TRANSITION_CONTROL + the
// duration/delay value groups). These add the timing function (ease-*) and the
// platform animation library (animate-*) as a flat enum — the same animations the
// Motion card emits, exposed raw here per Tailwind's section convention.
export const EASE_CONTROL: ClassControl = {
  id: 'ease',
  label: 'Easing',
  options: [
    { value: 'linear', label: 'Linear', token: 'ease-linear' },
    { value: 'in', label: 'Ease in', token: 'ease-in' },
    { value: 'out', label: 'Ease out', token: 'ease-out' },
    { value: 'in-out', label: 'Ease in-out', token: 'ease-in-out' },
  ],
};

export const ANIMATE_CONTROL: ClassControl = {
  id: 'animate',
  label: 'Animation',
  options: [
    { value: 'none', label: 'None', token: 'animate-none' },
    { value: 'spin', label: 'Spin', token: 'animate-spin' },
    { value: 'ping', label: 'Ping', token: 'animate-ping' },
    { value: 'pulse', label: 'Pulse', token: 'animate-pulse' },
    { value: 'bounce', label: 'Bounce', token: 'animate-bounce' },
  ],
};

// ── Transforms (Tailwind: Transforms) ─────────────────────────────────────────
// scale / rotate / translate / skew are OPEN-ENDED value groups (LengthField +
// presets), wired in the Transforms card. scale-x / scale-y are independent axes;
// transform-origin (TRANSFORM_ORIGIN_CONTROL) already exists. Negative rotate /
// translate ride the value field (`-rotate-6` → suffix `-6`, or a custom value).

// ── Tables (Tailwind: Tables) ─────────────────────────────────────────────────
// Only meaningful on table-family raw elements; the inspector reveals the Tables
// card for el:table/thead/tbody/tfoot/tr/td/th (and always-on is harmless).
export const BORDER_COLLAPSE_CONTROL: ClassControl = {
  id: 'borderCollapse',
  label: 'Border model',
  options: [
    { value: 'collapse', label: 'Collapse', token: 'border-collapse' },
    { value: 'separate', label: 'Separate', token: 'border-separate' },
  ],
};

export const TABLE_LAYOUT_CONTROL: ClassControl = {
  id: 'tableLayout',
  label: 'Column sizing',
  options: [
    { value: 'auto', label: 'Auto', token: 'table-auto' },
    { value: 'fixed', label: 'Fixed', token: 'table-fixed' },
  ],
};

export const CAPTION_SIDE_CONTROL: ClassControl = {
  id: 'captionSide',
  label: 'Caption side',
  options: [
    { value: 'top', label: 'Top', token: 'caption-top' },
    { value: 'bottom', label: 'Bottom', token: 'caption-bottom' },
  ],
};

// ── SVG (Tailwind: SVG) ───────────────────────────────────────────────────────
// fill / stroke draw from the recipe palette (token colors only — arbitrary hex is
// blocked by the allowlist). stroke-width is a small enum. Shown for el:svg + svg
// child raw elements.
export const FILL_CONTROL: ClassControl = {
  id: 'fill',
  label: 'Fill',
  options: [
    { value: 'none', label: 'None', token: 'fill-none' },
    { value: 'current', label: 'Current color', token: 'fill-current' },
    { value: 'primary', label: 'Primary', token: 'fill-primary' },
    { value: 'secondary', label: 'Secondary', token: 'fill-secondary' },
    { value: 'accent', label: 'Accent', token: 'fill-accent' },
    { value: 'neutral', label: 'Neutral', token: 'fill-neutral' },
    { value: 'white', label: 'White', token: 'fill-white' },
    { value: 'black', label: 'Black', token: 'fill-black' },
  ],
};

export const STROKE_CONTROL: ClassControl = {
  id: 'stroke',
  label: 'Stroke',
  options: [
    { value: 'none', label: 'None', token: 'stroke-none' },
    { value: 'current', label: 'Current color', token: 'stroke-current' },
    { value: 'primary', label: 'Primary', token: 'stroke-primary' },
    { value: 'secondary', label: 'Secondary', token: 'stroke-secondary' },
    { value: 'accent', label: 'Accent', token: 'stroke-accent' },
    { value: 'neutral', label: 'Neutral', token: 'stroke-neutral' },
    { value: 'white', label: 'White', token: 'stroke-white' },
    { value: 'black', label: 'Black', token: 'stroke-black' },
  ],
};

export const STROKE_WIDTH_CONTROL: ClassControl = {
  id: 'strokeWidth',
  label: 'Stroke width',
  options: [
    { value: '0', label: '0', token: 'stroke-0' },
    { value: '1', label: '1', token: 'stroke-1' },
    { value: '2', label: '2', token: 'stroke-2' },
  ],
};

// ── Typography — the remaining members (Tailwind: Typography) ─────────────────
export const FONT_STYLE_CONTROL: ClassControl = {
  id: 'fontStyle',
  label: 'Style',
  options: [
    { value: 'italic', label: 'Italic', token: 'italic' },
    { value: 'normal', label: 'Normal', token: 'not-italic' },
  ],
};

export const DECORATION_THICKNESS_CONTROL: ClassControl = {
  id: 'decorationThickness',
  label: 'Underline thickness',
  options: [
    { value: 'auto', label: 'Auto', token: 'decoration-auto' },
    { value: 'thin', label: 'Thin', token: 'decoration-1' },
    { value: 'medium', label: 'Medium', token: 'decoration-2' },
    { value: 'thick', label: 'Thick', token: 'decoration-4' },
  ],
};

export const DECORATION_OFFSET_CONTROL: ClassControl = {
  id: 'decorationOffset',
  label: 'Underline offset',
  options: [
    { value: 'auto', label: 'Auto', token: 'underline-offset-auto' },
    { value: '1', label: 'Close', token: 'underline-offset-1' },
    { value: '2', label: 'Medium', token: 'underline-offset-2' },
    { value: '4', label: 'Far', token: 'underline-offset-4' },
  ],
};

export const LIST_STYLE_TYPE_CONTROL: ClassControl = {
  id: 'listStyleType',
  label: 'List marker',
  options: [
    { value: 'none', label: 'None', token: 'list-none' },
    { value: 'disc', label: 'Bullets', token: 'list-disc' },
    { value: 'decimal', label: 'Numbers', token: 'list-decimal' },
  ],
};

export const LIST_STYLE_POSITION_CONTROL: ClassControl = {
  id: 'listStylePosition',
  label: 'Marker position',
  options: [
    { value: 'inside', label: 'Inside', token: 'list-inside' },
    { value: 'outside', label: 'Outside', token: 'list-outside' },
  ],
};

export const VERTICAL_ALIGN_CONTROL: ClassControl = {
  id: 'verticalAlign',
  label: 'Vertical align',
  options: [
    { value: 'baseline', label: 'Baseline', token: 'align-baseline' },
    { value: 'top', label: 'Top', token: 'align-top' },
    { value: 'middle', label: 'Middle', token: 'align-middle' },
    { value: 'bottom', label: 'Bottom', token: 'align-bottom' },
    { value: 'sub', label: 'Subscript', token: 'align-sub' },
    { value: 'super', label: 'Superscript', token: 'align-super' },
  ],
};

export const TEXT_OVERFLOW_CONTROL: ClassControl = {
  id: 'textOverflow',
  label: 'Overflow text',
  options: [
    { value: 'ellipsis', label: 'Ellipsis (…)', token: 'text-ellipsis' },
    { value: 'clip', label: 'Clip', token: 'text-clip' },
  ],
};

export const HYPHENS_CONTROL: ClassControl = {
  id: 'hyphens',
  label: 'Hyphenation',
  options: [
    { value: 'none', label: 'None', token: 'hyphens-none' },
    { value: 'manual', label: 'Manual', token: 'hyphens-manual' },
    { value: 'auto', label: 'Auto', token: 'hyphens-auto' },
  ],
};

// ── Interactivity (Tailwind: Interactivity) ───────────────────────────────────
export const CURSOR_CONTROL: ClassControl = {
  id: 'cursor',
  label: 'Cursor',
  options: [
    { value: 'auto', label: 'Auto', token: 'cursor-auto' },
    { value: 'default', label: 'Default', token: 'cursor-default' },
    { value: 'pointer', label: 'Pointer', token: 'cursor-pointer' },
    { value: 'wait', label: 'Wait', token: 'cursor-wait' },
    { value: 'text', label: 'Text', token: 'cursor-text' },
    { value: 'move', label: 'Move', token: 'cursor-move' },
    { value: 'not-allowed', label: 'Blocked', token: 'cursor-not-allowed' },
    { value: 'grab', label: 'Grab', token: 'cursor-grab' },
  ],
};

export const USER_SELECT_CONTROL: ClassControl = {
  id: 'userSelect',
  label: 'Text selection',
  options: [
    { value: 'none', label: 'Block', token: 'select-none' },
    { value: 'text', label: 'Text', token: 'select-text' },
    { value: 'all', label: 'Select all', token: 'select-all' },
    { value: 'auto', label: 'Auto', token: 'select-auto' },
  ],
};

export const POINTER_EVENTS_CONTROL: ClassControl = {
  id: 'pointerEvents',
  label: 'Pointer events',
  options: [
    { value: 'none', label: 'Ignore clicks', token: 'pointer-events-none' },
    { value: 'auto', label: 'Normal', token: 'pointer-events-auto' },
  ],
};

export const RESIZE_CONTROL: ClassControl = {
  id: 'resize',
  label: 'Resizable',
  options: [
    { value: 'none', label: 'None', token: 'resize-none' },
    { value: 'both', label: 'Both', token: 'resize' },
    { value: 'y', label: 'Vertical', token: 'resize-y' },
    { value: 'x', label: 'Horizontal', token: 'resize-x' },
  ],
};

export const SCROLL_BEHAVIOR_CONTROL: ClassControl = {
  id: 'scrollBehavior',
  label: 'Scroll behavior',
  options: [
    { value: 'auto', label: 'Instant', token: 'scroll-auto' },
    { value: 'smooth', label: 'Smooth', token: 'scroll-smooth' },
  ],
};

export const SCROLL_SNAP_TYPE_CONTROL: ClassControl = {
  id: 'scrollSnapType',
  label: 'Snap',
  options: [
    { value: 'none', label: 'None', token: 'snap-none' },
    { value: 'x', label: 'Horizontal', token: 'snap-x' },
    { value: 'y', label: 'Vertical', token: 'snap-y' },
    { value: 'both', label: 'Both', token: 'snap-both' },
  ],
};

export const SCROLL_SNAP_ALIGN_CONTROL: ClassControl = {
  id: 'scrollSnapAlign',
  label: 'Snap align',
  options: [
    { value: 'start', label: 'Start', token: 'snap-start' },
    { value: 'center', label: 'Center', token: 'snap-center' },
    { value: 'end', label: 'End', token: 'snap-end' },
    { value: 'none', label: 'None', token: 'snap-align-none' },
  ],
};

export const APPEARANCE_CONTROL: ClassControl = {
  id: 'appearance',
  label: 'Native styling',
  options: [
    { value: 'none', label: 'Strip', token: 'appearance-none' },
    { value: 'auto', label: 'Keep', token: 'appearance-auto' },
  ],
};

export const TOUCH_ACTION_CONTROL: ClassControl = {
  id: 'touchAction',
  label: 'Touch action',
  options: [
    { value: 'auto', label: 'Auto', token: 'touch-auto' },
    { value: 'none', label: 'None', token: 'touch-none' },
    { value: 'pan-x', label: 'Pan X', token: 'touch-pan-x' },
    { value: 'pan-y', label: 'Pan Y', token: 'touch-pan-y' },
    { value: 'manipulation', label: 'Manipulation', token: 'touch-manipulation' },
  ],
};

export const WILL_CHANGE_CONTROL: ClassControl = {
  id: 'willChange',
  label: 'Optimize for',
  options: [
    { value: 'auto', label: 'Auto', token: 'will-change-auto' },
    { value: 'scroll', label: 'Scroll', token: 'will-change-scroll' },
    { value: 'contents', label: 'Contents', token: 'will-change-contents' },
    { value: 'transform', label: 'Transform', token: 'will-change-transform' },
  ],
};

// caret / accent draw from the recipe palette (token colors only). The caret is
// the text-input cursor color; accent themes native checkboxes / radios / range.
export const CARET_COLOR_CONTROL: ClassControl = {
  id: 'caretColor',
  label: 'Cursor color',
  options: [
    { value: 'primary', label: 'Primary', token: 'caret-primary' },
    { value: 'accent', label: 'Accent', token: 'caret-accent' },
    { value: 'neutral', label: 'Neutral', token: 'caret-neutral' },
  ],
};

export const ACCENT_COLOR_CONTROL: ClassControl = {
  id: 'accentColor',
  label: 'Accent color',
  options: [
    { value: 'primary', label: 'Primary', token: 'accent-primary' },
    { value: 'secondary', label: 'Secondary', token: 'accent-secondary' },
    { value: 'accent', label: 'Accent', token: 'accent-accent' },
    { value: 'neutral', label: 'Neutral', token: 'accent-neutral' },
  ],
};
