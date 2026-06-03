// The component registry — the catalog the builder composes from.
//
// Tier-1 primitives (Section/Grid/Stack/Heading/Text/Image/Button) and Tier-2
// data-aware components (ImageDisplay/PriceTag/Signup) live in ONE registry and
// ONE palette. Each entry declares:
//   · kind        — container (arranges children) or leaf (renders content)
//   · bindable    — can it bind to data, and which cardinalities it handles
//   · box axes    — which parts of the universal box base are meaningful
//   · props       — its own config (drives the inspector's component panel)
//   · render      — leaf markup, or container chrome
//
// The canvas owns the universal concerns (box base, layout, iteration,
// selection). A definition only describes what's specific to itself.

import * as React from 'react';
import {
  DollarSign,
  Fingerprint,
  GalleryHorizontal,
  Hash,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MapPin,
  Menu,
  Minus,
  MousePointerClick,
  Package,
  Palette,
  PlayCircle,
  Rows3,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Square,
  SquareDashed,
  Type,
  type LucideIcon,
} from 'lucide-react';

import {
  DEFAULT_BOX,
  DEFAULT_LAYOUT,
  makeId,
  type BoxBase,
  type BuilderNode,
  type Cardinality,
  type LayoutBase,
} from './model';

export type NodeKind = 'container' | 'leaf';
export type ModuleKey = 'cms' | 'commerce' | 'crm' | 'events' | 'site';
export type PaletteGroup = 'layout' | 'content' | 'data';
/** Which editor surface a component belongs to. `page` = the content outlet
 *  (per-record content); `site` = the layout shell (chrome zones). Most
 *  primitives belong to BOTH; the Outlet + chrome components are site-only, and
 *  per-record data leaves are page-only. */
export type EditorSurface = 'page' | 'site';

export interface PropSpec {
  key: string;
  label: string;
  control: 'text' | 'textarea' | 'select' | 'buttongroup' | 'switch';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface LeafRenderArgs {
  node: BuilderNode;
  /** Resolved binding value (undefined when the node is unbound). */
  value: unknown;
  cardinality: Cardinality;
  bound: boolean;
}

export interface ComponentDef {
  type: string;
  label: string;
  kind: NodeKind;
  group: PaletteGroup;
  icon: LucideIcon;
  /** Data-aware components belong to a module (shown under "From your modules"
   *  and color-coded). Primitives have no module. */
  module?: ModuleKey;
  bindable: boolean;
  /** Cardinalities this component meaningfully handles — used for the binding
   *  hint and for deciding iterate-vs-once on containers. */
  accepts: Cardinality[];
  /** Editor surfaces this component appears in (docs/45 §2.5). Omitted = both
   *  the page editor and the site (layout) editor. */
  surfaces?: EditorSurface[];
  props: PropSpec[];
  /** Defaults applied when the component is dropped from the palette. */
  defaults: {
    box?: Partial<BoxBase>;
    layout?: Partial<LayoutBase>;
    props?: Record<string, unknown>;
    /** Archetype seed (docs/47 §11): the brand-governed class bundle a freshly
     *  dropped node carries (e.g. a Button → `sf-btn sf-c-primary sf-v-solid
     *  sf-btn--sz-md`). The inspector's Style controls then read / write its
     *  `sf-c-*` / `sf-v-*` groups; the published site renders the real Surface
     *  component against the loaded `@sparx/site-ui` stylesheet. */
    class?: string;
  };
  /** Extra chrome class for containers (e.g. Card border). */
  chromeClass?: string;
  renderLeaf?: (a: LeafRenderArgs) => React.ReactNode;
}

// ── Small helpers ────────────────────────────────────────────────────────────

const firstString = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
};

const asImage = (v: unknown): { url?: string; alt?: string; description?: string } | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : null;

// YouTube watch/share/embed URL — or a bare id — → a privacy-friendly embed URL.
// Mirrored in the storefront renderer (kept tiny + duplicated, like bgProps).
export function youtubeEmbed(url: string): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{6,})/.exec(u);
  const id = m?.[1] ?? (/^[\w-]{6,}$/.test(u) ? u : null);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

