// Where the business keeps its books, for figures filed by day.
//
// A sale, a payment or stock leaving is a MOMENT, and its day is the day it was
// in the shop, not in UTC (sparx persona issue 174). The zone lives on
// `tenant_businesses.timezone`. The same read as `businessTimeZone` in
// `@wizeworks/crm`, which this package does not depend on: a blank column is
// "not set", and not set keeps UTC.

import { withTenant, type TxClient } from '@wizeworks/db';
import { businessDateKey, dateOfKey } from '@wizeworks/time';

/** The IANA zone this business runs its books in, or null when it has not said. */
export async function businessZone(tx: TxClient, tenantId: string): Promise<string | null> {
  const business = await tx.tenantBusiness.findUnique({
    where: { tenantId },
    select: { timezone: true },
  });
  const zone = business?.timezone?.trim() ?? '';
  return zone.length > 0 ? zone : null;
}

/**
 * The business's today, as the midnight-UTC date a rollup bucket holds.
 *
 * What a nightly recompute counts back from. The job runs at 06:45 UTC, which is
 * still the evening before in Denver for half the year: counted from UTC's
 * today it recomputed tomorrow (a day that had not started) and today, and
 * never went back for the last hours of yesterday.
 */
export async function businessToday(tenantId: string, now: Date = new Date()): Promise<Date> {
  const zone = await withTenant({ tenantId }, (tx) => businessZone(tx, tenantId));
  return dateOfKey(businessDateKey(now, zone));
}
