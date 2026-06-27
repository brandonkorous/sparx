'use server';

// Server actions for the payments settings page (docs/94 ADR §13). Reads the active
// gateway + onboarding status and launches Stripe's hosted Connect flows. All the
// actual account management (KYC, bank, payouts) happens on Stripe-hosted pages —
// there's no custom onboarding surface here.

import 'server-only';
import { api, type ApiRestError } from '@/lib/api-rest-client';

export type PaymentGatewayId =
  | 'sparx_pay'
  | 'stripe_direct'
  | 'square'
  | 'authorize_net'
  | 'first_pay'
  | 'custom'
  | 'manual';

// Mirror of the @sparx/payments GATEWAY_CATALOG descriptor (docs/111). The dashboard
// renders cards + credential forms from this; the API is the single source.
export interface CredentialFieldDesc {
  key: string;
  label: string;
  placeholder?: string;
  secret: boolean;
  help?: string;
  optional?: boolean;
}

export interface GatewayDescriptor {
  id: PaymentGatewayId;
  name: string;
  tagline?: string;
  blurb: string;
  recommended?: boolean;
  onboarding: 'sparx_hosted' | 'api_keys' | 'manual';
  checkout: 'inline' | 'redirect' | 'none';
  capabilities: { refunds: boolean; capture: boolean; paymentLinks: boolean; webhooks: boolean };
  credentialFields: CredentialFieldDesc[];
  environments: boolean;
  sparxFee: boolean;
  feeNote: string;
  regions: string[];
  docsUrl?: string;
}

export interface MaskedGatewayCredential {
  gatewayId: string;
  environment: 'sandbox' | 'production';
  status: string;
  publicMeta: Record<string, string>;
  hasSecrets: boolean;
  configuredAt: string;
}

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

export interface SparxPayBalance {
  currency: string;
  availableCents: number;
  pendingCents: number;
  payoutInterval: string | null;
}

export type RedirectResult = { ok: true; url: string } | { ok: false; error: string };

export async function getPaymentConfig(): Promise<PaymentConfigState> {
  return api.get<PaymentConfigState>('/v1/commerce/payments/config');
}

/** sparx Pay connected-account balance (docs/110 GAP A). Degrades to null when not
 *  onboarded / the platform key is unset, so callers render a calm empty state. */
export async function getSparxPayBalance(): Promise<SparxPayBalance | null> {
  return api
    .get<SparxPayBalance | null>('/v1/commerce/payments/sparx-pay/balance')
    .catch(() => null);
}

export async function selectGateway(gatewayId: PaymentGatewayId): Promise<PaymentConfigState> {
  return api.post<PaymentConfigState>('/v1/commerce/payments/gateway', { gatewayId });
}

export async function getGatewayCatalog(): Promise<GatewayDescriptor[]> {
  return api.get<GatewayDescriptor[]>('/v1/commerce/payments/catalog').catch(() => []);
}

export async function getGatewayCredentials(): Promise<MaskedGatewayCredential[]> {
  return api.get<MaskedGatewayCredential[]>('/v1/commerce/payments/credentials').catch(() => []);
}

export type SaveCredentialsResult =
  | { ok: true; credential: MaskedGatewayCredential }
  | { ok: false; error: string };

export async function saveGatewayCredentials(input: {
  gatewayId: PaymentGatewayId;
  environment: 'sandbox' | 'production';
  fields: Record<string, string>;
}): Promise<SaveCredentialsResult> {
  try {
    const credential = await api.put<MaskedGatewayCredential>(
      '/v1/commerce/payments/credentials',
      input
    );
    return { ok: true, credential };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Could not save the gateway credentials.' };
  }
}

export async function deleteGatewayCredentials(gatewayId: PaymentGatewayId): Promise<void> {
  await api.delete(`/v1/commerce/payments/credentials/${gatewayId}`);
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
