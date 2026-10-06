// How many wholesale accounts sit on each price tier, for the B2B summary.
//
// Grouped by the tier each account POINTS AT (`pricing_tier_id`), the one that
// prices its orders. It grouped by the legacy free-text `pricing_tier` column,
// which is empty on every account put on a tier from the tiers screen, so
// Gillett's eight accounts on Fleet, Contract and Dealer counted as no tier at
// all (sparx persona issue 086).
//
// Accounts on no tier are a group of their own with `tierId` and `tier` both
// null: they buy at normal prices, and that is a real answer, not a missing one.
// It is never given a made-up name, so a screen can word it however it speaks.
// Accounts still linked to a REMOVED tier are counted there too: a removed tier
// prices nothing, so they buy at normal prices as well.

import { companyService } from '@wizeworks/crm';

export interface TierGroup {
  pricingTierId: string | null;
  _count: { _all: number };
}

export interface TierCount {
  /** The tier's id, or null for accounts on normal prices. */
  tierId: string | null;
  /** The tier's name; null for accounts on normal prices (`tierId` null too). */
  tier: string | null;
  count: number;
}

/** The ids to look the names up for. */
export function tierIdsIn(groups: TierGroup[]): string[] {
  return groups.map((g) => g.pricingTierId).filter((id): id is string => id !== null);
}

/**
 * One row per tier in effect, biggest first. `tiers` is read with removed tiers
 * included, so every id has a row to judge it by. A tier deleted outright
 * between the two reads keeps its own row with its id and a null name, rather
 * than being folded into normal prices: there is no row saying it was removed.
 */
export function tierBreakdown(
  groups: TierGroup[],
  tiers: { id: string; name: string; deletedAt: Date | null }[]
): TierCount[] {
  const byId = new Map(tiers.map((t) => [t.id, t]));
  const rows = new Map<string | null, TierCount>();
  for (const g of groups) {
    const linked = g.pricingTierId === null ? undefined : byId.get(g.pricingTierId);
    const normalPrices = g.pricingTierId === null || companyService.removedTier(linked) !== null;
    const tierId = normalPrices ? null : g.pricingTierId;
    const row = rows.get(tierId) ?? {
      tierId,
      tier: normalPrices ? null : (linked?.name ?? null),
      count: 0,
    };
    row.count += g._count._all;
    rows.set(tierId, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.count - a.count || (a.tier ?? '').localeCompare(b.tier ?? '')
  );
}
