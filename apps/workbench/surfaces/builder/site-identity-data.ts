'use client';

// Site identity data — the active web property's customer-facing brand (docs/49
// per-site brand), and the one save that persists it.
//
// The model, in full, because getting it wrong shows the wrong business's name
// under the wrong site:
//
//   · The tenant has ONE base brand (`/v1/brand`) — the identity every site
//     inherits by default: tagline, light/dark logo, favicon (plus colours and
//     fonts, which the visual editor owns, not this surface).
//   · Each site is a Property. Its customer-facing NAME (`Property.name`) and its
//     own SOCIAL links live on the property, never on the tenant brand.
//   · The PRIMARY site edits the tenant base brand directly. A NON-PRIMARY site
//     stores a partial `brandOverride` — a field that differs from the base is
//     kept, a field equal to the base inherits (so leaving a logo blank re-uses
//     the main site's). Switching the active site swaps the whole identity.
//
// So there is no per-site brand row: the effective brand a non-primary site shows
// is `base + override`, computed here, and a save diffs the edited identity back
// into an override so only what differs is stored.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import { useSite, type Site } from '../sites/data';

/** A social link as the property stores it (settings.socials) and as api-rest
 *  validates it: a platform key/label and a URL. */
export interface SocialLink {
  platform: string;
  url: string;
}

/** The tenant base brand (`/v1/brand`). Only the identity fields this surface
 *  reads or preserves — colours/fonts/tokens are carried through untouched so a
 *  non-primary site's theme override survives an identity save. */
export interface Brand {
  tenantId: string;
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

/** The base brand. Tenant-level and ungated (like `/v1/tenant`), read regardless
 *  of which site is active — the override is applied on top of it client-side. */
export function useBrand() {
  return useQuery({
    queryKey: ['brand'],
    queryFn: () => api.get<Brand>('/v1/brand'),
    staleTime: 300_000,
  });
}

/** The active site's full property row — carries the name, `isPrimary`, its
 *  `settings.socials`, and its `brandOverride`. Reuses the sites data layer so
 *  a rename here reaches the toolbar switcher through the same `['properties']`
 *  key. */
export function useSiteProperty(propertyId: string | undefined) {
  return useSite(propertyId ?? 'new');
}

/** Read a property's own social links out of its settings bag. Defensive — the
 *  column is free-form JSON. */
export function socialsOf(property: Site | undefined): SocialLink[] {
  const raw = (property?.settings as { socials?: unknown } | undefined)?.socials;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is SocialLink =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as SocialLink).platform === 'string' &&
        typeof (s as SocialLink).url === 'string'
    )
    .map((s) => ({ platform: s.platform, url: s.url }));
}

/* ── Per-site brand override (docs/49 §3) ──────────────────────────────────── */

/** The brand identity fields a site can override, diffed against the base. Colour
 *  and font fields are here so an existing theme override is preserved when the
 *  effective brand (which already carries it) is diffed back. */
const OVERRIDE_FIELDS = [
  'tagline',
  'logoLightMediaId',
  'logoDarkMediaId',
  'faviconMediaId',
  'colorPrimary',
  'colorPrimaryForeground',
  'colorSecondary',
  'colorSecondaryForeground',
  'colorAccent',
  'colorAccentForeground',
  'fontHeading',
  'fontBody',
] as const;

type OverrideField = (typeof OVERRIDE_FIELDS)[number];

/** The identity slice this surface actually edits — folded onto the effective
 *  brand before diffing so untouched colour/font overrides ride through. */
export interface IdentityFields {
  tagline: string | null;
  logoLightMediaId: string | null;
  logoDarkMediaId: string | null;
  faviconMediaId: string | null;
}

/** The effective brand a site renders: the base for a primary site, else the base
 *  with the site's stored override applied field-by-field (null/absent inherits).
 *  `logoMediaId` is the legacy single-logo override, mapped to the light logo. */
export function effectiveBrand(base: Brand, override: Record<string, unknown> | null): Brand {
  if (!override) return base;
  const get = (k: OverrideField): string | null => {
    const v = override[k];
    return typeof v === 'string' && v !== '' ? v : (base[k] ?? null);
  };
  const legacyLight =
    typeof override.logoLightMediaId === 'string' && override.logoLightMediaId !== ''
      ? override.logoLightMediaId
      : typeof override.logoMediaId === 'string' && override.logoMediaId !== ''
        ? override.logoMediaId
        : (base.logoLightMediaId ?? null);
  return {
    ...base,
    tagline: get('tagline'),
    logoLightMediaId: legacyLight,
    logoDarkMediaId: get('logoDarkMediaId'),
    faviconMediaId: get('faviconMediaId'),
    colorPrimary: get('colorPrimary'),
    colorPrimaryForeground: get('colorPrimaryForeground'),
    colorSecondary: get('colorSecondary'),
    colorSecondaryForeground: get('colorSecondaryForeground'),
    colorAccent: get('colorAccent'),
    colorAccentForeground: get('colorAccentForeground'),
    fontHeading: get('fontHeading'),
    fontBody: get('fontBody'),
    tokens: override.tokens ?? base.tokens,
  };
}

