'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE TRANSFERS DATA LAYER
//
// A transfer is stock on its way from one of your locations to another. It has
// a life: you compose it as a DRAFT (a from-location, a to-location, and a set
// of item lines), you DISPATCH it (the goods leave the source and sit "in
// transit"), and you RECEIVE it (they land at the destination). A draft or an
// in-transit transfer can also be CANCELLED — a cancelled in-transit transfer
// sends everything back to where it came from. Every one of those legs is
// written to the stock ledger, so nothing is ever created or lost by moving it.
//
// ── Every read and write behind the Transfers surfaces lives here ─────────
//
//   transferKeys.all              ['inventory','transfers']
//   transferKeys.list(query)      …,'list',{query}   one list window
//   transferKeys.detail(id)       …,'detail',<id>    one transfer
//
// ── Moving stock touches the Stock surfaces too ───────────────────────────
//
// Dispatching, receiving and cancelling all change on-hand counts, so each of
// those invalidates the shared stock cache (['inventory','stock']) as well as
// the transfer's own. Without that, a count recorded here would sit stale in
// the Stock pane docked in the next tab along — two views of one fact, one of
// them lying.
//
// ── Why "Save" is one call that branches ──────────────────────────────────
//
// The API composes a whole draft in a single create call, but has no way to
// change a saved draft's from/to locations afterwards — those are fixed the
// moment the transfer exists. So a NEW transfer is assembled entirely in the
// pane and created in one shot on Save; an EXISTING draft can only have its
// LINES changed, which Save reconciles (adds, quantity changes, removals)
// against what the server last returned. Both are `saveTransferDraft`.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';

/** One item on a transfer — a variant and how many of it to move. */
export interface TransferLine {
  id: string;
  variantId: string;
  /** The product code printed on the shelf label. Null on a variant saved without one. */
  variantSku: string | null;
  productTitle: string | null;
  /** How many were put on the transfer. */
  quantity: number;
  /** How many actually turned up at the destination. Null until it is received;
   *  short of `quantity` means some went missing in transit. */
  receivedQuantity: number | null;
  shipMovementId: string | null;
  receiveMovementId: string | null;
  note: string | null;
}

