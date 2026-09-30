// Filing a customer under a wholesale business, and what that has to MEAN.
//
// THE TWO ROWS. A person belongs to a wholesale business in two places:
//
//   Customer.companyId          the primary-account POINTER (which business
//                               prices them), written by the customer editor
//   B2bAccountContact           an ACTIVE membership row (that they are a real
//                               buyer there), written by the account editor
//
// They are not the same fact and the schema is right to keep both. But only ONE
// of them is read where it matters: `pricingService.resolveActiveB2bAccountId`
// requires the ACTIVE ROW and deliberately refuses to trust the pointer, so
// that deactivating somebody who left a company stops their wholesale prices.
// The cart, the checkout and the storefront product page all resolve through it.
//
// So a customer filed under a business from the customer editor alone got the
// pointer and nothing else, and was charged full retail everywhere — under a
// field whose own words are "The business this person buys on behalf of. They
// get its agreed prices and terms."
//
// MEASURED 2026-09-19, across all 43 tenants on the machine: 10 customers
// carried the pointer, 7 of them with no active membership row. Seven people
// filed as wholesale who were paying retail. Issue 744.
//
// THE INVARIANT this module keeps, in both directions and from both editors:
//
//   Customer.companyId = X   ⟺   an ACTIVE B2bAccountContact on X
//
// Setting the pointer joins them (as a buyer — the field says "buys on behalf
// of", so that is what it grants, and the account's own Who can order list is
// where it becomes visible and changeable). Clearing it, or deactivating the
// membership, takes the other side down with it. A screen that says somebody
// gets agreed prices must not be the only screen that believes it.
// [[feedback_a_fix_leaves_its_neighbour_behind]]

import type { TxClient } from '@wizeworks/db';

/** What the customer editor grants, because its own field says "buys on behalf
 *  of". Anything narrower is chosen on the account, which lists every member. */
const JOINED_FROM_THE_CUSTOMER_EDITOR = 'buyer';

/**
 * The pointer moved. Make the membership agree.
 *
 * `before` is where they were filed, `after` where they are going; either may
 * be null. Runs inside the caller's transaction so a customer can never be
 * saved pointing at a business it is not a member of.
 */
export async function pointerMoved(
  tx: TxClient,
  tenantId: string,
  customerId: string,
  before: string | null,
  after: string | null
): Promise<void> {
  if (before === after) return;

  // Left the old one. Deactivated rather than deleted: the row carries the role
  // they had and the day they joined, and somebody coming back to a supplier
  // should not lose that.
  if (before) {
    await tx.b2bAccountContact.updateMany({
      where: { tenantId, customerId, accountId: before, isActive: true },
      data: { isActive: false },
    });
  }

  if (!after) return;

  const existing = await tx.b2bAccountContact.findFirst({
    where: { tenantId, customerId, accountId: after },
    select: { id: true },
  });
  if (existing) {
    // Back on an account they were on before keeps the role they had.
    await tx.b2bAccountContact.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
    return;
  }
  await tx.b2bAccountContact.create({
    data: { tenantId, accountId: after, customerId, role: JOINED_FROM_THE_CUSTOMER_EDITOR },
  });
}

/**
 * A membership was switched off from the account editor. Clear the pointer if it
 * was aimed here, so the customer's own screen stops naming a business that no
 * longer prices them.
 *
 * Aimed anywhere else, it is left alone: somebody removed as a viewer on a
 * second account keeps the account that actually prices them.
 */
export async function membershipDeactivated(
  tx: TxClient,
  customerId: string,
  accountId: string
): Promise<void> {
  await tx.customer.updateMany({
    where: { id: customerId, companyId: accountId },
    data: { companyId: null },
  });
}

/**
 * A membership was switched back on. Point the customer here again, unless they
 * are already filed under somebody.
 *
 * The other half of `membershipDeactivated`, and it was missing: Remove cleared
 * the pointer and Restore did not put it back, so a restored buyer read as an
 * active member on one screen and as filed under nobody on the other, priced at
 * retail. Exactly the disagreement issue 744 exists to stop, reintroduced by
 * fixing only the direction that was being tested.
 * [[feedback_a_fix_leaves_its_neighbour_behind]]
 *
 * `companyId: null` in the where clause is what makes it safe: somebody restored
 * as a viewer on a second account keeps the account that prices them.
 */
export async function membershipRestored(
  tx: TxClient,
  customerId: string,
  accountId: string
): Promise<void> {
  await tx.customer.updateMany({
    where: { id: customerId, companyId: null },
    data: { companyId: accountId, type: 'b2b' },
  });
}
