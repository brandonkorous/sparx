// Dev seed — idempotent: re-running upserts in place, so it's safe to call
// `pnpm --filter @sparx/db db:seed` repeatedly.
//
// Creates the "E2E Store" tenant with one staff user
// (e2e-staff@sparx.test / e2e-test-password) — these credentials are baked
// into Playwright tests and any local dashboard smoke test. The password hash
// is produced by Better Auth's own hasher (scrypt, via better-auth/crypto) so
// the seeded credential row verifies against the live sign-in flow.

import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { listBlueprints, type Blueprint } from '@sparx/blueprints';
import { LEGAL_TEMPLATES, legalEntryBody } from '@sparx/legal-templates';

const prisma = new PrismaClient();

const TENANT_SLUG = 'e2e-store';
const STAFF_EMAIL = 'e2e-staff@sparx.test';
const STAFF_PASSWORD = 'e2e-test-password';

// The first-party publisher every Sparx-core listing belongs to (docs/60 D9).
const SPARX_PUBLISHER_SLUG = 'sparx';

// The Sparx-core THEME catalog (docs/60 §6, Marketplace Themes). Each row's
// `slug` is the @sparx/site-themes preset key, so the dashboard "Apply" action
// (PUT /v1/sitebuilder/config/theme { themeKey }) and the storefront token
// compiler resolve it by slug — the heavy token payload stays in the in-code
// preset, so `tokens` is left NULL for these Sparx-core rows (mirrors blueprints).
// Curated marketplace copy + facets live here rather than importing the presets,
// so the catalog row needs no @sparx/site-themes dependency.
const SPARX_THEMES: {
  slug: string;
  name: string;
  accent: string;
  mood: string;
  colorFamily: string;
  density: string;
  industry: string;
  tagline: string;
  description: string;
  sortWeight: number;
}[] = [
  {
    slug: 'apex',
    name: 'Apex',
    accent: '#6366f1',
    mood: 'Minimal',
    colorFamily: 'Indigo',
    density: 'Standard',
    industry: 'General',
    tagline: 'Clean, modern, and versatile — a confident default for any store.',
    description:
      'A minimal, content-first theme that gets out of the way of your products. Balanced spacing, crisp type, and a single accent colour make Apex the safe, sharp starting point for almost any catalog.',
    sortWeight: 60,
  },
  {
    slug: 'industrial',
    name: 'Industrial',
    accent: '#475569',
    mood: 'Bold',
    colorFamily: 'Slate',
    density: 'Standard',
    industry: 'Industrial & B2B',
    tagline: 'Heavy-duty and utilitarian — built for parts, equipment, and trade.',
    description:
      'Squared corners, strong rules, and a no-nonsense palette. Industrial is tuned for parts catalogs, equipment, and wholesale where customers scan specs and SKUs, not lifestyle imagery.',
    sortWeight: 50,
  },
  {
    slug: 'drift',
    name: 'Drift',
    accent: '#78716c',
    mood: 'Editorial',
    colorFamily: 'Stone',
    density: 'Spacious',
    industry: 'Fashion & Apparel',
    tagline: 'Editorial and airy — lets big imagery and typography lead.',
    description:
      'Generous whitespace, oversized headings, and full-bleed imagery. Drift is an editorial theme for apparel and lifestyle brands that sell on look and feel.',
    sortWeight: 45,
  },
  {
    slug: 'market',
    name: 'Market',
    accent: '#f59e0b',
    mood: 'Vibrant',
    colorFamily: 'Amber',
    density: 'Standard',
    industry: 'Food & Beverage',
    tagline: 'Warm and lively — appetizing for food, drink, and local goods.',
    description:
      'A warm, energetic palette with rounded shapes and friendly type. Market suits food, beverage, and local makers who want a storefront that feels inviting and fresh.',
    sortWeight: 40,
  },
  {
    slug: 'fleet',
    name: 'Fleet',
    accent: '#1d4ed8',
    mood: 'Utilitarian',
    colorFamily: 'Blue',
    density: 'Wide',
    industry: 'Fleet & Industrial',
    tagline: 'Data-dense and professional — a wide layout for fleet B2B.',
    description:
      'A wide, information-rich layout built for fleet operators and B2B buyers who work in tables, specs, and bulk orders. Fleet reads like a well-organised dashboard, not a boutique.',
    sortWeight: 55,
  },
  {
    slug: 'drop',
    name: 'Drop',
    accent: '#111827',
    mood: 'Bold',
    colorFamily: 'Graphite',
    density: 'Compact',
    industry: 'Dropship & DTC',
    tagline: 'High-contrast and punchy — made for hype drops and DTC.',
    description:
      'High-contrast, tight, and bold. Drop is made for single-product launches, hype drops, and direct-to-consumer brands that want one thing front and centre.',
    sortWeight: 35,
  },
  {
    slug: 'noir',
    name: 'Noir',
    accent: '#b08d57',
    mood: 'Luxe',
    colorFamily: 'Black',
    density: 'Spacious',
    industry: 'Jewelry & Luxury',
    tagline: 'Dark, high-contrast luxury — restrained type and a single gold accent.',
    description:
      'A black-on-black luxury theme with a warm gold accent and elegant serif headings. Noir suits fine jewelry, premium fashion, and brands that sell on restraint and craftsmanship.',
    sortWeight: 58,
  },
  {
    slug: 'sage',
    name: 'Sage',
    accent: '#4d7c5a',
    mood: 'Calm',
    colorFamily: 'Green',
    density: 'Spacious',
    industry: 'Wellness & Beauty',
    tagline: 'Calm and botanical — soft greens, warm serif headings, easy spacing.',
    description:
      'Soft greens, generous whitespace, and warm serif headings make Sage feel grounded and unhurried — a natural fit for wellness, plants, beauty, and slow-living brands.',
    sortWeight: 52,
  },
  {
    slug: 'coast',
    name: 'Coast',
    accent: '#0e7490',
    mood: 'Fresh',
    colorFamily: 'Teal',
    density: 'Standard',
    industry: 'Travel & Hospitality',
    tagline: 'Airy and coastal — teal-blue with a warm sand accent and rounded shapes.',
    description:
      'A breezy teal-blue palette with a sand accent and rounded shapes. Coast is built for travel, hospitality, home, and lifestyle brands that want light, open, and inviting.',
    sortWeight: 48,
  },
  {
    slug: 'ember',
    name: 'Ember',
    accent: '#e8590c',
    mood: 'Vibrant',
    colorFamily: 'Orange',
    density: 'Standard',
    industry: 'Food & Beverage',
    tagline: 'Warm and energetic — ember orange and raspberry, punchy and appetizing.',
    description:
      'A warm, high-energy palette of ember orange and raspberry. Ember is tuned for food, drink, fitness, and events that want appetite, momentum, and a little heat.',
    sortWeight: 50,
  },
  {
    slug: 'mono',
    name: 'Mono',
    accent: '#111111',
    mood: 'Minimal',
    colorFamily: 'Mono',
    density: 'Standard',
    industry: 'Agency & Portfolio',
    tagline: 'Strict monochrome — black, white, and grey with square edges.',
    description:
      'Black, white, and grey with zero radius and confident type. Mono gets out of the way so content and imagery carry the page — ideal for agencies, portfolios, and photographers.',
    sortWeight: 46,
  },
  {
    slug: 'bloom',
    name: 'Bloom',
    accent: '#db2777',
    mood: 'Playful',
    colorFamily: 'Pink',
    density: 'Standard',
    industry: 'Crafts & Kids',
    tagline: 'Playful and soft — pink and violet, generous rounding, friendly type.',
    description:
      'Pink and violet over soft surfaces, rounded shapes, and friendly type. Bloom brings warmth and joy to kids, crafts, bakeries, and any brand that wants to feel approachable.',
    sortWeight: 44,
  },
  {
    slug: 'meridian',
    name: 'Meridian',
    accent: '#1e3a8a',
    mood: 'Professional',
    colorFamily: 'Blue',
    density: 'Wide',
    industry: 'Professional Services',
    tagline: 'Professional and trustworthy — navy with a sky accent, crisp and wide.',
    description:
      'Navy with a sky-blue accent, tight corners, and a wide, structured layout. Meridian reads as competent and trustworthy — made for professional services, SaaS, and B2B.',
    sortWeight: 54,
  },
  {
    slug: 'terra',
    name: 'Terra',
    accent: '#9a3412',
    mood: 'Earthy',
    colorFamily: 'Terracotta',
    density: 'Standard',
    industry: 'Makers & Home',
    tagline: 'Earthy and handmade — terracotta and olive over warm sandy neutrals.',
    description:
      'Terracotta and olive over warm, sandy neutrals with a serif headline. Terra feels handmade and grounded — a natural fit for makers, pottery, home goods, and roasters.',
    sortWeight: 42,
  },
  {
    slug: 'pulse',
    name: 'Pulse',
    accent: '#6d28d9',
    mood: 'Bold',
    colorFamily: 'Violet',
    density: 'Standard',
    industry: 'Tech & Electronics',
    tagline: 'Electric and modern — violet and cyan, glowing over deep ink in dark mode.',
    description:
      'Violet and cyan that glow against deep ink, with a technical sans headline. Pulse is built for tech, gaming, electronics, and hype-driven DTC that want a modern, electric edge.',
    sortWeight: 47,
  },
  {
    slug: 'linen',
    name: 'Linen',
    accent: '#a8755a',
    mood: 'Editorial',
    colorFamily: 'Stone',
    density: 'Spacious',
    industry: 'Apparel & Lifestyle',
    tagline: 'Soft and editorial — warm charcoal and clay over creamy neutrals.',
    description:
      'Warm charcoal and clay over creamy linen neutrals, with classic serif headings. Linen has a quiet editorial polish suited to apparel, lifestyle, and stationery brands.',
    sortWeight: 49,
  },
];

