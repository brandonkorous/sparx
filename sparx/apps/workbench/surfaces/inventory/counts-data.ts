'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE STOCK-COUNT DATA LAYER
//
// Everything behind the Stock-counts list and the count-session pane: the list
// window, one session's detail, and every write that walks a session from
// "counting" through to its numbers being corrected on the shelf.
//
// ── What a count IS ───────────────────────────────────────────────────────
//
// A count is a session tied to ONE location. It has a set of lines — one per
// item being counted — each of which remembers what we THOUGHT was on the shelf
// (`expectedQuantity`, snapshotted when the line was made) and holds what was
// actually COUNTED (`countedQuantity`). The gap between them is the variance.
//
// It moves through states, and only some of them are editable:
//
//   counting → the working phase. Add items, type in what you counted.
//   review   → counting is done; the money value of all the differences is
//              frozen. If that value clears the business's limit the count
//              needs a manager to approve it; otherwise it can be applied.
//   approved → a manager signed off on an over-limit count.
//   posted   → APPLIED. Each line wrote a correction to the real stock number
//              through the movement ledger. This is the irreversible step.
//   cancelled→ abandoned. No stock was ever changed.
//
// ── Applying a count reaches ACROSS to the stock cache ────────────────────
//
// Posting a count is the whole point: it corrects the on-hand numbers the Stock
// surfaces show. So the moment a count is applied we invalidate the shared stock
// cache (and the ledger), or the count would sit "Applied" beside a Stock list
// still showing the old figures with no hint which is true. `stockKeys` and
// `movementKeys` are imported read-only for exactly this.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import { stockKeys, type Tone } from './data';
import { movementKeys } from './movements-data';

/* ── Shapes (mirror the api-rest count serializer) ──────────────────────── */

export type CountStatus = 'counting' | 'review' | 'approved' | 'posted' | 'cancelled';
export type CountType = 'cycle' | 'full';

/** One item on a count: what we thought was there, what was counted, the gap. */
export interface CountLine {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /**
   * What the system believed was on the shelf when this line was created.
   *
   * NULL on a BLIND count that is still open — the whole point of blind counting
   * is that the number never reaches the person counting, so the server withholds
   * it rather than trusting this screen to hide it. It comes back at review,
   * which is when the variance is meant to be looked at.
   */
  expectedQuantity: number | null;
  /** What the person counted. Null until they enter it. */
  countedQuantity: number | null;
  /** `counted − expected`, null until counted. The difference to reconcile. */
  variance: number | null;
  /** Cost basis per unit, for turning a variance into a money value. */
  unitCostCents: number | null;
  /** The correction the ledger actually applied on posting (counted − LIVE
   *  on-hand, so a sale mid-count is reconciled). Null until posted. */
  appliedDelta: number | null;
  movementId: string | null;
  note: string | null;
}

/** A count as it appears in the list — no lines, just the headline facts. */
export interface CountRow {
  id: string;
  /** The stable reference, e.g. `CNT-000006`. */
  number: string;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  type: CountType;
  /**
   * What the count COVERS — the whole location, one zone, or one shelf.
   *
   * Load-bearing rather than decorative: it decides whether an item missing from
   * the sheet means "zero" or "not in scope", which is the difference between a
   * correction and a catastrophe.
   */
  scope: 'location' | 'zone' | 'bin';
  binId: string | null;
  binCode: string | null;
  zoneName: string | null;
  /** Expected quantities are withheld from whoever is counting until review. */
  isBlind: boolean;
  status: CountStatus;
  note: string | null;
  /** Money-value of differences above which a manager must approve the post. */
  approvalThresholdCents: number;
  /** Set at review time: is the frozen variance value over the threshold? */
  requiresApproval: boolean;
  /** Σ |counted − expected| × unit cost, frozen at review. */
  varianceValueCents: number;
  lineCount: number;
  countedLineCount: number;
  startedAt: string;
  countedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  postedAt: string | null;
  createdAt: string;
}

