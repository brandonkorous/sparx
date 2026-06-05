import type { Metadata } from 'next';
import {
  DocArticle,
  DocSection,
  DocSubsection,
  Callout,
  Steps,
  Step,
  DocTable,
  DocImage,
  InlineCode,
  DocLink,
} from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';

export const metadata: Metadata = {
  title: 'Building a template',
  description:
    'How to build a Sparx template (blueprint) end-to-end — a one-click, fully themed site you design in the Builder, capture as a declarative manifest, register, and test.',
  alternates: { canonical: '/docs/guides/building-a-template' },
};

/* ─── code samples (kept as consts so the JSX below stays readable) ─── */

const FILE_TREE = `packages/blueprints/
  src/
    blueprints/
      retail-store-blog.ts     ← the manifest (one file per template)
      <your-template>.ts       ← your new template goes here
    registry.ts                ← register it here (one line)
    manifest.ts                ← the schema every template is validated against
    refs.ts                    ← the $asset helper for images inside content`;

const MANIFEST_SKELETON = `const manifest = {
  key: 'retail-store-blog',          // stable id, lowercase-with-hyphens
  version: '0.1.0',                  // semver
  name: 'Retail Store + Blog',       // shown on the card
  summary: 'A clean DTC storefront with a small catalog and a journal…',
  vertical: 'retail',                // retail | b2b | content | services
  preview: '/blueprint-previews/retail-store-blog.png',
  requiresModules: ['builder', 'commerce', 'cms', 'email'],

  brand:    { /* identity: name, colors, fonts, logo */ },
  theme:    { /* the named theme this template ships */ },
  assets:   [ /* every image, declared once and referenced by id */ ],

  contentTypes: [],                  // custom content types (usually none)
  content:  [ /* blog posts, pages */ ],

  commerce: { categories, collections, products },

  components: [ /* reusable tenant components (optional) */ ],
  layout:   { /* site chrome: header · Outlet · footer */ },
  pages:    [ /* home, blog index, and templates for each record type */ ],
  emails:   [ /* welcome, newsletter, … */ ],
};

export const retailStoreBlog: Blueprint = parseBlueprint(manifest);`;

const BRAND_CODE = `brand: {
  businessName: 'Driftwood Supply Co.',
  tagline: 'Everyday goods, built to last.',
  colors: {
    primary: '#3F6212',
    primaryForeground: '#FFFFFF',
    accent: '#B45309',
    secondary: '#1C1917',
  },
  fonts: { heading: 'Fraunces', body: 'Inter' },
  logoLightAssetId: 'logo',          // an id from \`assets\`
},`;

const THEME_CODE = `theme: {
  name: 'Driftwood',
  basePresetKey: 'market',           // see "Theme presets" below
  presentation: { v: 2, containerWidth: '1200px' },
  brand: {
    colorPrimary: '#3F6212',
    colorPrimaryForeground: '#FFFFFF',
    colorAccent: '#B45309',
    fontHeading: 'Fraunces',
    fontBody: 'Inter',
    tokens: { radiusBase: '8px' },
  },
  apply: true,                       // make it the working theme on install
},`;

const ASSETS_CODE = `assets: [
  { id: 'logo',      url: 'https://…/logo.png',  alt: 'Driftwood Supply Co.' },
  { id: 'tee-front', url: 'https://…/tee.jpg',   alt: 'Classic tee, front' },
  { id: 'blog-1-img',url: 'https://…/work.jpg',  alt: 'Raw materials on a workbench' },
],`;

const CONTENT_CODE = `content: [
  {
    typeKey: 'blog_post',
    slug: 'made-to-last',
    body: {
      title: 'Made to last',
      excerpt: 'Why we obsess over materials — and what "durable" really means.',
      body: doc(
        'Durability is a series of small decisions: the weight of a fabric…',
        'We start every product from the material up…'
      ),
      featuredImage: assetRef('blog-1-img'),   // image inside a content body
    },
  },
  {
    typeKey: 'page',
    slug: 'about',
    body: {
      title: 'About Driftwood',
      excerpt: 'A small shop for well-made everyday goods.',
      body: doc('Driftwood Supply Co. started with a simple idea…'),
    },
  },
],`;

const COMMERCE_CODE = `commerce: {
  categories: [
    { handle: 'apparel', name: 'Apparel', position: 0, featured: true },
    { handle: 'tops', name: 'Tops & Tees', parentHandle: 'apparel', heroAssetId: 'cat-tops-hero' },
  ],
  collections: [
    { handle: 'featured', name: 'Featured', type: 'manual', featured: true,
      productHandles: ['classic-tee', 'denim-jacket', 'wool-beanie'] },
  ],
  products: [ /* see below */ ],
},`;

