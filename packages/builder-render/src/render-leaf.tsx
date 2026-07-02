// The ONE per-type leaf render map (docs/builder/02 §2.1).
//
// Before this package there were TWO: the live storefront renderer
// (apps/site builder-renderer.tsx) rendered each leaf with the REAL wired
// components, while the dashboard canvas (registry.tsx `renderLeaf`) rendered
// hand-written MOCKS for the commerce atoms + an inert <span> for Button — so the
// "canvas == production" premise wasn't literally true and any new component had
// to be written twice. This function is the single map both surfaces now call.
//
// It is parameterized, not forked:
//   · mode    — `live` ships acting elements + production-empty output; `edit`
//               renders the SAME components but feeds the commerce atoms a sample
//               product, and substitutes representative placeholders for
//               otherwise-empty leaves so an unauthored node stays selectable.
//   · surface — `page`/`site` paint the @sparx/site-ui storefront scale; `email`
//               paints the @sparx/email pixel scale (the email-leaf set).
//   · leafClass — for leaves that style their OWN element (leafWearsClass), the
//               host passes node.class here so the recipe/Surface paints it and
//               the host suppresses its own wrapper class (no double-paint).
//
// What is NOT here (the host walkers own them, because they concern the TREE
// WALK + per-node wrapper, not leaf content): containers + their iteration, the
// Carousel (the host builds slides then wraps the shared <BuilderCarousel>), the
// Outlet, and the ThemeToggle's live policy gate. Both walkers render the SAME
// components for those, so there is no per-type drift to unify.
//
// Server- AND client-safe: this module carries no 'use client' directive, so the
// live RSC tree and the client canvas both call it. The genuinely-interactive
// atoms it returns are 'use client' islands (commerce/carousel/icon/signup); the
// rest is presentational. No server-only imports (@sparx/db, next/headers).

import * as React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import {
  coerceNavLinks,
  emailStyleFor,
  isRawElementType,
  isRawVoidType,
  legacyButtonStyleToClass,
  rawElementText,
  rawTagOf,
  safeElementAttrs,
  sampleEmailText,
  type BuilderNode,
  type Cardinality,
} from '@sparx/builder-schemas';
import {
  Divider,
  EditorialSection,
  EmbedFrame,
  FAQ,
  FeatureGrid,
  Heading,
  Image,
  Logo,
  PriceTag,
  SocialLinks,
  Stat,
  Text,
  ThemeToggle,
  Wordmark,
  type WordmarkCollapse,
} from '@sparx/site-ui';
// Server-safe JSON→HTML serializer (no React/jsdom) — the audited CMS path. Used
// by the Prose leaf for both a bound rich-text body and an authored doc.
import { renderDocToHtml } from '@sparx/cms-editor/serialize';

import {
  BuilderActionButton,
  BuilderAddToCart,
  BuilderBuyBox,
  BuilderQuantity,
  BuilderVariantPicker,
  type BuilderProduct,
} from './commerce';
import { BuilderDialog } from './dialog';
import { BuilderLightbox } from './lightbox';
import { BuilderIcon } from './icon';
import { renderSiteUiAtom } from './site-atoms';
import { SignupForm } from './signup';
import { BuilderAccountMenu } from './account-menu';
import { SAMPLE_BUILDER_PRODUCT } from './sample-product';
import { sxAttrs } from './behaviors/attrs';
import {
  CANVAS_EMAIL_PALETTE,
  EmailButtonLeaf,
  EmailDividerLeaf,
  EmailHeadingLeaf,
  EmailLineItemsLeaf,
  EmailProseLeaf,
  EmailTextLeaf,
  EmailWordmarkLeaf,
} from './email-leaf';

export type RenderMode = 'live' | 'edit';
export type RenderSurface = 'page' | 'site' | 'email';

