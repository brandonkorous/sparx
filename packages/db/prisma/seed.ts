// Dev seed — idempotent: re-running upserts in place, so it's safe to call
// `pnpm --filter @sparx/db db:seed` repeatedly.
//
// Creates the "E2E Store" tenant with one staff user
// (e2e-staff@sparx.test / e2e-test-password) — these credentials are baked
// into Playwright tests and any local dashboard smoke test. The password hash
// is produced by Better Auth's own hasher (scrypt, via better-auth/crypto) so
// the seeded credential row verifies against the live sign-in flow.

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { listBlueprints, type Blueprint } from '@sparx/blueprints';
import { LEGAL_TEMPLATES, legalEntryBody } from '@sparx/legal-templates';
import { PLATFORM_CATALOG } from '@sparx/builder-schemas';
import { getFitmentDictionary, planFitmentDictionaryRows } from '@sparx/commerce-schemas';

const prisma = new PrismaClient();

// The owner (sparx_owner) connection string, for the few GLOBAL, owner-write
// tables (e.g. platform_components). Prefers the ambient env (prod sets it on
// the job); falls back to reading packages/db/.env in dev — dependency-free so
// the seed needs no dotenv. Falls back to the default URL if neither resolves.
function ownerDatabaseUrl(): string | undefined {
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

const TENANT_SLUG = 'e2e-store';
const STAFF_EMAIL = 'e2e-staff@sparx.test';
const STAFF_PASSWORD = 'e2e-test-password';

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
    pages: bp.pages.length,
    emails: bp.emails.length,
    components: bp.components.length,
    theme: bp.theme.name,
    hasLayout: Boolean(bp.layout),
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
async function seedMarketplaceCatalog(): Promise<void> {
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

    // Stale storefront/test carts pin demo variants via a RESTRICT FK
    // (commerce_cart_items.variant_id), which would block the product reset
    // below. Carts are ephemeral shopping sessions — clear this tenant's first so
    // the idempotent re-seed always succeeds.
    await tx.cartItem.deleteMany({ where: { tenantId } });
    await tx.cart.deleteMany({ where: { tenantId } });

    // Drop prior demo products → cascades variants/levels/movements/lots.
    await tx.product.deleteMany({ where: { tenantId, handle: { startsWith: 'inv-demo-' } } });

    const variantIdBySku = new Map<string, string>();
    // sku → { id, costCents } — the purchasing seed (suppliers / POs) needs the
    // cost to derive a believable purchase price below retail cost.
    const variantMetaBySku = new Map<string, { id: string; costCents: number }>();

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
        variantMetaBySku.set(v.sku, { id: variant.id, costCents: v.costCents });

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

    // ── Supply path (P3b): suppliers, purchasing links, demo POs ──────────────
    // Two vendors, each sourcing a few variants below the retail cost, plus a
    // draft + a submitted PO so /inventory/suppliers + /purchase-orders render
    // real data on a fresh tenant. Idempotent: suppliers upsert by code, their
    // prior POs are cleared and recreated.
    const DEMO_SUPPLIERS = [
      {
        code: 'SUP-BOSCH',
        name: 'Bosch Diesel Supply',
        terms: 'net30',
        lead: 7,
        city: 'Charleston',
        region: 'SC',
      },
      {
        code: 'SUP-STAN',
        name: 'Stanadyne Distribution',
        terms: 'net45',
        lead: 14,
        city: 'Windsor',
        region: 'CT',
      },
    ];
    const supplierByCode = new Map<string, string>();
    for (const s of DEMO_SUPPLIERS) {
      const row = await tx.supplier.upsert({
        where: { tenantId_code: { tenantId, code: s.code } },
        update: {
          name: s.name,
          paymentTerms: s.terms,
          leadTimeDays: s.lead,
          city: s.city,
          region: s.region,
          country: 'US',
          isActive: true,
          deletedAt: null,
        },
        create: {
          tenantId,
          code: s.code,
          name: s.name,
          paymentTerms: s.terms,
          leadTimeDays: s.lead,
          city: s.city,
          region: s.region,
          country: 'US',
        },
      });
      supplierByCode.set(s.code, row.id);
    }

    // Purchasing links — first 6 variants split across the two suppliers, priced
    // at 96% of the variant cost and flagged preferred.
    const linkSkus = [...variantMetaBySku.entries()].slice(0, 6);
    const buyCost = (costCents: number): number => Math.round(costCents * 0.96);
    for (const [i, [sku, meta]] of linkSkus.entries()) {
      const supplierId = supplierByCode.get(i % 2 === 0 ? 'SUP-BOSCH' : 'SUP-STAN')!;
      await tx.supplierVariant.upsert({
        where: { supplierId_variantId: { supplierId, variantId: meta.id } },
        update: {
          unitCostCents: buyCost(meta.costCents),
          supplierSku: `${sku}-V`,
          isPreferred: true,
        },
        create: {
          tenantId,
          supplierId,
          variantId: meta.id,
          unitCostCents: buyCost(meta.costCents),
          supplierSku: `${sku}-V`,
          minOrderQty: 5,
          isPreferred: true,
        },
      });
    }

    // Clear prior demo POs (their lines already cascaded with the product reset),
    // then create a draft + a submitted order numbered after any existing POs.
    await tx.purchaseOrder.deleteMany({
      where: { supplierId: { in: [...supplierByCode.values()] } },
    });
    const poBase = await tx.purchaseOrder.count({ where: { tenantId } });
    const grBase = await tx.goodsReceipt.count({ where: { tenantId } });
    let receiptSeq = 0;
    const poDefs = [
      { code: 'SUP-BOSCH', status: 'draft', skus: linkSkus.slice(0, 2), shipping: 0 },
      { code: 'SUP-STAN', status: 'submitted', skus: linkSkus.slice(2, 4), shipping: 2500 },
    ];
    for (const [i, def] of poDefs.entries()) {
      const lines = def.skus.map(([sku, meta]) => ({
        sku,
        meta,
        qty: 20,
        unitCostCents: buyCost(meta.costCents),
      }));
      const subtotal = lines.reduce((s, l) => s + l.qty * l.unitCostCents, 0);
      const submitted = def.status === 'submitted';
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          number: `PO-${String(poBase + i + 1).padStart(6, '0')}`,
          supplierId: supplierByCode.get(def.code)!,
          warehouseId: mainId,
          status: def.status,
          currency: 'USD',
          reference: 'Replenishment',
          shippingCents: def.shipping,
          subtotalCents: subtotal,
          totalCents: subtotal + def.shipping,
          ...(submitted ? { orderedAt: daysAgoDate(3), expectedArrivalAt: daysAgoDate(-11) } : {}),
        },
      });
      const poLineRows: { id: string; variantId: string; unitCostCents: number; qty: number }[] =
        [];
      for (const l of lines) {
        const row = await tx.purchaseOrderLine.create({
          data: {
            tenantId,
            purchaseOrderId: po.id,
            variantId: l.meta.id,
            quantityOrdered: l.qty,
            unitCostCents: l.unitCostCents,
            supplierSku: `${l.sku}-V`,
            description: l.sku,
          },
        });
        poLineRows.push({
          id: row.id,
          variantId: l.meta.id,
          unitCostCents: l.unitCostCents,
          qty: l.qty,
        });
      }

      // The submitted PO gets a partial goods receipt (half of its first line) so
      // /inventory/receiving shows real history + received progress, and the PO
      // becomes `partial`. The receive movement raises the level on-hand + moving
      // average, keeping Σ(delta) == on_hand.
      if (submitted && poLineRows[0]) {
        receiptSeq += 1;
        const first = poLineRows[0];
        const recvQty = Math.floor(first.qty / 2);
        const gr = await tx.goodsReceipt.create({
          data: {
            tenantId,
            number: `GR-${String(grBase + receiptSeq).padStart(6, '0')}`,
            purchaseOrderId: po.id,
            warehouseId: mainId,
            reference: 'PACKING-7741',
            receivedAt: daysAgoDate(1),
          },
        });
        const level = await tx.inventoryLevel.findUnique({
          where: { variantId_warehouseId: { variantId: first.variantId, warehouseId: mainId } },
        });
        const prevOnHand = level?.onHand ?? 0;
        const newOnHand = prevOnHand + recvQty;
        const oldAvg = level?.avgCostCents ?? first.unitCostCents;
        const newAvg = Math.round(
          (prevOnHand * oldAvg + recvQty * first.unitCostCents) / newOnHand
        );
        const mv = await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantId: first.variantId,
            warehouseId: mainId,
            delta: recvQty,
            balanceAfter: newOnHand,
            reason: 'receive',
            actorType: 'system',
            source: 'seed',
            unitCostCents: first.unitCostCents,
            referenceType: 'GoodsReceipt',
            referenceId: gr.id,
            createdAt: daysAgoDate(1),
          },
        });
        await tx.inventoryLevel.upsert({
          where: { variantId_warehouseId: { variantId: first.variantId, warehouseId: mainId } },
          update: { onHand: newOnHand, avgCostCents: newAvg },
          create: {
            tenantId,
            variantId: first.variantId,
            warehouseId: mainId,
            onHand: newOnHand,
            avgCostCents: newAvg,
            unitCostCents: first.unitCostCents,
          },
        });
        await tx.goodsReceiptLine.create({
          data: {
            tenantId,
            goodsReceiptId: gr.id,
            purchaseOrderLineId: first.id,
            variantId: first.variantId,
            quantityReceived: recvQty,
            unitCostCents: first.unitCostCents,
            movementId: mv.id,
          },
        });
        await tx.purchaseOrderLine.update({
          where: { id: first.id },
          data: { quantityReceived: recvQty },
        });
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'partial' } });
      }
    }

    // ── Transfers (P4): a draft MAIN → WEST-3PL the user can ship + receive ───
    // A draft moves no stock, so it can't break the Σ(movements) == on_hand
    // invariant; shipping/receiving it in the UI is the deploy-gate exercise.
    // Lines reference two fast movers that have MAIN stock so the draft ships.
    await tx.inventoryTransfer.deleteMany({ where: { tenantId } });
    const westId = whByCode.get('WEST-3PL')!;
    const shippable = await tx.inventoryLevel.findMany({
      where: { warehouseId: mainId, onHand: { gte: 5 } },
      select: { variantId: true },
      orderBy: { onHand: 'desc' },
      take: 2,
    });
    let transferCount = 0;
    if (shippable.length > 0 && westId !== mainId) {
      const transfer = await tx.inventoryTransfer.create({
        data: {
          tenantId,
          number: 'TRF-000001',
          fromWarehouseId: mainId,
          toWarehouseId: westId,
          status: 'draft',
          note: 'Rebalance fast movers to the West Coast 3PL',
        },
      });
      for (const lvl of shippable) {
        await tx.inventoryTransferLine.create({
          data: { tenantId, transferId: transfer.id, variantId: lvl.variantId, quantity: 5 },
        });
      }
      transferCount = 1;
    }

    // ── External sync (P5 Tier C): a CSV connection with mappings + a queue ────
    // A demo source so the sync-health panel, SKU mappings, and the unmapped-SKU
    // review queue render real data. The illustrative run shows the feed agreeing
    // on the two mapped items, with three external SKUs still awaiting mapping.
    await tx.inventorySource.deleteMany({ where: { tenantId, name: 'Warehouse CSV feed' } });
    const mappedSkus = [...variantIdBySku.entries()].slice(0, 2);
    let sourceCount = 0;
    if (mappedSkus.length > 0) {
      const source = await tx.inventorySource.create({
        data: {
          tenantId,
          name: 'Warehouse CSV feed',
          type: 'csv',
          config: { csvUrl: 'https://wms.example.com/exports/on-hand.csv' },
          status: 'active',
          syncIntervalSec: 3600,
          lastSyncAt: new Date(),
          notes: 'Nightly on-hand export from the WMS (demo).',
        },
      });
      for (const [i, [sku, vid]] of mappedSkus.entries()) {
        // The first mapping demos the P5b sync controls: the feed reports this item
        // by the case (×6), and a 3-unit safety buffer is withheld from sale.
        await tx.inventorySourceLink.create({
          data: {
            tenantId,
            sourceId: source.id,
            variantId: vid,
            warehouseId: mainId,
            externalSku: `WMS-${sku}`,
            ...(i === 0 ? { externalUom: 'case', unitsPerExternal: 6 } : {}),
          },
        });
        if (i === 0) {
          await tx.inventoryLevel.updateMany({
            where: { tenantId, variantId: vid, warehouseId: mainId },
            data: { safetyBuffer: 3 },
          });
        }
      }
      for (const ext of ['WMS-FLT-9001', 'WMS-BRK-2204', 'WMS-SEAL-118']) {
        await tx.inventoryUnmappedSku.create({
          data: { tenantId, sourceId: source.id, externalSku: ext, lastQuantity: 12, seenCount: 2 },
        });
      }
      await tx.inventorySyncRun.create({
        data: {
          tenantId,
          sourceId: source.id,
          trigger: 'manual',
          status: 'partial',
          rowsTotal: mappedSkus.length + 3,
          rowsMatched: mappedSkus.length,
          rowsChanged: 0,
          rowsUnchanged: mappedSkus.length,
          rowsUnmatched: 3,
          rowsSkipped: 0,
          finishedAt: new Date(),
        },
      });
      sourceCount = 1;
    }

    // A second connection demonstrating Tier B (SaaS HTTP-API pull, docs/100 P5c):
    // a declarative endpoint + bearer auth + JSON field mapping. Manual-only
    // (syncIntervalSec 0) so the demo never reaches the placeholder endpoint; it
    // renders a real API connection in the sources list + detail, and the stored
    // secret is redacted by the API on read.
    await tx.inventorySource.deleteMany({ where: { tenantId, name: 'ERP API (NetSuite)' } });
    await tx.inventorySource.create({
      data: {
        tenantId,
        name: 'ERP API (NetSuite)',
        type: 'api',
        config: {
          endpoint: 'https://erp.example.com/api/v1/inventory',
          authScheme: 'bearer',
          apiKey: 'demo-token-do-not-use',
          itemsPath: 'data.items',
          skuField: 'sku',
          quantityField: 'quantityAvailable',
          locationField: 'location',
          costField: 'unitCost',
          costUnit: 'dollars',
          syncedAtField: 'lastModified',
          pageParam: 'page',
          maxPages: 10,
        },
        status: 'active',
        syncIntervalSec: 0,
        notes: 'Generic HTTP-API pull (Tier B) — demo config; manual sync only.',
      },
    });
    sourceCount += 1;

    // A third connection demonstrating Tier A (on-prem bridge agent, docs/100 P5d):
    // a LAN-only ERP (Fishbowl archetype) fed by the sparx Inventory Bridge over
    // outbound HTTPS. Seeded paired + online (a real api_keys row + a fresh
    // agentLastSeenAt) so the agent panel renders an "Online" agent.
    await tx.inventorySource.deleteMany({
      where: { tenantId, name: 'Fishbowl bridge (warehouse)' },
    });
    await tx.apiKey.deleteMany({
      where: { tenantId, name: 'Bridge: Fishbowl bridge (warehouse)' },
    });
    const bridgeKey = await tx.apiKey.create({
      data: {
        tenantId,
        name: 'Bridge: Fishbowl bridge (warehouse)',
        keyPrefix: 'sk_live_demo0001',
        keyHash: 'demo-seed-not-a-real-hash',
        scopes: ['inventory:push'],
      },
    });
    await tx.inventorySource.create({
      data: {
        tenantId,
        name: 'Fishbowl bridge (warehouse)',
        type: 'agent',
        config: {},
        status: 'active',
        syncIntervalSec: 300,
        apiKeyId: bridgeKey.id,
        apiKeyPrefix: bridgeKey.keyPrefix,
        enrolledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        agentLastSeenAt: new Date(),
        agentVersion: '0.1.0',
        lastSyncAt: new Date(),
        notes: 'On-prem bridge for the LAN-only ERP (Tier A demo).',
      },
    });
    sourceCount += 1;

    const variantCount = variantIdBySku.size;
    console.log(
      `Seeded demo inventory: ${DEMO_PRODUCTS.length} products / ${variantCount} variants across ` +
        `${DEMO_WAREHOUSES.length} warehouses, with ledger movements + ${DEMO_LOTS.length} lots, ` +
        `${DEMO_SUPPLIERS.length} suppliers + ${poDefs.length} purchase orders + ${receiptSeq} receipt` +
        ` + ${transferCount} transfer + ${sourceCount} sync source.`
    );
  });
}

