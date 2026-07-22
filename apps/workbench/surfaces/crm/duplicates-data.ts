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
  reason: 'email' | 'name+company';
  customers: Customer[];
}

export const duplicateKeys = {
  all: ['crm', 'duplicates'] as const,
};

export function reasonLabel(reason: DuplicateGroup['reason']): string {
  return reason === 'email' ? 'Same email address' : 'Same name and company';
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useDuplicates() {
  return useQuery({
    queryKey: duplicateKeys.all,
    queryFn: () => api.get<DuplicateGroup[]>('/v1/crm/customers/duplicates'),
  });
}

/* ── Merge ──────────────────────────────────────────────────────────────── */

export interface MergeResult {
  reattached: { activities: number; deals: number; tasks: number; addresses: number };
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
