// Mosaic generator — assembles the full blueprint manifest from the section modules.
// This is the ONE place the tree builders are invoked, so it owns the shared node-id
// ordering: ids advance in node()/el()/atom() call order (CLAUDE.md), fixed by the
// property order below — `layout.tree` first, then `pages` (Home, Pricing, Enterprise,
// Request a demo, Customers, Customer Story), then `emails` (Welcome, Product Tips).
// Reorder a property and every downstream id shifts, so KEEP this order stable.
//
// `brand`, `theme`, `assets`, `content` are pure data imported above — no node() calls,
// so no ids are minted until `layout.tree` evaluates.

import { brand, theme } from './theme';
import { brandAssets } from './logo';
import { content, storyCovers } from './cms';
import { layoutTree } from './layout';
import { homeTree } from './pages/home';
import { pricingTree } from './pages/pricing';
import { enterpriseTree } from './pages/enterprise';
import { requestDemoTree } from './pages/request-demo';
import { customersTree } from './pages/customers';
import { storyTemplate } from './pages/templates';
import { welcomeEmail, productTipsEmail } from './email';

export const manifest = {
  key: 'mosaic',
  version: '1.0.0',
  name: 'Mosaic',
  summary:
    'A clean, modern marketing site for an AI-workspace / productivity SaaS — a bento-driven home page with a browser-chrome product preview, a scrolling logo wall, agent and assistant showcases, social proof and stats, plus Pricing, Enterprise, a Request-a-demo page, customer stories, and brand-voiced emails. A ready-to-edit services starter.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],

  brand,

  theme,

  // Customer-story covers (data-URI panels) + the brand logo/favicon (data-URI SVG).
  assets: [...storyCovers, ...brandAssets],

  content,

  layout: { name: 'Mosaic layout', tree: layoutTree(), makeActive: true },

  pages: [
    {
      name: 'Home',
      kind: 'singleton' as const,
      tree: homeTree(),
      seoTitle: 'Mosaic — The AI workspace that works for you',
      seoDescription:
        'Capture context, find answers, and automate tasks with AI built for your team. Docs, projects, and a knowledge base your team and agents share.',
    },
    {
      name: 'Pricing',
      kind: 'singleton' as const,
      slug: 'pricing',
      tree: pricingTree(),
      seoTitle: 'Pricing — Mosaic',
      seoDescription: 'Start free and upgrade when you need more. Simple, transparent pricing that scales with your team.',
    },
    {
      name: 'Enterprise',
      kind: 'singleton' as const,
      slug: 'enterprise',
      tree: enterpriseTree(),
      seoTitle: 'Enterprise — Mosaic',
      seoDescription:
        'The security, control, and scale that IT and security teams require — SSO, SCIM, audit logs, and a 99.9% uptime SLA — with adoption your whole company will love.',
    },
    {
      name: 'Request a demo',
      kind: 'singleton' as const,
      slug: 'request-demo',
      tree: requestDemoTree(),
      seoTitle: 'Request a demo — Mosaic',
      seoDescription: 'See how Mosaic brings your docs, projects, and agents together. Tell us about your team and we’ll set up a tailored walkthrough.',
    },
    {
      name: 'Customers',
      kind: 'singleton' as const,
      slug: 'customers',
      tree: customersTree(),
      seoTitle: 'Customers — Mosaic',
      seoDescription: 'From three-person startups to the Fortune 100 — see how teams bring their work together and move faster on Mosaic.',
    },
    {
      name: 'Customer Story',
      kind: 'collection' as const,
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: storyTemplate(),
    },
  ],

  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to {{site.name}} ✨',
      preheader: 'Your AI workspace is ready — three quick ways to get started.',
      tree: welcomeEmail(),
    },
    {
      name: 'Product Tips',
      subject: 'New in {{site.name}} this month 🚀',
      preheader: 'Custom Agents, Enterprise Search, and AI Meeting Notes — what’s new.',
      tree: productTipsEmail(),
    },
  ],
};
