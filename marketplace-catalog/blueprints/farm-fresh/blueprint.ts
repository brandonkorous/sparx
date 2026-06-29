// Farm Fresh — blueprint payload ENTRY (GENERATED, docs/85). THIN: it imports
// each heavy section from ./parts/* and default-exports the assembled manifest. The
// ingest dynamic-imports this file; ESM resolves the parts. Edit a scoped file under
// ./parts/, or the gen source, then re-run the generator.

import assets from './parts/assets';
import layoutTree from './parts/layout';
import page_home from './parts/pages/home';
import page_menu from './parts/pages/menu';
import page_story from './parts/pages/story';
import page_locations from './parts/pages/locations';
import page_catering from './parts/pages/catering';
import page_contact from './parts/pages/contact';
import page_journal from './parts/pages/journal';
import page_product from './parts/pages/product';
import page_blog_post from './parts/pages/blog-post';
import email_welcome from './parts/emails/welcome';
import email_seasonal_newsletter from './parts/emails/seasonal-newsletter';

export default {
  key: 'farm-fresh',
  version: '1.1.0',
  name: 'Farm Fresh',
  summary:
    'A warm, organic storefront for a fresh-food brand — açaí bowls, smoothies and salads with a full menu, a brand story, locations, catering, and a welcome email. A ready-to-edit retail starter.',
  vertical: 'retail',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],
  brand: {
    businessName: 'Farm Fresh',
    tagline: 'Here to deliver health.',
    colors: {
      primary: '#5C7A3D',
      primaryForeground: '#FBF8F1',
      accent: '#C8324B',
      secondary: '#F2A93B',
    },
    fonts: {
      heading: 'Quicksand',
      body: 'Nunito',
    },
    logoLightAssetId: 'brand-logo',
    faviconAssetId: 'brand-favicon',
    socials: [
      {
        platform: 'instagram',
        url: 'https://instagram.com/farmfreshbowls',
      },
      {
        platform: 'facebook',
        url: 'https://facebook.com/farmfreshbowls',
      },
      {
        platform: 'x',
        url: 'https://x.com/farmfreshbowls',
      },
      {
        platform: 'tiktok',
        url: 'https://tiktok.com/@farmfreshbowls',
      },
    ],
  },
  theme: {
    name: 'Farm Fresh',
    basePresetKey: 'market',
    presentation: {
      v: 2,
      containerWidth: '1180px',
      light: {
        base100: '#FBF8F1',
        base200: '#E8EEDF',
        base300: '#F3ECDE',
        baseContent: '#54513F',
        neutral: '#2E3424',
        neutralContent: '#FBF8F1',
        border: '#E7E0D0',
      },
    },
    brand: {
      colorPrimary: '#5C7A3D',
      colorPrimaryForeground: '#FBF8F1',
      colorAccent: '#C8324B',
      colorSecondary: '#F2A93B',
      fontHeading: 'Quicksand',
      fontBody: 'Nunito',
      tokens: {
        shape: {
          radiusSelector: '9999px',
          radiusField: '9999px',
          radiusBox: '1.75rem',
        },
      },
    },
    apply: true,
  },
  assets: assets,
  layout: {
    name: 'Farm Fresh layout',
    tree: layoutTree,
    makeActive: true,
  },
  pages: [
    {
      name: 'Home',
      kind: 'singleton',
      tree: page_home,
      seoTitle: 'Farm Fresh — Here to deliver health',
      seoDescription:
        'Balanced, nutritious bowls made with local ingredients — açaí bowls, smoothies and salads.',
    },
    {
      name: 'Menu',
      kind: 'singleton',
      slug: 'menu',
      tree: page_menu,
      seoTitle: 'Menu — Farm Fresh',
      seoDescription:
        'Order açaí bowls, cold-pressed smoothies, and grain bowls for pickup or free local delivery.',
    },
    {
      name: 'Our Story',
      kind: 'singleton',
      slug: 'story',
      tree: page_story,
      seoTitle: 'Our Story — Farm Fresh',
      seoDescription:
        'How Farm Fresh started — one counter, a blender, and three farms we could drive to. The people and produce behind every bowl.',
    },
    {
      name: 'Locations',
      kind: 'singleton',
      slug: 'locations',
      tree: page_locations,
      seoTitle: 'Locations — Farm Fresh',
      seoDescription:
        'Find Farm Fresh in Riverside — two neighborhood counters with pickup and free local delivery. Addresses, hours, and directions.',
    },
    {
      name: 'Catering',
      kind: 'singleton',
      slug: 'catering',
      tree: page_catering,
      seoTitle: 'Catering & Events — Farm Fresh',
      seoDescription:
        'Bowl bars, smoothie stations and grain platters for offices, weddings and team workouts — built fresh and delivered on time.',
    },
    {
      name: 'Contact',
      kind: 'singleton',
      slug: 'contact',
      tree: page_contact,
      seoTitle: 'Contact — Farm Fresh',
      seoDescription:
        'Get in touch with Farm Fresh — email, call, catering requests, store hours, and directions to both Riverside counters.',
    },
    {
      name: 'Journal',
      kind: 'singleton',
      slug: 'journal',
      tree: page_journal,
      seoTitle: 'The Journal — Farm Fresh',
      seoDescription:
        'Notes from the counter — how we source within 60 miles, what’s in season, and the people behind the bowls.',
    },
    {
      name: 'Product',
      kind: 'collection',
      recordType: 'commerce.product',
      isDefault: true,
      tree: page_product,
    },
    {
      name: 'Blog Post',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: page_blog_post,
    },
  ],
  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to {{site.name}} 🌱',
      preheader: 'You’re on the list — seasonal menus, new flavors, and the occasional treat.',
      tree: email_welcome,
    },
    {
      name: 'Seasonal Newsletter',
      subject: 'Fresh this week at {{site.name}}',
      preheader: 'What’s in season at the counter — bowls, smoothies and grain bowls.',
      tree: email_seasonal_newsletter,
    },
  ],
};
