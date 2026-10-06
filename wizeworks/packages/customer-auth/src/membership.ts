// Per-site MEMBERSHIP resolution (docs/58 D2/D6) — ported verbatim from the
// pre-Better-Auth design, re-keyed on `customers.auth_user_id` (the Better Auth
// user) instead of the retired `identity_id`.
//
// The Better Auth user is the tenant-wide IDENTITY (one per (tenant, email)).
// The per-site `customers` MEMBERSHIP (which owns that site's consent, orders,
// and LTV) is resolved from (authUserId, propertyId) on each authenticated
// request: a first sign-in on a sister site creates a membership with FRESH
// consent — never inheriting another site's consent (D6).

import { withTenant } from '@wizeworks/db';

export interface EnsureMembershipContext {
  tenantId: string;
}

export interface EnsureMembershipNames {
  firstName?: string;
  lastName?: string;
}

export interface EnsureMembershipResult {
  /** The per-site `customers` row id this login maps to on the active site. */
  customerId: string;
  /** True when this call CREATED the membership for the active site (drives the
   *  docs/58 D6 "recognized" signal in combination with a pre-existing user). */
  created: boolean;
  /** True when this call claimed an existing guest or CRM row for the login,
   *  writing the login (and maybe a site and a name) onto it. The row is
   *  somebody the business already had, now changed. */
  adopted: boolean;
}

/**
 * Find-or-create the per-site membership for (propertyId, authUserId).
 *  - Already linked on this site → return it (created: false).
 *  - A guest / CRM-imported row with the same email on this site (no login yet)
 *    → adopt it: link the auth user, promote prospect → retail (created: false —
 *    adopting an existing local row is not "recognized").
 *  - A guest row belonging to NO site with the same email → adopt it too, and
 *    write this site onto it.
 *  - Otherwise → create a fresh membership with EMPTY consent (created: true).
 * `propertyId` is the active site (null only for tenants with no sites / tests).
 *
 * WHY THE SITE-LESS CASE EXISTS. A NULL `propertyId` means "belongs to the
 * business, not to any one site" — and it reads exactly like a correct value
 * until something joins on it. It did not match here, so a customer who booked
 * as a guest and then made an account with the same address came out as TWO
 * people: one holding her appointments, one holding her login, and an empty
 * bookings page in front of her (issue 152). Signing in on a site is evidence of
 * belonging to it, so the row is completed rather than duplicated.
 *
 * A row belonging to a DIFFERENT site is still never taken, which is what keeps
 * docs/58 D6 true: a first sign-in on a sister site gets a fresh membership and
 * fresh consent, never another site's.
 *
 * THIS DOES NOT ANNOUNCE THE PERSON. This package cannot reach the CRM bus, so
 * the caller must, from `created` and `adopted`, once this has returned (it has
 * committed by then). api-rest's `ensureAnnouncedMembership` is that caller, and
 * is the one to use: a sign-up that was only written down sat in the customer
 * list and nowhere in search (sparx persona issue 086).
 */
export function ensureMembership(
  ctx: EnsureMembershipContext,
  propertyId: string | null,
  authUserId: string,
  email: string,
  names: EnsureMembershipNames
): Promise<EnsureMembershipResult> {
  return withTenant(ctx, async (tx) => {
    const linked = await tx.customer.findFirst({
      where: { propertyId, authUserId, deletedAt: null },
      select: { id: true },
    });
    if (linked) return { customerId: linked.id, created: false, adopted: false };

    // This site first, then a row that names no site at all.
    const guest =
      (await tx.customer.findFirst({
        where: { propertyId, email, authUserId: null, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, propertyId: true },
      })) ??
      (propertyId
        ? await tx.customer.findFirst({
            where: { propertyId: null, email, authUserId: null, deletedAt: null },
            select: { id: true, firstName: true, lastName: true, propertyId: true },
          })
        : null);
    if (guest) {
      // Registering an account links the login; it is not a purchase, so the
      // lifecycle stage is left to the order path to advance (see checkout-service).
      await tx.customer.update({
        where: { id: guest.id },
        data: {
          authUserId,
          ...(guest.propertyId === null && propertyId ? { propertyId } : {}),
          ...(names.firstName && !guest.firstName ? { firstName: names.firstName } : {}),
          ...(names.lastName && !guest.lastName ? { lastName: names.lastName } : {}),
        },
      });
      return { customerId: guest.id, created: false, adopted: true };
    }

    const created = await tx.customer.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        authUserId,
        type: 'retail',
        email,
        firstName: names.firstName ?? null,
        lastName: names.lastName ?? null,
      },
      select: { id: true },
    });
    // The activity bar's line for a new person who arrived through the site by
    // themselves. Without it a sign-up was the one arrival the business could
    // not see happen (sparx persona issue 086). Inside the write, so a rolled
    // back sign-up leaves no line about a person who does not exist.
    await tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: null,
        actorType: 'customer',
        action: 'crm.customer.captured',
        entityType: 'Customer',
        entityId: created.id,
        diff: { before: null, after: { id: created.id, email, propertyId } },
      },
    });
    return { customerId: created.id, created: true, adopted: false };
  });
}
