// The sparx blueprint — the first-party reference site, captured from the approved
// live Template (tenant WizeWorks, property "Template") into an installable bundle
// (docs/implementation/perfect-template-blueprint.md).
//
// A blueprint is DATA: the installer replays it through the platform's own services
// and resolves every handle/ref to a runtime id. No submitter code runs. Two halves
// feed it (see the perfect-template doc, "Two workstreams"):
//
//   · `site`  — the ONLY captured half: the frame + pages + theme + symbols of the
//     live Template, pulled verbatim so it reinstalls byte-identical. Produced as
//     DATA by `blueprint:capture` (or the MCP `get_silica_site` read) and imported
//     from ./site.json — never hand-transcribed.
//   · `brand` / `theme` / `commerce` / `content` / `emails` — hand-authored here,
//     mirrored from the live tenant for coherence (the 6 neutral demo goods, the 3
//     universal journal posts) so the bundle is a transcript of something proven,
//     not invented.
//
// Rules: reference by HANDLE (never a runtime id); every image goes through `assets`
// by id; trees bind brand via tokens so they re-skin per installing tenant.

// The captured Template site (frame + 7 pages + theme + symbols). Generated as data,
// not written by hand — see README.md for the exact capture command. Imported as a
// relative graph the loader resolves (docs/85 §3, multi-file payloads). Validation is
// runtime, through the loader's `safeParseBlueprint` (the silica trees are opaque
// `looseObject`s, so a compile-time `satisfies Blueprint` adds noise, not safety).
// A blueprint is PURE DATA — the loader `import()`s this module with no workspace
// resolution, so it imports ONLY sibling JSON, never `@sparx/*`. The authored trees
// (the captured site, the welcome email built from the silica email kit) are
// generated as JSON and imported here verbatim.
import site from './site.json' with { type: 'json' };

// The welcome email — a universal silica EmailDocument (built once from the email kit;
// see media/../README). Merge tags re-resolve per recipient + per installing tenant,
// so the copy re-skins automatically. The send composes the brand wordmark header +
// legal footer around this body, so the doc carries neither.
import welcomeEmail from './welcome-email.json' with { type: 'json' };

// The second touch of the welcome journey — a day-3 follow-up ("a few places to
// start"), built the same way from the silica email kit. The `sequences` block
// below stitches the two into a live 2-touch welcome series.
import welcomeEmail2 from './welcome-email-2.json' with { type: 'json' };

// The 3 universal journal posts, mirrored from the live Template journal
// (list_content_entries) — tiptap bodies verbatim, featured images by `{ $asset }`.
import content from './content.json' with { type: 'json' };

