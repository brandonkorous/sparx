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
// (BUNDLED_FREE), so they're never listed.
//
// blueprintKey is EMPTY on every spec right now, and that is not an oversight: the
// four legacy bundles these pointed at (forge / farm-fresh / mosaic / tempo) were
// authored as `BuilderNode` manifests, which the silica-native blueprint schema no
// longer accepts, so they were removed rather than left to fail ingest. Demo tenants
// still provision fully through the industry starter + sample pack; they just get no
// template look until silica-native bundles exist. Point a spec at one by name then.

import type { ModuleSlug } from '@wizeworks/auth';

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
  blueprintKey: string,
  /** Brand + zone overrides. Omit for sparx — provisioning's own fallback. */
  brand?: { platformBrand: string; zoneDomain: string }
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
    ...brand,
  };
}

/** Piggles tenants live on their own zone and carry their own brand. Declared
 *  once here so a spec states WHICH product it belongs to and nothing has to
 *  branch on the answer (piggles/CLAUDE.md RULE #0 — the value is data, and no
 *  shared package may read it as a condition). */
const PIGGLES = { platformBrand: 'piggles', zoneDomain: 'piggles.site' } as const;

export const DEMO_TENANTS: SeedTenantSpec[] = [
  // Retail apparel boutique that ALSO books tailoring + styling appointments — the
  // service side many apparel shops run but never think of as "scheduling." Its
  // pack authors no bookable services, so this exercises the scheduling fallback:
  // the engine seeds the apparel-flavored calendar (Personal styling / Alterations).
  spec(
    'demo-apparel',
    'Threadline',
    'Maya Chen',
    'apparel',
    ['builder', 'commerce', 'scheduling', 'cms', 'crm', 'email'],
    ''
  ),
  // Specialty food shop — catalog + recipes content + a newsletter.
  spec(
    'demo-pantry',
    'Harvest Pantry',
    'Diego Romero',
    'food',
    ['builder', 'commerce', 'cms', 'crm', 'email'],
    ''
  ),
  // Appointment-based salon/spa — scheduling-forward, retail on the side.
  spec(
    'demo-salon',
    'Lumen Studio',
    'Priya Anand',
    'salon',
    ['builder', 'scheduling', 'commerce', 'crm', 'cms', 'email'],
    ''
  ),
  // B2B distributor — wholesale tiers, approvals, quotes; invoicing/inventory ride free.
  spec(
    'demo-supply',
    'Atlas Supply Co',
    'Marcus Webb',
    'wholesale',
    ['builder', 'commerce', 'b2b', 'crm', 'cms', 'email'],
    ''
  ),
  // Professional services consultancy — booking + quote/subscription invoicing.
  spec(
    'demo-studio',
    'Northwind Studio',
    'Lena Osei',
    'professional',
    ['builder', 'scheduling', 'commerce', 'crm', 'cms', 'email'],
    ''
  ),
  // Content-only publisher — NO commerce. Proves CMS/CRM/email stand alone; the
  // sample pack's articles + audience load while catalog/orders stay gated off.
  spec(
    'demo-notes',
    'Circuit Notes',
    'Sam Tully',
    'electronics',
    ['builder', 'cms', 'crm', 'email'],
    ''
  ),
  // ── Piggles ────────────────────────────────────────────────────────────────
  //
  // Wildroot Flowers is the workspace the Piggles marketing site already names:
  // the home page's film runs a Thursday through a window titled "Wildroot
  // Flowers", and /how-it-works types it into the depicted signup field. It
  // existed as a name in two React files and nowhere in the database, which is
  // fine for a drawing and useless the moment you want to photograph the real
  // product.
  //
  // EVERY MODULE, because Piggles has no tiers — one flat plan with all fifteen
  // apps included (piggles/CLAUDE.md RULE #2). A Piggles demo tenant with a
  // subset of modules would be depicting a product that does not exist. This is
  // the one spec in this file where the module list is not a choice.
  spec(
    'wildroot-flowers',
    'Wildroot Flowers',
    'Sena Marchetti',
    'florist',
    ['builder', 'commerce', 'scheduling', 'cms', 'crm', 'email', 'b2b', 'ai'],
    '',
    PIGGLES
  ),
];

/** One demo spec by slug, or undefined. */
export function getDemoTenant(slug: string): SeedTenantSpec | undefined {
  return DEMO_TENANTS.find((t) => t.slug === slug);
}