/** The lightweight "what this creates" counts a blueprint card shows — computed
 *  from the manifest so the catalog row never has to load it again. */
function blueprintContents(bp: Blueprint): Record<string, number | string | boolean | null> {
  const c = bp.commerce;
  return {
    products: c?.products.length ?? 0,
    categories: c?.categories.length ?? 0,
    collections: c?.collections.length ?? 0,
    content: bp.content.length,
    pages: bp.pages.length,
    emails: bp.emails.length,
    components: bp.components.length,
    theme: bp.theme.name,
    hasLayout: Boolean(bp.layout),
  };
}

// Seed the Sparx-core marketplace catalog (docs/60 §6) from the in-code
// @sparx/blueprints registry — idempotent (upsert by slug). The catalog row is a
// thin, browse-ready projection (spine + vertical/modules/contents); the heavy
// manifest stays in the registry and is resolved by slug at install time, so
// `definition` is left NULL for Sparx-core rows.
//
// Runs with NO tenant context (Sparx-core, publisher_tenant_id NULL): the
// catalog tables are FORCE-RLS with a `marketplace_visibility` policy whose
// WITH CHECK is `publisher_tenant_id IS NOT DISTINCT FROM current_tenant_id()`,
// so clearing app.tenant_id lets the NULL ⇔ NULL insert through (and seeds rows
// `published`, which the same policy keeps readable for the idempotent re-upsert).
async function seedMarketplaceCatalog(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // No tenant context — Sparx-core listings. Explicit (not relying on a fresh
    // connection) so a pooled connection can't leak a prior tenant id.
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);

    const publisher = await tx.marketplacePublisher.upsert({
      where: { slug: SPARX_PUBLISHER_SLUG },
      update: { type: 'sparx', displayName: 'Sparx', verified: true },
      create: { slug: SPARX_PUBLISHER_SLUG, type: 'sparx', displayName: 'Sparx', verified: true },
    });

    for (const bp of listBlueprints()) {
      const shared = {
        name: bp.name,
        tagline: bp.summary.slice(0, 255),
        description: bp.summary,
        media: bp.preview ? [{ url: bp.preview, kind: 'image' }] : [],
        accent: bp.brand.colors.primary,
        version: bp.version,
        vertical: bp.vertical,
        requiredModules: bp.requiresModules,
        contents: blueprintContents(bp),
        status: 'published',
        visibility: 'public',
        publisherId: publisher.id,
        // No payload column: the manifest is resolved by slug → the in-code
        // @sparx/blueprints registry, OR (for a bundle item) the storage artifact
        // (docs/85 §6/§7). `definition` stays NULL.
      };
      await tx.marketplaceBlueprint.upsert({
        where: { slug: bp.key },
        update: shared,
        create: { slug: bp.key, publishedAt: new Date(), ...shared },
      });
    }

    // Themes (docs/85 §7). The 6 foundations (apex…drop) are CODE presets resolved
    // by slug → `tokens` NULL. The 10 marketplace data themes (noir…linen) are
    // seeded as BUNDLES via the ingest (a storage artifact + thin row), NOT here —
    // a thin row with no artifact AND no code preset would break Apply — so the
    // loop filters SPARX_THEMES to the foundations until those bundles land.
    const FOUNDATION_THEME_SLUGS = new Set([
      'apex',
      'industrial',
      'drift',
      'market',
      'fleet',
      'drop',
    ]);
    for (const t of SPARX_THEMES) {
      if (!FOUNDATION_THEME_SLUGS.has(t.slug)) continue;
      const shared = {
        name: t.name,
        tagline: t.tagline.slice(0, 255),
        description: t.description,
        accent: t.accent,
        mood: t.mood,
        colorFamily: t.colorFamily,
        density: t.density,
        industry: t.industry,
        sortWeight: t.sortWeight,
        status: 'published',
        visibility: 'public',
        publisherId: publisher.id,
      };
      await tx.marketplaceTheme.upsert({
        where: { slug: t.slug },
        update: shared,
        create: { slug: t.slug, publishedAt: new Date(), ...shared },
      });
    }

    // Integrations — providerSlug maps to a real @sparx/provider-* bundle; the
    // "Connect" CTA hands off to /commerce/providers. configSchema NULL (resolved
    // by provider slug at connect time).
    for (const it of SPARX_INTEGRATIONS) {
      const shared = {
        name: it.name,
        tagline: it.tagline.slice(0, 255),
        description: it.description,
        accent: it.accent,
        providerSlug: it.providerSlug,
        kind: it.kind,
        scopes: it.scopes,
        sortWeight: it.sortWeight,
        status: 'published',
        visibility: 'public',
        publisherId: publisher.id,
      };
      await tx.marketplaceIntegration.upsert({
        where: { slug: it.slug },
        update: shared,
        create: { slug: it.slug, publishedAt: new Date(), ...shared },
      });
    }

    // Components — slug = builder component `type`; tree NULL (the node tree lives
    // in the in-code PALETTE, resolved by type when copied into a tenant component).
    for (const cmp of SPARX_COMPONENTS) {
      const shared = {
        name: cmp.name,
        tagline: cmp.tagline.slice(0, 255),
        description: cmp.description,
        group: cmp.group,
        kind: cmp.kind,
        surfaces: cmp.surfaces,
        sortWeight: cmp.sortWeight,
        status: 'published',
        visibility: 'public',
        publisherId: publisher.id,
      };
      await tx.marketplaceComponent.upsert({
        where: { slug: cmp.slug },
        update: shared,
        create: { slug: cmp.slug, publishedAt: new Date(), ...shared },
      });
    }

    // Composed DATA components (docs/85) are seeded as BUNDLES via the ingest
    // (a storage artifact + thin row), not here — the seed only carries the
    // legacy palette-pointer components above.

    console.log(
      `Seeded marketplace catalog: ${listBlueprints().length} blueprint(s), ` +
        `6 foundation theme(s), ${SPARX_INTEGRATIONS.length} integration(s), ` +
        `${SPARX_COMPONENTS.length} component(s).`
    );
  });
}

