// Server-only Brand & Theme API readers. Thin wrappers over the api-rest client
// used by the Builder's brand surface. Mutations live in actions.ts.

import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { BrandDto, SiteConfigDto, SiteThemeDto, TenantDto } from './types';
import type { SitePreviewData } from '../../_builder/binding-catalog';

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

// Browser-reachable public API origin — the SAME var the storefront's media
// resolver uses (apps/site/lib/media.ts). `NEXT_PUBLIC_API_URL` is the public
// REST gateway (api.sparx.works); the canvas <img> loads in the browser, so it
// must NOT use the internal `SPARX_API_REST_URL`. There is no public GraphQL/
// REST-split var — media is a REST redirect.
const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.SPARX_PUBLIC_API_REST_URL ??
  'http://localhost:3100';

// A media id → the public media redirect URL, identical to the storefront's
// `mediaUrl`. The endpoint 302s to the stored object, so it works for EVERY
// asset — including external-URL assets that have no transcoded variants (which
// the authed `resolveMediaUrl` returns null for). An absolute http(s) ref is
// passed straight through. Returns null for an empty id.
export function publicMediaUrl(assetId: string | null, tenantSlug: string): string | null {
  if (!assetId) return null;
  if (/^https?:\/\//i.test(assetId)) return assetId;
  return `${PUBLIC_API_URL}/v1/public/media/${encodeURIComponent(assetId)}?tenant=${encodeURIComponent(
    tenantSlug
  )}`;
}

// The shape we read off the public tenant payload — the same one the storefront
// resolves the header brand + footer social row from (services/api-rest
// v1/public/tenants).
interface PublicTenantChrome {
  name: string;
  businessName: string | null;
  // The customer-facing SITE name (docs/49) — the active site, else the primary.
  // This is what the canvas chrome shows, NOT the tenant's legal/brand name.
  propertyName: string | null;
  theme: { logoMediaId: string | null } | null;
  socials?: { platform: string; url: string }[];
}

// The tenant's real site-chrome data, resolved EXACTLY like the storefront's
// `site.*` roots (apps/site loadSiteData) so the Builder canvas header AND footer
// match the live/published site:
//   · identity — display name (property-scoped business name, falling back to the
//     tenant name) + the public logo URL.
//   · social   — the tenant's social links, blank entries dropped (mirrors
//     loadSiteData's socialsToItems). Empty ⇒ SocialLinks falls back to its own
//     placeholder icons, instead of the synthetic record garbage.
// `propertySlug` scopes it to the active web property (docs/49) so a per-site brand
// override previews correctly; absent ⇒ the tenant's primary brand. Defensive — a
// failed read yields a bare "Brand" with no social so the canvas still renders.
export async function getSitePreviewData(propertySlug?: string | null): Promise<SitePreviewData> {
  try {
    const tenant = await getTenant();
    const propertyParam = propertySlug ? `?property=${encodeURIComponent(propertySlug)}` : '';
    const payload = await api.get<PublicTenantChrome>(
      `/v1/public/tenants/${encodeURIComponent(tenant.slug)}${propertyParam}`
    );
    // The customer-facing SITE name wins (docs/49): the active site's name, then
    // the legacy brand business name, then the tenant's legal name as a last
    // resort — so the canvas chrome matches what the live/published site renders.
    // First non-EMPTY trimmed value (an empty string must fall through, so this
    // can't collapse to `??`), defaulting to the always-present tenant name.
    const name =
      [payload.propertyName, payload.businessName].map((s) => s?.trim()).find((s) => s) ??
      payload.name;
    const logoUrl = publicMediaUrl(payload.theme?.logoMediaId ?? null, tenant.slug);
    const social = (payload.socials ?? []).filter(
      (s) =>
        typeof s?.platform === 'string' && typeof s?.url === 'string' && s.url.trim().length > 0
    );
    return {
      identity: { name, tagline: '', logo: logoUrl ? { url: logoUrl, alt: name } : null },
      social,
    };
  } catch {
    return { identity: { name: 'Brand', tagline: '', logo: null }, social: [] };
  }
}

// Resolve a media asset id to a browser-usable URL for the brand board
// preview. Prefers a ~512w webp; if no transcoded variants exist (dev/local
// where no media-worker runs, or a format the worker skips such as SVG) it
// falls back to the original bytes (`original_url`, served by api-rest in local
// mode) or, for a hot-linked external asset whose key is an absolute URL
// (blueprint installs), the key itself. Returns null when the id is absent or
// the asset can't be read.
export async function resolveMediaUrl(mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null;
  try {
    const asset = await api.get<{
      variants?: AssetVariant[];
      original_url?: string | null;
      key?: string;
    }>(`/v1/media/assets/${mediaId}`);
    const variants = asset.variants ?? [];
    if (variants.length > 0) {
      const webp = variants
        .filter((v) => v.format === 'webp')
        .sort((a, b) => Math.abs(a.width - 512) - Math.abs(b.width - 512));
      return webp[0]?.url ?? variants[0]?.url ?? null;
    }
    if (asset.original_url) return asset.original_url;
    if (asset.key && /^https?:\/\//i.test(asset.key)) return asset.key;
    return null;
  } catch {
    return null;
  }
}