const PRODUCT_CODE = `{
  handle: 'classic-tee',
  title: 'Classic Tee',
  description: '<p>A midweight everyday tee in soft combed cotton.</p>', // HTML allowed
  productType: 'Apparel',
  vendor: 'Driftwood',
  tags: ['tee', 'staple'],
  categoryHandles: ['tops'],
  collectionHandles: ['featured'],
  options: [
    { name: 'Color', displayType: 'swatch', position: 0, values: [
      { value: 'Black', swatchHex: '#1C1917', position: 0 },
      { value: 'White', swatchHex: '#FFFFFF', position: 1 },
    ]},
    { name: 'Size', displayType: 'segmented', position: 1, values: [
      { value: 'S', position: 0 }, { value: 'M', position: 1 },
    ]},
  ],
  variants: [
    { sku: 'TEE-BLK-S', optionValues: { Color: 'Black', Size: 'S' }, priceCents: 2400, isDefault: true },
    { sku: 'TEE-BLK-M', optionValues: { Color: 'Black', Size: 'M' }, priceCents: 2400 },
    { sku: 'TEE-WHT-S', optionValues: { Color: 'White', Size: 'S' }, priceCents: 2400 },
    { sku: 'TEE-WHT-M', optionValues: { Color: 'White', Size: 'M' }, priceCents: 2400 },
  ],
  images: [
    { assetId: 'tee-front', isPrimary: true, position: 0 },
    { assetId: 'tee-black', optionValues: { Color: 'Black' }, position: 1 }, // shows when Color=Black
    { assetId: 'tee-white', optionValues: { Color: 'White' }, position: 2 },
  ],
},`;

const SIMPLE_PRODUCT_CODE = `{
  handle: 'wool-beanie',
  title: 'Wool Beanie',
  description: '<p>A warm ribbed beanie in a soft merino blend.</p>',
  categoryHandles: ['accessories'],
  variants: [{ sku: 'BEANIE-CHR', priceCents: 2800, isDefault: true }],
  images: [{ assetId: 'beanie-img', isPrimary: true }],
},`;

const NODE_SHAPE = `{
  id,                  // unique within the tree
  type,                // what it IS: 'Section', 'Heading', 'ImageDisplay', …
  box,                 // the universal spine: spacing, surface, width, background
  layout?,             // containers only: direction, columns, gap, alignment
  props,               // component-specific: heading level, button label, …
  binding?,            // bind to data (a field, or an array to iterate)
  children?,           // for containers
}`;

const NODE_HELPER = `node('Heading', { props: { level: 'h1', text: 'Everyday goods, built to last' } })

node('Section', {
  box: { surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
  layout: { direction: 'stack', gap: 'md' },
  children: [ /* … */ ],
})`;

const HERO_CODE = `node('Section', {
  box: {
    name: 'Hero', height: 'lg', backgroundWidth: 'full', contentWidth: 'contained',
    align: 'center', padding: 'xl',
    backgroundImage: 'https://…/hero.jpg', overlay: 'dark', textTone: 'light',
  },
  layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
  children: [
    node('Heading', { props: { level: 'h1', text: 'Everyday goods, built to last' } }),
    node('Text', { props: { variant: 'body', text: 'Considered staples for home and wardrobe.' } }),
    node('Button', { props: { label: 'Shop the collection', style: 'primary', href: '/collections/featured' } }),
  ],
}),`;

const BINDING_CODE = `node('Grid', {
  layout: { direction: 'grid', columns: 3, gap: 'lg' },
  bind: 'commerce.product',                    // ← iterate over products
  children: [
    node('Card', {
      layout: { direction: 'stack', gap: 'sm' },
      children: [
        node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
        node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
        node('PriceTag', { bind: 'item.price' }),
        node('Button', { props: { label: 'View', style: 'soft' } }),
      ],
    }),
  ],
}),`;

const LAYOUT_CODE = `node('Section', {                                  // root
  layout: { direction: 'stack', gap: 'none' },
  children: [
    node('Section', {                              // header
      layout: { direction: 'row', justify: 'between', alignItems: 'center' },
      children: [
        node('Logo', { bind: 'site.identity' }),
        node('NavMenu', { props: { orientation: 'row' }, bind: 'site.primaryNav' }),
      ],
    }),
    node('Outlet'),                                // ← the page renders here
    node('Section', {                              // footer
      children: [
        node('NavMenu', { props: { orientation: 'row' }, bind: 'site.footerNav' }),
        node('SocialLinks', { bind: 'site.social' }),
        node('Text', { props: { variant: 'meta', text: '© Your Shop' } }),
      ],
    }),
  ],
})`;

