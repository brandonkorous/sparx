// Tenant business details — the LEGAL ENTITY behind the account.
//
//   GET   /v1/tenant/business   → current details (defaults when unset)
//   PATCH /v1/tenant/business   → upsert (partial)
//
// The facts a business document legally needs: the business name, a registered
// address, a tax id, a company number, a phone. These are what fill the seller
// block on an invoice or a purchase order — which rendered EMPTY before this
// existed, because `addressLines` had no source to read from.
//
// Not module-gated (no requireModule): a business's own identity is owned ABOVE
// every module, exactly like /v1/brand and /v1/tenant. Reading is `viewer` —
// the address and business name are printed on documents staff routinely see.
// Writing is `admin`, not `editor`: a tax id or registered address is a legal
// fact about the company, not content.
//
// The one-row-per-tenant `tenant_businesses` table is ENABLE+FORCE RLS, so
// reads/writes go through withTenant (unlike the RLS-exempt `tenants` table
// that tenant.ts touches via the bare client).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import type { Prisma } from '@prisma/client';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

// Trim-then-empty-to-null: a cleared field arrives as "" from a form, and an
// empty string is not a business name — it is the absence of one. Storing ""
// would make `COALESCE(business_name, tenants.name)` pick the wrong branch and
// print a blank masthead.
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

// ISO 3166-1 alpha-2, stored upper-case so `country === 'US'` is a safe test
// everywhere downstream rather than depending on how a form submitted it.
const country = z
  .string()
  .trim()
  .length(2)
  .transform((v) => v.toUpperCase())
  .nullable()
  .optional();

// ISO 4217, likewise normalised upper-case.
const currency = z
  .string()
  .trim()
  .length(3)
  .transform((v) => v.toUpperCase())
  .nullable()
  .optional();

// A time zone is only useful if `Intl` accepts it: every date we print on a
// document formats through it, and a zone it rejects throws at RENDER time —
// far from the save that caused it. The dashboard picks from a list, but the
// API is public, so the check belongs here too. Validated by attempting the
// exact call the renderers make, rather than matching a pattern or shipping a
// copy of the IANA database that would rot.
const timezone = z
  .string()
  .trim()
  .max(64)
  // Cleared-to-empty means "unset", exactly as for every other text field —
  // normalised to null BEFORE validating, so clearing the field is not mistaken
  // for supplying an unrecognised zone.
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine(
    (value) => {
      if (value === null) return true;
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Not a recognised time zone. Use an IANA name such as America/Denver.' }
  )
  .optional();

/** How the business is constituted. Open set — the real list is
 *  jurisdiction-specific (Ltd, GmbH, Pty, BV…) and a schema migration is the
 *  wrong gate on a business telling us what it is. */
const ENTITY_TYPES = [
  'sole_trader',
  'partnership',
  'llc',
  'corporation',
  'nonprofit',
  'other',
] as const;

// All fields optional → PATCH semantics. Present-but-null clears; absent leaves
// untouched.
const PatchBusiness = z.object({
  businessName: text(255),
  entityType: z.enum(ENTITY_TYPES).nullable().optional(),
  registrationNumber: text(64),
  taxId: text(64),
  taxRegistered: z.boolean().optional(),
  phone: text(40),
  supportEmail: z.string().email().max(255).nullable().optional(),
  addressLine1: text(255),
  addressLine2: text(255),
  city: text(120),
  region: text(120),
  postalCode: text(20),
  country,
  timezone,
  defaultCurrency: currency,
});

interface BusinessView {
  tenantId: string;
  businessName: string | null;
  entityType: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  taxRegistered: boolean;
  phone: string | null;
  supportEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  defaultCurrency: string | null;
}

type BusinessRow = Omit<BusinessView, 'tenantId'>;

function toView(tenantId: string, row: BusinessRow | null): BusinessView {
  return {
    tenantId,
    businessName: row?.businessName ?? null,
    entityType: row?.entityType ?? null,
    registrationNumber: row?.registrationNumber ?? null,
    taxId: row?.taxId ?? null,
    // Defaults to false, never null — "are they tax registered?" is a yes/no a
    // document has to answer, and an unset row means "not registered".
    taxRegistered: row?.taxRegistered ?? false,
    phone: row?.phone ?? null,
    supportEmail: row?.supportEmail ?? null,
    addressLine1: row?.addressLine1 ?? null,
    addressLine2: row?.addressLine2 ?? null,
    city: row?.city ?? null,
    region: row?.region ?? null,
    postalCode: row?.postalCode ?? null,
    country: row?.country ?? null,
    timezone: row?.timezone ?? null,
    defaultCurrency: row?.defaultCurrency ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const tenantBusinessRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/tenant/business', async (request) => {
    const auth = requireRole(request, 'viewer');
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.tenantBusiness.findUnique({ where: { tenantId: auth.tenantId } })
    );
    return ok(toView(auth.tenantId, row));
  });

  app.patch('/v1/tenant/business', async (request) => {
    const auth = requireRole(request, 'admin');
    const input = PatchBusiness.parse(request.body);

    // Only forward keys the caller actually sent (PATCH merge). Spreading
    // `input` wholesale would write `undefined` over set columns for every
    // field the form did not include.
    const data: Prisma.TenantBusinessUncheckedUpdateInput = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }

    const row = await withTenant({ tenantId: auth.tenantId, userId: auth.actorId }, (tx) =>
      tx.tenantBusiness.upsert({
        where: { tenantId: auth.tenantId },
        create: { tenantId: auth.tenantId, ...data } as Prisma.TenantBusinessUncheckedCreateInput,
        update: data,
      })
    );
    return ok(toView(auth.tenantId, row));
  });
};

export default tenantBusinessRoutes;
