// Per-site brand override (docs/49 §3) — the shape + merge for a property's
// optional `brand_override` JSON. The override is a FULL per-site brand: a
// partial that wins over the tenant base brand field-by-field; any absent/null
// field inherits the base (the default). This is the "full per-site brand" model
// (the Builder Brand page authors the active site's whole identity): the primary
// site edits the tenant base (TenantBrand); a non-primary site stores this
// override. Shared by the properties PATCH (validation) and the public tenant
// payload (merge).

import { z } from 'zod';

/** The overridable identity + presentation fields. All optional + nullable:
 *  present = override, null/absent = inherit the tenant brand or theme. */
export const PropertyBrandOverrideSchema = z
    .object({
        // Identity — the per-site display name, tagline, logos, and color palette.
        // (businessName/tagline are the brand legal/document name; the customer-
        // facing site name is Property.name, edited separately.)
        businessName: z.string().max(255).nullable().optional(),
        tagline: z.string().max(255).nullable().optional(),
        // Logos + favicon. `logoMediaId` is the legacy single-logo field (kept so
        // pre-expansion overrides still resolve) — treated as the light logo.
        logoMediaId: z.string().max(255).nullable().optional(),
        logoLightMediaId: z.string().max(255).nullable().optional(),
        logoDarkMediaId: z.string().max(255).nullable().optional(),
        faviconMediaId: z.string().max(255).nullable().optional(),
        // Brand colors + their optional -content (foreground) overrides.
        colorPrimary: z.string().max(64).nullable().optional(),
        colorPrimaryForeground: z.string().max(64).nullable().optional(),
        colorSecondary: z.string().max(64).nullable().optional(),
        colorSecondaryForeground: z.string().max(64).nullable().optional(),
        colorAccent: z.string().max(64).nullable().optional(),
        colorAccentForeground: z.string().max(64).nullable().optional(),
        // Typography — per-site font overrides (font name / Google Fonts slug).
        fontHeading: z.string().max(120).nullable().optional(),
        fontBody: z.string().max(120).nullable().optional(),
        // Brand-owned shape/rhythm/effect token doc (docs/33) — opaque JSON, merged
        // whole (null = inherit the base brand's tokens).
        tokens: z.record(z.string(), z.unknown()).nullable().optional(),
        // Presentation — per-site surface colors and shape (legacy fields kept for
        // the Settings → Sites override panel; the Builder uses the per-site
        // SiteConfig presentation overlay instead).
        colorBackground: z.string().max(64).nullable().optional(),
        colorMuted: z.string().max(64).nullable().optional(),
        colorBorder: z.string().max(64).nullable().optional(),
        radiusBase: z.string().max(32).nullable().optional(),
        // Commerce gating — per-site pricing visibility.
        hidePricesWhenSignedOut: z.boolean().nullable().optional(),
        // Commerce locale — per-site currency and locale (wins over tenant settings).
        defaultCurrency: z.string().max(3).nullable().optional(),
        defaultLocale: z.string().max(10).nullable().optional(),
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

/** The full tenant brand identity an override can replace, field-by-field. */
export interface BrandIdentity {
    businessName: string | null;
    tagline: string | null;
    logoLightMediaId: string | null;
    logoDarkMediaId: string | null;
    faviconMediaId: string | null;
    colorPrimary: string | null;
    colorPrimaryForeground: string | null;
    colorSecondary: string | null;
    colorSecondaryForeground: string | null;
    colorAccent: string | null;
    colorAccentForeground: string | null;
    fontHeading: string | null;
    fontBody: string | null;
    tokens: unknown;
}

/** Merge a property override over the tenant brand identity, field-by-field. A
 *  null override → the tenant brand unchanged. Only non-null override fields win;
 *  everything else inherits. `logoMediaId` (legacy single logo) maps to the light
 *  logo when the explicit `logoLightMediaId` is absent. */
export function mergeBrandIdentity(
    base: BrandIdentity,
    override: PropertyBrandOverride | null
): BrandIdentity {
    if (!override) return base;
    const overrideLight = override.logoLightMediaId ?? override.logoMediaId;
    return {
        businessName: override.businessName ?? base.businessName,
        tagline: override.tagline ?? base.tagline,
        logoLightMediaId: overrideLight ?? base.logoLightMediaId,
        logoDarkMediaId: override.logoDarkMediaId ?? base.logoDarkMediaId,
        faviconMediaId: override.faviconMediaId ?? base.faviconMediaId,
        colorPrimary: override.colorPrimary ?? base.colorPrimary,
        colorPrimaryForeground: override.colorPrimaryForeground ?? base.colorPrimaryForeground,
        colorSecondary: override.colorSecondary ?? base.colorSecondary,
        colorSecondaryForeground: override.colorSecondaryForeground ?? base.colorSecondaryForeground,
        colorAccent: override.colorAccent ?? base.colorAccent,
        colorAccentForeground: override.colorAccentForeground ?? base.colorAccentForeground,
        fontHeading: override.fontHeading ?? base.fontHeading,
        fontBody: override.fontBody ?? base.fontBody,
        tokens: override.tokens ?? base.tokens,
    };
}
