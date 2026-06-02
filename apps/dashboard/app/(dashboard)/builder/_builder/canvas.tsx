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
  const bgFull = b.backgroundWidth === 'full';
  const contentContained = b.contentWidth === 'contained';
  const minHeight = def.kind === 'container' ? HEIGHT_VH[b.height] : undefined;
  const hasHeight = Boolean(minHeight);
  // Background media lives on whichever element owns the background WIDTH: the
  // full-bleed outer when edge-to-edge, else the contained inner.
  const image = b.backgroundImage;
  const overlay = b.overlay ?? 'none';
  const tone = b.textTone ?? 'default';

  const outer: React.CSSProperties = {
    position: 'relative',
    minHeight,
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
}

function CanvasNode({ node, scope, catalog, device, selectedId, onSelect }: NodeProps) {
  const def = getDef(node.type);
  if (!def) return null;

  const bound = Boolean(node.binding);
  const value = bound ? resolvePath(scope, node.binding!.path) : undefined;
  const card: Cardinality = bound ? cardinalityOf(value) : 'empty';

  const selected = node.id === selectedId;
  const hidden = node.box.hiddenOn.includes(device);
  const { outer, inner } = boxStyles(node, def);

  let body: React.ReactNode;
  if (def.kind === 'container') {
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
          />
        ))
      );
    }
  } else {
    body = def.renderLeaf?.({ node, value, cardinality: card, bound }) ?? null;
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
}

const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 834, mobile: 390 };

export function Canvas({ tree, data, catalog, device, selectedId, onSelect }: CanvasProps) {
  const width = DEVICE_WIDTH[device];
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
      >
        <CanvasNode
          node={tree}
          scope={{ root: data }}
          catalog={catalog}
          device={device}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
