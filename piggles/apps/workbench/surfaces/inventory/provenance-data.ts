'use client';

// ══════════════════════════════════════════════════════════════════════════
// "WHY IS THIS NUMBER WHAT IT IS" — the data behind the explanation
//
// One server read answers the whole question for one item at one place: how the
// number breaks down, what changed it recently and who did each change, who is
// holding the rest, how old it is, which connected system last touched it, and
// whether adding up its whole history still comes to the same total.
//
// It is ONE call on purpose. The value of this feature is being able to answer
// "why" without a research project, and four requests to four screens IS a
// research project.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { productCopy } from '../../lib/product';

/* ── Shapes (mirror the provenance response exactly) ─────────────────────── */

export interface ProvenanceMovement {
  id: string;
  delta: number;
  balanceAfter: number | null;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string;
  actorId: string | null;
  source: string | null;
  note: string | null;
  createdAt: string;
}

export interface ProvenanceHold {
  id: string;
  quantity: number;
  holderType: string;
  holderId: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ProvenanceSource {
  sourceId: string;
  name: string;
  type: string;
  lastSyncAt: string | null;
  isStale: boolean;
  staleSince: string | null;
  expectedIntervalSec: number;
  externalSku: string;
  externalLocation: string | null;
  unitsPerExternal: number;
  linkLastSeenAt: string | null;
  linkIsStale: boolean;
}

export interface StalenessPenalty {
  extraBuffer: number;
  pauseChannels: boolean;
  staleSources: { sourceId: string; name: string; policy: string; staleSince: string | null }[];
}

export interface StockProvenance {
  variantId: string;
  variantSku: string | null;
  productId: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;

  onHand: number;
  allocated: number;
  safetyBuffer: number;
  sellable: number;
  channel: {
    channel: string;
    buffer: number;
    bufferSource: 'override' | 'channel_default' | 'level';
    stalenessExtraBuffer: number;
    sellable: number;
    channelsPaused: boolean;
  } | null;

  derivedOnHand: number;
  /** The claim, checked: does adding up every change still give this number? */
  reconciles: boolean;
  movementCount: number;
  recentMovements: ProvenanceMovement[];

  holds: ProvenanceHold[];

  asOf: string;
  ageSeconds: number;
  updatedAt: string;
  lastMovementAt: string | null;
  sources: ProvenanceSource[];
  staleness: StalenessPenalty;

  avgCostCents: number | null;
  unitCostCents: number | null;
}

/* ── Read ───────────────────────────────────────────────────────────────── */

export const provenanceKeys = {
  all: ['inventory', 'provenance'] as const,
  one: (variantId: string, warehouseId: string, channel?: string) =>
    [...provenanceKeys.all, variantId, warehouseId, channel ?? null] as const,
};

export function useStockProvenance(
  variantId: string | undefined,
  warehouseId: string | undefined,
  channel?: string
) {
  return useQuery({
    queryKey: provenanceKeys.one(variantId ?? '', warehouseId ?? '', channel),
    enabled: Boolean(variantId && warehouseId),
    // Never served from a stale cache. The entire proposition is "here is what
    // is true RIGHT NOW" — a cached explanation of a number that has since moved
    // is worse than no explanation, because it is confidently wrong.
    staleTime: 0,
    queryFn: () =>
      api.get<StockProvenance>(
        `/v1/inventory/stock/${variantId ?? ''}/${warehouseId ?? ''}/provenance`,
        { movement_limit: 25, ...(channel ? { channel } : {}) }
      ),
  });
}

/* ── Plain words ────────────────────────────────────────────────────────── */

/** Who made a change, said as a person would say it. `actorId` is a uuid or an
 *  integration name and is deliberately not shown raw — nobody recognises a uuid. */
export function actorLabel(movement: ProvenanceMovement): string {
  switch (movement.actorType) {
    case 'user':
      return 'Someone on your team';
    case 'ai':
      return 'An AI assistant';
    case 'integration':
      return movement.source ? `${movement.source} (connected system)` : 'A connected system';
    default:
      return productCopy('inventory.provenance.platform', 'sparx, automatically');
  }
}

/** Where the cushion for a channel came from, so the number is never a mystery. */
export function bufferSourceLabel(source: 'override' | 'channel_default' | 'level'): string {
  if (source === 'override') return 'set for this item on this channel';
  if (source === 'channel_default') return 'the rule for this channel';
  return 'the item’s own held-back amount';
}
