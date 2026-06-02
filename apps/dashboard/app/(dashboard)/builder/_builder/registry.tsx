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
  Heading as HeadingIcon,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Menu,
  Minus,
  MousePointerClick,
  Rows3,
  Share2,
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
  /** Height is only meaningful for big blocks; a button never offers a 25vh
   *  height. Defaults to false. */
  showHeight: boolean;
  /** Editor surfaces this component appears in (docs/45 §2.5). Omitted = both
   *  the page editor and the site (layout) editor. */
  surfaces?: EditorSurface[];
  props: PropSpec[];
  /** Defaults applied when the component is dropped from the palette. */
  defaults: {
    box?: Partial<BoxBase>;
    layout?: Partial<LayoutBase>;
    props?: Record<string, unknown>;
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
    showHeight: true,
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
    showHeight: false,
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
    showHeight: false,
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
    showHeight: false,
    props: [],
    defaults: {
      box: { surface: 'subtle', padding: 'none' },
      layout: { direction: 'stack', gap: 'sm' },
    },
    chromeClass: 'bx-card',
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
    showHeight: false,
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
    showHeight: false,
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
    showHeight: false,
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
    showHeight: false,
    props: [
      { key: 'label', label: 'Label', control: 'text', placeholder: 'Button label' },
      {
        key: 'style',
        label: 'Style',
        control: 'buttongroup',
        options: [
          { value: 'primary', label: 'Primary' },
          { value: 'soft', label: 'Soft' },
          { value: 'link', label: 'Link' },
        ],
      },
    ],
    defaults: { props: { label: 'Button', style: 'primary' } },
    renderLeaf: ({ node, value, bound }) => {
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
    showHeight: false,
    props: [],
    defaults: {},
    renderLeaf: () => <hr className="bx-divider" />,
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
    showHeight: false,
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
    showHeight: false,
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
    showHeight: false,
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
    showHeight: false,
    surfaces: ['site'],
    props: [],
    defaults: { box: { padding: 'none' } },
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
    showHeight: false,
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
    ],
    defaults: { props: { orientation: 'row' } },
    renderLeaf: ({ node, value, cardinality }) => {
      const orientation = (node.props.orientation as string) ?? 'row';
      const items = cardinality === 'array' ? (value as unknown[]) : [];
      const labels =
        items.length > 0
          ? items.map((it) => firstString((it as { label?: unknown }).label, 'Link'))
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
    showHeight: false,
    surfaces: ['site'],
    props: [],
    defaults: {},
    renderLeaf: ({ value }) => {
      const identity =
        value && typeof value === 'object' ? (value as { name?: unknown }) : null;
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
    showHeight: false,
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
  if (def.kind === 'container') out.layout = { ...DEFAULT_LAYOUT, ...def.defaults.layout };
  if (def.kind === 'container') out.children = [];
  return out;
}
