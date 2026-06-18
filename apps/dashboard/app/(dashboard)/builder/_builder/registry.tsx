// The component registry — the catalog the builder composes from (METADATA ONLY).
//
// Tier-1 primitives (Section/Grid/Stack/Heading/Text/Image/Button) and Tier-2
// data-aware components (ImageDisplay/PriceTag/Signup) live in ONE registry and
// ONE palette. Each entry declares:
//   · kind        — container (arranges children) or leaf (renders content)
//   · bindable    — can it bind to data, and which cardinalities it handles
//   · box axes    — which parts of the universal box base are meaningful
//   · props       — its own config (drives the inspector's component panel)
//
// What this file NO LONGER owns: the per-type RENDER. Leaf markup lived here as a
// second `renderLeaf` map that mirrored the live storefront renderer and drifted
// from it (mocks for the commerce atoms, an inert <span> for Button). Both render
// paths are now the ONE shared map in `@sparx/builder-render` (docs/builder/02),
// which the live site and the editor canvas both call. This registry keeps only
// the metadata — the palette grouping, binding cardinalities, defaults, props, and
// the tree ops (makeNode/retypeNode) — that the editor needs to compose and edit.

import {
  Building2,
  DollarSign,
  Fingerprint,
  GalleryHorizontal,
  Grid2x2,
  Hash,
  Heading as HeadingIcon,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Link,
  List,
  ListCollapse,
  Mail,
  MailX,
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
  Quote,
  Rows3,
  Shapes,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Split,
  Square,
  SquareDashed,
  Stamp,
  SunMoon,
  Table,
  Tag,
  TextCursorInput,
  Type,
  type LucideIcon,
} from 'lucide-react';

import {
  GLOBAL_ATTRS,
  RAW_ELEMENTS,
  isRawElementType,
  rawElementType,
  rawTagOf,
  readClassGroup,
  setClassGroup,
  type AttrKey,
  type RawElementGroup,
} from '@sparx/builder-schemas';

import {
  boxLayoutClass,
  makeId,
  type BoxStyle,
  type BuilderNode,
  type Cardinality,
  type LayoutStyle,
} from './model';
import { COLOR_CONTROL, VARIANT_CONTROL } from './class-controls';
import { SITE_UI_ATOM_DEFS } from './registry-atoms';

export type NodeKind = 'container' | 'leaf';
/** Composition axis (docs/23 §17) — orthogonal to `kind`/`group`/bindable.
 *  `basic` = self-contained, composes no other named component (Button, Heading,
 *  NavMenu). `composite` = assembles two or more other components into a
 *  higher-order pattern (EditorialSection = Heading+Text+Button; BuyBox =
 *  PriceTag+VariantPicker+Quantity+AddToCart). Surfaced in the palette + read by
 *  agents; composites are also where canvas↔live render drift concentrates. */
export type Composition = 'basic' | 'composite';
export type ModuleKey = 'cms' | 'commerce' | 'crm' | 'events' | 'site';
export type PaletteGroup = 'layout' | 'content' | 'data' | 'elements';
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
  /** A `buttongroup` option may carry an icon (e.g. the H1/H2/H3 heading-level
   *  glyphs) — the Segmented control shows it alongside the label. */
  options?: { value: string; label: string; icon?: LucideIcon }[];
  placeholder?: string;
}

// The empty CMS/TipTap document — the default authored body for a Prose node.
// Inlined (not imported from @sparx/cms-editor) to keep the editor out of this
// chunk; the serializer renders it to '' and the inspector's rich-text control
// seeds the real ContentBlockEditor with it.
const EMPTY_PROSE_DOC = { type: 'doc', content: [] } as const;

