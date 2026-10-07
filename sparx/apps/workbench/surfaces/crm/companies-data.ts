'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE COMPANY DATA LAYER
//
// A company is the ORGANISATION a contact belongs to (docs/144 §11). For a
// business that sells on account it ALSO carries the trading relationship — a
// credit limit, a discount, net payment terms — and that half of the record only
// renders when the `b2b` module is on. A design agency tracking the firms it
// works with sees a company; a parts wholesaler sees the same record with trade
// terms on it.
// The write shapes mirror the CRM's own `CreateCompanyInput` /
// `UpdateCompanyInput` (Zod in `@wizeworks/crm-schemas`), named locally because
// that package is not a dependency of this app; the server runs that Zod and has
// the final say on anything malformed.
//
//   ['crm','accounts']              the root every read nests under
//   ['crm','accounts','list',{…}]   one list window
//   ['crm','accounts', id]          one account, in full
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import type { CompanyStatus, PaymentTerms } from '@wizeworks/crm-schemas';
import { api } from '../../lib/api/client';
import { formatAmount } from '../../lib/money-format';

// The status + payment-terms enums come straight from `@wizeworks/crm-schemas` (the
// server's Zod), so they can't drift. `AccountInput` below stays a local, narrow
// write PAYLOAD on purpose (the `DiscountInput` house pattern): the full
// `CreateCompanyInput` requires a defaulted `engineProfiles: []`, and because
// this pane's create and update share one build path, sending it would wipe a
// fleet's engine profiles on every save — so the pane sends only what it manages.
export type { CompanyStatus, PaymentTerms };

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One wholesale account in full. Money and percentages arrive as serialized
 *  Decimals (STRINGS); coerce with `Number`. */
export interface Company {
  id: string;
  companyName: string;
  taxId: string | null;
  website: string | null;
  /** The email domains that belong to this company (docs/144 §11) — what the
   *  association offer matches a new contact's address against. */
  domains: string[];
  /** The price tier they buy on, or null for normal prices. */
  pricingTierId: string | null;
  /** The name of the tier that prices them (null for normal prices). */
  pricingTier: string | null;
  /** The tier they are still linked to after it was removed; it prices nothing. */
  removedTierName?: string | null;
  creditLimit: string;
  creditUsed: string;
  paymentTerms: string | null;
  discountPercent: string;
  status: string;
  assignedRepId: string | null;
  fleetSize: number | null;
  notes: string | null;
  tags: string[];
  /** The extra details THIS business tracks on a company (docs/144 §3). */
  customProperties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** How many contacts sit under this company. Present on the LIST only — the
   *  detail pane shows the people themselves, which is the better answer. */
  _count?: { customers: number };
}

export interface AccountListParams {
  q?: string;
  status?: CompanyStatus;
}

export const accountKeys = {
  all: ['crm', 'accounts'] as const,
  list: (params: AccountListParams) => [...accountKeys.all, 'list', params] as const,
  detail: (id: string) => [...accountKeys.all, id] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

export const ACCOUNT_STATUSES: CompanyStatus[] = ['active', 'credit_hold', 'suspended', 'inactive'];

/** How an account's state reads — plain label, tone for the badge, and a
 *  sentence. These carry a genuine good/needs-attention/bad meaning, so the
 *  tones are semantic.
 *
 *  EVERY SENTENCE HERE IS A CLAIM THE CHECKOUT HAS TO KEEP, and three of the
 *  four did not. All the account-state guards live inside
 *  `if (activeB2bAccountId && session.paymentTermsRequested)`, so each one is
 *  about ordering ON TERMS and none of them stops a card payment.
 *
 *    - Active said "can place orders on its agreed terms". It cannot, unless a
 *      credit limit is set: the checkout works out `creditLimit - creditUsed`
 *      and refuses anything larger, and the column is `NOT NULL DEFAULT 0`.
 *      MEASURED 2026-09-25: all ten Active companies sat at zero, every one of
 *      them under this sentence and a green badge.
 *    - Suspended said "cannot order". It can still buy paying up front.
 *    - Inactive said "not trading", and nothing in the order path read the
 *      state at all. It does now (`account-order-gate.ts` in @wizeworks/crm), so
 *      this sentence became true rather than being reworded around.
 *    - Active said "Whether they can order on terms depends on the credit limit
 *      below", which was true while an order past the limit was REFUSED. It now
 *      waits for the owner's sign-off, as the /b2b page promises, from the
 *      checkout and from an accepted quote alike (sparx persona issue 085). */
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
        description:
          'Nothing here is holding this account back. An order on terms that would go past the credit limit below waits for your sign-off.',
      };
    case 'credit_hold':
      return {
        label: 'Credit hold',
        tone: 'warning',
        description: 'They cannot order on terms until what they owe is settled.',
      };
    case 'suspended':
      return {
        label: 'Suspended',
        tone: 'danger',
        description: 'They cannot order on terms. They can still buy from you paying up front.',
      };
    default:
      return {
        label: 'Inactive',
        tone: 'neutral',
        description:
          'Kept on file and not being traded with. They cannot order on terms while this is set.',
      };
  }
}

