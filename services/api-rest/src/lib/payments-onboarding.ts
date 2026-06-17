// Payments configuration + sparx Pay onboarding (docs/94 ADR §5, §9, §13). Powers the
// dashboard's Settings → Payments surface and the onboarding redirect.
//
// sparx Pay is Stripe Connect EXPRESS: the platform mints a connected account, Stripe
// HOSTS the onboarding (KYC, bank, ToS) behind an Account Link, and the merchant
// manages payouts in the Stripe-hosted Express dashboard. No onboarding or account UI
// is built here — Stripe-hosted-first.
//
// The connected account id is a non-secret identifier; it lives on the tenant ROOT row
// (tenant.stripeAccountId, like stripeCustomerId) so the public payment webhook can
// resolve a tenant from an account id with no tenant context. tenant_payment_configs
// records the gateway SELECTION + onboarding status (it is FORCE-RLS — only ever read
// or written with a tenant context).

import { getPlatformStripe } from '@sparx/payments';
import { prisma, withTenant } from '@sparx/db';

export const PAYMENT_GATEWAYS = ['sparx_pay', 'stripe_direct', 'manual'] as const;
export type PaymentGatewayId = (typeof PAYMENT_GATEWAYS)[number];

export interface SparxPayStatus {
  /** The connected account id (`acct_…`), or null before onboarding starts. */
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface PaymentConfigState {
  gatewayId: string;
  /** True once the selected gateway can take payments (sparx Pay: charges enabled;
   *  manual: immediately; stripe_direct: once keys are present). */
  isActive: boolean;
  onboardedAt: string | null;
  sparxPay: SparxPayStatus;
}

export class PaymentsUnconfiguredError extends Error {
  constructor() {
    super('sparx Pay is unavailable — the platform Stripe key is not configured.');
    this.name = 'PaymentsUnconfiguredError';
  }
}

/** The tenant's connected account id from the root row (RLS-safe). */
async function tenantAccountId(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeAccountId: true },
  });
  return tenant?.stripeAccountId ?? null;
}

/** Ensure a config row exists (default sparx Pay, not yet active). */
async function ensureConfig(
  tenantId: string
): Promise<{ gatewayId: string; isActive: boolean; onboardedAt: Date | null }> {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.tenantPaymentConfig.findUnique({
      where: { tenantId },
      select: { gatewayId: true, isActive: true, onboardedAt: true },
    });
    if (existing) return existing;
    return tx.tenantPaymentConfig.create({
      data: { tenantId, gatewayId: 'sparx_pay', isActive: false },
      select: { gatewayId: true, isActive: true, onboardedAt: true },
    });
  });
}

/** Live account status from Stripe (null when the platform key or account is unset). */
async function fetchAccountStatus(
  accountId: string
): Promise<Omit<SparxPayStatus, 'accountId'> | null> {
  const stripe = getPlatformStripe();
  if (!stripe) return null;
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/** The full payment configuration + (for sparx Pay) live onboarding status. */
export async function getPaymentConfig(tenantId: string): Promise<PaymentConfigState> {
  const config = await ensureConfig(tenantId);
  const accountId = await tenantAccountId(tenantId);

  let sparxPay: SparxPayStatus = {
    accountId,
    chargesEnabled: config.gatewayId === 'sparx_pay' ? config.isActive : false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  };
  if (config.gatewayId === 'sparx_pay' && accountId) {
    const live = await fetchAccountStatus(accountId);
    if (live) sparxPay = { accountId, ...live };
  }

  return {
    gatewayId: config.gatewayId,
    isActive: config.isActive,
    onboardedAt: config.onboardedAt?.toISOString() ?? null,
    sparxPay,
  };
}

/** Choose the active gateway. sparx Pay / Stripe Direct stay inactive until they can
 *  actually charge (onboarding / keys); manual has no gateway, so it activates at once
 *  (the merchant marks invoices/orders paid by hand — no PaymentIntent, no fee). */
export async function selectGateway(
  tenantId: string,
  gatewayId: PaymentGatewayId
): Promise<PaymentConfigState> {
  await ensureConfig(tenantId);
  const manual = gatewayId === 'manual';
  await withTenant({ tenantId }, (tx) =>
    tx.tenantPaymentConfig.update({
      where: { tenantId },
      data: {
        gatewayId,
        isActive: manual,
        ...(manual ? { onboardedAt: new Date() } : {}),
      },
    })
  );
  return getPaymentConfig(tenantId);
}

/** Get the connected account, creating an Express account on first use and persisting
 *  its id on the tenant root row. Idempotent — a second call reuses it. */
async function ensureConnectAccount(tenantId: string): Promise<string> {
  const stripe = getPlatformStripe();
  if (!stripe) throw new PaymentsUnconfiguredError();

  const existing = await tenantAccountId(tenantId);
  if (existing) return existing;

  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { sparx_tenant_id: tenantId },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeAccountId: account.id },
  });
  await ensureConfig(tenantId);
  await withTenant({ tenantId }, (tx) =>
    tx.tenantPaymentConfig.update({ where: { tenantId }, data: { gatewayId: 'sparx_pay' } })
  );

  return account.id;
}

/** Start (or resume) hosted onboarding: ensure the account, then mint a single-use
 *  Account Link into Stripe's hosted onboarding. The caller redirects the merchant. */
export async function startSparxPayOnboarding(args: {
  tenantId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string; accountId: string }> {
  const stripe = getPlatformStripe();
  if (!stripe) throw new PaymentsUnconfiguredError();

  const accountId = await ensureConnectAccount(args.tenantId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: args.refreshUrl,
    return_url: args.returnUrl,
    type: 'account_onboarding',
  });
  return { url: link.url, accountId };
}

/** Live status from Stripe, synced onto the config (pull model — called when the
 *  merchant returns from onboarding or opens Settings → Payments). */
export async function refreshSparxPayStatus(tenantId: string): Promise<PaymentConfigState> {
  const accountId = await tenantAccountId(tenantId);
  if (accountId) {
    const live = await fetchAccountStatus(accountId);
    if (live) {
      await ensureConfig(tenantId);
      await withTenant({ tenantId }, (tx) =>
        tx.tenantPaymentConfig.update({
          where: { tenantId },
          data: {
            isActive: live.chargesEnabled,
            ...(live.chargesEnabled ? { onboardedAt: new Date() } : {}),
          },
        })
      );
    }
  }
  return getPaymentConfig(tenantId);
}

/** A single-use link into the Stripe-hosted Express dashboard (payouts, balance,
 *  payment history). Null when onboarding hasn't created an account yet. */
export async function sparxPayDashboardLink(tenantId: string): Promise<string | null> {
  const stripe = getPlatformStripe();
  if (!stripe) throw new PaymentsUnconfiguredError();

  const accountId = await tenantAccountId(tenantId);
  if (!accountId) return null;

  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

/** Reconcile a Connect `account.updated` event: sync charges_enabled → config.isActive.
 *  Resolves the tenant from the account id on the root row (no tenant context needed). */
export async function reconcileSparxPayAccount(account: {
  id: string;
  charges_enabled?: boolean;
}): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { stripeAccountId: account.id },
    select: { id: true },
  });
  if (!tenant) return;

  const chargesEnabled = account.charges_enabled ?? false;
  await ensureConfig(tenant.id);
  await withTenant({ tenantId: tenant.id }, (tx) =>
    tx.tenantPaymentConfig.update({
      where: { tenantId: tenant.id },
      data: {
        isActive: chargesEnabled,
        ...(chargesEnabled ? { onboardedAt: new Date() } : {}),
      },
    })
  );
}
