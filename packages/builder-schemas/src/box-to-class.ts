// box-to-class — the seed/authoring bridge (docs/61).
//
// The runtime node is class-only: `{ id, type, name?, class?, props, binding?,
// children? }`. There is no `box`/`layout` object anymore. But hand-authored seed
// data (the starter pages, the marketplace blueprints, the registry's per-type
// drop defaults) is far more readable expressed as a small, semantic design
// vocabulary — "this section is `muted`, full-bleed, with contained content, a
// `lg` height, padding `xl`, stacking its children with a `sm` gap" — than as a
// raw Tailwind string. So authoring keeps that vocabulary as an INPUT DTO
// (`BoxStyle` / `LayoutStyle`); this module compiles it down to the Tailwind-
// native `class` string the node actually carries (plus the handful of props the
// renderer needs for a dynamic background image — a URL can't be a static class).
//
// This is the ONLY place the old box/layout semantics survive, and only as a
// build-time convenience: nothing here ships to the runtime node beyond a class
// string + bg props. The output utilities are exactly what a power user or an AI
// agent would type, and they compile through @sparx/surface-compile to the
// tenant `--sf-*` tokens.

import type { BuilderNode } from './node';

// ── Authoring vocabulary (input only — never persisted) ───────────────────────

/** The semantic "box base" a seed author describes. Every field optional; the
 *  converter maps each to native utilities (or, for a dynamic background image,
 *  to node props). `name` is lifted to the node's top-level label. */
export interface BoxStyle {
  name?: string;
  height?: 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Does the surface/background span edge-to-edge (`full`) or hug the content. */
  backgroundWidth?: 'full' | 'contained';
  /** Does the CONTENT span full width or sit in the centered `max-w-site` column. */
  contentWidth?: 'full' | 'contained';
  surface?: 'none' | 'subtle' | 'muted' | 'inverse' | 'brand';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Text alignment of the block's content. */
  align?: 'start' | 'center' | 'end';
  /** A full-bleed background image URL — kept as a node prop (a URL is data, not a
   *  utility class; the allowlist blocks `url()` in classes). */
  backgroundImage?: string;
  /** A data-aware background: a binding path resolved per record (e.g.
   *  `product.images`). Kept as a node prop, read by the renderer. */
  backgroundImageBinding?: string;
  /** A scrim over the background image for legibility. */
  overlay?: 'none' | 'dark' | 'light' | 'gradient';
  /** Text color over a photo, decoupled from `surface`. */
  textTone?: 'default' | 'light' | 'dark';
  backgroundFit?: 'cover' | 'contain';
  backgroundPosition?:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
  /** `top` floats the block over the one below it (the overlay-header case). */
  pin?: 'none' | 'top';
}

/** How a container arranges its children. */
export interface LayoutStyle {
  direction?: 'stack' | 'row' | 'grid';
  /** Column count when `direction === 'grid'`. */
  columns?: number;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  justify?: 'start' | 'center' | 'end' | 'between';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
}

// The container primitives — mirrors the renderer's CONTAINERS set. Used to decide
// whether contained-width / inner-wrapping applies (leaves never carry max-w-site).
const CONTAINER_TYPES = new Set(['Section', 'Grid', 'Stack', 'Card', 'Carousel', 'ProductForm']);
export function isSeedContainer(type: string): boolean {
  return CONTAINER_TYPES.has(type);
}

// ── Background props (a dynamic background image is DATA, not a class) ──────────

/** The node props a background carries — read by the renderers to paint a photo
 *  panel (the one legitimate inline-style case: a per-node/per-record URL). Empty
 *  object when the box has no background image. */
