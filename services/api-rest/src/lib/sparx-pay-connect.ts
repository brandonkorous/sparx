// Sparx Pay — managed Stripe Connect (docs/92 §B-G2). The "no Stripe account
// required" path: the platform creates an **Express** connected account per tenant
// install and onboards the merchant through Stripe's **hosted** Account Link flow
// (KYC, bank details, ToS) — no custom forms, per the Stripe-hosted-first rule. The
// merchant manages payouts in the Stripe-hosted **Express dashboard** (login links).
//
// We reuse the platform account's Stripe client (getBillingStripe — the same
// WizeWorks platform account that runs module billing also acts as the Connect
// platform). The connected account id lands on the install's `providerAccountId`;
// onboarding state is synced from `charges_enabled` on demand (pull, not a webhook —
// we don't build a push path we don't yet need).

import { getBillingStripe } from '@sparx/billing';
import { prisma, withTenant } from '@sparx/db';

export const SPARX_PAY_SLUG = 'sparx-pay';

export interface ConnectAccountStatus {
  /** The connected account id (`acct_…`), or null before onboarding starts. */
  accountId: string | null;
  /** True once Stripe has approved the account to accept charges. */
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** True once the merchant has finished the hosted onboarding form. */
  detailsSubmitted: boolean;
  /** The install status we derive from the above. */
  installStatus: string;
}

class SparxPayUnconfiguredError extends Error {
  constructor() {
    super('Sparx Pay is unavailable — the platform Stripe key is not configured.');
    this.name = 'SparxPayUnconfiguredError';
  }
}

class SparxPayInstallNotFoundError extends Error {
  constructor(installationId: string) {
    super(`No active Sparx Pay installation ${installationId}`);
    this.name = 'SparxPayInstallNotFoundError';
  }
}

/** Read the (tenant-scoped) Sparx Pay install or throw. */
async function loadInstall(
  tenantId: string,
  installationId: string
): Promise<{ id: string; providerAccountId: string | null }> {
  const install = await withTenant({ tenantId }, (tx) =>
    tx.providerInstallation.findFirst({
      where: {
        id: installationId,
        providerSlug: SPARX_PAY_SLUG,
        uninstalledAt: null,
      },
      select: { id: true, providerAccountId: true },
    })
  );
  if (!install) throw new SparxPayInstallNotFoundError(installationId);
  return install;
}

/** Get the install's connected account, creating an Express account on first use and
 *  persisting its id to `providerAccountId`. Idempotent — a second call reuses it. */
async function ensureConnectAccount(tenantId: string, installationId: string): Promise<string> {
  const stripe = getBillingStripe();
  if (!stripe) throw new SparxPayUnconfiguredError();

  const install = await loadInstall(tenantId, installationId);
  if (install.providerAccountId) return install.providerAccountId;

  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { sparx_tenant_id: tenantId, sparx_installation_id: installationId },
  });

  await withTenant({ tenantId }, (tx) =>
    tx.providerInstallation.update({
      where: { id: installationId },
      data: { providerAccountId: account.id, status: 'pending_verification' },
    })
  );

  return account.id;
}

/** Start (or resume) hosted onboarding: ensure the account, then mint a single-use
 *  Account Link to Stripe's hosted onboarding. The caller redirects the merchant. */
export async function startOnboarding(args: {
  tenantId: string;
  installationId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string; accountId: string }> {
  const stripe = getBillingStripe();
  if (!stripe) throw new SparxPayUnconfiguredError();

  const accountId = await ensureConnectAccount(args.tenantId, args.installationId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: args.refreshUrl,
    return_url: args.returnUrl,
    type: 'account_onboarding',
  });
  return { url: link.url, accountId };
}

/** Map a connected account's flags to our install status. */
function deriveStatus(chargesEnabled: boolean, detailsSubmitted: boolean): string {
  if (chargesEnabled) return 'active';
  if (detailsSubmitted) return 'pending_verification';
  return 'pending_configuration';
}

/** Live status from Stripe, synced back onto the install (pull model — call it when
 *  the merchant returns from onboarding or opens the integrations page). */
export async function refreshStatus(
  tenantId: string,
  installationId: string
): Promise<ConnectAccountStatus> {
  const stripe = getBillingStripe();
  if (!stripe) throw new SparxPayUnconfiguredError();

  const install = await loadInstall(tenantId, installationId);
  if (!install.providerAccountId) {
    return {
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      installStatus: 'pending_configuration',
    };
  }

  const account = await stripe.accounts.retrieve(install.providerAccountId);
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const detailsSubmitted = account.details_submitted ?? false;
  const installStatus = deriveStatus(chargesEnabled, detailsSubmitted);

  await withTenant({ tenantId }, (tx) =>
    tx.providerInstallation.update({
      where: { id: installationId },
      data: {
        status: installStatus,
        enabled: chargesEnabled,
        lastHealthCheckAt: new Date(),
        lastHealthStatus: installStatus,
      },
    })
  );

  return {
    accountId: install.providerAccountId,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    installStatus,
  };
}

/** A single-use link into the Stripe-hosted Express dashboard (payouts, balance,
 *  payment history). Null when onboarding hasn't created an account yet. */
export async function dashboardLink(
  tenantId: string,
  installationId: string
): Promise<string | null> {
  const stripe = getBillingStripe();
  if (!stripe) throw new SparxPayUnconfiguredError();

  const install = await loadInstall(tenantId, installationId);
  if (!install.providerAccountId) return null;

  const link = await stripe.accounts.createLoginLink(install.providerAccountId);
  return link.url;
}

/** Reconcile a Connect `account.updated` event (the connected account id is the
 *  event's `account`). Best-effort, used by the platform webhook if/when wired —
 *  otherwise `refreshStatus` (pull) keeps the install current. Unscoped lookup of the
 *  install by `providerAccountId`, mirroring the public-webhook pattern. */
export async function reconcileAccountUpdated(account: {
  id: string;
  charges_enabled?: boolean;
  details_submitted?: boolean;
}): Promise<void> {
  const install = await prisma.providerInstallation.findFirst({
    where: { providerAccountId: account.id, providerSlug: SPARX_PAY_SLUG, uninstalledAt: null },
    select: { id: true, tenantId: true },
  });
  if (!install) return;

  const chargesEnabled = account.charges_enabled ?? false;
  const installStatus = deriveStatus(chargesEnabled, account.details_submitted ?? false);

  await withTenant({ tenantId: install.tenantId }, (tx) =>
    tx.providerInstallation.update({
      where: { id: install.id },
      data: { status: installStatus, enabled: chargesEnabled, lastHealthCheckAt: new Date() },
    })
  );
}
