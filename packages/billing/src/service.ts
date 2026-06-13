// Billing service — provision + reconcile a tenant's platform subscription.
//
// One Stripe subscription per tenant, one item per active billable module. Every
// operation is GUARDED: if the platform Stripe key is unset it returns a no-op
// result, so the module-toggle path works unchanged in dev/test and ships before
// the prod ops (products, price IDs, webhook) land. Stripe failures are surfaced
// to the caller (which swallows them) — the module flag is already written, and
// the webhook is the authoritative reconciler, so billing is best-effort here.

import type Stripe from 'stripe';

import { prisma, withTenant } from '@sparx/db';
import { deriveModuleStates, invalidateModuleCache, type ModuleSlug } from '@sparx/modules';

import { getBillingStripe, isBillingConfigured } from './client';
import {
  MODULE_MONTHLY_CENTS,
  TRIAL_PERIOD_DAYS,
  isBillableModule,
  priceIdFor,
  type BillingInterval,
} from './price-catalog';

export interface SubscriptionSyncInput {
  tenantId: string;
  /** Billing contact — used only when first creating the Stripe customer. */
  email: string;
  name?: string;
  /** The tenant's currently EXPLICITLY-enabled modules (not derived/bundled).
   *  One Stripe item is kept per billable module in this set that has a price id. */
  enabledModules: ModuleSlug[];
}

export interface BillingResult {
  /** False when Stripe is unconfigured — the caller can treat this as a no-op. */
  applied: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

function interval(raw: string | null | undefined): BillingInterval {
  return raw === 'annual' ? 'annual' : 'monthly';
}

function tsToDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null;
}

/** Reverse the price catalog: which module (if any) a Stripe price id bills for.
 *  Used by webhook reconciliation, where Stripe items carry price ids, not modules. */
export function moduleForPriceId(priceId: string): ModuleSlug | null {
  for (const m of Object.keys(MODULE_MONTHLY_CENTS) as ModuleSlug[]) {
    if (priceIdFor(m, 'monthly') === priceId || priceIdFor(m, 'annual') === priceId) return m;
  }
  return null;
}

/** The billable modules from a set that also have a configured price id for the
 *  given interval — the items we can actually put on a Stripe subscription. */
function billablePriced(
  modules: ModuleSlug[],
  iv: BillingInterval
): { module: ModuleSlug; priceId: string }[] {
  const out: { module: ModuleSlug; priceId: string }[] = [];
  for (const m of modules) {
    if (!isBillableModule(m)) continue;
    const priceId = priceIdFor(m, iv);
    if (priceId) out.push({ module: m, priceId });
  }
  return out;
}

/**
 * Bring a tenant's Stripe subscription into line with its enabled modules:
 * lazily create the customer + trialing subscription on first call, then
 * add/remove items so exactly the enabled billable modules are billed. Prorates
 * automatically (Stripe default). No-op when billing is unconfigured.
 */
export async function syncModuleItems(input: SubscriptionSyncInput): Promise<BillingResult> {
  const stripe = getBillingStripe();
  if (!stripe) return { applied: false };

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      billingInterval: true,
    },
  });
  if (!tenant) return { applied: false };

  const iv = interval(tenant.billingInterval);
  const desired = billablePriced(input.enabledModules, iv);

  // 1) Ensure the Stripe customer.
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
      metadata: { sparx_tenant_id: input.tenantId },
    });
    customerId = customer.id;
    await prisma.tenant.update({
      where: { id: input.tenantId },
      data: { stripeCustomerId: customerId },
    });
  }

  // 2) Ensure the subscription. First time: create it (trialing) with the desired
  //    items. Stripe requires ≥1 item — if nothing is priced yet, defer creation
  //    until a priced module is enabled.
  if (!tenant.stripeSubscriptionId) {
    if (desired.length === 0) return { applied: true, stripeCustomerId: customerId };
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: desired.map((d) => ({ price: d.priceId })),
      trial_period_days: TRIAL_PERIOD_DAYS,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      collection_method: 'charge_automatically',
      metadata: { sparx_tenant_id: input.tenantId },
    });
    await persistSubscription(input.tenantId, sub);
    return { applied: true, stripeCustomerId: customerId, stripeSubscriptionId: sub.id };
  }

  // 3) Reconcile items against an existing subscription.
  const existing = await withTenant({ tenantId: input.tenantId }, (tx) =>
    tx.billingSubscriptionItem.findMany({ where: { tenantId: input.tenantId } })
  );
  const existingByModule = new Map(existing.map((e) => [e.moduleKey, e]));
  const desiredKeys = new Set(desired.map((d) => d.module));

  // Add items for newly-enabled modules.
  for (const d of desired) {
    if (existingByModule.has(d.module)) continue;
    const item = await stripe.subscriptionItems.create({
      subscription: tenant.stripeSubscriptionId,
      price: d.priceId,
    });
    await withTenant({ tenantId: input.tenantId }, (tx) =>
      tx.billingSubscriptionItem.create({
        data: {
          tenantId: input.tenantId,
          stripeSubscriptionItemId: item.id,
          moduleKey: d.module,
          stripePriceId: d.priceId,
        },
      })
    );
  }

  // Remove items for modules no longer enabled (credit-prorate the remainder).
  for (const e of existing) {
    if (desiredKeys.has(e.moduleKey as ModuleSlug)) continue;
    await stripe.subscriptionItems.del(e.stripeSubscriptionItemId, {
      proration_behavior: 'create_prorations',
    });
    await withTenant({ tenantId: input.tenantId }, (tx) =>
      tx.billingSubscriptionItem.delete({ where: { id: e.id } })
    );
  }

  return {
    applied: true,
    stripeCustomerId: customerId,
    stripeSubscriptionId: tenant.stripeSubscriptionId,
  };
}

