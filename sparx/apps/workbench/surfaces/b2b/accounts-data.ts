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
import { formatCentsAmount } from '../../lib/money-format';
import { customerKeys } from '../crm/customers-data';
import { discountSummary } from './pricing-tiers-data';

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
  /** The tier that prices them; null for normal prices, a removed tier included. */
  pricingTierName: string | null;
  /** The tier they are still linked to after it was removed, which prices nothing. */
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

/**
 * The people already on an account, by customer id, with the words the Add
 * someone picker shows under each instead of letting them be picked again. The
 * picker offered Renée to Wasatch a second time and the server then refused her
 * (sparx persona issue 086). Only the active ones: adding someone who was
 * switched off turns them back on, which is allowed.
 */
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

/**
 * The choices for a "Price tier" select: normal prices (the empty value), then
 * every tier with what it gives.
 *
 * Shared by the Wholesale account pane and the CRM company pane, so the two put
 * the same question the same way. The CRM pane had a free-text box writing a
 * column nothing priced from, and showed Wasatch Front with no tier while this
 * pane showed it on Fleet at 12% off (sparx persona issue 086).
 *
 * `current` is the tier the account is linked to. When it is not among the
 * choices it is still offered under its own name, so the select never shows a
 * blank for a tier that is set. A removed one (`removed`, or missing from a list
 * that has loaded) says so: it prices nothing, so the account pays normal prices.
 */
export function tierChoiceItems(
  tiers: TierChoice[] | undefined,
  noneLabel: string,
  current?: { id: string | null; name: string | null; removed?: boolean }
): { value: string; label: string }[] {
  const items = (tiers ?? []).map((tier) => ({
    value: tier.id,
    label: `${tier.name} · ${discountSummary(tier)}`,
  }));
  if (current?.id && !items.some((item) => item.value === current.id)) {
    const name = current.name ?? 'The tier they were on';
    const removed = current.removed === true || tiers !== undefined;
    items.push({ value: current.id, label: removed ? removedTierWords(name) : name });
  }
  return [{ value: '', label: noneLabel }, ...items];
}

/** How a removed tier reads wherever the account's own screen names it. */
export function removedTierWords(name: string): string {
  return `${name} (removed, so normal prices)`;
}

/**
 * The tier line under the account's name: the tier that prices them, the
 * removed one said plainly, or null for normal prices. It named a removed tier
 * as if it still applied (sparx persona issue 086).
 */
export function accountTierWords(account: {
  pricingTierName: string | null;
  removedTierName: string | null;
}): string | null {
  if (account.pricingTierName) return account.pricingTierName;
  return account.removedTierName ? removedTierWords(account.removedTierName) : null;
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    // The same row is the CRM's company: its pane, open beside this one, shows
    // the same tier and terms and has to hear about a change made here.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'accounts'] });
    if (id) void queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) });
  };
}

/**
 * Adding or removing a member writes on the CUSTOMER as well, so the customer's
 * own pane has to hear about it.
 *
 * The membership and `Customer.companyId` are kept in step by
 * `trade-membership.ts` in one transaction (issue 744), which fixed the DATA.
 * It does not fix the SCREEN: a customer pane open beside this one went on
 * naming a business it had just been taken off, until somebody pressed refresh.
 * A pane showing a fact that another pane just changed is the workbench's own
 * version of the same disagreement.
 */
export function useInvalidateMembership() {
  const queryClient = useQueryClient();
  const invalidateAccounts = useInvalidateAccounts();
  return (accountId: string) => {
    invalidateAccounts(accountId);
    // The whole root: the pointer shows on the customer's rail, in the list's
    // company column, and in every filtered window of it.
    void queryClient.invalidateQueries({ queryKey: customerKeys.all });
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

/**
 * Who on an account can approve orders decides who signs the orders a spending
 * limit holds for its own approvers (sparx persona issue 087). The limits and
 * the held orders name those people, so a contact added, re-roled or removed
 * here has to reach Approvals too. Literal keys: approvals-data imports this
 * file, so importing it back would be a cycle.
 */
function useInvalidateSignOff() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'approval-rules'] });
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'approval-queue'] });
  };
}

export function useAddContact(id: string) {
  const invalidate = useInvalidateMembership();
  const invalidateSignOff = useInvalidateSignOff();
  return useMutation({
    mutationFn: (input: { customerId: string; role: ContactRole }) =>
      api.post(`/v1/crm/b2b-accounts/${id}/contacts`, input),
    onSuccess: () => {
      invalidate(id);
      invalidateSignOff();
    },
  });
}

export function useUpdateContact(id: string) {
  const invalidate = useInvalidateMembership();
  const invalidateSignOff = useInvalidateSignOff();
  return useMutation({
    mutationFn: (input: { contactId: string; role?: ContactRole; isActive?: boolean }) =>
      api.patch(`/v1/crm/b2b-accounts/${id}/contacts/${input.contactId}`, {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      }),
    onSuccess: () => {
      invalidate(id);
      invalidateSignOff();
    },
  });
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