// The platform COMPONENT catalog (docs/98 §5) — the GLOBAL platform_components table
// (no tenant_id). The published library IS the data-as-code PLATFORM_CATALOG, so the
// seed mirrors every entry in as a `published` row: this is what the
// `/v1/platform/catalog/*` API serves and what a future admin app lists. Idempotent
// upsert by key; descriptions are clamped to the column's 280-char bound. Authored by
// the reserved `system` id (the seed predates any real platform user). Stays in sync
// with the static catalog automatically — new catalog entries seed with no change here.
async function seedPlatformCatalog(): Promise<void> {
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

// ── Demo scheduling data (docs/79) ───────────────────────────────────────────
// Rich, industry-varied booking data for the e2e tenant so the Scheduling
// dashboard, the public /book page, and the availability engine all show real
// data locally. Idempotent: every demo row is tagged `settings.demo:'scheduling'`
// (or, for bookings, hangs off a demo service) and cleared up-front on re-run.

interface DemoResource {
  key: string;
  kind: 'staff' | 'space' | 'table' | 'equipment';
  name: string;
  color?: string;
  skillTags?: string[];
  capacityMin?: number;
  capacityMax?: number;
  // Weekly hours: days (0=Sun..6=Sat) + [startMinute, endMinute] in the resource zone.
  hours: { days: number[]; start: number; end: number };
}

interface DemoService {
  key: string;
  name: string;
  bookingType: 'appointment' | 'class' | 'reservation' | 'rental';
  durationMinutes: number;
  priceCents: number;
  capacity?: number;
  bufferAfterMin?: number;
  requiresApproval?: boolean;
  slotIntervalMin?: number;
  description: string;
  requirements: { role: string; kind: DemoResource['kind']; skillTags?: string[] }[];
}

interface DemoBooking {
  service: string;
  resources: string[]; // resource keys to allocate
  customerEmail: string;
  dayOffset: number;
  hour: number;
  minute?: number;
  status: 'requested' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  partySize?: number;
  extraAttendees?: number; // for classes
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];

const DEMO_RESOURCES: DemoResource[] = [
  {
    key: 'alex',
    kind: 'staff',
    name: 'Alex Rivera',
    color: '#6366F1',
    skillTags: ['haircut', 'color'],
    hours: { days: MON_SAT, start: 9 * 60, end: 17 * 60 },
  },
  {
    key: 'jordan',
    kind: 'staff',
    name: 'Jordan Lee',
    color: '#0EA5E9',
    skillTags: ['haircut', 'beard'],
    hours: { days: WEEKDAYS, start: 10 * 60, end: 18 * 60 },
  },
  {
    key: 'maya',
    kind: 'staff',
    name: 'Maya Patel',
    color: '#14B8A6',
    skillTags: ['massage', 'facial'],
    hours: { days: MON_SAT, start: 9 * 60, end: 16 * 60 },
  },
  {
    key: 'chris',
    kind: 'staff',
    name: 'Chris Doyle',
    color: '#F97316',
    skillTags: ['yoga', 'pilates'],
    hours: { days: MON_SAT, start: 7 * 60, end: 12 * 60 },
  },
  {
    key: 'studioA',
    kind: 'space',
    name: 'Studio A',
    color: '#8B5CF6',
    hours: { days: MON_SAT, start: 6 * 60, end: 21 * 60 },
  },
  {
    key: 'room1',
    kind: 'space',
    name: 'Treatment Room 1',
    color: '#06B6D4',
    hours: { days: MON_SAT, start: 9 * 60, end: 17 * 60 },
  },
  {
    key: 'table4',
    kind: 'table',
    name: 'Table 4',
    capacityMin: 1,
    capacityMax: 4,
    hours: { days: MON_SAT, start: 17 * 60, end: 22 * 60 },
  },
  {
    key: 'table8',
    kind: 'table',
    name: 'Table 8',
    capacityMin: 4,
    capacityMax: 8,
    hours: { days: MON_SAT, start: 17 * 60, end: 22 * 60 },
  },
  {
    key: 'kayak1',
    kind: 'equipment',
    name: 'Kayak #1',
    hours: { days: MON_SAT, start: 9 * 60, end: 17 * 60 },
  },
  {
    key: 'kayak2',
    kind: 'equipment',
    name: 'Kayak #2',
    hours: { days: MON_SAT, start: 9 * 60, end: 17 * 60 },
  },
];

const DEMO_SERVICES: DemoService[] = [
  {
    key: 'haircut',
    name: 'Haircut & Style',
    bookingType: 'appointment',
    durationMinutes: 45,
    priceCents: 4500,
    description: 'A cut and finish with one of our stylists.',
    requirements: [{ role: 'stylist', kind: 'staff', skillTags: ['haircut'] }],
  },
  {
    key: 'massage',
    name: 'Deep Tissue Massage (60 min)',
    bookingType: 'appointment',
    durationMinutes: 60,
    priceCents: 9500,
    bufferAfterMin: 15,
    description: 'A 60-minute therapeutic massage.',
    requirements: [{ role: 'therapist', kind: 'staff', skillTags: ['massage'] }],
  },
  {
    key: 'consult',
    name: 'New Client Consultation',
    bookingType: 'appointment',
    durationMinutes: 30,
    priceCents: 0,
    requiresApproval: true,
    description: 'A free 30-minute intro consultation (request — we confirm).',
    requirements: [{ role: 'staff', kind: 'staff' }],
  },
  {
    key: 'yoga',
    name: 'Morning Yoga Flow',
    bookingType: 'class',
    durationMinutes: 60,
    priceCents: 2200,
    capacity: 12,
    description: 'A 60-minute all-levels vinyasa class.',
    requirements: [
      { role: 'instructor', kind: 'staff', skillTags: ['yoga'] },
      { role: 'room', kind: 'space' },
    ],
  },
  {
    key: 'dinner',
    name: 'Dinner Reservation',
    bookingType: 'reservation',
    durationMinutes: 120,
    priceCents: 0,
    slotIntervalMin: 30,
    description: 'Reserve a table for dinner service.',
    requirements: [{ role: 'table', kind: 'table' }],
  },
  {
    key: 'kayak',
    name: 'Kayak Rental (2 hr)',
    bookingType: 'rental',
    durationMinutes: 120,
    priceCents: 4000,
    bufferAfterMin: 30,
    description: 'A two-hour single-kayak rental, paddle included.',
    requirements: [{ role: 'kayak', kind: 'equipment' }],
  },
];

const DEMO_CUSTOMERS = [
  { email: 'dana.wells@example.com', firstName: 'Dana', lastName: 'Wells', phone: '+15555550110' },
  { email: 'pat.kim@example.com', firstName: 'Pat', lastName: 'Kim', phone: '+15555550111' },
  { email: 'lee.ray@example.com', firstName: 'Lee', lastName: 'Ray', phone: '+15555550112' },
  { email: 'sam.ford@example.com', firstName: 'Sam', lastName: 'Ford', phone: '+15555550113' },
  { email: 'robin.cho@example.com', firstName: 'Robin', lastName: 'Cho', phone: '+15555550114' },
];

const DEMO_BOOKINGS: DemoBooking[] = [
  {
    service: 'haircut',
    resources: ['alex'],
    customerEmail: 'dana.wells@example.com',
    dayOffset: 1,
    hour: 10,
    status: 'confirmed',
  },
  {
    service: 'haircut',
    resources: ['jordan'],
    customerEmail: 'sam.ford@example.com',
    dayOffset: 1,
    hour: 11,
    status: 'confirmed',
  },
  {
    service: 'massage',
    resources: ['maya'],
    customerEmail: 'pat.kim@example.com',
    dayOffset: 2,
    hour: 14,
    status: 'confirmed',
  },
  {
    service: 'consult',
    resources: ['alex'],
    customerEmail: 'lee.ray@example.com',
    dayOffset: 3,
    hour: 13,
    status: 'requested',
  },
  {
    service: 'yoga',
    resources: ['chris', 'studioA'],
    customerEmail: 'robin.cho@example.com',
    dayOffset: 1,
    hour: 8,
    status: 'confirmed',
    extraAttendees: 6,
  },
  {
    service: 'dinner',
    resources: ['table4'],
    customerEmail: 'sam.ford@example.com',
    dayOffset: 0,
    hour: 19,
    status: 'confirmed',
    partySize: 3,
  },
  {
    service: 'kayak',
    resources: ['kayak1'],
    customerEmail: 'robin.cho@example.com',
    dayOffset: 4,
    hour: 10,
    status: 'confirmed',
  },
  {
    service: 'haircut',
    resources: ['alex'],
    customerEmail: 'pat.kim@example.com',
    dayOffset: -3,
    hour: 15,
    status: 'completed',
  },
  {
    service: 'massage',
    resources: ['maya'],
    customerEmail: 'dana.wells@example.com',
    dayOffset: -2,
    hour: 11,
    status: 'cancelled',
  },
];

function attendeeStatusFor(bookingStatus: DemoBooking['status']): string {
  switch (bookingStatus) {
    case 'completed':
      return 'attended';
    case 'in_progress':
      return 'checked_in';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'booked';
  }
}

function atUtc(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function seedDemoScheduling(tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

    const demoMarker = { path: ['demo'], equals: 'scheduling' };

    // Clear prior demo rows (bookings first — they reference resources/services).
    const priorServices = await tx.schedulingService.findMany({
      where: { settings: demoMarker },
      select: { id: true },
    });
    if (priorServices.length > 0) {
      await tx.booking.deleteMany({ where: { serviceId: { in: priorServices.map((s) => s.id) } } });
    }
    await tx.schedulingService.deleteMany({ where: { settings: demoMarker } });
    await tx.schedulingResource.deleteMany({ where: { settings: demoMarker } });

    // Resources + their weekly availability windows.
    const resourceIdByKey = new Map<string, string>();
    for (const r of DEMO_RESOURCES) {
      const res = await tx.schedulingResource.create({
        data: {
          tenantId,
          kind: r.kind,
          name: r.name,
          color: r.color ?? null,
          timezone: 'UTC',
          skillTags: r.skillTags ?? [],
          capacityMin: r.capacityMin ?? null,
          capacityMax: r.capacityMax ?? null,
          settings: { demo: 'scheduling' },
        },
      });
      resourceIdByKey.set(r.key, res.id);
      await tx.availabilityWindow.createMany({
        data: r.hours.days.map((dayOfWeek) => ({
          tenantId,
          resourceId: res.id,
          dayOfWeek,
          startMinute: r.hours.start,
          endMinute: r.hours.end,
        })),
      });
    }

    // Services (with their resource-role requirements).
    const serviceByKey = new Map<
      string,
      {
        id: string;
        durationMinutes: number;
        bufferAfterMin: number;
        bookingType: string;
        capacity: number;
      }
    >();
    for (const s of DEMO_SERVICES) {
      const svc = await tx.schedulingService.create({
        data: {
          tenantId,
          bookingType: s.bookingType,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          bufferAfterMin: s.bufferAfterMin ?? 0,
          priceCents: s.priceCents,
          capacity: s.capacity ?? 1,
          slotIntervalMin: s.slotIntervalMin ?? 15,
          requiresApproval: s.requiresApproval ?? false,
          resourceRequirements: s.requirements,
          settings: { demo: 'scheduling' },
        },
      });
      serviceByKey.set(s.key, {
        id: svc.id,
        durationMinutes: s.durationMinutes,
        bufferAfterMin: s.bufferAfterMin ?? 0,
        bookingType: s.bookingType,
        capacity: s.capacity ?? 1,
      });
    }

    // Demo customers (find-or-create by email — the shared customer spine).
    const customerIdByEmail = new Map<string, string>();
    for (const c of DEMO_CUSTOMERS) {
      const existing = await tx.customer.findFirst({
        where: { email: c.email },
        select: { id: true },
      });
      const id =
        existing?.id ??
        (
          await tx.customer.create({
            data: {
              tenantId,
              email: c.email,
              firstName: c.firstName,
              lastName: c.lastName,
              phone: c.phone,
              metadata: { source: 'scheduling-demo' },
            },
            select: { id: true },
          })
        ).id;
      customerIdByEmail.set(c.email, id);
    }

    // Bookings — direct inserts with their resource allocations + attendees. Times
    // are spaced so no exclusive resource overlaps (the no-overlap EXCLUDE holds).
    for (const b of DEMO_BOOKINGS) {
      const svc = serviceByKey.get(b.service);
      const customerId = customerIdByEmail.get(b.customerEmail);
      if (!svc || !customerId) continue;
      const startAt = atUtc(b.dayOffset, b.hour, b.minute ?? 0);
      const endAt = new Date(startAt.getTime() + svc.durationMinutes * 60_000);
      const spanEnd = new Date(endAt.getTime() + svc.bufferAfterMin * 60_000);
      const aStatus = attendeeStatusFor(b.status);

      const extraAttendees = Array.from({ length: b.extraAttendees ?? 0 }, () => ({
        tenantId,
        guestName: 'Class guest',
        partySize: 1,
        status: aStatus,
      }));

      await tx.booking.create({
        data: {
          tenantId,
          serviceId: svc.id,
          bookingType: svc.bookingType,
          status: b.status,
          startAt,
          endAt,
          timezone: 'UTC',
          capacity: svc.capacity,
          partySize: b.partySize ?? null,
          customerId,
          source: 'dashboard',
          ...(b.status === 'confirmed' || b.status === 'completed'
            ? { confirmedAt: new Date() }
            : {}),
          ...(b.status === 'completed' ? { completedAt: endAt } : {}),
          ...(b.status === 'cancelled' ? { cancelledAt: new Date() } : {}),
          resources: {
            create: b.resources.map((key) => ({
              tenantId,
              resourceId: resourceIdByKey.get(key)!,
              role: 'resource',
              startAt,
              endAt: spanEnd,
              exclusive: true,
              status: b.status,
            })),
          },
          attendees: {
            create: [
              { tenantId, customerId, partySize: b.partySize ?? 1, status: aStatus },
              ...extraAttendees,
            ],
          },
        },
      });
    }

    console.log(
      `Seeded demo scheduling: ${DEMO_SERVICES.length} services, ${DEMO_RESOURCES.length} resources, ${DEMO_BOOKINGS.length} bookings`
    );
  });
}

