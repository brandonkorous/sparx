// The page the editor opens with, plus the mock data it composes from.
//
// This is the "breadth" scenario: a small creative studio that publishes
// essays (CMS), sells a few goods (Commerce), and runs a newsletter (CRM) —
// commerce sitting as ONE section among several, never the spine. It exists to
// prove the composition model end to end: static content, object binding that
// sets scope (the hero), array binding that ITERATES (the two card grids),
// per-leaf field binding (item.title, item.price), and the box base
// (heights, surfaces, edge-to-edge vs. contained widths).
//
// All data here is mock. The backend will supply these shapes once the UI has
// settled what it actually needs.

import {
  DEFAULT_BOX,
  DEFAULT_LAYOUT,
  type BoxBase,
  type BuilderNode,
  type DataSources,
  type LayoutBase,
  type PageTemplate,
} from './model';

// ── Active modules (drives the context bar + palette) ────────────────────────

export interface ModuleInfo {
  key: string;
  label: string;
  /** The module's brand color (docs/sparx-brand-guide). */
  color: string;
  on: boolean;
}

export const MODULES: ModuleInfo[] = [
  { key: 'cms', label: 'CMS', color: '#14b8a6', on: true },
  { key: 'commerce', label: 'Commerce', color: '#f97316', on: true },
  { key: 'crm', label: 'CRM', color: '#06b6d4', on: true },
  { key: 'events', label: 'Events', color: '#a855f7', on: false },
];

export function moduleColor(key: string | undefined): string {
  return MODULES.find((m) => m.key === key)?.color ?? '#6366f1';
}

// ── Mock data sources ────────────────────────────────────────────────────────

export const SAMPLE_DATA: DataSources = {
  // A singleton CMS page record (the page's own fields).
  page: {
    title: 'Field notes & finds',
    tagline: 'Essays on making things by hand — and a small shelf of tools we love.',
  },
  cms: {
    posts: [
      {
        title: 'The quiet geometry of a well-made bowl',
        excerpt: "Why the curve under the rim is the part you never notice — until it's wrong.",
        cover: { url: '', alt: 'A turned wooden bowl, side on', description: '' },
        tag: 'Craft',
        author: 'Maya R.',
        readMins: 6,
      },
      {
        title: 'Linen, after a hundred washes',
        excerpt: 'A field test that took three years and ruined two tablecloths.',
        cover: { url: '', alt: 'Folded linen in afternoon light', description: '' },
        tag: 'Materials',
        author: 'Devin K.',
        readMins: 4,
      },
      {
        title: 'Notes from a slow week',
        excerpt: 'On letting a piece sit unfinished long enough to hear it.',
        cover: { url: '', alt: 'A half-finished piece on the bench', description: '' },
        tag: 'Studio',
        author: 'Maya R.',
        readMins: 3,
      },
    ],
  },
  commerce: {
    products: [
      { title: 'Plush Cotton Towel', price: 34, image: { url: '', alt: 'Folded cotton towel' } },
      { title: 'Stoneware Mug', price: 22, image: { url: '', alt: 'Glazed stoneware mug' } },
      { title: 'Linen Apron', price: 48, image: { url: '', alt: 'Natural linen apron' } },
    ],
  },
  crm: {
    list: { name: 'Field Notes', subscribers: 1240 },
  },
  // Single sample records — the one the editor previews when you're editing a
  // CONTENT-TYPE-BOUND template (one template → many records). `post.*` for the
  // Blog post template, `product.*` for the Product page template.
  post: {
    title: 'The quiet geometry of a well-made bowl',
    excerpt: "Why the curve under the rim is the part you never notice — until it's wrong.",
    body: 'A longer essay would run here — the template decides how the post looks; the writer fills the words in the CMS.',
    cover: { url: '', alt: 'A turned wooden bowl, side on', description: '' },
    tag: 'Craft',
    author: 'Maya R.',
    readMins: 6,
  },
  product: {
    title: 'Plush Cotton Towel',
    price: 34,
    description: 'Long-staple cotton, woven heavy and washed soft. The kind you keep.',
    images: [
      { url: '', alt: 'Folded towel, front' },
      { url: '', alt: 'Towel weave, close up' },
      { url: '', alt: 'Towel on a rail' },
    ],
  },
};

