'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE TRADE-ACCOUNT DATA LAYER
//
// A trade account is a business you supply — a garage, a builder, a reseller —
// that buys from you on agreed prices and terms rather than paying card at
// checkout. It carries its own credit limit, its own payment terms, a price
// tier, and its own PEOPLE (contacts) who are allowed to place orders on its
// behalf.
//
// The record lives in the CRM spine (`/v1/crm/b2b-accounts`) but the B2B module
// enriches it with the trade facts — the price tier, the credit picture, the
// per-account overrides (`/v1/b2b/accounts`). So a save touches BOTH: the plain
// identity (name, tax id, website) is a CRM write, and the trade terms (tier,
// credit, payment terms, discount, status, notes) are a B2B write.
//
//   ['b2b','accounts']                      the root every read nests under
//   ['b2b','accounts','list',{…}]           the list surface's window
//   ['b2b','accounts', id]                  one account, enriched, in full
//   ['b2b','accounts', id, 'contacts']      its ordering contacts
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type AccountStatus = 'active' | 'credit_hold' | 'suspended' | 'inactive';
/** `prepay`, or `netN` for any agreed number of days. NOT a fixed set: a
 *  supplier on Net 14 is ordinary, and this used to omit it (and net15, which
 *  the Companies pane could write) so such an account read back as having no
 *  terms at all. See lib/payment-terms.ts. */
export type PaymentTerms = string;
export type ContactRole = 'primary_contact' | 'buyer' | 'approver' | 'viewer';

/** One trade account as the list and the detail header read it. Mirrors
 *  api-rest `toAccountView` in routes/v1/b2b/accounts.ts. */
export interface AccountRow {
  id: string;
  companyName: string;
  taxId: string | null;
  website: string | null;
  pricingTierId: string | null;
  pricingTierName: string | null;
  creditLimitCents: number;
  creditUsedCents: number;
  creditRemainingCents: number;
  creditUtilizationPct: number;
  paymentTerms: PaymentTerms | null;
  discountPercent: number;
  status: AccountStatus;
  fleetSize: number | null;
  notes: string | null;
  /** The extra details THIS business tracks on a company (docs/144 §3). The
   *  same bag the CRM's company pane edits — one record, one set of fields. */
  customProperties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** One resolved fleet unit, for the read-only fleet list on the detail. */
export interface FleetVehicleView {
  label?: string;
  vin?: string;
  domainName: string | null;
  nodeName: string | null;
  nodePath: string[];
  ranges: { label: string; unit: string | null; value: number }[];
  mileage?: number;
  count?: number;
}

export interface AccountDetail extends AccountRow {
  fleetVehicles: FleetVehicleView[];
  overrideCount: number;
}

/** One person on an account who can act on it. Mirrors the CRM
 *  `B2bAccountContactRow`. */
export interface AccountContact {
  id: string;
  role: ContactRole;
  isActive: boolean;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    company: string | null;
  };
}

/** A pricing tier, named down to what the list needs for its select. */
export interface TierChoice {
  id: string;
  name: string;
}

export const accountKeys = {
  all: ['b2b', 'accounts'] as const,
  detail: (id: string) => [...accountKeys.all, id] as const,
  contacts: (id: string) => [...accountKeys.all, id, 'contacts'] as const,
};

/* ── Display language ───────────────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** What an account's standing is, in one word a business owner uses — not the
 *  stored enum. State is its own color axis, independent of the B2B hue. */
export function accountState(status: AccountStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'active':
      return { label: 'Open for orders', tone: 'success' };
    case 'credit_hold':
      return { label: 'On credit hold', tone: 'warning' };
    case 'suspended':
      return { label: 'Suspended', tone: 'danger' };
    default:
      return { label: 'Closed', tone: 'neutral' };
  }
}

/** How the account pays, in plain words — DERIVED, so any agreed number of days
 *  reads as itself. The `switch` this replaced fell through to "No terms set"
 *  for every value it did not list, which reported that no agreement existed
 *  about money somebody is owed. One source now: lib/payment-terms.ts. */
export { paymentTermsLabel } from '../../lib/payment-terms';

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  primary_contact: 'Main contact',
  buyer: 'Can place orders',
  approver: 'Can approve orders',
  viewer: 'Can view only',
};

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export interface AccountListQuery {
  q?: string;
  status?: AccountStatus;
  tierId?: string;
  take: number;
  skip: number;
}

export function useAccounts(query: AccountListQuery) {
  return useQuery({
    queryKey: [...accountKeys.all, 'list', query],
    queryFn: () =>
      api.list<AccountRow>('/v1/b2b/accounts', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.tierId ? { tier_id: query.tierId } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => api.get<AccountDetail>(`/v1/b2b/accounts/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useAccountContacts(id: string) {
  return useQuery({
    queryKey: accountKeys.contacts(id),
    queryFn: () => api.list<AccountContact>(`/v1/crm/b2b-accounts/${id}/contacts`, { take: 100 }),
    enabled: id !== 'new',
  });
}

/** The price tiers an account can be put on — tolerant of an empty tenant. */
export function useTierChoices() {
  return useQuery({
    queryKey: [...accountKeys.all, 'tier-choices'],
    queryFn: () => api.list<TierChoice>('/v1/b2b/pricing-tiers', { take: 250 }),
    staleTime: 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** The plain identity fields — created and edited through the CRM spine. */
export interface IdentityInput {
  companyName: string;
  taxId: string | null;
  website: string | null;
  creditLimit: number; // dollars, as the CRM schema takes them
  paymentTerms: PaymentTerms | null;
  discountPercent: number;
  status: AccountStatus;
  notes: string | null;
}

/** The trade fields the B2B module owns — written to /v1/b2b/accounts. */
export interface TradeInput {
  pricingTierId: string | null;
  creditLimitCents: number;
  paymentTerms: PaymentTerms | null;
  discountPercent: number;
  status: AccountStatus;
  internalNotes: string | null;
  fleetSize: number | null;
  customProperties?: Record<string, unknown>;
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: IdentityInput) =>
      api.post<{ id: string }>('/v1/crm/b2b-accounts', {
        companyName: input.companyName,
        taxId: input.taxId,
        website: input.website,
        creditLimit: input.creditLimit,
        paymentTerms: input.paymentTerms,
        discountPercent: input.discountPercent,
        status: input.status,
        notes: input.notes,
      }),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** Save an existing account: the identity fields go to CRM, the trade fields to
 *  B2B. Two writes, run in order, so a name change and a tier change on the same
 *  Save both land. */
export function useSaveAccount(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: async (input: { identity: Partial<IdentityInput>; trade: TradeInput }) => {
      await api.patch(`/v1/crm/b2b-accounts/${id}`, input.identity);
      await api.patch(`/v1/b2b/accounts/${id}`, input.trade);
    },
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Set the price tier on a freshly-created account — CRM create doesn't take a
 *  tier id, so a new account with a tier chosen needs this follow-up write. */
export function useSetAccountTier() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: { id: string; pricingTierId: string }) =>
      api.patch(`/v1/b2b/accounts/${input.id}`, { pricingTierId: input.pricingTierId }),
    onSuccess: (_data, input) => {
      invalidate(input.id);
    },
  });
}

export function useDeleteAccount(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/b2b-accounts/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useAddContact(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: { customerId: string; role: ContactRole }) =>
      api.post(`/v1/crm/b2b-accounts/${id}/contacts`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useUpdateContact(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: { contactId: string; role?: ContactRole; isActive?: boolean }) =>
      api.patch(`/v1/crm/b2b-accounts/${id}/contacts/${input.contactId}`, {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function accountErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