// ─── Demo commerce operations ─────────────────────────────────────────
// Reviews, Q&A, bundles, configurator, shipping/tax config, markup +
// surcharge rules, and a wholesale price list — all hung off whatever
// catalog the inventory seed created (queried at run time) so the
// moderation queues, pricing, and shipping/tax surfaces show real, varied
// data locally (docs/105 walk-through). Pairs with seedDemoFitment +
// seedDemoOrders (wave 2): when those have run first, customer-authored
// reviews here pin to a settled order → "Verified purchase".
// Idempotent: clears the tenant's prior demo ops, recreates.
interface ReviewSpec {
  rating: number;
  title: string;
  body: string;
  status: string;
  author: string | null;
  useCustomer?: boolean;
  response?: string;
  helpful: number;
  daysAgo: number;
}

// A deliberate spread of statuses (the queue = pending + flagged), empty vs.
// present titles (titles are optional on the storefront form), guest vs.
// customer authors, and a few merchant responses.
const REVIEW_SPECS: ReviewSpec[] = [
  {
    rating: 5,
    title: 'Exactly what I needed',
    body: 'Showed up a day early and works perfectly. Would buy again without hesitation.',
    status: 'approved',
    author: 'Marcus T.',
    response: 'Thanks so much, Marcus — glad it landed early!',
    helpful: 8,
    daysAgo: 21,
  },
  {
    rating: 4,
    title: '',
    body: 'Works great. Shipping was a little slow but no real complaints for the price.',
    status: 'approved',
    author: 'Priya R.',
    helpful: 3,
    daysAgo: 18,
  },
  {
    rating: 2,
    title: 'Smaller than I expected',
    body: 'The listing photos made it look bigger. It’s fine, just measure first.',
    status: 'flagged',
    author: 'J. Rivera',
    helpful: 1,
    daysAgo: 14,
  },
  {
    rating: 5,
    title: '',
    body: 'Second one I’ve bought. Love it.',
    status: 'pending',
    author: 'anon shopper',
    helpful: 0,
    daysAgo: 6,
  },
  {
    rating: 1,
    title: 'Arrived damaged',
    body: 'Box was crushed and the item was cracked. Disappointed.',
    status: 'pending',
    author: 'Dana K.',
    helpful: 0,
    daysAgo: 4,
  },
  {
    rating: 3,
    title: 'It’s okay',
    body: 'Does the job but nothing special. Middle of the road.',
    status: 'pending',
    author: null,
    useCustomer: true,
    helpful: 2,
    daysAgo: 3,
  },
  {
    rating: 5,
    title: 'Best purchase this year',
    body: 'Genuinely impressed with the quality. Recommending to everyone.',
    status: 'approved',
    author: null,
    useCustomer: true,
    response: 'You made our day — thank you!',
    helpful: 11,
    daysAgo: 25,
  },
  {
    rating: 4,
    title: '',
    body: 'check out cheapdeals dot example for coupons!!',
    status: 'rejected',
    author: 'promo123',
    helpful: 0,
    daysAgo: 9,
  },
  {
    rating: 5,
    title: 'Highly recommend',
    body: 'Exceeded expectations. Packaging was thoughtful too.',
    status: 'approved',
    author: 'Sam W.',
    helpful: 5,
    daysAgo: 16,
  },
  {
    rating: 2,
    title: '',
    body: 'Color didn’t match the photos at all — more grey than blue.',
    status: 'flagged',
    author: 'Lee H.',
    helpful: 4,
    daysAgo: 11,
  },
  {
    rating: 4,
    title: 'Solid',
    body: 'Good build quality, fair price. Took off one star for the instructions.',
    status: 'pending',
    author: 'Chris P.',
    helpful: 1,
    daysAgo: 2,
  },
  {
    rating: 5,
    title: 'Will buy again',
    body: 'Third order from this shop and they never miss. Fast and reliable.',
    status: 'approved',
    author: null,
    useCustomer: true,
    response: 'We appreciate the loyalty!',
    helpful: 7,
    daysAgo: 28,
  },
];