/** Paths the binding picker offers, grouped by the module that supplies them.
 *  `item.*` paths are offered when the selected node sits inside an iterating
 *  or scope-setting container — the picker filters by what's in scope. */
export const BIND_PATHS: { module: string; paths: { path: string; label: string }[] }[] = [
  {
    module: 'cms',
    paths: [
      { path: 'page.title', label: 'page.title' },
      { path: 'page.tagline', label: 'page.tagline' },
      { path: 'cms.posts', label: 'cms.posts (list)' },
      { path: 'cms.posts[0]', label: 'cms.posts[0] (latest)' },
      { path: 'post.title', label: 'post.title (this record)' },
      { path: 'post.excerpt', label: 'post.excerpt' },
      { path: 'post.body', label: 'post.body' },
      { path: 'post.cover', label: 'post.cover' },
      { path: 'post.author', label: 'post.author' },
      { path: 'post.tag', label: 'post.tag' },
    ],
  },
  {
    module: 'commerce',
    paths: [
      { path: 'commerce.products', label: 'commerce.products (list)' },
      { path: 'product.title', label: 'product.title (this record)' },
      { path: 'product.price', label: 'product.price' },
      { path: 'product.images', label: 'product.images (gallery)' },
      { path: 'product.description', label: 'product.description' },
    ],
  },
  {
    module: 'crm',
    paths: [{ path: 'crm.list', label: 'crm.list' }],
  },
];

/** `item.*` paths offered when an `item` is in scope. */
export const ITEM_PATHS: { path: string; label: string }[] = [
  { path: 'item.title', label: 'item.title' },
  { path: 'item.excerpt', label: 'item.excerpt' },
  { path: 'item.cover', label: 'item.cover' },
  { path: 'item.image', label: 'item.image' },
  { path: 'item.price', label: 'item.price' },
  { path: 'item.tag', label: 'item.tag' },
  { path: 'item.author', label: 'item.author' },
  { path: 'item.name', label: 'item.name' },
  { path: 'index', label: 'index' },
];

// ── Tree builders ────────────────────────────────────────────────────────────

let n = 0;
const nid = (t: string) => `${t}-${(n += 1)}`;

function box(over: Partial<BoxBase> = {}): BoxBase {
  return { ...DEFAULT_BOX, ...over };
}
function layout(over: Partial<LayoutBase> = {}): LayoutBase {
  return { ...DEFAULT_LAYOUT, ...over };
}
function node(
  type: string,
  opts: {
    box?: Partial<BoxBase>;
    layout?: Partial<LayoutBase>;
    props?: Record<string, unknown>;
    bind?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  const out: BuilderNode = {
    id: nid(type),
    type,
    box: box(opts.box),
    props: opts.props ?? {},
  };
  if (opts.layout) out.layout = layout(opts.layout);
  if (opts.bind) out.binding = { path: opts.bind };
  if (opts.children) out.children = opts.children;
  return out;
}

export function buildSampleTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — bound to the latest post (an OBJECT → renders once, sets scope).
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        bind: 'cms.posts[0]',
        children: [
          node('Text', { props: { text: 'Latest essay', variant: 'eyebrow' } }),
          node('Heading', {
            props: { level: 'h1', text: 'Field notes & finds' },
            bind: 'item.title',
          }),
          node('Text', { props: { variant: 'body' }, bind: 'item.excerpt' }),
          node('Button', { props: { label: 'Read the essay →', style: 'primary' } }),
        ],
      }),

      // ARTICLES — a static header, then an iterating grid (CMS).
      node('Section', {
        box: { name: 'Latest writing', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Latest writing' } }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'cms.posts',
            children: [
              node('Card', {
                box: { name: 'Article card', surface: 'subtle', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'item.cover' }),
                  node('Text', { props: { variant: 'eyebrow' }, bind: 'item.tag' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('Text', { props: { variant: 'body' }, bind: 'item.excerpt' }),
                  node('Text', { props: { variant: 'meta' }, bind: 'item.author' }),
                ],
              }),
            ],
          }),
        ],
      }),

      // SHOP — Commerce is just another section. Turn the module off and it hides.
      node('Section', {
        box: { name: 'From the shop', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the shop' } }),
          node('Grid', {
            box: { name: 'Products grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'commerce.products',
            children: [
              node('Card', {
                box: { name: 'Product card', surface: 'none', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.image' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('PriceTag', { bind: 'item.price' }),
                  node('Button', { props: { label: 'Add to cart', style: 'soft' } }),
                ],
              }),
            ],
          }),
        ],
      }),

      // NEWSLETTER — bound to a CRM list (an OBJECT → sets scope), centered band.
      node('Section', {
        box: {
          name: 'Newsletter',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', { props: { level: 'h2', text: 'Field notes in your inbox' } }),
          node('Text', {
            props: { variant: 'body', text: 'One thoughtful email a month. No noise.' },
          }),
          node('Signup', { props: { cta: 'Subscribe' }, bind: 'crm.list' }),
        ],
      }),

      // FOOTER — static.
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'md',
        },
        layout: { direction: 'row', justify: 'between', alignItems: 'center' },
        children: [
          node('Text', { props: { variant: 'meta', text: '© FERN & FORM' } }),
          node('Text', { props: { variant: 'meta', text: 'Built with Sparx' } }),
        ],
      }),
    ],
  });
}

