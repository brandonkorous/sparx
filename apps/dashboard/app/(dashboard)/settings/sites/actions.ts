'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { api, ACTIVE_PROPERTY_COOKIE, type ApiRestError } from '@/lib/api-rest-client';
import type { Domain, Property } from '@/lib/sites';

// Server actions for the multi-site (web PROPERTY) management surface (docs/49):
// switch the active site, create a site, flip the primary, and connect/verify a
// custom domain. The role gate + audit live in the api-rest routes; these just
// shape input, call api-rest, and revalidate.

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(err: unknown): ActionResult {
  return { ok: false, error: (err as ApiRestError).message ?? 'Something went wrong.' };
}

// A site switch invalidates everything property-scoped (the whole Builder), so
// revalidate the dashboard layout tree rather than guessing every path.
function revalidateSiteScopes(): void {
  revalidatePath('/', 'layout');
}

/** Choose which site the dashboard authors. Writes the switcher cookie that
 *  lib/api-rest-client forwards as `x-sparx-property-id`. */
export async function setActiveSite(propertyId: string): Promise<ActionResult> {
  if (!propertyId || typeof propertyId !== 'string') {
    return { ok: false, error: 'Missing site.' };
  }
  (await cookies()).set(ACTIVE_PROPERTY_COOKIE, propertyId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidateSiteScopes();
  return { ok: true };
}

const CreateSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required.').max(255),
  slug: z
    .string()
    .max(63)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
});

/** Create an additional site and switch to it (so the next Builder load opens
 *  the new, empty site ready to author). */
export async function createSite(formData: FormData): Promise<ActionResult> {
  const parsed = CreateSiteSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug') ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    const created = await api.post<Property>('/v1/properties', parsed.data);
    (await cookies()).set(ACTIVE_PROPERTY_COOKIE, created.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (err) {
    return fail(err);
  }
  revalidateSiteScopes();
  return { ok: true };
}

/** Delete a site (refused for the primary by api-rest). Removes its pages,
 *  layouts, domains, and per-site catalog/content scope; shared back office is
 *  untouched. */
export async function deleteSite(propertyId: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/properties/${propertyId}`);
  } catch (err) {
    return fail(err);
  }
  // The active-site cookie may now point at a deleted site; resolvePropertyId
  // fails closed to the primary, so a broad revalidate is enough.
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Make a site the tenant's primary (dashboard default + billing anchor). */
export async function makeSitePrimary(propertyId: string): Promise<ActionResult> {
  try {
    await api.post<Property>(`/v1/properties/${propertyId}/make-primary`);
  } catch (err) {
    return fail(err);
  }
  revalidateSiteScopes();
  return { ok: true };
}

const ConnectDomainSchema = z.object({
  propertyId: z.string().uuid('Pick a site.'),
  host: z.string().min(1, 'Enter a domain.').max(255),
});

/** Connect a domain the tenant already owns to a site (returns the DNS records to
 *  add; the tenant then calls verify). */
export async function connectDomain(formData: FormData): Promise<ActionResult> {
  const parsed = ConnectDomainSchema.safeParse({
    propertyId: formData.get('propertyId'),
    host: formData.get('host'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    await api.post<Domain>('/v1/domains', parsed.data);
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/settings/sites');
  return { ok: true };
}

/** Poll DNS for the control-proof TXT now. Surfaces the "not found yet" message
 *  so the tenant knows to wait for propagation. */
export async function verifyDomain(domainId: string): Promise<ActionResult> {
  try {
    await api.post<Domain>(`/v1/domains/${domainId}/verify`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/settings/sites');
  return { ok: true };
}

/** Disconnect a custom domain. */
export async function deleteDomain(domainId: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/domains/${domainId}`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/settings/sites');
  return { ok: true };
}

// Per-site brand + presentation override (docs/49 §3, Slice B). Blank fields →
// null (inherit). If every field is blank we clear the override entirely.
const BrandOverrideSchema = z.object({
  propertyId: z.string().uuid(),
});

function blankToNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

/** Set (or clear) a site's brand + presentation override — wins over the tenant
 *  brand and theme for this site only. All fields optional; blank = inherit. */
export async function updateBrandOverride(formData: FormData): Promise<ActionResult> {
  const parsed = BrandOverrideSchema.safeParse({ propertyId: formData.get('propertyId') });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const businessName = blankToNull(formData.get('businessName'));
  const colorPrimary = blankToNull(formData.get('colorPrimary'));
  const colorAccent = blankToNull(formData.get('colorAccent'));
  const fontHeading = blankToNull(formData.get('fontHeading'));
  const fontBody = blankToNull(formData.get('fontBody'));
  const colorBackground = blankToNull(formData.get('colorBackground'));
  const colorMuted = blankToNull(formData.get('colorMuted'));
  const colorBorder = blankToNull(formData.get('colorBorder'));
  const radiusBase = blankToNull(formData.get('radiusBase'));

  const fields = {
    businessName,
    colorPrimary,
    colorAccent,
    fontHeading,
    fontBody,
    colorBackground,
    colorMuted,
    colorBorder,
    radiusBase,
  };
  const override = Object.values(fields).some((v) => v !== null) ? fields : null;
  try {
    await api.patch<Property>(`/v1/properties/${parsed.data.propertyId}`, {
      brandOverride: override,
    });
  } catch (err) {
    return fail(err);
  }
  // A brand change affects the live site's payload too — revalidate broadly.
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Make a verified domain the canonical (apex) host for its site. */
export async function setDomainCanonical(domainId: string): Promise<ActionResult> {
  try {
    await api.patch<Domain>(`/v1/domains/${domainId}`, { isCanonical: true });
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/settings/sites');
  return { ok: true };
}
