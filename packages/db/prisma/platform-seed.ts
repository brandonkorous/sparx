// PLATFORM data — the rows that belong to the PLATFORM itself, not to any
// tenant and not to the local demo: the sparx-core marketplace catalog, the
// global platform component library, and the starter legal pages every tenant
// is entitled to.
//
// WHY THIS IS A SEPARATE FILE FROM seed.ts. They are two different deliverables
// that happened to share one entrypoint, and the seam only showed up in
// production. `prisma/seed.ts` provisions a DEMO tenant — e2e-staff@sparx.test,
// a diesel parts catalog, fake orders, fake bookings, a fake partner payout —
// which is exactly right on a laptop and unshippable to a live platform. So the
// seed was never wired into any deploy, and the platform data trapped inside it
// never shipped either. `marketplace_themes` held ZERO rows in production across
// both clouds while 20 theme bundles sat committed in the repo, and
// /market/themes served its empty state to every visitor for a month.
//
// Everything here is therefore held to a stricter contract than the demo seed:
//
//   IDEMPOTENT   — every write is an upsert or a find-or-create keyed on a
//                  stable natural key. Re-running changes nothing but
//                  updated_at, which is what lets it run on EVERY deploy
//                  rather than being a thing someone remembers to trigger.
//   TENANT-SAFE  — it creates no tenants and invents no business data. The one
//                  function that touches tenant rows (backfillLegalPages) only
//                  adds platform-authored legal documents that every tenant is
//                  owed, and skips any that already exist.
//   LOUD IN PROD — see `tolerateFailures`. On a laptop a catalog hiccup should
//                  not block the demo seed; in a deploy it must fail the
//                  rollout. Swallowing errors is how "the seed ran green" and
//                  "the catalog is empty" were true at the same time.
//
// Consumed by TWO entrypoints: prisma/seed.ts (local dev, tolerant) and
// prisma/seed-platform.ts (the deploy's data stage, strict).

import { readFileSync } from 'node:fs';

import { PrismaClient, type Prisma } from '@prisma/client';
import { listBlueprints, type Blueprint } from '@sparx/blueprints';
import { LEGAL_TEMPLATES, legalEntryBody } from '@sparx/legal-templates';
import { PLATFORM_CATALOG } from '@sparx/builder-schemas';

// The owner (sparx_owner) connection string, for the few GLOBAL, owner-write
// tables (e.g. platform_components). Prefers the ambient env (prod sets it on
// the job); falls back to reading packages/db/.env in dev — dependency-free so
// the seed needs no dotenv. Falls back to the default URL if neither resolves.
export function ownerDatabaseUrl(): string | undefined {
  if (process.env.MIGRATION_DATABASE_URL) return process.env.MIGRATION_DATABASE_URL;
  try {
    const env = readFileSync('.env', 'utf8');
    const match = /^\s*MIGRATION_DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/m.exec(env);
    if (match?.[1]) return match[1].trim();
  } catch {
    // no .env file (e.g. prod) — fall through to the default connection
  }
  return process.env.DATABASE_URL;
}

// The first-party publisher every sparx-core listing belongs to (docs/60 D9).
const SPARX_PUBLISHER_SLUG = 'sparx';

// The sparx-core THEME catalog (docs/60 §6, Marketplace Themes). Each row's
// `slug` is the @sparx/site-themes preset key, so the dashboard "Apply" action
// (PUT /v1/sitebuilder/config/theme { themeKey }) and the storefront token
// compiler resolve it by slug — the heavy token payload stays in the in-code
// preset, so `tokens` is left NULL for these sparx-core rows (mirrors blueprints).
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
    // The site moved under `site` when the manifest went silica-native — the
    // legacy top-level `layout` + `pages[]` + `components[]` are gone. `site` is
    // optional (a commerce- or content-only blueprint has no hosted site), so
    // this reads through it rather than assuming one exists.
    //
    // Kept BYTE-IDENTICAL to the same projection in api-rest's
    // lib/marketplace/ingest.ts and routes/v1/blueprints/index.ts: `components`
    // is dropped (a silica page inlines symbol instances, so there is no
    // per-tenant component count to report) and the chrome is `hasFrame`, not
    // `hasLayout`. Three copies of this shape already exist; three copies that
    // DISAGREE would put a different contents blob in the catalog depending on
    // which path wrote the row.
    pages: bp.site?.pages.length ?? 0,
    emails: bp.emails.length,
    theme: bp.theme.name,
    hasFrame: Boolean(bp.site?.frame),
  };
}

