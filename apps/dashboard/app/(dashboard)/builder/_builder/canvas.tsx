'use client';

// The canvas — renders the node tree into a live preview and owns the
// universal concerns the registry deliberately doesn't: the box base
// (height / width modes / surface / padding / align / visibility), the layout
// arrangement, binding resolution, ITERATION (an array-bound container repeats
// its children once per item, with `item` scope), and click-to-select.
//
// A node definition only describes what's specific to itself; everything that
// is true of EVERY node lives here. That separation is what keeps the model
// from feeling disjointed.

import * as React from 'react';
import { cn } from '@sparx/ui';
import type { BindingCatalog } from '@sparx/builder-schemas';

import {
  cardinalityOf,
  resolvePath,
  type AlignX,
  type BuilderNode,
  type Cardinality,
  type Device,
  type GapScale,
  type HeightScale,
  type Justify,
  type Scope,
  type SpaceScale,
  type Surface,
} from './model';
import { moduleColor, moduleForPath } from './binding-catalog';
import { getDef, type ComponentDef } from './registry';

// ── Box-base → CSS ───────────────────────────────────────────────────────────

const HEIGHT_VH: Record<HeightScale, string | undefined> = {
  auto: undefined,
  sm: '25vh',
  md: '50vh',
  lg: '75vh',
  full: '100vh',
};

const PADDING_PX: Record<SpaceScale, number> = { none: 0, sm: 12, md: 24, lg: 40, xl: 72 };
const GAP_PX: Record<GapScale, number> = { none: 0, sm: 8, md: 16, lg: 24 };
const CONTAINED_MAX = 1120;

interface SurfaceCss {
  bg: string;
  fg?: string;
}
// Surfaces resolve to the TENANT theme variables (see builder.css `.bx-canvas`),
// not hardcoded colors — so the canvas renders in the merchant's brand.
const SURFACE: Record<Surface, SurfaceCss> = {
  none: { bg: 'transparent' },
  subtle: { bg: 'var(--bxc-subtle)' },
  muted: { bg: 'var(--bxc-muted)' },
  inverse: { bg: 'var(--bxc-inverse-bg)', fg: 'var(--bxc-inverse-fg)' },
  brand: { bg: 'var(--bxc-primary)', fg: 'var(--bxc-primary-fg)' },
};

// Background-media scrims (docs/45) — a translucent veil layered OVER the photo
// (below content) so overlaid text stays legible. `gradient` darkens top+bottom
// (header + CTA zones) while leaving the photo's center clean — the hero case.
const SCRIM: Record<string, string | null> = {
  none: null,
  dark: 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))',
  light: 'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55))',
  gradient:
    'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.04) 28%, rgba(0,0,0,0.04) 62%, rgba(0,0,0,0.6))',
};
// Text color over a photo, decoupled from the surface tokens.
const TONE: Record<string, string | undefined> = {
  default: undefined,
  light: '#ffffff',
  dark: '#0b0b0c',
};

/** Background CSS for the element that owns the box's background width: a photo
 *  (scrim layered above it) when set, else the surface token color. */
function bgProps(
  image: string | undefined,
  overlay: string,
  colorBase: string
): React.CSSProperties {
  if (!image) return { background: colorBase };
  const url = `url("${image.replace(/["\\]/g, '')}")`;
  const scrim = SCRIM[overlay];
  return {
    backgroundImage: scrim ? `${scrim}, ${url}` : url,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

const FLEX_ALIGN: Record<AlignX | 'stretch', string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};
const FLEX_JUSTIFY: Record<Justify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};

