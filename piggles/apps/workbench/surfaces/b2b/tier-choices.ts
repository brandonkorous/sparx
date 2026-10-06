// The wholesale group choices, shared by the Wholesale customer pane and the
// Customers company pane so both ask the same question (sparx persona issue 086).

import type { TierChoice } from './accounts-data';
import { discountSummary } from './pricing-tiers-data';

/** Normal prices first, then each group with what it gives. The group they are
 *  in stays listed by name; a removed one says it no longer prices anything. */
export function tierChoiceItems(
  tiers: TierChoice[] | undefined,
  noneLabel: string,
  current?: { id: string | null; name: string | null; removed?: boolean }
): { value: string; label: string }[] {
  const items = (tiers ?? []).map((tier) => ({
    value: tier.id,
    label: `${tier.name} · ${discountSummary(tier)}`,
  }));
  if (current?.id && !items.some((item) => item.value === current.id)) {
    const name = current.name ?? 'The group they were in';
    const removed = current.removed === true || tiers !== undefined;
    items.push({ value: current.id, label: removed ? removedTierWords(name) : name });
  }
  return [{ value: '', label: noneLabel }, ...items];
}

/** How a removed group reads wherever the customer's own screen names it. */
export function removedTierWords(name: string): string {
  return `${name} (removed, so normal prices)`;
}

/** The group line under the customer's name, or null for normal prices. */
export function accountTierWords(account: {
  pricingTierName: string | null;
  removedTierName: string | null;
}): string | null {
  if (account.pricingTierName) return account.pricingTierName;
  return account.removedTierName ? removedTierWords(account.removedTierName) : null;
}
