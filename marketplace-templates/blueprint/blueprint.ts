// blueprint.ts — the payload for a BLUEPRINT submission.
//
// A blueprint is a DECLARATIVE manifest that provisions a whole themed site: brand
// + theme, content, optional commerce catalog, a site layout, pages, and emails.
// It is DATA — the installer replays it through the platform's own services and
// resolves every handle/ref to a real id. No submitter code executes.
//
// Rules of thumb:
//   • Reference by HANDLE, never by id (the manifest can't know runtime UUIDs).
//   • Trees are real builder nodes built with the allow-listed `node()` helper and
//     bind via tokens, so they re-theme to the installing tenant.
//   • Static tree images hot-link an absolute https URL (box.backgroundImage);
//     record-bound images come from `assets`.
//   • Everything installs to DRAFT — the tenant reviews, then publishes/goes live.

import { seedNode, type BuilderNode } from '@sparx/builder-schemas';

let n = 0;
const node = (type: string, opts: Parameters<typeof seedNode>[2] = {}): BuilderNode =>
  seedNode(`ss-${(n += 1)}`, type, opts);

const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

const pageTemplate = (): BuilderNode =>
  node('Section', {
    box: { name: 'Page', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { name: 'Header', height: 'sm', surface: 'subtle', padding: 'xl', align: 'center' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [node('Heading', { props: { level: 'h1' }, bind: 'page.title' })],
      }),
      node('Section', {
        box: { name: 'Body', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [node('Text', { props: { variant: 'body' }, bind: 'page.body' })],
      }),
    ],
  });

const homeTree = (): BuilderNode =>
  node('Section', {
    box: {
      name: 'Hero',
      height: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
      padding: 'xl',
      backgroundImage: 'https://picsum.photos/seed/studio-hero/2000/1100',
      overlay: 'dark',
      textTone: 'light',
    },
    layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Design that works as hard as you do' } }),
      node('Text', { props: { variant: 'body', text: 'A small studio for big ideas.' } }),
      node('Button', { props: { label: 'Get in touch', style: 'primary', href: '/contact' } }),
    ],
  });

const layoutTree = (): BuilderNode =>
  node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { name: 'Header', padding: 'md', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'row', justify: 'between', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h3', text: 'Studio' } }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      node('Section', {
        box: { name: 'Footer', surface: 'muted', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
        children: [node('Text', { props: { variant: 'meta', text: '© Studio' } })],
      }),
    ],
  });

const welcomeEmail = (): BuilderNode =>
  node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Thanks for reaching out' } }),
      node('Text', {
        props: { variant: 'body', text: 'We’ll be in touch within one business day.' },
      }),
    ],
  });

const manifest = {
  key: 'studio-starter',
  version: '1.0.0',
  name: 'Studio Starter',
  summary:
    'A clean three-page site for a small studio or service business — home, about, and contact — themed and ready to review.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],

  brand: {
    businessName: 'Studio',
    tagline: 'Design that works as hard as you do.',
    colors: { primary: '#111827', primaryForeground: '#ffffff', accent: '#6366f1' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
  },

  // The theme this blueprint ships: an overlay on a neutral base preset (data).
  theme: {
    name: 'Studio',
    basePresetKey: 'apex',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#111827',
      colorAccent: '#6366f1',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      tokens: { radiusBase: '10px' },
    },
    apply: true,
  },

  contentTypes: [],
  content: [
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About the studio',
        excerpt: 'Who we are and how we work.',
        body: doc(
          'We’re a small studio that partners with founders to design and build clear, fast products.',
          'No fluff, no jargon — just thoughtful work and a tight feedback loop.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact us',
        excerpt: 'Start a conversation.',
        body: doc('Email hello@studio.example and we’ll reply within a business day.'),
      },
    },
  ],

  layout: { name: 'Studio layout', tree: layoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Studio' },
    {
      name: 'Page',
      kind: 'collection',
      recordType: 'cms.page',
      isDefault: true,
      tree: pageTemplate(),
    },
  ],

  emails: [{ name: 'Welcome', subject: 'Thanks for reaching out', tree: welcomeEmail() }],
};

export default manifest;