export function boxBgProps(box: BoxStyle | undefined): Record<string, unknown> {
  if (!box) return {};
  const out: Record<string, unknown> = {};
  if (box.backgroundImage) out.bgImage = box.backgroundImage;
  if (box.backgroundImageBinding) out.bgImageBinding = box.backgroundImageBinding;
  if (box.overlay && box.overlay !== 'none') out.bgOverlay = box.overlay;
  if (box.backgroundFit && box.backgroundFit !== 'cover') out.bgFit = box.backgroundFit;
  if (box.backgroundPosition && box.backgroundPosition !== 'center')
    out.bgPosition = box.backgroundPosition;
  return out;
}

// ── Token maps ─────────────────────────────────────────────────────────────────

const SURFACE_CLASS: Record<NonNullable<BoxStyle['surface']>, string> = {
  none: '',
  subtle: 'bg-base-200',
  muted: 'bg-base-300',
  inverse: 'bg-neutral text-neutral-content',
  brand: 'bg-primary text-primary-content',
};

// Section heights as viewport fractions (arbitrary values are allowed by the
// allowlist; only `fixed` / `z-[…]` / `content-[…]` / `url()` are blocked).
const HEIGHT_CLASS: Record<NonNullable<BoxStyle['height']>, string> = {
  auto: '',
  sm: 'min-h-[25vh]',
  md: 'min-h-[50vh]',
  lg: 'min-h-[75vh]',
  xl: 'min-h-[90vh]',
  full: 'min-h-screen',
};

const PADDING_CLASS: Record<NonNullable<BoxStyle['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-10',
  xl: 'p-16',
};

const ALIGN_CLASS: Record<NonNullable<BoxStyle['align']>, string> = {
  start: '',
  center: 'text-center',
  end: 'text-right',
};

const TONE_CLASS: Record<NonNullable<BoxStyle['textTone']>, string> = {
  default: '',
  light: 'text-white',
  dark: 'text-black',
};

