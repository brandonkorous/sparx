// Per-site brand override (docs/49 §3, Phase 4) — the shape + merge for a
// property's optional `brand_override` JSON. The override is presentation-only
// identity: a partial that wins over the tenant brand field-by-field; any
// absent/null field inherits the tenant brand (the default). Shared by the
// properties PATCH (validation) and the public tenant payload (merge).

import { z } from 'zod';

/** The overridable identity fields. All optional + nullable: present = override,
 *  null/absent = inherit the tenant brand. */
export const PropertyBrandOverrideSchema = z
  .object({
    businessName: z.string().max(255).nullable().optional(),
    colorPrimary: z.string().max(64).nullable().optional(),
    colorPrimaryForeground: z.string().max(64).nullable().optional(),
    colorAccent: z.string().max(64).nullable().optional(),
    logoMediaId: z.string().max(255).nullable().optional(),
  })
  .strict();

export type PropertyBrandOverride = z.infer<typeof PropertyBrandOverrideSchema>;

/** Coerce a stored JSON column into a typed override, dropping anything that
 *  doesn't fit (defensive — the column is unvalidated at the DB level). Returns
 *  null for a missing/empty/invalid override (→ inherit the tenant brand). */
export function parseBrandOverride(raw: unknown): PropertyBrandOverride | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const parsed = PropertyBrandOverrideSchema.safeParse(raw);
  if (!parsed.success) return null;
  // An all-empty object is equivalent to "no override".
  const hasAny = Object.values(parsed.data).some((v) => v != null && v !== '');
  return hasAny ? parsed.data : null;
}

/** The tenant brand identity fields the override can replace. */
export interface BrandIdentity {
  businessName: string | null;
  colorPrimary: string | null;
  colorPrimaryForeground: string | null;
  colorAccent: string | null;
  logoMediaId: string | null;
}

/** Merge a property override over the tenant brand identity, field-by-field. A
 *  null override → the tenant brand unchanged. Only non-null override fields win;
 *  everything else inherits. */
export function mergeBrandIdentity(
  tenant: BrandIdentity,
  override: PropertyBrandOverride | null
): BrandIdentity {
  if (!override) return tenant;
  return {
    businessName: override.businessName ?? tenant.businessName,
    colorPrimary: override.colorPrimary ?? tenant.colorPrimary,
    colorPrimaryForeground: override.colorPrimaryForeground ?? tenant.colorPrimaryForeground,
    colorAccent: override.colorAccent ?? tenant.colorAccent,
    logoMediaId: override.logoMediaId ?? tenant.logoMediaId,
  };
}
