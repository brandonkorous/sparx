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
  Grid2x2,
  Hash,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MapPin,
  Menu,
  MessagesSquare,
  Minus,
  MousePointerClick,
  Package,
  Palette,
  PanelTop,
  Pilcrow,
  PlayCircle,
  Rows3,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Square,
  SquareDashed,
  Tag,
  Type,
  type LucideIcon,
} from 'lucide-react';
// The full lucide catalog, lazy-loaded by name (code-split) — so the Icon node can
// pick from ~1500 glyphs without bundling them all (docs/47). `iconNames` (the
// searchable list) lives with the picker; here we only need the renderer.
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

import { coerceNavLinks, readClassGroup, setClassGroup } from '@sparx/builder-schemas';
// The React-free JSON→HTML serializer (the audited CMS path). Lets the canvas
// preview an authored Prose doc as real HTML without pulling the TipTap editor
// into this widely-imported registry chunk (docs/52 §9).
import { renderDocToHtml } from '@sparx/cms-editor/serialize';

import {
  DEFAULT_BOX,
  DEFAULT_LAYOUT,
  makeId,
  type BoxBase,
  type BuilderNode,
  type Cardinality,
  type LayoutBase,
} from './model';
import { COLOR_CONTROL, VARIANT_CONTROL } from './class-controls';

export type NodeKind = 'container' | 'leaf';
export type ModuleKey = 'cms' | 'commerce' | 'crm' | 'events' | 'site';
export type PaletteGroup = 'layout' | 'content' | 'data';
/** Which editor surface a component belongs to. `page` = the content outlet
 *  (per-record content); `site` = the layout shell (chrome zones); `email` = the
 *  Email Builder body (docs/52). Most primitives belong to page+site; the Outlet
 *  + chrome components are site-only, and per-record data leaves are page-only.
 *  Email is OPT-IN — a curated, render-safe subset (see EMAIL_TYPES), never the
 *  page/site default — so interactive/chrome components can't land in an email. */
export type EditorSurface = 'page' | 'site' | 'email';

/** A cluster of related box-base controls in the inspector's Layout panel. A
 *  component declares which it exposes (`boxAxes`); the rest are hidden so the
 *  panel is relevant to the node instead of the same ~12 controls for everything
 *  (docs/47 box→data-only convergence). `background` = the photo-panel cluster
 *  (image URL + data binding + overlay + text tone — the image is DATA the box
 *  keeps; overlay/tone migrate to classes later). */
export type BoxAxis =
  | 'width'
  | 'height'
  | 'padding'
  | 'surface'
  | 'background'
  | 'align'
  | 'position'
  | 'visibility';

