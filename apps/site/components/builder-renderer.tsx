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

import {
  Divider,
  EmbedFrame,
  Heading,
  Image,
  Logo,
  NavMenu,
  PriceTag,
  SocialLinks,
  Stat,
  Text,
} from '@sparx/site-ui';

import { BuilderCarousel } from './builder-carousel';
import {
  BuilderAddToCart,
  BuilderBuyBox,
  BuilderQuantity,
  BuilderVariantPicker,
  ProductFormProvider,
  type BuilderProduct,
} from './builder-commerce';

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

const CONTAINERS = new Set(['Section', 'Grid', 'Stack', 'Card', 'Carousel', 'ProductForm']);

// Presentational leaves whose Surface component (or, for Button, the recipe class)
// owns the node's brand class ON ITS OWN ELEMENT (docs/47 §7). For these the box
// wrapper omits node.class, so the class lands on exactly one element and never
// double-paints. Leaves NOT listed (the interactive commerce atoms, Outlet) keep
// the additive class on the box wrapper.
const CLASS_ON_LEAF = new Set([
  'Heading',
  'Text',
  'Button',
  'Stat',
  'Divider',
  'PriceTag',
  'Image',
  'ImageDisplay',
  'Video',
  'Map',
  'Logo',
  'NavMenu',
  'SocialLinks',
]);

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
  isContainer: boolean,
  isGrid: boolean,
  /** A background image resolved from `box.backgroundImageBinding` against the
   *  node's data scope. When present it WINS; `box.backgroundImage` is fallback. */
  boundImage?: string
): { outer: React.CSSProperties; inner: React.CSSProperties } {
  const surface = SURFACE[box.surface];
  const bgFull = box.backgroundWidth === 'full';
  const contentContained = box.contentWidth === 'contained';
  // An explicit height is a FIXED height (min AND max) so a tall child can't blow
  // past it. Grid-direction containers push the height onto their CELLS instead
  // (the container branch), so the grid box itself stays auto and sizes to rows.
  const fixedHeight = isContainer && !isGrid ? HEIGHT_VH[box.height] : undefined;
  const hasHeight = Boolean(fixedHeight);
  const image = boundImage ?? box.backgroundImage;
  const overlay = box.overlay ?? 'none';
  const tone = box.textTone ?? 'default';
  // `pin: top` floats the block over the one that follows (overlay header),
  // anchored to its parent (every node's outer is positioned).
  const pinned = box.pin === 'top';

  const outer: React.CSSProperties = {
    position: pinned ? 'absolute' : 'relative',
    ...(pinned
      ? { top: 0, left: 0, right: 0, zIndex: 40, width: '100%' }
      : fixedHeight
        ? { minHeight: fixedHeight, maxHeight: fixedHeight }
        : {}),
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

// Embed helpers — mirror the editor registry (kept tiny + duplicated). A YouTube
// watch/share/embed URL (or bare id) → a privacy-friendly embed; a place query →
// a keyless Google Maps embed.
function youtubeEmbed(url: string): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{6,})/.exec(u);
  const id = m?.[1] ?? (/^[\w-]{6,}$/.test(u) ? u : null);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}
function mapEmbed(query: string, embedUrl: string): string | null {
  if (embedUrl?.trim()) return embedUrl.trim();
  const q = (query ?? '').trim();
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
}
// Hand-typed nav links (the fallback when a NavMenu isn't bound to a CMS menu).
// One per line: `Label` or `Label|/url`. Mirrors the editor registry.
function parseNavLinks(raw: string): { label: string; url: string }[] {
  return (raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url] = line.split('|');
      return { label: (label ?? '').trim(), url: (url ?? '#').trim() || '#' };
    })
    .filter((l) => l.label !== '');
}
// ── Leaf rendering ─────────────────────────────────────────────────────────

