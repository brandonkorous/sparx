// Farm Fresh — blueprint payload ENTRY (GENERATED, docs/85). THIN: it imports
// each heavy section from ./parts/* and default-exports the assembled manifest. The
// ingest dynamic-imports this file; ESM resolves the parts. Edit a scoped file under
// ./parts/, or the gen source, then re-run the generator.

import assets from './parts/assets';
import content from './parts/content';
import commerce from './parts/commerce';
import layoutTree from './parts/layout';
import page_home from './parts/pages/home';
import page_menu from './parts/pages/menu';
import page_story from './parts/pages/story';
import page_locations from './parts/pages/locations';
import page_catering from './parts/pages/catering';
import page_product from './parts/pages/product';
import page_blog_post from './parts/pages/blog-post';
import email_welcome from './parts/emails/welcome';

export default {
  key: 'farm-fresh-bowls',
  version: '1.0.16',
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
  content: content,
  commerce: commerce,
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
    },
    {
      name: 'Locations',
      kind: 'singleton',
      slug: 'locations',
      tree: page_locations,
      seoTitle: 'Locations — Farm Fresh',
    },
    {
      name: 'Catering',
      kind: 'singleton',
      slug: 'catering',
      tree: page_catering,
      seoTitle: 'Catering & Events — Farm Fresh',
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
      subject: 'Welcome to Farm Fresh',
      preheader: 'Fresh menus, new flavors, and the occasional treat.',
      tree: email_welcome,
    },
  ],
};