// The Sparx-core INTEGRATION catalog (docs/60 §6, Marketplace Integrations). Each
// row's `providerSlug` maps to a real integration-framework provider bundle
// (@sparx/provider-*); the marketplace is DISCOVERY and the dashboard "Connect"
// CTA hands off to Settings → Integrations (/commerce/providers) for the actual
// install/config (docs/66 MP-Ph3). `configSchema` is NULL for these Sparx-core
// rows (resolved by provider slug at connect time).
const SPARX_INTEGRATIONS: {
  slug: string;
  name: string;
  providerSlug: string;
  kind: string;
  scopes: string[];
  accent: string;
  tagline: string;
  description: string;
  sortWeight: number;
}[] = [
  {
    slug: 'stripe',
    name: 'Stripe',
    providerSlug: 'stripe',
    kind: 'Payments',
    scopes: ['payments', 'refunds', 'payouts'],
    accent: '#635bff',
    tagline: 'Accept cards, wallets, and local payment methods worldwide.',
    description:
      'Connect Stripe to take card and wallet payments, issue refunds, and reconcile payouts. The default, battle-tested payments rail for Sparx commerce.',
    sortWeight: 60,
  },
  {
    slug: 'paypal',
    name: 'PayPal',
    providerSlug: 'paypal',
    kind: 'Payments',
    scopes: ['payments', 'refunds'],
    accent: '#003087',
    tagline: 'Let customers check out with PayPal and Pay Later.',
    description:
      'Offer PayPal and Pay Later at checkout for buyers who prefer it — a familiar, trusted button that lifts conversion in many markets.',
    sortWeight: 48,
  },
  {
    slug: 'shippo',
    name: 'Shippo',
    providerSlug: 'shippo',
    kind: 'Shipping',
    scopes: ['rates', 'labels', 'tracking'],
    accent: '#0b7285',
    tagline: 'Real-time rates, labels, and tracking across major carriers.',
    description:
      'Pull live shipping rates at checkout, buy and print labels, and track shipments across USPS, UPS, FedEx, and more — all from one connection.',
    sortWeight: 55,
  },
  {
    slug: 'easypost',
    name: 'EasyPost',
    providerSlug: 'easypost',
    kind: 'Shipping',
    scopes: ['rates', 'labels', 'tracking'],
    accent: '#164b9b',
    tagline: 'Multi-carrier shipping — rates, labels, and tracking via one API.',
    description:
      'An alternative multi-carrier shipping connection: real-time rates, label purchase, and tracking, with broad carrier coverage and address verification.',
    sortWeight: 42,
  },
  {
    slug: 'taxjar',
    name: 'TaxJar',
    providerSlug: 'taxjar',
    kind: 'Tax',
    scopes: ['tax_calculation', 'reporting'],
    accent: '#3bb273',
    tagline: 'Automated US sales-tax calculation and reporting.',
    description:
      'Calculate accurate sales tax at checkout by jurisdiction and keep filing-ready reports — so tax stops being a spreadsheet at month-end.',
    sortWeight: 45,
  },
  {
    slug: 'avalara',
    name: 'Avalara',
    providerSlug: 'avalara',
    kind: 'Tax',
    scopes: ['tax_calculation', 'compliance'],
    accent: '#ff6a13',
    tagline: 'Enterprise tax calculation and compliance.',
    description:
      'Enterprise-grade tax determination and compliance across thousands of jurisdictions — for sellers whose tax footprint has outgrown a single state.',
    sortWeight: 38,
  },
];

