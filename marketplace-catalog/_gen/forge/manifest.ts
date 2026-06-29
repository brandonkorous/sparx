// Forge generator — assembles the full blueprint manifest from the section modules. This
// is the ONE place the tree builders are invoked, so it owns the shared node-id ordering:
// ids advance in node()/el()/atom() call order (CLAUDE.md), fixed by the property order
// below — `layout.tree` first, then `pages` (Home, Work, Services, About, Insights,
// Careers, Contact, Insight Story), then `emails` (Welcome, Studio Notes). Reorder a
// property and every downstream id shifts, so KEEP this order stable.
//
// `brand`, `theme`, `assets` are pure data imported above — no node() calls, so no ids
// are minted until `layout.tree` evaluates.
//
// Presentation-only (the four-axis provisioning model): the blueprint ships the LOOK —
// brand, theme, layout, pages, emails — but NO content of its own. A tenant gets the
// styled studio site; articles fill in from their own CMS (or industry sample data), and
// the Insights index is an empty state until any exist.

import { brand, theme } from './theme';
import { brandAssets } from './logo';
import { layoutTree } from './layout';
import { homeTree } from './pages/home';
import { workTree } from './pages/work';
import { servicesTree } from './pages/services';
import { aboutTree } from './pages/about';
import { insightsTree } from './pages/insights';
import { careersTree } from './pages/careers';
import { contactTree } from './pages/contact';
import { storyTemplate } from './pages/templates';
import { studioNotesEmail, welcomeEmail } from './email';

export const manifest = {
  key: 'forge',
  version: '1.1.0',
  name: 'Forge',
  summary:
    'A bold, dark, award-style marketing site for a creative / brand & web studio — a warm near-black canvas with an acid-green accent, a recreated case-study showcase, a scrolling client + awards marquee, a 2-up work gallery, a 4-up stat band, numbered services, a process timeline, and testimonials, plus Work, Services, About, Insights, Careers, a Contact form, seeded insight articles, and brand-voiced emails. A ready-to-edit services starter.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],

  brand,

  theme,

  // The brand logo/favicon only (data-URI SVG). Insight-article covers are gone with the
  // content strip — the article template binds the tenant's own media.
  assets: [...brandAssets],

  layout: { name: 'Forge layout', tree: layoutTree(), makeActive: true },

  pages: [
    {
      name: 'Home',
      kind: 'singleton' as const,
      tree: homeTree(),
      seoTitle: 'Forge — Impactful brands & websites. Engineered growth.',
      seoDescription:
        'An award-winning studio for brand, web, and growth — trusted by ambitious startups and category leaders to unlock their next era of growth.',
    },
    {
      name: 'Work',
      kind: 'singleton' as const,
      slug: 'work',
      tree: workTree(),
      seoTitle: 'Work — Forge',
      seoDescription:
        'A decade of brands and digital products, shaped end-to-end — from positioning and identity to high-converting websites and launch.',
    },
    {
      name: 'Services',
      kind: 'singleton' as const,
      slug: 'services',
      tree: servicesTree(),
      seoTitle: 'Services — Forge',
      seoDescription:
        'Brand & identity, web design & development, growth marketing, and motion & 3D — a full-service studio built around disciplines that compound.',
    },
    {
      name: 'About',
      kind: 'singleton' as const,
      slug: 'about',
      tree: aboutTree(),
      seoTitle: 'About — Forge',
      seoDescription:
        'A small senior studio that ships like a big one. Since 2014 we’ve helped ambitious teams look and perform like the company they’re becoming.',
    },
    {
      name: 'Insights',
      kind: 'singleton' as const,
      slug: 'insights',
      tree: insightsTree(),
      seoTitle: 'Insights — Forge',
      seoDescription: 'Field notes from the studio on building brands and products that compound — brand, web, and growth.',
    },
    {
      name: 'Careers',
      kind: 'singleton' as const,
      slug: 'careers',
      tree: careersTree(),
      seoTitle: 'Careers — Forge',
      seoDescription: 'Build with us. A small senior team that ships work it’s proud of — see our open roles.',
    },
    {
      name: 'Contact',
      kind: 'singleton' as const,
      slug: 'contact',
      tree: contactTree(),
      seoTitle: 'Contact — Forge',
      seoDescription: 'Tell us about your project and what success looks like. We reply within one business day.',
    },
    {
      name: 'Insight Story',
      kind: 'collection' as const,
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: storyTemplate(),
    },
  ],

  emails: [
    {
      name: 'Welcome',
      subject: 'Thanks for reaching out to {{site.name}} 👋',
      preheader: 'We got your note — here’s what happens next.',
      tree: welcomeEmail(),
    },
    {
      name: 'Studio Notes',
      subject: 'Studio Notes from {{site.name}} ✦',
      preheader: 'New work, new thinking — a short note from the studio.',
      tree: studioNotesEmail(),
    },
  ],
};