export interface PropSpec {
  key: string;
  label: string;
  control:
    | 'text'
    | 'textarea'
    | 'select'
    | 'buttongroup'
    | 'switch'
    | 'icon'
    | 'richtext'
    | 'navlinks';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

// The empty CMS/TipTap document — the default authored body for a Prose node.
// Inlined (not imported from @sparx/cms-editor) to keep the editor out of this
// chunk; the serializer renders it to '' and the inspector's rich-text control
// seeds the real ContentBlockEditor with it.
const EMPTY_PROSE_DOC = { type: 'doc', content: [] } as const;

export interface LeafRenderArgs {
  node: BuilderNode;
  /** Resolved binding value (undefined when the node is unbound). */
  value: unknown;
  cardinality: Cardinality;
  bound: boolean;
  /** Pre-rendered child nodes, for a leaf that `acceptsChildren` (Button → an
   *  inline Icon). Undefined for leaves with no children. The leaf decides where
   *  they sit relative to its own content (Button renders them after the label). */
  children?: React.ReactNode;
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
  /** The canonical class bundle describing which recipe AXES this element has —
   *  used only to BUILD the inspector's controls (e.g. the Size control appears
   *  iff this carries a `--sz-` token). Distinct from `defaults.class` (what a
   *  fresh node actually gets): an element can declare a size axis here yet ship a
   *  fresh node with NO size token, so the glyph inherits its context's size by
   *  default and the Size control reads "Default" until the author picks one. The
   *  Icon does exactly this so an in-button icon just fits the label. Omitted →
   *  falls back to `defaults.class`. */
  archetype?: string;
  /** Which box-base control clusters this component exposes in the Layout panel
   *  (docs/47). Omitted → defaults by kind (containers get the full set; leaves
   *  get align + visibility). A node that already has a non-default value for a
   *  hidden axis still shows it, so gating never strands authored values. */
  boxAxes?: BoxAxis[];
  /** A LEAF that can still nest children — a drop target without being a full
   *  container (no Arrangement panel / layout). Button uses this so an Icon can be
   *  dropped INSIDE it (icon + label); renderLeaf receives them as `children` and
   *  places them itself. Containers nest children inherently, so they leave this
   *  unset. */
  acceptsChildren?: boolean;
  /** Extra chrome class for containers (e.g. Card border). */
  chromeClass?: string;
  /** Leaf whose authored `node.class` styles the ELEMENT itself, not the box
   *  wrapper (docs/47 §7 — e.g. Button → the `<span>`/`<a>`). When set, the canvas
   *  renders `node.class` on the leaf (so the recipe paints it) and suppresses it
   *  on the `.bx-node` wrapper to avoid double-paint — parity with the site
   *  renderer's `leafStylesByClass`. */
  leafStylesByClass?: boolean;
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

// Authored-inline Q&A pairs for the FAQ component (the fallback when it isn't
// bound to a content list). Items are separated by a line of three-or-more
// dashes; within a block the FIRST non-empty line is the question and the rest
// (joined) is the answer. Mirrored in the storefront renderer.
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

// Authored-inline feature cards for the FeatureGrid component. One per line,
// `Title | Body` (auto-numbered 01, 02, …) or `Number | Title | Body` to set the
// ordinal explicitly. Mirrored in the storefront renderer.
export function parseFeatureItems(raw: string): { number: string; title: string; body: string }[] {
  return (raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split('|').map((p) => p.trim());
      const auto = String(i + 1).padStart(2, '0');
      if (parts.length >= 3) {
        return {
          number: firstString(parts[0], auto),
          title: parts[1] ?? '',
          body: parts.slice(2).join(' | '),
        };
      }
      if (parts.length === 2) return { number: auto, title: parts[0] ?? '', body: parts[1] ?? '' };
      return { number: auto, title: parts[0] ?? '', body: '' };
    })
    .filter((f) => f.title !== '');
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
    // Rich prose — free-form authored body copy (paragraphs, headings, lists,
    // quotes, links), OR bound to a CMS rich-text field (docs/47, docs/52 §9).
    //   · AUTHORED: the `doc` prop holds a TipTap/CMS document, edited inline via
    //     the inspector's rich-text control (ContentBlockEditor). The email
    //     renderer serializes it to sanitised, inline-safe HTML; the published
    //     site does the same via the `.sparx-content` prose rules. This is the one
    //     thing the retired authored-template editor did that the Builder couldn't.
    //   · BOUND: the BODY of a blog post / article — bind to a `richtext` scalar
    //     (e.g. "Blog post › Body"); richtext preview data is a plain string, so
    //     while editing the node reads as a representative paragraph.
    // The canvas previews the authored doc as real HTML (via the React-free
    // serializer) so the block reads WYSIWYG.
    type: 'Prose',
    label: 'Rich text',
    kind: 'leaf',
    group: 'content',
    icon: Pilcrow,
    bindable: true,
    accepts: ['scalar'],
    props: [{ key: 'doc', label: 'Content', control: 'richtext' }],
    defaults: { props: { doc: EMPTY_PROSE_DOC } },
    renderLeaf: ({ node, value, bound }) => {
      // Bound to a CMS richtext field → preview data is a representative string.
      if (bound && typeof value === 'string') {
        return (
          <div className="bx-prose">
            <p className="bx-text bx-text--body">{value}</p>
          </div>
        );
      }
      // Authored → serialize the doc to HTML and preview it (the same audited
      // path the email + site renderers use), styled by `.sparx-content`.
      const html = node.props.doc ? renderDocToHtml(node.props.doc) : '';
      if (html) {
        return (
          <div className="bx-prose sparx-content" dangerouslySetInnerHTML={{ __html: html }} />
        );
      }
      return (
        <div className="bx-prose">
          <p className="bx-text bx-text--body">
            Rich body content renders here — paragraphs, headings, lists, quotes, links.
          </p>
        </div>
      );
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
      // A static image URL — the email renderer's <Img src> (docs/52 §3). The page/
      // site canvas keeps showing the placeholder (it composes real images from the
      // box background / ImageDisplay binding); only email reads this prop today.
      { key: 'src', label: 'Image URL', control: 'text', placeholder: 'https://…/banner.png' },
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
    leafStylesByClass: true,
    // A Button can nest an Icon (icon + label) without becoming a full container
    // (docs/47). The dropped Icon renders inline AFTER the label via `children`.
    acceptsChildren: true,
    renderLeaf: ({ node, value, bound, children }) => {
      const label = bound ? firstString(value, 'Button') : firstString(node.props.label, 'Button');
      // Authored with the Surface recipe → render the REAL button so the
      // inspector's Color / Variant / size paint live against the canvas-scoped
      // @sparx/site-ui sheet (docs/47). Legacy buttons (no recipe class — e.g.
      // starter trees carrying `props.style`) keep the neutral primitive chrome.
      if (/(^|\s)sf-/.test(node.class ?? '')) {
        return (
          <span className={node.class}>
            {label}
            {children}
          </span>
        );
      }
      const style = (node.props.style as string) ?? 'primary';
      return (
        <span className={`bx-btn bx-btn--${style}`}>
          {label}
          {children}
        </span>
      );
    },
  },
  {
    // A compact status / count pill — the Surface Badge (docs/46 §3.6). Same
    // class-first recipe as Button (color × variant × size, written to `node.class`
    // from the Style panel), so a Button↔Badge retype carries its colour/variant
    // across. Like Button it can nest an Icon inline (icon + label).
    type: 'Badge',
    label: 'Badge',
    kind: 'leaf',
    group: 'content',
    icon: Tag,
    bindable: true,
    accepts: ['scalar'],
    props: [{ key: 'label', label: 'Label', control: 'text', placeholder: 'New' }],
    defaults: {
      props: { label: 'Badge' },
      class: 'sf-badge sf-c-neutral sf-v-soft sf-badge--sz-md',
    },
    leafStylesByClass: true,
    acceptsChildren: true,
    renderLeaf: ({ node, value, bound, children }) => {
      const label = bound ? firstString(value, 'Badge') : firstString(node.props.label, 'Badge');
      return (
        <span className={node.class ?? 'sf-badge sf-c-neutral sf-v-soft sf-badge--sz-md'}>
          {label}
          {children}
        </span>
      );
    },
  },
  {
    // A lucide glyph as a first-class node (docs/47). Stores a stable kebab-case
    // name; both renderers resolve it with the lazy DynamicIcon. Color comes from
    // the recipe (Advanced "Color"); the SIZE axis is declared on `archetype` (so
    // the Size control shows) but LEFT OFF the fresh node's `class` — a sizeless
    // `.sf-icon` inherits its context's font-size (1em), so an icon dropped into a
    // Button just matches the label instead of jumping to 28px. Picking a size
    // then grows it (and the button), which is the expected override. Bindable to a
    // scalar field (e.g. a CMS "Feature › Icon") so a collection can drive glyphs.
    type: 'Icon',
    label: 'Icon',
    kind: 'leaf',
    group: 'content',
    icon: Sparkles,
    bindable: true,
    accepts: ['scalar'],
    props: [{ key: 'name', label: 'Icon', control: 'icon' }],
    defaults: { props: { name: 'star' }, class: 'sf-icon' },
    archetype: 'sf-icon sf-icon--sz-md',
    leafStylesByClass: true,
    renderLeaf: ({ node, value, bound }) => {
      const name = (bound ? firstString(value) : '') || firstString(node.props.name, 'star');
      return (
        <span className={node.class ?? 'sf-icon'}>
          <DynamicIcon name={name as IconName} />
        </span>
      );
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
  {
    // A long-form marketing block — eyebrow, headline, body, optional CTA
    // (docs/51 §7). Authored inline here; a power user can also bind it to an
    // object with the same field names (e.g. a CMS record). Replaces the old
    // `editorial_section` content TYPE — it's page content, not a content item.
    type: 'EditorialSection',
    label: 'Editorial section',
    kind: 'leaf',
    group: 'content',
    icon: PanelTop,
    bindable: true,
    accepts: ['object', 'empty'],
    props: [
      { key: 'eyebrow', label: 'Eyebrow', control: 'text', placeholder: 'Short kicker' },
      {
        key: 'headline',
        label: 'Headline',
        control: 'text',
        placeholder: 'A headline that sells',
      },
      { key: 'body', label: 'Body', control: 'textarea', placeholder: 'Supporting copy…' },
      { key: 'ctaLabel', label: 'CTA label', control: 'text', placeholder: 'Learn more' },
      { key: 'ctaUrl', label: 'CTA URL', control: 'text', placeholder: '/contact or https://…' },
    ],
    defaults: {
      props: {
        eyebrow: '',
        headline: 'A headline that sells',
        body: 'One or two sentences that explain the value and earn the click.',
        ctaLabel: '',
        ctaUrl: '',
      },
    },
    renderLeaf: ({ node, value, bound }) => {
      const obj =
        bound && value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      const pick = (k: string, prop: string, dflt = '') =>
        firstString(obj?.[k], node.props[prop], dflt);
      const eyebrow = pick('eyebrow', 'eyebrow');
      const headline = pick('headline', 'headline', 'Headline');
      const body = pick('body', 'body');
      const ctaLabel = pick('ctaLabel', 'ctaLabel');
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            alignItems: 'inherit',
          }}
        >
          {eyebrow ? <span className="bx-text bx-text--eyebrow">{eyebrow}</span> : null}
          <span className="bx-h bx-h2">{headline}</span>
          {body ? <p className="bx-text bx-text--body">{body}</p> : null}
          {ctaLabel ? <span className="bx-btn bx-btn--primary">{ctaLabel}</span> : null}
        </div>
      );
    },
  },
  {
    // A list of question/answer pairs (docs/51 §7). Authored inline via a simple
    // block format, or bound to an array of `{question, answer}` records.
    // Replaces the old `faq_item` content type — FAQ entries are page content,
    // not standalone content items.
    type: 'FAQ',
    label: 'FAQ',
    kind: 'leaf',
    group: 'content',
    icon: MessagesSquare,
    bindable: true,
    accepts: ['array', 'empty'],
    props: [
      {
        key: 'items',
        label: 'Q&A — first line is the question, then the answer; “---” between items',
        control: 'textarea',
        placeholder:
          'Can I get a live site in five minutes?\nYes — that’s the design target.\n---\nWhat if I turn a module off?\nBilling stops; your data stays.',
      },
    ],
    defaults: {
      props: {
        items:
          'Can I get a live site in five minutes?\nYes — that’s the design target the whole platform is built around.\n---\nWhat happens if I turn a module off?\nBilling stops on the next cycle; your data stays exactly where it was.',
      },
    },
    renderLeaf: ({ node, value, cardinality }) => {
      const items =
        cardinality === 'array' && Array.isArray(value)
          ? (value as Record<string, unknown>[]).map((it) => ({
              question: firstString(it.question),
              answer: firstString(it.answer),
            }))
          : parseFaqItems(firstString(node.props.items));
      const list = items.filter((it) => it.question);
      const show = list.length
        ? list
        : [{ question: 'Your question here?', answer: 'And the answer here.' }];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          {show.map((it, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p className="bx-text" style={{ fontWeight: 600 }}>
                {it.question}
              </p>
              {it.answer ? <p className="bx-text bx-text--body">{it.answer}</p> : null}
            </div>
          ))}
        </div>
      );
    },
  },
  {
    // A responsive grid of numbered feature cards (docs/51 §7). Authored inline
    // (`Title | Body` per line), or bound to an array of `{number?, title, body}`
    // records. Replaces the old `feature` content type and `module.features`.
    type: 'FeatureGrid',
    label: 'Feature grid',
    kind: 'leaf',
    group: 'content',
    icon: Grid2x2,
    bindable: true,
    accepts: ['array', 'empty'],
    props: [
      {
        key: 'columns',
        label: 'Columns',
        control: 'buttongroup',
        options: [
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ],
      },
      {
        key: 'items',
        label: 'Features — one per line, “Title | Body”',
        control: 'textarea',
        placeholder:
          'Theme-first | Pick a polished theme, customize what matters, publish.\nBlock editor | Drag, drop, edit. Responsive and accessible by default.',
      },
    ],
    defaults: {
      props: {
        columns: '3',
        items:
          'Theme-first | Pick a polished theme, customize what matters, publish.\nBlock editor | Drag, drop, edit. Responsive and accessible by default.\nCustom domain + SSL | Point your DNS; we provision the certificate automatically.',
      },
    },
    renderLeaf: ({ node, value, cardinality }) => {
      const items =
        cardinality === 'array' && Array.isArray(value)
          ? (value as Record<string, unknown>[]).map((it, i) => ({
              number: firstString(it.number, String(i + 1).padStart(2, '0')),
              title: firstString(it.title),
              body: firstString(it.body),
            }))
          : parseFeatureItems(firstString(node.props.items));
      const list = items.filter((f) => f.title);
      const show = list.length
        ? list
        : [
            { number: '01', title: 'Feature one', body: 'What it does.' },
            { number: '02', title: 'Feature two', body: 'What it does.' },
            { number: '03', title: 'Feature three', body: 'What it does.' },
          ];
      const cols = Math.min(4, Math.max(2, Number(node.props.columns) || 3));
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: '1.25rem',
            width: '100%',
          }}
        >
          {show.map((f, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span className="bx-stat__value" style={{ fontSize: '20px', opacity: 0.5 }}>
                {f.number}
              </span>
              <span className="bx-text" style={{ fontWeight: 600 }}>
                {f.title}
              </span>
              {f.body ? <span className="bx-text bx-text--body">{f.body}</span> : null}
            </div>
          ))}
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
    // page (surfaces) + email (EMAIL_TYPES allowlist): a bound image — a product /
    // cart / post image resolved per item. The email renderer reads the bound value
    // as a URL (asImageUrl), docs/52 §7.
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
  // routed page renders; Logo / SocialLinks bind to the `site` sources. NavMenu
  // OWNS its links (docs/57) — navigation is Builder-owned site chrome, authored
  // here per site, never bound to a CMS menu.
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
    // No real page is framed in the layout editor, so render a ghosted SAMPLE
    // page (hero + feature grid, in the tenant brand) at a realistic height. It
    // anchors the header/footer chrome against representative content instead of a
    // thin empty slot. Purely decorative + aria-hidden — clicking still selects the
    // single Outlet node; on the live site the routed page mounts here.
    renderLeaf: () => (
      <div className="bx-outlet">
        <span className="bx-outlet__tag">
          <SquareDashed className="bx-outlet__tag-icon" aria-hidden />
          Page content renders here
        </span>
        <div className="bx-outlet__sample" aria-hidden>
          <div className="bx-outlet__hero">
            <span className="bx-outlet__bar bx-outlet__bar--eyebrow" />
            <span className="bx-outlet__bar bx-outlet__bar--title" />
            <span className="bx-outlet__bar bx-outlet__bar--title bx-outlet__bar--title-2" />
            <span className="bx-outlet__bar bx-outlet__bar--lede" />
            <span className="bx-outlet__cta" />
          </div>
          <div className="bx-outlet__section">
            <span className="bx-outlet__bar bx-outlet__bar--heading" />
            <div className="bx-outlet__grid">
              {['a', 'b', 'c'].map((k) => (
                <div key={k} className="bx-outlet__card">
                  <span className="bx-outlet__thumb" />
                  <span className="bx-outlet__bar bx-outlet__bar--card-title" />
                  <span className="bx-outlet__bar bx-outlet__bar--line" />
                  <span className="bx-outlet__bar bx-outlet__bar--line bx-outlet__bar--short" />
                </div>
              ))}
            </div>
          </div>
        </div>
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
    // Node-owned (docs/57): the links live in `props.links`, authored via the
    // navlinks control — not bound to a CMS menu. Existing CMS-bound nodes were
    // migrated to node-owned links (20260706_nav_into_builder), so there's no
    // storefront fallback anymore.
    bindable: false,
    accepts: [],
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
        label: 'Links',
        control: 'navlinks',
      },
    ],
    defaults: { props: { orientation: 'row' } },
    renderLeaf: ({ node, value }) => {
      const orientation = (node.props.orientation as string) ?? 'row';
      // Node-owned links win; a legacy CMS binding (value) is the fallback during
      // the transition (docs/57). Empty everywhere → the placeholder labels.
      const links = coerceNavLinks(node.props.links, value);
      const labels = links.length > 0 ? links.map((l) => l.label) : ['Home', 'Shop', 'About'];
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

// ── Box-axis relevance (docs/47 box→data-only convergence) ────────────────────
// The Layout panel used to show the same ~12 controls for every node. Now a
// component declares the axes it cares about (or defaults by kind), and the
// inspector hides the rest — UNLESS the node already carries a non-default value
// there, so relevance-gating never strands an authored value.

const CONTAINER_AXES: BoxAxis[] = [
  'width',
  'height',
  'padding',
  'surface',
  'background',
  'align',
  'position',
  'visibility',
];
// Leaves render content; spacing comes from the parent's gap and the Margin
// utility, color/shape from the recipe — so by default they expose only the two
// truly universal axes. A leaf that needs more (a full-bleed media panel) opts in
// via `boxAxes`.
const LEAF_AXES: BoxAxis[] = ['align', 'visibility'];

/** The box axes a component exposes by declaration, else by kind. */
export function boxAxesFor(def: ComponentDef): BoxAxis[] {
  return def.boxAxes ?? (def.kind === 'container' ? CONTAINER_AXES : LEAF_AXES);
}

/** Whether a node's box carries a non-default value on an axis — used so a hidden
 *  axis still surfaces when it's actually in use (no stranded values). */
export function boxAxisInUse(box: BoxBase, axis: BoxAxis): boolean {
  switch (axis) {
    case 'width':
      return box.backgroundWidth !== 'contained' || box.contentWidth !== 'contained';
    case 'height':
      return box.height !== 'auto';
    case 'padding':
      return box.padding !== 'none';
    case 'surface':
      return box.surface !== 'none';
    case 'background':
      return (
        Boolean(box.backgroundImage) ||
        Boolean(box.backgroundImageBinding) ||
        (box.overlay != null && box.overlay !== 'none') ||
        (box.textTone != null && box.textTone !== 'default')
      );
    case 'position':
      return Boolean(box.pin && box.pin !== 'none');
    case 'align':
    case 'visibility':
      return true; // always shown
  }
}

/** The box axes to render for a node: the component's declared set, plus any axis
 *  the node already uses (so gating is non-destructive). */
export function visibleBoxAxes(def: ComponentDef, box: BoxBase): Set<BoxAxis> {
  const out = new Set(boxAxesFor(def));
  for (const axis of CONTAINER_AXES) {
    if (boxAxisInUse(box, axis)) out.add(axis);
  }
  return out;
}

export function isContainer(type: string): boolean {
  return getDef(type)?.kind === 'container';
}

/** Can this type hold children — a container, OR a leaf that opts in via
 *  `acceptsChildren` (Button)? Used by the add-flow to pick a drop target. */
export function acceptsChildren(type: string): boolean {
  const def = getDef(type);
  return def?.kind === 'container' || def?.acceptsChildren === true;
}

export const PALETTE: ComponentDef[] = DEFS;

/** The render-safe subset an EMAIL can compose from (docs/52 §4). Email is fixed-
 *  width and non-interactive, so the palette is OPT-IN: only these types appear,
 *  never the page/site default. Excludes site chrome (Outlet/NavMenu/Logo/Social),
 *  interactive commerce (ProductForm + atoms), and effects with no email analogue
 *  (Carousel/Video/Map). The data-aware leaves the email renderer + data resolver
 *  support are included: `Image` (a static URL or a bound product/post image) and
 *  `ImageDisplay` (a bound image). `Prose` carries free-form authored rich text
 *  (paragraphs / headings / lists / links), serialized to inline-safe HTML on send
 *  — the authoring surface the retired authored-template editor used to own
 *  (docs/52 §9). */
const EMAIL_TYPES: ReadonlySet<string> = new Set([
  'Section',
  'Stack',
  'Grid',
  'Card',
  'Heading',
  'Text',
  'Prose',
  'Button',
  'Divider',
  'Image',
  'ImageDisplay',
]);

/** The palette entries available in a given editor surface (docs/45 §2.5, docs/52
 *  §4). For page/site, a def with no `surfaces` belongs to both; otherwise it must
 *  list the surface. Email is the exception — a curated allowlist (EMAIL_TYPES),
 *  never the omitted-surfaces default, so nothing leaks into an email by accident. */
export function paletteForSurface(surface: EditorSurface): ComponentDef[] {
  if (surface === 'email') return DEFS.filter((d) => EMAIL_TYPES.has(d.type));
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
  // Containers and children-accepting leaves (Button) start with an empty child
  // list so a drop has somewhere to land.
  if (def.kind === 'container' || def.acceptsChildren) out.children = [];
  return out;
}

// ── Retype (change a node's type — docs/47) ───────────────────────────────────
// Changing a card to a section, a button to a badge, etc. We restrict targets to
// the SAME kind (container↔container, leaf↔leaf) so a retype never silently
// orphans a subtree — a container keeps its children, a leaf keeps any nested
// children only when the target can still hold them (Button/Badge). The caller
// confirms the one case where children WOULD be dropped.

// Prop keys that all mean "the visible text/label" — migrated by VALUE on retype
// so a Heading's text becomes a Button's label, a Button's label becomes a Stat's
// value, etc.
const TEXT_PROP_KEYS = ['text', 'label', 'value'];

function carriedText(props: Record<string, unknown>): string | undefined {
  for (const k of TEXT_PROP_KEYS) {
    const v = props[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

function textPropKeyOf(def: ComponentDef): string | undefined {
  return def.props.find((p) => TEXT_PROP_KEYS.includes(p.key))?.key;
}

/** The types a node may be changed INTO on a surface: every other registry entry
 *  of the same kind that's valid here. Same-kind keeps the change non-destructive
 *  by construction (children semantics are preserved). */
export function compatibleRetypeTargets(def: ComponentDef, surface: EditorSurface): ComponentDef[] {
  return paletteForSurface(surface).filter((d) => d.type !== def.type && d.kind === def.kind);
}

/** Whether retyping `node` to `targetType` would drop its children (a leaf target
 *  that can't nest them). Drives the caller's destructive confirm. */
export function retypeDropsChildren(node: BuilderNode, targetType: string): boolean {
  const to = getDef(targetType);
  if (!to) return false;
  return (node.children?.length ?? 0) > 0 && to.kind === 'leaf' && !acceptsChildren(targetType);
}

/** Return `node` re-typed to `targetType`, carrying across everything that still
 *  makes sense: identity (id), the universal box (incl. its name), the binding (if
 *  the target is bindable), the recipe color × variant (if the target rides the
 *  recipe), and the visible text/label. Props otherwise reset to the target's
 *  defaults; layout resets to the target's natural arrangement; children are kept
 *  when the target can hold them, else dropped. A no-op for an unknown target. */
export function retypeNode(node: BuilderNode, targetType: string): BuilderNode {
  const to = getDef(targetType);
  if (!to || targetType === node.type) return node;

  const next: BuilderNode = {
    id: node.id, // identity preserved — selection + any saved refs stay valid
    type: targetType,
    box: { ...node.box }, // the universal box (and its name) carries over verbatim
    props: { ...to.defaults.props },
  };

  // Best-effort text carry (Heading text → Button label → Stat value, …).
  const text = carriedText(node.props);
  const textKey = text !== undefined ? textPropKeyOf(to) : undefined;
  if (textKey) next.props[textKey] = text;

  // Binding survives only into a bindable target.
  if (node.binding && to.bindable) next.binding = { ...node.binding };

  // Class: start from the target's archetype/defaults, then preserve the author's
  // recipe color × variant where the target also exposes that axis (so a primary
  // soft Button stays primary soft as a Badge).
  let cls = to.defaults.class;
  if (cls) {
    for (const control of [COLOR_CONTROL, VARIANT_CONTROL]) {
      const tokens = control.options.map((o) => o.token);
      const prev = readClassGroup(node.class, tokens);
      if (prev && readClassGroup(cls, tokens)) cls = setClassGroup(cls, tokens, prev);
    }
    next.class = cls;
  }

  // Layout + children by kind. A container adopts the target's natural arrangement
  // and keeps its children; a leaf keeps children only if it can nest them.
  if (to.kind === 'container') {
    next.layout = { ...DEFAULT_LAYOUT, ...to.defaults.layout };
    next.children = node.children ?? [];
  } else if (acceptsChildren(targetType)) {
    next.children = node.children ?? [];
  }
  return next;
}