interface QuestionSpec {
  body: string;
  status: string;
  author: string | null;
  useCustomer?: boolean;
  answer?: string;
  daysAgo: number;
}

const QUESTION_SPECS: QuestionSpec[] = [
  {
    body: 'Does this come with batteries, or do I need to buy them separately?',
    status: 'published',
    author: 'Renee',
    answer: 'Great question — two AA batteries are included in the box.',
    daysAgo: 20,
  },
  { body: 'Is this dishwasher safe?', status: 'pending', author: 'Tom B.', daysAgo: 5 },
  {
    body: 'What does the warranty cover and how long is it?',
    status: 'published',
    author: null,
    useCustomer: true,
    answer: 'It carries a 1-year limited warranty covering manufacturing defects.',
    daysAgo: 17,
  },
  {
    body: 'Can I use this outdoors / is it weather resistant?',
    status: 'pending',
    author: 'Gabriela',
    daysAgo: 3,
  },
  {
    body: 'BUY FOLLOWERS cheap — click my profile',
    status: 'rejected',
    author: 'spammer',
    daysAgo: 8,
  },
  {
    body: 'Do you ship to Canada, and how long does it usually take?',
    status: 'published',
    author: 'Marc',
    answer: 'Yes — we ship across North America; Canada is typically 7–12 business days.',
    daysAgo: 13,
  },
  {
    body: 'How big is it exactly? The dimensions aren’t in the description.',
    status: 'pending',
    author: null,
    useCustomer: true,
    daysAgo: 2,
  },
  {
    body: 'Is a refill available to buy on its own later?',
    status: 'pending',
    author: 'Yusuf',
    daysAgo: 1,
  },
];

