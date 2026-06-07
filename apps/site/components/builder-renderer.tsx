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
  coerceNavLinks,
  resolvePath,
  type AlignX,
  type BoxBase,
  type BuilderNode,
  type Cardinality,
  type DataSources,
  type GapScale,
  type Justify,
  type LayoutBase,
  type Scope,
  type Surface,
} from '@sparx/builder-schemas';

import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Divider,
  EmbedFrame,
  Grid,
  Heading,
  Image,
  Logo,
  NavMenu,
  PriceTag,
  SocialLinks,
  Stat,
  Text,
} from '@sparx/site-ui';
// Server-safe JSON→HTML serializer (no React/jsdom) — the same path CMS pages
// render through. Used by the Prose leaf to render a bound rich-text body.
import { renderDocToHtml } from '@sparx/cms-editor/serialize';

import { BuilderCarousel } from './builder-carousel';
import { BuilderIcon } from './builder-icon';
import {
  BuilderAddToCart,
  BuilderBuyBox,
  BuilderQuantity,
  BuilderVariantPicker,
  ProductFormProvider,
  type BuilderProduct,
} from './builder-commerce';

// ── Box-base → CSS (mirrors the editor canvas scales, --sf-* tokens) ──────────

// Section height + padding scales no longer live here as inline values — they
// ride the `.bx-h-*` / `.bx-p-*` classes in site.css, which ease on small
// screens (docs/59). The gap scale stays inline (it doesn't swap responsively).
const GAP: Record<GapScale, string> = { none: '0', sm: '0.5rem', md: '1rem', lg: '1.5rem' };

/** Join class fragments, dropping falsy ones; undefined when empty. */
function cls(...parts: (string | false | null | undefined)[]): string | undefined {
  const joined = parts.filter(Boolean).join(' ');
  return joined || undefined;
}

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

/** Nine-point focal point → CSS `background-position`. */
const BG_POSITION_CSS: Record<string, string> = {
  center: 'center',
  top: 'center top',
  bottom: 'center bottom',
  left: 'left center',
  right: 'right center',
  'top-left': 'left top',
  'top-right': 'right top',
  'bottom-left': 'left bottom',
  'bottom-right': 'right bottom',
};

/** Background CSS for the element owning the box's background width: a photo
 *  (scrim layered above) when set, else the surface token color. `fit` picks
 *  cover (fill + crop) vs contain (whole image, letterboxed against the surface
 *  color); `position` is the focal point that survives a cover crop. */
