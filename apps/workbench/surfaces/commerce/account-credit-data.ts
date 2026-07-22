'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE ACCOUNT-CREDIT DATA LAYER
//
// Account credit is money you put on a customer's account for them to spend with
// you later — a refund kept in store, a goodwill gesture, a loyalty payout. It
// is held PER CUSTOMER (per currency), so there is no editable "credit record":
// you GRANT credit (an audited, ledgered increase) and you read the balance and
// its history. Grants satisfy `GrantAccountCreditInput` from the schema package.
//
//   ['commerce','account-credit','list',{...}]        who has credit
//   ['commerce','account-credit','ledger',cust,cur]   one customer's balance + history
//   ['commerce','customers','search',{q}]             finding a customer to grant to
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
}

export interface AccountCreditRow {
  id: string;
  customerId: string;
  balanceCents: number;
  currency: string;
  updatedAt: string;
  customer: CustomerLite | null;
}

export interface AccountCreditLedgerEntry {
  id: string;
  deltaCents: number;
  /** `grant` | `refund` | `spend` | `adjust` | `expire` | `loyalty_conversion`. */
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface AccountCreditLedger {
  customerId: string;
  currency: string;
  balanceCents: number;
  transactions: AccountCreditLedgerEntry[];
}

/** A person's display name, however much of one they have. */
export function customerName(customer: CustomerLite | null): string {
  if (!customer) return 'A customer';
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (customer.company?.trim()) return customer.company;
  if (customer.email?.trim()) return customer.email;
  return 'A customer';
}

/** How a ledger line reads to a person. */
export function creditReasonMeaning(reason: string): string {
  switch (reason) {
    case 'grant':
      return 'Added by you';
    case 'refund':
      return 'Refund kept as credit';
    case 'spend':
      return 'Spent on an order';
    case 'adjust':
      return 'Adjusted by hand';
    case 'expire':
      return 'Expired';
    case 'loyalty_conversion':
      return 'From loyalty points';
    default:
      return reason;
  }
}

export const accountCreditKeys = {
  all: ['commerce', 'account-credit'] as const,
  ledger: (customerId: string, currency: string) =>
    [...accountCreditKeys.all, 'ledger', customerId, currency] as const,
};

/* ── Queries ────────────────────────────────────────────────────────────── */

export type SortDir = 'asc' | 'desc';

/** Columns the balances list may be ordered by. A SUBSET of the server whitelist
 *  (`AccountCreditSort` in the commerce-list route) — the ones this table exposes
 *  a header for. The server rejects anything off its list, so a typo here fails
 *  loudly with a 422 rather than silently ordering by nothing. */
export type AccountCreditSort = 'balanceCents' | 'updatedAt' | 'firstName' | 'lastName' | 'email';

export interface AccountCreditsPageParams {
  q?: string;
  sortBy: AccountCreditSort;
  order: SortDir;
  take: number;
  skip: number;
}

/**
 * One server-paged, server-sorted window of the balances list.
 *
 * `placeholderData` keeps the previous window on screen while the next loads, so
 * paging and re-sorting never blink the list out to empty and back. The whole
 * window is ONE query — never accumulated pages, never a client-side sort of a
 * loaded window (which would sort one page and present it as the answer).
 */
export function useAccountCredits(params: AccountCreditsPageParams) {
  return useQuery({
    queryKey: [...accountCreditKeys.all, 'list', params] as const,
    queryFn: () =>
      api.list<AccountCreditRow>('/v1/commerce/account-credit', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        sort_by: params.sortBy,
        order: params.order,
        take: params.take,
        skip: params.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useAccountCreditLedger(customerId: string | null, currency = 'USD') {
  return useQuery({
    queryKey: accountCreditKeys.ledger(customerId ?? '', currency),
    queryFn: () =>
      api.get<AccountCreditLedger>(
        `/v1/commerce/account-credit/${customerId ?? ''}/ledger`,
        currency ? { currency } : undefined
      ),
    enabled: customerId !== null,
  });
}

/** Search every customer — used to grant credit to someone who has none yet. */
export function useCustomerSearch(search: string) {
  return useQuery({
    queryKey: ['commerce', 'customers', 'search', { q: search }] as const,
    queryFn: () =>
      api.list<CustomerLite>('/v1/crm/customers', {
        ...(search.trim() ? { q: search.trim() } : {}),
        take: 20,
      }),
    enabled: search.trim().length > 0,
    staleTime: 30_000,
  });
}

/* ── Mutation ───────────────────────────────────────────────────────────── */

/** The `GrantAccountCreditInput` shape. `amountCents` must be positive — this
 *  endpoint only ADDS credit; spending happens at checkout, never by hand. */
export interface GrantCreditInput {
  customerId: string;
  amountCents: number;
  currency: string;
  reason?: 'grant' | 'refund' | 'adjust' | 'loyalty_conversion';
  note?: string;
  expiresAt?: string;
}

export function useGrantAccountCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantCreditInput) =>
      api.post<{ newBalanceCents: number }>('/v1/commerce/account-credit/grant', input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: accountCreditKeys.all });
      void queryClient.invalidateQueries({
        queryKey: accountCreditKeys.ledger(input.customerId, input.currency),
      });
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function accountCreditErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
