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
  /** Present when the API returned 402 — the dashboard should show an upsell. */
  paymentRequired?: { module: string };
}

function fail(err: unknown): ActionResult {
  const e = err as ApiRestError;
  if (e.status === 402) {
    const module = (e.details as { module?: string } | undefined)?.module ?? 'builder';
    return { ok: false, error: e.message, paymentRequired: { module } };
  }
  return { ok: false, error: e.message ?? 'Something went wrong.' };
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

// ── New-site wizard (docs/49 Phase 8b) ─────────────────────────────────────
// One guided flow that provisions a whole site: create the Property, optionally
// install a blueprint INTO it (the new site — not the active one, hence the
// explicit `property_id` target the 8a route accepts), optionally go live, and
// switch the dashboard to author it. A blank choice creates an empty site.

const NewSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required.').max(255),
  slug: z
    .string()
    .max(63)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  /** A blueprint to install into the new site, or null/absent for a blank site. */
  blueprintKey: z
    .string()
    .min(1)
    .max(63)
    .nullable()
    .optional()
    .transform((k) => k ?? null),
  /** Publish the blueprint's drafts immediately (go live). Default true; ignored
   *  for a blank site (nothing to publish). */
  publish: z.boolean().optional(),
});

export interface NewSiteResult {
  ok: boolean;
  error?: string;
  paymentRequired?: { module: string };
  /** The created site (present even when a later install step fails, so the UI
   *  can still route the user to it rather than stranding an unseen site). */
  site?: { id: string; slug: string; name: string };
  /** The blueprint install row (when a blueprint was chosen). */
  installId?: string;
  /** Whether the blueprint was published (went live) as part of the flow. */
  live?: boolean;
  /** The new site's canonical address, for the success screen. */
  host?: string | null;
}

/** Provision a new site end-to-end: create → (install blueprint into it) → (go
 *  live) → switch to it. Each later step is best-effort about NOT losing the
 *  created site — a blueprint that fails to install still leaves a usable site. */
export async function createSiteWithBlueprint(input: {
  name: string;
  slug?: string;
  blueprintKey?: string | null;
  publish?: boolean;
}): Promise<NewSiteResult> {
  const parsed = NewSiteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { name, slug, blueprintKey, publish } = parsed.data;

  // 1. Create the property (api-rest 402s if a 2nd+ site needs the Builder module).
  let site: Property;
  try {
    site = await api.post<Property>('/v1/properties', { name, ...(slug ? { slug } : {}) });
  } catch (err) {
    return fail(err);
  }

  // 2. Author the new site next, so "Open in Builder" / the next load lands on it.
  (await cookies()).set(ACTIVE_PROPERTY_COOKIE, site.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  // 3. Optional blueprint → install INTO the new site (explicit target), then go live.
  let installId: string | undefined;
  let live = false;
  if (blueprintKey) {
    try {
      const installed = await api.post<{ install_id: string; counts: Record<string, number> }>(
        `/v1/blueprints/${encodeURIComponent(blueprintKey)}/install`,
        { property_id: site.id }
      );
      installId = installed.install_id;
      if (publish !== false) {
        await api.post(`/v1/blueprints/installs/${encodeURIComponent(installId)}/go-live`);
        live = true;
      }
    } catch (err) {
      // The site exists; surface the install failure but keep the site so the
      // user can open it in the Builder rather than chase an invisible half-state.
      revalidateSiteScopes();
      const e = err as ApiRestError;
      return {
        ok: false,
        error: `“${site.name}” was created, but the blueprint didn’t install: ${
          e.message ?? 'unknown error'
        }. Open it in the Builder, or install a blueprint from the Marketplace.`,
        site: { id: site.id, slug: site.slug, name: site.name },
        installId,
      };
    }
  }

  // 4. Resolve the new site's canonical address for the success screen (non-fatal).
  let host: string | null = null;
  try {
    const domains = await api.get<Domain[]>('/v1/domains');
    const mine = domains.filter((d) => d.propertyId === site.id);
    host = (mine.find((d) => d.isCanonical) ?? mine[0])?.host ?? null;
  } catch {
    // Fall through — the success screen falls back to the handle.
  }

  revalidateSiteScopes();
  return {
    ok: true,
    site: { id: site.id, slug: site.slug, name: site.name },
    installId,
    live,
    host,
  };
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

const RenameSiteSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(1, 'Site name is required.').max(255),
});

/** Rename a site — sets `Property.name`, the CUSTOMER-FACING site name every
 *  storefront/email surface renders (docs/49). This is NOT the tenant's legal/org
 *  name (that lives in Settings → General). */
export async function renameSite(formData: FormData): Promise<ActionResult> {
  const parsed = RenameSiteSchema.safeParse({
    propertyId: formData.get('propertyId'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    await api.patch<Property>(`/v1/properties/${parsed.data.propertyId}`, {
      name: parsed.data.name,
    });
  } catch (err) {
    return fail(err);
  }
  // The name shows on the live site (title/header/footer) + emails — revalidate broadly.
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
  // NOTE: `businessName` is intentionally NOT read here. The customer-facing site
  // name is `Property.name` (edited via renameSite), not a brand override (docs/49).
  // The brand override now carries only presentation (colours/type/logo).
  const colorPrimary = blankToNull(formData.get('colorPrimary'));
  const colorAccent = blankToNull(formData.get('colorAccent'));
  const fontHeading = blankToNull(formData.get('fontHeading'));
  const fontBody = blankToNull(formData.get('fontBody'));
  const colorBackground = blankToNull(formData.get('colorBackground'));
  const colorMuted = blankToNull(formData.get('colorMuted'));
  const colorBorder = blankToNull(formData.get('colorBorder'));
  const radiusBase = blankToNull(formData.get('radiusBase'));
  const defaultCurrency = blankToNull(formData.get('defaultCurrency'));
  const defaultLocale = blankToNull(formData.get('defaultLocale'));

  const fields = {
    colorPrimary,
    colorAccent,
    fontHeading,
    fontBody,
    colorBackground,
    colorMuted,
    colorBorder,
    radiusBase,
    defaultCurrency,
    defaultLocale,
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

/** Set the per-site disabled-modules list (docs/49 Slice F). Sends the full
 *  array — PUT semantics on moduleScope. Pass [] to re-enable everything. */
export async function updateModuleScope(
  propertyId: string,
  disabledModules: string[]
): Promise<ActionResult> {
  if (!propertyId) return { ok: false, error: 'Missing site.' };
  try {
    await api.patch<Property>(`/v1/properties/${propertyId}`, {
      moduleScope: disabledModules,
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath('/settings/sites');
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
