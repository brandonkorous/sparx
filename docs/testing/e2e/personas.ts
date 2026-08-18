/**
 * Manual/agent-driven e2e test personas for local dev.
 *
 * Not wired into any workspace tsconfig/build — this is reference data for
 * driving the app by hand (or via the playwright-cli skill), not a package
 * import. Pair with checklist.md, which maps features to the personas below.
 *
 * Credential convention follows wizeworks/packages/db/prisma/seed.ts
 * (`e2e-*@sparx.test`) so these are recognizable as disposable dev/test
 * accounts, never real ones. Passwords are plaintext by design — same as
 * the existing seed — because this is dev-only, non-prod data.
 *
 * Module keys are exactly the ModuleSlug union from wizeworks/packages/modules/src/index.ts:
 * builder | commerce | cms | crm | email | b2b | invoicing | dropship |
 * inventory | chat | ai | scheduling
 *
 * Two rules from wizeworks/packages/modules that shape the combos below:
 *   - `b2b` requires `commerce` to be on.
 *   - `invoicing` and `inventory` are bundled-free (auto-enabled) whenever
 *     `commerce` or `b2b` is on — listed explicitly below anyway so each
 *     persona's module list is self-contained and copy-pasteable into the
 *     onboarding wizard's module-picker step.
 */

export type ModuleSlug =
  | 'builder'
  | 'commerce'
  | 'cms'
  | 'crm'
  | 'email'
  | 'b2b'
  | 'invoicing'
  | 'dropship'
  | 'inventory'
  | 'chat'
  | 'ai'
  | 'scheduling';

/** Matches the industry starter keys in wizeworks/services/api-rest/src/lib/industry-starters.ts */
export type IndustryStarter =
  | 'apparel'
  | 'food'
  | 'electronics'
  | 'auto-parts'
  | 'salon'
  | 'fitness'
  | 'professional'
  | 'wholesale'
  | 'generic';

export interface StaffAccount {
  name: string;
  email: string;
  password: string;
  /** Org role to assign after signup, via team settings if not default owner. */
  role: 'owner' | 'admin' | 'member';
}

export interface ShopperAccount {
  name: string;
  email: string;
  password: string;
}

export interface Company {
  contactName: string;
  email: string;
  password: string;
  accountType: 'net-terms' | 'prepay';
}

export interface Persona {
  id: string;
  businessName: string;
  industryStarter: IndustryStarter;
  tenantSlug: string;
  modules: ModuleSlug[];
  staff: StaffAccount;
  /** Present only when `commerce` is enabled — used to test storefront checkout. */
  shopper?: ShopperAccount;
  /** Present only when `b2b` is enabled — used to test the wholesale portal. */
  company?: Company;
  /** What this persona is specifically for — read before testing, not a UI label. */
  purpose: string;
}

const PASSWORD = 'Sparx-E2E-2026!';

