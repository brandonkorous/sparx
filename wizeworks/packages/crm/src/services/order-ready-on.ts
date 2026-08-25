// The day an order can be handed over (issue 026).
//
// Every order carries a placed MOMENT and, when something on it has to be made
// first, a ready DAY. The two are different kinds of thing, and the difference
// is the whole reason this file exists: a moment is the same everywhere, and a
// day belongs to whoever is standing in the shop.
//
// Lives beside the order service rather than inside commerce's product rules,
// because the order spine is shared with every other way an order arrives — a
// till, an import, a marketplace — and none of those have a cart to read. The
// caller says how many days; this says which day that is.

import { localCalendarParts, localWallToUtc } from '@wizeworks/time';
import type { Prisma } from '@wizeworks/db';

/** The zone used when the business has not said where it is. UTC is the only
 *  defensible fallback: it is the one that does not claim to know. */
const FALLBACK_ZONE = 'UTC';

/**
 * `placedAt` plus `days`, as a DATE at the start of that day in the business's
 * own zone. Null when nothing asked for notice — which is not "ready today" and
 * must never be rendered as one.
 *
 * The instant returned is that local midnight, so a `@db.Date` column stores
 * the calendar day a person was actually promised.
 */
export async function resolveReadyOn(
  tx: Prisma.TransactionClient,
  placedAt: Date,
  days: number | null
): Promise<Date | null> {
  if (days === null || days <= 0) return null;
  const business = await tx.tenantBusiness.findFirst({ select: { timezone: true } });
  const zone = business?.timezone ?? FALLBACK_ZONE;

  const here = localCalendarParts(placedAt.getTime(), zone);
  // Calendar arithmetic first, THEN back to an instant — adding 5 × 86,400,000
  // milliseconds lands an hour out across a daylight-saving boundary, and an
  // hour out on a date column is a whole day out.
  const rolled = new Date(Date.UTC(here.year, here.month1 - 1, here.day + days));
  return new Date(
    localWallToUtc(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, rolled.getUTCDate(), 0, zone)
  );
}
