// Tempo — blueprint payload ENTRY (GENERATED, docs/85). THIN: it imports each
// heavy section from ./parts/* and default-exports the assembled manifest. The ingest
// dynamic-imports this file; ESM resolves the parts. Edit a scoped file under ./parts/,
// or the gen source, then re-run the generator.

import assets from './parts/assets';
import content from './parts/content';
import commerce from './parts/commerce';
import layoutTree from './parts/layout';
import page_home from './parts/pages/home';
import page_shop from './parts/pages/shop';
import page_club from './parts/pages/club';
import page_story from './parts/pages/story';
import page_help from './parts/pages/help';
import page_news from './parts/pages/news';
import page_product from './parts/pages/product';
import page_article from './parts/pages/article';
import email_welcome from './parts/emails/welcome';
import email_new_drops from './parts/emails/new-drops';

export default {
  key: 'tempo',
  version: '1.0.1',
  name: 'Tempo',
  summary:
    'A bold, stark athletic storefront — a campaign-driven home with a hero carousel, a team-colorway scroller, category tiles, a live best-sellers grid, a membership band and a mega footer, plus a Shop catalog, a Club membership page, Our Story, Help, a News index, enriched product and article templates, ~12 products across four categories, two collections, and brand-voiced emails. A ready-to-edit sportswear retail starter.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],
  brand: {
    businessName: 'Tempo',
    tagline: 'Built to move.',
    colors: {
      primary: '#111111',
      primaryForeground: '#ffffff',
      accent: '#e3251f',
      secondary: '#1c6b3e',
    },
    fonts: {
      heading: 'Archivo',
      body: 'Inter',
    },
    logoLightAssetId: 'brand-logo',
    faviconAssetId: 'brand-favicon',
    socials: [
      {
        platform: 'instagram',
        url: 'https://instagram.com/tempo',
      },
      {
        platform: 'facebook',
        url: 'https://facebook.com/tempo',
      },
      {
        platform: 'x',
        url: 'https://x.com/tempo',
      },
      {
        platform: 'youtube',
        url: 'https://youtube.com/@tempo',
      },
    ],
  },
  theme: {
    name: 'Tempo',
    basePresetKey: 'drop',
    presentation: {
      v: 2,
      containerWidth: '1480px',
      light: {
        base100: '#ffffff',
        base200: '#f5f5f5',
        base300: '#e3e3e3',
        baseContent: '#111111',
        neutral: '#111111',
        neutralContent: '#ffffff',
        border: '#e3e3e3',
      },
    },
    brand: {
      colorPrimary: '#111111',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#e3251f',
      colorSecondary: '#1c6b3e',
      fontHeading: 'Archivo',
      fontBody: 'Inter',
      tokens: {
        shape: {
          radiusSelector: '0',
          radiusField: '0',
          radiusBox: '0',
        },
      },
    },
    apply: true,
  },
  assets: assets,
  content: content,
  commerce: commerce,
  layout: {
    name: 'Tempo layout',
    tree: layoutTree,
    makeActive: true,
  },
  pages: [
    {
      name: 'Home',
      kind: 'singleton',
      tree: page_home,
      seoTitle: 'Tempo — Built to move',
      seoDescription:
        'Performance and heritage sportswear — running shoes, soccer cleats, Originals sneakers and lifestyle apparel for men, women and kids.',
    },
    {
      name: 'Shop',
      kind: 'singleton',
      slug: 'shop',
      tree: page_shop,
      seoTitle: 'Shop — Tempo',
      seoDescription:
        'Shop the full Tempo catalog — Originals, Running, Soccer and Lifestyle, with free shipping and returns for Club members.',
    },
    {
      name: 'Club',
      kind: 'singleton',
      slug: 'club',
      tree: page_club,
      seoTitle: 'The Club — Tempo',
      seoDescription:
        'Join the Tempo Club free — points on every order, members-only drops, free shipping and returns, plus a birthday surprise.',
    },
    {
      name: 'Our Story',
      kind: 'singleton',
      slug: 'story',
      tree: page_story,
      seoTitle: 'Our Story — Tempo',
      seoDescription:
        'How Tempo builds gear that performs as hard as the people who wear it — engineered, responsible, and made to move.',
    },
    {
      name: 'Help',
      kind: 'singleton',
      slug: 'help',
      tree: page_help,
      seoTitle: 'Help & Support — Tempo',
      seoDescription:
        'Orders, returns, shipping and sizing — find an answer fast or reach the Tempo team directly, seven days a week.',
    },
    {
      name: 'News',
      kind: 'singleton',
      slug: 'news',
      tree: page_news,
      seoTitle: 'News & Stories — Tempo',
      seoDescription:
        'Drops, athlete stories, and what we’re building next — straight from the Tempo team.',
    },
    {
      name: 'Product',
      kind: 'collection',
      recordType: 'commerce.product',
      isDefault: true,
      tree: page_product,
    },
    {
      name: 'Article',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: page_article,
    },
  ],
  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to the {{site.name}} Club »',
      preheader: 'Your membership is live — free shipping, early drops, and points on every order.',
      tree: email_welcome,
    },
    {
      name: 'New Drops',
      subject: 'New drops just landed at {{site.name}} 🔥',
      preheader: 'Fresh styles across Running, Soccer and Lifestyle — the best sizes go first.',
      tree: email_new_drops,
    },
  ],
};
