// Server-only Brand & Theme API readers. Thin wrappers over the api-rest client
// used by the Builder's brand surface. Mutations live in actions.ts.

import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { BrandDto, SiteConfigDto, SiteThemeDto, TenantDto } from './types';

export function getTenant(): Promise<TenantDto> {
  return api.get<TenantDto>('/v1/tenant');
}

export function getConfig(): Promise<SiteConfigDto> {
  return api.get<SiteConfigDto>('/v1/sitebuilder/config');
}

// The tenant's saved theme variants (docs/33 saved-themes contract). A surface
// the dashboard owns at /v1/sitebuilder/saved-themes; if it 404s we degrade to
// an empty list (the prebuilt presets still render from the package). Shape-
// filtered so a transitional endpoint can't surface mistyped rows.
export async function listSavedThemes(): Promise<SiteThemeDto[]> {
  try {
    const { themes } = await api.get<{ themes?: unknown[] }>('/v1/sitebuilder/saved-themes');
    const rows = Array.isArray(themes) ? themes : [];
    return rows.filter(
      (t): t is SiteThemeDto =>
        typeof t === 'object' && t !== null && 'id' in t && 'presentation' in t
    );
  } catch {
    return [];
  }
}

// Tenant brand — the tenant-level source of truth (docs/30 §6). Ungated
// (/v1/brand is platform-level like /v1/tenant), so this read works regardless
// of which modules are enabled.
export function getBrand(): Promise<BrandDto> {
  return api.get<BrandDto>('/v1/brand');
}

interface AssetVariant {
  format: string;
  width: number;
  url: string;
}

// Resolve a media asset id to a browser-usable URL for the brand board
// preview. Prefers a ~512w webp, falls back to the first variant. Returns null
// when the id is absent or the asset can't be read (e.g. still transcoding).
export async function resolveMediaUrl(mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null;
  try {
    const asset = await api.get<{ variants?: AssetVariant[] }>(`/v1/media/assets/${mediaId}`);
    const variants = asset.variants ?? [];
    if (variants.length === 0) return null;
    const webp = variants
      .filter((v) => v.format === 'webp')
      .sort((a, b) => Math.abs(a.width - 512) - Math.abs(b.width - 512));
    return webp[0]?.url ?? variants[0]?.url ?? null;
  } catch {
    return null;
  }
}
