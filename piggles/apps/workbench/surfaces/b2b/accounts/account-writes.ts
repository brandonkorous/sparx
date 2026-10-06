'use client';

import { useMutation } from '@wizeworks/query';
import { api } from '../../../lib/api/client';
import { type PaymentTerms, type AccountStatus, useInvalidateAccounts } from '../accounts-data';

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
