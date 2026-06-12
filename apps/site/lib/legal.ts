// Server-side read of a tenant's legal-document placements (docs/42 §5).
//
// The storefront footer renders a "Legal" column from these — privacy/terms/
// cookie-policy/returns/shipping/refund pages the tenant has published. The
// api-rest endpoint drops any placement whose page is unpublished/deleted, so
// this never yields a dead link. A brand-new store (nothing seeded/published
// yet) simply returns [] and the column is omitted — strictly better than the
// old hardcoded `/shipping-policy` / `/returns-policy` links that 404'd.

import { publicGet } from './content';

export interface LegalLink {
  label: string;
  href: string;
  legalKind: string | null;
  /** Which footer column to group under (defaults to 'legal'). */
  columnKey: string;
}

export async function getLegalFooterLinks(
  tenantSlug: string,
  // The active site (docs/49 Phase 6c) — the footer shows this site's legal links
  // plus the tenant-wide ones; omitted → the tenant's primary site.
  propertySlug?: string
): Promise<LegalLink[]> {
  try {
    return await publicGet<LegalLink[]>(
      '/v1/public/legal/placements',
      {
        tenant: tenantSlug,
        placement: 'footer',
        ...(propertySlug ? { property: propertySlug } : {}),
      },
      { tag: `legal-placements:${tenantSlug}${propertySlug ? `:${propertySlug}` : ''}` }
    );
  } catch {
    // A legal-placements outage must never take down the storefront chrome —
    // fall back to no Legal column.
    return [];
  }
}