export interface ComponentDef {
  type: string;
  label: string;
  kind: NodeKind;
  group: PaletteGroup;
  /** Basic vs composite (docs/23 §17). Populated for every def from the
   *  COMPOSITE_TYPES taxonomy below — read it via `getDef`, never hand-set on a
   *  def literal (the source of truth is the one list). */
  composition?: Composition;
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
  /** Defaults applied when the component is dropped from the palette. The
   *  ergonomic box/layout vocabulary (docs/61) is compiled to the fresh node's
   *  `class` by makeNode — it never reaches the persisted node as an object. */
  defaults: {
    box?: BoxStyle;
    layout?: LayoutStyle;
    props?: Record<string, unknown>;
    /** Archetype seed (docs/47 §11): the brand-governed class bundle a freshly
     *  dropped node carries (e.g. a Button → `st-btn st-c-primary st-v-solid
     *  st-btn--sz-md`). The inspector's Style controls then read / write its
     *  `st-c-*` / `st-v-*` groups; the published site renders the real Surface
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
   *  dropped INSIDE it (icon + label); the renderer receives them as `children` and
   *  places them itself. Containers nest children inherently, so they leave this
   *  unset. */
  acceptsChildren?: boolean;
  /** Extra chrome class for containers (e.g. Card border). */
  chromeClass?: string;
  /** A PINNED node — present by construction, not added/removed/moved by the author
   *  (e.g. the email_wordmark header, docs/52 §1). The Layers panel hides its remove
   *  control and won't drag it; the editor's onRemove no-ops it; projectDrop keeps
   *  siblings from landing above it. Still selectable + editable (its props). */
  pinned?: boolean;
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
        // `level` sets the semantic tag (h1/h2/h3) — what kind of header this is,
        // not a font size. The H1/H2/H3 glyphs make that explicit; the words say
        // what each is for. Drives SEO + the document outline + the default scale.
        key: 'level',
        label: 'Header',
        control: 'buttongroup',
        options: [
          { value: 'h1', label: 'Title', icon: Heading1 },
          { value: 'h2', label: 'Heading', icon: Heading2 },
          { value: 'h3', label: 'Sub', icon: Heading3 },
        ],
      },
      { key: 'text', label: 'Heading text', control: 'text', placeholder: 'Your heading here' },
    ],
    defaults: { props: { level: 'h2', text: 'Heading' } },
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
    type: 'Prose',
    label: 'Rich text',
    kind: 'leaf',
    group: 'content',
    icon: Pilcrow,
    bindable: true,
    accepts: ['scalar'],
    props: [{ key: 'doc', label: 'Content', control: 'richtext' }],
    defaults: { props: { doc: EMPTY_PROSE_DOC } },
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
      { key: 'src', label: 'Image', control: 'text', placeholder: 'https://…/banner.png' },
      {
        key: 'alt',
        label: 'Describe the image',
        control: 'text',
        placeholder: 'Helps search engines and screen readers',
      },
    ],
    defaults: { props: { ratio: 'wide', alt: '' } },
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
      { key: 'label', label: 'Button text', control: 'text', placeholder: 'Button label' },
      {
        key: 'href',
        label: 'Goes to',
        control: 'text',
        placeholder: '/products/model-3 or https://…',
      },
    ],
    // Archetype (docs/47): a fresh Button IS the Surface button — the recipe's
    // base + a default colour/treatment/size. The inspector's Style panel drives
    // `st-c-*` / `st-v-*` from here, retiring the old freeform `style` prop (legacy
    // trees that still carry `props.style` keep rendering via the legacy fallback).
    defaults: {
      props: { label: 'Button', href: '' },
      class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
    },
    // A Button can nest an Icon (icon + label) without becoming a full container
    // (docs/47). The dropped Icon renders inline AFTER the label via `children`.
    acceptsChildren: true,
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
      class: 'st-badge st-c-neutral st-v-soft st-badge--sz-md',
    },
    acceptsChildren: true,
  },
  {
    // A lucide glyph as a first-class node (docs/47). Stores a stable kebab-case
    // name; both renderers resolve it with the lazy DynamicIcon. Color comes from
    // the recipe (Advanced "Color"); the SIZE axis is declared on `archetype` (so
    // the Size control shows) but LEFT OFF the fresh node's `class` — a sizeless
    // `.st-icon` inherits its context's font-size (1em), so an icon dropped into a
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
    defaults: { props: { name: 'star' }, class: 'st-icon' },
    archetype: 'st-icon st-icon--sz-md',
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
        label: 'YouTube link',
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
        label: 'Place or address',
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
      { key: 'ctaLabel', label: 'Button text', control: 'text', placeholder: 'Learn more' },
      {
        key: 'ctaUrl',
        label: 'Button link',
        control: 'text',
        placeholder: '/contact or https://…',
      },
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
    // The single structural invariant of a layout (docs/98 §3.7): the content box
    // where each routed page renders. `pinned` makes it un-deletable + un-draggable
    // (its layers Remove affordance hidden), so a layout always has exactly one
    // Outlet — everything else (header/footer/sidebars) is freely author-composed.
    pinned: true,
    accepts: [],
    surfaces: ['site'],
    props: [],
    // Edge-to-edge: the routed page manages its own width (its sections do
    // contained/full themselves), so the outlet never constrains it.
    defaults: { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } },
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
  },
  {
    type: 'Wordmark',
    label: 'Wordmark',
    kind: 'leaf',
    group: 'data',
    icon: Fingerprint,
    module: 'site',
    bindable: true,
    accepts: ['object', 'empty'],
    surfaces: ['site'],
    // The brand LOCKUP (docs/62): the logo mark + the company name as one unit,
    // vs the bare Logo (mark-OR-name). `collapse` picks what survives a narrow
    // frame — mark-only is the common header pattern.
    props: [
      {
        key: 'collapse',
        label: 'On mobile',
        control: 'buttongroup',
        options: [
          { value: 'mark', label: 'Mark' },
          { value: 'name', label: 'Name' },
          { value: 'none', label: 'Both' },
        ],
      },
    ],
    defaults: { props: { collapse: 'mark' } },
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
  },
  {
    type: 'ThemeToggle',
    label: 'Theme toggle',
    kind: 'leaf',
    group: 'data',
    icon: SunMoon,
    module: 'site',
    bindable: false,
    accepts: [],
    surfaces: ['site'],
    props: [],
    defaults: {},
  },

  // ---- Email automation nodes (docs/93) ----
  // DEFINED + gate-checked by the automation module; PLACED in the default email
  // trees (order/cart/invoice + marketing compliance footers). They render only on
  // the email surface and aren't in the palette (EMAIL_TYPES) — authors don't add
  // them, but they must PREVIEW faithfully so a transactional email isn't blank
  // where its items table / unsubscribe line belongs. `surfaces: ['email']` keeps
  // them out of the page/site palettes; absence from EMAIL_TYPES keeps them out of
  // the email palette too, while `getDef` still resolves them for rendering.
  {
    // The editable email HEADER (docs/52 §1) — the brand wordmark that used to be
    // fixed renderer chrome (EmailLayout). PINNED: seeded as the first node of every
    // email, selectable + editable (treatment / align / size) but never added,
    // removed, or moved by the author; absent from EMAIL_TYPES, so there's exactly
    // one. Its CONTENT (logo + store name) resolves from the brand at render
    // (`emailBrand`) — so it tracks the tenant brand + per-site override — while the
    // node persists only the TREATMENT. The legal footer stays fixed renderer chrome.
    type: 'email_wordmark',
    label: 'Header',
    kind: 'leaf',
    group: 'content',
    // A brand-mark glyph (a LEAF), not the container-looking PanelTop: in the Layers
    // tree the header is a SIBLING of the body content (the rendered email has them
    // flat inside one container), so its icon must not imply it wraps them.
    icon: Stamp,
    bindable: false,
    accepts: [],
    surfaces: ['email'],
    pinned: true,
    props: [
      {
        key: 'treatment',
        label: 'Show',
        control: 'buttongroup',
        options: [
          { value: 'lockup', label: 'Logo + name' },
          { value: 'logo', label: 'Logo' },
          { value: 'name', label: 'Name' },
        ],
      },
      {
        key: 'align',
        label: 'Alignment',
        control: 'buttongroup',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        control: 'select',
        options: [
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' },
        ],
      },
    ],
    defaults: { props: { treatment: 'lockup', align: 'left', size: 'md' } },
  },
  {
    type: 'line_item_table',
    label: 'Line items',
    kind: 'leaf',
    group: 'data',
    icon: Table,
    bindable: true,
    accepts: ['array', 'empty'],
    surfaces: ['email'],
    props: [],
    defaults: {},
  },
  {
    // A block shown only when its `when` path is truthy at send (an optional credit
    // line, a quote expiry, dunning consequences). A container so its children edit
    // + render inline; the canvas always shows them (the gate applies at dispatch),
    // with a dashed rail marking it as conditional.
    type: 'conditional_block',
    label: 'Conditional',
    kind: 'container',
    group: 'layout',
    icon: Split,
    bindable: false,
    accepts: ['empty'],
    surfaces: ['email'],
    props: [],
    defaults: { layout: { direction: 'stack', gap: 'md' } },
    chromeClass: 'bx-conditional',
  },
  {
    type: 'unsubscribe_link',
    label: 'Unsubscribe',
    kind: 'leaf',
    group: 'data',
    icon: MailX,
    bindable: false,
    accepts: [],
    surfaces: ['email'],
    props: [],
    defaults: {},
  },
  {
    type: 'physical_address',
    label: 'Mailing address',
    kind: 'leaf',
    group: 'data',
    icon: Building2,
    bindable: false,
    accepts: [],
    surfaces: ['email'],
    props: [],
    defaults: {},
  },

  // ---- Site-UI library atoms (docs/102 Track A) ----
  // The rest of @sparx/site-ui exposed as droppable atoms (form controls, feedback,
  // data display, navigation, …). Metadata-only here; rendered by the shared
  // renderSiteUiAtom map. Kept in registry-atoms.ts so this file stays focused.
  ...SITE_UI_ATOM_DEFS,
];

