'use server';

// Server actions for the billing settings page. Reads the plan snapshot and
// opens a Stripe Customer Portal session — all the actual subscription management
// (add/remove modules, card, cancel) happens IN the portal, so there's no custom
// mutation surface here (docs/67 §5).

import 'server-only';
import { api, type ApiRestError } from '@/lib/api-rest-client';

export interface BillingPlanModule {
  moduleKey: string;
  monthlyCents: number;
}

export interface BillingState {
  configured: boolean;
  billingActive: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: 'monthly' | 'annual';
  planModules: BillingPlanModule[];
  planTotalCents: number;
  planType: 'standard' | 'enterprise';
}

export async function getBillingState(): Promise<BillingState> {
  return api.get<BillingState>('/v1/billing');
}

export type PortalResult = { ok: true; url: string } | { ok: false; error: string };

export async function openBillingPortal(returnUrl: string): Promise<PortalResult> {
  try {
    const { url } = await api.post<{ url: string }>('/v1/billing/portal', { returnUrl });
    return { ok: true, url };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Could not open the billing portal.' };
  }
}
