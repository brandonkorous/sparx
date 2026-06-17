// The curated starter pages sparx ships (docs/40, docs/41 §5). On a tenant's
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

import { seedNode, type BoxStyle, type LayoutStyle } from './box-to-class';
import type { BuilderNode } from './node';
import type { BuilderPageKind } from './page';
import { navbar } from './site-chrome';

let n = 0;
const sid = (t: string): string => `seed-${t}-${(n += 1)}`;

// The authoring vocabulary (docs/61): each starter describes its nodes with the
// ergonomic box/layout DTO, compiled to a Tailwind-native `class` string by
// `seedNode` — the persisted node carries only `{ id, type, name?, class?, props,
// binding?, children? }`.
function node(
  type: string,
  opts: {
    box?: BoxStyle;
    layout?: LayoutStyle;
    props?: Record<string, unknown>;
    bind?: string;
    /** Verbatim utility classes — used to author raw `el:*` chrome (e.g. the
     *  navbar's start/center/end flex zones, docs/98 §3.7). */
    cls?: string;
    /** Author label (Layers tree). For raw `el:*` nodes that carry no `box.name`. */
    name?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  return seedNode(sid(type), type, opts);
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
          node('Text', { props: { variant: 'meta', text: 'Built with sparx' } }),
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

// Default node-owned navigation links seeded into a new site's header/footer
// (docs/57). Navigation is Builder-owned site chrome, so a brand-new site gets a
// sensible, editable nav out of the box — no CMS module required.
const STARTER_NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/products' },
  { label: 'About', href: '/about' },
];

// The starter SITE LAYOUT (docs/45, docs/98 §3.7). A layout is a FREE CANVAS whose
// only structural invariant is the `Outlet` (the content box where each routed
// page renders — `pinned` in the registry, so it can't be deleted or dragged).
// Everything else is author-composed and fully deletable: this default seeds a
// composable navbar (a raw <nav> with start/center/end zones) + the Outlet + a
// footer, so a new site looks live immediately — delete the chrome and you're at a
// blank slate (just the content box). Nothing here is required or hardcoded; it's
// ordinary editable seed data. One layout per site (seeded once on first load).
function siteLayoutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Header — the shared `navbar` component (docs/98 §5): a <nav class="navbar">
      // with navbar-start / navbar-center / navbar-end zones. Here the brand
      // WORDMARK sits in navbar-center, so it's dead-center — centering the logo is
      // just "put the Wordmark in the center zone", no special variant. Primary nav
      // in the start zone, an action at the end. The "header" is simply a navbar at
      // the top of the layout. Fully editable + deletable; the SAME navbar every
      // blueprint uses (site-chrome.ts).
      navbar(node, {
        start: [node('NavMenu', { props: { orientation: 'row', links: STARTER_NAV_LINKS } })],
        center: [node('Wordmark', { bind: 'site.identity' })],
        end: [node('Button', { props: { label: 'Get started', style: 'primary' } })],
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
          node('NavMenu', { props: { orientation: 'row', links: STARTER_NAV_LINKS } }),
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
  return seedNode('root', 'Section', {
    box: { name: 'Page', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [],
  });
}

// ── Email starters (docs/52) ──────────────────────────────────────────────────
//
// An email is ONE self-contained body tree (no site/page split, no Outlet). The
// branded frame (wordmark header + legal footer) is fixed chrome the email
// renderer supplies, so a starter is just the body: a Section that stacks the
// content. Static (no bindings) — the Phase-1 slice (docs/52 §9).

function welcomeEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Welcome aboard 👋' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thanks for joining. We're glad you're here — here's what to do next.",
        },
      }),
      node('Button', {
        props: { label: 'Get started', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'Questions? Just reply to this email.' },
      }),
    ],
  });
}

/** A blank single-section email body — the default when "New email" doesn't pick
 *  a starter. The root id is fixed; it's unique within its own (empty) tree. */
export function blankEmailTree(): BuilderNode {
  return seedNode('root', 'Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [],
  });
}

export interface StarterEmail {
  /** Stable starter identifier (independent of the per-tenant row id). */
  key: string;
  name: string;
  subject: string;
  preheader?: string;
  tree: BuilderNode;
}

/** The curated starter emails sparx ships. Seeded on the tenant's first email
 *  list; from then on they're ordinary editable emails (cf. STARTER_PAGES). */
export const STARTER_EMAILS: StarterEmail[] = [
  {
    key: 'welcome',
    name: 'Welcome',
    subject: 'Welcome to {{site.name}} 👋',
    preheader: "You're in — here's how to get started.",
    tree: welcomeEmailTree(),
  },
];