const GAP_CLASS: Record<NonNullable<LayoutStyle['gap']>, string> = {
  none: '',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

const JUSTIFY_CLASS: Record<NonNullable<LayoutStyle['justify']>, string> = {
  start: '',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

const ITEMS_CLASS: Record<NonNullable<LayoutStyle['alignItems']>, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: '',
};

/** Responsive grid columns — single column on a narrow container, stepping up as
 *  the container widens (container queries key off the node's own width, docs/61
 *  §7). Mirrors the old `responsiveCols` (1 → 2 → N). */
function gridColumnsClass(columns: number | undefined): string {
  const n = Math.max(1, Math.min(6, columns ?? 3));
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-1 @3xl:grid-cols-2';
  return `grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-${n}`;
}

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// ── Class fragments ────────────────────────────────────────────────────────────

/** The "band" utilities — the full-bleed backdrop concerns (surface, height, text
 *  tone over a photo, overlay-header pin). When a node splits into outer band +
 *  inner content these ride the outer. */
function bandClasses(box: BoxStyle | undefined): string {
  if (!box) return '';
  return cx(
    box.surface ? SURFACE_CLASS[box.surface] : '',
    box.height ? HEIGHT_CLASS[box.height] : '',
    box.textTone ? TONE_CLASS[box.textTone] : '',
    box.pin === 'top' ? 'absolute inset-x-0 top-0 z-40 w-full' : ''
  );
}

/** The "content" utilities — how the block lays out its children + its own spacing
 *  and text alignment. When a node splits these ride the inner content wrapper. */
function contentClasses(
  box: BoxStyle | undefined,
  layout: LayoutStyle | undefined,
  isContainer: boolean
): string {
  let flow = '';
  if (isContainer && layout) {
    if (layout.direction === 'grid') {
      flow = cx('grid', gridColumnsClass(layout.columns));
    } else if (layout.direction === 'row') {
      // Rows stack on a narrow container and flow inline once it's wide enough
      // (responsive by default, docs/61). `wrap` lets a wide inline row wrap.
      flow = cx('flex flex-col @3xl:flex-row', layout.wrap ? 'flex-wrap' : '');
    } else {
      flow = 'flex flex-col';
    }
  }
  return cx(
    flow,
    layout?.gap ? GAP_CLASS[layout.gap] : '',
    layout?.justify ? JUSTIFY_CLASS[layout.justify] : '',
    layout?.alignItems ? ITEMS_CLASS[layout.alignItems] : '',
    box?.padding ? PADDING_CLASS[box.padding] : '',
    box?.align ? ALIGN_CLASS[box.align] : ''
  );
}

// ── Public: single-element class (fresh drops, registry defaults) ─────────────

/** Compile a box+layout description to ONE merged class string — the path used for
 *  a freshly dropped palette node (no structural wrapping). Width: a container with
 *  contained content gets the centered `max-w-site` column; a full-bleed background
 *  gets `w-full`. */
export function boxLayoutClass(
  box: BoxStyle | undefined,
  layout: LayoutStyle | undefined,
  type: string
): string {
  const isContainer = isSeedContainer(type);
  const fullBleed = box?.backgroundWidth === 'full';
  const contained = isContainer && box?.contentWidth !== 'full';
  return cx(
    fullBleed ? 'w-full' : '',
    contained ? 'mx-auto w-full max-w-site' : '',
    bandClasses(box),
    contentClasses(box, layout, isContainer)
  );
}

// ── Public: the seed node factory (starters + blueprints) ─────────────────────

export interface SeedNodeOpts {
  box?: BoxStyle;
  layout?: LayoutStyle;
  props?: Record<string, unknown>;
  /** A data binding path. */
  bind?: string;
  /** Extra verbatim classes (e.g. a recipe/archetype seed). */
  cls?: string;
  /** Author label, surfaced in the Layers tree (or set via `box.name`). */
  name?: string;
  children?: BuilderNode[];
}

/** Build a runtime node from the authoring vocabulary, compiling box+layout to a
 *  class string. A full-bleed band whose CONTENT is contained splits into an outer
 *  band (background + height, full width) wrapping an inner `max-w-site` content
 *  column — the one structural case a single element can't express (a full-bleed
 *  background and a centered content column at once). Everything else is one
 *  element. The binding + name + background props ride the outer node. */
export function seedNode(id: string, type: string, opts: SeedNodeOpts = {}): BuilderNode {
  const { box, layout } = opts;
  const isContainer = isSeedContainer(type);
  const bg = boxBgProps(box);
  const name = opts.name ?? box?.name;
  const props = { ...(opts.props ?? {}), ...bg };

  const fullBleed = box?.backgroundWidth === 'full';
  const contained = box?.contentWidth !== 'full';
  const band = bandClasses(box);
  const hasBand = band !== '' || Boolean(bg.bgImage) || Boolean(bg.bgImageBinding);

  // Genuine two-element case: a full-bleed backdrop with a contained content
  // column. The inner is a plain Stack-flow wrapper carrying the layout + padding;
  // a band with a fixed height centers that column vertically (the hero case).
  if (isContainer && fullBleed && contained && hasBand) {
    const inner: BuilderNode = {
      id: `${id}__c`,
      type: 'Stack',
      class: cx('mx-auto w-full max-w-site', contentClasses(box, layout, true)),
      props: {},
    };
    if (opts.children) inner.children = opts.children;
    const centered = box?.height && box.height !== 'auto' ? 'flex items-center justify-center' : '';
    const outer: BuilderNode = {
      id,
      type,
      class: cx('w-full', centered, band, opts.cls),
      props,
    };
    if (name) outer.name = name;
    if (opts.bind) outer.binding = { path: opts.bind };
    outer.children = [inner];
    return outer;
  }

  // Single element.
  const cls = cx(
    fullBleed ? 'w-full' : '',
    isContainer && contained ? 'mx-auto w-full max-w-site' : '',
    band,
    contentClasses(box, layout, isContainer),
    opts.cls
  );
  const node: BuilderNode = { id, type, props };
  if (cls) node.class = cls;
  if (name) node.name = name;
  if (opts.bind) node.binding = { path: opts.bind };
  if (opts.children) node.children = opts.children;
  return node;
}
