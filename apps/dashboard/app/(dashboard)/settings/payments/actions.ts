'use server';

// Server actions for the payments settings page (docs/94 ADR §13). Reads the active
// gateway + onboarding status and launches Stripe's hosted Connect flows. All the
// actual account management (KYC, bank, payouts) happens on Stripe-hosted pages —
// there's no custom onboarding surface here.

import 'server-only';
import { api, type ApiRestError } from '@/lib/api-rest-client';

export type PaymentGatewayId = 'sparx_pay' | 'stripe_direct' | 'manual';

export interface SparxPayStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface PaymentConfigState {
  gatewayId: string;
  isActive: boolean;
  onboardedAt: string | null;
  sparxPay: SparxPayStatus;
}

export type RedirectResult = { ok: true; url: string } | { ok: false; error: string };

export async function getPaymentConfig(): Promise<PaymentConfigState> {
  return api.get<PaymentConfigState>('/v1/commerce/payments/config');
}

export async function selectGateway(gatewayId: PaymentGatewayId): Promise<PaymentConfigState> {
  return api.post<PaymentConfigState>('/v1/commerce/payments/gateway', { gatewayId });
}

export async function refreshSparxPayStatus(): Promise<PaymentConfigState> {
  return api.get<PaymentConfigState>('/v1/commerce/payments/sparx-pay/status');
}

export async function startSparxPayOnboarding(
  returnUrl: string,
  refreshUrl: string
): Promise<RedirectResult> {
  try {
    const { url } = await api.post<{ url: string }>('/v1/commerce/payments/sparx-pay/onboard', {
      returnUrl,
      refreshUrl,
    });
    return { ok: true, url };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Could not start sparx Pay onboarding.' };
  }
}

export async function openSparxPayDashboard(): Promise<RedirectResult> {
  try {
    const { url } = await api.post<{ url: string | null }>(
      '/v1/commerce/payments/sparx-pay/dashboard-link',
      {}
    );
    if (!url) return { ok: false, error: 'Finish onboarding to open your payouts dashboard.' };
    return { ok: true, url };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Could not open the sparx Pay dashboard.' };
  }
}
