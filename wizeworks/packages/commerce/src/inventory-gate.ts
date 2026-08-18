// Degrade-without-inventory gate (docs/100 §1, §2.4). Commerce/B2B must work with
// the inventory module OFF: variants are untracked (always available) and every
// sell-path seam call — cart reserve, checkout commit, cancel restock, return
// restock — becomes a no-op. The single predicate the seam consults is whether
// the `inventory` module is active for the tenant; it rides free with commerce/b2b
// (BUNDLED_FREE) so a selling tenant gets stock tracking at no surcharge, while a
// content-only / inventory-off tenant never decrements anything.
//
// `isModuleEnabled` is cached (LRU + 60s TTL), so calling this on the cart/checkout
// hot path is cheap.

import { isModuleEnabled } from '@wizeworks/auth';

export function isInventoryActive(tenantId: string): Promise<boolean> {
  return isModuleEnabled(tenantId, 'inventory');
}