// ── Composition taxonomy (docs/23 §17) ───────────────────────────────────────
// The single source of truth for the basic/composite axis: a component is
// `composite` iff it appears here, else `basic`. Kept as one readable list (not
// scattered across 31 def literals) so the whole classification is legible at a
// glance — to people and agents. A composite assembles two or more other
// components into a higher-order pattern; these are also the canvas↔live render
// drift hotspots (docs/62), so the list doubles as an audit target.
const COMPOSITE_TYPES = new Set<string>([
  'Carousel', // slides + arrows/dots/autoplay controls
  'EditorialSection', // Heading + Text + Button
  'FAQ', // repeated question/answer pairs
  'FeatureGrid', // grid of feature cells (icon + heading + text)
  'Signup', // Input + Button form
  'ProductForm', // provider wrapping the buy-box assembly
  'BuyBox', // PriceTag + VariantPicker + Quantity + AddToCart
]);
for (const d of DEFS) {
  d.composition = COMPOSITE_TYPES.has(d.type) ? 'composite' : 'basic';
}

const BY_TYPE = new Map(DEFS.map((d) => [d.type, d]));

// ── Raw HTML elements (docs/98 Pillar 1) ──────────────────────────────────────
// A raw element's ComponentDef is SYNTHESIZED from its tag metadata in
// @sparx/builder-schemas (the React-free allow-list), so the editor's metadata
// plumbing — palette, inspector, retype, drop targets, makeNode — works for every
// whitelisted tag with no per-tag boilerplate. The tag is encoded in `node.type`
// (`el:div`), which all the type-string helpers below resolve.

