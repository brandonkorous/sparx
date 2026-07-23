'use client';

// Your sparx bill — what WizeWorks charges this tenant, and the card it comes off.
//
// GET /v1/finance/bill is a read snapshot: the plan is derived from the tenant's
// billable module flags + list prices (always meaningful, even before the billing
// ops land), the status from webhook-reconciled columns, the card from a Stripe
// read. Managing the card / subscription is Stripe's hosted portal — opened via
// POST /v1/billing/portal, which returns a single-use URL we send the browser to.

import { useMutation, useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';

export interface BillCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface BillModule {
  moduleKey: string;
  monthlyCents: number;
}

/** Where the tenant sits in the Trial → Grace → Suspend lifecycle (docs/17 §6).
 *  Mirror of @sparx/billing's BillingPhase/BillingPhaseView — redeclared here so
 *  the workbench doesn't import the server billing package for a wire shape. */
export type BillingPhase = 'trialing' | 'active' | 'grace' | 'suspended' | 'exempt';
export interface BillingPhaseView {
  phase: BillingPhase;
  /** Whole days left in the current countdown (trial or grace); null when not
   *  counting down. */
  daysLeft: number | null;
  trialEndsAt: string | null;
  /** ISO moment the public site goes offline (end of grace). */
  suspendsAt: string | null;
}

export interface Bill {
  configured: boolean;
  billingActive: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: 'monthly' | 'annual';
  planModules: BillModule[];
  planTotalCents: number;
  planType: 'standard' | 'enterprise';
  /** Lifecycle phase + countdown — drives the topbar trial chip + banner ladder. */
  billing: BillingPhaseView;
  card: BillCard | null;
}

export function useBill() {
  return useQuery({
    queryKey: ['finance', 'bill'],
    queryFn: () => api.get<Bill>('/v1/finance/bill'),
  });
}

/** Open Stripe's hosted portal — the only place the card + subscription are
 *  edited. Returns the single-use URL; the caller navigates the window to it. */
export function useBillingPortal() {
  return useMutation({
    mutationFn: (returnUrl: string) =>
      api.post<{ url: string }>('/v1/billing/portal', { returnUrl }),
  });
}
