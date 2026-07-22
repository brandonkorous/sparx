// Who is issuing this document — the business's own name and contact block.
//
// Invoices, receipts and purchase orders are issued by the BUSINESS, not by one
// of its sites: WizeWorks issues the invoice, even when the customer bought
// through the site called "sparx". So the masthead name and the seller block
// come from TenantBusiness (07-tenant-business.prisma), never from Property.
//
// This exists because invoice-render.ts and purchase-order-render.ts had each
// grown their own copy of "resolve the issuing tenant's name", and both left
// `addressLines` unset — the field the renderers have always read for the seller
// block, which no code path had ever populated. Both now resolve here, so the
// two documents cannot disagree about who sent them.

import { withTenant } from '@sparx/db';

export interface BusinessIdentity {
  /** Masthead name. Omitted (not empty) when the business has no name at all,
   *  so callers can spread it over a default without clobbering. */
  businessName?: string;
  /** The seller block under the masthead: address, then contact, then tax id.
   *  Omitted when the business has filled nothing in — an absent block prints
   *  nothing, where an array of empty strings would print blank lines. */
  addressLines?: string[];
}

interface BusinessRow {
  businessName: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  taxId: string | null;
  taxRegistered: boolean;
}

/** "Denver, CO 80202" — locality, region and postcode read as one line on every
 *  document, and each part is optional, so this joins only what exists rather
 *  than leaving stray commas behind. */
function localityLine(b: BusinessRow): string | null {
  const cityRegion = [b.city, b.region].filter(Boolean).join(', ');
  const line = [cityRegion, b.postalCode].filter(Boolean).join(' ').trim();
  return line || null;
}

function buildAddressLines(b: BusinessRow): string[] {
  const lines = [
    b.addressLine1,
    b.addressLine2,
    localityLine(b),
    // ISO-2 as stored. Printing "US" rather than "United States" is a known
    // roughness — mapping codes to display names is a localisation concern, and
    // guessing a language here would be worse than showing the code the
    // business itself entered.
    b.country,
    b.phone,
    // Only when actually registered. Printing a tax id a business does not hold
    // — or holds but is not registered under — is a compliance problem, not a
    // cosmetic one, so the flag gates the line rather than the id's presence.
    b.taxRegistered && b.taxId ? `Tax ID: ${b.taxId}` : null,
  ];
  return lines.filter((line): line is string => Boolean(line?.trim()));
}

/**
 * Resolve the issuing business's document identity.
 *
 * Falls back to the tenant's legal name when no business name is set, so a
 * document always has a masthead: a business that never opened Business details
 * still gets "WizeWorks LLC" rather than a blank header.
 */
export async function resolveBusinessIdentity(ctx: {
  tenantId: string;
}): Promise<BusinessIdentity> {
  const [business, tenant] = await Promise.all([
    // tenant_businesses is FORCE RLS — read through withTenant, not the bare client.
    withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.tenantBusiness.findUnique({
        where: { tenantId: ctx.tenantId },
        select: {
          businessName: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          region: true,
          postalCode: true,
          country: true,
          taxId: true,
          taxRegistered: true,
        },
      })
    ),
    withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } })
    ),
  ]);

  // `||` is intended over `??`: an empty-after-trim name must fall through to
  // the next source, which `??` would not do.
  const businessName =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    business?.businessName?.trim() || tenant?.name?.trim() || undefined;

  const addressLines = business ? buildAddressLines(business) : [];

  return {
    ...(businessName ? { businessName } : {}),
    ...(addressLines.length > 0 ? { addressLines } : {}),
  };
}