/** A transfer as the list returns it — everything but the individual lines. */
export interface TransferRow {
  id: string;
  /** The human reference, e.g. TRF-000123. */
  number: string;
  fromWarehouseId: string;
  fromWarehouseName: string | null;
  fromWarehouseCode: string | null;
  toWarehouseId: string;
  toWarehouseName: string | null;
  toWarehouseCode: string | null;
  status: TransferStatus;
  note: string | null;
  lineCount: number;
  totalQuantity: number;
  shippedAt: string | null;
  shippedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface TransferDetail extends TransferRow {
  lines: TransferLine[];
}

/* ── The item picker's shapes (borrowed from the catalog) ─────────────────
 *
 * A transfer line points at a real product variant, so composing one means
 * searching the catalog. These mirror what the commerce endpoints return; they
 * live here rather than being imported so this module does not take a build
 * dependency on a commerce surface it only reads from.
 */

export interface PickerProduct {
  id: string;
  title: string;
  variantCount: number;
  vendor: string | null;
}

export interface PickerVariant {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export interface TransferQuery {
  q?: string;
  /** Narrow to one state in the transfer's life. */
  status?: TransferStatus;
  /** Match either leg — stock leaving OR arriving at this location. */
  warehouseId?: string;
  take: number;
  skip: number;
}

export const transferKeys = {
  all: ['inventory', 'transfers'] as const,
  list: (query: TransferQuery) => [...transferKeys.all, 'list', query] as const,
  detail: (id: string) => [...transferKeys.all, 'detail', id] as const,
};

/** The shared stock cache these writes reach across into. Spelled to match the
 *  key the Stock surfaces use (stockKeys.all), so moving stock here refreshes
 *  the numbers there. */
const STOCK_KEY = ['inventory', 'stock'] as const;

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** One window of the transfers list. Every narrowing is a SERVER param — a
 *  status filter that sieved the loaded page would answer "what is in transit"
 *  with "the in-transit ones among the fifty rows in hand". */
export function useTransfers(query: TransferQuery) {
  return useQuery({
    queryKey: transferKeys.list(query),
    queryFn: () =>
      api.list<TransferRow>('/v1/inventory/transfers', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/** One transfer in full, with its lines. Skipped for the `new` sentinel — a
 *  transfer being composed has no server row to read yet. */
export function useTransfer(id: string) {
  return useQuery({
    queryKey: transferKeys.detail(id),
    queryFn: () => api.get<TransferDetail>(`/v1/inventory/transfers/${id}`),
    enabled: id !== '' && id !== 'new',
    // A 404 means the transfer is gone — an answer, not a fault worth retrying.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** The catalog, for choosing what to put on a transfer. Bounded fetch, filtered
 *  in the picker; long-lived because the catalog changes far slower than a
 *  transfer is composed. */
export function usePickerProducts() {
  return useQuery({
    queryKey: ['commerce', 'products', 'transfer-picker'],
    queryFn: () =>
      api.list<PickerProduct>('/v1/commerce/products', { take: 100, status: 'active' }),
    staleTime: 60_000,
  });
}

/** The variants of one product — the real thing a line moves, since a product
 *  can be several sizes or colours kept as separate stock. */
export function usePickerVariants(productId: string | null) {
  return useQuery({
    queryKey: ['commerce', 'variants', productId],
    queryFn: () => api.get<PickerVariant[]>(`/v1/commerce/products/${productId ?? ''}/variants`),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The one way anything here says "that changed". `movedStock` is set on the
 *  legs that change on-hand — dispatch, receive, cancel — so the Stock surfaces
 *  refresh too. */
export function useInvalidateTransfers() {
  const queryClient = useQueryClient();
  return (options: { id?: string; movedStock?: boolean } = {}) => {
    void queryClient.invalidateQueries({ queryKey: transferKeys.all });
    if (options.id)
      void queryClient.invalidateQueries({ queryKey: transferKeys.detail(options.id) });
    if (options.movedStock) void queryClient.invalidateQueries({ queryKey: STOCK_KEY });
  };
}

/* ── Composing a draft ──────────────────────────────────────────────────── */

/**
 * A line as the pane holds it before it is saved.
 *
 * `id` is present only on a line that already exists on the server; a freshly
 * added line has none until Save creates it. `key` is a stable local identity
 * for React and for matching a line to its edits while it has no server id yet.
 */
export interface DraftLine {
  key: string;
  id?: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
}

let draftLineCounter = 0;
export function newDraftLineKey(): string {
  return `line-${String(++draftLineCounter)}`;
}

export interface SaveTransferInput {
  /** `new` to create; an id to reconcile an existing draft's lines. */
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  note: string;
  lines: DraftLine[];
  /** The lines the server last returned — the only way to tell what was removed. */
  original: TransferLine[];
}

/**
 * Persist a composed draft — create a new one whole, or bring an existing one's
 * lines into line with what the pane now holds.
 *
 * Reconciliation order matters: removals first (a removed variant frees the
 * one-row-per-variant slot), then quantity changes, then additions. Changing a
 * line's VARIANT is not an edit the API has — the pane drops the server id when
 * the variant changes, so it arrives here as a removal of the old line and an
 * addition of the new one.
 */
async function saveTransferDraft(input: SaveTransferInput): Promise<TransferDetail> {
  if (input.id === 'new') {
    return api.post<TransferDetail>('/v1/inventory/transfers', {
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      ...(input.note.trim() ? { note: input.note.trim() } : {}),
      lines: input.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
    });
  }

  const keptIds = new Set(input.lines.map((line) => line.id).filter(Boolean));
  const removed = input.original.filter((line) => !keptIds.has(line.id));
  const originalById = new Map(input.original.map((line) => [line.id, line]));
  const changed = input.lines.filter(
    (line) => line.id && originalById.get(line.id)?.quantity !== line.quantity
  );
  const added = input.lines.filter((line) => !line.id);

  let latest: TransferDetail | null = null;
  for (const line of removed) {
    latest = await api.delete<TransferDetail>(
      `/v1/inventory/transfers/${input.id}/lines/${line.id}`
    );
  }
  for (const line of changed) {
    latest = await api.patch<TransferDetail>(
      `/v1/inventory/transfers/${input.id}/lines/${line.id ?? ''}`,
      { quantity: line.quantity }
    );
  }
  for (const line of added) {
    latest = await api.post<TransferDetail>(`/v1/inventory/transfers/${input.id}/lines`, {
      variantId: line.variantId,
      quantity: line.quantity,
    });
  }

  // Nothing changed (Save pressed on an untouched draft) — return the current
  // state rather than a stale snapshot.
  return latest ?? api.get<TransferDetail>(`/v1/inventory/transfers/${input.id}`);
}

export function useSaveTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: saveTransferDraft,
    onSuccess: (detail) => {
      invalidate({ id: detail.id });
    },
  });
}

/** Discard a draft that has never moved stock. Only a draft can be deleted;
 *  anything that has shipped is cancelled instead, so it stays on the record. */
export function useDeleteTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/v1/inventory/transfers/${id}`),
    onSuccess: () => {
      invalidate({});
    },
  });
}

/* ── Lifecycle legs ─────────────────────────────────────────────────────── */

/** Send a draft on its way: the goods leave the source and sit in transit. */
export function useDispatchTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (id: string) => api.post<TransferDetail>(`/v1/inventory/transfers/${id}/ship`),
    onSuccess: (detail) => {
      invalidate({ id: detail.id, movedStock: true });
    },
  });
}

/** One line's actual receipt — how many of what was sent turned up. */
export interface ReceiveLine {
  lineId: string;
  receivedQuantity: number;
}

/** Book an in-transit transfer in at the destination. Any line short of what was
 *  sent has the difference written off as lost in transit. */
export function useReceiveTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (input: { id: string; lines?: ReceiveLine[] }) =>
      api.post<TransferDetail>(
        `/v1/inventory/transfers/${input.id}/receive`,
        input.lines ? { lines: input.lines } : {}
      ),
    onSuccess: (detail) => {
      invalidate({ id: detail.id, movedStock: true });
    },
  });
}

/** Call it off. A draft is simply voided; an in-transit transfer's goods are
 *  returned to the source location. */
export function useCancelTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (id: string) => api.post<TransferDetail>(`/v1/inventory/transfers/${id}/cancel`),
    onSuccess: (detail) => {
      invalidate({ id: detail.id, movedStock: true });
    },
  });
}

/* ── Saying what a status means ─────────────────────────────────────────── */

export interface TransferState {
  label: string;
  tone: Tone;
}

/** The stored status in the words an owner would use, and the colour that goes
 *  with it. `draft` is information (nothing has happened yet), `in_transit`
 *  wants attention (stock is out of both locations), `received` is done and
 *  good, `cancelled` is called off. */
export function transferState(status: TransferStatus): TransferState {
  switch (status) {
    case 'draft':
      return { label: 'Draft', tone: 'info' };
    case 'in_transit':
      return { label: 'In transit', tone: 'warning' };
    case 'received':
      return { label: 'Received', tone: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** A one-line explanation of what a status means for the operator, in plain
 *  words — used under the heading of the detail pane. */
export function transferStatusBlurb(status: TransferStatus): string {
  switch (status) {
    case 'draft':
      return 'Not sent yet. You can still add items and change quantities, then send it on its way.';
    case 'in_transit':
      return 'On its way. The stock has left the source and is not yet counted at the destination, so neither location can sell it.';
    case 'received':
      return 'Arrived and counted in at the destination. This transfer is complete.';
    case 'cancelled':
      return 'Called off. Anything that had already left the source was returned to it.';
    default:
      return '';
  }
}

/** How a location reads on screen — name, with the shelf code alongside when it
 *  differs, so a route is unambiguous. */
export function warehouseLabel(name: string | null, code: string | null): string {
  const shown = name ?? code ?? 'Unknown location';
  if (!code || code === name) return shown;
  return `${shown} (${code})`;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx, shown verbatim: these routes name the
 *  real problem ("Not enough stock to send", "Cannot ship a transfer while
 *  received") far better than a status code could. */
export function transferErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
