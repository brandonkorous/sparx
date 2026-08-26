// The module price catalog + the pure billing math (docs/17 §2, docs/67 §1/§7).
//
// MODULE_MONTHLY_CENTS is the source of truth for "what a plan costs" in our own
// UI and the transaction-fee tiering — it does NOT depend on Stripe being wired,
// so the dashboard and fee math work in dev and before the prod ops land. The
// Stripe Price IDs (priceIdFor) are the prod-only Secret-Manager values that the
// actual subscription items reference.

import type { ModuleSlug } from '@wizeworks/modules';

export type BillingInterval = 'monthly' | 'annual';

// Monthly list price (cents) per billable module. A module with NO entry is not
// separately billed (`builder` is the only always-cheap base). Invoicing ($19),
// Inventory ($29) and Finance ($29) carry a standalone list price but are
// BUNDLED_FREE with Commerce/B2B — the bundling is handled by the module graph,
// not here: a bundled tenant simply never has an explicit flag for the
// capability, so no Stripe item is created. A WMS-only tenant that turns
// Inventory on without Commerce/B2B is billed the $29 standalone price.
export const MODULE_MONTHLY_CENTS: Partial<Record<ModuleSlug, number>> = {
  builder: 1000,
  commerce: 4900,
  cms: 4900,
  crm: 4900,
  email: 2900,
  b2b: 9900,
  ai: 4900,
  dropship: 2900,
  inventory: 2900,
  invoicing: 1900,
  chat: 1900,
  scheduling: 2900,
  // Spend tracking + profitability (docs/148 §2). Same tier as inventory and
  // scheduling. Priced to attach broadly rather than to extract: it is the first
  // module that is useful to EVERY tenant regardless of what else they run — a
  // CMS-only publisher pays rent, a CRM-only team buys software — so the price
  // should never be the reason someone says no. This is the price a tenant with
  // NEITHER selling module pays; Commerce/B2B bundle it free (BUNDLED_FREE),
  // because profit is revenue minus spend and they already bought the revenue.
  finance: 2900,
  // Staff (docs/149 §2) — the same $29 tier, and deliberately NOT bundled with
  // finance in either direction: the two are independently valuable, and "finance
  // now, staff makes it sharper" is a far easier second sale than one large module
  // that has to be right all at once. Also deliberately NOT per-seat — every other
  // module here is a flat monthly price, and a headcount billing dimension for one
  // of them complicates reconciliation and `activeTotalCents` for no real gain.
  staff: 2900,
  // NOTE: `funnels` (docs/151) is intentionally absent, and FOR A DIFFERENT
  // REASON than social's below. Social is free because it is cross-cutting.
  // Funnels is free because every part it measures is already paid for: the
  // landing page is builder, the follow-up is email, the outcome is commerce or
  // scheduling. Charging again to find out whether they worked prices the answer
  // out of reach of exactly the businesses that most need it — and it is the
  // module most likely to make the others look worth keeping. See docs/152 §1 #1
  // for the counter-argument that was considered and rejected.
  //
  // NOTE: `social` (docs/133) is intentionally absent — it is a FREE module. No
  // entry ⇒ `isBillableModule` is false ⇒ the toggle path creates no Stripe item,
  // so it activates at $0 through the normal flow. Do not add a price here without
  // a deliberate decision to start charging (the paid lever is the future `ads`
  // module, docs/133 §14, not social posting).
};

/** The 14-day, all-modules, no-card trial (docs/17 §6). */
export const TRIAL_PERIOD_DAYS = 14;

/** Whether a module carries a list price (the billable set). */
export function isBillableModule(module: ModuleSlug): boolean {
  return MODULE_MONTHLY_CENTS[module] !== undefined;
}

/** Stripe Price ID for a module/interval, from env (`STRIPE_PRICE_<MODULE>_MONTHLY`
 *  / `_ANNUAL`, injected from Secret Manager in prod). Undefined until the ops
 *  land — callers treat that module as not-yet-billable and skip the Stripe item. */
export function priceIdFor(module: ModuleSlug, interval: BillingInterval): string | undefined {
  const key = `STRIPE_PRICE_${module.toUpperCase()}_${interval.toUpperCase()}`;
  const value = process.env[key]?.trim();
  if (!value) return undefined;
  return value;
}

/** Monthly-equivalent total (cents) for a set of active modules — reads our own
 *  list prices, never Stripe. Annual callers divide elsewhere (docs/67 §7). */
export function activeTotalCents(modules: Iterable<ModuleSlug>): number {
  let sum = 0;
  for (const m of modules) sum += MODULE_MONTHLY_CENTS[m] ?? 0;
  return sum;
}
