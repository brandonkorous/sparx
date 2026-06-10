// Dev seed — idempotent: re-running upserts in place, so it's safe to call
// `pnpm --filter @sparx/db db:seed` repeatedly.
//
// Creates the "E2E Store" tenant with one staff user
// (e2e-staff@sparx.test / e2e-test-password) — these credentials are baked
// into Playwright tests and any local dashboard smoke test. The password hash
// is produced by Better Auth's own hasher (scrypt, via better-auth/crypto) so
// the seeded credential row verifies against the live sign-in flow.

import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { listBlueprints, type Blueprint } from '@sparx/blueprints';

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
      };
      await tx.marketplaceBlueprint.upsert({
        where: { slug: bp.key },
        update: shared,
        create: { slug: bp.key, publishedAt: new Date(), ...shared },
      });
    }

    // Themes — slug = @sparx/site-themes preset key; tokens NULL (resolved by
    // slug, like blueprints). Curated marketplace copy + facets from SPARX_THEMES.
    for (const t of SPARX_THEMES) {
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

    console.log(
      `Seeded marketplace catalog: ${listBlueprints().length} blueprint(s), ${SPARX_THEMES.length} theme(s).`
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

  // Sparx-core marketplace catalog (docs/60) — platform data, independent of the
  // e2e tenant. Wrapped so a catalog hiccup never blocks the rest of the seed.
  try {
    await seedMarketplaceCatalog();
  } catch (err) {
    console.warn(
      `[seed] marketplace catalog seed skipped: ${err instanceof Error ? err.message : String(err)}`
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
