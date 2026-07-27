// Session attribution (docs/128) — join a placed order to the web traffic that
// produced it, using ONLY the tracking capability the platform already has.
//
// At order time we recompute the buyer's salted, daily-rotating visitor hash from
// the checkout request's IP + UA — the SAME `deriveVisitor` the analytics beacon
// uses at ingestion, so the two definitions can never drift (docs/128 §8) — look
// up that visitor's EARLIEST pageview today, and copy the DERIVED source / host /
// landing-path onto the order. The hash is a lookup key, never a stored column
// (docs/128 §2, §4): storing it would freeze an identity designed to expire at
// UTC midnight, which is the property that keeps sparx sites consent-free.
//
// Runs POST-COMMIT off the checkout-complete handler and MUST NOT affect the
// order (docs/128 §6.2): the order is already placed, so every failure here is
// swallowed and the worst case is an order left `attribution_resolved_at IS NULL`
// ("never looked") — never a lost or blocked sale.
//
// Salt parity: this resolver and the beacon both run inside api-rest, so they
// share one `SITE_ANALYTICS_SALT`. If attribution is ever moved to a separate
// worker, that worker MUST carry the identical salt or every hash silently misses.

import { withTenant } from '@sparx/db';

import { deriveVisitor } from './site-analytics.js';

export interface ResolveOrderAttributionInput {
  tenantId: string;
  orderId: string;
  /** Client IP as api-rest resolved it (trustProxy) — the same input the beacon hashed. */
  ip: string;
  /** Client user-agent — forwarded through the /api/sparx proxy so it matches the beacon. */
  userAgent: string;
  /** Order-placement time; also the UTC day the visitor hash rotates on. */
  now: Date;
}

/** UTC midnight of `now`. The visitor hash already encodes the day, so any row
 *  carrying it is same-day by construction — but bounding the scan by the day lets
 *  the (tenant_id, created_at, visitor_hash) index serve the lookup. */
function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Derive an order's marketing attribution from the buyer's visitor-day traffic and
 * persist it. Idempotent and non-throwing — safe to call once, post-commit, from
 * the checkout-complete handler.
 */
export async function resolveOrderAttribution(input: ResolveOrderAttributionInput): Promise<void> {
  const { tenantId, orderId, ip, userAgent, now } = input;
  try {
    // A bot / no-UA hit is dropped at ingestion, so its hash can never match a
    // stored pageview — we still stamp resolvedAt below so the order isn't
    // re-scanned and reports count it honestly as unattributed.
    const { visitorHash } = deriveVisitor(tenantId, ip, userAgent, now);

    await withTenant({ tenantId }, async (tx) => {
      // First touch within the day = the event that ACQUIRED this visitor
      // (docs/128 §3). Last-touch inside a day mostly credits the tenant's own
      // site for a visitor it already had.
      const firstTouch = await tx.siteAnalyticsEvent.findFirst({
        where: {
          visitorHash,
          type: 'pageview',
          createdAt: { gte: startOfUtcDay(now) },
        },
        orderBy: { createdAt: 'asc' },
        select: { source: true, campaign: true, referrerHost: true, path: true },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          // Found → the derived acquisition. Not found → resolvedAt only, which
          // records an honest "we looked and there was no same-day web traffic"
          // (staff / B2B / POS / phone / renewal, or a visit on another day —
          // docs/128 §5), distinct from "never looked" (resolvedAt IS NULL).
          attributionSource: firstTouch?.source ?? null,
          // The email campaign carries across the same visit→order bridge (docs/impl
          // transactional-email Slice 10), so "Revenue by traffic source" can drill
          // Email → per-campaign. Only ever set on an `email`-source first touch.
          attributionCampaign: firstTouch?.campaign ?? null,
          attributionReferrerHost: firstTouch?.referrerHost ?? null,
          attributionLandingPath: firstTouch?.path ?? null,
          attributionResolvedAt: now,
        },
      });
    });
  } catch {
    // The order is already placed; attribution is best-effort. Leaving
    // attribution_resolved_at NULL is the correct "never looked" signal and lets a
    // future run (bounded by raw-event retention, docs/128 §6.3) try again.
  }
}
