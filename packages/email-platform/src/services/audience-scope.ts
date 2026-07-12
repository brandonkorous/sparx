// Who a broadcast is allowed to reach (docs/49 Phase 7).
//
// Its own module — not because it's long, but because it's the one rule protecting
// multi-site tenants from the worst thing email can do, and it deserves a test that
// doesn't have to drag the whole render path (React Email et al.) in behind it.

import type { Prisma } from '@sparx/db';

/**
 * The site-scoping predicate for a broadcast's audience.
 *
 * A Segment is TENANT-wide — it has no `propertyId`, and `SegmentField` has no site
 * predicate to write one with — but a Customer belongs to a site. Without this filter a
 * multi-site tenant broadcasting from Site A would mail Site B's customers, in Site A's
 * brand, with Site A's copy. That is the one thing multi-site must never do, and nothing
 * upstream prevents it: the segment doesn't know about sites, and the broadcast's
 * `propertyId` was only ever used to pick the brand.
 *
 * The rule is not invented here. It is the SAME predicate the CRM customer list applies
 * (`customer-service.ts`): this site's customers, OR the unattributed ones. So "who this
 * site shows me" and "who this site's broadcast reaches" cannot disagree. A customer with
 * no site is tenant-level and hears from every site; a customer who belongs to Site B
 * never hears from Site A.
 *
 * A broadcast with no `propertyId` — which is every single-site tenant — filters nothing.
 */
export function audienceScope(propertyId: string | null): Prisma.SegmentMemberWhereInput {
  if (!propertyId) return {};
  return { customer: { OR: [{ propertyId: null }, { propertyId }] } };
}
