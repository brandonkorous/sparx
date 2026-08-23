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

import { getGatewayDescriptor, getPlatformStripe } from '@wizeworks/payments';
import { prisma, withTenant } from '@wizeworks/db';

import { env } from '../env.js';
import { hasActiveCredentials } from './gateway-credentials.js';

// Every catalog gateway is selectable (docs/111). sparx Pay / Stripe Direct keep their
// existing behavior; the bring-your-own gateways activate once their credentials land.
export const PAYMENT_GATEWAYS = [
  'sparx_pay',
  'stripe_direct',
  'square',
  'authorize_net',
  'first_pay',
  'custom',
  'manual',
] as const;
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
  /** gatewayId → the URL the MERCHANT must register in their own processor dashboard.
   *  Only bring-your-own gateways have one: sparx Pay's webhook is sparx's own platform
   *  endpoint, but a `stripe_direct` merchant owns the Stripe account, so Stripe has no
   *  way to tell us which tenant an event belongs to — the tenant rides in the path.
   *  Without this surfaced, a merchant pastes their keys, checkout charges the card,
   *  and the order never flips to paid because nothing ever told them to add a webhook. */
  webhookUrls: Record<string, string>;
}

/** sparx Pay balance on the connected account (docs/110 GAP A). The money that has
 *  settled to the merchant's Connect account but not yet hit their bank (pending),
 *  plus what is ready to pay out (available). Currency + cents to match the rest of
 *  the money UI. `payoutInterval` is the account's payout cadence (daily/weekly/…). */
export interface SparxPayBalance {
  currency: string;
  availableCents: number;
  pendingCents: number;
  /** 'manual' | 'daily' | 'weekly' | 'monthly', or null if not set. */
  payoutInterval: string | null;
}

export class PaymentsUnconfiguredError extends Error {
  constructor() {
    super('Card payments are unavailable — the platform Stripe key is not configured.');
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

/** The merchant-registered webhook URLs, per gateway. Empty when the public API origin
 *  isn't configured — better to show nothing than a wrong URL a merchant would paste
 *  into Stripe and then wait forever for events that never arrive. */
function webhookUrlsFor(tenantId: string): Record<string, string> {
  const base = env.SPARX_PUBLIC_API_REST_URL?.trim().replace(/\/+$/, '');
  if (!base) return {};
  return {
    stripe_direct: `${base}/v1/public/webhooks/stripe-direct/${tenantId}`,
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
  // For sparx Pay, the DISPLAYED "collecting" state tracks Stripe's LIVE
  // charges_enabled, not just the stored flag — so Settings never mis-reads a
  // charge-ready account as "Not collecting" in the window before the
  // account.updated webhook / an explicit refresh has synced `isActive`. (The
  // stored flag is still what the webhook syncs and the sync-writes update.)
  //
  // Fetch the live status whenever a connected account EXISTS, not only when
  // sparx Pay is the active gateway. Otherwise, after a merchant switches to
  // another provider, sparx Pay reports its default (charges/details = false) —
  // a healthy, onboarded account then looks "unfinished", so the Payment
  // providers pane offers "Continue setup" instead of "Make this my active
  // provider" and the merchant can never switch back (BUG-013).
  let isActive = config.isActive;
  if (accountId) {
    const live = await fetchAccountStatus(accountId);
    if (live) {
      sparxPay = { accountId, ...live };
      // `isActive` reflects the ACTIVE gateway's collecting state, so only let
      // sparx Pay's charge-readiness drive it when sparx Pay is actually active.
      if (config.gatewayId === 'sparx_pay') isActive = live.chargesEnabled;
    }
  }

  return {
    gatewayId: config.gatewayId,
    isActive,
    onboardedAt: config.onboardedAt?.toISOString() ?? null,
    sparxPay,
    webhookUrls: webhookUrlsFor(tenantId),
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
  const desc = getGatewayDescriptor(gatewayId);

  // Activation by onboarding style: manual is on at once; an api-key gateway is on once
  // its credentials are captured; sparx Pay (sparx_hosted) stays off until Connect
  // onboarding flips charges-enabled (refreshSparxPayStatus).
  let isActive = false;
  if (desc?.onboarding === 'manual') isActive = true;
  else if (desc?.onboarding === 'api_keys')
    isActive = await hasActiveCredentials(tenantId, gatewayId);

  await withTenant({ tenantId }, (tx) =>
    tx.tenantPaymentConfig.update({
      where: { tenantId },
      data: {
        gatewayId,
        isActive,
        ...(isActive ? { onboardedAt: new Date() } : {}),
      },
    })
  );
  return getPaymentConfig(tenantId);
}

/** After capturing credentials, flip the config active iff this gateway is the one the
 *  tenant has selected (so configuring a not-yet-selected gateway doesn't switch them). */
export async function activateGatewayIfSelected(
  tenantId: string,
  gatewayId: string
): Promise<void> {
  const config = await ensureConfig(tenantId);
  if (config.gatewayId !== gatewayId) return;
  await withTenant({ tenantId }, (tx) =>
    tx.tenantPaymentConfig.update({
      where: { tenantId },
      data: { isActive: true, onboardedAt: new Date() },
    })
  );
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

/** The connected account's Stripe balance — available + pending in the account's
 *  default currency — plus its payout cadence (docs/110 GAP A). Null on a clean
 *  no-op: no platform key (dev/test) or no connected account yet. Surfaces on the
 *  Finance Overview + Payouts so the merchant sees real money without leaving for
 *  the Stripe-hosted dashboard. */
export async function getSparxPayBalance(tenantId: string): Promise<SparxPayBalance | null> {
  const stripe = getPlatformStripe();
  if (!stripe) return null;

  const accountId = await tenantAccountId(tenantId);
  if (!accountId) return null;

  const [account, balance] = await Promise.all([
    stripe.accounts.retrieve(accountId),
    stripe.balance.retrieve({}, { stripeAccount: accountId }),
  ]);

  const currency = (account.default_currency ?? 'usd').toLowerCase();
  const sumIn = (entries: { amount: number; currency: string }[]): number =>
    entries.filter((e) => e.currency === currency).reduce((n, e) => n + e.amount, 0);

  return {
    currency: currency.toUpperCase(),
    availableCents: sumIn(balance.available),
    pendingCents: sumIn(balance.pending),
    payoutInterval: account.settings?.payouts?.schedule?.interval ?? null,
  };
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