// The Sparx-core COMPONENT catalog (docs/60 §6/§7, Marketplace Components). A
// curated selection of the builder's system components (the in-code PALETTE
// registry) — each row's `slug` IS the component `type`, so the dashboard "Add"
// action deep-links to /builder/components/<type> (where the existing "Copy to my
// components" flow clones it into a tenant BuilderComponent, docs/53). The node
// `tree` is NULL for these Sparx-core rows (resolved by type at copy time, like
// blueprints/themes); copy is curated marketplace metadata, kept inline so the
// catalog row needs no dependency on the dashboard registry. Low-level primitives
// (Divider, Stack, Icon) are intentionally omitted — the marketplace surfaces
// composed, reusable blocks, not substrate.
const SPARX_COMPONENTS: {
  slug: string;
  name: string;
  group: string;
  kind: string;
  surfaces: string[];
  tagline: string;
  description: string;
  sortWeight: number;
}[] = [
  {
    slug: 'EditorialSection',
    name: 'Editorial Section',
    group: 'Content & media',
    kind: 'Section',
    surfaces: ['page'],
    tagline: 'A long-form marketing block — eyebrow, headline, body, and CTA.',
    description:
      'A flexible editorial band for landing pages: an optional eyebrow, a headline, body copy, and a call-to-action, with sensible spacing and rhythm out of the box.',
    sortWeight: 60,
  },
  {
    slug: 'FeatureGrid',
    name: 'Feature Grid',
    group: 'Content & media',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'A responsive grid of numbered feature cards.',
    description:
      'Show off capabilities or selling points in a clean, responsive grid of numbered cards — collapses to a single column on phones.',
    sortWeight: 56,
  },
  {
    slug: 'FAQ',
    name: 'FAQ',
    group: 'Content & media',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'An expandable list of question-and-answer pairs.',
    description:
      'Answer common questions inline with an accessible, expandable accordion — great for product pages, pricing, and support.',
    sortWeight: 52,
  },
  {
    slug: 'Carousel',
    name: 'Carousel',
    group: 'Layout',
    kind: 'Block',
    surfaces: ['page', 'site'],
    tagline: 'A rotating slideshow — autoplay, arrows, and dots.',
    description:
      'Each child becomes a slide, with autoplay, arrow controls, and dot indicators. Use it for testimonials, hero rotations, or product highlights.',
    sortWeight: 48,
  },
  {
    slug: 'Stat',
    name: 'Stat',
    group: 'Content & media',
    kind: 'Widget',
    surfaces: ['page'],
    tagline: 'A large headline number with a label.',
    description:
      'A single, bold metric — a big number and a short label. Drop a few into a row to make an at-a-glance proof strip.',
    sortWeight: 40,
  },
  {
    slug: 'Card',
    name: 'Card',
    group: 'Layout',
    kind: 'Block',
    surfaces: ['page', 'site'],
    tagline: 'A bordered surface that groups related content.',
    description:
      'A versatile container that groups related content on a bordered, optionally module-striped surface. The building block for grids and feature rows.',
    sortWeight: 44,
  },
  {
    slug: 'Video',
    name: 'Video',
    group: 'Content & media',
    kind: 'Widget',
    surfaces: ['page'],
    tagline: 'An embedded video.',
    description: 'Embed a video by URL with a responsive, aspect-correct frame.',
    sortWeight: 36,
  },
  {
    slug: 'Map',
    name: 'Map',
    group: 'Content & media',
    kind: 'Widget',
    surfaces: ['page'],
    tagline: 'An embedded map for a place or search.',
    description:
      'Show a location or search result on an embedded map — handy for store and service pages.',
    sortWeight: 34,
  },
  {
    slug: 'Signup',
    name: 'Signup Form',
    group: 'Data-aware',
    kind: 'Widget',
    surfaces: ['page', 'site'],
    tagline: 'An email-capture form wired to your CRM.',
    description:
      'Capture emails straight into your CRM as subscribers. Drop it in a footer or a landing section and the submissions just flow into Sparx.',
    sortWeight: 58,
  },
  {
    slug: 'BuyBox',
    name: 'Buy Box',
    group: 'Data-aware',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'The complete purchase block — price, variants, quantity, add-to-cart.',
    description:
      'Everything a shopper needs to buy: live price, variant pickers, a quantity stepper, and an add-to-cart button — all bound to the product record.',
    sortWeight: 54,
  },
  {
    slug: 'ProductForm',
    name: 'Product Form',
    group: 'Data-aware',
    kind: 'Block',
    surfaces: ['page'],
    tagline: 'Wraps buy-box atoms in a shared variant + quantity context.',
    description:
      'Compose your own purchase UI: ProductForm provides the shared variant + quantity state that VariantPicker, Quantity, and Add-to-Cart read from.',
    sortWeight: 42,
  },
  {
    slug: 'PriceTag',
    name: 'Price Tag',
    group: 'Data-aware',
    kind: 'Widget',
    surfaces: ['page'],
    tagline: "Displays a product's price, bound to the record.",
    description:
      "Renders a product or variant's price with currency formatting, bound to the bound record.",
    sortWeight: 32,
  },
  {
    slug: 'ImageDisplay',
    name: 'Image Display',
    group: 'Data-aware',
    kind: 'Widget',
    surfaces: ['page'],
    tagline: "Renders an image or gallery from a record's media field.",
    description:
      "Binds to a record's media field and renders a single image or a gallery — the data-aware counterpart to the static Image component.",
    sortWeight: 30,
  },
  {
    slug: 'NavMenu',
    name: 'Navigation Menu',
    group: 'Site',
    kind: 'Widget',
    surfaces: ['site'],
    tagline: 'A navigation menu bound to a site menu or hand-typed links.',
    description:
      'Your site navigation — bound to a managed site menu or hand-typed links. Lives in the site layout so it renders on every page.',
    sortWeight: 38,
  },
  {
    slug: 'SocialLinks',
    name: 'Social Links',
    group: 'Site',
    kind: 'Widget',
    surfaces: ['site'],
    tagline: 'A row of social-profile links from your site identity.',
    description: 'A tidy row of social-profile icons pulled from your site identity settings.',
    sortWeight: 28,
  },
];

