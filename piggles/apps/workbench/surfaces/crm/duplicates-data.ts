'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE DUPLICATES DATA LAYER
//
// The "same person entered twice" problem shows up the moment you accept guest
// checkouts: one email with a stray capital, or one customer who used two
// addresses. The server scans for likely duplicates and groups them; merging a
// group folds every duplicate INTO one chosen record — its orders, spend,
// tasks, deals and addresses all move onto the survivor, and the others are
// retired with a pointer back so the trail is never lost.
//
// Merge is irreversible and admin-only on the server, so the surface gates the
// action on the viewer's role AND puts it behind a confirm that names what is
// kept and what disappears.
//
//   ['crm','duplicates']   the clusters
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { Customer } from './customers-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One cluster of records the server believes are the same person. Ordered
 *  newest-first by the server, so the first is the natural "keep this one". */
export interface DuplicateGroup {
  reason: 'email' | 'phone' | 'name+company';
  customers: Customer[];
  /**
   * How sure the server is, 0-100 — and the reason a bulk merge is safe to
   * offer at all. An identical email is 100; a shared phone number is 90; a
   * surname and an employer is 60, which is below every threshold the settings
   * screen accepts, so the weakest signal can never merge on its own.
   */
  confidence: number;
}

export const duplicateKeys = {
  all: ['crm', 'duplicates'] as const,
};

export function reasonLabel(reason: DuplicateGroup['reason']): string {
  if (reason === 'email') return 'Same email address';
  if (reason === 'phone') return 'Same phone number';
  return 'Same surname and employer';
}

/** How sure reads, as a word and a colour. "60%" beside "100%" in the same grey
 *  tells somebody nothing about which one to act on. */
export function confidenceMeta(confidence: number): {
  tone: 'success' | 'info' | 'warning';
  label: string;
} {
  if (confidence >= 100) return { tone: 'success', label: 'Certain' };
  if (confidence >= 80) return { tone: 'info', label: 'Very likely' };
  return { tone: 'warning', label: 'Worth a look' };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useDuplicates() {
  return useQuery({
    queryKey: duplicateKeys.all,
    // `/v1/crm/duplicates`, not the older `/v1/crm/customers/duplicates`: only
    // this one honours the tenant's chosen match rules and returns a confidence
    // (docs/144 §12). The old path still exists for anything integrating
    // against it, and returns the two-reason answer it always did.
    queryFn: () => api.list<DuplicateGroup>('/v1/crm/duplicates', {}),
  });
}

export interface BulkMergeResult {
  merged: number;
  absorbed: number;
  skipped: { reason: string; count: number }[];
}

/**
 * Merge every group at or above a confidence floor.
 *
 * The survivor in each is the most recently updated record — the one somebody
 * has touched most recently, so the one whose corrections are worth keeping —
 * and every field it is missing is filled in from the others, so nothing is
 * actually lost either way.
 */
export function useBulkMerge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (minConfidence: number) =>
      api.post<BulkMergeResult>('/v1/crm/duplicates/bulk-merge', { minConfidence }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: duplicateKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    },
  });
}

/* ── Merge ──────────────────────────────────────────────────────────────── */

export interface MergeResult {
  reattached: {
    activities: number;
    deals: number;
    tasks: number;
    addresses: number;
    /** Orders, invoices, bookings, consents, saved cards, credit — everything
     *  the person owned that is not one of the four counted above. */
    everythingElse: number;
  };
}

export function useMergeCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { primaryCustomerId: string; duplicateCustomerIds: string[] }) =>
      api.post<MergeResult>('/v1/crm/customers/merge', input),
    onSuccess: () => {
      // A merge rewrites the whole customer graph — the duplicate scan, the
      // customer list and every affected detail all change at once.
      void queryClient.invalidateQueries({ queryKey: duplicateKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    },
  });
}

export function mergeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
