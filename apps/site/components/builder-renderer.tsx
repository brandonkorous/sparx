// Renders a published Builder node tree to production storefront markup
// (docs/44 §2.3, docs/61). Distinct from the dashboard editor canvas: no
// selection chrome, semantic output. Each node's Tailwind-native `class` string
// is applied verbatim and resolves against the compiled per-tenant stylesheet
// (the same classes the editor canvas previews, so preview == production).
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
  type BuilderNode,
  type Cardinality,
  type DataSources,
  type Scope,
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
import { BuilderNavMenu } from './builder-nav-menu';
import {
  BuilderAddToCart,
  BuilderBuyBox,
  BuilderQuantity,
  BuilderVariantPicker,
  ProductFormProvider,
  type BuilderProduct,
} from './builder-commerce';

// ── Class-only rendering (docs/61) ────────────────────────────────────────────
//
// A node's entire styling is its `class` string, compiled per tenant to the
// `--sf-*` tokens by @sparx/surface-compile. The renderer applies it verbatim —
// no box→CSS engine, no `.bx-*` layout classes, no inline geometry. The ONE inline
// style that remains is a dynamic background image (a per-node / per-record URL
// can't be a static utility class), painted from the node's bg-* props.

/** Join class fragments, dropping falsy ones; undefined when empty. */
function cls(...parts: (string | false | null | undefined)[]): string | undefined {
  const joined = parts.filter(Boolean).join(' ');
  return joined || undefined;
}

// Background-media scrims (docs/45) — a translucent veil layered OVER the photo
// (below content) for text legibility; `gradient` darkens top+bottom.
const SCRIM: Record<string, string | null> = {
  none: null,
  dark: 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))',
  light: 'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55))',
  gradient:
    'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.04) 28%, rgba(0,0,0,0.04) 62%, rgba(0,0,0,0.6))',
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

const CONTAINERS = new Set(['Section', 'Grid', 'Stack', 'Card', 'Carousel', 'ProductForm']);

// Presentational leaves whose Surface component (or, for Button, the recipe class)
// owns the node's brand class ON ITS OWN ELEMENT (docs/47 §7, docs/61). For these
// renderLeaf applies node.class to the element itself, so the renderer returns it
// directly (no wrapper). Leaves NOT listed (the interactive commerce atoms,
// Outlet, the page-content widgets) get a wrapper div carrying node.class.
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

/** The inline background-image style for a node, from its `bg-*` props (docs/61):
 *  a static `bgImage` URL or a record image resolved from `bgImageBinding` against
 *  the node's scope (the bound image wins). Undefined when there's no image — the
 *  surface color then comes from the node's `class` (`bg-base-200`, …). */
function backgroundStyleFor(node: BuilderNode, scope: Scope): React.CSSProperties | undefined {
  const p = node.props;
  const staticUrl = typeof p.bgImage === 'string' ? p.bgImage : undefined;
  const bindingPath = typeof p.bgImageBinding === 'string' ? p.bgImageBinding : undefined;
  const boundUrl = bindingPath ? firstImage(resolvePath(scope, bindingPath))?.url : undefined;
  const image = boundUrl ?? staticUrl;
  if (!image) return undefined;
  const overlay = typeof p.bgOverlay === 'string' ? p.bgOverlay : 'none';
  const fit = p.bgFit === 'contain' ? 'contain' : 'cover';
  const position = typeof p.bgPosition === 'string' ? p.bgPosition : 'center';
  const url = `url("${image.replace(/["\\]/g, '')}")`;
  const scrim = SCRIM[overlay];
  return {
    backgroundImage: scrim ? `${scrim}, ${url}` : url,
    backgroundSize: fit,
    backgroundPosition: BG_POSITION_CSS[position] ?? 'center',
    backgroundRepeat: 'no-repeat',
  };
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
    // Keep the comfortable button weight, but never overflow a container narrower
    // than 160px (a phone, a tight column) — min() drops the floor to 100% there
    // (docs/62). Inline style can't carry @media; min() is the responsive lever.
    minWidth: 'min(160px, 100%)',
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
        <EmbedFrame src={src} title={node.name ?? 'Video'} ratio={ratio} className={leafClass} />
      );
    }
    case 'Map': {
      const src = mapEmbed(str('query'), str('embedUrl'));
      const ratio = (str('ratio') || 'pano') as 'wide' | 'square' | 'portrait' | 'pano';
      if (!src) return null;
      return (
        <EmbedFrame src={src} title={node.name ?? 'Map'} ratio={ratio} className={leafClass} />
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
      // A row (primary/header) nav collapses to a hamburger + drawer on phones
      // via a client island (docs/62 D2). Stacked (footer/secondary) stays static.
      if (orientation === 'row') return <BuilderNavMenu items={list} className={leafClass} />;
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
  // docs/61: a presentational leaf carries node.class on its OWN element (its
  // Surface component / the Button recipe) via renderLeaf, so the renderer returns
  // it directly — no wrapper, no double-paint. Every other node gets ONE wrapper
  // div carrying node.class. Exactly one styled element per node.
  const leafStylesByClass = !isContainer && CLASS_ON_LEAF.has(node.type);
  const bound = Boolean(node.binding);
  const value = bound ? resolvePath(scope, node.binding!.path) : undefined;
  const card: Cardinality = bound ? cardinalityOf(value) : 'empty';
  // The only inline style left: a dynamic background image (a per-node / per-record
  // URL can't be a static class). The surface COLOR comes from node.class.
  const bgStyle = backgroundStyleFor(node, scope);

  let body: React.ReactNode;
  if (node.type === 'Outlet') {
    // The content outlet: render the routed page here (docs/45 §2.6). The routed
    // page owns its own width, so the Outlet's own class is just a full-width slot.
    body = outlet ?? null;
  } else if (node.type === 'Carousel') {
    // Each direct child is a slide. When bound to an array, each record is a slide
    // (its subtree rendered once per item). The client component owns the index
    // state, autoplay, arrows + dots.
    const kids = node.children ?? [];
    let slides: React.ReactNode[];
    if (bound && card === 'array') {
      slides = (value as unknown[]).map((item, i) => (
        <React.Fragment key={`i${i}`}>
          {kids.map((child) => (
            <RenderNode
              key={child.id}
              node={child}
              scope={{ ...scope, item, index: i }}
              outlet={outlet}
            />
          ))}
        </React.Fragment>
      ));
    } else {
      const s: Scope = bound && card === 'object' ? { ...scope, item: value } : scope;
      slides = kids.map((child) => (
        <RenderNode key={child.id} node={child} scope={s} outlet={outlet} />
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

  // A class-styled leaf already wears node.class on its own element → return it as
  // is. Everything else gets one wrapper div carrying node.class (+ the dynamic
  // background image, the only inline style left). The published page and the
  // editor canvas emit the same class, so preview == production.
  if (leafStylesByClass) return body;
  return (
    <div className={cls(node.class)} style={bgStyle} data-bx-type={node.type}>
      {body}
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