/**
 * Diff the site's edited identity (folded onto its effective brand) against the
 * tenant base into an override to store on the property.
 *
 * A field equal to the base inherits (dropped); a field that differs is kept.
 * The existing override's NON-identity keys (per-site presentation, commerce
 * gating, currency — set elsewhere in Settings) are carried through untouched, so
 * saving identity here never wipes them. The legacy `logoMediaId` is dropped: we
 * always write the explicit `logoLightMediaId` now. Returns null when nothing
 * differs, which clears the override to full inheritance.
 */
export function computeOverride(
  current: Brand,
  base: Brand,
  existing: Record<string, unknown> | null
): Record<string, unknown> | null {
  // Start from everything the stored override held EXCEPT the fields we manage,
  // so unrelated per-site settings survive this write.
  const managed = new Set<string>([...OVERRIDE_FIELDS, 'tokens', 'logoMediaId']);
  const override: Record<string, unknown> = {};
  if (existing) {
    for (const [key, value] of Object.entries(existing)) {
      if (!managed.has(key) && value != null && value !== '') override[key] = value;
    }
  }

  for (const field of OVERRIDE_FIELDS) {
    const cur = current[field] ?? null;
    const baseVal = base[field] ?? null;
    if (cur !== baseVal && cur != null) override[field] = cur;
  }
  const curTokens = current.tokens ?? null;
  const baseTokens = base.tokens ?? null;
  if (JSON.stringify(curTokens) !== JSON.stringify(baseTokens) && curTokens != null) {
    override.tokens = curTokens;
  }

  return Object.keys(override).length > 0 ? override : null;
}

/* ── The save ──────────────────────────────────────────────────────────────── */

/** Everything one save needs. `effective` and `base` drive the override diff;
 *  `existingOverride` preserves unrelated per-site settings. */
export interface SaveIdentityInput {
  propertyId: string;
  name: string;
  socials: SocialLink[];
  identity: IdentityFields;
  effective: Brand;
  base: Brand;
  existingOverride: Record<string, unknown> | null;
}

/**
 * Persist the active site's identity in one action: ONE property write
 * (`PATCH /v1/properties/:id`) carrying the customer-facing name, the social
 * links, AND the diffed `brandOverride` — so nothing ever touches the tenant base.
 *
 * The primary site used to take a different path, writing its identity images and
 * tagline to the tenant base brand via `PATCH /v1/brand`. The tenant base is the
 * default every UNBRANDED site inherits, so branding the primary rebranded every
 * sibling that had not overridden that field — a logo attached to one site
 * appearing on another. Every site now stores its own identity on its own row.
 */
export function useSaveIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveIdentityInput) => {
      const cleanSocials = input.socials
        .map((s) => ({ platform: s.platform.trim(), url: s.url.trim() }))
        .filter((s) => s.platform && s.url);
      const trimmedName = input.name.trim();
      const name = trimmedName === '' ? undefined : trimmedName;

      const trimmedTagline = input.identity.tagline?.trim() ?? '';
      const identityBrand = {
        tagline: trimmedTagline === '' ? null : trimmedTagline,
        logoLightMediaId: input.identity.logoLightMediaId,
        logoDarkMediaId: input.identity.logoDarkMediaId,
        faviconMediaId: input.identity.faviconMediaId,
      };

      const current: Brand = { ...input.effective, ...identityBrand };
      const brandOverride = computeOverride(current, input.base, input.existingOverride);
      await api.patch(`/v1/properties/${input.propertyId}`, {
        name,
        socials: cleanSocials,
        brandOverride,
      });
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ['brand'] });
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
      void queryClient.invalidateQueries({ queryKey: ['properties', input.propertyId] });
    },
  });
}

/** api-rest returns a plain-language sentence for a 4xx (a name too long, a bad
 *  URL). Show it verbatim; fall back to the caller's wording for a 5xx that has
 *  no such sentence. */
export function saveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
