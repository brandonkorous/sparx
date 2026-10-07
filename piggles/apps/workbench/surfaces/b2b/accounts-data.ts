'use client';

// THE TRADE-ACCOUNT DATA LAYER: a business you supply on agreed prices and terms.
// Identity is a CRM write (/v1/crm/b2b-accounts), trade terms a B2B write
// (/v1/b2b/accounts). Keys: ['b2b','accounts'], +'list', +id, +id 'contacts'.

import { useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import { formatCentsAmount } from '../../lib/money-format';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type AccountStatus = 'active' | 'credit_hold' | 'suspended' | 'inactive';
/** `prepay`, or `netN` for any agreed number of days. NOT a fixed set, or Net 14
 *  reads back as no terms at all. See lib/payment-terms.ts. */
export type PaymentTerms = string;
export type ContactRole = 'primary_contact' | 'buyer' | 'approver' | 'viewer';

/** One wholesale customer as the list and the detail header read it. Mirrors
 *  api-rest `toAccountView` in routes/v1/b2b/accounts.ts. */
export interface AccountRow {
  id: string;
  companyName: string;
  taxId: string | null;
  website: string | null;
  pricingTierId: string | null;
  /** The group that prices them; null for normal prices, a removed group included. */
  pricingTierName: string | null;
  /** The group they are still in after it was removed; it prices nothing. */
  removedTierName: string | null;
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
  /** Read so the picker can say what the tier gives ("Fleet · 12% off"):
   *  names alone made the owner remember which group was which (sparx
   *  persona issue 074). */
  discountType: 'percentage' | 'fixed';
  discountValue: number;
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

/** How the account pays, in plain words, DERIVED so any agreed number of days
 *  reads as itself. One source: lib/payment-terms.ts. */
export { paymentTermsLabel } from '../../lib/payment-terms';

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  primary_contact: 'Main contact',
  buyer: 'Can place orders',
  approver: 'Can approve orders',
  viewer: 'Can view only',
};

// The people already on an account, by customer id, with the words the Add someone
// picker shows instead of offering them again (sparx persona issue 086). Active only:
// re-adding someone switched off turns them back on.
export function alreadyOnAccount(contacts: readonly AccountContact[]): Map<string, string> {
  return new Map(
    contacts
      .filter((contact) => contact.isActive)
      .map((contact) => [
        contact.customer.id,
        `Already on this account (${CONTACT_ROLE_LABELS[contact.role].toLowerCase()})`,
      ])
  );
}

export function formatCents(cents: number, currency = 'USD'): string {
  return formatCentsAmount(cents, currency);
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
    // The same row is the Customers pane's company: that pane, open beside this
    // one, shows the same group and terms and has to hear about a change here.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'accounts'] });
    if (id) void queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) });
  };
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function accountErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/**
 * What the chosen standing means, under the Standing box.
 *
 * It read "Put them on credit hold to stop new orders until they've paid what
 * they owe." in every state. O'Malley Ranch was suspended by the late-payment
 * ladder over a bill 40 days late, and the page said only "Suspended" above a
 * line about credit holds: not who did it, not why, not what to do (sparx
 * persona issue 101). Both holds stop orders on the account's terms; paying up
 * front still works (`accountStandingRefusal`).
 */
export function standingHelp(status: AccountStatus): string {
  switch (status) {
    case 'credit_hold':
      return 'They cannot order on account until this is lifted. Paying up front still works. This is set on its own when a bill is 14 days late. Set Open for orders when you are ready.';
    case 'suspended':
      return 'They cannot order on account until this is lifted. Paying up front still works. This is set on its own when a bill is 30 days late. Once they have paid, set Open for orders.';
    case 'inactive':
      return 'They no longer buy from you on account. Their orders and invoices are kept.';
    default:
      return 'Put them on credit hold to stop new orders until they have paid what they owe.';
  }
}
