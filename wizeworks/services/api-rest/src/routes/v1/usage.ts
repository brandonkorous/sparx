// Capacity — what this tenant is using, and how close that is to what they are
// allowed.
//
//   GET /v1/usage/capacity → every meter, its ceiling, and where it stands
//
// ── WHY IT CARRIES NO PRICE ─────────────────────────────────────────────────
//
// Deliberately. A console renders this to warn somebody they are near a ceiling;
// the priced option for doing something about it comes from the account service,
// which owns plan and payment. Piggles' rule is that the operating console never
// knows a price — a price computed or hardcoded on the console side means billing
// logic has leaked, however thin it looks — and this endpoint is the shape that
// keeps that true: a meter's STATE is a fact about the tenant, and what expanding
// it costs is a commercial answer from somewhere else.
//
// ── WHY IT IS NOT AN ENFORCEMENT SURFACE ────────────────────────────────────
//
// Nothing here permits or refuses anything. Half of what it reports comes from a
// nightly snapshot that can be up to 24 hours old — right for "you are nearly
// out of storage", wrong for "may this upload proceed". A gate has to count at
// the moment it acts, at the action.
//
// ── BIGINT ─────────────────────────────────────────────────────────────────
//
// Byte counts are `bigint` in the domain and are serialised as STRINGS on the
// wire. JSON has no integer type beyond a double, and a tenant with more than 9
// petabytes is not the reason — the reason is that `JSON.stringify` THROWS on a
// bigint, so the alternative to a string is a 500. Callers parse what they need.

import type { FastifyPluginAsync } from 'fastify';
import { capacityReport, type MeterReading } from '@wizeworks/usage';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth } from '@wizeworks/api-core/auth';
import { prisma, withSystem } from '@wizeworks/db';

/** `bigint` → decimal string, `null` → `null`. Null is preserved rather than
 *  coerced to 0: "not measured" is one of the answers this endpoint gives, and a
 *  zero would be read as a measurement. */
function big(value: bigint | null): string | null {
  return value === null ? null : value.toString();
}

function serialise(meter: MeterReading) {
  return {
    meter: meter.meter,
    used: big(meter.used),
    limit: big(meter.limit),
    // Rounded to four places rather than sent raw — a bar is drawn from this and
    // seventeen significant figures of float noise helps nobody. NOT clamped: a
    // tenant at 1.2 reads as 120%, because rounding it to "full" hides how far
    // over they are and therefore how much expansion they need.
    fraction: meter.fraction === null ? null : Math.round(meter.fraction * 10_000) / 10_000,
    state: meter.state,
  };
}

const usageRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/usage/capacity', async (request) => {
    const auth = requireAuth(request);

    // The brand decides the ceilings, and it lives on the non-RLS dispatch row.
    // Read through `withSystem` for the same reason every other brand lookup
    // does: `tenants` carries no tenant policy, and this runs before any is set.
    const tenant = await withSystem(() =>
      prisma.tenant.findUnique({
        where: { id: auth.tenantId },
        select: { platformBrand: true },
      })
    );

    const report = await capacityReport(auth.tenantId, tenant?.platformBrand ?? null);

    if (report.rejected.length > 0) {
      // Somebody's capacity configuration names something this platform does not
      // meter, or a value it cannot read. That is indistinguishable from "this
      // brand sets no limits" to everyone downstream, so it is said out loud
      // here — a misconfigured ceiling silently becomes no ceiling at all.
      request.log.warn(
        { brand: tenant?.platformBrand ?? null, rejected: report.rejected },
        'capacity allowance has unreadable entries — those meters are unlimited'
      );
    }

    return ok({
      meters: report.meters.map(serialise),
      // ISO, or null when this tenant has never been snapshotted. The surface
      // says "not measured yet" rather than drawing empty bars: a tenant
      // provisioned this afternoon has no row, and a bar at zero would tell them
      // they had used nothing when the truth is that nobody has looked.
      measuredAt: report.measuredAt?.toISOString() ?? null,
      allowanceSource: report.allowanceSource,
    });
  });

  return Promise.resolve();
};

export default usageRoutes;
