// Tempo generator — assembles the full blueprint manifest from the section modules. This
// is the ONE place the tree builders are invoked, so it owns the shared node-id ordering:
// ids advance in node()/el()/atom() call order (CLAUDE.md), fixed by the property order
// below — `layout.tree` first, then `pages` (Home, Shop, Club, Our Story, Help, News,
// Product, Article), then `emails` (Welcome, New Drops). Reorder a property and every
// downstream id shifts, so KEEP this order stable.
//
// `brand`, `theme`, `assets` are pure data imported above — no node() calls, so no ids
// are minted until `layout.tree` evaluates.
//
// Presentation-only (the four-axis provisioning model): the blueprint ships the LOOK —
// brand, theme, layout, pages, emails — but NO catalog or news content of its own. A
// tenant gets the styled sportswear site; products fill in from their own catalog or
// industry sample data, and the product grids bind the live catalog (`from: 'all'`),
// empty until any exist.

import { brand, theme } from './theme';
import { brandAssets } from './logo';
import { layoutTree } from './layout';
import { homeTree } from './pages/home';
import { shopTree } from './pages/shop';
import { clubTree } from './pages/club';
import { storyTree } from './pages/story';
import { helpTree } from './pages/help';
import { newsTree } from './pages/news';
import { productTemplate, articleTemplate } from './pages/templates';
import { welcomeEmail, dropsEmail } from './email';

export const manifest = {
  key: 'tempo',
  version: '1.1.0',
  name: 'Tempo',
  summary:
    'A bold, stark athletic storefront — a campaign-driven home with a hero carousel, a team-colorway scroller, category tiles, a live best-sellers grid, a membership band and a mega footer, plus a Shop catalog, a Club membership page, Our Story, Help, a News index, enriched product and article templates, ~12 products across four categories, two collections, and brand-voiced emails. A ready-to-edit sportswear retail starter.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand,

  theme,

  // The brand motion-mark logo/favicon only (data URIs). Product imagery + news covers
  // are gone with the catalog/content strip — the PDP/article templates now bind the
  // tenant's own media.
  assets: [...brandAssets],

  layout: { name: 'Tempo layout', tree: layoutTree(), makeActive: true },

  pages: [
    {
      name: 'Home',
      kind: 'singleton' as const,
      tree: homeTree(),
      seoTitle: 'Tempo — Built to move',
      seoDescription:
        'Performance and heritage sportswear — running shoes, soccer cleats, Originals sneakers and lifestyle apparel for men, women and kids.',
    },
    {
      name: 'Shop',
      kind: 'singleton' as const,
      slug: 'shop',
      tree: shopTree(),
      seoTitle: 'Shop — Tempo',
      seoDescription: 'Shop the full Tempo catalog — Originals, Running, Soccer and Lifestyle, with free shipping and returns for Club members.',
    },
    {
      name: 'Club',
      kind: 'singleton' as const,
      slug: 'club',
      tree: clubTree(),
      seoTitle: 'The Club — Tempo',
      seoDescription: 'Join the Tempo Club free — points on every order, members-only drops, free shipping and returns, plus a birthday surprise.',
    },
    {
      name: 'Our Story',
      kind: 'singleton' as const,
      slug: 'story',
      tree: storyTree(),
      seoTitle: 'Our Story — Tempo',
      seoDescription: 'How Tempo builds gear that performs as hard as the people who wear it — engineered, responsible, and made to move.',
    },
    {
      name: 'Help',
      kind: 'singleton' as const,
      slug: 'help',
      tree: helpTree(),
      seoTitle: 'Help & Support — Tempo',
      seoDescription: 'Orders, returns, shipping and sizing — find an answer fast or reach the Tempo team directly, seven days a week.',
    },
    {
      name: 'News',
      kind: 'singleton' as const,
      slug: 'news',
      tree: newsTree(),
      seoTitle: 'News & Stories — Tempo',
      seoDescription: 'Drops, athlete stories, and what we’re building next — straight from the Tempo team.',
    },
    {
      name: 'Product',
      kind: 'collection' as const,
      recordType: 'commerce.product',
      isDefault: true,
      tree: productTemplate(),
    },
    {
      name: 'Article',
      kind: 'collection' as const,
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: articleTemplate(),
    },
  ],

  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to the {{site.name}} Club »',
      preheader: 'Your membership is live — free shipping, early drops, and points on every order.',
      tree: welcomeEmail(),
    },
    {
      name: 'New Drops',
      subject: 'New drops just landed at {{site.name}} 🔥',
      preheader: 'Fresh styles across Running, Soccer and Lifestyle — the best sizes go first.',
      tree: dropsEmail(),
    },
  ],
};