const PAGES_CODE = `pages: [
  // The HOME page = a singleton with NO slug. It serves at "/".
  { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Driftwood Supply Co.' },

  // Another singleton at a fixed route.
  { name: 'Journal', kind: 'singleton', slug: 'blog', tree: blogIndexTree() },

  // Collection pages = the template for every record of a type.
  { name: 'Blog post',    kind: 'collection', recordType: 'cms.blog_post',    isDefault: true, tree: blogPostTree() },
  { name: 'Product page', kind: 'collection', recordType: 'commerce.product', isDefault: true, tree: productTree() },
  { name: 'Page',         kind: 'collection', recordType: 'cms.page',         isDefault: true, tree: pageTemplateTree() },
],`;

const EMAILS_CODE = `emails: [
  {
    name: 'Welcome',
    subject: 'Welcome to Driftwood 👋',
    preheader: "You're in — here's what we're about.",
    tree: node('Section', {
      layout: { direction: 'stack', gap: 'md' },
      children: [
        node('Heading', { props: { level: 'h1', text: 'Welcome to Driftwood 👋' } }),
        node('Text', { props: { variant: 'body', text: "Thanks for joining…" } }),
        node('Button', { props: { label: 'Shop new arrivals', href: '' } }),
      ],
    }),
  },
],`;

const COMPONENT_CODE = `// In components:
{
  key: 'promo_banner', name: 'Promo banner', group: 'content', icon: 'megaphone',
  surfaces: ['page'],
  tree: node('Section', {
    box: { surface: 'inverse', padding: 'xl', align: 'center' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'center' },
    children: [
      node('Heading', { props: { level: 'h2', text: { $prop: 'heading' } } }),
      node('Button', { props: { label: { $prop: 'buttonLabel' }, href: { $prop: 'buttonHref' } } }),
    ],
  }),
  propSpec: [
    { key: 'heading', label: 'Heading', kind: 'text', default: 'Big news' },
    { key: 'buttonLabel', label: 'Button label', kind: 'text', default: 'Learn more' },
    { key: 'buttonHref', label: 'Button link', kind: 'url' },
  ],
}

// On a page (note customType + the version pin):
node(customType('promo_banner'), {
  props: { $ref: { version: 1 }, heading: 'Spring refresh — 20% off', buttonLabel: 'Shop the sale', buttonHref: '/collections/featured' },
}),`;

const REGISTER_CODE = `// packages/blueprints/src/registry.ts
import { retailStoreBlog } from './blueprints/retail-store-blog';
import { yourTemplate }    from './blueprints/your-template';   // ← add

export const BLUEPRINTS = {
  [retailStoreBlog.key]: retailStoreBlog,
  [yourTemplate.key]:    yourTemplate,                          // ← add
};`;

