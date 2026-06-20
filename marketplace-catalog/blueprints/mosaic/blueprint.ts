// Mosaic — blueprint payload ENTRY (GENERATED, docs/85). THIN: it imports each
// heavy section from ./parts/* and default-exports the assembled manifest. The
// ingest dynamic-imports this file; ESM resolves the parts. Edit a scoped file under
// ./parts/, or the gen source, then re-run the generator.

import assets from './parts/assets';
import content from './parts/content';
import layoutTree from './parts/layout';
import page_home from './parts/pages/home';
import page_pricing from './parts/pages/pricing';
import page_enterprise from './parts/pages/enterprise';
import page_request_demo from './parts/pages/request-demo';
import page_customers from './parts/pages/customers';
import page_customer_story from './parts/pages/customer-story';
import email_welcome from './parts/emails/welcome';
import email_product_tips from './parts/emails/product-tips';

export default {
  key: 'mosaic',
  version: '1.0.0',
  name: 'Mosaic',
  summary:
    'A clean, modern marketing site for an AI-workspace / productivity SaaS — a bento-driven home page with a browser-chrome product preview, a scrolling logo wall, agent and assistant showcases, social proof and stats, plus Pricing, Enterprise, a Request-a-demo page, customer stories, and brand-voiced emails. A ready-to-edit services starter.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],
  brand: {
    businessName: 'Mosaic',
    tagline: 'The AI workspace that works for you.',
    colors: {
      primary: '#2383E2',
      primaryForeground: '#FFFFFF',
      accent: '#1F9E8F',
      secondary: '#FFC93C',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
    logoLightAssetId: 'brand-logo',
    faviconAssetId: 'brand-favicon',
    socials: [
      {
        platform: 'x',
        url: 'https://x.com/mosaicworkspace',
      },
      {
        platform: 'linkedin',
        url: 'https://linkedin.com/company/mosaicworkspace',
      },
      {
        platform: 'youtube',
        url: 'https://youtube.com/@mosaicworkspace',
      },
    ],
  },
  theme: {
    name: 'Mosaic',
    basePresetKey: 'apex',
    presentation: {
      v: 2,
      containerWidth: '1024px',
      light: {
        base100: '#FFFFFF',
        base200: '#F6F5F3',
        base300: '#EDEBE7',
        baseContent: '#37352F',
        neutral: '#191918',
        neutralContent: '#FFFFFF',
        border: '#EAE9E5',
      },
    },
    brand: {
      colorPrimary: '#2383E2',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#1F9E8F',
      colorSecondary: '#FFC93C',
      fontHeading: 'Inter',
      fontBody: 'Inter',
      tokens: {
        shape: {
          radiusSelector: '0.5rem',
          radiusField: '0.5rem',
          radiusBox: '1rem',
        },
      },
    },
    apply: true,
  },
  assets: assets,
  content: content,
  layout: {
    name: 'Mosaic layout',
    tree: layoutTree,
    makeActive: true,
  },
  pages: [
    {
      name: 'Home',
      kind: 'singleton',
      tree: page_home,
      seoTitle: 'Mosaic — The AI workspace that works for you',
      seoDescription:
        'Capture context, find answers, and automate tasks with AI built for your team. Docs, projects, and a knowledge base your team and agents share.',
    },
    {
      name: 'Pricing',
      kind: 'singleton',
      slug: 'pricing',
      tree: page_pricing,
      seoTitle: 'Pricing — Mosaic',
      seoDescription:
        'Start free and upgrade when you need more. Simple, transparent pricing that scales with your team.',
    },
    {
      name: 'Enterprise',
      kind: 'singleton',
      slug: 'enterprise',
      tree: page_enterprise,
      seoTitle: 'Enterprise — Mosaic',
      seoDescription:
        'The security, control, and scale that IT and security teams require — SSO, SCIM, audit logs, and a 99.9% uptime SLA — with adoption your whole company will love.',
    },
    {
      name: 'Request a demo',
      kind: 'singleton',
      slug: 'request-demo',
      tree: page_request_demo,
      seoTitle: 'Request a demo — Mosaic',
      seoDescription:
        'See how Mosaic brings your docs, projects, and agents together. Tell us about your team and we’ll set up a tailored walkthrough.',
    },
    {
      name: 'Customers',
      kind: 'singleton',
      slug: 'customers',
      tree: page_customers,
      seoTitle: 'Customers — Mosaic',
      seoDescription:
        'From three-person startups to the Fortune 100 — see how teams bring their work together and move faster on Mosaic.',
    },
    {
      name: 'Customer Story',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: page_customer_story,
    },
  ],
  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to {{site.name}} ✨',
      preheader: 'Your AI workspace is ready — three quick ways to get started.',
      tree: email_welcome,
    },
    {
      name: 'Product Tips',
      subject: 'New in {{site.name}} this month 🚀',
      preheader: 'Custom Agents, Enterprise Search, and AI Meeting Notes — what’s new.',
      tree: email_product_tips,
    },
  ],
};
