// What day it is for the BUSINESS, rather than for the server.
//
// Everything in AR that asks "how late is this" needs an answer on the owner's
// calendar, not on UTC's. A shop in Denver is still on Tuesday for seven hours
// after the server has turned over to Wednesday, and in those seven hours a
// UTC-based count tells her every unpaid invoice is a day later than it is.
// That is not a rounding detail: it is the aging bucket a balance sits in, the
// number printed on the chase list, and the day a customer gets an email.
//
// The zone lives on `tenant_businesses.timezone` and most businesses have not
// set one. A business with no zone keeps UTC, exactly as before — this widens
// the rule, it does not change it out from under anybody.

import type { Prisma } from '@wizeworks/db';

/** Just enough of a transaction client to read the business row. */
interface BusinessReader {
  tenantBusiness: {
    findUnique: (args: {
      where: { tenantId: string };
      select: { timezone: true };
    }) => Promise<{ timezone: string | null } | null>;
  };
}

/**
 * The IANA zone this business runs its books in, or null when it has not said.
 *
 * Null rather than a guessed default: "we do not know where this shop is" and
 * "this shop is in UTC" are different facts, and only the caller knows whether
 * falling back to UTC is safe for what it is about to do.
 */
export async function businessTimeZone(
  tx: BusinessReader | Prisma.TransactionClient,
  tenantId: string
): Promise<string | null> {
  const reader = tx as BusinessReader;
  const business = await reader.tenantBusiness.findUnique({
    where: { tenantId },
    select: { timezone: true },
  });
  // A blank column is "not set", not "the empty zone" — trim first so a row
  // holding spaces cannot be mistaken for an answer.
  const zone = business?.timezone?.trim() ?? '';
  return zone.length > 0 ? zone : null;
}