// Seed the sparx-core marketplace catalog (docs/60 §6) from the in-code
// @sparx/blueprints registry — idempotent (upsert by slug). The catalog row is a
// thin, browse-ready projection (spine + vertical/modules/contents); the heavy
// manifest stays in the registry and is resolved by slug at install time, so
// `definition` is left NULL for sparx-core rows.
//
// Runs with NO tenant context (sparx-core, publisher_tenant_id NULL): the
// catalog tables are FORCE-RLS with a `marketplace_visibility` policy whose
// WITH CHECK is `publisher_tenant_id IS NOT DISTINCT FROM current_tenant_id()`,
// so clearing app.tenant_id lets the NULL ⇔ NULL insert through (and seeds rows
// `published`, which the same policy keeps readable for the idempotent re-upsert).
export async function seedMarketplaceCatalog(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // No tenant context — sparx-core listings. Explicit (not relying on a fresh
    // connection) so a pooled connection can't leak a prior tenant id.
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = ''`);

    const publisher = await tx.marketplacePublisher.upsert({
      where: { slug: SPARX_PUBLISHER_SLUG },
      update: { type: 'sparx', displayName: 'sparx', verified: true },
      create: { slug: SPARX_PUBLISHER_SLUG, type: 'sparx', displayName: 'sparx', verified: true },
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

// The sparx-core INTEGRATION catalog (docs/60 §6, Marketplace Integrations). Each
// row's `providerSlug` maps to a real integration-framework provider bundle
// (@sparx/provider-*); the marketplace is DISCOVERY and the dashboard "Connect"
// CTA hands off to Settings → Integrations (/commerce/providers) for the actual
// install/config (docs/66 MP-Ph3). `configSchema` is NULL for these sparx-core
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
      'Connect Stripe to take card and wallet payments, issue refunds, and reconcile payouts. The default, battle-tested payments rail for sparx commerce.',
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

// The sparx-core COMPONENT catalog (docs/60 §6/§7, Marketplace Components). A
// curated selection of the builder's system components (the in-code PALETTE
// registry) — each row's `slug` IS the component `type`, so the dashboard "Add"
// action deep-links to /builder/components/<type> (where the existing "Copy to my
// components" flow clones it into a tenant BuilderComponent, docs/53). The node
// `tree` is NULL for these sparx-core rows (resolved by type at copy time, like
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
      'Capture emails straight into your CRM as subscribers. Drop it in a footer or a landing section and the submissions just flow into sparx.',
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
    tagline: 'A navigation menu — a container of nav links you can retarget and nest.',
    description:
      'Your site navigation — a container of individually-editable nav links (each retargeted with the link picker; nest links to make a dropdown). Lives in the site layout so it renders on every page.',
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
export async function backfillLegalPages(prisma: PrismaClient): Promise<void> {
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

// The platform COMPONENT catalog (docs/98 §5) — the GLOBAL platform_components table
// (no tenant_id). The published library IS the data-as-code PLATFORM_CATALOG, so the
// seed mirrors every entry in as a `published` row: this is what the
// `/v1/platform/catalog/*` API serves and what a future admin app lists. Idempotent
// upsert by key; descriptions are clamped to the column's 280-char bound. Authored by
// the reserved `system` id (the seed predates any real platform user). Stays in sync
// with the static catalog automatically — new catalog entries seed with no change here.
export async function seedPlatformCatalog(): Promise<void> {
  // platform_components is GLOBAL with owner-only writes: the sparx_app role can
  // only SELECT published rows (packages/db/CLAUDE.md), so the default seed
  // connection's upsert violates RLS. Write through the owner connection
  // (MIGRATION_DATABASE_URL = sparx_owner) so it passes in both docker and prod.
  const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
  try {
    for (const e of PLATFORM_CATALOG) {
      const data = {
        name: e.name,
        category: e.category,
        kind: e.kind,
        icon: e.icon,
        description: e.description.slice(0, 280),
        surfaces: e.surfaces,
        tree: e.tree as unknown as Prisma.InputJsonValue,
        tags: e.tags ?? [],
        status: 'published' as const,
        visibility: 'public' as const,
      };
      await owner.platformComponent.upsert({
        where: { key: e.key },
        update: data,
        create: { key: e.key, authorId: 'system', ...data },
      });
    }
    console.log(`[seed] platform component catalog: ${PLATFORM_CATALOG.length} entries published`);
  } finally {
    await owner.$disconnect();
  }
}
/** Apply every piece of platform-owned data, in dependency order.
 *
 *  `tolerateFailures` is the ONLY behavioural difference between the two
 *  callers, and it is deliberate. Local dev passes true: a marketplace hiccup
 *  must not stop a developer getting a working demo tenant. The deploy passes
 *  false, so a failure here fails the Job and therefore the deploy — because the
 *  alternative is what already happened once, a green pipeline sitting on top of
 *  an empty catalog with the reason logged as a warning nobody read.
 */
export async function seedPlatformData(
  prisma: PrismaClient,
  opts: { tolerateFailures?: boolean } = {}
): Promise<void> {
  const steps: [string, () => Promise<void>][] = [
    // sparx-core marketplace catalog (docs/60) — the foundation themes,
    // blueprints, integrations and components resolved by slug from the in-code
    // registries. Bundle-backed listings (docs/85) are published separately by
    // the marketplace ingest, which runs in the same deploy stage.
    ['marketplace catalog', () => seedMarketplaceCatalog(prisma)],
    // Global platform component library (docs/98 §5) — writes through the OWNER
    // connection, since platform_components is owner-write.
    ['platform component catalog', seedPlatformCatalog],
    // Starter legal pages for tenants that predate the legal-seed-worker
    // (docs/42 Slice 7). Find-or-create per (tenant, template).
    ['legal pages backfill', () => backfillLegalPages(prisma)],
  ];

  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!opts.tolerateFailures) {
        throw new Error(`platform seed failed at "${label}": ${message}`, { cause: err });
      }
      console.warn(`[seed] ${label} skipped: ${message}`);
    }
  }
}
