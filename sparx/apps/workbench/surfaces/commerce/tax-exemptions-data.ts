'use client';

// Tax exemption certificates: read, add, remove.
//
// A certificate belongs to ONE customer or ONE wholesale account (the account's
// id is its CRM company id). There is deliberately no tenant-wide list: a
// certificate means nothing apart from the buyer it is filed on, so it is read
// and written from that buyer's own page.
//
// Shapes mirror api-rest's `taxService.ExemptionsOnFile`; the input satisfies
// `CreateTaxExemptionInput` in @wizeworks/commerce-schemas.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { ExemptionReason } from './tax-exemption-words';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface TaxExemption {
  id: string;
  customerId: string | null;
  companyId: string | null;
  /** "US" (the whole country) or "US-UT" (one state). */
  jurisdiction: string;
  reason: string;
  certificateNumber: string;
  certificateMediaId: string | null;
  validFrom: string;
  validTo: string | null;
}

/** The wholesale account a customer buys for, and the certificates it holds.
 *  Checkout applies these to the customer as well. */
export interface AccountExemptions {
  accountId: string;
  accountName: string;
  exemptions: TaxExemption[];
}

export interface ExemptionsOnFile {
  items: TaxExemption[];
  /** Set only when reading a customer, and only while they buy for an account. */
  account: AccountExemptions | null;
}

/** Whose certificates: one customer, or one wholesale account. */
export type ExemptionHolder = { customerId: string } | { companyId: string };

export interface TaxExemptionInput {
  customerId?: string;
  companyId?: string;
  jurisdiction: string;
  reason: ExemptionReason;
  certificateNumber: string;
  validFrom: string;
  validTo?: string;
}

const exemptionKeys = {
  root: ['commerce', 'tax', 'exemptions'] as const,
  of: (holder: ExemptionHolder) =>
    'customerId' in holder
      ? (['commerce', 'tax', 'exemptions', 'customer', holder.customerId] as const)
      : (['commerce', 'tax', 'exemptions', 'company', holder.companyId] as const),
};

function holderQuery(holder: ExemptionHolder): Record<string, string> {
  return 'customerId' in holder
    ? { customer_id: holder.customerId }
    : { company_id: holder.companyId };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useTaxExemptions(holder: ExemptionHolder, enabled = true) {
  return useQuery({
    queryKey: exemptionKeys.of(holder),
    queryFn: () => api.get<ExemptionsOnFile>('/v1/commerce/tax/exemptions', holderQuery(holder)),
    enabled,
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

// Every holder's list is invalidated, not just this one: a certificate added to
// an account changes what each of its buyers' pages says about them.
function useInvalidateExemptions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: exemptionKeys.root });
}

export function useAddTaxExemption() {
  const invalidate = useInvalidateExemptions();
  return useMutation({
    mutationFn: (input: TaxExemptionInput) =>
      api.post<{ id: string }>('/v1/commerce/tax/exemptions', input),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useRemoveTaxExemption() {
  const invalidate = useInvalidateExemptions();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/commerce/tax/exemptions/${id}`),
    onSuccess: () => {
      void invalidate();
    },
  });
}