const blueprint = {
  key: 'sparx',
  version: '1.5.0',
  name: 'Universal Starter',
  summary:
    'A complete, multi-module starter — shop, journal, booking, and wholesale — in the Ember look. Install it, make it yours, and launch a polished working site in minutes.',
  vertical: 'retail',
  preview: 'media/preview.png',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],

  // ── Brand (Ember, vertical-neutral) ──────────────────────────────────────────
  // The demo business the bundle is authored around, and the installing tenant
  // rebrands it to their own. It is an INVENTED name, never the platform's: the
  // installer writes `businessName` unconditionally into the property's
  // brand_override, and invoice/packing-slip rendering prints it as the SELLER.
  // A tenant born with the platform's name on its invoices is the defect this
  // avoids (piggles/docs/personas/issues/091, /165).
  brand: {
    businessName: 'Alder & Ash',
    tagline: 'Everything you sell, publish, and book — in one place.',
    colors: {
      primary: '#e04631', // Ember — the sparx brand primary
      primaryForeground: '#ffffff',
      accent: '#c1652e',
      secondary: '#4c9a8e',
    },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    // logoLightAssetId / faviconAssetId are filled once the logo assets are added to
    // `assets` (the live wordmark + spark favicon) — see README.
  },

  // ── Theme (the provisioned SiteTheme the installer creates + applies) ─────────
  // Ships the Ember theme verbatim (locked decision #2): base preset `sparx` — the
  // PLATFORM base, which is the Ember look — plus the Ember brand snapshot. Data, so
  // it installs with no deploy and stays editable. This is SEPARATE from `site.theme`
  // (the captured silica tokens) below.
  //
  // The base was `apex`, one of six retired presets, so the flagship's saved theme
  // layered Ember identity over a generic indigo palette rather than over Ember.
  theme: {
    name: 'Ember',
    basePresetKey: 'sparx',
    presentation: { v: 2, containerWidth: '1152px' },
    brand: {
      colorPrimary: '#e04631',
      colorAccent: '#c1652e',
      colorSecondary: '#4c9a8e',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      tokens: {},
    },
    apply: true,
  },

  // ── Assets (product + journal imagery) ───────────────────────────────────────
  // Every `*AssetId` / `{ $asset }` ref names an entry here. Product photos mirror
  // the live catalog's images verbatim (the installer downloads + re-hosts them);
  // the installing tenant swaps them for their own.
  assets: [
    {
      id: 'img-notebook',
      url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200&q=80',
      alt: 'A pocket dot-grid notebook on a desk',
    },
    {
      id: 'img-tee',
      url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80',
      alt: 'A folded cotton t-shirt',
    },
    {
      id: 'img-mug',
      url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=1200&q=80',
      alt: 'A speckled enamel camp mug',
    },
    {
      id: 'img-tote',
      url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&q=80',
      alt: 'A heavy cotton canvas tote bag',
    },
    {
      id: 'img-cap',
      url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=1200&q=80',
      alt: 'A packable six-panel cap',
    },
    {
      id: 'img-bottle',
      url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=1200&q=80',
      alt: 'A matte insulated steel water bottle',
    },
    {
      id: 'post-launch',
      url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80',
      alt: 'A laptop and notebook on a desk, planning a launch',
    },
    {
      id: 'post-descriptions',
      url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80',
      alt: 'Writing at a laptop',
    },
    {
      id: 'post-regulars',
      url: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=1200&q=80',
      alt: 'A shopkeeper handing a package to a customer',
    },
  ],

  // Built-in content types (blog_post, page, …) — no custom types needed.
  contentTypes: [],

  // ── Content (the 3 universal journal posts) ──────────────────────────────────
  // Mirrored from the live Template journal (list_content_entries) — see content.json.
  content,

  // ── Commerce (the 6 neutral demo goods) ──────────────────────────────────────
  // Mirrored from the live Template catalog via `get_products`/`get_product` (exact
  // titles, descriptions, types, tags, prices, image URLs). One `goods` category +
  // one featured `bestsellers` collection group them — the live catalog has neither
  // yet, so the bundle ADDS them (the doc's plan): it gives the /shop PLP a category
  // facet and makes Home's `commerce.featured` bind resolve to a curated set. SKUs
  // are clean bundle-derived values (each install mints fresh variants). Variants use
  // `continue` inventory so a fresh install never shows "Sold out" before the tenant
  // sets stock (docs/impl perfect-template BUG-009). Titles/handles/vendor/SKUs carry
  // NO product name — they land in a real tenant's catalog and on their published
  // shop, so `House Goods` mirrors the platform's own generic sample pack.
  commerce: {
    categories: [
      {
        handle: 'goods',
        name: 'Goods',
        description: 'Everyday goods — the whole shop in one place.',
        featured: true,
      },
    ],
    collections: [
      {
        handle: 'bestsellers',
        name: 'Bestsellers',
        description: 'A handful of favorites to start with.',
        type: 'manual',
        featured: true,
        productHandles: [
          'field-notebook',
          'everyday-tee',
          'enamel-mug',
          'canvas-tote',
          'ripstop-cap',
          'insulated-bottle',
        ],
      },
    ],
    products: [
      {
        handle: 'field-notebook',
        title: 'Field Notebook',
        description:
          'A pocket-size dot-grid notebook for lists, sketches, and half-formed ideas. Lay-flat binding, 120 pages of thick cream paper that won’t bleed, and a cover that softens the more you carry it.',
        status: 'active',
        productType: 'Paper',
        vendor: 'House Goods',
        tags: ['notebook', 'everyday', 'dot-grid', 'stationery'],
        categoryHandles: ['goods'],
        collectionHandles: ['bestsellers'],
        seoTitle: 'Field Notebook — pocket dot-grid notebook',
        seoDescription:
          'A pocket-size, lay-flat dot-grid notebook with 120 pages of bleed-resistant cream paper.',
        variants: [
          { sku: 'NB-DOT-A6', priceCents: 1400, isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'img-notebook', isPrimary: true, alt: 'Field Notebook' }],
      },
      {
        handle: 'everyday-tee',
        title: 'Everyday Tee',
        description:
          'The one you reach for first. Mid-weight combed cotton with a relaxed, true-to-size fit and a collar that keeps its shape wash after wash. Built to be worn, not saved for later.',
        status: 'active',
        productType: 'Apparel',
        vendor: 'House Goods',
        tags: ['tee', 'cotton', 'unisex', 'apparel'],
        categoryHandles: ['goods'],
        collectionHandles: ['bestsellers'],
        seoTitle: 'Everyday Tee — mid-weight combed cotton',
        seoDescription:
          'A relaxed-fit, mid-weight combed-cotton tee with a collar that holds its shape.',
        variants: [
          { sku: 'TEE-CTN-MID', priceCents: 2800, isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'img-tee', isPrimary: true, alt: 'Everyday Tee' }],
      },
      {
        handle: 'enamel-mug',
        title: 'Enamel Mug',
        description:
          'A proper camp mug in speckled enamel over steel. Holds twelve ounces, shrugs off drops, and goes from desk to trailhead to campfire without complaint. A little chip only makes it look better.',
        status: 'active',
        productType: 'Drinkware',
        vendor: 'House Goods',
        tags: ['mug', 'enamel', 'camp', 'drinkware'],
        categoryHandles: ['goods'],
        collectionHandles: ['bestsellers'],
        seoTitle: 'Enamel Mug — 12oz speckled camp mug',
        seoDescription:
          'A 12oz speckled enamel-over-steel camp mug built for desk, trail, and campfire.',
        variants: [
          { sku: 'MUG-12-ENAM', priceCents: 1800, isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'img-mug', isPrimary: true, alt: 'Enamel Mug' }],
      },
      {
        handle: 'canvas-tote',
        title: 'Canvas Tote',
        description:
          'Heavy 12oz cotton canvas with real box corners and long shoulder-length handles. Carries a week of groceries or a laptop and lunch, and stands up on its own when you set it down. Machine-washable, gets softer with age.',
        status: 'active',
        productType: 'Accessories',
        vendor: 'House Goods',
        tags: ['tote', 'canvas', 'everyday', 'accessories'],
        categoryHandles: ['goods'],
        collectionHandles: ['bestsellers'],
        seoTitle: 'Canvas Tote — heavy 12oz cotton tote bag',
        seoDescription:
          'A heavy 12oz cotton-canvas tote with box corners and shoulder-length handles.',
        variants: [
          { sku: 'TOTE-CTN-12', priceCents: 2200, isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'img-tote', isPrimary: true, alt: 'Canvas Tote' }],
      },
      {
        handle: 'ripstop-cap',
        title: 'Ripstop Cap',
        description:
          'A lightweight six-panel cap in packable ripstop, with a curved brim you can bend by hand and an adjustable strap that fits nearly everyone. Folds into a pocket and springs back into shape.',
        status: 'active',
        productType: 'Apparel',
        vendor: 'House Goods',
        tags: ['cap', 'adjustable', 'ripstop', 'apparel'],
        categoryHandles: ['goods'],
        collectionHandles: ['bestsellers'],
        seoTitle: 'Ripstop Cap — packable six-panel cap',
        seoDescription:
          'A lightweight, packable six-panel ripstop cap with a hand-bendable brim and adjustable strap.',
        variants: [
          { sku: 'CAP-RIP-6P', priceCents: 2600, isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'img-cap', isPrimary: true, alt: 'Ripstop Cap' }],
      },
      {
        handle: 'insulated-bottle',
        title: 'Insulated Bottle',
        description:
          'Double-walled stainless steel that keeps cold drinks cold for 24 hours and hot ones hot for 12. A soft matte finish that doesn’t sweat, a leak-proof cap, and a slim profile that fits a standard cup holder. Holds 17 oz.',
        status: 'active',
        productType: 'Drinkware',
        vendor: 'House Goods',
        tags: ['bottle', 'insulated', 'steel', 'drinkware', 'everyday'],
        categoryHandles: ['goods'],
        collectionHandles: ['bestsellers'],
        seoTitle: 'Insulated Bottle — 17oz double-walled steel',
        seoDescription:
          'A 17oz double-walled stainless bottle: cold for 24h, hot for 12h, leak-proof, matte finish.',
        variants: [
          { sku: 'BOT-17-STL', priceCents: 3200, isDefault: true, inventoryPolicy: 'continue' },
        ],
        images: [{ assetId: 'img-bottle', isPrimary: true, alt: 'Insulated Bottle' }],
      },
    ],
  },

  // ── Emails (the welcome journey's two touches) ───────────────────────────────
  // Install draft (the tenant reviews before anything sends), per the doc's D4. The
  // `sequences` block below references these two by name.
  emails: [
    { name: 'Welcome', doc: welcomeEmail, publish: false },
    { name: 'Welcome — day 3', doc: welcomeEmail2, publish: false },
  ],

  // ── Sequences (a welcome journey, ready to turn on) ──────────────────────────
  // The capstone: a real 2-touch welcome SERIES, not a single nudge. A new customer
  // gets the welcome email on day 0 and the "places to start" follow-up on day 3.
  // Installs as a DRAFT (`activate: false`) to match the emails' draft posture
  // (decision D4) — the tenant reviews both emails, publishes them, then turns the
  // series on (a draining sequence must reference PUBLISHED emails, since dispatch
  // renders the published version). Once on, pair it with the platform's
  // on-by-default "Welcome new customers" automation (enrols on crm.customer.created)
  // for a hands-off first week. `exitOnPurchase` stops the follow-up the moment they
  // buy — a welcome, not a nag. Steps reference the two emails above by name; the
  // installer resolves them to real ids.
  sequences: [
    {
      name: 'Welcome series',
      description:
        'Greets a new customer on day 0 and follows up on day 3 with a few places to start. Stops early if they’ve already bought.',
      reentryPolicy: 'once',
      exitOnPurchase: true,
      activate: false,
      steps: [
        { emailName: 'Welcome', delaySeconds: 0, emailType: 'marketing', name: 'Day 0 — welcome' },
        {
          emailName: 'Welcome — day 3',
          delaySeconds: 259200,
          emailType: 'marketing',
          name: 'Day 3 — places to start',
        },
      ],
    },
  ],

  // ── Site (CAPTURED — the whole point) ────────────────────────────────────────
  // The live Template's frame + pages + theme + symbols, imported verbatim.
  site,
};

export default blueprint;