// ── Seed templates ───────────────────────────────────────────────────────────
// The curated set Sparx ships (5–10). A user creates N more on top of these.
// Two kinds: SINGLETON (one specific page) and COLLECTION (one template that
// renders every record of a content type — binds to post.* / product.*).

function blogPostTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Blog post', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'md',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Text', { props: { variant: 'eyebrow' }, bind: 'post.tag' }),
          node('Heading', { props: { level: 'h1' }, bind: 'post.title' }),
          node('Text', { props: { variant: 'meta' }, bind: 'post.author' }),
        ],
      }),
      node('Section', {
        box: { name: 'Body', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'post.cover' }),
          node('Text', { props: { variant: 'body' }, bind: 'post.body' }),
        ],
      }),
    ],
  });
}

function productTemplate(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Product page',
      padding: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Section', {
        box: { name: 'Product', padding: 'none', contentWidth: 'full' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'start' },
        children: [
          node('ImageDisplay', { props: { ratio: 'square' }, bind: 'product.images' }),
          node('Stack', {
            box: { name: 'Buy', padding: 'none' },
            layout: { direction: 'stack', gap: 'md' },
            children: [
              node('Heading', { props: { level: 'h1' }, bind: 'product.title' }),
              node('PriceTag', { bind: 'product.price' }),
              node('Text', { props: { variant: 'body' }, bind: 'product.description' }),
              node('Button', { props: { label: 'Add to cart', style: 'primary' } }),
            ],
          }),
        ],
      }),
    ],
  });
}

function aboutTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'About', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Intro',
          height: 'md',
          surface: 'subtle',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'About the studio' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A few sentences on who we are and why we make things by hand.',
            },
          }),
        ],
      }),
      node('Section', {
        box: { name: 'Story', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Our story' } }),
          node('Text', {
            props: { variant: 'body', text: 'Static prose, authored right here on the page.' },
          }),
        ],
      }),
    ],
  });
}

export function buildSeedTemplates(): PageTemplate[] {
  n = 0; // deterministic id sequence (see SEED_TEMPLATES note on hydration)
  return [
    { id: nid('tpl'), name: 'Home — Landing', kind: 'singleton', tree: buildSampleTree() },
    {
      id: nid('tpl'),
      name: 'Blog post',
      kind: 'collection',
      recordType: 'cms.post',
      tree: blogPostTemplate(),
    },
    {
      id: nid('tpl'),
      name: 'Product page',
      kind: 'collection',
      recordType: 'commerce.product',
      tree: productTemplate(),
    },
    { id: nid('tpl'), name: 'About', kind: 'singleton', tree: aboutTemplate() },
  ];
}

export function makeBlankTemplate(): PageTemplate {
  return {
    id: nid('tpl'),
    name: 'Untitled page',
    kind: 'singleton',
    tree: node('Section', {
      box: { name: 'Page', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
      layout: { direction: 'stack', gap: 'md' },
      children: [],
    }),
  };
}

// Built ONCE at module load (not per render) so the node ids are identical on
// the server and the client — the id counter is module-global, and the server
// reuses the module across requests, so a per-render rebuild would drift the
// ids and break hydration. Editing replaces entries immutably; this constant is
// never mutated.
export const SEED_TEMPLATES: PageTemplate[] = buildSeedTemplates();