function buttonStyle(style: string): React.CSSProperties {
  if (style === 'link') {
    return { color: 'var(--sf-primary)', textDecoration: 'underline', fontWeight: 600 };
  }
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.7rem 1.75rem',
    borderRadius: 'var(--sf-radius-field)',
    fontWeight: 600,
    fontSize: '0.95rem',
    textAlign: 'center',
    minWidth: '160px',
  };
  // Translucent CTAs (the photo-panel pairing): a frosted dark "primary" and a
  // frosted light "secondary" that stay legible over any background photo.
  const frosted: React.CSSProperties = { ...base, backdropFilter: 'blur(6px)' };
  if (style === 'soft')
    return { ...base, background: 'var(--sf-base-200)', color: 'var(--sf-primary)' };
  if (style === 'dark') return { ...frosted, background: 'rgba(23,26,35,0.78)', color: '#ffffff' };
  if (style === 'glass')
    return { ...frosted, background: 'rgba(255,255,255,0.86)', color: '#171a23' };
  return { ...base, background: 'var(--sf-primary)', color: 'var(--sf-primary-content)' };
}

function renderLeaf(
  node: BuilderNode,
  value: unknown,
  bound: boolean,
  /** The node's brand class, threaded here for leaves that style themselves by
   *  class (Button) rather than via the box wrapper. Undefined otherwise. */
  leafClass?: string
): React.ReactNode {
  const p = node.props;
  const str = (k: string): string => (typeof p[k] === 'string' ? p[k] : '');
  switch (node.type) {
    case 'Heading': {
      const level = (str('level') || 'h2') as 'h1' | 'h2' | 'h3';
      return (
        <Heading level={level} className={leafClass}>
          {bound ? asText(value) : str('text')}
        </Heading>
      );
    }
    case 'Text': {
      const variant = (str('variant') || 'body') as 'body' | 'eyebrow' | 'meta';
      return (
        <Text variant={variant} className={leafClass}>
          {bound ? asText(value) : str('text')}
        </Text>
      );
    }
    case 'Button': {
      const label = (bound ? asText(value) : '') || str('label') || 'Button';
      // A `href` turns the button into a real link (internal path or absolute
      // URL); without one it stays a non-navigating span (e.g. a future
      // form-submit / add-to-cart action owns its own behavior).
      const href = str('href');
      // Class-first (docs/47 §7): a Surface-classed button renders the recipe
      // class — `sf-btn sf-c-* sf-v-* sf-btn--sz-*` — on the element ITSELF,
      // resolved against the loaded `@sparx/site-ui` stylesheet. Legacy trees with
      // no class fall back to the inline `style`-prop treatment.
      if (leafClass) {
        return href ? (
          <a href={href} className={leafClass}>
            {label}
          </a>
        ) : (
          <span className={leafClass}>{label}</span>
        );
      }
      const style = buttonStyle(str('style') || 'primary');
      return href ? (
        <a href={href} style={{ ...style, textDecoration: 'none' }}>
          {label}
        </a>
      ) : (
        <span style={style}>{label}</span>
      );
    }
    // Tier-2 commerce (docs/40 §7). BuyBox is self-contained (bound to `product`,
    // value = the product object). The atoms read the shared ProductForm context
    // established by a ProductForm container ancestor, so they ignore `value`.
    case 'BuyBox':
      return <BuilderBuyBox product={(value ?? {}) as BuilderProduct} />;
    case 'VariantPicker':
      return <BuilderVariantPicker />;
    case 'Quantity':
      return <BuilderQuantity />;
    case 'AddToCart':
      return <BuilderAddToCart label={str('label') || undefined} />;
    case 'Divider':
      return <Divider className={leafClass} />;
    case 'PriceTag': {
      const n = typeof value === 'number' ? value : null;
      return <PriceTag amount={n} className={leafClass} />;
    }
    case 'Image':
    case 'ImageDisplay': {
      const ratio = (str('ratio') || 'wide') as 'wide' | 'square' | 'portrait';
      const img = bound ? firstImage(value) : null;
      return (
        <Image src={img?.url} alt={img?.alt ?? str('alt')} ratio={ratio} className={leafClass} />
      );
    }
    case 'Video': {
      const src = youtubeEmbed(str('url'));
      const ratio = (str('ratio') || 'wide') as 'wide' | 'square' | 'portrait';
      if (!src) return null;
      return (
        <EmbedFrame
          src={src}
          title={node.box.name ?? 'Video'}
          ratio={ratio}
          className={leafClass}
        />
      );
    }
    case 'Map': {
      const src = mapEmbed(str('query'), str('embedUrl'));
      const ratio = (str('ratio') || 'pano') as 'wide' | 'square' | 'portrait' | 'pano';
      if (!src) return null;
      return (
        <EmbedFrame src={src} title={node.box.name ?? 'Map'} ratio={ratio} className={leafClass} />
      );
    }
    case 'Stat': {
      const big = (bound ? asText(value) : '') || str('value') || '0';
      return <Stat value={big} label={str('label')} className={leafClass} />;
    }
    // ── Site chrome (docs/45) ────────────────────────────────────────────────
    case 'Logo': {
      const identity =
        value && typeof value === 'object' ? (value as { name?: unknown; logo?: unknown }) : null;
      const name = typeof identity?.name === 'string' ? identity.name : '';
      const img = firstImage(identity?.logo);
      return <Logo name={name} src={img?.url} alt={img?.alt ?? name} className={leafClass} />;
    }
    case 'NavMenu': {
      const orientation = (str('orientation') || 'row') as 'row' | 'stack';
      const boundItems = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      // Bound CMS menu wins; otherwise fall back to hand-typed links (the
      // unbound nav case — e.g. a static header). Empty → render nothing.
      const list =
        boundItems.length > 0
          ? boundItems
              .map((it) => ({
                label: typeof it.label === 'string' ? it.label : '',
                url: typeof it.url === 'string' ? it.url : '#',
              }))
              .filter((l) => l.label !== '')
          : parseNavLinks(str('links'));
      if (list.length === 0) return null;
      return <NavMenu items={list} orientation={orientation} className={leafClass} />;
    }
    case 'SocialLinks': {
      const raw = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const items = raw.map((it) => ({
        platform: typeof it.platform === 'string' ? it.platform : '',
        url: typeof it.url === 'string' ? it.url : '#',
      }));
      return <SocialLinks items={items} className={leafClass} />;
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
  // Class-first (docs/47 §7): a presentational leaf carries node.class on its OWN
  // element (its Surface component / the Button recipe), via renderLeaf; every
  // other node carries it on the box wrapper. Exactly one element per node → no
  // double-paint with the box engine (which never styled the leaf element itself).
  const leafStylesByClass = !isContainer && CLASS_ON_LEAF.has(node.type);
  const bound = Boolean(node.binding);
  const value = bound ? resolvePath(scope, node.binding!.path) : undefined;
  const card: Cardinality = bound ? cardinalityOf(value) : 'empty';

  // An Outlet is a width PASSTHROUGH — the routed page owns its own width. Never
  // let it impose the contained max-width: a `contained` Outlet (e.g. from an
  // import that didn't set the width axes — DEFAULT_BOX is `contained`) would
  // silently cap header + page + footer at --sf-max and centre them. Force full.
  const effBox: BoxBase =
    node.type === 'Outlet'
      ? { ...node.box, backgroundWidth: 'full', contentWidth: 'full' }
      : node.box;
  const isGrid = node.layout?.direction === 'grid';
  // Data-aware background: resolve the bound image against THIS node's scope (the
  // same scope its own binding/leaves see), take the first image, use its URL as
  // the box background. Empty/unresolved → undefined, so the static fallback wins.
  const boundBg = node.box.backgroundImageBinding
    ? (firstImage(resolvePath(scope, node.box.backgroundImageBinding))?.url ?? undefined)
    : undefined;
  const { outer, inner } = boxStyles(effBox, isContainer, isGrid, boundBg);
  const innerStyle = isContainer && node.layout ? { ...inner, ...layoutStyle(node.layout) } : inner;

  let body: React.ReactNode;
  if (node.type === 'Outlet') {
    // The content outlet: render the routed page here (docs/45 §2.6).
    body = outlet ?? null;
  } else if (node.type === 'Carousel') {
    // Each direct child is a slide. When bound to an array, each record is a
    // slide (its subtree rendered once per item). The client component owns the
    // index state, autoplay, arrows + dots.
    const kids = node.children ?? [];
    // A carousel with an explicit height GOVERNS its slides: each slide adopts the
    // carousel's height so the hero is exactly that tall. Without this a `full`
    // slide dominates a `3/4` carousel (min-height can't shrink a taller child).
    // `auto` leaves each slide its own height (carousel sizes to the tallest).
    const slideOf = (child: BuilderNode): BuilderNode =>
      node.box.height !== 'auto'
        ? { ...child, box: { ...child.box, height: node.box.height } }
        : child;
    let slides: React.ReactNode[];
    if (bound && card === 'array') {
      slides = (value as unknown[]).map((item, i) => (
        <React.Fragment key={`i${i}`}>
          {kids.map((child) => (
            <RenderNode
              key={child.id}
              node={slideOf(child)}
              scope={{ ...scope, item, index: i }}
              outlet={outlet}
            />
          ))}
        </React.Fragment>
      ));
    } else {
      const s: Scope = bound && card === 'object' ? { ...scope, item: value } : scope;
      slides = kids.map((child) => (
        <RenderNode key={child.id} node={slideOf(child)} scope={s} outlet={outlet} />
      ));
    }
    body = (
      <BuilderCarousel
        slides={slides}
        autoplay={node.props.autoplay !== false}
        interval={Number(node.props.interval) || 6}
        arrows={node.props.arrows !== false}
        dots={node.props.dots !== false}
      />
    );
  } else if (isContainer) {
    const kids = node.children ?? [];
    // A grid-direction container's height governs its CELLS: each child adopts the
    // grid's height (fixed) so cells are uniform and a tall child can't dominate;
    // the grid box itself sizes to its rows. `auto` leaves children untouched.
    const cellOf = (child: BuilderNode): BuilderNode =>
      node.layout?.direction === 'grid' && node.box.height !== 'auto'
        ? { ...child, box: { ...child.box, height: node.box.height } }
        : child;
    if (bound && card === 'array') {
      // Iterate: each record scopes its subtree to `item`.
      body = (value as unknown[]).flatMap((item, i) =>
        kids.map((child) => (
          <RenderNode
            key={`${i}:${child.id}`}
            node={cellOf(child)}
            scope={{ ...scope, item, index: i }}
            outlet={outlet}
          />
        ))
      );
    } else if (bound && card === 'object') {
      // Set scope: render once, descendants resolve item.*
      body = kids.map((child) => (
        <RenderNode
          key={child.id}
          node={cellOf(child)}
          scope={{ ...scope, item: value }}
          outlet={outlet}
        />
      ));
    } else {
      body = kids.map((child) => (
        <RenderNode key={child.id} node={cellOf(child)} scope={scope} outlet={outlet} />
      ));
    }
  } else {
    body = renderLeaf(node, value, bound, leafStylesByClass ? node.class : undefined);
  }

  // A ProductForm container establishes the shared buy-box context over its
  // subtree, so VariantPicker/Quantity/AddToCart atoms placed inside stay in
  // sync. Bound to `product` → `value` is the product object.
  if (node.type === 'ProductForm') {
    body = (
      <ProductFormProvider product={(value ?? {}) as BuilderProduct}>{body}</ProductFormProvider>
    );
  }

  // The class-first authoring surface (docs/47): the node's brand-governed class
  // string rides on the box wrapper alongside the engine's inline box styles, so
  // the published page and the editor canvas emit the same class. The exception is
  // a leaf that styles itself by class (Button) — there the class lives on the
  // element via renderLeaf, so the wrapper omits it (no double-paint). Absent on
  // legacy trees → no className. The box→CSS engine still owns layout/structure.
  return (
    <div
      className={leafStylesByClass ? undefined : node.class}
      style={outer}
      data-bx-type={node.type}
    >
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
