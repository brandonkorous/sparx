'use server';

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import { resolveMediaUrl } from './api';
import type { PresentationOverlayV2 } from '@sparx/site-themes';
import type {
  AppearancePolicy,
  BrandDto,
  SavedThemeBrandDto,
  SiteConfigDto,
  SiteSettingsDto,
  SiteThemeDto,
  SiteVersionDto,
} from './types';

// Thin server-action adapters over api-rest for the Builder's Brand & Theme
// surface. Server actions inherit the session + JWT secret (held only on the
// dashboard server) and integrate with revalidatePath, so the editor never
// talks to api-rest from the browser.

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/builder', 'layout');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Something went wrong.' };
  }
}

export async function selectTheme(themeKey: string): Promise<ActionResult<SiteConfigDto>> {
  return run(() => api.put<SiteConfigDto>('/v1/sitebuilder/config/theme', { themeKey }));
}

export async function updateSettings(input: {
  settings?: SiteSettingsDto;
  appearancePolicy?: AppearancePolicy;
}): Promise<ActionResult<SiteConfigDto>> {
  return run(() => api.patch<SiteConfigDto>('/v1/sitebuilder/config/settings', input));
}

// ── Saved themes (docs/33 saved-themes contract) ───────────────────────────
// The tenant's named themes (/v1/sitebuilder/saved-themes). A theme captures
// its base preset, a presentation overlay, AND a brand "look" snapshot
// (colours/fonts/shape), so it's self-contained. `apply` loads the base preset +
// presentation into the draft; the dashboard separately writes the brand via
// /v1/brand (the brand stays tenant-owned — see theme-center onApplySaved).
export async function saveTheme(input: {
  name: string;
  basePresetKey: string;
  presentation: PresentationOverlayV2;
  brand?: SavedThemeBrandDto;
}): Promise<ActionResult<SiteThemeDto>> {
  return run(() => api.post<SiteThemeDto>('/v1/sitebuilder/saved-themes', input));
}

// Edit a saved theme in place — name, presentation overlay, and/or brand "look".
// Used when a saved theme is the selected/active theme: presentation AND brand
// edits write back into it so "select and tweak" actually modifies the snapshot.
// (The base preset is fixed at creation; the backend update accepts the rest.)
export async function updateSavedTheme(
  id: string,
  input: { name?: string; presentation?: PresentationOverlayV2; brand?: SavedThemeBrandDto }
): Promise<ActionResult<SiteThemeDto>> {
  return run(() => api.patch<SiteThemeDto>(`/v1/sitebuilder/saved-themes/${id}`, input));
}

export async function deleteSavedTheme(id: string): Promise<ActionResult> {
  return run(() => api.delete<void>(`/v1/sitebuilder/saved-themes/${id}`));
}

export async function applySavedTheme(id: string): Promise<ActionResult<SiteConfigDto>> {
  return run(() => api.post<SiteConfigDto>(`/v1/sitebuilder/saved-themes/${id}/apply`, {}));
}

// Brand is tenant-level (docs/30 §6) — PATCH merges the provided fields into
// the single tenant_brands row. All fields optional; a present null clears.
export type BrandPatch = Partial<Omit<BrandDto, 'tenantId'>>;

export async function updateBrand(input: BrandPatch): Promise<ActionResult<BrandDto>> {
  return run(() => api.patch<BrandDto>('/v1/brand', input));
}

// ── Per-site identity (docs/49) ─────────────────────────────────────────────
// The Builder authors ONE active site at a time. The site's customer-facing
// NAME (Property.name), its SOCIAL links, and — for a non-primary site — its
// brand OVERRIDE are per-site, so they persist on the Property, not the tenant
// brand. The primary site's brand is the tenant base (`updateBrand`); a
// non-primary site stores a `brandOverride` (a partial that wins over the base,
// null fields inherit). One PATCH endpoint, fields are independent.
export interface SiteIdentityPatch {
  name?: string;
  socials?: { platform: string; url: string }[];
  brandOverride?: Record<string, unknown> | null;
}

export async function updateSiteIdentity(
  propertyId: string,
  input: SiteIdentityPatch
): Promise<ActionResult<unknown>> {
  return run(() => api.patch(`/v1/properties/${propertyId}`, input));
}

// Resolve a freshly-picked/uploaded asset id to a preview URL for the brand
// board, without touching revalidation (pure read).
export async function resolveBrandMedia(mediaId: string | null): Promise<string | null> {
  return resolveMediaUrl(mediaId);
}

export async function publishNow(note?: string): Promise<ActionResult<SiteVersionDto>> {
  return run(() => api.post<SiteVersionDto>('/v1/sitebuilder/publish', { note }));
}