export interface LeafRenderArgs {
  node: BuilderNode;
  /** Resolved binding value (undefined when the node is unbound). */
  value: unknown;
  cardinality: Cardinality;
  bound: boolean;
  /** `live` ships acting elements + production-empty output; `edit` (the canvas)
   *  feeds commerce atoms a sample product and shows placeholders for empties. */
  mode: RenderMode;
  /** `page`/`site` → @sparx/site-ui scale; `email` → the @sparx/email pixel scale. */
  surface: RenderSurface;
  /** node.class to apply on the leaf's OWN element, for leaves that style
   *  themselves by class (leafWearsClass). Undefined → the host wrapper carries
   *  node.class instead. */
  leafClass?: string;
  /** Pre-rendered child nodes for a leaf that nests them (Button → inline Icon).
   *  The leaf decides where they sit relative to its own content. */
  children?: React.ReactNode;
  /** Editor SAMPLE data for `{{merge.token}}` resolution on the email surface. */
  emailSample?: Record<string, unknown>;
  /** The email surface's resolved brand (logo + store name) for the wordmark header. */
  emailBrand?: { logoUrl?: string | null; name?: string | null };
}

// Leaves whose Surface component (or, for Button/Badge/Icon, the recipe class)
// owns node.class ON ITS OWN ELEMENT (docs/47 §7, docs/61). For these the host
// passes `leafClass` and omits its own wrapper class. MUST match the live
// renderer's historical CLASS_ON_LEAF set exactly so the unified path is a no-op
// for the live site.
const CLASS_ON_LEAF: ReadonlySet<string> = new Set([
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
  'NavItem',
  'NavMegamenu',
  'AccountMenu',
  'SocialLinks',
  // Site-UI atoms (docs/102 Track A) — each renders a real @sparx/site-ui component
  // that wears the recipe + utilities on its own root, so the host suppresses its
  // wrapper class and passes node.class through as leafClass.
  'Input',
  'Textarea',
  'Select',
  'Checkbox',
  'Radio',
  'Switch',
  'Range',
  'FileInput',
  'Label',
  'Field',
  'Validator',
  'Alert',
  'Callout',
  'Progress',
  'RadialProgress',
  'Skeleton',
  'Spinner',
  'Avatar',
  'Tag',
  'Rating',
  'Kbd',
  'Status',
  'Table',
  'List',
  'ChatBubble',
  'Countdown',
  'Menu',
  'Steps',
  'Pagination',
  'Breadcrumb',
  'Link',
  'Dock',
  'Indicator',
  'Join',
  'Mask',
  'Browser',
  'Window',
  'Phone',
  'Code',
  'Swap',
  'Filter',
  'Calendar',
  'Diff',
  'TextRotate',
  'Hover3DCard',
  'HoverGallery',
  // Overlay / floating (docs/102 Track C follow-up): the positioned regions
  // (Toast/FAB, platform `st-*` CSS owns the `fixed`) + the Dialog island, all
  // styling their own element with node.class.
  'Toast',
  'FAB',
  'Dialog',
  'Lightbox',
]);

/** Does this leaf type style its own element with node.class (so the host should
 *  pass it as `leafClass` and suppress its own wrapper class)? Shared by both
 *  host walkers so the live site and the canvas agree on where node.class lands. */
export function leafWearsClass(type: string): boolean {
  return CLASS_ON_LEAF.has(type);
}

/** The product the commerce atoms render against: the resolved binding value when
 *  it is a usable product, else — in the editor canvas — the sample fixture, so the
 *  buy box previews the REAL component with believable values (docs/builder/02 §2.2).
 *  Live with no product falls through to the raw value (BuyBox renders nothing). */
export function resolveBuilderProduct(value: unknown, mode: RenderMode): BuilderProduct {
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as BuilderProduct).variants) &&
    (value as BuilderProduct).variants.length > 0
  ) {
    return value as BuilderProduct;
  }
  return mode === 'edit' ? SAMPLE_BUILDER_PRODUCT : (value as BuilderProduct);
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
 *  rich-text doc flattened to plain text. */
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

// ── Embed + inline-list parsing (mirrored from the legacy registry/renderer; one
//    copy now lives here). ─────────────────────────────────────────────────────

/** A YouTube watch/share/embed URL (or bare id) → a privacy-friendly embed URL. */
export function youtubeEmbed(url: string): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{6,})/.exec(u);
  const id = m?.[1] ?? (/^[\w-]{6,}$/.test(u) ? u : null);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

