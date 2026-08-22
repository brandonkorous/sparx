// How each category introduces itself, and which modules unlock it.
//
// One definition, read by the Integrations panel, the marketplace and anything else
// that groups connections — so a category is described the same way everywhere
// instead of once per surface.
//
// Wording follows the platform's primary audience: business owners, not developers.
// "Card payments", not "payment provider installations".

import type { ModuleSlug } from '@wizeworks/modules';

import type { CategoryDescriptor, IntegrationCategory } from './types.js';

/**
 * A category is usable when ANY of its modules is on — not all of them.
 *
 * This is load-bearing for `payments`. Getting paid is not a selling-only concern:
 * `NormalizedPaymentData` carries `orderId`, `invoiceId` AND `bookingId`, so a
 * consultancy that invoices and a studio that takes bookings both need a gateway
 * without ever turning selling on. Today those tenants cannot reach the payments
 * catalog at all — it sits behind `/v1/commerce/providers`, which answers
 * MODULE_DISABLED — which is a plain bug, not a copy problem.
 *
 * An empty list means the category is never gated.
 */
export interface CategoryGate extends CategoryDescriptor {
  modules: readonly ModuleSlug[];
}

const CATEGORY_LIST: readonly CategoryGate[] = [
  {
    category: 'payments',
    label: 'Card payments',
    hint: 'Take card payments and have the money settled to your bank account.',
    module: 'commerce',
    modules: ['commerce', 'invoicing', 'b2b', 'scheduling'],
  },
  {
    category: 'shipping',
    label: 'Shipping & delivery',
    hint: 'Live delivery prices, printed labels and tracking, straight from the carrier.',
    module: 'commerce',
    modules: ['commerce'],
  },
  {
    category: 'sales_channels',
    label: 'Places you sell',
    hint: 'Put your products in front of shoppers on other marketplaces and social apps.',
    module: 'commerce',
    modules: ['commerce'],
  },
  {
    category: 'social',
    label: 'Social accounts',
    hint: 'Post to your own social accounts from here and see how the posts performed.',
    module: 'social',
    modules: ['social'],
  },
  {
    category: 'dropship',
    label: 'Dropship suppliers',
    hint: 'Send orders to a supplier who ships them to your customer for you.',
    module: 'dropship',
    modules: ['dropship'],
  },
  {
    category: 'tax',
    label: 'Sales tax',
    hint: 'Work out the right sales tax for every order automatically.',
    module: 'commerce',
    modules: ['commerce', 'invoicing', 'b2b'],
  },
  {
    category: 'ai',
    label: 'AI accounts',
    hint: 'Connect your own AI account. Every AI feature here runs on it, and nothing else.',
    module: 'ai',
    modules: ['ai'],
  },
];

/** Display order — the connections most businesses reach for first. */
export const CATEGORY_ORDER: readonly IntegrationCategory[] = CATEGORY_LIST.map((c) => c.category);

const BY_CATEGORY = new Map<IntegrationCategory, CategoryGate>(
  CATEGORY_LIST.map((c) => [c.category, c])
);

export function categoryInfo(category: IntegrationCategory): CategoryGate {
  const info = BY_CATEGORY.get(category);
  if (!info) throw new Error(`Unknown integration category: ${category}`);
  return info;
}

export function allCategories(): readonly CategoryGate[] {
  return CATEGORY_LIST;
}

/** Whether a tenant with these modules on can use this category at all. */
export function isCategoryUnlocked(
  category: IntegrationCategory,
  activeModules: Iterable<string>
): boolean {
  const { modules } = categoryInfo(category);
  if (modules.length === 0) return true;
  const active = new Set(activeModules);
  return modules.some((m) => active.has(m));
}