/** The presets and the wording both live in lib/payment-terms.ts, because the
 *  B2B trade pane edits this same column and used to carry its own, shorter
 *  list — so a company on 15-day terms read back there as having none. */
export { PAYMENT_TERM_PRESETS as PAYMENT_TERMS, paymentTermsLabel } from '../../lib/payment-terms';

export function formatMoney(value: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return formatAmount(n, currency);
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useAccounts(params: AccountListParams = {}) {
  return useQuery({
    queryKey: accountKeys.list(params),
    queryFn: () =>
      api.list<Company>('/v1/crm/companies', {
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
    queryFn: () => api.get<Company>(`/v1/crm/companies/${id}`),
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
    // The same row is the Wholesale pane's account: a tier or terms changed here
    // must not leave that pane, open beside this one, showing the old ones.
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'accounts'] });
    if (id) void queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** The write payload — a subset of `CreateCompanyInput`. */
export interface AccountInput {
  companyName: string;
  taxId?: string | null;
  website?: string | null;
  domains?: string[];
  pricingTierId?: string | null;
  creditLimit?: number;
  paymentTerms?: PaymentTerms | null;
  discountPercent?: number;
  status?: CompanyStatus;
  assignedRepId?: string | null;
  fleetSize?: number | null;
  notes?: string | null;
  tags?: string[];
  customProperties?: Record<string, unknown>;
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: AccountInput) => api.post<Company>('/v1/crm/companies', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateAccount(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (patch: Partial<AccountInput>) =>
      api.patch<Company>(`/v1/crm/companies/${id}`, patch),
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
    mutationFn: () => api.delete(`/v1/crm/companies/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── The association offer (docs/144 §11) ───────────────────────────────── */

/** What the server made of an email address. `company` null with a `reason` is
 *  the ordinary case, not an error — most addresses match nothing. */
export interface DomainMatch {
  company: Company | null;
  domain: string | null;
  reason?: 'no-domain' | 'public-domain' | 'disabled' | 'no-match';
}

/**
 * Which company owns this email address.
 *
 * Debounced by TanStack's own staleness rather than a timer: the key IS the
 * email, so typing produces one cached lookup per distinct address and going
 * back to one already tried costs nothing.
 *
 * Disabled below an @ and a dot, because there is no address to match yet and a
 * request per keystroke into an empty field is a request per keystroke.
 */
export function useCompanyDomainMatch(email: string, enabled = true) {
  const trimmed = email.trim().toLowerCase();
  const looksLikeAddress = /@[^@\s]+\.[^@\s]+$/.test(trimmed);
  return useQuery({
    queryKey: [...accountKeys.all, 'domain-match', trimmed],
    queryFn: () => api.get<DomainMatch>('/v1/crm/companies/match-domain', { email: trimmed }),
    enabled: enabled && looksLikeAddress,
    staleTime: 300_000,
  });
}

export function accountErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** A new request from a company: already naming who asked when only one
 *  person works there. With several, the form asks. */
export function newRequestParams(people: readonly { id: string }[]): {
  id: 'new';
  customerId?: string;
} {
  const only = people.length === 1 ? people[0] : undefined;
  return only ? { id: 'new', customerId: only.id } : { id: 'new' };
}