// Backfill starter legal pages + footer placements for EXISTING tenants (docs/42
// Slice 7). New tenants get these from the legal-seed-worker on `tenant.created`;
// this covers tenants created before that worker existed. Idempotent find-or-create
// per (tenant, template) — re-running skips everything already present — and it
// reuses @sparx/legal-templates for the canonical bodies, so there is no fragile
// inline-SQL copy of the legal text.
//
// content_entries + site_doc_placements are FORCE-RLS, so each tenant's
// writes run inside a transaction with app.tenant_id SET LOCAL to that tenant
// (the WITH CHECK is tenant_id = current_tenant_id()). This mirrors the
// legal-seed-worker's withTenant() path; sparx_owner is a non-superuser in prod,
// so the per-tenant set_config is mandatory (see packages/db/CLAUDE.md).
async function backfillLegalPages(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let created = 0;

  for (const { id: tenantId } of tenants) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

      for (const [i, t] of LEGAL_TEMPLATES.entries()) {
        const existing = await tx.contentEntry.findFirst({
          where: { typeKey: 'page', slug: t.defaultSlug },
          select: { id: true },
        });

        let entryId: string;
        if (existing) {
          entryId = existing.id;
        } else {
          const entry = await tx.contentEntry.create({
            data: {
              tenantId,
              typeKey: 'page',
              slug: t.defaultSlug,
              status: 'draft',
              body: legalEntryBody(t) as unknown as Prisma.InputJsonObject,
              legalKind: t.legalKind,
              legalTemplateVersion: t.templateVersion,
            },
            select: { id: true },
          });
          entryId = entry.id;
          created++;
        }

        const existingPlacement = await tx.siteDocPlacement.findFirst({
          where: { placement: 'footer', sourceKind: 'cms_entry', entryId },
          select: { id: true },
        });
        if (!existingPlacement) {
          await tx.siteDocPlacement.create({
            data: {
              tenantId,
              placement: 'footer',
              sourceKind: 'cms_entry',
              entryId,
              legalKind: t.legalKind,
              label: t.title,
              columnKey: 'legal',
              position: i,
            },
          });
        }
      }
    });
  }

  console.log(
    `Backfilled legal pages for ${tenants.length} tenant(s): ${created} entr(ies) created.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo inventory (docs/100 P1e) — a focused diesel-parts catalog (the Gillett
// anchor vertical) + multi-warehouse stock so the Inventory module renders real
// numbers locally: non-zero valuation, a low/out-of-stock watch list, and a
// populated movement-ledger activity feed. Stock is written the way
// `applyMovement()` does — every level gets opening movements whose Σ(delta)
// equals on_hand, with a running `balance_after` — so the ledger invariant
// (`onHand == Σ(movements)`) holds and the feed reads like real activity. The
// products double as a small commerce catalog for the seeded tenant.
//
// Idempotent: demo products (handle `inv-demo-*`) are dropped + recreated each
// run, cascading their variants/levels/movements/lots; warehouses upsert by code.
// FORCE-RLS tables, so the whole thing runs inside one tx with app.tenant_id SET
// LOCAL (packages/db/CLAUDE.md).

type DemoWh = 'MAIN' | 'WEST-3PL';

interface DemoMovement {
  delta: number;
  reason: string; // receive | sale | recount | transfer_in | loss | damage
  daysAgo: number;
}
interface DemoLevel {
  warehouse: DemoWh;
  reorderPoint?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  movements: DemoMovement[]; // Σ(delta) == on_hand for this level
}
interface DemoVariant {
  sku: string;
  title: string | null;
  priceCents: number;
  costCents: number;
  levels: DemoLevel[];
}
interface DemoProduct {
  handle: string;
  title: string;
  productType: string;
  vendor: string;
  hazmatClass?: string;
  variants: DemoVariant[];
}
interface DemoLot {
  sku: string;
  warehouse: DemoWh;
  lotNumber: string;
  quantity: number;
  expiresInDays: number | null;
  hazmatClass?: string;
  recall?: string; // reason → an active recall
}

const DEMO_WAREHOUSES: {
  code: string;
  name: string;
  type: string;
  city: string;
  region: string;
}[] = [
  { code: 'MAIN', name: 'Main Warehouse', type: 'owned', city: 'West Valley City', region: 'UT' },
  { code: 'WEST-3PL', name: 'West Coast 3PL', type: '3pl', city: 'Reno', region: 'NV' },
];

// `r(n, d)` = receive n then sell d (chronologically), so on_hand = n − d but the
// level carries real ledger history. Single receives are the common case.
const recv = (delta: number, daysAgo: number): DemoMovement => ({
  delta,
  reason: 'receive',
  daysAgo,
});
const sale = (delta: number, daysAgo: number): DemoMovement => ({
  delta: -delta,
  reason: 'sale',
  daysAgo,
});

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    handle: 'inv-demo-fuel-filter-67',
    title: 'Fuel Filter — 6.7L Power Stroke',
    productType: 'Filters',
    vendor: 'Motorcraft',
    variants: [
      {
        sku: 'FF-67-STD',
        title: 'Standard',
        priceCents: 4299,
        costCents: 2150,
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 24,
            reorderQuantity: 96,
            leadTimeDays: 7,
            movements: [
              recv(120, 21),
              sale(15, 9),
              sale(9, 3),
              { delta: -1, reason: 'recount', daysAgo: 1 },
            ],
          },
          {
            warehouse: 'WEST-3PL',
            reorderPoint: 12,
            reorderQuantity: 48,
            movements: [recv(40, 18), sale(6, 5)],
          },
        ],
      },
      {
        sku: 'FF-67-OEM',
        title: 'OEM',
        priceCents: 5899,
        costCents: 3100,
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 16,
            reorderQuantity: 64,
            leadTimeDays: 10,
            movements: [recv(58, 30), sale(22, 6)],
          },
        ],
      },
    ],
  },
  {
    handle: 'inv-demo-glow-plug-60',
    title: 'Glow Plug Set (8) — 6.0L Power Stroke',
    productType: 'Ignition',
    vendor: 'Motorcraft',
    variants: [
      {
        sku: 'GP-60-SET8',
        title: null,
        priceCents: 18999,
        costCents: 9800,
        // Low: 7 on hand, reorder point 10.
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 10,
            reorderQuantity: 40,
            leadTimeDays: 14,
            movements: [recv(28, 24), sale(13, 8), sale(8, 2)],
          },
        ],
      },
    ],
  },
  {
    handle: 'inv-demo-injector-67-cummins',
    title: 'Fuel Injector — 6.7L Cummins',
    productType: 'Fuel System',
    vendor: 'Bosch',
    variants: [
      {
        sku: 'INJ-67C-REMAN',
        title: 'Remanufactured',
        priceCents: 32900,
        costCents: 18500,
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 8,
            reorderQuantity: 24,
            leadTimeDays: 21,
            movements: [recv(36, 40), sale(11, 12), sale(7, 4)],
          },
        ],
      },
      {
        sku: 'INJ-67C-NEW',
        title: 'New OEM',
        priceCents: 58900,
        costCents: 41000,
        // Out of stock with history: received then fully sold through.
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 4,
            reorderQuantity: 12,
            leadTimeDays: 28,
            movements: [recv(9, 35), sale(9, 6)],
          },
        ],
      },
    ],
  },
  {
    handle: 'inv-demo-turbo-lml',
    title: 'Turbocharger — Duramax LML',
    productType: 'Forced Induction',
    vendor: 'Garrett',
    variants: [
      {
        sku: 'TURBO-LML',
        title: null,
        priceCents: 129900,
        costCents: 82000,
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 3,
            reorderQuantity: 6,
            leadTimeDays: 35,
            movements: [recv(8, 50), sale(2, 14)],
          },
          { warehouse: 'WEST-3PL', movements: [recv(3, 22)] },
        ],
      },
    ],
  },
  {
    handle: 'inv-demo-oil-15w40',
    title: 'Diesel Engine Oil 15W-40 (1 gal)',
    productType: 'Fluids',
    vendor: 'Shell Rotella',
    hazmatClass: 'class9',
    variants: [
      {
        sku: 'OIL-15W40-1G',
        title: null,
        priceCents: 2999,
        costCents: 1450,
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 60,
            reorderQuantity: 240,
            leadTimeDays: 5,
            movements: [recv(480, 28), sale(96, 10), sale(72, 3)],
          },
          {
            warehouse: 'WEST-3PL',
            reorderPoint: 40,
            reorderQuantity: 160,
            movements: [recv(240, 26), sale(48, 7)],
          },
        ],
      },
    ],
  },
  {
    handle: 'inv-demo-coolant-hd',
    title: 'Heavy-Duty Coolant — Nitrite-Free (1 gal)',
    productType: 'Fluids',
    vendor: 'Fleetguard',
    hazmatClass: 'class9',
    variants: [
      {
        sku: 'COOL-HD-1G',
        title: null,
        priceCents: 1999,
        costCents: 950,
        // Low: 18 on hand, reorder point 30.
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 30,
            reorderQuantity: 120,
            leadTimeDays: 6,
            movements: [recv(120, 20), sale(60, 9), sale(42, 2)],
          },
        ],
      },
    ],
  },
  {
    handle: 'inv-demo-serpentine-belt-73',
    title: 'Serpentine Belt — 7.3L Power Stroke',
    productType: 'Belts',
    vendor: 'Gates',
    variants: [
      {
        sku: 'BELT-73',
        title: null,
        priceCents: 4599,
        costCents: 2200,
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 20,
            reorderQuantity: 80,
            leadTimeDays: 9,
            movements: [recv(64, 33), sale(19, 11), sale(8, 4)],
          },
        ],
      },
    ],
  },
  {
    handle: 'inv-demo-water-pump-66',
    title: 'Water Pump — 6.6L Duramax',
    productType: 'Cooling',
    vendor: 'ACDelco',
    variants: [
      {
        sku: 'WP-66',
        title: null,
        priceCents: 17999,
        costCents: 9500,
        levels: [
          {
            warehouse: 'MAIN',
            reorderPoint: 6,
            reorderQuantity: 18,
            leadTimeDays: 16,
            movements: [recv(22, 44), sale(7, 13), sale(3, 5)],
          },
        ],
      },
    ],
  },
];

const DEMO_LOTS: DemoLot[] = [
  {
    sku: 'OIL-15W40-1G',
    warehouse: 'MAIN',
    lotNumber: 'ROT-2026-0418',
    quantity: 480,
    expiresInDays: 540,
    hazmatClass: 'class9',
  },
  {
    sku: 'OIL-15W40-1G',
    warehouse: 'WEST-3PL',
    lotNumber: 'ROT-2026-0392',
    quantity: 240,
    expiresInDays: 300,
    hazmatClass: 'class9',
  },
  // An expiring-soon lot (inside the 1-year window the Lots page surfaces).
  {
    sku: 'COOL-HD-1G',
    warehouse: 'MAIN',
    lotNumber: 'FG-COOL-2025-7731',
    quantity: 120,
    expiresInDays: 120,
    hazmatClass: 'class9',
  },
  // An active recall — drives the Lots page's recall watch list.
  {
    sku: 'GP-60-SET8',
    warehouse: 'MAIN',
    lotNumber: 'MC-GP60-2025-1188',
    quantity: 28,
    expiresInDays: null,
    recall: 'Supplier notice: ceramic tip may crack on cold-start cycling.',
  },
];

function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function seedDemoInventory(tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

    // Warehouses — upsert by (tenant, code); persist across re-runs.
    const whByCode = new Map<DemoWh, string>();
    for (const w of DEMO_WAREHOUSES) {
      const row = await tx.warehouse.upsert({
        where: { tenantId_code: { tenantId, code: w.code } },
        update: { name: w.name, type: w.type, city: w.city, region: w.region, country: 'US' },
        create: {
          tenantId,
          code: w.code,
          name: w.name,
          type: w.type,
          city: w.city,
          region: w.region,
          country: 'US',
        },
      });
      whByCode.set(w.code as DemoWh, row.id);
    }
    const mainId = whByCode.get('MAIN')!;

    // Drop prior demo products → cascades variants/levels/movements/lots.
    await tx.product.deleteMany({ where: { tenantId, handle: { startsWith: 'inv-demo-' } } });

    const variantIdBySku = new Map<string, string>();

    for (const p of DEMO_PRODUCTS) {
      const prices = p.variants.map((v) => v.priceCents);
      const anyStock = p.variants.some((v) =>
        v.levels.some((l) => l.movements.reduce((s, m) => s + m.delta, 0) > 0)
      );
      const product = await tx.product.create({
        data: {
          tenantId,
          title: p.title,
          handle: p.handle,
          status: 'active',
          productType: p.productType,
          vendor: p.vendor,
          hazmatClass: p.hazmatClass ?? 'none',
          defaultWarehouseId: mainId,
          priceMinCents: Math.min(...prices),
          priceMaxCents: Math.max(...prices),
          inStock: anyStock,
          publishedAt: new Date(),
          metadata: { demo: 'inventory' },
        },
      });

      for (const [i, v] of p.variants.entries()) {
        const variant = await tx.productVariant.create({
          data: {
            tenantId,
            productId: product.id,
            sku: v.sku,
            title: v.title,
            priceCents: v.priceCents,
            costCents: v.costCents,
            currency: 'USD',
            isDefault: i === 0,
          },
        });
        variantIdBySku.set(v.sku, variant.id);

        for (const lvl of v.levels) {
          const warehouseId = whByCode.get(lvl.warehouse)!;
          const onHand = lvl.movements.reduce((s, m) => s + m.delta, 0);
          await tx.inventoryLevel.create({
            data: {
              tenantId,
              variantId: variant.id,
              warehouseId,
              onHand,
              ...(lvl.reorderPoint !== undefined ? { reorderPoint: lvl.reorderPoint } : {}),
              ...(lvl.reorderQuantity !== undefined
                ? { reorderQuantity: lvl.reorderQuantity }
                : {}),
              ...(lvl.leadTimeDays !== undefined ? { leadTimeDays: lvl.leadTimeDays } : {}),
              unitCostCents: v.costCents,
              avgCostCents: v.costCents,
            },
          });

          // Replay the movements oldest→newest so balance_after is the running
          // on-hand and Σ(delta) lands exactly on the level's on_hand.
          let balance = 0;
          const chrono = [...lvl.movements].sort((a, b) => b.daysAgo - a.daysAgo);
          for (const m of chrono) {
            balance += m.delta;
            await tx.inventoryMovement.create({
              data: {
                tenantId,
                variantId: variant.id,
                warehouseId,
                delta: m.delta,
                balanceAfter: balance,
                reason: m.reason,
                actorType: 'system',
                source: 'seed',
                ...(m.reason === 'receive' ? { unitCostCents: v.costCents } : {}),
                createdAt: daysAgoDate(m.daysAgo),
              },
            });
          }
        }
      }
    }

    // Lot batches (fluids + a recalled glow-plug set).
    for (const lot of DEMO_LOTS) {
      const variantId = variantIdBySku.get(lot.sku);
      if (!variantId) continue;
      const warehouseId = whByCode.get(lot.warehouse)!;
      await tx.lotBatch.create({
        data: {
          tenantId,
          variantId,
          warehouseId,
          lotNumber: lot.lotNumber,
          quantity: lot.quantity,
          hazmatClass: lot.hazmatClass ?? 'none',
          ...(lot.expiresInDays !== null ? { expiresAt: daysAgoDate(-lot.expiresInDays) } : {}),
          manufacturedAt: daysAgoDate(90),
          ...(lot.recall
            ? { recallStatus: 'active', recallReason: lot.recall, recalledAt: daysAgoDate(4) }
            : {}),
        },
      });
    }

    const variantCount = variantIdBySku.size;
    console.log(
      `Seeded demo inventory: ${DEMO_PRODUCTS.length} products / ${variantCount} variants across ` +
        `${DEMO_WAREHOUSES.length} warehouses, with ledger movements + ${DEMO_LOTS.length} lots.`
    );
  });
}

async function main(): Promise<void> {
  // tenants has no RLS — safe to upsert outside a tenant context. Default
  // settings (incl. the module activation registry read by
  // @sparx/auth#requireModule) are JSON-merged via raw SQL so re-running
  // the seed adds new module flags without clobbering unrelated keys (e.g.
  // the onboarding tracker).
  const defaultSettings = {
    primaryDomain: 'e2e.sparx.test',
    modules: {
      builder: { enabled: true },
      commerce: { enabled: true },
      cms: { enabled: true },
      crm: { enabled: true },
      // Live Chat (docs/56) — enabled so the storefront widget + dashboard inbox
      // exercise against the seeded tenant.
      chat: { enabled: true },
      // The `ai` module gates MCP / AI-Integrations access (module-based, not a
      // plan tier — see services/api-mcp/src/auth.ts). Enabled so local MCP
      // tooling + the MCP e2e path work against the seeded tenant.
      ai: { enabled: true },
    },
  };

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: {
      slug: TENANT_SLUG,
      name: 'E2E Store',
      email: STAFF_EMAIL,
      plan: 'starter',
      status: 'active',
      settings: defaultSettings,
    },
  });

  // Merge module flags onto existing settings without overwriting other
  // top-level keys. jsonb || jsonb does a shallow merge — fine here since
  // each module slot is independently structured.
  await prisma.$executeRaw`
    UPDATE tenants
    SET settings = settings || ${JSON.stringify(defaultSettings)}::jsonb
    WHERE id = ${tenant.id}::uuid
  `;

  // Every tenant HAS exactly one PRIMARY web property (docs/49). Seed it
  // explicitly (idempotent on tenant_id+slug) so a fresh dev DB matches the
  // prod sign-up path instead of leaning on the one-time backfill migration.
  // The display name is "Default" (a tenant is a workspace that HAS sites);
  // slug 'primary' is reserved and keeps the bare subdomain. properties is
  // FORCE RLS, so set the tenant context for the WITH CHECK.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    await tx.property.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'primary' } },
      update: { name: 'Default' },
      create: { tenantId: tenant.id, slug: 'primary', name: 'Default', isPrimary: true },
    });
  });

  // Hash with Better Auth's own hasher — the exact function its sign-in
  // verifier uses (scrypt, via better-auth/crypto). Hashing by hand with a
  // different algorithm (e.g. argon2) yields "Invalid password hash" at
  // sign-in, because server.ts leaves emailAndPassword on Better Auth's
  // default (scrypt) hasher rather than configuring a custom one.
  const passwordHash = await hashPassword(STAFF_PASSWORD);

  // users and accounts are RLS-protected; set the tenant context inside a
  // transaction so SET LOCAL applies to every statement that follows. Account
  // RLS keys on user_id, so we set app.user_id once we know the owner row id.
  //
  // Wrapped in try/catch so a prod re-seed (where the e2e staff user may
  // already exist under a stale tenant — email is globally unique) doesn't
  // block the marketing seed that follows.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);

      const owner = await tx.user.upsert({
        where: { email: STAFF_EMAIL },
        update: {},
        create: {
          tenantId: tenant.id,
          email: STAFF_EMAIL,
          name: 'E2E Staff',
          role: 'owner',
          emailVerified: true,
        },
      });

      await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${owner.id}'`);

      await tx.account.upsert({
        where: {
          providerId_accountId: {
            providerId: 'credential',
            accountId: owner.id,
          },
        },
        update: { password: passwordHash },
        create: {
          userId: owner.id,
          providerId: 'credential',
          accountId: owner.id,
          password: passwordHash,
        },
      });

      console.log(`Seeded tenant "${tenant.name}" (${tenant.id}) with staff user ${owner.email}`);
    });
  } catch (err) {
    console.warn(
      `[seed] e2e-store staff user upsert skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Demo inventory + a small commerce catalog for the e2e tenant (docs/100 P1e)
  // so the Inventory module shows real data locally. Wrapped so a hiccup never
  // blocks the rest of the seed; idempotent on re-run.
  try {
    await seedDemoInventory(tenant.id);
  } catch (err) {
    console.warn(
      `[seed] demo inventory seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Sparx-core marketplace catalog (docs/60) — platform data, independent of the
  // e2e tenant. Wrapped so a catalog hiccup never blocks the rest of the seed.
  try {
    await seedMarketplaceCatalog();
  } catch (err) {
    console.warn(
      `[seed] marketplace catalog seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Backfill starter legal pages for existing tenants (docs/42 Slice 7). Wrapped
  // so a hiccup never blocks the rest of the seed; idempotent on re-run.
  try {
    await backfillLegalPages();
  } catch (err) {
    console.warn(
      `[seed] legal pages backfill skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