const RAW_GROUP_ICON: Record<RawElementGroup, LucideIcon> = {
  structure: Square,
  text: Type,
  list: List,
  media: ImageIcon,
  table: Table,
  form: TextCursorInput,
  interactive: ListCollapse,
};

const RAW_TAG_ICON: Partial<Record<string, LucideIcon>> = {
  section: LayoutTemplate,
  nav: Menu,
  header: PanelTop,
  a: Link,
  p: Pilcrow,
  h1: HeadingIcon,
  h2: HeadingIcon,
  h3: HeadingIcon,
  blockquote: Quote,
  ul: List,
  li: Minus,
  img: ImageIcon,
  svg: Shapes,
  tr: Rows3,
  button: MousePointerClick,
  input: TextCursorInput,
  label: Tag,
  details: ListCollapse,
  summary: ListCollapse,
};

function attrSwitchLabel(key: AttrKey): string {
  const map: Partial<Record<AttrKey, string>> = {
    controls: 'Show controls',
    autoplay: 'Autoplay',
    loop: 'Loop',
    muted: 'Muted',
    disabled: 'Disabled',
    required: 'Required',
    checked: 'Checked',
    open: 'Open by default',
  };
  return map[key] ?? key;
}

// AttrKey → its inspector PropSpec. Text content is the separate `text` prop;
// identity attrs (id/title/role) aren't surfaced as primary props.
function attrPropSpec(key: AttrKey): PropSpec | null {
  switch (key) {
    case 'ariaLabel':
      return { key, label: 'Accessible label', control: 'text' };
    case 'href':
      return { key, label: 'Link URL', control: 'text', placeholder: '/page or https://…' };
    case 'target':
      return {
        key,
        label: 'Opens in',
        control: 'buttongroup',
        options: [
          { value: '', label: 'Same tab' },
          { value: '_blank', label: 'New tab' },
        ],
      };
    case 'src':
      return { key, label: 'Source URL', control: 'text', placeholder: 'https://…' };
    case 'srcset':
      return { key, label: 'Source set', control: 'text' };
    case 'alt':
      return { key, label: 'Alt text', control: 'text', placeholder: 'Describe the image' };
    case 'poster':
      return { key, label: 'Poster URL', control: 'text' };
    case 'type':
      return { key, label: 'Type', control: 'text', placeholder: 'text, email, search…' };
    case 'name':
      return { key, label: 'Field name', control: 'text' };
    case 'value':
      return { key, label: 'Value', control: 'text' };
    case 'placeholder':
      return { key, label: 'Placeholder', control: 'text' };
    case 'for':
      return { key, label: 'For (field id)', control: 'text' };
    case 'width':
      return { key, label: 'Width', control: 'text' };
    case 'height':
      return { key, label: 'Height', control: 'text' };
    case 'loading':
      return {
        key,
        label: 'Loading',
        control: 'buttongroup',
        options: [
          { value: 'lazy', label: 'Lazy' },
          { value: 'eager', label: 'Eager' },
        ],
      };
    case 'scope':
      return {
        key,
        label: 'Scope',
        control: 'buttongroup',
        options: [
          { value: 'col', label: 'Column' },
          { value: 'row', label: 'Row' },
        ],
      };
    case 'colspan':
      return { key, label: 'Column span', control: 'text' };
    case 'rowspan':
      return { key, label: 'Row span', control: 'text' };
    case 'datetime':
      return { key, label: 'Date/time', control: 'text' };
    case 'controls':
    case 'autoplay':
    case 'loop':
    case 'muted':
    case 'disabled':
    case 'required':
    case 'checked':
    case 'open':
      return { key, label: attrSwitchLabel(key), control: 'switch' };
    default:
      // SVG geometry/paint + the rest — plain text fields (advanced).
      return { key, label: key, control: 'text' };
  }
}

