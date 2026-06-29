// Demo tenant registry (docs/104, Wave 6) — data-as-code specs for the varied
// multi-tenant demo `seedTenant` stands up. The whole point: Sparx is content
// AND/OR commerce, never one vertical, so the spread is deliberate — two retail
// shops, a services salon, a B2B distributor, a professional consultancy, and a
// content-only publisher (no commerce at all). No diesel/auto-parts here; that's
// one client, not the platform's face.
//
// Each spec drives the REAL provisioning path (modules → activation → industry
// starter → blueprint → sample data). `industry` is BOTH the starter slug and the
// sample-pack key (shared vocabulary). `modules` are only the PROVIDER flags the
// user would flip — inventory/invoicing ride along free with commerce/b2b
// (BUNDLED_FREE), so they're never listed. blueprintKey resolves from the
// marketplace catalog when ingested, and skips cleanly otherwise.

import type { ModuleSlug } from '@sparx/auth';

import type { SeedTenantSpec } from './seed-tenant.js';

/** Shared password for every demo owner — these are throwaway local/demo logins. */
export const DEMO_OWNER_PASSWORD = 'demo-password-2026';
const DEMO_EMAIL_DOMAIN = 'demo.sparx.test';

function spec(
  slug: string,
  name: string,
  ownerName: string,
  industry: string,
  modules: ModuleSlug[],
  blueprintKey: string
): SeedTenantSpec {
  return {
    slug,
    name,
    ownerName,
    ownerEmail: `owner@${slug}.${DEMO_EMAIL_DOMAIN}`,
    ownerPassword: DEMO_OWNER_PASSWORD,
    industry,
    modules,
    blueprintKey,
    sampleData: true,
  };
}

export const DEMO_TENANTS: SeedTenantSpec[] = [
  // Retail apparel boutique — the classic storefront.
  spec(
    'demo-apparel',
    'Threadline',
    'Maya Chen',
    'apparel',
    ['builder', 'commerce', 'cms', 'crm', 'email'],
    'forge'
  ),
  // Specialty food shop — catalog + recipes content + a newsletter.
  spec(
    'demo-pantry',
    'Harvest Pantry',
    'Diego Romero',
    'food',
    ['builder', 'commerce', 'cms', 'crm', 'email'],
    'farm-fresh'
  ),
  // Appointment-based salon/spa — scheduling-forward, retail on the side.
  spec(
    'demo-salon',
    'Lumen Studio',
    'Priya Anand',
    'salon',
    ['builder', 'scheduling', 'commerce', 'crm', 'cms', 'email'],
    'mosaic'
  ),
  // B2B distributor — wholesale tiers, approvals, quotes; invoicing/inventory ride free.
  spec(
    'demo-supply',
    'Atlas Supply Co',
    'Marcus Webb',
    'wholesale',
    ['builder', 'commerce', 'b2b', 'crm', 'cms', 'email'],
    'tempo'
  ),
  // Professional services consultancy — booking + quote/subscription invoicing.
  spec(
    'demo-studio',
    'Northwind Studio',
    'Lena Osei',
    'professional',
    ['builder', 'scheduling', 'commerce', 'crm', 'cms', 'email'],
    'tempo'
  ),
  // Content-only publisher — NO commerce. Proves CMS/CRM/email stand alone; the
  // sample pack's articles + audience load while catalog/orders stay gated off.
  spec(
    'demo-notes',
    'Circuit Notes',
    'Sam Tully',
    'electronics',
    ['builder', 'cms', 'crm', 'email'],
    'tempo'
  ),
];

/** One demo spec by slug, or undefined. */
export function getDemoTenant(slug: string): SeedTenantSpec | undefined {
  return DEMO_TENANTS.find((t) => t.slug === slug);
}