function bgProps(
  image: string | undefined,
  overlay: string,
  colorBase: string,
  fit: 'cover' | 'contain' = 'cover',
  position = 'center'
): React.CSSProperties {
  if (!image) return { background: colorBase };
  const url = `url("${image.replace(/["\\]/g, '')}")`;
  const scrim = SCRIM[overlay];
  return {
    // Behind the image so a `contain` letterbox shows the surface, not bare page.
    backgroundColor: colorBase,
    backgroundImage: scrim ? `${scrim}, ${url}` : url,
    backgroundSize: fit,
    backgroundPosition: BG_POSITION_CSS[position] ?? 'center',
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
  'Prose',
  'Button',
  'Badge',
  'Icon',
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

/** A row of CONTAINERS is a layout band (image+text, multi-column) that must
 *  stack on mobile; a row of LEAVES is an inline lockup (logo+name, button+icon)
 *  that must stay inline. This signal decides which (docs/59 §2). `custom:*`
 *  placements are containers (they expand to sections) — though the storefront
 *  only ever sees them already expanded. */
function hasContainerChild(children?: BuilderNode[]): boolean {
  return (children ?? []).some((c) => c.type.startsWith('custom:') || CONTAINERS.has(c.type));
}

/** A container's layout → the responsive class (grid columns / row / stack) plus
 *  the residual inline style for properties that DON'T swap (gap) or that the
 *  stacked state must be able to override (desktop align/justify, passed as the
 *  --bx-ai / --bx-jc custom props). The breakpoints live in site.css (docs/59). */
function resolveLayout(
  layout: LayoutBase,
  children?: BuilderNode[]
): { className: string; style: React.CSSProperties } {
  const gap = GAP[layout.gap];
  if (layout.direction === 'grid') {
    const n = Math.min(12, Math.max(1, layout.columns));
    return { className: `bx-grid bx-grid--c${n}`, style: { gap } };
  }
  if (layout.direction === 'row') {
    if (hasContainerChild(children)) {
      // Stacks < 768px; the desktop axes ride custom props so the stacked rule
      // (align stretch / justify start) can win without inline styles blocking it.
      return {
        className: 'bx-row--resp',
        style: {
          gap,
          ['--bx-ai']: FLEX_ALIGN[layout.alignItems] ?? 'stretch',
          ['--bx-jc']: FLEX_JUSTIFY[layout.justify] ?? 'flex-start',
        } as React.CSSProperties,
      };
    }
    return {
      className: 'bx-row',
      style: {
        gap,
        alignItems: FLEX_ALIGN[layout.alignItems] ?? 'stretch',
        justifyContent: FLEX_JUSTIFY[layout.justify] ?? 'flex-start',
        flexWrap: layout.wrap ? 'wrap' : 'nowrap',
      },
    };
  }
  return {
    className: 'bx-stack',
    style: {
      gap,
      alignItems: FLEX_ALIGN[layout.alignItems] ?? 'stretch',
      justifyContent: FLEX_JUSTIFY[layout.justify] ?? 'flex-start',
    },
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
  // `pin: top` floats the block over the one that follows (overlay header),
  // anchored to its parent (every node's outer is positioned).
  const pinned = box.pin === 'top';
  // An explicit height is a FIXED height (min AND max), realized by the `.bx-h-*`
  // class on the outer (which eases on mobile). Here we only need the BOOLEAN to
  // center content vertically. Grids push height onto their CELLS instead, and a
  // pinned block opts out, so neither carries a height.
  const hasHeight = isContainer && !isGrid && !pinned && box.height !== 'auto';
  const image = boundImage ?? box.backgroundImage;
  const overlay = box.overlay ?? 'none';
  const tone = box.textTone ?? 'default';
  const fit = box.backgroundFit ?? 'cover';
  const position = box.backgroundPosition ?? 'center';

  const outer: React.CSSProperties = {
    position: pinned ? 'absolute' : 'relative',
    ...(pinned ? { top: 0, left: 0, right: 0, zIndex: 40, width: '100%' } : {}),
    ...(bgFull
      ? bgProps(image, overlay, surface.bg, fit, position)
      : { background: 'transparent' }),
    display: 'flex',
    justifyContent: contentContained ? 'center' : 'flex-start',
    alignItems: hasHeight ? 'center' : 'stretch',
  };
  // Padding rides the `.bx-p-*` class on this inner element (eases on mobile).
  const inner: React.CSSProperties = {
    width: '100%',
    maxWidth: contentContained ? 'var(--sf-max)' : undefined,
    textAlign: TEXT_ALIGN[box.align],
    color: TONE[tone] ?? surface.fg,
    ...(!bgFull
      ? bgProps(image, overlay, surface.bg, fit, position)
      : { background: 'transparent' }),
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
// Authored-inline FAQ pairs / feature cards (the fallback when the FAQ /
// FeatureGrid leaf isn't bound to a content list). Mirror the editor registry.
function parseFaqItems(raw: string): { question: string; answer: string }[] {
  return (raw ?? '')
    .split(/\n\s*-{3,}\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      const start = lines.findIndex((l) => l !== '');
      if (start === -1) return null;
      const question = lines[start];
      const answer = lines
        .slice(start + 1)
        .filter(Boolean)
        .join('\n\n');
      return question ? { question, answer } : null;
    })
    .filter((x): x is { question: string; answer: string } => x !== null);
}
function parseFeatureItems(raw: string): { number: string; title: string; body: string }[] {
  return (raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split('|').map((p) => p.trim());
      const auto = String(i + 1).padStart(2, '0');
      if (parts.length >= 3) {
        return {
          number: parts[0] ?? auto,
          title: parts[1] ?? '',
          body: parts.slice(2).join(' | '),
        };
      }
      if (parts.length === 2) return { number: auto, title: parts[0] ?? '', body: parts[1] ?? '' };
      return { number: auto, title: parts[0] ?? '', body: '' };
    })
    .filter((f) => f.title !== '');
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
  leafClass?: string,
  /** Pre-rendered children for a leaf that nests them (Button → inline Icon). */
  children?: React.ReactNode
): React.ReactNode {
  const p = node.props;
  const str = (k: string): string => (typeof p[k] === 'string' ? p[k] : '');
  switch (node.type) {
    case 'Heading': {
      const level = (str('level') || 'h2') as 'h1' | 'h2' | 'h3';
      // Opt-in display/hero scale (docs/46) — a node can render an h1 at the
      // larger, heavier display size without changing its semantic level.
      const size = str('size') === 'display' ? 'display' : undefined;
      return (
        <Heading level={level} size={size} className={leafClass}>
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
    case 'Prose': {
      // The post body: serialize the bound rich-text doc to sanitised HTML through
      // the shared CMS serializer, into the storefront's `.sparx-content` prose
      // styles. `renderDocToHtml` returns '' for a non-doc value, so a legacy plain
      // string falls back to a single paragraph; nothing bound → render nothing.
      const cls = leafClass ? `sparx-content ${leafClass}` : 'sparx-content';
      const html = bound ? renderDocToHtml(value) : '';
      if (html) return <article className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
      const plain = bound ? asText(value) : '';
      return plain ? (
        <article className={cls}>
          <p>{plain}</p>
        </article>
      ) : null;
    }
    case 'Button': {
      const label = (bound ? asText(value) : '') || str('label') || 'Button';
      const href = str('href');
      // Semantics (docs/47): a linked button is an `<a>`; an action button with no
      // link is a real `<button type="button">` — accessible + keyboard-activatable,
      // never a bare `<span>`. (The editor canvas uses an inert `<span>` ONLY because
      // each node sits inside a `role="button"` selection wrapper; the published
      // site has no such wrapper, so it ships the correct element.) A nested Icon
      // renders inline AFTER the label via `children`.
      // Class-first (docs/47 §7): a Surface-classed button carries the recipe class
      // (`sf-btn sf-c-* sf-v-* sf-btn--sz-*`) on the element itself; legacy trees
      // with no class fall back to the inline `style`-prop treatment (reset for the
      // native <button> element).
      if (leafClass) {
        return href ? (
          <a href={href} className={leafClass}>
            {label}
            {children}
          </a>
        ) : (
          <button type="button" className={leafClass}>
            {label}
            {children}
          </button>
        );
      }
      const style = buttonStyle(str('style') || 'primary');
      return href ? (
        <a href={href} style={{ ...style, textDecoration: 'none' }}>
          {label}
          {children}
        </a>
      ) : (
        <button
          type="button"
          style={{ ...style, border: 'none', font: 'inherit', cursor: 'pointer' }}
        >
          {label}
          {children}
        </button>
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
    case 'Badge': {
      // Class-first like Button (docs/47 §7): the recipe class string
      // (`sf-badge sf-c-* sf-v-* sf-badge--sz-*`) rides on the element itself, so a
      // raw span carries it verbatim — matching the editor canvas. A nested Icon
      // renders inline after the label.
      const label = (bound ? asText(value) : '') || str('label') || 'Badge';
      return (
        <span className={leafClass}>
          {label}
          {children}
        </span>
      );
    }
    case 'Icon': {
      // Stable kebab-case name from a bound scalar (e.g. a CMS "Feature › Icon")
      // or the static prop; rendered via the lazy DynamicIcon client boundary.
      const name = (bound ? asText(value) : '') || str('name') || 'star';
      return <BuilderIcon name={name} className={leafClass} />;
    }
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
    // ── Page-content widgets (docs/51 §7 — reclassified from content types) ───
    case 'EditorialSection': {
      // Authored inline, or bound to an object with the same field names.
      const obj =
        bound && value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      const pick = (k: string, prop: string) => (obj ? asText(obj[k]) : '') || str(prop);
      const eyebrow = pick('eyebrow', 'eyebrow');
      const headline = pick('headline', 'headline');
      const body = pick('body', 'body');
      const ctaLabel = pick('ctaLabel', 'ctaLabel');
      const ctaUrl = (obj && typeof obj.ctaUrl === 'string' ? obj.ctaUrl : '') || str('ctaUrl');
      // Full-width children (default flex stretch) so the box's text-align governs
      // horizontal alignment; the CTA is wrapped in a block so text-align reaches it.
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
          {headline ? <Heading level="h2">{headline}</Heading> : null}
          {body ? <Text variant="body">{body}</Text> : null}
          {ctaLabel ? (
            <div>
              <Button href={ctaUrl || undefined} variant="solid">
                {ctaLabel}
              </Button>
            </div>
          ) : null}
        </div>
      );
    }
    case 'FAQ': {
      // Bound to an array of `{question, answer}` records, else authored inline.
      const items =
        bound && Array.isArray(value)
          ? (value as Record<string, unknown>[]).map((it) => ({
              question: asText(it.question),
              answer: asText(it.answer),
            }))
          : parseFaqItems(str('items'));
      const list = items.filter((it) => it.question);
      if (!list.length) return null;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          {list.map((it, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Heading level="h3">{it.question}</Heading>
              {it.answer ? <Text variant="body">{it.answer}</Text> : null}
            </div>
          ))}
        </div>
      );
    }
    case 'FeatureGrid': {
      // Bound to an array of `{number?, title, body}` records, else authored inline.
      const items =
        bound && Array.isArray(value)
          ? (value as Record<string, unknown>[]).map((it, i) => ({
              number: asText(it.number) || String(i + 1).padStart(2, '0'),
              title: asText(it.title),
              body: asText(it.body),
            }))
          : parseFeatureItems(str('items'));
      const list = items.filter((f) => f.title);
      if (!list.length) return null;
      const cols = Math.min(4, Math.max(2, Number(str('columns')) || 3)) as 2 | 3 | 4;
      return (
        <Grid cols={cols} gap="lg">
          {list.map((f, i) => (
            <Card key={i}>
              <CardBody>
                <Text variant="meta">{f.number}</Text>
                <CardTitle as="h3">{f.title}</CardTitle>
                {f.body ? <Text variant="body">{f.body}</Text> : null}
              </CardBody>
            </Card>
          ))}
        </Grid>
      );
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
      // Navigation is node-owned (docs/57): the links live in `props.links`
      // (existing CMS-bound nodes were migrated by 20260706_nav_into_builder).
      // `value` is now always nullish for nav — coerceNavLinks keeps the bound
      // path only as defensive normalization. Renders flat (children ignored).
      const list = coerceNavLinks(node.props.links, value).map((l) => ({
        label: l.label,
        url: l.href,
        ...(l.openInNewTab ? { openInNewTab: true } : {}),
      }));
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
  // Responsive layout → a class on the inner (display/columns/direction) plus the
  // residual inline style; the @media breakpoints live in site.css (docs/59).
  const layout = isContainer ? node.layout : undefined;
  const resolvedLayout = layout ? resolveLayout(layout, node.children) : undefined;
  const innerStyle = resolvedLayout ? { ...inner, ...resolvedLayout.style } : inner;
  // Fixed-height containers carry `.bx-h-*` on the OUTER (grids push height onto
  // cells; pinned blocks opt out). Padding + layout ride classes on the INNER.
  // All three ease on small screens. The class-first `node.class` stays on the
  // outer unless a leaf styles itself by class (then renderLeaf owns it).
  const heightClass =
    isContainer && !isGrid && effBox.pin !== 'top' && effBox.height !== 'auto'
      ? `bx-h-${effBox.height}`
      : undefined;
  const outerClass = cls(leafStylesByClass ? undefined : node.class, heightClass);
  const innerClass = cls(`bx-p-${effBox.padding}`, resolvedLayout?.className);

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
    // A leaf may nest children (Button → an inline Icon, docs/47): render them in
    // the current scope and hand them to renderLeaf, which places them itself.
    const kids = (node.children ?? []).map((child) => (
      <RenderNode key={child.id} node={child} scope={scope} outlet={outlet} />
    ));
    body = renderLeaf(
      node,
      value,
      bound,
      leafStylesByClass ? node.class : undefined,
      kids.length > 0 ? kids : undefined
    );
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
  // string rides on the box wrapper (folded into `outerClass`) alongside the
  // engine's inline box styles, so the published page and the editor canvas emit
  // the same class. The exception is a leaf that styles itself by class (Button) —
  // there the class lives on the element via renderLeaf, so the wrapper omits it
  // (no double-paint). The inner carries the responsive layout + padding classes
  // (docs/59); the box→CSS engine still owns the non-responsive structure inline.
  return (
    <div className={outerClass} style={outer} data-bx-type={node.type}>
      <div className={innerClass} style={innerStyle}>
        {body}
      </div>
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