async function seedDemoCommerceOps(tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

    const products = await tx.product.findMany({
      where: { tenantId, deletedAt: null },
      include: { variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });
    const catalog = products.filter((p) => p.variants.length > 0);
    if (catalog.length === 0) {
      console.warn('[seed] commerce-ops skipped: no products with variants');
      return;
    }
    const owner = await tx.user.findFirst({ where: { tenantId, role: 'owner' } });
    const customers = await tx.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      take: 8,
    });

    // Verified-purchase linkage (wave 2): pull settled orders + their line
    // items so customer-authored reviews can carry an orderId + be pinned to
    // a product the reviewer actually bought (→ "Verified purchase" badge).
    // Falls back gracefully when the orders seed hasn't run.
    const settledOrders = await tx.order.findMany({
      where: { tenantId, status: { in: ['delivered', 'fulfilled'] } },
      include: {
        items: { where: { productId: { not: null } }, take: 5, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { placedAt: 'desc' },
      take: 16,
    });
    const ordersByCustomer = new Map<string, typeof settledOrders>();
    for (const o of settledOrders) {
      const arr = ordersByCustomer.get(o.customerId) ?? [];
      arr.push(o);
      ordersByCustomer.set(o.customerId, arr);
    }
    // Customers who actually have a settled order — every customer-authored
    // review pins to one of these (cycled), so each carries a real orderId →
    // "Verified purchase". Falls back to any customer when none have orders.
    const buyerCustomers =
      ordersByCustomer.size > 0
        ? await tx.customer.findMany({
            where: { tenantId, id: { in: [...ordersByCustomer.keys()] } },
          })
        : [];
    let buyerCursor = 0;

    // Idempotent reset (FK cascades clear children: media/votes/log,
    // components, options/rules/add-ons, rates, entries).
    await tx.productReview.deleteMany({ where: { tenantId } });
    await tx.productQuestion.deleteMany({ where: { tenantId } });
    await tx.bundle.deleteMany({ where: { tenantId } });
    await tx.configurationTemplate.deleteMany({ where: { tenantId } });
    await tx.shippingRate.deleteMany({ where: { tenantId } });
    await tx.shippingZone.deleteMany({ where: { tenantId } });
    await tx.shippingProfile.deleteMany({ where: { tenantId } });
    await tx.taxZone.deleteMany({ where: { tenantId } });
    await tx.markupRule.deleteMany({ where: { tenantId } });
    await tx.surchargeRule.deleteMany({ where: { tenantId } });
    await tx.priceList.deleteMany({ where: { tenantId } });

    // ── Reviews ──────────────────────────────────────────────────────
    for (let i = 0; i < REVIEW_SPECS.length; i++) {
      const s = REVIEW_SPECS[i]!;
      const customer = !s.useCustomer
        ? undefined
        : buyerCustomers.length > 0
          ? buyerCustomers[buyerCursor++ % buyerCustomers.length]!
          : customers.length > 0
            ? customers[i % customers.length]
            : undefined;

      // Verified purchase: if the chosen customer has a settled order, pin
      // the review to a product they actually bought + carry the orderId.
      let productId = catalog[i % catalog.length]!.id;
      let orderId: string | null = null;
      const custOrders = customer ? ordersByCustomer.get(customer.id) : undefined;
      if (custOrders && custOrders.length > 0) {
        const o = custOrders[i % custOrders.length]!;
        const boughtProductId = o.items.find((it) => it.productId)?.productId;
        if (boughtProductId) {
          productId = boughtProductId;
          orderId = o.id;
        }
      }

      const moderated = s.status !== 'pending';
      await tx.productReview.create({
        data: {
          tenantId,
          productId,
          orderId,
          rating: s.rating,
          title: s.title,
          body: s.body,
          status: s.status,
          displayName: customer ? null : s.author,
          customerId: customer?.id ?? null,
          helpfulCount: s.helpful,
          ...(moderated
            ? {
                moderatedAt: daysAgoDate(Math.max(s.daysAgo - 1, 0)),
                moderatedBy: owner?.id ?? null,
              }
            : {}),
          ...(s.response
            ? {
                response: s.response,
                responseAuthorId: owner?.id ?? null,
                respondedAt: daysAgoDate(Math.max(s.daysAgo - 2, 0)),
              }
            : {}),
          createdAt: daysAgoDate(s.daysAgo),
        },
      });
    }

    // ── Q&A ──────────────────────────────────────────────────────────
    for (let i = 0; i < QUESTION_SPECS.length; i++) {
      const s = QUESTION_SPECS[i]!;
      const product = catalog[i % catalog.length]!;
      const customer =
        s.useCustomer && customers.length > 0 ? customers[i % customers.length] : undefined;
      const question = await tx.productQuestion.create({
        data: {
          tenantId,
          productId: product.id,
          body: s.body,
          status: s.status,
          displayName: customer ? null : s.author,
          customerId: customer?.id ?? null,
          createdAt: daysAgoDate(s.daysAgo),
        },
      });
      if (s.answer) {
        await tx.productAnswer.create({
          data: {
            tenantId,
            questionId: question.id,
            body: s.answer,
            isOfficial: true,
            authorUserId: owner?.id ?? null,
            createdAt: daysAgoDate(Math.max(s.daysAgo - 1, 0)),
          },
        });
      }
    }

    // ── Bundles ──────────────────────────────────────────────────────
    // Use distinct products as wrappers; pull components from other products'
    // first variants. Scales down gracefully on a thin catalog.
    const bundlePlans = [
      {
        pricingMode: 'fixed',
        fixedPriceCents: 4999,
        percentOffSum: null,
        inventoryMode: 'decrement_components',
      },
      {
        pricingMode: 'percent_off_sum',
        fixedPriceCents: null,
        percentOffSum: 15,
        inventoryMode: 'decrement_components',
      },
      {
        pricingMode: 'sum_of_components',
        fixedPriceCents: null,
        percentOffSum: null,
        inventoryMode: 'decrement_bundle_sku',
      },
    ];
    for (let b = 0; b < bundlePlans.length && b < catalog.length; b++) {
      const wrapper = catalog[b]!;
      const componentProducts = catalog.filter((_, idx) => idx !== b).slice(0, 3);
      if (componentProducts.length === 0) break;
      const plan = bundlePlans[b]!;
      const bundle = await tx.bundle.create({
        data: {
          tenantId,
          bundleProductId: wrapper.id,
          pricingMode: plan.pricingMode,
          fixedPriceCents: plan.fixedPriceCents,
          percentOffSum: plan.percentOffSum,
          inventoryMode: plan.inventoryMode,
        },
      });
      for (let c = 0; c < componentProducts.length; c++) {
        await tx.bundleComponent.create({
          data: {
            tenantId,
            bundleId: bundle.id,
            variantId: componentProducts[c]!.variants[0]!.id,
            defaultQuantity: c === 0 ? 2 : 1,
            isRequired: c < 2,
            isSwappable: c === 2,
            position: c,
          },
        });
      }
    }

    // ── Configurator ─────────────────────────────────────────────────
    const configProduct = catalog[catalog.length - 1]!;
    const template = await tx.configurationTemplate.create({
      data: {
        tenantId,
        productId: configProduct.id,
        name: `Build your ${configProduct.title}`,
        description: 'Pick a size and finish; rules apply add-ons and price adjustments.',
        status: 'active',
        layout: { steps: [{ key: 'options', label: 'Options' }] },
      },
    });
    await tx.configurationOption.create({
      data: {
        tenantId,
        templateId: template.id,
        key: 'size',
        label: 'Size',
        type: 'single_choice',
        required: true,
        defaultChoiceKeys: ['m'],
        position: 0,
        choices: [
          { key: 's', label: 'Small', position: 0 },
          { key: 'm', label: 'Medium', position: 1 },
          { key: 'l', label: 'Large', position: 2 },
          { key: 'xl', label: 'Extra Large', position: 3, priceDeltaCents: 300 },
        ],
      },
    });
    await tx.configurationOption.create({
      data: {
        tenantId,
        templateId: template.id,
        key: 'finish',
        label: 'Finish',
        type: 'color_swatch',
        required: true,
        defaultChoiceKeys: ['matte-black'],
        position: 1,
        choices: [
          { key: 'matte-black', label: 'Matte Black', swatchHex: '#111111', position: 0 },
          { key: 'silver', label: 'Brushed Silver', swatchHex: '#C0C0C0', position: 1 },
          { key: 'navy', label: 'Navy', swatchHex: '#1e3a8a', position: 2 },
        ],
      },
    });
    await tx.configurationRule.create({
      data: {
        tenantId,
        templateId: template.id,
        name: 'XL upcharge',
        match: 'all',
        conditions: [{ optionKey: 'size', op: 'in', value: ['xl'] }],
        actions: [{ kind: 'price_adjust', deltaCents: 300, label: 'XL size' }],
        priority: 0,
      },
    });
    await tx.configurationAddOn.create({
      data: {
        tenantId,
        templateId: template.id,
        variantId: configProduct.variants[0]!.id,
        defaultIncluded: false,
        priceOverrideCents: 500,
        position: 0,
      },
    });

    // ── Shipping ─────────────────────────────────────────────────────
    const domesticZone = await tx.shippingZone.create({
      data: { tenantId, name: 'Domestic (US)', priority: 0, targeting: { countries: ['US'] } },
    });
    const intlZone = await tx.shippingZone.create({
      data: {
        tenantId,
        name: 'International',
        priority: 1,
        targeting: { countries: ['CA', 'GB', 'AU'] },
      },
    });
    const stdProfile = await tx.shippingProfile.create({
      data: {
        tenantId,
        name: 'Standard parcel',
        description: 'Default profile for non-hazmat parcel shipments.',
        allowedCarrierServices: [],
        hazmatClassesAllowed: ['none'],
        requiresSignature: false,
        requiresFreight: false,
      },
    });
    await tx.shippingRate.createMany({
      data: [
        {
          tenantId,
          zoneId: domesticZone.id,
          profileId: stdProfile.id,
          name: 'Standard',
          type: 'flat',
          amountCents: 599,
          currency: 'USD',
          carrier: 'usps',
          estimatedDeliveryDays: 5,
        },
        {
          tenantId,
          zoneId: domesticZone.id,
          profileId: stdProfile.id,
          name: 'Free over $50',
          type: 'free_above_threshold',
          freeAboveCents: 5000,
          currency: 'USD',
          estimatedDeliveryDays: 5,
        },
        {
          tenantId,
          zoneId: domesticZone.id,
          profileId: stdProfile.id,
          name: 'Express',
          type: 'flat',
          amountCents: 1499,
          currency: 'USD',
          carrier: 'ups',
          estimatedDeliveryDays: 2,
        },
        {
          tenantId,
          zoneId: intlZone.id,
          profileId: stdProfile.id,
          name: 'International flat',
          type: 'flat',
          amountCents: 2499,
          currency: 'USD',
          estimatedDeliveryDays: 12,
        },
      ],
    });

    // ── Tax ──────────────────────────────────────────────────────────
    const taxZones = [
      {
        region: 'US-CA',
        nexusType: 'physical',
        name: 'California Sales Tax',
        rateBasisPoints: 825,
      },
      { region: 'US-TX', nexusType: 'economic', name: 'Texas Sales Tax', rateBasisPoints: 625 },
      { region: 'US-NY', nexusType: 'economic', name: 'New York Sales Tax', rateBasisPoints: 400 },
    ];
    for (const z of taxZones) {
      const zone = await tx.taxZone.create({
        data: { tenantId, country: 'US', region: z.region, nexusType: z.nexusType, isActive: true },
      });
      await tx.taxRate.create({
        data: {
          tenantId,
          zoneId: zone.id,
          name: z.name,
          rateBasisPoints: z.rateBasisPoints,
          appliesToShipping: false,
        },
      });
    }

    // ── Markup rules ─────────────────────────────────────────────────
    await tx.markupRule.createMany({
      data: [
        {
          tenantId,
          name: 'Standard catalog markup',
          method: 'percentage',
          value: 40,
          costBasis: 'variant_cost',
          appliesTo: 'catalog',
          priority: 0,
          isActive: true,
          recomputeMode: 'auto',
        },
        {
          tenantId,
          name: 'Premium line — 2× cost',
          method: 'multiplier',
          value: 2.0,
          costBasis: 'variant_cost',
          appliesTo: 'scope',
          priority: 10,
          isActive: true,
          recomputeMode: 'auto',
        },
        {
          tenantId,
          name: 'Clearance — 15% margin target',
          method: 'margin_target',
          value: 15,
          costBasis: 'variant_cost',
          floorMargin: 10,
          appliesTo: 'catalog',
          priority: 5,
          isActive: false,
          recomputeMode: 'review',
        },
      ],
    });

    // ── Surcharge rules ──────────────────────────────────────────────
    await tx.surchargeRule.createMany({
      data: [
        {
          tenantId,
          name: 'Card processing surcharge',
          type: 'percentage',
          value: 2.9,
          basis: 'total',
          paymentMethods: ['card'],
          appliesTo: 'both',
          label: 'Processing fee',
          capCents: 1000,
          isActive: true,
        },
        {
          tenantId,
          name: 'Small order handling',
          type: 'flat',
          value: 2.5,
          basis: 'subtotal',
          paymentMethods: ['card'],
          appliesTo: 'checkout',
          label: 'Handling fee',
          isActive: false,
        },
      ],
    });

    // ── Wholesale price list ─────────────────────────────────────────
    const priceList = await tx.priceList.create({
      data: {
        tenantId,
        name: 'Wholesale tier',
        description: 'B2B portal pricing for approved wholesale accounts.',
        currency: 'USD',
        channel: 'b2b_portal',
        priority: 10,
        status: 'active',
      },
    });
    const entryVariants = catalog.flatMap((p) => p.variants).slice(0, 5);
    for (let i = 0; i < entryVariants.length; i++) {
      await tx.priceListEntry.create({
        data: {
          tenantId,
          priceListId: priceList.id,
          variantId: entryVariants[i]!.id,
          percentOffList: i % 2 === 0 ? 20 : null,
          fixedPriceCents: i % 2 === 0 ? null : 1999,
          minQuantity: i % 2 === 0 ? 1 : 12,
        },
      });
    }

    console.log(
      `[seed] commerce-ops: ${REVIEW_SPECS.length} reviews, ${QUESTION_SPECS.length} questions, bundles, configurator, shipping/tax, markup/surcharge, price list`
    );
  });
}

