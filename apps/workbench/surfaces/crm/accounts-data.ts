'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE WHOLESALE-ACCOUNT DATA LAYER
//
// A wholesale account is a BUSINESS that buys from you at agreed terms — a
// credit limit, a discount, net payment terms. Its individual people are
// customers of type `b2b` linked to it; this record is the company itself.
// The write shapes mirror the CRM's own `CreateB2BAccountInput` /
// `UpdateB2BAccountInput` (Zod in `@sparx/crm-schemas`), named locally because
// that package is not a dependency of this app; the server runs that Zod and has
// the final say on anything malformed.
//
//   ['crm','accounts']              the root every read nests under
//   ['crm','accounts','list',{…}]   one list window
//   ['crm','accounts', id]          one account, in full
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import type { B2BAccountStatus, PaymentTerms } from '@sparx/crm-schemas';
import { api } from '../../lib/api/client';

// The status + payment-terms enums come straight from `@sparx/crm-schemas` (the
// server's Zod), so they can't drift. `AccountInput` below stays a local, narrow
// write PAYLOAD on purpose (the `DiscountInput` house pattern): the full
// `CreateB2BAccountInput` requires a defaulted `engineProfiles: []`, and because
// this pane's create and update share one build path, sending it would wipe a
// fleet's engine profiles on every save — so the pane sends only what it manages.
export type { B2BAccountStatus, PaymentTerms };

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One wholesale account in full. Money and percentages arrive as serialized
 *  Decimals (STRINGS); coerce with `Number`. */
export interface B2BAccount {
  id: string;
  companyName: string;
  taxId: string | null;
  website: string | null;
  pricingTier: string | null;
  creditLimit: string;
  creditUsed: string;
  paymentTerms: string | null;
  discountPercent: string;
  status: string;
  assignedRepId: string | null;
  fleetSize: number | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AccountListParams {
  q?: string;
  status?: B2BAccountStatus;
}

export const accountKeys = {
  all: ['crm', 'accounts'] as const,
  list: (params: AccountListParams) => [...accountKeys.all, 'list', params] as const,
  detail: (id: string) => [...accountKeys.all, id] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

export const ACCOUNT_STATUSES: B2BAccountStatus[] = [
  'active',
  'credit_hold',
  'suspended',
  'inactive',
];

/** How an account's state reads — plain label, tone for the badge, and a
 *  sentence. These carry a genuine good/needs-attention/bad meaning, so the
 *  tones are semantic. */
export function accountStatusMeta(status: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  description: string;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        tone: 'success',
        description: 'This account can place orders on its agreed terms.',
      };
    case 'credit_hold':
      return {
        label: 'Credit hold',
        tone: 'warning',
        description: 'Ordering on account is paused until an outstanding balance is settled.',
      };
    case 'suspended':
      return {
        label: 'Suspended',
        tone: 'danger',
        description: 'This account is switched off and cannot order.',
      };
    default:
      return {
        label: 'Inactive',
        tone: 'neutral',
        description: 'This account is dormant — kept on file but not trading.',
      };
  }
}

export const PAYMENT_TERMS: { value: PaymentTerms; label: string }[] = [
  { value: 'prepay', label: 'Pay before dispatch' },
  { value: 'net15', label: '15 days to pay' },
  { value: 'net30', label: '30 days to pay' },
  { value: 'net60', label: '60 days to pay' },
  { value: 'net90', label: '90 days to pay' },
];

export function paymentTermsLabel(terms: string | null): string {
  if (!terms) return 'No agreed terms';
  return PAYMENT_TERMS.find((t) => t.value === terms)?.label ?? terms;
}

export function formatMoney(value: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useAccounts(params: AccountListParams = {}) {
  return useQuery({
    queryKey: accountKeys.list(params),
    queryFn: () =>
      api.list<B2BAccount>('/v1/crm/b2b-accounts', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.status ? { status: params.status } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => api.get<B2BAccount>(`/v1/crm/b2b-accounts/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    // A customer's linked-account picker reads the account list, and merging /
    // renaming an account changes what that picker shows.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    if (id) void queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** The write payload — a subset of `CreateB2BAccountInput`. */
export interface AccountInput {
  companyName: string;
  taxId?: string | null;
  website?: string | null;
  pricingTier?: string | null;
  creditLimit?: number;
  paymentTerms?: PaymentTerms | null;
  discountPercent?: number;
  status?: B2BAccountStatus;
  assignedRepId?: string | null;
  fleetSize?: number | null;
  notes?: string | null;
  tags?: string[];
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: AccountInput) => api.post<B2BAccount>('/v1/crm/b2b-accounts', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateAccount(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (patch: Partial<AccountInput>) =>
      api.patch<B2BAccount>(`/v1/crm/b2b-accounts/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Soft-delete. The server keeps the row (orders and history FK into it) and
 *  just stamps `deletedAt`, so it drops out of every list. Admin-only server
 *  side. */
export function useDeleteAccount(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/b2b-accounts/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function accountErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
