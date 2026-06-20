// Forge — blueprint payload ENTRY (GENERATED, docs/85). THIN: it imports each
// heavy section from ./parts/* and default-exports the assembled manifest. The
// ingest dynamic-imports this file; ESM resolves the parts. Edit a scoped file under
// ./parts/, or the gen source, then re-run the generator.

import assets from './parts/assets';
import content from './parts/content';
import layoutTree from './parts/layout';
import page_home from './parts/pages/home';
import page_work from './parts/pages/work';
import page_services from './parts/pages/services';
import page_about from './parts/pages/about';
import page_insights from './parts/pages/insights';
import page_careers from './parts/pages/careers';
import page_contact from './parts/pages/contact';
import page_insight_story from './parts/pages/insight-story';
import email_welcome from './parts/emails/welcome';
import email_studio_notes from './parts/emails/studio-notes';

export default {
  key: 'forge',
  version: '1.0.0',
  name: 'Forge',
  summary:
    'A bold, dark, award-style marketing site for a creative / brand & web studio — a warm near-black canvas with an acid-green accent, a recreated case-study showcase, a scrolling client + awards marquee, a 2-up work gallery, a 4-up stat band, numbered services, a process timeline, and testimonials, plus Work, Services, About, Insights, Careers, a Contact form, seeded insight articles, and brand-voiced emails. A ready-to-edit services starter.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],
  brand: {
    businessName: 'Forge',
    tagline: 'Impactful brands & websites. Engineered growth.',
    colors: {
      primary: '#C6F24E',
      primaryForeground: '#15120D',
      accent: '#FF6A3D',
      secondary: '#ECE7DD',
    },
    fonts: {
      heading: 'Space Grotesk',
      body: 'Sora',
    },
    logoLightAssetId: 'brand-logo',
    faviconAssetId: 'brand-favicon',
    socials: [
      {
        platform: 'instagram',
        url: 'https://instagram.com/forge.studio',
      },
      {
        platform: 'x',
        url: 'https://x.com/forgestudio',
      },
      {
        platform: 'linkedin',
        url: 'https://linkedin.com/company/forgestudio',
      },
    ],
  },
  theme: {
    name: 'Forge',
    basePresetKey: 'apex',
    presentation: {
      v: 2,
      containerWidth: '1280px',
      light: {
        base100: '#1A1611',
        base200: '#121009',
        base300: '#2B2620',
        baseContent: '#C9C3B6',
        neutral: '#ECE7DD',
        neutralContent: '#15120D',
        border: '#2B2620',
      },
    },
    brand: {
      colorPrimary: '#C6F24E',
      colorPrimaryForeground: '#15120D',
      colorAccent: '#FF6A3D',
      colorSecondary: '#ECE7DD',
      fontHeading: 'Space Grotesk',
      fontBody: 'Sora',
      tokens: {
        shape: {
          radiusSelector: '0.75rem',
          radiusField: '0.75rem',
          radiusBox: '1.5rem',
        },
      },
    },
    apply: true,
  },
  assets: assets,
  content: content,
  layout: {
    name: 'Forge layout',
    tree: layoutTree,
    makeActive: true,
  },
  pages: [
    {
      name: 'Home',
      kind: 'singleton',
      tree: page_home,
      seoTitle: 'Forge — Impactful brands & websites. Engineered growth.',
      seoDescription:
        'An award-winning studio for brand, web, and growth — trusted by ambitious startups and category leaders to unlock their next era of growth.',
    },
    {
      name: 'Work',
      kind: 'singleton',
      slug: 'work',
      tree: page_work,
      seoTitle: 'Work — Forge',
      seoDescription:
        'A decade of brands and digital products, shaped end-to-end — from positioning and identity to high-converting websites and launch.',
    },
    {
      name: 'Services',
      kind: 'singleton',
      slug: 'services',
      tree: page_services,
      seoTitle: 'Services — Forge',
      seoDescription:
        'Brand & identity, web design & development, growth marketing, and motion & 3D — a full-service studio built around disciplines that compound.',
    },
    {
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: page_about,
      seoTitle: 'About — Forge',
      seoDescription:
        'A small senior studio that ships like a big one. Since 2014 we’ve helped ambitious teams look and perform like the company they’re becoming.',
    },
    {
      name: 'Insights',
      kind: 'singleton',
      slug: 'insights',
      tree: page_insights,
      seoTitle: 'Insights — Forge',
      seoDescription:
        'Field notes from the studio on building brands and products that compound — brand, web, and growth.',
    },
    {
      name: 'Careers',
      kind: 'singleton',
      slug: 'careers',
      tree: page_careers,
      seoTitle: 'Careers — Forge',
      seoDescription:
        'Build with us. A small senior team that ships work it’s proud of — see our open roles.',
    },
    {
      name: 'Contact',
      kind: 'singleton',
      slug: 'contact',
      tree: page_contact,
      seoTitle: 'Contact — Forge',
      seoDescription:
        'Tell us about your project and what success looks like. We reply within one business day.',
    },
    {
      name: 'Insight Story',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: page_insight_story,
    },
  ],
  emails: [
    {
      name: 'Welcome',
      subject: 'Thanks for reaching out to {{site.name}} 👋',
      preheader: 'We got your note — here’s what happens next.',
      tree: email_welcome,
    },
    {
      name: 'Studio Notes',
      subject: 'Studio Notes from {{site.name}} ✦',
      preheader: 'New work, new thinking — a short note from the studio.',
      tree: email_studio_notes,
    },
  ],
};