function layoutStyle(node: BuilderNode): React.CSSProperties {
  const l = node.layout;
  if (!l) return {};
  const gap = GAP_PX[l.gap];
  if (l.direction === 'grid') {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, l.columns)}, minmax(0, 1fr))`,
      gap,
    };
  }
  return {
    display: 'flex',
    flexDirection: l.direction === 'row' ? 'row' : 'column',
    flexWrap: l.direction === 'row' && l.wrap ? 'wrap' : 'nowrap',
    gap,
    alignItems: FLEX_ALIGN[l.alignItems],
    justifyContent: FLEX_JUSTIFY[l.justify],
  };
}

/** The outer (full-bleed) and inner (content) styles that realize the box base,
 *  including the independent background-width / content-width axes. */
function boxStyles(
  node: BuilderNode,
  def: ComponentDef
): { outer: React.CSSProperties; inner: React.CSSProperties } {
  const b = node.box;
  const surface = SURFACE[b.surface];
  // An Outlet is a width passthrough — the routed page owns its width, so never
  // cap it (parity with the storefront renderer; a `contained` Outlet would
  // silently constrain every page rendered into it).
  const isOutlet = node.type === 'Outlet';
  const bgFull = isOutlet || b.backgroundWidth === 'full';
  const contentContained = !isOutlet && b.contentWidth === 'contained';
  const minHeight = def.kind === 'container' ? HEIGHT_VH[b.height] : undefined;
  const hasHeight = Boolean(minHeight);
  // Background media lives on whichever element owns the background WIDTH: the
  // full-bleed outer when edge-to-edge, else the contained inner.
  const image = b.backgroundImage;
  const overlay = b.overlay ?? 'none';
  const tone = b.textTone ?? 'default';
  // `pin: top` lifts the block out of flow so the next block slides under it
  // (overlay header). It anchors to the nearest positioned ancestor — every
  // node's outer is `relative`, so it pins to the top of its parent.
  const pinned = b.pin === 'top';

  const outer: React.CSSProperties = {
    position: pinned ? 'absolute' : 'relative',
    ...(pinned ? { top: 0, left: 0, right: 0, zIndex: 40, width: '100%' } : { minHeight }),
    ...(bgFull ? bgProps(image, overlay, surface.bg) : { background: 'transparent' }),
    display: 'flex',
    justifyContent: contentContained ? 'center' : 'flex-start',
    alignItems: hasHeight ? 'center' : 'stretch',
  };

  const inner: React.CSSProperties = {
    width: '100%',
    maxWidth: contentContained ? CONTAINED_MAX : undefined,
    padding: PADDING_PX[b.padding],
    textAlign: b.align,
    color: TONE[tone] ?? surface.fg,
    ...(!bgFull ? bgProps(image, overlay, surface.bg) : { background: 'transparent' }),
    ...(def.kind === 'container' ? layoutStyle(node) : {}),
  };

  return { outer, inner };
}

// ── The recursive node ───────────────────────────────────────────────────────

interface NodeProps {
  node: BuilderNode;
  scope: Scope;
  catalog: BindingCatalog;
  device: Device;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Locked = render as a non-interactive backdrop (no selection chrome, not
   *  clickable). Used to frame the page editor in its site layout. */
  locked?: boolean;
  /** What to render where an `Outlet` node sits (the editable page subtree when
   *  framing). Propagated down the locked chrome tree until the Outlet consumes
   *  it. */
  outletSlot?: React.ReactNode;
}

// In the editor a Carousel renders as a REAL carousel (active slide + arrows +
// dots) so the preview matches the storefront — "what you see is what you ship."
// Slides stay mounted (translated off-screen), so each is still selectable from
// the Layers panel; control clicks don't bubble to node selection.
function CanvasCarousel({ slides }: { slides: React.ReactNode[] }) {
  const [index, setIndex] = React.useState(0);
  const n = slides.length;
  const go = (next: number) => setIndex(((next % n) + n) % n);
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  if (n === 0) return <div className="bx-empty">Carousel — add slides (each child is a slide)</div>;
  return (
    <div className="bx-ccarousel">
      <div className="bx-ccarousel__viewport">
        <div className="bx-ccarousel__track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((slide, i) => (
            <div className="bx-ccarousel__slide" key={i}>
              {slide}
            </div>
          ))}
        </div>
      </div>
      <span className="bx-ccarousel__badge">
        Carousel · {n} {n === 1 ? 'slide' : 'slides'}
      </span>
      {n > 1 ? (
        <>
          <button
            type="button"
            className="bx-ccarousel__arrow bx-ccarousel__arrow--prev"
            aria-label="Previous slide"
            onClick={stop(() => go(index - 1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="bx-ccarousel__arrow bx-ccarousel__arrow--next"
            aria-label="Next slide"
            onClick={stop(() => go(index + 1))}
          >
            ›
          </button>
          <div className="bx-ccarousel__dots">
            {slides.map((_, i) => (
              <button
                type="button"
                key={i}
                className="bx-ccarousel__dot"
                data-on={i === index}
                aria-label={`Go to slide ${i + 1}`}
                onClick={stop(() => go(i))}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CanvasNode({
  node,
  scope,
  catalog,
  device,
  selectedId,
  onSelect,
  locked,
  outletSlot,
}: NodeProps) {
  const def = getDef(node.type);
  if (!def) return null;

  const bound = Boolean(node.binding);
  const value = bound ? resolvePath(scope, node.binding!.path) : undefined;
  const card: Cardinality = bound ? cardinalityOf(value) : 'empty';

  const selected = node.id === selectedId;
  const hidden = node.box.hiddenOn.includes(device);
  const { outer, inner } = boxStyles(node, def);

  let body: React.ReactNode;
  if (node.type === 'Outlet' && outletSlot !== undefined) {
    // Framing the page editor: the layout is a locked backdrop and the editable
    // page subtree drops in here, exactly where the storefront mounts it.
    body = outletSlot;
  } else if (def.kind === 'container' && node.type === 'Carousel') {
    // A Carousel renders as a real carousel (each child = a slide). Mirrors the
    // storefront's iterate-or-static behaviour so the preview is faithful.
    const kids = node.children ?? [];
    // A carousel with an explicit height GOVERNS its slides: each slide adopts the
    // carousel's height so the hero is exactly that tall. Without this a `full`
    // slide dominates a `3/4` carousel (min-height can't shrink a taller child).
    // `auto` leaves each slide its own height (carousel sizes to the tallest).
    const slideOf = (child: BuilderNode): BuilderNode =>
      node.box.height !== 'auto'
        ? { ...child, box: { ...child.box, height: node.box.height } }
        : child;
    let slideNodes: React.ReactNode[];
    if (bound && card === 'array') {
      slideNodes = (value as unknown[]).flatMap((item, i) =>
        kids.map((child) => (
          <CanvasNode
            key={`${i}:${child.id}`}
            node={slideOf(child)}
            scope={{ ...scope, item, index: i }}
            catalog={catalog}
            device={device}
            selectedId={selectedId}
            onSelect={onSelect}
            locked={locked}
            outletSlot={outletSlot}
          />
        ))
      );
    } else {
      const s: Scope = bound && card === 'object' ? { ...scope, item: value } : scope;
      slideNodes = kids.map((child) => (
        <CanvasNode
          key={child.id}
          node={slideOf(child)}
          scope={s}
          catalog={catalog}
          device={device}
          selectedId={selectedId}
          onSelect={onSelect}
          locked={locked}
          outletSlot={outletSlot}
        />
      ));
    }
    body = <CanvasCarousel slides={slideNodes} />;
  } else if (def.kind === 'container') {
    const kids = node.children ?? [];
    let scopes: { s: Scope; key: string }[];
    if (bound && card === 'array') {
      scopes = (value as unknown[]).map((item, i) => ({
        s: { ...scope, item, index: i },
        key: `i${i}`,
      }));
    } else if (bound && card === 'object') {
      scopes = [{ s: { ...scope, item: value }, key: 'o' }];
    } else {
      scopes = [{ s: scope, key: 's' }];
    }

    if (bound && card === 'array' && scopes.length === 0) {
      body = <div className="bx-empty">Nothing to show — the list is empty</div>;
    } else {
      body = scopes.flatMap(({ s, key }) =>
        kids.map((child) => (
          <CanvasNode
            key={`${key}:${child.id}`}
            node={child}
            scope={s}
            catalog={catalog}
            device={device}
            selectedId={selectedId}
            onSelect={onSelect}
            locked={locked}
            outletSlot={outletSlot}
          />
        ))
      );
    }
  } else {
    body = def.renderLeaf?.({ node, value, cardinality: card, bound }) ?? null;
  }

  if (locked) {
    // Locked chrome backdrop (page editor framing): faithful box + body, but no
    // selection tag, no outline, not clickable. Device-hidden nodes still hide.
    return (
      <div
        className={cn('bx-node', 'bx-chrome', hidden && 'bx-node--hidden')}
        style={outer}
        data-node-id={node.id}
        data-bx-type={node.type}
      >
        <div className={cn('bx-inner', def.kind === 'container' && def.chromeClass)} style={inner}>
          {body}
        </div>
      </div>
    );
  }

  const iterating = def.kind === 'container' && bound && card === 'array';
  const count = Array.isArray(value) ? value.length : 0;

  return (
    <div
      className={cn('bx-node', selected && 'bx-node--selected', hidden && 'bx-node--hidden')}
      style={outer}
      data-node-id={node.id}
      role="button"
      tabIndex={-1}
      aria-label={node.box.name ?? def.label}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onSelect(node.id);
        }
      }}
    >
      <span className="bx-tag">
        <span className="bx-tag__name">{node.box.name ?? def.label}</span>
        {bound ? (
          <span
            className="bx-tag__bind"
            style={{ color: moduleColor(moduleForPath(catalog, node.binding!.path)) }}
          >
            <span
              className="bx-tag__dot"
              style={{ background: moduleColor(moduleForPath(catalog, node.binding!.path)) }}
            />
            {node.binding!.path}
          </span>
        ) : null}
        {iterating ? <span className="bx-tag__repeat">↻ {count}</span> : null}
        {hidden ? <span className="bx-tag__hidden">hidden · {device}</span> : null}
      </span>
      <div className={cn('bx-inner', def.kind === 'container' && def.chromeClass)} style={inner}>
        {body}
      </div>
    </div>
  );
}

// ── Public canvas ────────────────────────────────────────────────────────────

export interface CanvasProps {
  tree: BuilderNode;
  data: Scope['root'];
  catalog: BindingCatalog;
  device: Device;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The site layout tree (page editor only). When present, the page is framed
   *  inside it: the layout renders as a locked backdrop and `tree` is dropped at
   *  the layout's Outlet — the same composition the storefront ships, so the
   *  overlay header/footer preview correctly. */
  chrome?: BuilderNode | null;
}

const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 834, mobile: 390 };

export function Canvas({ tree, data, catalog, device, selectedId, onSelect, chrome }: CanvasProps) {
  const width = DEVICE_WIDTH[device];
  // The editable page subtree — fully selectable. When framing, it's handed to
  // the locked chrome tree to render at the Outlet; otherwise it's the root.
  const page = (
    <CanvasNode
      node={tree}
      scope={{ root: data }}
      catalog={catalog}
      device={device}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
  return (
    <div
      className="bx-canvas-scroll"
      role="button"
      tabIndex={-1}
      aria-label="Clear selection"
      onClick={() => onSelect(null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onSelect(null);
      }}
    >
      <div
        className="bx-canvas"
        data-theme="light"
        style={width ? { width, maxWidth: '100%' } : undefined}
        data-device={device}
        data-framed={chrome ? '' : undefined}
      >
        {chrome ? (
          <CanvasNode
            node={chrome}
            scope={{ root: data }}
            catalog={catalog}
            device={device}
            selectedId={selectedId}
            onSelect={onSelect}
            locked
            outletSlot={page}
          />
        ) : (
          page
        )}
      </div>
    </div>
  );
}