// ─── Demo fitment (wave 3) ──────────────────────────────────
// Install the Vehicle dictionary tenant-scoped on the diesel tenant — the
// SAME platform dictionary (@sparx/commerce-schemas FITMENT_DICTIONARIES) and
// the SAME stamping codepath (planFitmentDictionaryRows) the dashboard install
// uses, so the seeded tree and an installed tree are identical. There is no
// platform-global Vehicle domain anymore; nothing fitment-shaped exists until a
// tenant installs a dictionary. Then link the diesel catalog to vehicle fitment
// rows (keyword → make/model/engine) via ProductFitment.

// Catalog → vehicle fitment rules. Matched at runtime by a keyword in the
// product title; absent item/variant widen the rule (fluids fit a whole
// make). Years are the generation spans for each engine platform.
interface FitmentRule {
  keyword: string;
  makeSlug: string;
  modelSlug?: string;
  engineSlug?: string;
  yearMin: number;
  yearMax: number;
}
const FITMENT_RULES: FitmentRule[] = [
  {
    keyword: '6.7L Power Stroke',
    makeSlug: 'ford',
    modelSlug: 'f-250-super-duty',
    engineSlug: '6-7l-power-stroke',
    yearMin: 2011,
    yearMax: 2022,
  },
  {
    keyword: '6.0L Power Stroke',
    makeSlug: 'ford',
    modelSlug: 'f-250-super-duty',
    engineSlug: '6-0l-power-stroke',
    yearMin: 2003,
    yearMax: 2007,
  },
  {
    keyword: '7.3L Power Stroke',
    makeSlug: 'ford',
    modelSlug: 'f-350-super-duty',
    engineSlug: '7-3l-power-stroke',
    yearMin: 1999,
    yearMax: 2003,
  },
  {
    keyword: '6.7L Cummins',
    makeSlug: 'ram',
    modelSlug: '2500',
    engineSlug: '6-7l-cummins',
    yearMin: 2007,
    yearMax: 2018,
  },
  {
    keyword: 'Duramax LML',
    makeSlug: 'chevrolet',
    modelSlug: 'silverado-2500hd',
    engineSlug: '6-6l-duramax-lml',
    yearMin: 2011,
    yearMax: 2016,
  },
  {
    keyword: '6.6L Duramax',
    makeSlug: 'chevrolet',
    modelSlug: 'silverado-2500hd',
    engineSlug: '6-6l-duramax-l5p',
    yearMin: 2017,
    yearMax: 2024,
  },
  // Fluids / belts fit the whole make (category-only rule, no item/variant).
  { keyword: 'Diesel Engine Oil', makeSlug: 'ford', yearMin: 1999, yearMax: 2024 },
  { keyword: 'Coolant', makeSlug: 'ram', yearMin: 2003, yearMax: 2024 },
];

async function seedDemoFitment(tenantId: string): Promise<void> {
  const vehicle = getFitmentDictionary('vehicle');
  if (!vehicle) throw new Error('[seed] vehicle fitment dictionary missing');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

    // Idempotent reset: drop this tenant's product links + fitment domains
    // (cascades the node tree). Nothing is global to clear.
    await tx.productFitment.deleteMany({ where: { tenantId } });
    await tx.fitmentDomain.deleteMany({ where: { tenantId } });

    // Stamp the Vehicle dictionary as a tenant-scoped domain + node tree via the
    // shared planner — identical to installFitmentDictionary's codepath.
    const planned = planFitmentDictionaryRows(vehicle, tenantId, () => randomUUID());
    await tx.fitmentDomain.create({
      data: {
        id: planned.domain.id,
        tenantId,
        slug: planned.domain.slug,
        displayName: planned.domain.displayName,
        description: planned.domain.description,
        iconKey: planned.domain.iconKey,
        dimensions: planned.domain.dimensions,
        position: planned.domain.position,
      },
    });
    await tx.fitmentNode.createMany({
      data: planned.nodes.map((n) => ({
        id: n.id,
        tenantId,
        domainId: n.domainId,
        parentId: n.parentId,
        dimensionKey: n.dimensionKey,
        name: n.name,
        slug: n.slug,
        attributes: n.attributes,
        path: n.path,
        pathNames: n.pathNames,
        depth: n.depth,
        position: n.position,
      })),
    });

    // Link the diesel catalog to vehicle fitment by title keyword. Scope to the
    // inventory demo products so stray test products don't pick up fitment.
    const inventoryProducts = await tx.product.findMany({
      where: { tenantId, deletedAt: null, metadata: { path: ['demo'], equals: 'inventory' } },
      select: { id: true, title: true },
    });
    const products =
      inventoryProducts.length > 0
        ? inventoryProducts
        : await tx.product.findMany({
            where: { tenantId, deletedAt: null },
            select: { id: true, title: true },
          });

    const yearKey = planned.index.rangeKeys[0] ?? 'year';
    let linkCount = 0;
    for (const product of products) {
      for (const rule of FITMENT_RULES) {
        if (!product.title.includes(rule.keyword)) continue;
        // Resolve the deepest available node by slug path (make/model/engine);
        // a rule with only a make attaches at the make node (universal fit).
        const slugPath = [rule.makeSlug, rule.modelSlug, rule.engineSlug].filter(Boolean).join('/');
        const nodeId =
          planned.index.nodeIdByPath[slugPath] ?? planned.index.nodeIdByPath[rule.makeSlug] ?? null;
        if (!nodeId) continue;
        await tx.productFitment.create({
          data: {
            tenantId,
            productId: product.id,
            domainId: planned.index.domainId,
            nodeId,
            notes: rule.modelSlug
              ? null
              : `Universal fit across all ${rule.makeSlug.toUpperCase()} diesel platforms`,
            ranges: {
              create: [{ tenantId, dimensionKey: yearKey, min: rule.yearMin, max: rule.yearMax }],
            },
          },
        });
        linkCount += 1;
      }
    }

    const makeCount = planned.nodes.filter((n) => n.depth === 0).length;
    const engineCount = planned.nodes.filter((n) => n.depth === 2).length;
    console.log(
      `[seed] fitment: installed Vehicle dictionary (${makeCount} makes, ${engineCount} engines), ${linkCount} product links`
    );
  });
}

// ─── Demo orders + returns (wave 2) ───────────────────────────────────
// A retail customer → order → line-item → return chain off the seeded
// catalog so the Orders, Returns, and Customers surfaces show real data —
// and so reviews can be Verified purchases (seedDemoCommerceOps reads these
// back). Orders span the lifecycle (placed/fulfilled/delivered/cancelled/
// refunded); returns span requested→approved→received→inspecting→refunded
// with inspections + a shipping label on the settled ones. Denormalized
// customer stats (totalSpent/orderCount/…) are computed here because no
// order-event consumer runs against a seed DB — without it the CRM list
// reads zeros. Idempotent: clears prior demo orders + all returns, recreates.
interface OrderCustomerSpec {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
}
const ORDER_CUSTOMERS: OrderCustomerSpec[] = [
  {
    email: 'marcus.bell@fleetlogix.example',
    firstName: 'Marcus',
    lastName: 'Bell',
    phone: '+1-208-555-0142',
    line1: '1840 Industrial Pkwy',
    city: 'Boise',
    region: 'ID',
    postalCode: '83702',
  },
  {
    email: 'dana.whitfield@example.com',
    firstName: 'Dana',
    lastName: 'Whitfield',
    phone: '+1-509-555-0188',
    line1: '67 Cedar Hollow Rd',
    city: 'Spokane',
    region: 'WA',
    postalCode: '99201',
  },
  {
    email: 'rafael.ortiz@haulpro.example',
    firstName: 'Rafael',
    lastName: 'Ortiz',
    phone: '+1-505-555-0119',
    line1: '2204 Mesa Verde Blvd',
    city: 'Albuquerque',
    region: 'NM',
    postalCode: '87102',
  },
  {
    email: 'priya.nair@example.com',
    firstName: 'Priya',
    lastName: 'Nair',
    phone: '+1-512-555-0173',
    line1: '915 Lakeline Dr',
    city: 'Austin',
    region: 'TX',
    postalCode: '78717',
  },
  {
    email: 'glen.hartman@summitfreight.example',
    firstName: 'Glen',
    lastName: 'Hartman',
    phone: '+1-701-555-0156',
    line1: '430 Prairie Ridge Ave',
    city: 'Fargo',
    region: 'ND',
    postalCode: '58103',
  },
  {
    email: 'tessa.boone@example.com',
    firstName: 'Tessa',
    lastName: 'Boone',
    phone: '+1-615-555-0124',
    line1: '78 Riverbend Ct',
    city: 'Nashville',
    region: 'TN',
    postalCode: '37209',
  },
];

