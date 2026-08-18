'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE BUYING REFERENCE DATA — SUPPLIERS
//
// Suppliers are the top of the whole Buying chain: a purchase order is placed
// WITH one, and a delivery is received AGAINST that order. So this file, its two
// siblings (purchase-orders-data, receiving-data), and nothing else own every
// read and write behind the three Buying surfaces. They import from each other
// freely — the supplier picker on a PO, the PO picker on a receipt — because they
// are one cohesive layer split only for readability.
//
// A supplier is the business you buy FROM. Beyond a name and how to reach them it
// carries the default purchasing terms (how you pay, how long delivery takes) and
// a set of per-item "purchasing links" — the supplier's own code and price for
// each thing you buy from them, which is what seeds a purchase-order line.
//
// Generic helpers (money formatting, "is this a 404", the verbatim-server-message
// rule) are shared from ./data rather than re-copied here — one definition of
// "how a price is written" across the whole module.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { isNotFound, stockErrorMessage, type Tone } from './data';

// Re-exported so the Buying surfaces import their error helpers from one place
// rather than reaching past this layer into the Stock module's file.
export { isNotFound };
/** The server's own sentence for a 4xx, shown verbatim — these routes name the
 *  real problem ("Supplier code is already in use") far better than a status
 *  code. Same rule as the Stock module; shared so the wording never drifts. */
export const buyingErrorMessage = stockErrorMessage;

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** A business you buy from. Mirrors the server's SupplierRow one-for-one. */
export interface Supplier {
  id: string;
  name: string;
  /** A short unique handle you give them (e.g. ACME). Printed on POs. */
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  /** How you pay them — "net 30", "cash on delivery", free text. */
  paymentTerms: string | null;
  /** Typical days from ordering to arrival. Seeds a PO's expected date. */
  leadTimeDays: number | null;
  currency: string;
  notes: string | null;
  /** False once archived. Archiving is blocked while an open PO references them. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One thing you buy from a supplier — their code and price for one of your
 *  items. This is what a purchase-order line copies its cost from. */
export interface SupplierVariant {
  id: string;
  supplierId: string;
  variantId: string;
  /** The supplier's own product code for this item (may differ from yours). */
  supplierSku: string | null;
  /** What the supplier charges you per unit, in cents. */
  unitCostCents: number | null;
  /** The fewest they will sell in one order. */
  minOrderQty: number | null;
  leadTimeDays: number | null;
  /** Your go-to supplier for this item when more than one stocks it. */
  isPreferred: boolean;
  /** YOUR product code + name for the item, joined for display. */
  variantSku: string | null;
  productTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDetail extends Supplier {
  variants: SupplierVariant[];
}

/** Resolving one of your product codes to the item behind it, for the
 *  add-a-purchasing-link form (buyers know the code, not the internal id). */
export interface VariantLookup {
  variantId: string;
  sku: string;
  productTitle: string | null;
}

export interface SupplierListQuery {
  q?: string;
  /** Include the ones you have retired. Off by default — the list is the ones
   *  you actually buy from today. */
  includeArchived: boolean;
  take: number;
  skip: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const supplierKeys = {
  all: ['inventory', 'suppliers'] as const,
  list: (query: SupplierListQuery) => [...supplierKeys.all, 'list', query] as const,
  detail: (id: string) => [...supplierKeys.all, 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** One window of the supplier list. Search and the archived toggle are SERVER
 *  filters — a browser sieve over one page would answer "who do I buy X from"
 *  with only whichever suppliers happen to be on screen. */
export function useSuppliers(query: SupplierListQuery) {
  return useQuery({
    queryKey: supplierKeys.list(query),
    queryFn: () =>
      api.list<Supplier>('/v1/inventory/suppliers', {
        ...(query.q ? { search: query.q } : {}),
        ...(query.includeArchived ? { include_archived: true } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/** One supplier and everything you buy from them. `enabled` is off for the
 *  create pane, which has no id to fetch yet. */
export function useSupplier(id: string) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: () => api.get<SupplierDetail>(`/v1/inventory/suppliers/${id}`),
    enabled: id !== 'new',
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateSuppliers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: supplierKeys.detail(id) });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface SupplierInput {
  name: string;
  code: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  currency: string;
  notes?: string;
}

export function useCreateSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (input: SupplierInput) =>
      api.post<{ id: string }>('/v1/inventory/suppliers', input),
    onSuccess: (result) => {
      invalidate(result.id);
    },
  });
}

export function useUpdateSupplier(id: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (input: Partial<SupplierInput>) =>
      api.patch<Supplier>(`/v1/inventory/suppliers/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useArchiveSupplier(id: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: () => api.delete(`/v1/inventory/suppliers/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Purchasing links (what you buy from a supplier) ────────────────────── */

/** The supplier's purchasing links on their own — used by the PO line editor to
 *  suggest "things you buy from this supplier". The detail pane already gets them
 *  inline, so it does not need this. */
export function useSupplierVariants(supplierId: string) {
  return useQuery({
    queryKey: [...supplierKeys.detail(supplierId), 'variants'] as const,
    queryFn: () => api.get<SupplierVariant[]>(`/v1/inventory/suppliers/${supplierId}/variants`),
    enabled: supplierId !== '' && supplierId !== 'new',
  });
}

export interface SupplierVariantInput {
  variantId: string;
  supplierSku?: string;
  unitCostCents?: number;
  minOrderQty?: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
}

export function useUpsertSupplierVariant(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (input: SupplierVariantInput) =>
      api.put<SupplierVariant>(`/v1/inventory/suppliers/${supplierId}/variants`, input),
    onSuccess: () => {
      invalidate(supplierId);
    },
  });
}

export function useRemoveSupplierVariant(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (variantId: string) =>
      api.delete(`/v1/inventory/suppliers/${supplierId}/variants/${variantId}`),
    onSuccess: () => {
      invalidate(supplierId);
    },
  });
}

/** Resolve one of your product codes to the item behind it. A mutation rather
 *  than a query because it fires on a button press with a value typed moments
 *  before, not on render. */
export function useVariantLookup() {
  return useMutation({
    mutationFn: (sku: string) =>
      api.get<VariantLookup>('/v1/inventory/suppliers/variant-lookup', { sku }),
  });
}

/* ── Saying what a supplier's state means ───────────────────────────────── */

export interface SupplierState {
  label: string;
  tone: Tone;
}

/** Active or retired, in plain words + a tone for the badge. */
export function supplierState(supplier: Supplier): SupplierState {
  return supplier.isActive
    ? { label: 'Active', tone: 'success' }
    : { label: 'Archived', tone: 'neutral' };
}

/** A one-line postal address from the parts that are filled in, or null when a
 *  supplier has no address on file. */
export function supplierAddress(supplier: Supplier): string | null {
  const parts = [
    supplier.line1,
    supplier.line2,
    supplier.city,
    supplier.region,
    supplier.postalCode,
    supplier.country,
  ].filter((part): part is string => Boolean(part && part.trim() !== ''));
  return parts.length > 0 ? parts.join(', ') : null;
}

/** How a supplier's default terms read on one line, or null when none are set. */
export function supplierTerms(supplier: Supplier): string | null {
  const parts: string[] = [];
  if (supplier.paymentTerms) parts.push(supplier.paymentTerms);
  if (supplier.leadTimeDays !== null) {
    parts.push(
      `${String(supplier.leadTimeDays)} day${supplier.leadTimeDays === 1 ? '' : 's'} to arrive`
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