/** A Google Maps embed URL from an explicit embed URL or a free-text place query. */
export function mapEmbed(query: string, embedUrl: string): string | null {
  if (embedUrl?.trim()) return embedUrl.trim();
  const q = (query ?? '').trim();
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
}

/** Authored-inline Q&A pairs for the FAQ leaf (separated by a line of 3+ dashes;
 *  within a block the first non-empty line is the question, the rest the answer). */
export function parseFaqItems(raw: string): { question: string; answer: string }[] {
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

/** Authored-inline feature cards for the FeatureGrid leaf (one per line,
 *  `Title | Body`, auto-numbered, or `Number | Title | Body`). */
export function parseFeatureItems(raw: string): { number: string; title: string; body: string }[] {
  return (raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split('|').map((s) => s.trim());
      const auto = String(i + 1).padStart(2, '0');
      if (parts.length >= 3) {
        const head = parts[0];
        return {
          number: head && head !== '' ? head : auto,
          title: parts[1] ?? '',
          body: parts.slice(2).join(' | '),
        };
      }
      if (parts.length === 2) return { number: auto, title: parts[0] ?? '', body: parts[1] ?? '' };
      return { number: auto, title: parts[0] ?? '', body: '' };
    })
    .filter((f) => f.title !== '');
}

// Representative content shown for an otherwise-empty leaf in the EDITOR (so the
// node stays visible + selectable while unauthored). Never used on a live page.
const SAMPLE_FAQ = [{ question: 'Your question here?', answer: 'And the answer here.' }];
const SAMPLE_FEATURES = [
  { number: '01', title: 'Feature one', body: 'What it does.' },
  { number: '02', title: 'Feature two', body: 'What it does.' },
  { number: '03', title: 'Feature three', body: 'What it does.' },
];
const SAMPLE_SOCIAL = [
  { platform: 'Twitter', url: '#' },
  { platform: 'Instagram', url: '#' },
  { platform: 'LinkedIn', url: '#' },
];
// Representative rows shown when a `line_item_table` isn't bound (the binding still
// drives the actual send). Mirrors the FAQ / FeatureGrid placeholder approach.
const SAMPLE_LINE_ITEMS: Record<string, unknown>[] = [
  { name: 'Single-origin beans — Lot 7', quantity: '2', lineTotal: '$36.00' },
  { name: 'Pour-over filters (100 ct)', quantity: '1', lineTotal: '$12.00' },
];

/** The editor media empty-state — a `bx-ph` slot at the node's ratio. Edit-only. */
function Placeholder({ label, ratio }: { label?: string; ratio?: string }) {
  return (
    <div className={`bx-ph bx-ratio-${ratio ?? 'wide'}`}>
      <ImageIcon className="bx-ph__icon" aria-hidden />
      {label ? <span className="bx-ph__label">{label}</span> : null}
    </div>
  );
}