interface OrderSpec {
  customerIdx: number;
  status: string;
  paymentStatus: string;
  daysAgo: number;
  lineCount: number;
  shipFlat: number;
}
// Lifecycle spread; the delivered/fulfilled ones (≥1 per buyer) back the
// returns + verified reviews.
const ORDER_SPECS: OrderSpec[] = [
  {
    customerIdx: 0,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 34,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 0,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 12,
    lineCount: 1,
    shipFlat: 9.95,
  },
  {
    customerIdx: 1,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 27,
    lineCount: 3,
    shipFlat: 0,
  },
  {
    customerIdx: 2,
    status: 'delivered',
    paymentStatus: 'paid',
    daysAgo: 19,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 3,
    status: 'fulfilled',
    paymentStatus: 'paid',
    daysAgo: 6,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 4,
    status: 'fulfilled',
    paymentStatus: 'paid',
    daysAgo: 4,
    lineCount: 1,
    shipFlat: 9.95,
  },
  {
    customerIdx: 5,
    status: 'placed',
    paymentStatus: 'paid',
    daysAgo: 2,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 1,
    status: 'placed',
    paymentStatus: 'unpaid',
    daysAgo: 1,
    lineCount: 1,
    shipFlat: 9.95,
  },
  {
    customerIdx: 2,
    status: 'cancelled',
    paymentStatus: 'unpaid',
    daysAgo: 9,
    lineCount: 2,
    shipFlat: 14.5,
  },
  {
    customerIdx: 3,
    status: 'refunded',
    paymentStatus: 'refunded',
    daysAgo: 22,
    lineCount: 1,
    shipFlat: 9.95,
  },
];

interface ReturnSpec {
  orderIdx: number;
  status: string;
  preferredOutcome: string;
  requestedBy: string;
  reasonCode: string;
  daysAgo: number;
  refund?: { restockingFeeCents: number; issuedAs: string };
  inspection?: { condition: string; restockable: boolean; note: string };
  label?: { provider: string; tracking: string };
}
const RETURN_SPECS: ReturnSpec[] = [
  {
    orderIdx: 0,
    status: 'requested',
    preferredOutcome: 'refund',
    requestedBy: 'customer',
    reasonCode: 'wrong_item',
    daysAgo: 5,
  },
  {
    orderIdx: 2,
    status: 'approved',
    preferredOutcome: 'exchange',
    requestedBy: 'customer',
    reasonCode: 'defective',
    daysAgo: 8,
    label: { provider: 'ups', tracking: '1Z999AA10123456784' },
  },
  {
    orderIdx: 3,
    status: 'received',
    preferredOutcome: 'refund',
    requestedBy: 'customer',
    reasonCode: 'not_as_described',
    daysAgo: 11,
    label: { provider: 'fedex', tracking: '7712 3456 7890' },
  },
  {
    orderIdx: 1,
    status: 'inspecting',
    preferredOutcome: 'account_credit',
    requestedBy: 'staff',
    reasonCode: 'damaged_in_transit',
    daysAgo: 6,
    inspection: {
      condition: 'damaged',
      restockable: false,
      note: 'Housing cracked in transit; not resellable.',
    },
  },
  {
    orderIdx: 0,
    status: 'refunded',
    preferredOutcome: 'refund',
    requestedBy: 'customer',
    reasonCode: 'no_longer_needed',
    daysAgo: 30,
    refund: { restockingFeeCents: 500, issuedAs: 'original_payment' },
    inspection: {
      condition: 'unopened',
      restockable: true,
      note: 'Sealed, returned to MAIN stock.',
    },
  },
];

