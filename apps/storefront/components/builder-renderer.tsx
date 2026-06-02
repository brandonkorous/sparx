// Renders a published Builder node tree to production storefront markup
// (docs/44 §2.3). Distinct from the dashboard editor canvas: no selection
// chrome, semantic output, mapped to the live `--sf-*` tenant theme tokens
// (the editor maps the same box/layout semantics to `--bxc-*`).
//
// SLICE A.2 — BINDING-AWARE: bound nodes resolve against REAL records (passed in
// as `data`) through the shared resolver. An array-bound container iterates its
// children once per record (item scope); an object-bound container sets scope
// and renders once; leaves resolve their bound value (text / richtext / price /
// image). Unbound leaves render their own props (the A.1 static path). The CRM
// Signup + per-record collection templates land in Slice B.

import * as React from 'react';
import {
  cardinalityOf,
  resolvePath,
  type AlignX,
  type BoxBase,
  type BuilderNode,
  type Cardinality,
  type DataSources,
  type GapScale,
  type HeightScale,
  type Justify,
  type LayoutBase,
  type Scope,
  type SpaceScale,
  type Surface,
} from '@sparx/builder-schemas';

// ── Box-base → CSS (mirrors the editor canvas scales, --sf-* tokens) ──────────

const HEIGHT_VH: Record<HeightScale, string | undefined> = {
  auto: undefined,
  sm: '25vh',
  md: '50vh',
  lg: '75vh',
  full: '100vh',
};
const PADDING: Record<SpaceScale, string> = {
  none: '0',
  sm: '0.75rem',
  md: '1.5rem',
  lg: '2.5rem',
  xl: '4.5rem',
};
const GAP: Record<GapScale, string> = { none: '0', sm: '0.5rem', md: '1rem', lg: '1.5rem' };

const SURFACE: Record<Surface, { bg: string; fg?: string }> = {
  none: { bg: 'transparent' },
  subtle: { bg: 'var(--sf-base-200)' },
  muted: { bg: 'var(--sf-base-300)' },
  inverse: { bg: 'var(--sf-base-content)', fg: 'var(--sf-base-100)' },
  brand: { bg: 'var(--sf-primary)', fg: 'var(--sf-primary-content)' },
};

// Background-media scrims (docs/45) — mirror the editor canvas. A translucent
// veil over the photo (below content) for text legibility; `gradient` darkens
// top+bottom (the full-bleed hero case).
const SCRIM: Record<string, string | null> = {
  none: null,
  dark: 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))',
  light: 'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55))',
  gradient:
    'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.04) 28%, rgba(0,0,0,0.04) 62%, rgba(0,0,0,0.6))',
};
const TONE: Record<string, string | undefined> = {
  default: undefined,
  light: '#ffffff',
  dark: '#0b0b0c',
};

/** Background CSS for the element owning the box's background width: a photo
 *  (scrim layered above) when set, else the surface token color. */
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