const TEXTAREA_TAGS = new Set(['p', 'blockquote', 'pre', 'code', 'td', 'th', 'caption', 'li']);

function rawElementDef(type: string): ComponentDef {
  const tag = rawTagOf(type)!;
  const meta = RAW_ELEMENTS.get(tag)!;
  const props: PropSpec[] = [];
  if (meta.text) {
    props.push({
      key: 'text',
      label: 'Text',
      control: TEXTAREA_TAGS.has(tag) ? 'textarea' : 'text',
      placeholder: 'Type text…',
    });
  }
  for (const key of meta.attrs ?? []) {
    if (GLOBAL_ATTRS.includes(key)) continue;
    const spec = attrPropSpec(key);
    if (spec) props.push(spec);
  }
  const accepts: Cardinality[] = meta.void
    ? []
    : meta.kind === 'container'
      ? ['array', 'object', 'empty']
      : ['scalar'];
  const def: ComponentDef = {
    type,
    label: meta.label,
    kind: meta.kind,
    group: 'elements',
    icon: RAW_TAG_ICON[tag] ?? RAW_GROUP_ICON[meta.group],
    bindable: !meta.void,
    accepts,
    props,
    defaults: { props: meta.text ? { text: '' } : {} },
  };
  if (meta.acceptsChildren && meta.kind === 'leaf') def.acceptsChildren = true;
  return def;
}

const rawDefCache = new Map<string, ComponentDef>();

function getRawDef(type: string): ComponentDef {
  let d = rawDefCache.get(type);
  if (!d) {
    d = rawElementDef(type);
    rawDefCache.set(type, d);
  }
  return d;
}

/** The featured raw-element tiles for the Add palette (the common set; every other
 *  whitelisted tag is reachable via the inspector's same-kind tag picker). */
const RAW_ELEMENT_DEFS: ComponentDef[] = Array.from(RAW_ELEMENTS.entries())
  .filter(([, meta]) => meta.featured)
  .map(([tag]) => getRawDef(rawElementType(tag)));

export function getDef(type: string): ComponentDef | undefined {
  const hit = BY_TYPE.get(type);
  if (hit) return hit;
  return isRawElementType(type) ? getRawDef(type) : undefined;
}

