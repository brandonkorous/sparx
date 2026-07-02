// Per-site MEMBERSHIP resolution (docs/58 D2/D6) — ported verbatim from the
// pre-Better-Auth design, re-keyed on `customers.auth_user_id` (the Better Auth
// user) instead of the retired `identity_id`.
//
// The Better Auth user is the tenant-wide IDENTITY (one per (tenant, email)).
// The per-site `customers` MEMBERSHIP (which owns that site's consent, orders,
// and LTV) is resolved from (authUserId, propertyId) on each authenticated
// request: a first sign-in on a sister site creates a membership with FRESH
// consent — never inheriting another site's consent (D6).

import { withTenant } from '@sparx/db';

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
}

/**
 * Find-or-create the per-site membership for (propertyId, authUserId).
 *  - Already linked on this site → return it (created: false).
 *  - A guest / CRM-imported row with the same email on this site (no login yet)
 *    → adopt it: link the auth user, promote prospect → retail (created: false —
 *    adopting an existing local row is not "recognized").
 *  - Otherwise → create a fresh membership with EMPTY consent (created: true).
 * `propertyId` is the active site (null only for tenants with no sites / tests).
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
    if (linked) return { customerId: linked.id, created: false };

    const guest = await tx.customer.findFirst({
      where: { propertyId, email, authUserId: null, deletedAt: null },
      select: { id: true, type: true, firstName: true, lastName: true },
    });
    if (guest) {
      await tx.customer.update({
        where: { id: guest.id },
        data: {
          authUserId,
          ...(guest.type === 'prospect' ? { type: 'retail' } : {}),
          ...(names.firstName && !guest.firstName ? { firstName: names.firstName } : {}),
          ...(names.lastName && !guest.lastName ? { lastName: names.lastName } : {}),
        },
      });
      return { customerId: guest.id, created: false };
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
    return { customerId: created.id, created: true };
  });
}
