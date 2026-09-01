// Session attribution (docs/128) — join a placed order to the web traffic that
// produced it, using ONLY the tracking capability the platform already has.
//
// At order time we recompute the buyer's salted, daily-rotating visitor hash from
// the checkout request's IP + UA — the SAME `deriveVisitor` the analytics beacon
// uses at ingestion, so the two definitions can never drift (docs/128 §8) — look
// up that visitor's EARLIEST pageview in the window, and copy the DERIVED source /
// host / landing-path onto the order. The hash is a lookup key, never a stored
// column (docs/128 §2, §4): storing it would freeze an identity designed to expire
// at UTC midnight, which is the property that keeps sparx sites consent-free.
//
// ── THE WINDOW IS TWO DAYS, NOT ONE ─────────────────────────────────────────
//
// It used to be today only, because the hash rotates at UTC midnight and there is
// deliberately no identifier that survives the night. But nothing was stopping us
// asking for YESTERDAY's hash: the salt is the same, the IP and UA are the same,
// and the day is just a string in the input — so the previous day's hash is
// derivable at order time from the request in hand, used once, and thrown away
// exactly like today's. Nothing new is stored and nothing new outlives the
// rotation, so the consent-free position is unchanged.
//
// What it buys is the normal path for anything people think about before buying:
// read the page last night, buy this morning. That sale used to count for no page
// at all, and page-level revenue therefore under-credited hardest exactly the
// businesses whose pages do the most work. On Juniper Row it was total — 0 of 14
// orders traced.
//
// Two days, and no further. Each extra day is another hash to derive and another
// day of raw events to scan, and the honest ceiling is bounded anyway: a buyer
// whose IP or user-agent changed overnight (a phone that moved cell, a browser
// that updated) does not match yesterday's hash at all. The report already says
// when it could not place a sale rather than printing a zero (issue 359), which
// stays the floor under all of this.
//
// Runs POST-COMMIT off the checkout-complete handler and MUST NOT affect the
// order (docs/128 §6.2): the order is already placed, so every failure here is
// swallowed and the worst case is an order left `attribution_resolved_at IS NULL`
// ("never looked") — never a lost or blocked sale.
//
// Salt parity: this resolver and the beacon both run inside api-rest, so they
// share one `SITE_ANALYTICS_SALT`. If attribution is ever moved to a separate
// worker, that worker MUST carry the identical salt or every hash silently misses.

import { withTenant } from '@wizeworks/db';

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

/** UTC midnight of `now`. Each visitor hash already encodes its own day, so a row
 *  carrying one is in-window by construction — but bounding the scan by date lets
 *  the (tenant_id, created_at, visitor_hash) index serve the lookup. */
function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The same instant one day earlier, for deriving the previous day's hash. */
function dayBefore(now: Date): Date {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
    const yesterday = dayBefore(now);
    // Both hashes, derived from the same request and discarded with it. They
    // differ only in the day string, so a buyer whose IP and UA are unchanged
    // since yesterday is findable across the rotation without anything being
    // stored that survives it.
    const hashes = [
      deriveVisitor(tenantId, ip, userAgent, now).visitorHash,
      deriveVisitor(tenantId, ip, userAgent, yesterday).visitorHash,
    ];

    await withTenant({ tenantId }, async (tx) => {
      // First touch within the window = the event that ACQUIRED this visitor
      // (docs/128 §3). Last-touch mostly credits the tenant's own site for a
      // visitor it already had — so yesterday's pageview, when there is one,
      // rightly outranks this morning's return visit.
      const firstTouch = await tx.siteAnalyticsEvent.findFirst({
        where: {
          visitorHash: { in: hashes },
          type: 'pageview',
          createdAt: { gte: startOfUtcDay(yesterday) },
        },
        orderBy: { createdAt: 'asc' },
        select: { source: true, campaign: true, referrerHost: true, path: true },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          // Found → the derived acquisition. Not found → resolvedAt only, which
          // records an honest "we looked and there was no web traffic from this
          // buyer in the last two days" (staff / B2B / POS / phone / renewal, or
          // a visit longer ago than the window — docs/128 §5), distinct from
          // "never looked" (resolvedAt IS NULL).
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