/** The composition class of a node type (docs/23 §17) — `basic` for unknown
 *  types. Lets callers (palette, agents, audits) classify without a full def. */
export function compositionOf(type: string): Composition {
  return COMPOSITE_TYPES.has(type) ? 'composite' : 'basic';
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

/** The box axes a component exposes by declaration, else by kind. Informational
 *  for the component editor (docs/53); the page inspector authors these as `class`
 *  utilities now (docs/61), so there's no longer a per-node box panel to gate. */
export function boxAxesFor(def: ComponentDef): BoxAxis[] {
  return def.boxAxes ?? (def.kind === 'container' ? CONTAINER_AXES : LEAF_AXES);
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

/** Map a palette group to a tenant-component group (docs/53). A saved component is
 *  a higher-level unit, never the raw-`elements` category — a raw container maps to
 *  `layout`, a raw leaf to `content`. */
export function componentGroupOf(def: ComponentDef): 'layout' | 'content' | 'data' {
  if (def.group !== 'elements') return def.group;
  return def.kind === 'container' ? 'layout' : 'content';
}

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
  // Email is its own medium (docs/98 §3.6c) — curated allow-list, no raw HTML.
  if (surface === 'email') return DEFS.filter((d) => EMAIL_TYPES.has(d.type));
  const named = DEFS.filter((d) => !d.surfaces || d.surfaces.includes(surface));
  // Raw HTML elements (docs/98 Pillar 1) join the page + site palettes.
  return [...named, ...RAW_ELEMENT_DEFS];
}

/** Build a fresh node from a palette entry. The entry's ergonomic box/layout
 *  defaults compile to the node's `class` string (docs/61), joined after the
 *  archetype/recipe seed (`defaults.class`, e.g. a Button's `st-btn …`). */
export function makeNode(type: string): BuilderNode {
  const def = getDef(type);
  if (!def) throw new Error(`Unknown component type: ${type}`);
  // Raw elements (docs/98) start unstyled — the inspector authors their class, with
  // no box/layout seed. Named components compile their ergonomic box/layout defaults.
  const cls = isRawElementType(type)
    ? (def.defaults.class ?? '')
    : [boxLayoutClass(def.defaults.box, def.defaults.layout, type), def.defaults.class]
        .filter(Boolean)
        .join(' ')
        .trim();
  const out: BuilderNode = {
    id: makeId(type),
    type,
    props: { ...def.defaults.props },
  };
  if (cls) out.class = cls;
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

/** The node's primary text/content prop key (`text` / `label` / `value`) — the one
 *  a data binding replaces. Used by the retype carry AND by the Content panel to
 *  move that field under the "Type it in" source branch. */
export function textPropKeyOf(def: ComponentDef): string | undefined {
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
    props: { ...to.defaults.props },
  };
  if (node.name) next.name = node.name; // the author label carries over

  // Best-effort text carry (Heading text → Button label → Stat value, …).
  const text = carriedText(node.props);
  const textKey = text !== undefined ? textPropKeyOf(to) : undefined;
  if (textKey) next.props[textKey] = text;

  // Binding survives only into a bindable target.
  if (node.binding && to.bindable) next.binding = { ...node.binding };

  // Class (docs/61): a RECIPE target (Button/Badge — ships an archetype) starts
  // from its own archetype and preserves the author's color × variant (so a
  // primary-soft Button stays primary-soft as a Badge). A STRUCTURAL target
  // (Section/Card/Stack/Grid — no recipe) carries the source's class verbatim, so
  // its arrangement + skin survive the retype (the old "box carries over" behavior).
  if (to.defaults.class) {
    let cls = to.defaults.class;
    for (const control of [COLOR_CONTROL, VARIANT_CONTROL]) {
      const tokens = control.options.map((o) => o.token);
      const prev = readClassGroup(node.class, tokens);
      if (prev && readClassGroup(cls, tokens)) cls = setClassGroup(cls, tokens, prev);
    }
    next.class = cls;
  } else if (node.class) {
    next.class = node.class;
  }

  // Children by kind: a container keeps its children; a leaf keeps them only if it
  // can still nest them.
  if (to.kind === 'container' || acceptsChildren(targetType)) {
    next.children = node.children ?? [];
  }
  return next;
}
