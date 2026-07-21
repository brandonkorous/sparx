'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE LOTS & SERIALS DATA LAYER
//
// Every read and write behind the "Lots & serials" surfaces lives here: the
// two-mode list (batches OR serial numbers), the lot detail with its serial
// roster, clearing a recall, and changing one serial's status. Same contract as
// the Stock data layer next door (data.ts) — no surface declares a query key, a
// fetch or a row type of its own.
//
// ── What these records ARE ────────────────────────────────────────────────
//
// A LOT is one batch of a product — a run of the same thing made or bought
// together, carrying a batch code, an optional expiry date, and how many the
// batch held. A SERIAL is one physical unit with its own number, optionally
// tied to the batch it came from. Both exist so that when a customer says
// "which one did I get?" you can trace the exact batch or unit — and when a
// batch turns out to be bad, you can find every unit that left the building.
//
// Quantities here are TRACEABILITY metadata, not the sellable count. What a
// shopper can actually buy is the (product × location) stock level over in
// data.ts; a lot's "remaining" is how many that batch started with. Kept apart
// on purpose so a batch record can never quietly disagree with the shelf.
//
// ── One read per question ─────────────────────────────────────────────────
//
//   GET /v1/inventory/lots            the batch list — server search / location
//                                     / expiry / recall filters, and paging
//   GET /v1/inventory/lots/:id        one batch, with its serial breakdown
//   GET /v1/inventory/lots/:id/serials  the units in one batch
//   GET /v1/inventory/serials         the serial list — server search / location
//                                     / status filters, and paging
//   POST /v1/inventory/lots/:id/clear-recall   resolve an open recall
//   PATCH /v1/inventory/serials/:id            change one unit's status
//
// Every narrowing is a SERVER filter. Filtering a loaded page in the browser
// would answer "which batches are expiring" with "the soonest of the fifty rows
// you happen to be holding" — the wrong answer dressed as the right one.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/**
 * One batch of a product — the row the "Batches" mode is about.
 *
 * `quantity` is what the batch held when it was booked in; it is metadata, not
 * the live shelf count. `recallStatus` is null for the overwhelming majority of
 * batches (a recall is the exception), and a set expiry is optional — a run of
 * bolts does not go off, a case of milk does.
 */
export interface LotRow {
  id: string;
  variantId: string;
  /** The product code of what this batch is of. Null on a variant saved without one. */
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  /** The batch code — how this run is labelled and found. */
  lotNumber: string;
  /** When the batch was made. Half of "where it came from". */
  manufacturedAt: string | null;
  /** When it goes off. Null when the product does not expire. */
  expiresAt: string | null;
  /** How many the batch held. Traceability metadata, not the sellable count. */
  quantity: number;
  /** IATA/DOT hazard class, `none` for ordinary goods. */
  hazmatClass: string;
  /** null | 'pending' | 'active' | 'cleared'. */
  recallStatus: string | null;
  recallReason: string | null;
  recalledAt: string | null;
  /** The supplier's own reference for this batch — the other half of "where it
   *  came from", and what you quote back to them if it is faulty. */
  supplierBatchRef: string | null;
  /** How many individually-numbered units belong to this batch. */
  serialCount: number;
  createdAt: string;
}

/** One batch plus the breakdown of its units by status — what the detail loads. */
export interface LotDetail extends LotRow {
  /** e.g. [{ status: 'in_stock', count: 12 }, { status: 'sold', count: 3 }]. */
  serialCounts: { status: string; count: number }[];
}

/**
 * One physically-numbered unit — the row the "Serial numbers" mode is about.
 *
 * The traceability payoff lives here: a `sold` unit carries the order item it
 * left on, so "customer says unit SN-1041 is faulty" resolves to the exact
 * order, the batch it came from, and where it is now.
 */
export interface SerialRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  /** The batch this unit came from, if it was tracked as part of one. */
  lotBatchId: string | null;
  lotNumber: string | null;
  serial: string;
  /** in_stock | reserved | sold | returned | scrapped | lost. */
  status: string;
  /** Set once the unit has left on an order — where this unit went. */
  soldOnOrderItemId: string | null;
  soldAt: string | null;
  createdAt: string;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export interface LotsQuery {
  q?: string;
  warehouseId?: string;
  /** 'pending' | 'active' | 'cleared'. */
  recallStatus?: string;
  /** Only batches expiring on/before this ISO instant (and that have an expiry). */
  expiringBefore?: string;
  take: number;
  skip: number;
}

export interface SerialsQuery {
  q?: string;
  warehouseId?: string;
  /** A SerialUnitStatus value. */
  status?: string;
  take: number;
  skip: number;
}

export const lotKeys = {
  all: ['inventory', 'lots'] as const,
  lotList: (query: LotsQuery) => [...lotKeys.all, 'list', query] as const,
  detail: (id: string) => [...lotKeys.all, 'detail', id] as const,
  /** The units inside one batch — nested under the batch so invalidating the
   *  batch refreshes its roster too. */
  roster: (id: string, query: { status?: string; take: number; skip: number }) =>
    [...lotKeys.detail(id), 'serials', query] as const,
};

