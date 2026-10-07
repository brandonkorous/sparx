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

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
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

/** How sure reads, as a word and a color. "60%" beside "100%" in the same grey
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
  return apiErrorMessage(error, fallback);
}

/**
 * What a merge will NOT carry over, in words, for the record being retired.
 *
 * The server fills only what the kept record is missing (merge-service.ts step
 * 4), so when both have an email address the retired one's is gone. Brynn moved
 * and came back with a new email and phone (sparx persona issue 109): whoever
 * merges her has to know which address the next receipt goes to.
 */
export function mergeDropsWords(
  keep: { email: string | null; phone: string | null },
  other: { email: string | null; phone: string | null }
): string[] {
  const words: string[] = [];
  const differs = (a: string | null, b: string | null): boolean =>
    Boolean(a?.trim()) && Boolean(b?.trim()) && a!.trim().toLowerCase() !== b!.trim().toLowerCase();
  if (differs(keep.email, other.email)) {
    words.push(`Emails go to ${keep.email!.trim()}. ${other.email!.trim()} is not kept.`);
  }
  const digits = (raw: string | null): string | null =>
    raw ? raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') || null : null;
  if (differs(digits(keep.phone), digits(other.phone))) {
    words.push(`The phone number is ${keep.phone!.trim()}. ${other.phone!.trim()} is not kept.`);
  }
  return words;
}

interface MergeSide {
  name: string;
  email: string | null;
  phone: string | null;
}

/**
 * The confirm box for a hand merge.
 *
 * Two records of one person usually carry one name, and "Merge Brynn
 * O'Hara-Løvdal into Brynn O'Hara-Løvdal?" told the owner nothing about which
 * one goes (sparx persona issue 109). When the names match, each side is named by
 * its email (or phone) instead.
 */
export function mergeConfirmWords(
  keep: MergeSide,
  retire: MergeSide
): { title: string; description: string; action: string } {
  const moves = 'Their orders, invoices, spending, notes and addresses move onto';
  const ends = 'is then retired and drops out of your lists. This cannot be undone.';
  if (keep.name !== retire.name) {
    return {
      title: `Merge ${retire.name} into ${keep.name}?`,
      description: `${moves} ${keep.name}. ${retire.name} ${ends}`,
      action: `Merge into ${keep.name}`,
    };
  }
  // An empty string is not a way to tell them apart, so it falls through too.
  const tell = (side: MergeSide): string | null => {
    const email = side.email?.trim();
    if (email) return email;
    const phone = side.phone?.trim();
    if (phone) return phone;
    return null;
  };
  const keepTag = tell(keep);
  const retireTag = tell(retire);
  return {
    title: `Merge the two records for ${keep.name}?`,
    description: `${moves} the one ${keepTag ? `with ${keepTag}` : 'you are keeping'}. The one ${retireTag && retireTag !== keepTag ? `with ${retireTag}` : 'you are not keeping'} ${ends}`,
    action: 'Merge the two records',
  };
}
