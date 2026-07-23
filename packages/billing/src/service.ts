// Billing service — provision + reconcile a tenant's platform subscription.
//
// One Stripe subscription per tenant, one item per active billable module. Every
// operation is GUARDED: if the platform Stripe key is unset it returns a no-op
// result, so the module-toggle path works unchanged in dev/test and ships before
// the prod ops (products, price IDs, webhook) land. Stripe failures are surfaced
// to the caller (which swallows them) — the module flag is already written, and
// the webhook is the authoritative reconciler, so billing is best-effort here.

import type Stripe from 'stripe';

import { prisma, withTenant, type Prisma } from '@sparx/db';
import {
  BUNDLED_FREE,
  deriveModuleStates,
  invalidateModuleCache,
  type ModuleSlug,
} from '@sparx/modules';

import { getBillingStripe, isBillingConfigured } from './client';
import { isPlatformTenant, resolveBillingPhase, type BillingPhaseView } from './gate';
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

// Stripe requires an absolute `trial_end` to be at least 48h in the future on
// subscription create; keep a safety margin above that.
const MIN_TRIAL_END_MS = 49 * 60 * 60 * 1000;

/** Stripe trial params that honour the SIGNUP-stamped trial clock. When a valid
 *  future `trialEndsAt` exists, pin Stripe to that exact instant (`trial_end`) so
 *  the trial is never re-extended by picking modules later. Otherwise fall back to
 *  a fresh `trial_period_days` window (a tenant subscribing well after signup, or a
 *  missing stamp). */
function trialParams(
  trialEndsAt: Date | null
): { trial_end: number } | { trial_period_days: number } {
  if (trialEndsAt && trialEndsAt.getTime() - Date.now() >= MIN_TRIAL_END_MS) {
    return { trial_end: Math.floor(trialEndsAt.getTime() / 1000) };
  }
  return { trial_period_days: TRIAL_PERIOD_DAYS };
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
      trialEndsAt: true,
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
    const items: Stripe.SubscriptionCreateParams.Item[] = desired.map((d) => ({
      price: d.priceId,
    }));
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items,
      // ONE trial clock. The trial starts at SIGNUP (@sparx/auth stamps
      // tenants.trial_ends_at), so align Stripe to that instant rather than
      // starting a fresh 14 days here — otherwise picking modules mid-onboarding
      // would silently extend the trial by however long signup→module-select took.
      // Stripe requires an absolute `trial_end` ≥ ~48h out; fall back to a fresh
      // 14-day window only if the stamp is missing or too close to expiry.
      ...trialParams(tenant.trialEndsAt),
      // Day 14, no card → PAUSE (docs/17 §6): paid module features gate in the
      // dashboard, but the public site rides out its 7-day grace window before
      // suspending. NOT 'cancel' — cancelling would tear down the items + module
      // flags immediately and skip grace entirely.
      trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
      collection_method: 'charge_automatically',
      metadata: { sparx_tenant_id: input.tenantId },
    });
    await persistSubscription(input.tenantId, sub);
    return { applied: true, stripeCustomerId: customerId, stripeSubscriptionId: sub.id };
  }

  // 3) Reconcile items against an existing subscription.

  // 3a) No billable modules left — cancel the subscription rather than try to delete
  //     its last item (Stripe forbids removing the only item on a subscription). The
  //     tenant keeps its Stripe customer + history; re-enabling a module later creates
  //     a fresh subscription through the create path above.
  if (desired.length === 0) {
    await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);
    await withTenant({ tenantId: input.tenantId }, (tx) =>
      tx.billingSubscriptionItem.deleteMany({ where: { tenantId: input.tenantId } })
    );
    await prisma.tenant.update({
      where: { id: input.tenantId },
      data: { stripeSubscriptionId: null },
    });
    return { applied: true, stripeCustomerId: customerId };
  }

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
  /** 'enterprise' for manually-provisioned tenants (Gillett Diesel, docs/92 §C5):
   *  custom-priced subscription, managed hosting, changes via support — the UI
   *  hides self-serve plan editing. Flagged in `settings.billing.planType`; the
   *  per-module breakdown above is informational only for these tenants. */
  planType: 'standard' | 'enterprise';
  /** Where the tenant sits in the Trial → Grace → Suspend lifecycle (docs/17 §6) —
   *  the banner ladder + site overlay read this. Computed from the same columns,
   *  so it never needs Stripe. */
  billing: BillingPhaseView;
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

  const billingSettings = (tenant?.settings as { billing?: { planType?: string } } | null)?.billing;
  const planType: 'standard' | 'enterprise' =
    billingSettings?.planType === 'enterprise' ? 'enterprise' : 'standard';

  const billing = resolveBillingPhase({
    subscriptionStatus: tenant?.subscriptionStatus ?? null,
    trialEndsAt: tenant?.trialEndsAt ?? null,
    currentPeriodEnd: tenant?.currentPeriodEnd ?? null,
    planType,
    exempt: isPlatformTenant(tenantId),
  });

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
    planType,
    billing,
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
    // A bundled-free capability (invoicing while Commerce/B2B is on) intentionally
    // carries NO Stripe item — its missing item must NOT clear the tenant's flag,
    // or a standalone purchase would be erased the moment a provider is enabled.
    // Leave it untouched; it re-bills off its own flag once the provider is gone.
    const bundledNow = (BUNDLED_FREE[m] ?? []).some((p) => {
      const providerSlot = modules[p] as Record<string, unknown> | undefined;
      return providerSlot?.enabled === true;
    });
    if (bundledNow) continue;
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
      data: { settings: { ...settings, modules } as Prisma.InputJsonValue },
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

// The platform transaction fee is no longer a metered subscription line. The only
// platform-collected payment fee is sparx Pay's flat 0.5%, taken at charge time via
// Stripe `application_fee_amount` and recorded on payment_intents.platform_fee — see
// @sparx/payments (docs/94 ADR §8). Everything else is $0 (modules, not tiers).