// A Google Maps embed URL from an explicit embed URL or a free-text place query.
// `?output=embed` needs no API key. Mirrored in the storefront renderer.
export function mapEmbed(query: string, embedUrl: string): string | null {
  if (embedUrl?.trim()) return embedUrl.trim();
  const q = (query ?? '').trim();
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
}

// Hand-typed nav links — one per line, `Label` or `Label|/url`. The fallback for
// a NavMenu that isn't bound to a CMS menu. Mirrored in the storefront renderer.
export function parseNavLinks(raw: string): { label: string; url: string }[] {
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

function Placeholder({ label, ratio }: { label: string; ratio?: string }) {
  return (
    <div className={`bx-ph bx-ratio-${ratio ?? 'wide'}`}>
      <ImageIcon className="bx-ph__icon" aria-hidden />
      {label ? <span className="bx-ph__label">{label}</span> : null}
    </div>
  );
}

// ── The registry ─────────────────────────────────────────────────────────────

const DEFS: ComponentDef[] = [
  // ---- Layout primitives (containers) ----
  {
    type: 'Section',
    label: 'Section',
    kind: 'container',
    group: 'layout',
    icon: LayoutTemplate,
    bindable: true,
    accepts: ['object', 'array', 'empty'],
    props: [],
    defaults: { box: { padding: 'lg', contentWidth: 'contained' }, layout: { direction: 'stack' } },
    chromeClass: 'bx-section',
  },
  {
    type: 'Grid',
    label: 'Grid',
    kind: 'container',
    group: 'layout',
    icon: LayoutGrid,
    bindable: true,
    accepts: ['array', 'empty'],
    props: [],
    defaults: { box: { padding: 'none' }, layout: { direction: 'grid', columns: 3, gap: 'lg' } },
    chromeClass: 'bx-grid',
  },
  {
    type: 'Stack',
    label: 'Stack',
    kind: 'container',
    group: 'layout',
    icon: Rows3,
    bindable: true,
    accepts: ['object', 'array', 'empty'],
    props: [],
    defaults: { box: { padding: 'none' }, layout: { direction: 'stack', gap: 'md' } },
    chromeClass: 'bx-stack',
  },
  {
    type: 'Card',
    label: 'Card',
    kind: 'container',
    group: 'layout',
    icon: Square,
    bindable: true,
    accepts: ['object', 'empty'],
    props: [],
    defaults: {
      box: { surface: 'subtle', padding: 'none' },
      layout: { direction: 'stack', gap: 'sm' },
    },
    chromeClass: 'bx-card',
  },
  {
    // A rotator: each direct child is one SLIDE. The editor shows the slides
    // stacked (so you can edit each); the storefront renders a real client
    // carousel (BuilderCarousel) with the autoplay/arrows/dots set here.
    type: 'Carousel',
    label: 'Carousel',
    kind: 'container',
    group: 'layout',
    icon: GalleryHorizontal,
    bindable: true,
    accepts: ['array', 'empty'],
    props: [
      { key: 'autoplay', label: 'Autoplay', control: 'switch' },
      {
        key: 'interval',
        label: 'Seconds per slide',
        control: 'select',
        options: [
          { value: '4', label: '4s' },
          { value: '6', label: '6s' },
          { value: '8', label: '8s' },
          { value: '12', label: '12s' },
        ],
      },
      { key: 'arrows', label: 'Arrows', control: 'switch' },
      { key: 'dots', label: 'Dots', control: 'switch' },
    ],
    defaults: {
      box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
      layout: { direction: 'stack', gap: 'md' },
      props: { autoplay: true, interval: '6', arrows: true, dots: true },
    },
  },

  // ---- Content & media (leaves) ----
  {
    type: 'Heading',
    label: 'Heading',
    kind: 'leaf',
    group: 'content',
    icon: HeadingIcon,
    bindable: true,
    accepts: ['scalar'],
    props: [
      {
        key: 'level',
        label: 'Level',
        control: 'buttongroup',
        options: [
          { value: 'h1', label: 'H1' },
          { value: 'h2', label: 'H2' },
          { value: 'h3', label: 'H3' },
        ],
      },
      { key: 'text', label: 'Text', control: 'text', placeholder: 'Heading text' },
    ],
    defaults: { props: { level: 'h2', text: 'Heading' } },
    renderLeaf: ({ node, value, bound }) => {
      const level = (node.props.level as string) ?? 'h2';
      const text = bound ? firstString(value, '—') : firstString(node.props.text, 'Heading');
      const Tag = (level === 'h1' ? 'h1' : level === 'h3' ? 'h3' : 'h2') as 'h1';
      return <Tag className={`bx-h bx-${level}`}>{text}</Tag>;
    },
  },
  {
    type: 'Text',
    label: 'Text',
    kind: 'leaf',
    group: 'content',
    icon: Type,
    bindable: true,
    accepts: ['scalar'],
    props: [
      {
        key: 'variant',
        label: 'Style',
        control: 'buttongroup',
        options: [
          { value: 'body', label: 'Body' },
          { value: 'eyebrow', label: 'Eyebrow' },
          { value: 'meta', label: 'Meta' },
        ],
      },
      { key: 'text', label: 'Text', control: 'textarea', placeholder: 'Type some text…' },
    ],
    defaults: { props: { variant: 'body', text: 'Some text' } },
    renderLeaf: ({ node, value, bound }) => {
      const variant = (node.props.variant as string) ?? 'body';
      const text = bound ? firstString(value, '—') : firstString(node.props.text, 'Some text');
      return <p className={`bx-text bx-text--${variant}`}>{text}</p>;
    },
  },
  {
    type: 'Image',
    label: 'Image',
    kind: 'leaf',
    group: 'content',
    icon: ImageIcon,
    bindable: false,
    accepts: [],
    props: [
      {
        key: 'ratio',
        label: 'Ratio',
        control: 'buttongroup',
        options: [
          { value: 'wide', label: 'Wide' },
          { value: 'square', label: 'Square' },
          { value: 'portrait', label: 'Tall' },
        ],
      },
      { key: 'alt', label: 'Alt text', control: 'text', placeholder: 'Describe the image' },
    ],
    defaults: { props: { ratio: 'wide', alt: '' } },
    renderLeaf: ({ node }) => (
      <Placeholder
        ratio={(node.props.ratio as string) ?? 'wide'}
        label={firstString(node.props.alt)}
      />
    ),
  },
  {
    type: 'Button',
    label: 'Button',
    kind: 'leaf',
    group: 'content',
    icon: MousePointerClick,
    bindable: true,
    accepts: ['scalar'],
    props: [
      { key: 'label', label: 'Label', control: 'text', placeholder: 'Button label' },
      {
        key: 'href',
        label: 'Link URL',
        control: 'text',
        placeholder: '/products/model-3 or https://…',
      },
    ],
    // Archetype (docs/47): a fresh Button IS the Surface button — the recipe's
    // base + a default colour/treatment/size. The inspector's Style panel drives
    // `sf-c-*` / `sf-v-*` from here, retiring the old freeform `style` prop (legacy
    // trees that still carry `props.style` keep rendering via the canvas fallback).
    defaults: {
      props: { label: 'Button', href: '' },
      class: 'sf-btn sf-c-primary sf-v-solid sf-btn--sz-md',
    },
    renderLeaf: ({ node, value, bound }) => {
      // Editor preview: the canvas carries no Surface stylesheet, so show the
      // neutral primitive chrome (legacy `props.style` still previews its variant).
      const style = (node.props.style as string) ?? 'primary';
      const label = bound ? firstString(value, 'Button') : firstString(node.props.label, 'Button');
      return <span className={`bx-btn bx-btn--${style}`}>{label}</span>;
    },
  },
  {
    type: 'Divider',
    label: 'Divider',
    kind: 'leaf',
    group: 'content',
    icon: Minus,
    bindable: false,
    accepts: [],
    props: [],
    defaults: {},
    renderLeaf: () => <hr className="bx-divider" />,
  },
  {
    type: 'Video',
    label: 'Video',
    kind: 'leaf',
    group: 'content',
    icon: PlayCircle,
    bindable: false,
    accepts: [],
    props: [
      {
        key: 'url',
        label: 'YouTube URL or ID',
        control: 'text',
        placeholder: 'https://youtu.be/…',
      },
      {
        key: 'ratio',
        label: 'Ratio',
        control: 'buttongroup',
        options: [
          { value: 'wide', label: '16:9' },
          { value: 'square', label: '1:1' },
          { value: 'portrait', label: '9:16' },
        ],
      },
    ],
    defaults: { props: { url: '', ratio: 'wide' } },
    renderLeaf: ({ node }) => {
      const ratio = (node.props.ratio as string) ?? 'wide';
      const src = youtubeEmbed((node.props.url as string) ?? '');
      if (!src) return <Placeholder ratio={ratio} label="Add a YouTube URL" />;
      return (
        <div className={`bx-video bx-ratio-${ratio}`}>
          <iframe
            src={src}
            title={firstString(node.box.name, 'Video')}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    },
  },
  {
    type: 'Map',
    label: 'Map',
    kind: 'leaf',
    group: 'content',
    icon: MapPin,
    bindable: false,
    accepts: [],
    props: [
      {
        key: 'query',
        label: 'Place / search',
        control: 'text',
        placeholder: 'e.g. Tesla Supercharger',
      },
      {
        key: 'ratio',
        label: 'Ratio',
        control: 'buttongroup',
        options: [
          { value: 'wide', label: 'Wide' },
          { value: 'pano', label: 'Pano' },
          { value: 'square', label: 'Square' },
        ],
      },
    ],
    defaults: { props: { query: '', ratio: 'pano' } },
    renderLeaf: ({ node }) => {
      const ratio = (node.props.ratio as string) ?? 'pano';
      const src = mapEmbed(
        (node.props.query as string) ?? '',
        (node.props.embedUrl as string) ?? ''
      );
      if (!src)
        return <Placeholder ratio={ratio === 'pano' ? 'wide' : ratio} label="Add a place" />;
      return (
        <div className={`bx-map bx-ratio-${ratio}`}>
          <iframe
            src={src}
            title={firstString(node.box.name, 'Map')}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      );
    },
  },
  {
    type: 'Stat',
    label: 'Stat',
    kind: 'leaf',
    group: 'content',
    icon: Hash,
    bindable: true,
    accepts: ['scalar'],
    props: [
      { key: 'value', label: 'Value', control: 'text', placeholder: '37,412' },
      { key: 'label', label: 'Label', control: 'text', placeholder: 'Superchargers' },
    ],
    defaults: { props: { value: '0', label: 'Label' } },
    renderLeaf: ({ node, value, bound }) => {
      const big = bound ? firstString(value, '—') : firstString(node.props.value, '0');
      return (
        <div className="bx-stat">
          <span className="bx-stat__value">{big}</span>
          <span className="bx-stat__label">{firstString(node.props.label)}</span>
        </div>
      );
    },
  },

  // ---- Data-aware (Tier 2) ----
  {
    type: 'ImageDisplay',
    label: 'Image display',
    kind: 'leaf',
    group: 'data',
    icon: Images,
    bindable: true,
    accepts: ['object', 'array', 'empty'],
    surfaces: ['page'],
    props: [
      {
        key: 'ratio',
        label: 'Ratio',
        control: 'buttongroup',
        options: [
          { value: 'wide', label: 'Wide' },
          { value: 'square', label: 'Square' },
          { value: 'portrait', label: 'Tall' },
        ],
      },
    ],
    defaults: { props: { ratio: 'wide' } },
    renderLeaf: ({ node, value, cardinality }) => {
      const ratio = (node.props.ratio as string) ?? 'wide';
      if (cardinality === 'array') {
        const arr = (value as unknown[]) ?? [];
        return (
          <div className="bx-gallery">
            <Placeholder ratio={ratio} label="" />
            <span className="bx-gallery__count">{arr.length} images · gallery</span>
          </div>
        );
      }
      if (cardinality === 'empty') return <Placeholder ratio={ratio} label="No image" />;
      const img = asImage(value);
      return <Placeholder ratio={ratio} label={firstString(img?.alt)} />;
    },
  },
  {
    type: 'PriceTag',
    label: 'Price',
    kind: 'leaf',
    group: 'data',
    icon: DollarSign,
    module: 'commerce',
    bindable: true,
    accepts: ['scalar'],
    surfaces: ['page'],
    props: [],
    defaults: {},
    renderLeaf: ({ value, bound }) => {
      const n = typeof value === 'number' ? value : null;
      const text = bound && n != null ? `$${n.toFixed(2)}` : '$0.00';
      return <span className="bx-price">{text}</span>;
    },
  },
  {
    type: 'Signup',
    label: 'Email signup',
    kind: 'leaf',
    group: 'data',
    icon: Mail,
    module: 'crm',
    bindable: true,
    accepts: ['object'],
    surfaces: ['page'],
    props: [{ key: 'cta', label: 'Button', control: 'text', placeholder: 'Subscribe' }],
    defaults: { props: { cta: 'Subscribe' } },
    renderLeaf: ({ node }) => (
      <div className="bx-signup">
        <span className="bx-signup__field">you@example.com</span>
        <span className="bx-btn bx-btn--primary">{firstString(node.props.cta, 'Subscribe')}</span>
      </div>
    ),
  },

  // ---- Commerce buy-box (Tier 2 — interactive, docs/40 §7) ----
  // ProductForm establishes the shared form context (selected variant + qty);
  // the atoms inside it stay in sync. BuyBox is the cohesive convenience. These
  // are interactive ONLY on the storefront — the editor shows a static preview.
  {
    type: 'ProductForm',
    label: 'Product form',
    kind: 'container',
    group: 'data',
    icon: Package,
    module: 'commerce',
    bindable: true,
    accepts: ['object'],
    surfaces: ['page'],
    props: [],
    defaults: { box: { padding: 'none' }, layout: { direction: 'stack', gap: 'md' } },
    chromeClass: 'bx-productform',
  },
  {
    type: 'BuyBox',
    label: 'Buy box',
    kind: 'leaf',
    group: 'data',
    icon: ShoppingBag,
    module: 'commerce',
    bindable: true,
    accepts: ['object'],
    surfaces: ['page'],
    props: [],
    defaults: {},
    renderLeaf: () => (
      <div
        className="bx-buybox-preview"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      >
        <span className="bx-price">$0.00</span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <span className="bx-btn bx-btn--soft">Small</span>
          <span className="bx-btn bx-btn--soft">Large</span>
        </div>
        <span className="bx-btn bx-btn--primary">Add to cart</span>
      </div>
    ),
  },
  {
    type: 'VariantPicker',
    label: 'Variant picker',
    kind: 'leaf',
    group: 'data',
    icon: Palette,
    module: 'commerce',
    bindable: false,
    accepts: [],
    surfaces: ['page'],
    props: [],
    defaults: {},
    renderLeaf: () => (
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <span className="bx-btn bx-btn--soft">Small</span>
        <span className="bx-btn bx-btn--soft">Medium</span>
        <span className="bx-btn bx-btn--soft">Large</span>
      </div>
    ),
  },
  {
    type: 'Quantity',
    label: 'Quantity',
    kind: 'leaf',
    group: 'data',
    icon: Hash,
    module: 'commerce',
    bindable: false,
    accepts: [],
    surfaces: ['page'],
    props: [],
    defaults: {},
    renderLeaf: () => (
      <span style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'center' }}>− 1 +</span>
    ),
  },
  {
    type: 'AddToCart',
    label: 'Add to cart',
    kind: 'leaf',
    group: 'data',
    icon: ShoppingCart,
    module: 'commerce',
    bindable: false,
    accepts: [],
    surfaces: ['page'],
    props: [{ key: 'label', label: 'Label', control: 'text', placeholder: 'Add to cart' }],
    defaults: { props: { label: 'Add to cart' } },
    renderLeaf: ({ node }) => (
      <span className="bx-btn bx-btn--primary">{firstString(node.props.label, 'Add to cart')}</span>
    ),
  },

  // ---- Site chrome (Tier 2 — the layout shell, docs/45 §2.5) ----
  // These appear only in the site (layout) editor. The Outlet marks where the
  // routed page renders; NavMenu / Logo / SocialLinks bind to the `site` sources
  // and own their own presentation (a tenant never hand-wires a nav <a>).
  {
    type: 'Outlet',
    label: 'Page content',
    kind: 'leaf',
    group: 'layout',
    icon: SquareDashed,
    bindable: false,
    accepts: [],
    surfaces: ['site'],
    props: [],
    // Edge-to-edge: the routed page manages its own width (its sections do
    // contained/full themselves), so the outlet never constrains it.
    defaults: { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } },
    renderLeaf: () => (
      <div className="bx-outlet">
        <SquareDashed className="bx-outlet__icon" aria-hidden />
        <span className="bx-outlet__label">Page content renders here</span>
      </div>
    ),
  },
  {
    type: 'NavMenu',
    label: 'Navigation',
    kind: 'leaf',
    group: 'data',
    icon: Menu,
    module: 'site',
    bindable: true,
    accepts: ['array'],
    surfaces: ['site'],
    props: [
      {
        key: 'orientation',
        label: 'Orientation',
        control: 'buttongroup',
        options: [
          { value: 'row', label: 'Row' },
          { value: 'stack', label: 'Stack' },
        ],
      },
      {
        key: 'links',
        label: 'Links (one per line, “Label|/url”)',
        control: 'textarea',
        placeholder: 'Vehicles\nEnergy\nCharging',
      },
    ],
    defaults: { props: { orientation: 'row' } },
    renderLeaf: ({ node, value, cardinality }) => {
      const orientation = (node.props.orientation as string) ?? 'row';
      const items = cardinality === 'array' ? (value as unknown[]) : [];
      const typed = parseNavLinks((node.props.links as string) ?? '');
      const labels =
        items.length > 0
          ? items.map((it) => firstString((it as { label?: unknown }).label, 'Link'))
          : typed.length > 0
            ? typed.map((l) => l.label)
            : ['Home', 'Shop', 'About'];
      return (
        <nav className={`bx-nav bx-nav--${orientation}`}>
          {labels.map((label, i) => (
            <span key={`${i}-${label}`} className="bx-nav__item">
              {label}
            </span>
          ))}
        </nav>
      );
    },
  },
  {
    type: 'Logo',
    label: 'Logo',
    kind: 'leaf',
    group: 'data',
    icon: Fingerprint,
    module: 'site',
    bindable: true,
    accepts: ['object', 'empty'],
    surfaces: ['site'],
    props: [],
    defaults: {},
    renderLeaf: ({ value }) => {
      const identity = value && typeof value === 'object' ? (value as { name?: unknown }) : null;
      return <span className="bx-logo">{firstString(identity?.name, 'Your brand')}</span>;
    },
  },
  {
    type: 'SocialLinks',
    label: 'Social links',
    kind: 'leaf',
    group: 'data',
    icon: Share2,
    module: 'site',
    bindable: true,
    accepts: ['array'],
    surfaces: ['site'],
    props: [],
    defaults: {},
    renderLeaf: ({ value, cardinality }) => {
      const items = cardinality === 'array' ? (value as unknown[]) : [];
      const count = items.length > 0 ? items.length : 3;
      return (
        <div className="bx-social">
          {Array.from({ length: count }).map((_, i) => (
            <span key={`s${i}`} className="bx-social__dot" />
          ))}
        </div>
      );
    },
  },
];

const BY_TYPE = new Map(DEFS.map((d) => [d.type, d]));

export function getDef(type: string): ComponentDef | undefined {
  return BY_TYPE.get(type);
}

export function isContainer(type: string): boolean {
  return getDef(type)?.kind === 'container';
}

export const PALETTE: ComponentDef[] = DEFS;

/** The palette entries available in a given editor surface (docs/45 §2.5). A def
 *  with no `surfaces` belongs to both; otherwise it must list the surface. */
export function paletteForSurface(surface: EditorSurface): ComponentDef[] {
  return DEFS.filter((d) => !d.surfaces || d.surfaces.includes(surface));
}

/** Build a fresh node from a palette entry. */
export function makeNode(type: string): BuilderNode {
  const def = getDef(type);
  if (!def) throw new Error(`Unknown component type: ${type}`);
  const out: BuilderNode = {
    id: makeId(type),
    type,
    box: { ...DEFAULT_BOX, ...def.defaults.box },
    props: { ...def.defaults.props },
  };
  if (def.defaults.class) out.class = def.defaults.class;
  if (def.kind === 'container') out.layout = { ...DEFAULT_LAYOUT, ...def.defaults.layout };
  if (def.kind === 'container') out.children = [];
  return out;
}
