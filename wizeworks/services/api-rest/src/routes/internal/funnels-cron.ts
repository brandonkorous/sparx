// Internal endpoints invoked by the Funnels k8s CronJobs (k8s/cronjobs/).
//
//   POST /internal/funnels/rollup?days=          → reconcile rollup_funnel_daily
//   POST /internal/funnels/abandonment-sweep     → publish funnel.abandoned
//
// ── WHY THESE ARE NOT PART OF THE SITE-ANALYTICS ROLLUP ─────────────────────
//
// The funnel rollup reads `site_analytics_events` over the same nightly window
// that `/internal/site/analytics-rollup` does, so folding it in there looks
// obviously right and is wrong: that job enumerates tenants by the `builder`
// JSON flag, and a tenant can run funnels without it. Every funnels-only tenant
// would have been skipped, and the job would have reported success over them —
// the exact failure `lib/module-tenants.ts` exists to stop. These enumerate by
// `listTenantsWithModule('funnels')`, which DERIVES availability instead of
// reading a flag that is only half the truth.
//
// ── WHAT EACH ONE IS FOR ────────────────────────────────────────────────────
//
// The rollup is the chart: how many people reached each rung, per day, with no
// identity of any kind. Idempotent (delete-window-then-insert) and the read
// live-overlays today, so a late or skipped run only delays correcting closed
// days.
//
// The sweep is the one funnel signal nobody triggers: `funnel.abandoned` fires
// because a person STOPPED, and an absence has no request behind it. It is the
// event the recovery follow-up hangs off, so a funnel without it is a report
// somebody has to remember to open.

import type { FastifyPluginAsync } from 'fastify';

import { findAbandoned, reconcileFunnelDaily } from '@wizeworks/funnels';
import { publish } from '@wizeworks/api-core/pubsub';

import { authorizeCron, forEachTenant } from '../../lib/cron-auth.js';
import { listTenantsWithModule } from '../../lib/module-tenants.js';

/** Trailing window recomputed each night. A couple of days covers a late event
 *  without rescanning all history; `?days=` widens it for a backfill. */
const DEFAULT_WINDOW_DAYS = 3;

/**
 * The sweep's window, in hours: its own interval (24h) plus an hour of slack.
 *
 * This is what makes the sweep stateless. It announces only subjects whose
 * patience ran out SINCE THE LAST RUN, so each person is seen on exactly one
 * night with nothing to remember. The cost, stated plainly in `abandon.ts`: a
 * missed run skips those subjects permanently. Widen `?windowHours=` to cover a
 * known outage.
 */
const DEFAULT_SWEEP_WINDOW_HOURS = 25;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function positiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== 'string') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const funnelsCronRoutes: FastifyPluginAsync = (app) => {
  app.post<{ Querystring: { days?: string } }>('/internal/funnels/rollup', async (request) => {
    authorizeCron(request);
    const days = positiveInt(request.query.days, DEFAULT_WINDOW_DAYS);
    const toExclusive = addUtcDays(startOfUtcDay(new Date()), 1);
    const windowStart = addUtcDays(toExclusive, -(days + 1));

    const tenants = await listTenantsWithModule('funnels');
    const outcomes = await forEachTenant(tenants, async (tenantId) => {
      const result = await reconcileFunnelDaily({ tenantId }, windowStart, toExclusive);
      // `skipped` counts funnels whose stored ladder did not parse. Reported
      // rather than swallowed: a funnel silently missing from every report is
      // the failure this module exists to stop.
      return { rows: result.rows, days: result.days, skipped: result.skipped };
    });

    return { success: true, data: { tenants: tenants.length, outcomes } };
  });

  app.post<{ Querystring: { windowHours?: string } }>(
    '/internal/funnels/abandonment-sweep',
    async (request) => {
      authorizeCron(request);
      const windowHours = positiveInt(request.query.windowHours, DEFAULT_SWEEP_WINDOW_HOURS);
      const now = new Date();

      const tenants = await listTenantsWithModule('funnels');
      const outcomes = await forEachTenant(tenants, async (tenantId) => {
        const { funnels, subjects } = await findAbandoned({ tenantId }, now, windowHours);

        let announced = 0;
        for (const subject of subjects) {
          // Published one at a time rather than batched, because each one is a
          // different person and an automation acts on people. A failure on one
          // must not lose the rest, so the loop swallows and counts.
          try {
            await publish(request.log, 'funnel.abandoned', tenantId, null, {
              funnelId: subject.funnelId,
              funnelName: subject.funnelName,
              propertyId: subject.propertyId,
              stageKey: subject.stageKey,
              // The rung they STOPPED on, not a kind of its own: "went quiet
              // after giving us their email" and "went quiet after telling us
              // their budget" want different follow-ups, and flattening both to
              // "abandoned" would throw that away. Never `view` — nobody
              // anonymous is ever recorded.
              stageKind: subject.stageKind,
              customerId: subject.customerId,
              subjectEmail: subject.subjectEmail,
              // Nothing was converted, so nothing was worth anything yet. Null,
              // not zero: this is an unpriced absence, not a measured nothing.
              valueCents: null,
              entrySource: subject.entrySource,
              entryCampaign: subject.entryCampaign,
              lastSeenAt: subject.lastSeenAt.toISOString(),
            });
            announced += 1;
          } catch (err) {
            request.log.warn(
              { err, funnelId: subject.funnelId },
              'funnel abandonment announce failed'
            );
          }
        }

        return { funnels, found: subjects.length, announced };
      });

      return { success: true, data: { tenants: tenants.length, outcomes } };
    }
  );

  return Promise.resolve();
};

export default funnelsCronRoutes;