export interface CountDetail extends CountRow {
  lines: CountLine[];
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export interface CountQuery {
  q?: string;
  status?: CountStatus;
  warehouseId?: string;
  take: number;
  skip: number;
}

export const countKeys = {
  all: ['inventory', 'counts'] as const,
  list: (query: CountQuery) => [...countKeys.all, 'list', query] as const,
  detail: (id: string) => [...countKeys.all, 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/**
 * One window of the counts list.
 *
 * Status and location both narrow on the SERVER — "show me the counts still
 * open" is a question about every count there has ever been, not about the fifty
 * that happen to be in hand.
 */
export function useCounts(query: CountQuery) {
  return useQuery({
    queryKey: countKeys.list(query),
    queryFn: () =>
      api.list<CountRow>('/v1/inventory/counts', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/**
 * One count session in full, with every line.
 *
 * Disabled for the sentinel `new` id — a count being created has no server row
 * yet, and asking for `/counts/new` is a 404 dressed up as a load.
 */
export function useCount(id: string) {
  return useQuery({
    queryKey: countKeys.detail(id),
    queryFn: () => api.get<CountDetail>(`/v1/inventory/counts/${id}`),
    enabled: id !== '' && id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** Refresh the list and, if named, one session's detail. */
export function useInvalidateCounts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: countKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: countKeys.detail(id) });
  };
}

/**
 * The heavier invalidation, for after a count is APPLIED.
 *
 * A post corrects real on-hand numbers and writes ledger rows, so it has to
 * reach past this cluster into the Stock surfaces' cache and the movement log —
 * both of which are showing figures this write just moved.
 */
function useInvalidateApplied() {
  const queryClient = useQueryClient();
  const invalidateCounts = useInvalidateCounts();
  return (id: string) => {
    invalidateCounts(id);
    void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    void queryClient.invalidateQueries({ queryKey: movementKeys.all });
  };
}

/* ── Writes: creating and counting ──────────────────────────────────────── */

export interface CreateCountInput {
  warehouseId: string;
  type: CountType;
  /** Only for a `cycle` count — the items to seed. A `full` count ignores this
   *  and snapshots every level at the location. */
  variantIds?: string[];
  note?: string;
}

/** Start a new counting session. Returns the created detail (with its lines
 *  already snapshotted for a full count). */
export function useCreateCount() {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: (input: CreateCountInput) =>
      api.post<CountDetail>('/v1/inventory/counts', {
        warehouseId: input.warehouseId,
        type: input.type,
        ...(input.variantIds && input.variantIds.length > 0
          ? { variantIds: input.variantIds }
          : {}),
        ...(input.note ? { note: input.note } : {}),
      }),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** Add one more item to a session still being counted. */
export function useAddCountLine(countId: string) {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: (variantId: string) =>
      api.post<CountDetail>(`/v1/inventory/counts/${countId}/lines`, { variantId }),
    onSuccess: () => {
      invalidate(countId);
    },
  });
}

/** Drop an item off a session still being counted. */
export function useRemoveCountLine(countId: string) {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: (lineId: string) =>
      api.delete<CountDetail>(`/v1/inventory/counts/${countId}/lines/${lineId}`),
    onSuccess: () => {
      invalidate(countId);
    },
  });
}

export interface CountEntry {
  lineId: string;
  countedQuantity: number;
  note?: string;
}

/** Record the counted quantities for one or more lines. The explicit-Save step
 *  while counting — nothing is committed as you type. */
export function useEnterCounts(countId: string) {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: (entries: CountEntry[]) =>
      api.post<CountDetail>(`/v1/inventory/counts/${countId}/entries`, {
        entries: entries.map((entry) => ({
          lineId: entry.lineId,
          countedQuantity: entry.countedQuantity,
          ...(entry.note !== undefined ? { note: entry.note } : {}),
        })),
      }),
    onSuccess: () => {
      invalidate(countId);
    },
  });
}

/* ── Writes: the lifecycle ──────────────────────────────────────────────── */

/** Finish counting — freeze the variance value and work out whether a manager's
 *  approval is needed before the corrections can be applied. */
export function useSubmitCount(countId: string) {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: () => api.post<CountDetail>(`/v1/inventory/counts/${countId}/submit`),
    onSuccess: () => {
      invalidate(countId);
    },
  });
}

/** A manager's sign-off on a count whose differences are worth more than the
 *  business's review limit. */
export function useApproveCount(countId: string) {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: () => api.post<CountDetail>(`/v1/inventory/counts/${countId}/approve`),
    onSuccess: () => {
      invalidate(countId);
    },
  });
}

/** Apply the count — write a correction to the real on-hand number for every
 *  line through the ledger. The irreversible step, so it carries the wide
 *  invalidation. */
export function usePostCount(countId: string) {
  const invalidate = useInvalidateApplied();
  return useMutation({
    mutationFn: () => api.post<CountDetail>(`/v1/inventory/counts/${countId}/post`),
    onSuccess: () => {
      invalidate(countId);
    },
  });
}

/** Abandon a count. Nothing was applied, so nothing on the shelf changes. */
export function useCancelCount(countId: string) {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: () => api.post<CountDetail>(`/v1/inventory/counts/${countId}/cancel`),
    onSuccess: () => {
      invalidate(countId);
    },
  });
}

/* ── Saying what a count means ──────────────────────────────────────────── */

export interface CountState {
  label: string;
  tone: Tone;
}

/** A count's state in the words an owner would use, with a tone to match. */
export function countState(status: CountStatus): CountState {
  switch (status) {
    case 'counting':
      return { label: 'Counting', tone: 'info' };
    case 'review':
      return { label: 'Ready to apply', tone: 'warning' };
    case 'approved':
      return { label: 'Approved', tone: 'info' };
    case 'posted':
      return { label: 'Applied', tone: 'success' };
    case 'cancelled':
      return { label: 'Discarded', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** What kind of count this is, said plainly. */
export function countTypeLabel(type: CountType): string {
  return type === 'full' ? 'Everything at this location' : 'Selected items';
}

/**
 * The tone for one line's difference.
 *
 * A match is calm; finding MORE than expected is worth noticing but harmless;
 * being SHORT is the one that costs money and can take something off sale, so it
 * gets the warning color.
 */
export function varianceTone(variance: number | null): Tone {
  if (variance === null) return 'neutral';
  if (variance === 0) return 'success';
  return variance > 0 ? 'info' : 'warning';
}

/** One line's difference as a short phrase — "Matches", "3 more than expected",
 *  "2 short". */
export function varianceLabel(variance: number | null): string {
  if (variance === null) return 'Not counted yet';
  if (variance === 0) return 'Matches';
  const amount = Math.abs(variance);
  const units = amount === 1 ? 'unit' : 'units';
  return variance > 0
    ? `${String(amount)} ${units} more than expected`
    : `${String(amount)} ${units} short`;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx — these count routes name the real
 *  problem ("Add at least one line before submitting", "must be approved before
 *  posting") far better than a status code could. */
export function countErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function isCountNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
