// Which platform brand a tenant belongs to.
//
// WizeWorks runs more than one product on this platform. A tenant belongs to the
// brand it signed up under, recorded on `tenants.platform_brand`, and never
// changes brands.
//
// The `tenants` table is the non-RLS dispatch row, so this reads with the plain
// system client — there is no tenant context to establish, and the column is
// indexed.

import { prisma } from '@sparx/db';

/** The brand every tenant provisioned before the second brand existed belongs
 *  to, and the column's own default. */
export const DEFAULT_PLATFORM_BRAND = 'sparx';

/**
 * The tenant's platform brand, falling back to the default for a tenant that
 * somehow has none.
 *
 * The fallback is deliberate and it is the SAFE direction here: this gates which
 * marketplace listings a tenant sees, and defaulting to the original brand shows
 * the catalog that every tenant could already see. Defaulting the other way — to
 * whatever brand asked — would let an unknown value unlock another brand's
 * showcase, which is the leak the gate exists to stop.
 */
export async function tenantPlatformBrand(tenantId: string): Promise<string> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { platformBrand: true },
  });
  return row?.platformBrand ?? DEFAULT_PLATFORM_BRAND;
}
