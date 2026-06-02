// The curated starter pages Sparx ships (docs/40, docs/41 §5). On a tenant's
// first `list`, the service seeds these into BuilderPage rows; from then on
// they're ordinary editable pages. This is the "breadth" set — a small studio
// that publishes essays (CMS), sells a few goods (Commerce), and runs a
// newsletter (CRM): commerce sitting as ONE section among several, never the
// spine. It exercises the composition model end to end — static content, object
// binding that sets scope, array binding that ITERATES, per-leaf field binding,
// and the box base (heights, surfaces, edge-to-edge vs contained widths).
//
// Node ids are authored + deterministic (a `seed-` prefix keeps them clear of
// the editor's runtime `makeId` scheme). They only need to be unique within
// their own tree; the persisted row's PK is a fresh uuid.

import {
  DEFAULT_BOX,
  DEFAULT_LAYOUT,
  type BoxBase,
  type BuilderNode,
  type LayoutBase,
} from './node';
import type { BuilderPageKind } from './page';

let n = 0;
const sid = (t: string): string => `seed-${t}-${(n += 1)}`;

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
    id: sid(type),
    type,
    box: box(opts.box),
    props: opts.props ?? {},
  };
  if (opts.layout) out.layout = layout(opts.layout);
  if (opts.bind) out.binding = { path: opts.bind };
  if (opts.children) out.children = opts.children;
  return out;
}

// ── Tree builders ──────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
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
        bind: 'cms.blog_post[0]',
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

      // ARTICLES — a static header, then an iterating grid (CMS blog posts).
      node('Section', {
        box: { name: 'Latest writing', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Latest writing' } }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'cms.blog_post',
            children: [
              node('Card', {
                box: { name: 'Article card', surface: 'subtle', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'item.featuredImage' }),
                  node('Text', { props: { text: 'Essay', variant: 'eyebrow' } }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('Text', { props: { variant: 'body' }, bind: 'item.excerpt' }),
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
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Product card', surface: 'none', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
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
          node('Text', { props: { variant: 'meta', text: '© Field & Form' } }),
          node('Text', { props: { variant: 'meta', text: 'Built with Sparx' } }),
        ],
      }),
    ],
  });
}

function blogPostTree(): BuilderNode {
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
          node('Text', { props: { text: 'Essay', variant: 'eyebrow' } }),
          node('Heading', { props: { level: 'h1' }, bind: 'blog_post.title' }),
          node('Text', { props: { variant: 'body' }, bind: 'blog_post.excerpt' }),
        ],
      }),
      node('Section', {
        box: { name: 'Body', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'blog_post.featuredImage' }),
          node('Text', { props: { variant: 'body' }, bind: 'blog_post.body' }),
        ],
      }),
    ],
  });
}

function productTree(): BuilderNode {
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

function aboutTree(): BuilderNode {
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

// The starter SITE LAYOUT (docs/45) — the chrome shell every page renders inside.
// A header (logo + primary nav), the content Outlet, and a footer (footer nav +
// social + copyright). Chrome binds to the `site` sources; the Outlet marks where
// the routed page goes. One layout per tenant in v1.
function siteLayoutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'md',
        },
        layout: { direction: 'row', justify: 'between', alignItems: 'center' },
        children: [
          node('Logo', { bind: 'site.identity' }),
          node('NavMenu', { props: { orientation: 'row' }, bind: 'site.primaryNav' }),
        ],
      }),
      node('Outlet', {
        box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
      }),
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'lg',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('NavMenu', { props: { orientation: 'row' }, bind: 'site.footerNav' }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Your brand' } }),
        ],
      }),
    ],
  });
}

// ── The curated set ──────────────────────────────────────────────────────────

export interface StarterPage {
  /** Stable starter identifier (independent of the per-tenant row id). */
  key: string;
  name: string;
  kind: BuilderPageKind;
  /** Collection starters bind every record of this content type. */
  recordType?: string;
  tree: BuilderNode;
}

/** Built ONCE at module load — the `node()` id counter runs to completion here,
 *  giving each starter tree a stable id sequence. Never mutated. */
export const STARTER_PAGES: StarterPage[] = [
  { key: 'home', name: 'Home — Landing', kind: 'singleton', tree: homeTree() },
  {
    key: 'blog-post',
    name: 'Blog post',
    kind: 'collection',
    recordType: 'cms.blog_post',
    tree: blogPostTree(),
  },
  {
    key: 'product',
    name: 'Product page',
    kind: 'collection',
    recordType: 'commerce.product',
    tree: productTree(),
  },
  { key: 'about', name: 'About', kind: 'singleton', tree: aboutTree() },
];

/** The single starter site layout (docs/45). Seeded on the tenant's first layout
 *  load; from then on it's an ordinary editable layout. Built once at module load
 *  so its node ids are stable (cf. STARTER_PAGES). */
export interface StarterLayout {
  name: string;
  tree: BuilderNode;
}
export const STARTER_LAYOUT: StarterLayout = { name: 'Site layout', tree: siteLayoutTree() };

/** A blank single-section page — the default when "New page" doesn't pick a
 *  starter. The root id is fixed; it's unique within its own (empty) tree. */
export function blankPageTree(): BuilderNode {
  return {
    id: 'root',
    type: 'Section',
    box: {
      ...DEFAULT_BOX,
      name: 'Page',
      padding: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { ...DEFAULT_LAYOUT, direction: 'stack', gap: 'md' },
    props: {},
    children: [],
  };
}
