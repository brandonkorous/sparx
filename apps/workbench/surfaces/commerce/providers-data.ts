'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE PAYMENT PROVIDERS DATA LAYER
//
// A payment provider is the service that actually takes a customer's money and
// passes it to you. sparx supports several, described in a data-driven catalog
// the server owns (@sparx/payments GATEWAY_CATALOG). A shop:
//
//   • picks ONE active gateway (which one checkout uses);
//   • for "bring your own" gateways, saves their API keys, encrypted at rest —
//     the surface only ever sees whether keys are on file, never the keys;
//   • for sparx Pay, runs a Stripe-hosted onboarding and comes back connected.
//
// This is a REAL surface backed by /v1/commerce/payments/*. Nothing here is
// faked: selecting a gateway, saving keys, and launching onboarding all hit
// live endpoints. The one thing this surface cannot do is complete the hosted
// onboarding itself — that is Stripe's page — so it hands off to it honestly.
//
// ── Key contract ───────────────────────────────────────────────────────────
//   ['commerce','payments']                root every read nests under
//   ['commerce','payments','config']       active gateway + onboarding status
//   ['commerce','payments','catalog']      the gateway catalog (static per build)
//   ['commerce','payments','credentials']  the tenant's saved (masked) keys
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes (mirror api-rest payments lib) ──────────────────────────────── */

export type GatewayOnboarding = 'sparx_hosted' | 'api_keys' | 'manual';
export type GatewayCheckout = 'inline' | 'redirect' | 'none';

export interface CredentialField {
  key: string;
  label: string;
  placeholder?: string;
  secret: boolean;
  help?: string;
  optional?: boolean;
}

export interface GatewayDescriptor {
  id: string;
  name: string;
  tagline?: string;
  blurb: string;
  recommended?: boolean;
  onboarding: GatewayOnboarding;
  checkout: GatewayCheckout;
  capabilities: { refunds: boolean; capture: boolean; paymentLinks: boolean; webhooks: boolean };
  credentialFields: CredentialField[];
  environments: boolean;
  sparxFee: boolean;
  feeNote: string;
  regions: string[];
  docsUrl?: string;
}

export interface SparxPayStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface PaymentConfig {
  gatewayId: string;
  isActive: boolean;
  onboardedAt: string | null;
  sparxPay: SparxPayStatus;
}

export interface MaskedGatewayCredential {
  gatewayId: string;
  environment: 'sandbox' | 'production';
  status: string;
  publicMeta: Record<string, string>;
  hasSecrets: boolean;
  configuredAt: string;
}

export const paymentsKeys = {
  root: ['commerce', 'payments'] as const,
  config: ['commerce', 'payments', 'config'] as const,
  catalog: ['commerce', 'payments', 'catalog'] as const,
  credentials: ['commerce', 'payments', 'credentials'] as const,
};

/* ── Queries ────────────────────────────────────────────────────────────── */

export function usePaymentConfig() {
  return useQuery({
    queryKey: paymentsKeys.config,
    queryFn: () => api.get<PaymentConfig>('/v1/commerce/payments/config'),
  });
}

export function useGatewayCatalog() {
  return useQuery({
    queryKey: paymentsKeys.catalog,
    queryFn: () => api.get<GatewayDescriptor[]>('/v1/commerce/payments/catalog'),
    staleTime: 600_000,
  });
}

export function useGatewayCredentials() {
  return useQuery({
    queryKey: paymentsKeys.credentials,
    queryFn: () => api.get<MaskedGatewayCredential[]>('/v1/commerce/payments/credentials'),
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

function useInvalidatePayments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: paymentsKeys.root });
}

export function useSelectGateway() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: (gatewayId: string) =>
      api.post<PaymentConfig>('/v1/commerce/payments/gateway', { gatewayId }),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export interface CaptureCredentialsInput {
  gatewayId: string;
  environment: 'sandbox' | 'production';
  fields: Record<string, string>;
}

export function useCaptureCredentials() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: (input: CaptureCredentialsInput) =>
      api.put<MaskedGatewayCredential>('/v1/commerce/payments/credentials', input),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useDeleteCredentials() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: (gatewayId: string) =>
      api.delete(`/v1/commerce/payments/credentials/${gatewayId}`),
    onSuccess: () => {
      void invalidate();
    },
  });
}

/** Start (or resume) sparx Pay's Stripe-hosted onboarding. Returns the URL the
 *  browser should send the merchant to; the flow completes on Stripe's page and
 *  returns to `returnUrl`. */
export function useStartSparxPayOnboarding() {
  return useMutation({
    mutationFn: (urls: { returnUrl: string; refreshUrl: string }) =>
      api.post<{ url: string; accountId: string }>('/v1/commerce/payments/sparx-pay/onboard', urls),
  });
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function paymentsErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export interface GatewayState {
  /** success = active + ready; info = selected but not yet ready; warning =
   *  keys saved but not the active one; neutral = available, nothing done. */
  tone: 'success' | 'info' | 'warning' | 'neutral';
  label: string;
}

/**
 * How ONE gateway stands, from the config + its saved credentials. This is the
 * single place the surface reads status from, so the list row, the detail
 * heading and the action buttons never disagree.
 */
export function gatewayState(
  gateway: GatewayDescriptor,
  config: PaymentConfig | undefined,
  credential: MaskedGatewayCredential | undefined
): GatewayState {
  const isSelected = config?.gatewayId === gateway.id;

  if (isSelected && config?.isActive) {
    return { tone: 'success', label: 'Active — taking payments' };
  }
  if (isSelected) {
    // Selected as the active gateway, but not able to charge yet.
    if (gateway.onboarding === 'sparx_hosted') {
      return { tone: 'info', label: 'Chosen — finish setup to go live' };
    }
    if (gateway.onboarding === 'api_keys') {
      return { tone: 'info', label: 'Chosen — add your keys to go live' };
    }
    return { tone: 'info', label: 'Chosen' };
  }
  if (credential?.hasSecrets) {
    return { tone: 'warning', label: 'Keys saved — not your active provider' };
  }
  return { tone: 'neutral', label: 'Available' };
}
