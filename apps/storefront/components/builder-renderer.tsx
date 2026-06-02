// Renders a published Builder node tree to production storefront markup
// (docs/44 §2.3). Distinct from the dashboard editor canvas: no selection
// chrome, semantic output, mapped to the live `--sf-*` tenant theme tokens
// (the editor maps the same box/layout semantics to `--bxc-*`).
//
// SLICE A.1 — STATIC ONLY: leaves render their own props (Heading/Text/Button/
// Divider/Image). Data bindings are NOT resolved yet; bound data-aware leaves
// (PriceTag/ImageDisplay/Signup) render a neutral placeholder until A.2 wires
// real-record resolution (docs/44 §3). Responsive `hiddenOn` is deferred too.

import * as React from 'react';
import type {
  AlignX,
  BoxBase,
  BuilderNode,
  GapScale,
  HeightScale,
  Justify,
  LayoutBase,
  SpaceScale,
  Surface,
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

  const outer: React.CSSProperties = {
    position: 'relative',
    minHeight,
    background: bgFull ? surface.bg : 'transparent',
    display: 'flex',
    justifyContent: contentContained ? 'center' : 'flex-start',
    alignItems: hasHeight ? 'center' : 'stretch',
  };
  const inner: React.CSSProperties = {
    width: '100%',
    maxWidth: contentContained ? 'var(--sf-max)' : undefined,
    padding: PADDING[box.padding],
    textAlign: TEXT_ALIGN[box.align],
    color: surface.fg,
    background: !bgFull ? surface.bg : 'transparent',
  };
  return { outer, inner };
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

function renderLeaf(node: BuilderNode): React.ReactNode {
  const p = node.props;
  const str = (k: string): string => (typeof p[k] === 'string' ? p[k] : '');
  switch (node.type) {
    case 'Heading': {
      const level = str('level') || 'h2';
      const Tag = (level === 'h1' ? 'h1' : level === 'h3' ? 'h3' : 'h2') as 'h1';
      return <Tag style={headingStyle(level)}>{str('text')}</Tag>;
    }
    case 'Text':
      return <p style={textStyle(str('variant') || 'body')}>{str('text')}</p>;
    case 'Button':
      return <span style={buttonStyle(str('style') || 'primary')}>{str('label') || 'Button'}</span>;
    case 'Divider':
      return (
        <hr
          style={{ border: 0, borderTop: '1px solid var(--sf-border)', width: '100%', margin: 0 }}
        />
      );
    case 'Image':
    case 'ImageDisplay':
      return (
        <div
          role="img"
          aria-label={str('alt')}
          style={{
            width: '100%',
            aspectRatio:
              str('ratio') === 'square'
                ? '1 / 1'
                : str('ratio') === 'portrait'
                  ? '3 / 4'
                  : '16 / 9',
            background: 'var(--sf-base-300)',
            borderRadius: 'var(--sf-radius-box)',
          }}
        />
      );
    // PriceTag / Signup need data + interactivity — rendered in a later slice.
    default:
      return null;
  }
}

// ── Recursive node ───────────────────────────────────────────────────────────

function RenderNode({ node }: { node: BuilderNode }): React.ReactNode {
  const isContainer = CONTAINERS.has(node.type);
  const { outer, inner } = boxStyles(node.box, isContainer);
  const innerStyle = isContainer && node.layout ? { ...inner, ...layoutStyle(node.layout) } : inner;

  return (
    <div style={outer} data-bx-type={node.type}>
      <div style={innerStyle}>
        {isContainer
          ? (node.children ?? []).map((child) => <RenderNode key={child.id} node={child} />)
          : renderLeaf(node)}
      </div>
    </div>
  );
}

export function BuilderRenderer({ tree }: { tree: BuilderNode }) {
  return (
    <div className="bx-render" data-builder-page>
      <RenderNode node={tree} />
    </div>
  );
}