const FLEX_ALIGN: Record<string, string> = {
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
const TEXT_ALIGN: Record<AlignX, 'left' | 'center' | 'right'> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

const CONTAINERS = new Set(['Section', 'Grid', 'Stack', 'Card']);

function layoutStyle(layout: LayoutBase): React.CSSProperties {
  const gap = GAP[layout.gap];
  if (layout.direction === 'grid') {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, layout.columns)}, minmax(0, 1fr))`,
      gap,
    };
  }
  return {
    display: 'flex',
    flexDirection: layout.direction === 'row' ? 'row' : 'column',
    flexWrap: layout.direction === 'row' && layout.wrap ? 'wrap' : 'nowrap',
    gap,
    alignItems: FLEX_ALIGN[layout.alignItems] ?? 'stretch',
    justifyContent: FLEX_JUSTIFY[layout.justify] ?? 'flex-start',
  };
}

function boxStyles(
  box: BoxBase,
  isContainer: boolean
): { outer: React.CSSProperties; inner: React.CSSProperties } {
  const surface = SURFACE[box.surface];
  const bgFull = box.backgroundWidth === 'full';
  const contentContained = box.contentWidth === 'contained';
  const minHeight = isContainer ? HEIGHT_VH[box.height] : undefined;
  const hasHeight = Boolean(minHeight);
  const image = box.backgroundImage;
  const overlay = box.overlay ?? 'none';
  const tone = box.textTone ?? 'default';

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
    maxWidth: contentContained ? 'var(--sf-max)' : undefined,
    padding: PADDING[box.padding],
    textAlign: TEXT_ALIGN[box.align],
    color: TONE[tone] ?? surface.fg,
    ...(!bgFull ? bgProps(image, overlay, surface.bg) : { background: 'transparent' }),
  };
  return { outer, inner };
}

// ── Bound-value coercion ─────────────────────────────────────────────────────

function docToPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { text?: string; content?: unknown[] };
  if (typeof n.text === 'string') return n.text;
  if (Array.isArray(n.content)) return n.content.map(docToPlainText).join(' ');
  return '';
}

/** A bound value as display text: a string as-is, a number stringified, a
 *  rich-text doc flattened to plain text (full rich rendering is Slice B). */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && (value as { type?: string }).type === 'doc') {
    return docToPlainText(value);
  }
  return '';
}

/** The first image of a bound image/images value, or null. */
function firstImage(value: unknown): { url?: string; alt?: string } | null {
  const candidate = Array.isArray(value) ? (value as unknown[])[0] : value;
  if (candidate && typeof candidate === 'object') return candidate;
  return null;
}

// ── Leaf rendering ─────────────────────────────────────────────────────────

const HEADING_SIZE: Record<string, string> = { h1: '2.5rem', h2: '1.75rem', h3: '1.25rem' };

function headingStyle(level: string): React.CSSProperties {
  return {
    fontFamily: 'var(--sf-font-heading)',
    fontWeight: 600,
    lineHeight: 1.15,
    fontSize: HEADING_SIZE[level] ?? '1.75rem',
    margin: 0,
  };
}
function textStyle(variant: string): React.CSSProperties {
  if (variant === 'eyebrow') {
    return {
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: 'var(--sf-primary)',
      margin: 0,
    };
  }
  if (variant === 'meta') return { fontSize: '0.85rem', color: 'var(--sf-text-muted)', margin: 0 };
  return { fontSize: '1rem', lineHeight: 1.6, color: 'inherit', margin: 0 };
}
function buttonStyle(style: string): React.CSSProperties {
  if (style === 'link') {
    return { color: 'var(--sf-primary)', textDecoration: 'underline', fontWeight: 600 };
  }
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--sf-radius-field)',
    fontWeight: 600,
    fontSize: '0.95rem',
  };
  if (style === 'soft')
    return { ...base, background: 'var(--sf-base-200)', color: 'var(--sf-primary)' };
  return { ...base, background: 'var(--sf-primary)', color: 'var(--sf-primary-content)' };
}
function ratioOf(r: string): string {
  return r === 'square' ? '1 / 1' : r === 'portrait' ? '3 / 4' : '16 / 9';
}

function renderLeaf(node: BuilderNode, value: unknown, bound: boolean): React.ReactNode {
  const p = node.props;
  const str = (k: string): string => (typeof p[k] === 'string' ? p[k] : '');
  switch (node.type) {
    case 'Heading': {
      const level = str('level') || 'h2';
      const Tag = (level === 'h1' ? 'h1' : level === 'h3' ? 'h3' : 'h2') as 'h1';
      return <Tag style={headingStyle(level)}>{bound ? asText(value) : str('text')}</Tag>;
    }
    case 'Text':
      return (
        <p style={textStyle(str('variant') || 'body')}>{bound ? asText(value) : str('text')}</p>
      );
    case 'Button': {
      const label = (bound ? asText(value) : '') || str('label') || 'Button';
      return <span style={buttonStyle(str('style') || 'primary')}>{label}</span>;
    }
    case 'Divider':
      return (
        <hr
          style={{ border: 0, borderTop: '1px solid var(--sf-border)', width: '100%', margin: 0 }}
        />
      );
    case 'PriceTag': {
      const n = typeof value === 'number' ? value : null;
      return <span style={{ fontWeight: 600 }}>{n != null ? `$${n.toFixed(2)}` : ''}</span>;
    }
    case 'Image':
    case 'ImageDisplay': {
      const ratio = ratioOf(str('ratio'));
      const img = bound ? firstImage(value) : null;
      if (img?.url) {
        // Plain <img>: media URLs 302-redirect to GCS; next/image optimization
        // is a later pass (consistent with the rest of the storefront).
        return (
          <img
            src={img.url}
            alt={img.alt ?? str('alt')}
            style={{
              width: '100%',
              aspectRatio: ratio,
              objectFit: 'cover',
              borderRadius: 'var(--sf-radius-box)',
              display: 'block',
            }}
          />
        );
      }
      return (
        <div
          role="img"
          aria-label={img?.alt ?? str('alt')}
          style={{
            width: '100%',
            aspectRatio: ratio,
            background: 'var(--sf-base-300)',
            borderRadius: 'var(--sf-radius-box)',
          }}
        />
      );
    }
    // ── Site chrome (docs/45) ────────────────────────────────────────────────
    case 'Logo': {
      const identity =
        value && typeof value === 'object' ? (value as { name?: unknown; logo?: unknown }) : null;
      const name = typeof identity?.name === 'string' ? identity.name : '';
      const img = firstImage(identity?.logo);
      return (
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          {img?.url ? (
            <img
              src={img.url}
              alt={img.alt ?? name}
              style={{ height: '2rem', width: 'auto', display: 'block' }}
            />
          ) : (
            <span
              style={{
                fontFamily: 'var(--sf-font-heading)',
                fontWeight: 700,
                fontSize: '1.25rem',
                letterSpacing: '-0.02em',
              }}
            >
              {name || 'Brand'}
            </span>
          )}
        </a>
      );
    }
    case 'NavMenu': {
      const orientation = str('orientation') || 'row';
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      return (
        <nav
          style={{
            display: 'flex',
            flexDirection: orientation === 'stack' ? 'column' : 'row',
            gap: orientation === 'stack' ? '0.5rem' : '1.25rem',
            flexWrap: 'wrap',
            alignItems: orientation === 'stack' ? 'flex-start' : 'center',
          }}
        >
          {items.map((it, i) => {
            const label = typeof it.label === 'string' ? it.label : '';
            const url = typeof it.url === 'string' ? it.url : '#';
            if (!label) return null;
            return (
              <a
                key={`${i}-${label}`}
                href={url}
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                }}
              >
                {label}
              </a>
            );
          })}
        </nav>
      );
    }
    case 'SocialLinks': {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      if (items.length === 0) return null;
      return (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {items.map((it, i) => {
            const platform = typeof it.platform === 'string' ? it.platform : '';
            const url = typeof it.url === 'string' ? it.url : '#';
            return (
              <a
                key={`${i}-${platform}`}
                href={url}
                aria-label={platform || 'social link'}
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  textTransform: 'capitalize',
                }}
              >
                {platform}
              </a>
            );
          })}
        </div>
      );
    }
    // Outlet is handled in RenderNode (it renders the routed page, not a leaf
    // value); Signup (interactive) lands later.
    default:
      return null;
  }
}

// ── Recursive node ───────────────────────────────────────────────────────────

function RenderNode({
  node,
  scope,
  outlet,
}: {
  node: BuilderNode;
  scope: Scope;
  /** The routed page content, rendered where an `Outlet` node sits (site layout
   *  only — undefined when rendering a page tree, which has no Outlet). */
  outlet?: React.ReactNode;
}): React.ReactNode {
  const isContainer = CONTAINERS.has(node.type);
  const bound = Boolean(node.binding);
  const value = bound ? resolvePath(scope, node.binding!.path) : undefined;
  const card: Cardinality = bound ? cardinalityOf(value) : 'empty';

  const { outer, inner } = boxStyles(node.box, isContainer);
  const innerStyle = isContainer && node.layout ? { ...inner, ...layoutStyle(node.layout) } : inner;

  let body: React.ReactNode;
  if (node.type === 'Outlet') {
    // The content outlet: render the routed page here (docs/45 §2.6).
    body = outlet ?? null;
  } else if (isContainer) {
    const kids = node.children ?? [];
    if (bound && card === 'array') {
      // Iterate: each record scopes its subtree to `item`.
      body = (value as unknown[]).flatMap((item, i) =>
        kids.map((child) => (
          <RenderNode
            key={`${i}:${child.id}`}
            node={child}
            scope={{ ...scope, item, index: i }}
            outlet={outlet}
          />
        ))
      );
    } else if (bound && card === 'object') {
      // Set scope: render once, descendants resolve item.*
      body = kids.map((child) => (
        <RenderNode key={child.id} node={child} scope={{ ...scope, item: value }} outlet={outlet} />
      ));
    } else {
      body = kids.map((child) => (
        <RenderNode key={child.id} node={child} scope={scope} outlet={outlet} />
      ));
    }
  } else {
    body = renderLeaf(node, value, bound);
  }

  return (
    <div style={outer} data-bx-type={node.type}>
      <div style={innerStyle}>{body}</div>
    </div>
  );
}

export function BuilderRenderer({ tree, data }: { tree: BuilderNode; data: DataSources }) {
  return (
    <div className="bx-render" data-builder-page>
      <RenderNode node={tree} scope={{ root: data }} />
    </div>
  );
}

/** The site LAYOUT renderer (docs/45 §2.6): the published chrome tree, with the
 *  routed page dropped at its `Outlet`. The chrome binds to the `site` sources
 *  (nav / identity / social) resolved by `loadSiteData`. */
export function BuilderSiteChrome({
  tree,
  data,
  children,
}: {
  tree: BuilderNode;
  data: DataSources;
  children: React.ReactNode;
}) {
  return (
    <div className="bx-render" data-builder-layout>
      <RenderNode node={tree} scope={{ root: data }} outlet={children} />
    </div>
  );
}