export const PERSONAS: Persona[] = [
  {
    id: 'apparel-co',
    businessName: 'Everson Apparel Co.',
    industryStarter: 'apparel',
    tenantSlug: 'everson-apparel',
    modules: ['builder', 'commerce', 'cms', 'email', 'inventory', 'invoicing'],
    staff: {
      name: 'Jordan Everson',
      email: 'e2e-apparel-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: { name: 'Casey Rivera', email: 'e2e-apparel-shopper@sparx.test', password: PASSWORD },
    purpose:
      "Baseline retail path: product catalog with variants, blog/CMS content marketing, full checkout, and order lifecycle. The 'nothing unusual enabled' control persona.",
  },
  {
    id: 'food-bistro',
    businessName: 'Sable & Thyme Bistro',
    industryStarter: 'food',
    tenantSlug: 'sable-thyme',
    modules: ['builder', 'commerce', 'cms', 'email', 'crm', 'scheduling', 'inventory', 'invoicing'],
    staff: {
      name: 'Priya Nandakumar',
      email: 'e2e-food-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: { name: 'Marcus Webb', email: 'e2e-food-shopper@sparx.test', password: PASSWORD },
    purpose:
      'Commerce + scheduling coexisting (online ordering AND table reservations/bookings), plus CRM for guest history. Tests that scheduling availability/booking flows work independent of the commerce cart.',
  },
  {
    id: 'electronics-hub',
    businessName: 'Circuit & Byte Electronics',
    industryStarter: 'electronics',
    tenantSlug: 'circuit-byte',
    modules: ['builder', 'commerce', 'cms', 'dropship', 'inventory', 'invoicing', 'ai', 'chat'],
    staff: {
      name: 'Wei Zhang',
      email: 'e2e-electronics-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: {
      name: 'Dana Okafor',
      email: 'e2e-electronics-shopper@sparx.test',
      password: PASSWORD,
    },
    purpose:
      'Dropship supplier/product sourcing pipeline alongside owned inventory, plus AI product Q&A (MCP tools) and live chat support widget on the storefront.',
  },
  {
    id: 'auto-parts-fleet',
    businessName: 'Ironclad Fleet Supply',
    industryStarter: 'auto-parts',
    tenantSlug: 'ironclad-fleet',
    modules: ['commerce', 'b2b', 'crm', 'inventory', 'invoicing'],
    staff: {
      name: 'Renée Castillo',
      email: 'e2e-autoparts-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: { name: 'Tom Bricker', email: 'e2e-autoparts-shopper@sparx.test', password: PASSWORD },
    company: {
      contactName: 'Alicia Munroe',
      email: 'e2e-autoparts-b2b@sparx.test',
      password: PASSWORD,
      accountType: 'net-terms',
    },
    purpose:
      "B2B fleet-account path: net-terms wholesale account, quotes/approval-queue, fitment search. This is the one auto-parts persona — don't let it become the default lens for other tests.",
  },
  {
    id: 'salon-spa',
    businessName: 'Lumen Salon & Spa',
    industryStarter: 'salon',
    tenantSlug: 'lumen-salon',
    modules: ['builder', 'cms', 'crm', 'email', 'scheduling'],
    staff: {
      name: 'Fatima Al-Sayed',
      email: 'e2e-salon-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    purpose:
      'Pure services business with NO commerce module: booking calendar, resources/staff availability, waitlist, service catalog, client CRM. No shopper account — verify commerce/inventory/b2b/dropship routes 404 for this tenant.',
  },
  {
    id: 'fitness-studio',
    businessName: 'Forge Fitness Studio',
    industryStarter: 'fitness',
    tenantSlug: 'forge-fitness',
    modules: ['builder', 'commerce', 'cms', 'crm', 'email', 'scheduling', 'inventory', 'invoicing'],
    staff: {
      name: 'Devon Marsh',
      email: 'e2e-fitness-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: { name: 'Yuki Tanaka', email: 'e2e-fitness-shopper@sparx.test', password: PASSWORD },
    purpose:
      'Class-pack commerce (recurring/subscription-shaped products) sold alongside merch, plus class-series scheduling and waitlists. Tests scheduling + commerce sharing a single checkout.',
  },
  {
    id: 'consulting-group',
    businessName: 'Halden Consulting Group',
    industryStarter: 'professional',
    tenantSlug: 'halden-consulting',
    modules: ['builder', 'cms', 'crm', 'email', 'ai'],
    staff: {
      name: 'Grace Halden',
      email: 'e2e-consulting-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    purpose:
      'Lead-gen-only professional services site: no commerce at all. Tests the CMS-and-CRM-only path (deal pipeline from contact form submissions) plus AI content tools. Confirms commerce/inventory/b2b/dropship/scheduling all correctly 404.',
  },
  {
    id: 'wholesale-distributor',
    businessName: 'Northgate Wholesale Distributors',
    industryStarter: 'wholesale',
    tenantSlug: 'northgate-wholesale',
    modules: ['commerce', 'b2b', 'crm', 'invoicing', 'inventory', 'dropship'],
    staff: {
      name: 'Omar Haddad',
      email: 'e2e-wholesale-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: {
      name: 'Lena Brookfield',
      email: 'e2e-wholesale-shopper@sparx.test',
      password: PASSWORD,
    },
    company: {
      contactName: 'Carter Diaz',
      email: 'e2e-wholesale-b2b@sparx.test',
      password: PASSWORD,
      accountType: 'prepay',
    },
    purpose:
      'Heaviest B2B combo: pricing tiers, approval queue, invoicing documents/workflows, and dropship suppliers feeding B2B catalog. Also covers a prepay (vs. net-terms) B2B account type as a contrast to the auto-parts persona.',
  },
  {
    id: 'bookkeeping-micro',
    businessName: 'Quill & Ledger Bookkeeping',
    industryStarter: 'generic',
    tenantSlug: 'quill-ledger',
    modules: ['crm', 'email'],
    staff: {
      name: 'Nadia Petrov',
      email: 'e2e-bookkeeping-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    purpose:
      'Minimal-footprint CRM-only micro-business, no site at all: contacts/deals/tasks and email campaigns only. Sharpest gating test — builder/cms/commerce/everything-else must all 404, and the dashboard nav must not show their entries.',
  },
  {
    id: 'content-publisher',
    businessName: 'Aster & Bloom Studio',
    industryStarter: 'generic',
    tenantSlug: 'aster-bloom',
    modules: ['builder', 'cms'],
    staff: {
      name: 'Iris Novak',
      email: 'e2e-content-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    purpose:
      'Content-only publisher, no CRM/commerce/email at all: site builder + CMS blog/pages only. Confirms the platform is a first-class publishing tool with zero selling assumption baked in.',
  },
  {
    id: 'outdoor-ai-chat',
    businessName: 'Vantage Outdoor Co.',
    industryStarter: 'generic',
    tenantSlug: 'vantage-outdoor',
    modules: ['builder', 'commerce', 'cms', 'chat', 'ai', 'inventory', 'invoicing'],
    staff: {
      name: 'Sam Okonkwo',
      email: 'e2e-outdoor-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: { name: 'Beth Callahan', email: 'e2e-outdoor-shopper@sparx.test', password: PASSWORD },
    purpose:
      'AI/MCP + live chat focus on top of standard retail: MCP tool invocation against the live catalog, chat inbox routing, and how AI answers interact with real inventory/pricing.',
  },
  {
    id: 'kitchen-sink',
    businessName: 'Meridian Group',
    industryStarter: 'generic',
    tenantSlug: 'meridian-group',
    modules: [
      'builder',
      'commerce',
      'cms',
      'crm',
      'email',
      'b2b',
      'invoicing',
      'dropship',
      'inventory',
      'chat',
      'ai',
      'scheduling',
    ],
    staff: {
      name: 'Ravi Chandrasekhar',
      email: 'e2e-kitchensink-staff@sparx.test',
      password: PASSWORD,
      role: 'owner',
    },
    shopper: {
      name: 'Emma Sørensen',
      email: 'e2e-kitchensink-shopper@sparx.test',
      password: PASSWORD,
    },
    company: {
      contactName: 'Julian Ferreira',
      email: 'e2e-kitchensink-b2b@sparx.test',
      password: PASSWORD,
      accountType: 'net-terms',
    },
    purpose:
      'Every module on at once. Tests cross-module integration and settings > modules toggling (activate/deactivate live), not any single feature in isolation. Use last, after every other persona has passed its own checklist.',
  },
];