// ── NavMenu back-compat (docs/57 rebuild) ─────────────────────────────────────
//
// NavMenu is now a CONTAINER of NavItem child nodes. A not-yet-migrated NavMenu
// still carries its links in the old `props.links[]` bag (the leaf model); until
// the `20260703_navmenu_container` tree migration converts those into NavItem
// children, the host container branch falls back to these. The markup is the
// SAME `<a class="st-nav__item">` a childless NavItem renders, so the two paths
// are pixel-identical during the transition and existing sites never render an
// empty nav. Shared by the live renderer, the canvas, and the View-HTML
// serializer so all three agree.
export function renderLegacyNavLinks(links: unknown): React.ReactNode[] {
  return coerceNavLinks(links, undefined).map((l, i) => (
    <a
      key={`legacy-${i}-${l.label}`}
      className="st-nav__item"
      href={l.href || '#'}
      {...(l.openInNewTab ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {l.label}
    </a>
  ));
}

// ── The unified leaf render ───────────────────────────────────────────────────

export function renderLeaf(args: LeafRenderArgs): React.ReactNode {
  const { node, value, cardinality, bound, mode, surface, leafClass, children, emailSample } = args;
  const email = surface === 'email';
  const edit = mode === 'edit';
  // Email canvas parity (Email v2 §3.6c): the email-safe subset of node.class compiled
  // to an inline style, mirroring the real send's `classStyleFor`. Merged LAST on each
  // email leaf so an author's class wins over the email default — so the editor preview
  // and the delivered mail agree. Empty (and thus a no-op) for a class with no
  // email-relevant tokens, or off the email surface entirely.
  const emailStyle: React.CSSProperties | undefined = email
    ? emailStyleFor(node.class, CANVAS_EMAIL_PALETTE)
    : undefined;
  const p = node.props;
  const str = (k: string): string => (typeof p[k] === 'string' ? p[k] : '');
  // {{merge.token}} resolution on the email surface (identity elsewhere — no tokens).
  const tpl = (s: string): string => (email ? sampleEmailText(s, emailSample) : s);
  // Bound value as text (live semantics), else the authored fallback (token-resolved
  // for email). `ph` supplies a placeholder string in the editor only.
  const ph = (s: string): string => (edit ? s : '');
  const boundOr = (fallback: string): string => (bound ? asText(value) : '') || tpl(fallback);

  // Action triggers (docs/98 Pillar 7) — a Button / link / raw button-or-anchor
  // carrying an ACTION binding becomes a cart/navigation trigger wired to the
  // ancestor product scope. The element wears the author's class (leafClass), or a
  // button recipe as the fallback. Email has no JS runtime, so an action there
  // falls through to the normal (static) render below.
  const action = node.binding?.action;
  if (action && !email) {
    const actionLabel: Record<string, string> = {
      'add-to-cart': 'Add to cart',
      'buy-now': 'Buy now',
      link: 'Open link',
      submit: 'Submit',
    };
    // A trigger WRAPPING content (an image/heading linked to a PDP) is identified by
    // its children — its label is the wrapped content, so don't inject a fallback
    // ("Open link" etc.). A bare trigger with no content keeps the action's default.
    const label =
      str('label') ||
      str('text') ||
      rawElementText(node) ||
      (children ? '' : (actionLabel[action] ?? 'Button'));
    const className = leafClass ?? legacyButtonStyleToClass(str('style'));
    const linkHref = (node.binding?.href ?? '') || str('href');
    const href = action === 'link' ? linkHref || undefined : undefined;
    return (
      <BuilderActionButton action={action} label={label} className={className} href={href}>
        {children}
      </BuilderActionButton>
    );
  }

  // Raw HTML elements (docs/98 Pillar 1) — render the whitelisted tag with its
  // sanitized attributes (the host walker handles raw CONTAINER tags itself; a
  // raw LEAF/void/text element renders here). The element wears node.class on its
  // own tag, so the walker passes it as `leafClass` and omits its wrapper.
  if (isRawElementType(node.type)) {
    const tag = rawTagOf(node.type)!;
    // Sanctioned behavior markers (Pillar 5) ride along as data-sx-* on the raw tag,
    // so a raw leaf used as a carousel dot / accordion trigger is wired by the runtime.
    const attrs = { ...sxAttrs(node), ...safeElementAttrs(node) };
    if (isRawVoidType(node.type)) {
      // An unsourced media void previews as a slot in the editor so it stays selectable.
      if (edit && (tag === 'img' || tag === 'source') && !attrs.src) {
        return <Placeholder ratio="wide" label={typeof attrs.alt === 'string' ? attrs.alt : tag} />;
      }
      return React.createElement(tag, { className: leafClass, ...attrs });
    }
    // A bound value fills text elements (e.g. an <a> label from a field); else the
    // authored text, the nested inline children, or a faint tag label while empty.
    const text = (bound ? asText(value) : '') || rawElementText(node);
    const inner = children ?? (text || (edit ? `<${tag}>` : null));
    return React.createElement(tag, { className: leafClass, ...attrs }, inner);
  }

  switch (node.type) {
    case 'Heading': {
      const level = (str('level') || 'h2') as 'h1' | 'h2' | 'h3';
      // Opt-in display/hero scale (docs/46) — render an h1 at the larger size
      // without changing the semantic level.
      const size = str('size') === 'display' ? 'display' : undefined;
      const text = boundOr(str('text') || ph('Heading'));
      if (email)
        return (
          <EmailHeadingLeaf level={level} style={emailStyle}>
            {text}
          </EmailHeadingLeaf>
        );
      return (
        <Heading level={level} size={size} className={leafClass}>
          {text}
        </Heading>
      );
    }
    case 'Text': {
      const variant = (str('variant') || 'body') as 'body' | 'eyebrow' | 'meta';
      const text = boundOr(str('text') || ph('Some text'));
      if (email)
        return (
          <EmailTextLeaf variant={variant} style={emailStyle}>
            {text}
          </EmailTextLeaf>
        );
      return (
        <Text variant={variant} className={leafClass}>
          {text}
        </Text>
      );
    }
    case 'Prose': {
      const cls = leafClass ? `sparx-content ${leafClass}` : 'sparx-content';
      if (bound) {
        // Bound to a CMS richtext field. Preview data is a representative string in
        // the editor; the live site resolves the real doc.
        if (typeof value === 'string') {
          if (email)
            return (
              <EmailTextLeaf variant="body" style={emailStyle}>
                {value}
              </EmailTextLeaf>
            );
          return (
            <article className={cls}>
              <p>{value}</p>
            </article>
          );
        }
        const html = renderDocToHtml(value);
        if (html) {
          if (email) return <EmailProseLeaf html={html} style={emailStyle} />;
          return <article className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        const plain = asText(value);
        if (!plain) return null;
        if (email)
          return (
            <EmailTextLeaf variant="body" style={emailStyle}>
              {plain}
            </EmailTextLeaf>
          );
        return (
          <article className={cls}>
            <p>{plain}</p>
          </article>
        );
      }
      // Unbound → the authored doc (props.doc). The live site renders it too (this
      // is the authored rich-text body the retired template editor used to own,
      // docs/52 §9) — closing the canvas-showed-it / site-didn't gap.
      const html = p.doc ? renderDocToHtml(p.doc) : '';
      if (html) {
        if (email) return <EmailProseLeaf html={html} style={emailStyle} />;
        return <article className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
      }
      if (!edit) return null;
      const empty = 'Rich body content renders here — paragraphs, headings, lists, quotes, links.';
      if (email)
        return (
          <EmailTextLeaf variant="body" style={emailStyle}>
            {empty}
          </EmailTextLeaf>
        );
      return (
        <article className={cls}>
          <p>{empty}</p>
        </article>
      );
    }
    case 'Button': {
      const label = boundOr(str('label') || 'Button');
      // On email, the filled accent CTA at the @sparx/email scale (docs/93).
      if (email) {
        return (
          <EmailButtonLeaf style={emailStyle}>
            {label}
            {children}
          </EmailButtonLeaf>
        );
      }
      // Class-first (docs/47 §7): the look is the recipe class (`st-btn st-c-* …`),
      // carried on the element via leafClass; a LEGACY button (no class, styled via
      // the old `props.style` enum) maps that enum to the SAME recipe. A linked
      // button is an <a>; an action button a real <button>. The capture-phase canvas
      // shield neutralizes the navigation/submit in edit mode, so both surfaces ship
      // the correct element (no inert <span>). A nested Icon renders after the label.
      const className = leafClass ?? legacyButtonStyleToClass(str('style'));
      const href = str('href');
      return href ? (
        <a href={href} className={className}>
          {label}
          {children}
        </a>
      ) : (
        <button type="button" className={className}>
          {label}
          {children}
        </button>
      );
    }
    case 'Badge': {
      const label = boundOr(str('label') || 'Badge');
      return (
        <span className={leafClass ?? 'st-badge st-c-neutral st-v-soft st-badge--sz-md'}>
          {label}
          {children}
        </span>
      );
    }
    case 'Icon': {
      const name = (bound ? asText(value) : '') || str('name') || 'star';
      return <BuilderIcon name={name} className={leafClass} />;
    }
    case 'Divider':
      return email ? <EmailDividerLeaf /> : <Divider className={leafClass} />;
    case 'PriceTag': {
      const n = bound && typeof value === 'number' ? value : null;
      return <PriceTag amount={n} className={leafClass} />;
    }
    case 'Image':
    case 'ImageDisplay': {
      const ratio = (str('ratio') || 'wide') as 'wide' | 'square' | 'portrait';
      // Email previews the slot as a placeholder (the send resolves the real <Img>).
      if (email) return <Placeholder ratio={ratio} label={str('alt')} />;
      const img = bound ? firstImage(value) : null;
      // Keep an empty image node visible + selectable in the editor.
      if (edit && !img?.url) return <Placeholder ratio={ratio} label={str('alt')} />;
      return (
        <Image src={img?.url} alt={img?.alt ?? str('alt')} ratio={ratio} className={leafClass} />
      );
    }
    case 'Video': {
      const ratio = (str('ratio') || 'wide') as 'wide' | 'square' | 'portrait';
      const src = youtubeEmbed(str('url'));
      if (!src) return edit ? <Placeholder ratio={ratio} label="Add a YouTube URL" /> : null;
      return (
        <EmbedFrame src={src} title={node.name ?? 'Video'} ratio={ratio} className={leafClass} />
      );
    }
    case 'Map': {
      const ratio = (str('ratio') || 'pano') as 'wide' | 'square' | 'portrait' | 'pano';
      const src = mapEmbed(str('query'), str('embedUrl'));
      if (!src)
        return edit ? (
          <Placeholder ratio={ratio === 'pano' ? 'wide' : ratio} label="Add a place" />
        ) : null;
      return (
        <EmbedFrame src={src} title={node.name ?? 'Map'} ratio={ratio} className={leafClass} />
      );
    }
    case 'Stat': {
      const big = boundOr(str('value') || '0');
      return <Stat value={big} label={str('label')} className={leafClass} />;
    }

    // ── Tier-2 commerce (docs/40 §7) ─────────────────────────────────────────
    // BuyBox is self-contained (bound to `product`). The atoms read the shared
    // ProductForm context an ancestor establishes, so they ignore `value`. In edit
    // mode BuyBox falls back to the sample product (the atoms get it from the
    // ProductFormProvider the host wraps with the same sample).
    case 'BuyBox':
      return <BuilderBuyBox product={resolveBuilderProduct(value, mode)} />;
    case 'VariantPicker':
      return <BuilderVariantPicker />;
    case 'Quantity':
      return <BuilderQuantity />;
    case 'AddToCart':
      return <BuilderAddToCart label={str('label') || undefined} />;

    // ── Page-content composites (docs/51 §7) ─────────────────────────────────
    case 'EditorialSection': {
      const obj =
        bound && value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      const pick = (k: string, prop: string) => (obj ? asText(obj[k]) : '') || str(prop);
      const ctaUrl = (obj && typeof obj.ctaUrl === 'string' ? obj.ctaUrl : '') || str('ctaUrl');
      return (
        <EditorialSection
          eyebrow={pick('eyebrow', 'eyebrow')}
          headline={pick('headline', 'headline') || ph('Headline')}
          body={pick('body', 'body')}
          ctaLabel={pick('ctaLabel', 'ctaLabel')}
          ctaUrl={ctaUrl}
          className={leafClass}
        />
      );
    }
    case 'FAQ': {
      const items =
        cardinality === 'array' && Array.isArray(value)
          ? (value as Record<string, unknown>[]).map((it) => ({
              question: asText(it.question),
              answer: asText(it.answer),
            }))
          : parseFaqItems(str('items'));
      const list = items.filter((it) => it.question);
      const show = list.length ? list : edit ? SAMPLE_FAQ : list;
      return <FAQ items={show} className={leafClass} />;
    }
    case 'FeatureGrid': {
      const items =
        cardinality === 'array' && Array.isArray(value)
          ? (value as Record<string, unknown>[]).map((it, i) => ({
              number: asText(it.number) || String(i + 1).padStart(2, '0'),
              title: asText(it.title),
              body: asText(it.body),
            }))
          : parseFeatureItems(str('items'));
      const list = items.filter((f) => f.title);
      const show = list.length ? list : edit ? SAMPLE_FEATURES : list;
      const cols = Math.min(4, Math.max(2, Number(str('columns')) || 3)) as 2 | 3 | 4;
      return <FeatureGrid cols={cols} items={show} className={leafClass} />;
    }

    // ── Site chrome (docs/45) ────────────────────────────────────────────────
    case 'Logo': {
      const identity =
        value && typeof value === 'object' ? (value as { name?: unknown; logo?: unknown }) : null;
      const name = typeof identity?.name === 'string' ? identity.name : '';
      const img = firstImage(identity?.logo);
      return <Logo name={name} src={img?.url} alt={img?.alt ?? name} className={leafClass} />;
    }
    case 'Wordmark': {
      const identity =
        value && typeof value === 'object' ? (value as { name?: unknown; logo?: unknown }) : null;
      const name = typeof identity?.name === 'string' ? identity.name : '';
      const img = firstImage(identity?.logo);
      const collapse = (str('collapse') || 'mark') as WordmarkCollapse;
      return (
        <Wordmark
          name={name}
          src={img?.url}
          alt={img?.alt ?? name}
          collapse={collapse}
          className={leafClass}
        />
      );
    }
    case 'NavItem': {
      // A composed nav link (docs/57 rebuild). Alone it renders an <a>; WITH child
      // NavItems it becomes a CSS-only <details> dropdown (trigger + panel of the
      // rendered children), the same way a Button nests an Icon. Wears node.class
      // (leafClass) on its own tag; the structural `st-*` class is always present.
      const label = str('label') || (edit ? 'Menu item' : '');
      const iconName = str('icon');
      const glyph = iconName ? <BuilderIcon name={iconName} className="st-navitem__icon" /> : null;
      const newTab = p.openInNewTab === true;
      if (children) {
        return (
          <details className={leafClass ? `st-navitem-drop ${leafClass}` : 'st-navitem-drop'}>
            <summary className="st-navitem-drop__summary">
              {glyph}
              <span>{label || (edit ? 'Menu' : '')}</span>
              <span className="st-navitem-drop__caret" aria-hidden>
                ▾
              </span>
            </summary>
            <div className="st-navitem-drop__panel">{children}</div>
          </details>
        );
      }
      const href = str('href') || '#';
      return (
        <a
          className={leafClass ? `st-nav__item ${leafClass}` : 'st-nav__item'}
          href={href}
          {...(newTab ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
        >
          {glyph}
          {label}
        </a>
      );
    }
    case 'NavMegamenu': {
      // A mega-menu (docs/57 rebuild): a labelled trigger that opens a WIDE,
      // multi-column panel. Like NavItem's dropdown it's a CSS-only <details>
      // disclosure, but its panel lays its authored children out as columns (the
      // `columns` prop picks 2/3/4). A leaf-with-children, so the host walkers pass
      // the rendered children straight through and each column stays selectable.
      const label = str('label') || (edit ? 'Menu' : '');
      const iconName = str('icon');
      const glyph = iconName ? <BuilderIcon name={iconName} className="st-navitem__icon" /> : null;
      const cols = str('columns') === '2' || str('columns') === '4' ? str('columns') : '3';
      return (
        <details className={leafClass ? `st-navmega ${leafClass}` : 'st-navmega'}>
          <summary className="st-navitem-drop__summary">
            {glyph}
            <span>{label}</span>
            <span className="st-navitem-drop__caret" aria-hidden>
              ▾
            </span>
          </summary>
          <div className={`st-navmega__panel st-navmega__panel--c${cols}`}>{children}</div>
        </details>
      );
    }
    case 'AccountMenu': {
      // The customer-account navbar affordance (docs/27). A client island reading the
      // live session from the Builder runtime; the canvas previews the signed-in
      // menu. Wears node.class (leafClass) on the AccountMenu root.
      const href = (k: string) => str(k) || undefined;
      return (
        <BuilderAccountMenu
          className={leafClass}
          signInHref={href('signInHref')}
          signUpHref={href('signUpHref')}
          accountHref={href('accountHref')}
          ordersHref={href('ordersHref')}
          wishlistHref={href('wishlistHref')}
          signInLabel={href('signInLabel')}
          signUpLabel={href('signUpLabel')}
        />
      );
    }
    // NavMenu is no longer a leaf — it's a CONTAINER of NavItem children rendered
    // by the host walkers into a responsive <NavShell> (docs/57 rebuild). Its
    // back-compat for a not-yet-migrated `props.links[]` is `renderLegacyNavLinks`
    // below, which the host branch calls.
    case 'SocialLinks': {
      const raw =
        cardinality === 'array' && Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const items = raw.map((it) => ({
        platform: typeof it.platform === 'string' ? it.platform : '',
        url: typeof it.url === 'string' ? it.url : '#',
      }));
      if (items.length === 0 && !edit) return <SocialLinks items={items} className={leafClass} />;
      const source = items.length > 0 ? items : SAMPLE_SOCIAL;
      return <SocialLinks items={source} className={leafClass} />;
    }
    // The email-capture block (docs/51 §7). The island owns submit + the thank-you
    // state via the injected runtime (no-op in the canvas, capture endpoint live).
    case 'Signup':
      return <SignupForm cta={str('cta') || undefined} />;
    // The light/dark switch. Inert here (the canvas always previews it); the live
    // host gates it on the site's appearance policy + scope before calling this.
    case 'ThemeToggle':
      return <ThemeToggle inert />;

    // ── Email automation nodes (docs/93) — email surface only ─────────────────
    case 'email_wordmark':
      return (
        <EmailWordmarkLeaf
          treatment={(str('treatment') as 'lockup' | 'logo' | 'name') || 'lockup'}
          align={(str('align') as 'left' | 'center') || 'left'}
          size={(str('size') as 'sm' | 'md' | 'lg') || 'md'}
          logoUrl={args.emailBrand?.logoUrl}
          name={args.emailBrand?.name}
        />
      );
    case 'line_item_table': {
      const rows =
        cardinality === 'array' && Array.isArray(value)
          ? (value as Record<string, unknown>[])
          : SAMPLE_LINE_ITEMS;
      return <EmailLineItemsLeaf items={rows} />;
    }
    case 'unsubscribe_link':
      return (
        <EmailTextLeaf variant="meta" style={emailStyle}>
          You’re receiving this because you opted in.{' '}
          <span style={{ textDecoration: 'underline' }}>Unsubscribe</span>
        </EmailTextLeaf>
      );
    case 'physical_address':
      return (
        <EmailTextLeaf variant="meta" style={emailStyle}>
          123 Example St, Springfield, IL 62704
        </EmailTextLeaf>
      );

    // ── Modal / dialog (docs/102 Track C follow-up) ──────────────────────────
    // The Radix-backed overlay island — the one atom that can't be a catalog
    // composition (a full-viewport backdrop needs `fixed inset-0`, denied by the
    // compile allowlist). Email has no JS modal, so it falls through to the panel
    // body content rendered inline (the children) — no trigger, no overlay.
    case 'Dialog': {
      if (email) return <>{children}</>;
      const placement = (str('placement') || 'center') as 'top' | 'center' | 'bottom';
      return (
        <BuilderDialog
          leafClass={leafClass}
          triggerLabel={str('triggerLabel') || 'Open dialog'}
          title={str('title') || (edit ? 'Dialog title' : 'Dialog')}
          description={str('description') || undefined}
          closeLabel={str('closeLabel') || 'Close'}
          placement={placement}
          edit={edit}
        >
          {children}
        </BuilderDialog>
      );
    }

    case 'Lightbox': {
      if (email) return <>{children}</>;
      return (
        <BuilderLightbox leafClass={leafClass} edit={edit}>
          {children}
        </BuilderLightbox>
      );
    }

    // The rest of the @sparx/site-ui library, exposed as droppable atoms (docs/102
    // Track A) — form controls, feedback, data display, navigation, mockups. Their
    // render is the shared site-atoms map; `undefined` means not one of them.
    default: {
      const atom = renderSiteUiAtom(node, { leafClass, value, bound, cardinality, edit, children });
      return atom === undefined ? null : atom;
    }
  }
}