export const serialKeys = {
  all: ['inventory', 'serials'] as const,
  serialList: (query: SerialsQuery) => [...serialKeys.all, 'list', query] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** One window of the batch list. */
export function useLots(query: LotsQuery) {
  return useQuery({
    queryKey: lotKeys.lotList(query),
    queryFn: () =>
      api.list<LotRow>('/v1/inventory/lots', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        ...(query.recallStatus ? { recall_status: query.recallStatus } : {}),
        ...(query.expiringBefore ? { expiring_before: query.expiringBefore } : {}),
        take: query.take,
        skip: query.skip,
      }),
    // Keep the current window on screen while the next one loads, so paging and
    // re-filtering don't blink the table out to empty and back.
    placeholderData: (previous) => previous,
  });
}

/** One window of the serial-number list. */
export function useSerials(query: SerialsQuery) {
  return useQuery({
    queryKey: serialKeys.serialList(query),
    queryFn: () =>
      api.list<SerialRow>('/v1/inventory/serials', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/** One batch, with its by-status serial breakdown. A 404 means the batch is
 *  gone — an answer, not a fault, so it is not retried into a delay. */
export function useLot(id: string) {
  return useQuery({
    queryKey: lotKeys.detail(id),
    queryFn: () => api.get<LotDetail>(`/v1/inventory/lots/${id}`),
    enabled: id !== '',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** The individually-numbered units inside one batch. */
export function useLotSerials(
  lotId: string,
  query: { status?: string; take: number; skip: number }
) {
  return useQuery({
    queryKey: lotKeys.roster(lotId, query),
    queryFn: () =>
      api.list<SerialRow>(`/v1/inventory/lots/${lotId}/serials`, {
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    enabled: lotId !== '',
    placeholderData: (previous) => previous,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/**
 * The ONE way anything in this cluster says "that changed".
 *
 * Reaches both the lot cache and the serial cache because the two overlap: a
 * unit changing status moves its batch's roster counts AND the standalone
 * serial list, and clearing a recall changes the batch's state everywhere it is
 * shown. A single write has to refresh both, or a saved change sits beside a
 * stale one with no telling which is true.
 */
export function useInvalidateLots() {
  const queryClient = useQueryClient();
  return (lotId?: string) => {
    void queryClient.invalidateQueries({ queryKey: lotKeys.all });
    void queryClient.invalidateQueries({ queryKey: serialKeys.all });
    if (lotId) void queryClient.invalidateQueries({ queryKey: lotKeys.detail(lotId) });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/**
 * Resolve an open recall on a batch.
 *
 * The server only allows this on a batch whose recall is still `active` or
 * `pending`, and returns the refreshed batch — so the pane redraws from the
 * server's truth rather than a guessed local flip.
 */
export function useClearRecall() {
  const invalidate = useInvalidateLots();
  return useMutation({
    mutationFn: (lotId: string) => api.post<LotDetail>(`/v1/inventory/lots/${lotId}/clear-recall`),
    onSuccess: (_result, lotId) => {
      invalidate(lotId);
    },
  });
}

/** Change one unit's lifecycle status. Pure traceability metadata — this never
 *  moves the shelf count, which only the ledger can. */
export function useUpdateSerialStatus() {
  const invalidate = useInvalidateLots();
  return useMutation({
    mutationFn: (input: { serialId: string; status: string; lotBatchId: string | null }) =>
      api.patch<SerialRow>(`/v1/inventory/serials/${input.serialId}`, { status: input.status }),
    onSuccess: (_result, input) => {
      invalidate(input.lotBatchId ?? undefined);
    },
  });
}

/* ── Saying what a date or a status means ───────────────────────────────── */

/** How near an expiry has to be to count as "soon" — matched to the server's
 *  own /expiring feed, which defaults to a 30-day horizon. */
const SOON_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** A rough, readable length of time — "12 days", "3 months", "2 years". Whole
 *  days below six weeks (the number a person actually pictures), then months,
 *  then years, because "in 214 days" means nothing to anyone. */
function humanizeDays(days: number): string {
  if (days < 45) return `${String(days)} ${days === 1 ? 'day' : 'days'}`;
  if (days < 730) {
    const months = Math.round(days / 30);
    return `${String(months)} ${months === 1 ? 'month' : 'months'}`;
  }
  const years = Math.round(days / 365);
  return `${String(years)} ${years === 1 ? 'year' : 'years'}`;
}

export interface ExpiryState {
  tone: Tone;
  /** A one- or two-word badge label. */
  short: string;
  /** A full sentence phrase: "Expires in 12 days", "Expired 3 days ago". */
  long: string;
  expired: boolean;
}

/**
 * What a batch's expiry date means, in the words an owner would use.
 *
 * Returns null when there is no expiry at all — a great many products never go
 * off, and forcing a date phrase onto a box of bolts is noise. The `now`
 * argument is injectable so a whole list renders against ONE clock rather than
 * each row reading a slightly later `Date.now()`.
 */
export function describeExpiry(
  expiresAt: string | null,
  now: number = Date.now()
): ExpiryState | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - now) / MS_PER_DAY);
  if (days < 0) {
    return {
      tone: 'danger',
      short: 'Expired',
      long: `Expired ${humanizeDays(Math.abs(days))} ago`,
      expired: true,
    };
  }
  if (days === 0) {
    return { tone: 'warning', short: 'Expires today', long: 'Expires today', expired: false };
  }
  if (days <= SOON_DAYS) {
    return {
      tone: 'warning',
      short: 'Expires soon',
      long: `Expires in ${humanizeDays(days)}`,
      expired: false,
    };
  }
  return {
    tone: 'success',
    short: 'In date',
    long: `Expires in ${humanizeDays(days)}`,
    expired: false,
  };
}

export interface StateBadge {
  label: string;
  tone: Tone;
}

/** A batch's recall state in plain words, or null when it was never recalled. */
export function recallState(status: string | null): StateBadge | null {
  switch (status) {
    case 'active':
      return { label: 'Recalled', tone: 'danger' };
    case 'pending':
      return { label: 'Recall pending', tone: 'warning' };
    case 'cleared':
      return { label: 'Recall cleared', tone: 'success' };
    default:
      return null;
  }
}

/**
 * The single most important thing to know about a batch at a glance.
 *
 * A live recall beats everything — a recalled batch you cannot sell whatever its
 * date. Failing that, the expiry carries the state. A batch with neither a
 * recall nor an expiry is simply "Tracked": it exists for traceability, and
 * that is fine, not a warning.
 */
export function lotState(
  lot: {
    recallStatus: string | null;
    expiresAt: string | null;
  },
  now: number = Date.now()
): StateBadge {
  if (lot.recallStatus === 'active') return { label: 'Recalled', tone: 'danger' };
  if (lot.recallStatus === 'pending') return { label: 'Recall pending', tone: 'warning' };
  const expiry = describeExpiry(lot.expiresAt, now);
  if (expiry) return { label: expiry.short, tone: expiry.tone };
  return { label: 'Tracked', tone: 'neutral' };
}

/** A unit's lifecycle status in plain words. The stored values are the
 *  engineer's ('in_stock', 'scrapped'); these are the shop's. */
export function serialStatusState(status: string): StateBadge {
  switch (status) {
    case 'in_stock':
      return { label: 'In stock', tone: 'success' };
    case 'reserved':
      return { label: 'Set aside', tone: 'info' };
    case 'sold':
      return { label: 'Sold', tone: 'neutral' };
    case 'returned':
      return { label: 'Returned', tone: 'warning' };
    case 'scrapped':
      return { label: 'Scrapped', tone: 'danger' };
    case 'lost':
      return { label: 'Lost', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** Every status a unit can be moved to, in the order they read down a menu.
 *  `describe` is the short explanation shown beside the plain-word label. */
export const SERIAL_STATUSES: { value: string; label: string; describe: string }[] = [
  { value: 'in_stock', label: 'In stock', describe: 'On the shelf, ready to sell' },
  { value: 'reserved', label: 'Set aside', describe: 'Held for a particular order' },
  { value: 'sold', label: 'Sold', describe: 'Gone out to a customer' },
  { value: 'returned', label: 'Returned', describe: 'Came back from a customer' },
  { value: 'scrapped', label: 'Scrapped', describe: 'Thrown away — no longer usable' },
  { value: 'lost', label: 'Lost', describe: 'Cannot be found' },
];

/** True for the statuses that mean a unit is gone for good — worth a second
 *  look before you write them, since they take the unit out of every count. */
export function isTerminalSerialStatus(status: string): boolean {
  return status === 'scrapped' || status === 'lost';
}

/** A hazard class said in plain words, or null for ordinary goods. Owners ship
 *  a "corrosive", not a "class 8". */
export function hazmatLabel(hazmatClass: string): string | null {
  switch (hazmatClass) {
    case 'class_1_explosive':
      return 'Explosive';
    case 'class_2_gas':
      return 'Compressed gas';
    case 'class_3_flammable_liquid':
      return 'Flammable liquid';
    case 'class_4_flammable_solid':
      return 'Flammable solid';
    case 'class_5_oxidizer':
      return 'Oxidiser';
    case 'class_6_toxic':
      return 'Toxic';
    case 'class_7_radioactive':
      return 'Radioactive';
    case 'class_8_corrosive':
      return 'Corrosive';
    case 'class_9_misc':
      return 'Other hazardous material';
    default:
      return null;
  }
}

/** How a batch's location is named on screen, tolerant of the nulls the row can
 *  carry. The code is what is printed on the shelf label, so it earns its place
 *  beside the name. */
export function lotLocationLabel(row: {
  warehouseName: string | null;
  warehouseCode: string | null;
}): string {
  const name = row.warehouseName ?? row.warehouseCode;
  if (!name) return 'Unknown location';
  if (row.warehouseCode && row.warehouseCode !== row.warehouseName) {
    return `${name} (${row.warehouseCode})`;
  }
  return name;
}
