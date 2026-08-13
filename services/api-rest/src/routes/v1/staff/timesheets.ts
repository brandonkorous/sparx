// The costed period grid, and the deriver that pushes it into finance
// (docs/149 §4, §5 Timesheets).
//
//   GET  /v1/staff/timesheets         → the grid for a period
//   GET  /v1/staff/timesheets/export  → the hours file for whoever runs payroll
//   POST /v1/staff/timesheets/derive  → re-file the period's wages into finance
//
// `admin`, both of them: the grid carries what each person's time COST, which is
// their pay rate with one division undone. The uncosted hour count is the one
// number here that a manager without pay access still needs, and it rides on the
// time list (`/v1/staff/time`) rather than being smuggled out of this one.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import {
  buildPayrollExport,
  deriveLaborForPeriod,
  deriveLaborForRoster,
  periodLabel,
  timesheetPeriod,
} from '@sparx/staff';
import { derivePeriodSchema } from '@sparx/staff/schemas';
import { requirePayAccess, requireStaffModule } from '../../../lib/staff-context.js';
import { resolveListScopeIds } from '../../../lib/property.js';

/** A period longer than this is a backfill, not a timesheet. The same 400-day
 *  clamp the worker applies, for the same reason — a year-long span walks the
 *  whole roster day by day and starves whatever else the process is doing. */
const MAX_PERIOD_DAYS = 400;

const PeriodQuery = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    property: z.string().optional(),
  })
  .refine((v) => v.to >= v.from, {
    message: 'The period has to end on or after it starts.',
    path: ['to'],
  })
  .refine((v) => (v.to.getTime() - v.from.getTime()) / 86_400_000 <= MAX_PERIOD_DAYS, {
    message: `A timesheet period cannot be longer than ${MAX_PERIOD_DAYS} days.`,
    path: ['to'],
  });

const DeriveBody = derivePeriodSchema
  .refine((v) => v.to >= v.from, {
    message: 'The period has to end on or after it starts.',
    path: ['to'],
  })
  .refine((v) => (v.to.getTime() - v.from.getTime()) / 86_400_000 <= MAX_PERIOD_DAYS, {
    message: `A derivation cannot cover more than ${MAX_PERIOD_DAYS} days.`,
    path: ['to'],
  });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const staffTimesheetRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/staff/timesheets', async (request) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const query = PeriodQuery.parse(request.query);
    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    const propertyId = propertyIds?.length === 1 ? propertyIds[0] : null;
    const period = await timesheetPeriod(auth.tenantId, {
      from: query.from,
      to: query.to,
      propertyId,
    });
    return ok({
      ...period,
      label: periodLabel(period.from, period.to),
      // Sent explicitly rather than left for the client to infer from
      // `rowsNeedingRates > 0`. It is the difference between "labour cost
      // £4,120 this month" and "£4,120 SO FAR — two people have unpriced
      // hours", and a grid that quietly reports the first is the exact failure
      // this module was built to prevent.
      complete: period.rowsNeedingRates === 0,
    });
  });

  /**
   * The payroll handoff — sparx's whole obligation to whoever actually runs it
   * (docs/149 §1). Approved hours per person for the period, with their payroll
   * id, as a file the bureau can read.
   *
   * Registered BEFORE `/derive` for readability only — Fastify's radix router
   * always prefers a static segment — but the two are kept adjacent because they
   * are the same act seen from two sides: one sends the hours out to be paid,
   * the other files what they cost.
   */
  app.get('/v1/staff/timesheets/export', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const query = PeriodQuery.parse(request.query);
    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    const propertyId = propertyIds?.length === 1 ? propertyIds[0] : null;

    const result = await buildPayrollExport(auth.tenantId, {
      from: query.from,
      to: query.to,
      propertyId,
    });

    return (
      reply
        .header('content-type', result.contentType)
        .header('content-disposition', `attachment; filename="${result.filename}"`)
        // A download cannot carry a warning, so the one fact that would change
        // how someone reads the file rides on a header: hours that were worked
        // and could not be costed. They are IN the hours column — they must be
        // paid — and absent from the cost column, which is the discrepancy
        // somebody will otherwise spend an afternoon hunting.
        .header('x-sparx-unpriced-minutes', String(result.unpricedMinutes))
        .send(result.body)
    );
  });

  /**
   * Re-derive on demand.
   *
   * Approval already publishes `staff.time.approved` and the worker does this
   * asynchronously — so this route is not the normal path. It exists because the
   * async one can be behind (a broker outage, a rate entered after the fact),
   * and an owner staring at a wages figure they know is wrong needs a way to
   * make it right that does not involve re-approving a timesheet.
   *
   * Safe to press twice: the deriver upserts on
   * `(tenant, 'staff_period', <person>:<period>:<site>)`.
   */
  app.post('/v1/staff/timesheets/derive', async (request) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const body = DeriveBody.parse(request.body);

    const results = body.staffMemberId
      ? [
          await deriveLaborForPeriod(auth.tenantId, {
            staffMemberId: body.staffMemberId,
            periodStart: body.from,
            periodEnd: body.to,
          }),
        ]
      : (
          await deriveLaborForRoster(auth.tenantId, {
            periodStart: body.from,
            periodEnd: body.to,
          })
        ).derived;

    const unpricedMinutes = results.reduce((sum, r) => sum + r.unpricedMinutes, 0);
    return ok({
      people: results.length,
      expenses: results.reduce((sum, r) => sum + r.expenseIds.length, 0),
      totalCents: results.reduce((sum, r) => sum + r.totalCents, 0),
      // Reported, never swallowed: this is the number that explains a wages
      // figure looking low, and nothing else on the response hints at it.
      unpricedMinutes,
      unpricedDays: [...new Set(results.flatMap((r) => r.unpricedDays))].sort(),
    });
  });
};

export default staffTimesheetRoutes;
