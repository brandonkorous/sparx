// Internal endpoints invoked by the Finance k8s CronJobs (k8s/cronjobs/).
//
//   POST /internal/finance/recurring-due  → generate expenses now owed
//   POST /internal/finance/profit-rollup  → refresh the daily profit cache
//
// ── WHY THESE EXIST ──────────────────────────────────────────────────────────
// `packages/finance-worker` has handled `finance.recurring.due` and
// `finance.profit.recompute` since the module shipped. **Nothing published
// either one.** Finance was the only module in the platform with no cron file at
// all, and the cost was two whole capabilities that looked finished:
//
//   • A tenant sets up "Rent — $2,000, every month" and no expense is ever
//     created. The Repeating costs surface saves a template that never fires.
//   • `profitForRange` READS `rollup_finance_daily_profit`; only `recomputeDay`
//     writes it. With nothing scheduled, the Profit surface renders a cache
//     nobody fills — zeroes until somebody presses the manual recompute, and
//     stale again the moment anything moves. `spend-data.ts` even says "waiting
//     for tonight's worker is not an answer" about a worker that did not run.
//
// ── WHY THEY PUBLISH RATHER THAN DO THE WORK ─────────────────────────────────
// Both handlers already exist and are tested. Publishing puts the work on the
// broker where it gets retries and a dead-letter queue, and keeps a sweep over
// every tenant off the API pod — `services/CLAUDE.md`: side effects are
// event-driven, not inlined in request handlers.
//
// Tenant enumeration goes through `listTenantsWithModule`, NOT the settings-flag
// query the other schedulers use. Finance is BUNDLED_FREE with commerce/b2b, so
// its flag is unwritten for almost every tenant that has it — see the header of
// `lib/module-tenants.ts`.

import type { FastifyPluginAsync } from 'fastify';

import { utcMidnight } from '@sparx/finance';

import { authorizeCron, forEachTenant } from '../../lib/cron-auth.js';
import { listTenantsWithModule } from '../../lib/module-tenants.js';
import { publishDomainEvent } from '../../lib/staff-events.js';

/**
 * How far back a nightly rollup reaches by default.
 *
 * Two days, not one. Today's figures are still moving — an order paid at 23:50,
 * an expense entered this morning for yesterday — and a rollup that only ever
 * recomputed "today" would leave yesterday frozen at whatever it happened to be
 * when the job last ran. `?days=` widens it for a backfill.
 */
const DEFAULT_ROLLUP_DAYS = 2;

/** Parse `?days=` into a positive integer, or undefined for the default.
 *  Garbage falls through to the default rather than erroring a cron run — a
 *  mistyped query parameter must not be the reason tonight's rollup is skipped. */
function parseDays(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function daysBefore(day: Date, days: number): Date {
  return new Date(day.getTime() - days * 86_400_000);
}

const financeCronRoutes: FastifyPluginAsync = (app) => {
  // ─── Repeating costs ──────────────────────────────────────────────────────

  app.post<{ Querystring: { through?: string } }>(
    '/internal/finance/recurring-due',
    async (request) => {
      authorizeCron(request);

      // `through` is a calendar DAY at UTC midnight, like every other date this
      // module filters on. An override is accepted so a missed night can be
      // caught up to a specific date rather than only to "now".
      const override = request.query.through;
      const through = utcMidnight(override ? new Date(override) : new Date());

      const tenants = await listTenantsWithModule('finance');
      const summary = await forEachTenant(tenants, async (tenantId) => {
        await publishDomainEvent('finance.recurring.due', tenantId, null, {
          through: through.toISOString(),
        });
        return { published: 'finance.recurring.due' };
      });

      request.log.info(
        { through: through.toISOString(), ...summary, outcomes: undefined },
        'finance recurring-due sweep published'
      );
      return { success: true, data: { through: through.toISOString(), ...summary } };
    }
  );

  // ─── Daily profit rollup ──────────────────────────────────────────────────

  app.post<{ Querystring: { days?: string } }>(
    '/internal/finance/profit-rollup',
    async (request) => {
      authorizeCron(request);

      const days = parseDays(request.query.days) ?? DEFAULT_ROLLUP_DAYS;
      const to = utcMidnight(new Date());
      const from = daysBefore(to, days - 1);

      const tenants = await listTenantsWithModule('finance');
      const summary = await forEachTenant(tenants, async (tenantId) => {
        await publishDomainEvent('finance.profit.recompute', tenantId, null, {
          from: from.toISOString(),
          to: to.toISOString(),
        });
        return { published: 'finance.profit.recompute' };
      });

      request.log.info(
        {
          from: from.toISOString(),
          to: to.toISOString(),
          ...summary,
          outcomes: undefined,
        },
        'finance profit-rollup sweep published'
      );
      return {
        success: true,
        data: { from: from.toISOString(), to: to.toISOString(), ...summary },
      };
    }
  );

  return Promise.resolve();
};

export default financeCronRoutes;