export default function BuildingATemplatePage() {
  return (
    <DocArticle
      breadcrumb={[
        { label: 'Docs', href: '/docs' },
        { label: 'Guides' },
        { label: 'Building a template' },
      ]}
      title="Building a template"
      lede="A template is a one-click starting point for a whole site. This guide walks through building one end-to-end — you design it visually in the Builder, capture what you built as a declarative manifest, register it, and test the install."
      meta={
        <>
          <span>Updated 2026-06-05</span>
          <span>20 min read</span>
        </>
      }
      toc={[
        { id: 'what', label: 'What a template is' },
        { id: 'approach', label: 'The big idea' },
        { id: 'location', label: 'Where a template lives' },
        { id: 'manifest', label: 'Anatomy of a manifest' },
        { id: 'trees', label: 'Authoring trees' },
        { id: 'preview', label: 'Preview image' },
        { id: 'register', label: 'Register it' },
        { id: 'test', label: 'Test it' },
        { id: 'gotchas', label: 'Conventions & gotchas' },
        { id: 'reference', label: 'Quick reference' },
      ]}
      editPath="apps/web/app/docs/guides/building-a-template/page.tsx"
      updated="2026-06-05"
      prev={{ title: 'Quickstart', href: '/docs/quickstart' }}
      next={{ title: 'Create an order', href: '/docs/api/orders/create' }}
    >
      <DocSection id="what" title="What a template is">
        <p>
          A <strong>template</strong> is a one-click starting point for a whole site. When someone
          installs one, Sparx provisions a complete, themed property for them in seconds:
        </p>
        <ul>
          <li>
            a <strong>brand</strong> (name, colors, fonts, logo) and a matching{' '}
            <strong>theme</strong>,
          </li>
          <li>
            a <strong>site layout</strong> (header, footer, navigation),
          </li>
          <li>
            <strong>pages</strong> (home, about, contact, blog index, product/article templates),
          </li>
          <li>
            a <strong>catalog</strong> (categories, collections, products with options + variants +
            images),
          </li>
          <li>
            <strong>content</strong> (blog posts, pages),
          </li>
          <li>
            <strong>emails</strong> (welcome, newsletter), and
          </li>
          <li>
            optional reusable <strong>components</strong>.
          </li>
        </ul>
        <p>
          Everything installs as <strong>drafts</strong>. The owner reviews it, customizes anything
          they like, then takes it live. Nothing is published until they say so.
        </p>
        <Callout type="note" title="Templates in the UI, “Blueprint” in the code">
          In the dashboard the feature is called <strong>Templates</strong>. In the code it’s called
          a <strong>Blueprint</strong> — because “template” is already used for page templates,
          email templates, and content templates. Same thing; “blueprint” just keeps the code
          unambiguous.
        </Callout>
        <p>
          Here’s what one looks like after install and go-live — the flagship{' '}
          <strong>Retail Store + Blog</strong> template (“Driftwood Supply Co.”):
        </p>
        <DocImage
          src="/docs/installed-retail-store-blog.png"
          alt="The installed Driftwood Supply Co. home page — a full-bleed hero, featured products, and a journal section"
          caption="The Retail Store + Blog template after install and go-live."
        />
      </DocSection>

      <DocSection id="approach" title="The big idea: design it visually, then capture it">
        <p>
          You don’t hand-write a website from a blank file. The fastest, most reliable way to build
          a template is to design it in the Builder, then capture the result:
        </p>
        <Steps>
          <Step n={1} title="Design it in the Builder">
            <p>
              Build it like any normal site — drag sections, set the brand and theme, add a few
              products and posts. Use a throwaway tenant/property as your scratchpad.
            </p>
          </Step>
          <Step n={2} title="Capture what you built">
            <p>
              The page/layout/email{' '}
              <strong>trees are the exact JSON the visual editor produces</strong>, so you copy them
              straight into the template. The brand, theme, and catalog are described the same way
              you set them up.
            </p>
          </Step>
          <Step n={3} title="Assemble the pieces">
            <p>
              Collect those pieces into one <strong>manifest</strong> file.
            </p>
          </Step>
          <Step n={4} title="Register it">
            <p>
              Add one line so it shows up on the <InlineCode>/templates</InlineCode> page.
            </p>
          </Step>
          <Step n={5} title="Test it">
            <p>Install onto a scratch property and go live.</p>
          </Step>
        </Steps>
        <p>The rest of this guide walks each step.</p>
      </DocSection>

      <DocSection id="location" title="Where a template lives">
        <p>Each template is one TypeScript file plus a one-line registration:</p>
        <CodeBlock tabs={[{ label: 'packages/blueprints/', code: FILE_TREE }]} />
        <p>
          The manifest is <strong>declarative data</strong> — no code runs at install time, which
          keeps the marketplace safe. It’s plain TypeScript objects validated by{' '}
          <DocLink href="https://zod.dev">Zod</DocLink>, so a typo or a bad reference fails the
          moment the file loads, not in production.
        </p>
      </DocSection>

      <DocSection id="manifest" title="Anatomy of a manifest">
        <p>
          A manifest is one big object. Here’s the skeleton with every top-level field; we’ll fill
          each in below.
        </p>
        <CodeBlock tabs={[{ label: 'your-template.ts', code: MANIFEST_SKELETON }]} />
        <p>
          <InlineCode>parseBlueprint(manifest)</InlineCode> validates the whole thing (including
          cross-references, e.g. every <InlineCode>categoryHandles</InlineCode> points at a real
          category) and applies defaults. If you got something wrong, the package won’t build —
          that’s the safety net.
        </p>

        <DocSubsection id="manifest-identity" title="Identity fields">
          <DocTable>
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Field</th>
                <th>What it is</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>key</code>
                </td>
                <td>Stable, unique id. Lowercase, hyphens. Never change it after release.</td>
              </tr>
              <tr>
                <td>
                  <code>version</code>
                </td>
                <td>Semver. Bump it when you change the template.</td>
              </tr>
              <tr>
                <td>
                  <code>name</code> / <code>summary</code>
                </td>
                <td>The title and one-paragraph pitch on the marketplace card.</td>
              </tr>
              <tr>
                <td>
                  <code>vertical</code>
                </td>
                <td>
                  One of <code>retail</code>, <code>b2b</code>, <code>content</code>,{' '}
                  <code>services</code>. Drives grouping/filtering.
                </td>
              </tr>
              <tr>
                <td>
                  <code>preview</code>
                </td>
                <td>A screenshot of the installed site (see Preview image).</td>
              </tr>
              <tr>
                <td>
                  <code>requiresModules</code>
                </td>
                <td>
                  The modules the template needs. A tenant missing one is prompted to enable it.
                  Options: <code>builder</code>, <code>commerce</code>, <code>cms</code>,{' '}
                  <code>crm</code>, <code>email</code>, <code>b2b</code>, <code>dropship</code>,{' '}
                  <code>ai</code>.
                </td>
              </tr>
            </tbody>
          </DocTable>
        </DocSubsection>

        <DocSubsection id="manifest-brand" title="Brand">
          <p>
            The brand is the tenant’s identity. Colors are <InlineCode>#RRGGBB</InlineCode>. Fonts
            are family names. The logo references an asset by id (see Assets).
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: BRAND_CODE }]} />
        </DocSubsection>

        <DocSubsection id="manifest-theme" title="Theme">
          <p>
            A template <strong>ships its own named theme</strong>. It layers a brand “look” over one
            of the built-in presets, so a single setting themes the entire stack — site <em>and</em>{' '}
            emails. Pick a <InlineCode>basePresetKey</InlineCode> whose personality fits, then
            override the brand tokens.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: THEME_CODE }]} />
          <p>
            <strong>Theme presets</strong> (<InlineCode>basePresetKey</InlineCode>):{' '}
            <InlineCode>apex</InlineCode>, <InlineCode>industrial</InlineCode>,{' '}
            <InlineCode>drift</InlineCode>, <InlineCode>market</InlineCode>,{' '}
            <InlineCode>fleet</InlineCode>, <InlineCode>drop</InlineCode>. Choose the one whose
            density/personality is closest to your design, then let the brand look recolor it.
          </p>
        </DocSubsection>

        <DocSubsection id="manifest-assets" title="Assets">
          <p>
            Every image is <strong>declared once</strong> with an absolute URL and referenced
            everywhere by its short id. Today images <strong>hot-link</strong> the URL (fast path);
            a later release copies them into tenant media.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: ASSETS_CODE }]} />
          <p>
            For placeholders while you design,{' '}
            <InlineCode>https://picsum.photos/seed/&lt;seed&gt;/&lt;w&gt;/&lt;h&gt;</InlineCode>{' '}
            gives stable, deterministic images. Swap them for the real photos before release. You
            reference an asset two ways:
          </p>
          <ul>
            <li>
              From structured fields (logo, product image, category hero, OG image): a{' '}
              <InlineCode>*AssetId</InlineCode> field, e.g.{' '}
              <InlineCode>logoLightAssetId: ‘logo’</InlineCode>.
            </li>
            <li>
              From inside a content body (a rich field that holds an image): the{' '}
              <InlineCode>assetRef()</InlineCode> helper, which produces a{' '}
              <InlineCode>{`{ $asset: 'id' }`}</InlineCode> marker (see Content).
            </li>
          </ul>
        </DocSubsection>

        <DocSubsection id="manifest-content" title="Content">
          <p>
            Most templates use the <strong>built-in</strong> content types —{' '}
            <InlineCode>page</InlineCode> and <InlineCode>blog_post</InlineCode> — so you don’t
            define any custom types (<InlineCode>contentTypes: []</InlineCode>). Each entry names
            its <InlineCode>typeKey</InlineCode>, an optional <InlineCode>slug</InlineCode>, and a{' '}
            <InlineCode>body</InlineCode> validated against that type’s schema. Entries default to{' '}
            <strong>draft</strong>.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: CONTENT_CODE }]} />
          <p>
            <InlineCode>doc(...)</InlineCode> is a tiny helper that turns plain paragraphs into the
            rich-text document the editor stores. <InlineCode>assetRef(‘blog-1-img’)</InlineCode>{' '}
            links the declared asset into the body.
          </p>
        </DocSubsection>

        <DocSubsection id="manifest-commerce" title="Commerce">
          <p>
            Three lists: <InlineCode>categories</InlineCode>, <InlineCode>collections</InlineCode>,
            and <InlineCode>products</InlineCode>. Everything links by <strong>handle</strong> (a
            stable slug), never by id — the manifest can’t know runtime ids.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: COMMERCE_CODE }]} />
          <p>
            A product with options and variants. <strong>Important ordering rule:</strong> a
            product’s <InlineCode>options</InlineCode> define the lattice (Color × Size); each{' '}
            <InlineCode>variant</InlineCode> then maps onto it via{' '}
            <InlineCode>optionValues</InlineCode>. Prices are in <strong>cents</strong>.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: PRODUCT_CODE }]} />
          <p>A simple product (no options) just needs one default variant:</p>
          <CodeBlock tabs={[{ label: 'ts', code: SIMPLE_PRODUCT_CODE }]} />
        </DocSubsection>
      </DocSection>

      <DocSection id="trees" title="Authoring trees">
        <p>
          A page, a layout, an email, and a component are all the same thing: a{' '}
          <strong>node tree</strong>. This is the heart of the work.
        </p>

        <DocSubsection id="trees-model" title="The node model">
          <p>
            Every node — whether it’s a section that arranges children or a leaf that renders
            content — has the same shape:
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: NODE_SHAPE }]} />
          <p>
            Rather than write that by hand, every manifest uses a tiny{' '}
            <InlineCode>node()</InlineCode> helper (copy it from{' '}
            <InlineCode>retail-store-blog.ts</InlineCode>). It fills in defaults so you only state
            what differs:
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: NODE_HELPER }]} />
        </DocSubsection>

        <DocSubsection id="trees-box" title="The box (every node has one)">
          <DocTable>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Axis</th>
                <th style={{ width: '38%' }}>Values</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>height</code>
                </td>
                <td>
                  <code>auto sm md lg full</code>
                </td>
                <td>Section height.</td>
              </tr>
              <tr>
                <td>
                  <code>backgroundWidth</code>
                </td>
                <td>
                  <code>full contained</code>
                </td>
                <td>Does the background span edge-to-edge or sit in the container?</td>
              </tr>
              <tr>
                <td>
                  <code>contentWidth</code>
                </td>
                <td>
                  <code>full contained</code>
                </td>
                <td>Does the content stretch or stay in the readable column?</td>
              </tr>
              <tr>
                <td>
                  <code>surface</code>
                </td>
                <td>
                  <code>none subtle muted inverse brand</code>
                </td>
                <td>A token-paired background + foreground.</td>
              </tr>
              <tr>
                <td>
                  <code>padding</code>
                </td>
                <td>
                  <code>none sm md lg xl</code>
                </td>
                <td />
              </tr>
              <tr>
                <td>
                  <code>align</code>
                </td>
                <td>
                  <code>start center end</code>
                </td>
                <td>Horizontal alignment of content.</td>
              </tr>
              <tr>
                <td>
                  <code>backgroundImage</code>
                </td>
                <td>
                  <code>URL</code>
                </td>
                <td>Full-bleed photo behind the node.</td>
              </tr>
              <tr>
                <td>
                  <code>overlay</code>
                </td>
                <td>
                  <code>none dark light gradient</code>
                </td>
                <td>A scrim over the background image so text stays legible.</td>
              </tr>
              <tr>
                <td>
                  <code>textTone</code>
                </td>
                <td>
                  <code>default light dark</code>
                </td>
                <td>Text color over a photo, independent of surface.</td>
              </tr>
              <tr>
                <td>
                  <code>pin</code>
                </td>
                <td>
                  <code>none top</code>
                </td>
                <td>
                  <code>top</code> floats a header over the hero beneath it.
                </td>
              </tr>
            </tbody>
          </DocTable>
          <p>
            A full-bleed photo hero is just a section with a background image, a dark overlay, and
            light text:
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: HERO_CODE }]} />
        </DocSubsection>

        <DocSubsection id="trees-layout" title="The layout (containers only)">
          <DocTable>
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Axis</th>
                <th>Values</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>direction</code>
                </td>
                <td>
                  <code>stack</code> (vertical) · <code>row</code> (horizontal) · <code>grid</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>columns</code>
                </td>
                <td>
                  <code>1</code>–<code>12</code> (grid only)
                </td>
              </tr>
              <tr>
                <td>
                  <code>gap</code>
                </td>
                <td>
                  <code>none sm md lg</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>justify</code>
                </td>
                <td>
                  <code>start center end between</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>alignItems</code>
                </td>
                <td>
                  <code>start center end stretch</code>
                </td>
              </tr>
            </tbody>
          </DocTable>
        </DocSubsection>

        <DocSubsection id="trees-types" title="Node types you’ll use">
          <p>
            <strong>Containers:</strong> <InlineCode>Section</InlineCode>,{' '}
            <InlineCode>Grid</InlineCode>, <InlineCode>Card</InlineCode>,{' '}
            <InlineCode>Stack</InlineCode>, <InlineCode>Carousel</InlineCode>, and{' '}
            <InlineCode>Outlet</InlineCode> (the placeholder in a layout where the page renders).
          </p>
          <p>
            <strong>Leaves:</strong> <InlineCode>Heading</InlineCode>, <InlineCode>Text</InlineCode>
            , <InlineCode>Prose</InlineCode> (rich text), <InlineCode>Button</InlineCode>,{' '}
            <InlineCode>Badge</InlineCode>, <InlineCode>Icon</InlineCode>,{' '}
            <InlineCode>Divider</InlineCode>, <InlineCode>ImageDisplay</InlineCode>,{' '}
            <InlineCode>Video</InlineCode>, <InlineCode>Map</InlineCode>,{' '}
            <InlineCode>Stat</InlineCode>, <InlineCode>FAQ</InlineCode>,{' '}
            <InlineCode>FeatureGrid</InlineCode>, <InlineCode>EditorialSection</InlineCode>,{' '}
            <InlineCode>Logo</InlineCode>, <InlineCode>NavMenu</InlineCode>,{' '}
            <InlineCode>SocialLinks</InlineCode>, <InlineCode>Signup</InlineCode> (newsletter).
          </p>
          <p>
            <strong>Commerce leaves</strong> (on a product page): <InlineCode>PriceTag</InlineCode>,{' '}
            <InlineCode>BuyBox</InlineCode>, <InlineCode>VariantPicker</InlineCode>,{' '}
            <InlineCode>Quantity</InlineCode>, <InlineCode>AddToCart</InlineCode>,{' '}
            <InlineCode>ProductForm</InlineCode>.
          </p>
        </DocSubsection>

        <DocSubsection id="trees-binding" title="Binding: static vs. data-driven">
          <p>
            A leaf is either <strong>static</strong> (you give it <InlineCode>text</InlineCode>) or{' '}
            <strong>bound</strong> to a field. A{' '}
            <strong>container bound to an array iterates</strong> — it renders its children once per
            item, and inside, <InlineCode>item.*</InlineCode> refers to the current record. This is
            how a product grid or a blog list works:
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: BINDING_CODE }]} />
          <p>
            On a <strong>collection page</strong> (a per-record template), the record itself is in
            scope — bind to <InlineCode>product.title</InlineCode>,{' '}
            <InlineCode>blog_post.body</InlineCode>, <InlineCode>page.body</InlineCode>, etc.
            Because text and styling come from <strong>tokens and the theme</strong>, the same tree
            re-themes automatically for whatever brand installs it. That’s why you author once and
            it looks right for everyone.
          </p>
        </DocSubsection>

        <DocSubsection id="trees-site-layout" title="The site layout">
          <p>
            The layout is the chrome around every page: a header, the{' '}
            <InlineCode>Outlet</InlineCode> (where the page slots in), and a footer.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: LAYOUT_CODE }]} />
        </DocSubsection>

        <DocSubsection id="trees-pages" title="Pages: singletons vs. collections">
          <CodeBlock tabs={[{ label: 'ts', code: PAGES_CODE }]} />
          <Callout type="note" title="The home convention">
            The home page is a published <strong>singleton with its slug unset</strong>. The
            installer wires it to <InlineCode>/</InlineCode>. Don’t give it a slug.
          </Callout>
        </DocSubsection>

        <DocSubsection id="trees-emails" title="Emails">
          <p>
            Emails are trees too, just simpler (one column, no layout chrome). They install as
            drafts.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: EMAILS_CODE }]} />
        </DocSubsection>

        <DocSubsection id="trees-components" title="Reusable components (optional)">
          <p>
            A component is a parameterized tree you can drop onto pages. Its tree uses{' '}
            <InlineCode>{`{ $prop: 'key' }`}</InlineCode> slots; the page placement fills them in
            via a <InlineCode>{`custom:<key>`}</InlineCode> node.
          </p>
          <CodeBlock tabs={[{ label: 'ts', code: COMPONENT_CODE }]} />
        </DocSubsection>
      </DocSection>

      <DocSection id="preview" title="Preview image">
        <p>
          The marketplace card shows a screenshot of the installed site. Capture one after you go
          live, then:
        </p>
        <ol>
          <li>
            Save it to{' '}
            <InlineCode>apps/dashboard/public/blueprint-previews/&lt;key&gt;.png</InlineCode>.
          </li>
          <li>
            Point the manifest at it:{' '}
            <InlineCode>preview: ‘/blueprint-previews/&lt;key&gt;.png’</InlineCode>.
          </li>
        </ol>
        <p>Aim for a clean shot of the home page (the card crops to 16:10, top-aligned).</p>
      </DocSection>

      <DocSection id="register" title="Register it">
        <p>
          Add your template to the catalog so the <InlineCode>/templates</InlineCode> page picks it
          up:
        </p>
        <CodeBlock tabs={[{ label: 'registry.ts', code: REGISTER_CODE }]} />
        <p>
          That’s it — the <InlineCode>/templates</InlineCode> page, the install API, and the
          marketplace all read from this registry.
        </p>
        <DocImage
          src="/docs/dash-templates.png"
          alt="The Templates gallery in the dashboard — a grid of installable template cards (Retail Store + Blog, Tattoo Studio, Beauty Salon & Spa, Antique Shop, Auto Parts), each showing its module pills and an Install button."
          caption="The Templates gallery — every registered template appears here for tenants to install."
        />
      </DocSection>

      <DocSection id="test" title="Test it">
        <Steps>
          <Step n={1} title="It validates on build">
            <p>
              <InlineCode>parseBlueprint()</InlineCode> runs when the module loads, so{' '}
              <InlineCode>pnpm --filter @sparx/blueprints typecheck</InlineCode> and the package
              tests catch a malformed manifest, a dangling handle, or a missing asset id
              immediately.
            </p>
          </Step>
          <Step n={2} title="Install onto a scratch property">
            <p>
              From the dashboard, switch the active site to a throwaway property, open{' '}
              <strong>Templates</strong>, and click <strong>Install</strong>. Everything lands as
              drafts.
            </p>
          </Step>
          <Step n={3} title="Review the drafts">
            <p>
              Walk the pages in the Builder, the products in Commerce, the posts in CMS, the emails
              in Email. Fix anything that looks off in the manifest and re-test.
            </p>
          </Step>
          <Step n={4} title="Go live">
            <p>
              Click <strong>Go live</strong> — it publishes every page, activates the layout, sets
              products live, and publishes content. Open the site and confirm it renders.
            </p>
          </Step>
        </Steps>
      </DocSection>

      <DocSection id="gotchas" title="Conventions & gotchas">
        <p>A few rules that aren’t obvious but will bite you:</p>
        <ul>
          <li>
            <strong>No eyebrows.</strong> Never put a small uppercase/mono kicker label above a
            heading. Carry hierarchy with size, weight, and color. (Platform-wide — see the brand
            guide.)
          </li>
          <li>
            <strong>Say “Site,” not “Storefront”</strong> in any user-facing copy. (Code identifiers
            can keep “storefront.”)
          </li>
          <li>
            <strong>Product options come before variants.</strong> Define the option lattice, then
            map each variant onto it with <InlineCode>optionValues</InlineCode>. A variant that
            names an option/value you didn’t declare fails validation.
          </li>
          <li>
            <strong>Prices are integer cents</strong> (<InlineCode>priceCents: 2400</InlineCode> ={' '}
            $24.00).
          </li>
          <li>
            <strong>Reference by handle/id, never by UUID.</strong> The manifest can’t know runtime
            ids; the installer resolves handles as it goes.
          </li>
          <li>
            <strong>The home page is a slugless singleton.</strong> Don’t give it a slug.
          </li>
          <li>
            <strong>Images hot-link for now.</strong> Declare them in{' '}
            <InlineCode>assets</InlineCode>; reference by id. (A future release copies them into
            tenant media.)
          </li>
          <li>
            <strong>Installs land on the active property.</strong> On a secondary (non-primary)
            site, the brand applies as that site’s override — it won’t repaint the primary site.
          </li>
          <li>
            <strong>Everything installs as a draft.</strong> Go-live is a deliberate, separate step.
          </li>
        </ul>
      </DocSection>

      <DocSection id="reference" title="Quick reference">
        <ul>
          <li>
            <strong>Verticals:</strong> <InlineCode>retail</InlineCode> ·{' '}
            <InlineCode>b2b</InlineCode> · <InlineCode>content</InlineCode> ·{' '}
            <InlineCode>services</InlineCode>
          </li>
          <li>
            <strong>Modules:</strong> <InlineCode>builder</InlineCode> ·{' '}
            <InlineCode>commerce</InlineCode> · <InlineCode>cms</InlineCode> ·{' '}
            <InlineCode>crm</InlineCode> · <InlineCode>email</InlineCode> ·{' '}
            <InlineCode>b2b</InlineCode> · <InlineCode>dropship</InlineCode> ·{' '}
            <InlineCode>ai</InlineCode>
          </li>
          <li>
            <strong>Theme presets:</strong> <InlineCode>apex</InlineCode> ·{' '}
            <InlineCode>industrial</InlineCode> · <InlineCode>drift</InlineCode> ·{' '}
            <InlineCode>market</InlineCode> · <InlineCode>fleet</InlineCode> ·{' '}
            <InlineCode>drop</InlineCode>
          </li>
          <li>
            <strong>Surfaces:</strong> <InlineCode>none</InlineCode> ·{' '}
            <InlineCode>subtle</InlineCode> · <InlineCode>muted</InlineCode> ·{' '}
            <InlineCode>inverse</InlineCode> · <InlineCode>brand</InlineCode>
          </li>
          <li>
            <strong>Spacing / padding / gap:</strong> <InlineCode>none</InlineCode> ·{' '}
            <InlineCode>sm</InlineCode> · <InlineCode>md</InlineCode> · <InlineCode>lg</InlineCode>{' '}
            (· <InlineCode>xl</InlineCode> for padding)
          </li>
          <li>
            <strong>Built-in content types:</strong> <InlineCode>page</InlineCode> ·{' '}
            <InlineCode>blog_post</InlineCode>
          </li>
          <li>
            <strong>Record types for collection pages:</strong>{' '}
            <InlineCode>commerce.product</InlineCode> · <InlineCode>cms.blog_post</InlineCode> ·{' '}
            <InlineCode>cms.page</InlineCode>
          </li>
        </ul>
        <p>
          For the full schema, read <InlineCode>packages/blueprints/src/manifest.ts</InlineCode>.
          For a complete worked example, read{' '}
          <InlineCode>packages/blueprints/src/blueprints/retail-store-blog.ts</InlineCode>.
        </p>
      </DocSection>
    </DocArticle>
  );
}
