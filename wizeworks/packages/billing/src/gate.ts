// Billing lifecycle phase — the single source of truth for "where is this tenant
// in the Trial → Grace → Suspend lifecycle" (docs/17 §6).
//
// A PURE function of the tenant's persisted billing columns + the clock: no Stripe
// call, no DB read. That is deliberate — the same function runs on the public-site
// hot path (behind a cached tenant payload) and in the dashboard chrome, and it
// works BEFORE the Stripe ops land.
//
// The trial clock lives on `tenants.trial_ends_at`, stamped at signup
// (@wizeworks/auth provisionTenant) — NOT derived from Stripe. Once billing is live,
// Stripe aligns its own trial to this same timestamp (service.syncModuleItems) and
// the webhook writes status/dates back, so the clock this reads is identical
// whether or not billing is provisioned. That is what lets the 14-day trial be a
// lived, enforced feature ahead of the Stripe provisioning.

/** Grace window (days) after a trial ends — or a paid renewal fails — before the
 *  PUBLIC SITE is suspended (docs/17 §6). The dashboard is NEVER locked; only the
 *  public site ever goes dark, and data is retained throughout. */
export const GRACE_PERIOD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a tenant sits in the lifecycle:
 * - `trialing`  — live 14-day trial, everything on, counting down to the trial end.
 * - `active`    — a paid subscription in good standing (card cleared).
 * - `grace`     — trial ended (or a renewal failed) with no payment: paid module
 *                 features gate in the dashboard, but the public site stays LIVE
 *                 for the 7-day grace window.
 * - `suspended` — past grace with no active subscription: the public site serves
 *                 the "unavailable" overlay. The dashboard stays open to fix billing.
 * - `exempt`    — platform/internal tenant or a bespoke enterprise contract; never
 *                 counted down or suspended.
 */
export type BillingPhase = 'trialing' | 'active' | 'grace' | 'suspended' | 'exempt';

export interface BillingPhaseInput {
  /** Webhook-reconciled Stripe status, or the signup-stamped `'trialing'` before
   *  Stripe is live. Null on a legacy tenant created before this feature. */
  subscriptionStatus: string | null;
  /** The trial clock — stamped at signup, the authoritative trial end. */
  trialEndsAt: Date | null;
  /** End of the current paid period — the grace anchor for a FAILED RENEWAL. */
  currentPeriodEnd: Date | null;
  /** `'enterprise'` tenants run on a bespoke, manually-managed contract and are
   *  never auto-suspended (docs/92 §10) — treated as exempt. */
  planType?: 'standard' | 'enterprise';
  /** The platform's own tenant (`SPARX_PLATFORM_TENANT_ID`) or any reserved/internal
   *  tenant — exempt from trial suspension (docs/17 §6). Resolved by the caller
   *  (only the API tier knows the env id) or via {@link isPlatformTenant}. */
  exempt?: boolean;
}

export interface BillingPhaseView {
  phase: BillingPhase;
  /** Whole days remaining in the current countdown (trial or grace), rounded UP so
   *  "2 days and 4 hours left" reads as 3, clamped at 0. Null for phases that don't
   *  count down (`active` / `exempt` / `suspended`). */
  daysLeft: number | null;
  /** ISO end of the free trial, while trialing (or lapsing through grace). */
  trialEndsAt: string | null;
  /** ISO moment the PUBLIC SITE goes offline (end of grace). Carried through the
   *  trialing → grace path so the UI can escalate "site offline in N days". Null
   *  when `active` / `exempt` or already suspended. */
  suspendsAt: string | null;
}

/** Is this the platform's own tenant (or a reserved/internal one)? Reads the
 *  ops-set `SPARX_PLATFORM_TENANT_ID`; unset → always false (nobody exempt). Keyed
 *  on the immutable tenant id, matching the api-rest reservation check. */
export function isPlatformTenant(tenantId: string | null | undefined): boolean {
  const id = process.env.SPARX_PLATFORM_TENANT_ID?.trim();
  return Boolean(id) && tenantId === id;
}

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** Days from `now` to a future instant, rounded up, clamped at 0. */
function daysUntil(now: Date, future: Date): number {
  return Math.max(0, Math.ceil((future.getTime() - now.getTime()) / DAY_MS));
}

/** The moment paid access lapsed — where the 7-day grace window starts:
 *  a failed renewal anchors on the period end; a lapsed trial (paused, or the
 *  trial simply elapsed) anchors on the trial end. */
function graceAnchor(
  status: string | null,
  trialEndsAt: Date | null,
  currentPeriodEnd: Date | null
): Date | null {
  if (status === 'past_due' || status === 'unpaid') return currentPeriodEnd ?? trialEndsAt;
  return trialEndsAt;
}

/**
 * Resolve a tenant's lifecycle phase from its billing columns and the clock.
 * Pure and deterministic — pass `now` in tests. See {@link BillingPhase}.
 */
export function resolveBillingPhase(
  input: BillingPhaseInput,
  now: Date = new Date()
): BillingPhaseView {
  const { subscriptionStatus: status, trialEndsAt } = input;

  // Exempt: platform/internal tenant or a bespoke enterprise contract. Never
  // counts down, never suspends.
  if (input.exempt || input.planType === 'enterprise') {
    return { phase: 'exempt', daysLeft: null, trialEndsAt: iso(trialEndsAt), suspendsAt: null };
  }

  // A paid subscription in good standing — the card cleared; nothing to nudge.
  if (status === 'active') {
    return { phase: 'active', daysLeft: null, trialEndsAt: null, suspendsAt: null };
  }

  // A live trial: `'trialing'` (or the not-yet-Stripe null status) with a FUTURE
  // end date. Everything is on; count down to the trial end.
  if (trialEndsAt && trialEndsAt.getTime() > now.getTime() && (status === 'trialing' || !status)) {
    return {
      phase: 'trialing',
      daysLeft: daysUntil(now, trialEndsAt),
      trialEndsAt: iso(trialEndsAt),
      suspendsAt: iso(new Date(trialEndsAt.getTime() + GRACE_PERIOD_DAYS * DAY_MS)),
    };
  }

  // An explicit end-state — voluntary cancel (portal `at_period_end` ran its
  // course) or an expired incomplete: the paid period already ran out, so suspend
  // straight away rather than granting a second grace window.
  if (status === 'canceled' || status === 'incomplete_expired') {
    return { phase: 'suspended', daysLeft: null, trialEndsAt: null, suspendsAt: null };
  }

  // Otherwise: no active subscription and no live trial. Work out whether the
  // tenant is inside the 7-day grace window or past it.
  const anchor = graceAnchor(status, trialEndsAt, input.currentPeriodEnd);

  // No clock to suspend against — a legacy tenant created before this feature
  // (null status, null trial). NEVER suspend on missing data: treat as good-standing.
  if (!anchor) {
    return { phase: 'active', daysLeft: null, trialEndsAt: null, suspendsAt: null };
  }

  const suspendsAt = new Date(anchor.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
  if (now.getTime() < suspendsAt.getTime()) {
    return {
      phase: 'grace',
      daysLeft: daysUntil(now, suspendsAt),
      trialEndsAt: iso(trialEndsAt),
      suspendsAt: iso(suspendsAt),
    };
  }
  return { phase: 'suspended', daysLeft: null, trialEndsAt: null, suspendsAt: null };
}