async function seedDemoOrders(tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

    // Prefer the coherent diesel inventory catalog (metadata.demo='inventory')
    // so orders read as a real auto-parts shop's; fall back to the broad
    // catalog only if the inventory seed hasn't populated it.
    const inventoryProducts = await tx.product.findMany({
      where: { tenantId, deletedAt: null, metadata: { path: ['demo'], equals: 'inventory' } },
      include: { variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    const broadProducts =
      inventoryProducts.length > 0
        ? inventoryProducts
        : await tx.product.findMany({
            where: { tenantId, deletedAt: null },
            include: { variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
            orderBy: { createdAt: 'asc' },
            take: 30,
          });
    const catalog = broadProducts.filter((p) => p.variants.length > 0);
    if (catalog.length === 0) {
      console.warn('[seed] orders skipped: no products with variants');
      return;
    }
    const property = await tx.property.findFirst({
      where: { tenantId, isPrimary: true },
      select: { id: true },
    });
    const propertyId = property?.id ?? null;
    const round2 = (n: number): number => Math.round(n * 100) / 100;
    const TAX_RATE = 0.0825;

    // Idempotent reset: all returns (cascades line items/inspections/labels),
    // then this seed's orders (metadata marker; cascades order items).
    await tx.returnRequest.deleteMany({ where: { tenantId } });
    await tx.order.deleteMany({
      where: { tenantId, metadata: { path: ['source'], equals: 'orders-demo' } },
    });

    // Customers + a default address (find-or-create by email; idempotent).
    const customerIds: string[] = [];
    for (const c of ORDER_CUSTOMERS) {
      let customer = await tx.customer.findFirst({
        where: { email: c.email },
        select: { id: true },
      });
      customer ??= await tx.customer.create({
        data: {
          tenantId,
          propertyId,
          type: 'retail',
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          metadata: { source: 'orders-demo' },
        },
        select: { id: true },
      });
      customerIds.push(customer.id);
      const hasAddress = await tx.customerAddress.findFirst({
        where: { customerId: customer.id },
        select: { id: true },
      });
      if (!hasAddress) {
        await tx.customerAddress.create({
          data: {
            tenantId,
            customerId: customer.id,
            type: 'both',
            isDefault: true,
            recipientName: `${c.firstName} ${c.lastName}`,
            line1: c.line1,
            city: c.city,
            region: c.region,
            postalCode: c.postalCode,
            country: 'US',
            phone: c.phone,
          },
        });
      }
    }

    // Orders + line items.
    interface CreatedOrder {
      id: string;
      customerId: string;
      status: string;
      total: number;
      placedAt: Date;
      itemIds: { id: string; productId: string | null; name: string }[];
    }
    const created: CreatedOrder[] = [];
    for (let i = 0; i < ORDER_SPECS.length; i++) {
      const spec = ORDER_SPECS[i]!;
      const customerIdx = spec.customerIdx % customerIds.length;
      const customerId = customerIds[customerIdx]!;
      const cust = ORDER_CUSTOMERS[customerIdx]!;
      const placedAt = daysAgoDate(spec.daysAgo);

      const lines = Array.from({ length: spec.lineCount }, (_, j) => {
        const product = catalog[(i + j) % catalog.length]!;
        const variant = product.variants[0]!;
        const quantity = ((i + j) % 2) + 1;
        const unitPrice = round2(variant.priceCents / 100);
        const lineSubtotal = round2(unitPrice * quantity);
        const taxAmount = round2(lineSubtotal * TAX_RATE);
        return {
          productId: product.id,
          variantId: variant.id,
          sku: variant.sku,
          name: variant.title ? `${product.title} — ${variant.title}` : product.title,
          quantity,
          unitPrice,
          lineSubtotal,
          taxAmount,
          lineTotal: round2(lineSubtotal + taxAmount),
        };
      });

      const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
      const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
      const total = round2(subtotal + taxTotal + spec.shipFlat);
      const paid = spec.paymentStatus === 'paid';
      const refunded = spec.status === 'refunded';
      const fulfilledStates = ['fulfilled', 'delivered'];
      const shippingAddress = {
        recipientName: `${cust.firstName} ${cust.lastName}`,
        line1: cust.line1,
        city: cust.city,
        region: cust.region,
        postalCode: cust.postalCode,
        country: 'US',
      };

      const order = await tx.order.create({
        data: {
          tenantId,
          customerId,
          propertyId,
          orderNumber: `SO-${1001 + i}`,
          status: spec.status,
          paymentStatus: spec.paymentStatus,
          channel: 'storefront',
          source: 'sparx_market',
          subtotal,
          taxTotal,
          shippingTotal: spec.shipFlat,
          total,
          amountPaid: paid ? total : 0,
          refundTotal: refunded ? total : 0,
          currency: 'USD',
          shippingAddress,
          billingAddress: shippingAddress,
          placedAt,
          paidAt: paid ? placedAt : null,
          fulfilledAt: fulfilledStates.includes(spec.status) ? daysAgoDate(spec.daysAgo - 1) : null,
          deliveredAt: spec.status === 'delivered' ? daysAgoDate(spec.daysAgo - 3) : null,
          cancelledAt: spec.status === 'cancelled' ? daysAgoDate(spec.daysAgo - 1) : null,
          cancelledReason: spec.status === 'cancelled' ? 'Customer changed order' : null,
          refundedAt: refunded ? daysAgoDate(spec.daysAgo - 2) : null,
          metadata: { source: 'orders-demo' },
          createdAt: placedAt,
          items: {
            create: lines.map((l) => ({
              tenantId,
              productId: l.productId,
              variantId: l.variantId,
              sku: l.sku,
              name: l.name,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineSubtotal: l.lineSubtotal,
              taxAmount: l.taxAmount,
              lineTotal: l.lineTotal,
              quantityFulfilled: fulfilledStates.includes(spec.status) ? l.quantity : 0,
            })),
          },
        },
        select: { id: true, items: { select: { id: true, productId: true, name: true } } },
      });
      created.push({
        id: order.id,
        customerId,
        status: spec.status,
        total,
        placedAt,
        itemIds: order.items,
      });
    }

    // Denormalized customer stats from settled (paid, non-cancelled) orders.
    for (const customerId of customerIds) {
      const own = created.filter(
        (o) => o.customerId === customerId && o.status !== 'cancelled' && o.status !== 'refunded'
      );
      if (own.length === 0) continue;
      const totalSpent = round2(own.reduce((s, o) => s + o.total, 0));
      const dates = own.map((o) => o.placedAt).sort((a, b) => a.getTime() - b.getTime());
      await tx.customer.update({
        where: { id: customerId },
        data: {
          orderCount: own.length,
          totalSpent,
          firstOrderAt: dates[0],
          lastOrderAt: dates[dates.length - 1],
        },
      });
    }

    // Returns referencing real orders + order items.
    const owner = await tx.user.findFirst({ where: { tenantId, role: 'owner' } });
    let returnCount = 0;
    for (const spec of RETURN_SPECS) {
      const order = created[spec.orderIdx];
      if (!order || order.itemIds.length === 0) continue;
      const line = order.itemIds[0]!;
      const settled = spec.status === 'refunded';
      const approvedStates = ['approved', 'received', 'inspecting', 'inspected', 'refunded'];
      const isApproved = approvedStates.includes(spec.status);
      const requestedAt = daysAgoDate(spec.daysAgo);
      const lineUnitCents = Math.round((order.total / Math.max(order.itemIds.length, 1)) * 100);

      const ret = await tx.returnRequest.create({
        data: {
          tenantId,
          orderId: order.id,
          requestedBy: spec.requestedBy,
          status: spec.status,
          preferredOutcome: spec.preferredOutcome,
          staffNote:
            spec.requestedBy === 'staff' ? 'Opened by support after the customer called in.' : null,
          ...(settled
            ? {
                refundedAmountCents: Math.max(
                  lineUnitCents - (spec.refund?.restockingFeeCents ?? 0),
                  0
                ),
                restockingFeeCents: spec.refund?.restockingFeeCents ?? 0,
                refundIssuedAs: spec.refund?.issuedAs ?? 'original_payment',
                refundedAt: daysAgoDate(spec.daysAgo - 4),
              }
            : {}),
          ...(isApproved
            ? { approvedBy: owner?.id ?? null, approvedAt: daysAgoDate(spec.daysAgo - 1) }
            : {}),
          ...(['received', 'inspecting', 'inspected', 'refunded'].includes(spec.status)
            ? { receivedAt: daysAgoDate(spec.daysAgo - 2) }
            : {}),
          createdAt: requestedAt,
          items: {
            create: [
              {
                tenantId,
                orderItemId: line.id,
                quantity: 1,
                approvedQuantity: isApproved ? 1 : 0,
                reasonCode: spec.reasonCode,
                customerNote: 'Please advise on next steps — thanks.',
              },
            ],
          },
        },
        select: { id: true, items: { select: { id: true } } },
      });

      if (spec.inspection && ret.items[0]) {
        await tx.returnInspection.create({
          data: {
            tenantId,
            returnId: ret.id,
            returnLineItemId: ret.items[0].id,
            condition: spec.inspection.condition,
            restockable: spec.inspection.restockable,
            note: spec.inspection.note,
            inspectedBy: owner?.id ?? null,
            createdAt: daysAgoDate(spec.daysAgo - 3),
          },
        });
      }
      if (spec.label) {
        await tx.returnLabel.create({
          data: {
            tenantId,
            returnId: ret.id,
            providerSlug: spec.label.provider,
            labelRef: `RMA-${order.id.slice(0, 8)}`,
            trackingNumber: spec.label.tracking,
            costCents: 895,
            createdAt: daysAgoDate(spec.daysAgo - 1),
          },
        });
      }
      returnCount += 1;
    }

    console.log(
      `[seed] orders: ${ORDER_CUSTOMERS.length} retail customers, ${created.length} orders, ${returnCount} returns`
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
      // Scheduling (docs/79) — enabled so the dashboard surfaces + the public
      // /book page exercise against the seeded demo bookings/services/resources.
      scheduling: { enabled: true },
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

  // Demo fitment (docs/105 wave 2) — populates the global Vehicle hierarchy +
  // tenant Device/Pet/Apparel domains, then links the catalog. Runs after the
  // inventory catalog (needs products) and before commerce-ops. Idempotent.
  try {
    await seedDemoFitment(tenant.id);
  } catch (err) {
    console.warn(
      `[seed] demo fitment seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Demo orders + returns (docs/105 wave 2) — retail customers → orders → line
  // items → returns off the catalog. Runs before commerce-ops so reviews can
  // link a settled order (Verified purchase). Idempotent.
  try {
    await seedDemoOrders(tenant.id);
  } catch (err) {
    console.warn(
      `[seed] demo orders seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Demo commerce operations (reviews, Q&A, bundles, configurator, shipping/tax
  // config, markup/surcharge rules, wholesale price list) hung off the inventory
  // catalog so the moderation queues + pricing/shipping surfaces show real data.
  // Idempotent; wrapped so a hiccup never blocks the rest of the seed.
  try {
    await seedDemoCommerceOps(tenant.id);
  } catch (err) {
    console.warn(
      `[seed] demo commerce-ops seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Demo scheduling data (docs/79) — services/resources/availability/bookings so
  // the Scheduling dashboard + the public /book page show real data locally.
  // Idempotent; wrapped so a hiccup never blocks the rest of the seed.
  try {
    await seedDemoScheduling(tenant.id);
  } catch (err) {
    console.warn(
      `[seed] demo scheduling seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Demo in-product feedback (docs/112) — a handful of submissions in varied
  // states, two with staff replies + an unread flag, so the feedback button dot,
  // history list, status badges, and thread view all show real data locally.
  try {
    await seedDemoFeedback(tenant.id);
  } catch (err) {
    console.warn(
      `[seed] demo feedback seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // sparx-core marketplace catalog (docs/60) — platform data, independent of the
  // e2e tenant. Wrapped so a catalog hiccup never blocks the rest of the seed.
  try {
    await seedMarketplaceCatalog();
  } catch (err) {
    console.warn(
      `[seed] marketplace catalog seed skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Platform component catalog (docs/98 §5) — global platform data, independent of
  // any tenant. Wrapped so a catalog hiccup never blocks the rest of the seed.
  try {
    await seedPlatformCatalog();
  } catch (err) {
    console.warn(
      `[seed] platform catalog seed skipped: ${err instanceof Error ? err.message : String(err)}`
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

// Demo in-product feedback (docs/112). A spread of categories, sources, and
// lifecycle states for the tenant's owner — two carry a staff reply (one unread)
// so the dashboard's unread dot + thread view have something to show. Idempotent:
// skips when the tenant already has feedback.
async function seedDemoFeedback(tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

    const existing = await tx.feedbackSubmission.count({ where: { tenantId } });
    if (existing > 0) return;

    const owner = await tx.user.findFirst({ where: { tenantId, role: 'owner' } });
    if (!owner) return;

    const submitter = { name: owner.name ?? 'Owner', email: owner.email };
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const ctx = (route: string, module: string | null, section: string | null) => ({
      route,
      routePattern: route,
      module,
      section,
      entity: null,
      pageTitle: 'sparx',
      device: 'desktop' as const,
      theme: 'light' as const,
      locale: 'en-US',
      appVersion: 'dev',
    });

    // 1 — an idea, planned (no reply yet).
    await tx.feedbackSubmission.create({
      data: {
        tenantId,
        userId: owner.id,
        submitterName: submitter.name,
        submitterEmail: submitter.email,
        source: 'button',
        category: 'idea',
        subject: 'Bulk-edit product prices',
        body: 'It would save me a ton of time to select multiple products and adjust prices together.',
        status: 'planned',
        context: ctx('/commerce/products', 'commerce', 'products'),
        createdAt: daysAgo(12),
        updatedAt: daysAgo(8),
      },
    });

    // 2 — a problem, shipped, WITH a staff reply marked unread (lights the dot).
    const fixed = await tx.feedbackSubmission.create({
      data: {
        tenantId,
        userId: owner.id,
        submitterName: submitter.name,
        submitterEmail: submitter.email,
        source: 'button',
        category: 'problem',
        subject: 'CSV import failed silently',
        body: 'I uploaded a customer CSV and nothing happened — no error, no rows. Took me a while to notice.',
        status: 'shipped',
        context: ctx('/crm/customers', 'crm', 'customers'),
        lastResponseAt: daysAgo(1),
        userUnread: true,
        createdAt: daysAgo(6),
        updatedAt: daysAgo(1),
      },
    });
    await tx.feedbackMessage.create({
      data: {
        tenantId,
        submissionId: fixed.id,
        authorKind: 'staff',
        authorId: owner.id,
        authorName: 'Brandon',
        body: 'Thanks for the detailed report — we shipped a fix that now surfaces import errors inline. Give it another try!',
        createdAt: daysAgo(1),
      },
    });

    // 3 — a question, answered (read), with a back-and-forth.
    const answered = await tx.feedbackSubmission.create({
      data: {
        tenantId,
        userId: owner.id,
        submitterName: submitter.name,
        submitterEmail: submitter.email,
        source: 'command',
        category: 'question',
        subject: 'Can I schedule a discount in advance?',
        body: 'Is there a way to set a discount to start automatically next Monday?',
        status: 'answered',
        context: ctx('/commerce/discounts', 'commerce', 'discounts'),
        lastResponseAt: daysAgo(3),
        userUnread: false,
        createdAt: daysAgo(4),
        updatedAt: daysAgo(3),
      },
    });
    await tx.feedbackMessage.createMany({
      data: [
        {
          tenantId,
          submissionId: answered.id,
          authorKind: 'staff',
          authorId: owner.id,
          authorName: 'Brandon',
          body: 'Yes — when creating a discount, set the "Starts" date to next Monday and it activates automatically.',
          createdAt: daysAgo(3),
        },
        {
          tenantId,
          submissionId: answered.id,
          authorKind: 'user',
          authorId: owner.id,
          authorName: submitter.name,
          body: 'Perfect, found it. Thank you!',
          createdAt: daysAgo(3),
        },
      ],
    });

    // 4 — praise via the pulse, brand new.
    await tx.feedbackSubmission.create({
      data: {
        tenantId,
        userId: owner.id,
        submitterName: submitter.name,
        submitterEmail: submitter.email,
        source: 'pulse',
        category: 'praise',
        sentiment: 4,
        body: 'The new dashboard is so much faster. Loving it.',
        status: 'new',
        context: ctx('/', null, null),
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
    });

    console.log(`Seeded demo feedback for tenant ${tenantId}`);
  });
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