/** Create a Stripe Customer Portal session so the tenant can manage payment +
 *  subscription (docs/67 §5). Returns the URL, or null when unconfigured / no
 *  customer yet. */
export async function createPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<string | null> {
  const stripe = getBillingStripe();
  if (!stripe) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });
  if (!tenant?.stripeCustomerId) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

export interface BillingStateView {
  /** Whether platform Stripe is configured in this environment. */
  configured: boolean;
  /** Whether this tenant has a live subscription (a Stripe customer + sub). */
  billingActive: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: BillingInterval;
  /** The plan derived from the tenant's EXPLICIT billable module flags — what the
   *  tenant will be charged. Always populated (independent of Stripe), so the
   *  settings page is meaningful before the billing ops land. Bundled-free
   *  capabilities (invoicing via Commerce/B2B) are 'bundled', not explicit, so
   *  they never appear here. */
  planModules: { moduleKey: string; monthlyCents: number }[];
  planTotalCents: number;
}

/** A read-only snapshot for the billing settings UI. Never calls Stripe — the
 *  plan comes from our own module flags + list prices, the status from the
 *  webhook-reconciled tenant columns. Dates are ISO strings (JSON-safe). */
export async function getBillingState(tenantId: string): Promise<BillingStateView> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      billingInterval: true,
      settings: true,
    },
  });

  const states = deriveModuleStates(tenant?.settings);
  const planModules = (Object.keys(MODULE_MONTHLY_CENTS) as ModuleSlug[])
    .filter((m) => states[m].source === 'explicit')
    .map((m) => ({ moduleKey: m, monthlyCents: MODULE_MONTHLY_CENTS[m] ?? 0 }));

  return {
    configured: isBillingConfigured(),
    billingActive: Boolean(tenant?.stripeSubscriptionId),
    subscriptionStatus: tenant?.subscriptionStatus ?? null,
    trialEndsAt: tenant?.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: tenant?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: tenant?.cancelAtPeriodEnd ?? false,
    billingInterval: interval(tenant?.billingInterval),
    planModules,
    planTotalCents: planModules.reduce((s, m) => s + m.monthlyCents, 0),
  };
}

/** Persist a Stripe subscription's state onto the tenant row + rebuild its item
 *  rows. Shared by create + webhook reconciliation. */
async function persistSubscription(tenantId: string, sub: Stripe.Subscription): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      trialEndsAt: tsToDate(sub.trial_end),
      currentPeriodEnd: tsToDate(sub.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
  await withTenant({ tenantId }, async (tx) => {
    await tx.billingSubscriptionItem.deleteMany({ where: { tenantId } });
    for (const item of sub.items.data) {
      const module = moduleForPriceId(item.price.id);
      if (!module) continue;
      await tx.billingSubscriptionItem.create({
        data: {
          tenantId,
          stripeSubscriptionItemId: item.id,
          moduleKey: module,
          stripePriceId: item.price.id,
        },
      });
    }
  });
}

/**
 * Webhook reconciliation (docs/67 §6) — Stripe is the source of truth.
 * Resolve the tenant from the subscription's customer, sync its billing columns +
 * item rows, and reconcile each BILLABLE module flag to match its item (so a
 * change made in the Stripe portal propagates to module gating). Non-billable and
 * bundled-derived modules are untouched. Returns the resolved tenant id, or null
 * if the customer maps to no tenant.
 */
export async function reconcileFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, settings: true },
  });
  if (!tenant) return null;

  await persistSubscription(tenant.id, sub);

  // Reconcile billable-module flags to the subscription's items.
  const itemModules = new Set(
    sub.items.data
      .map((i) => moduleForPriceId(i.price.id))
      .filter((m): m is ModuleSlug => m !== null)
  );
  const canceled = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
  const modules = { ...((settings.modules as Record<string, unknown> | undefined) ?? {}) };
  let changed = false;
  for (const m of Object.keys(MODULE_MONTHLY_CENTS) as ModuleSlug[]) {
    const slot = (modules[m] as Record<string, unknown> | undefined) ?? {};
    const shouldEnable = !canceled && itemModules.has(m);
    if ((slot.enabled === true) !== shouldEnable) {
      modules[m] = { ...slot, enabled: shouldEnable };
      changed = true;
    }
  }
  if (changed) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...settings, modules } as object },
    });
    invalidateModuleCache(tenant.id);
  }

  return tenant.id;
}

/** Mark a tenant past-due / active on invoice events (docs/67 §6). No module
 *  changes — gating stays until a cancellation actually lands. */
export async function setSubscriptionStatus(
  stripeCustomerId: string,
  status: string
): Promise<void> {
  await prisma.tenant.updateMany({
    where: { stripeCustomerId },
    data: { subscriptionStatus: status },
  });
}
