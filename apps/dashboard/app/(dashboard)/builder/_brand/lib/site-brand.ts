// Full per-site brand (docs/49) — the helpers that turn the tenant BASE brand +
// a site's OVERRIDE into the effective brand the Builder authors, and back.
//
// Model: the Builder authors ONE active site. The PRIMARY site edits the tenant
// base brand directly; a NON-PRIMARY site stores a partial `brandOverride` (null
// fields inherit the base). The Brand page shows the EFFECTIVE brand either way;
// on save, a non-primary site's edits are diffed back into an override so only
// what differs from the base is stored (and re-inherits when set back to base).
//
// Pure (no server-only imports) so both the server loader and the client editor
// share it.

import type { BrandDto } from './types';

// The brand-identity fields the Brand page edits per-site (everything except the
// deprecated `businessName` name source — the site name is Property.name).
export const SITE_BRAND_FIELDS = [
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

type ScalarBrandField = (typeof SITE_BRAND_FIELDS)[number];

/** A stored per-site override (a partial brand; null/absent = inherit). `tokens`
 *  is the opaque shape/rhythm/effect doc, merged whole. */
export type BrandOverride = Partial<Record<ScalarBrandField, string | null>> & {
  tokens?: BrandDto['tokens'];
};

function coerceOverride(raw: unknown): BrandOverride | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // Every BrandOverride field is optional, so a plain object satisfies it without
  // an assertion (downstream reads are individually typed/defaulted).
  return raw;
}

/** Apply a site's override over the tenant base brand, field-by-field (null/
 *  absent = inherit). Returns the EFFECTIVE brand the Brand page renders. For a
 *  primary site pass `null` → the base brand unchanged. `logoMediaId` (legacy
 *  single-logo override) maps to the light logo. */
export function applyBrandOverride(base: BrandDto, overrideRaw: unknown): BrandDto {
  const override = coerceOverride(overrideRaw);
  if (!override) return base;
  const legacyLight =
    override.logoLightMediaId ?? (override as { logoMediaId?: string | null }).logoMediaId;
  const pick = (k: ScalarBrandField): string | null => override[k] ?? base[k] ?? null;
  return {
    ...base,
    tagline: pick('tagline'),
    logoLightMediaId: legacyLight ?? base.logoLightMediaId ?? null,
    logoDarkMediaId: pick('logoDarkMediaId'),
    faviconMediaId: pick('faviconMediaId'),
    colorPrimary: pick('colorPrimary'),
    colorPrimaryForeground: pick('colorPrimaryForeground'),
    colorSecondary: pick('colorSecondary'),
    colorSecondaryForeground: pick('colorSecondaryForeground'),
    colorAccent: pick('colorAccent'),
    colorAccentForeground: pick('colorAccentForeground'),
    fontHeading: pick('fontHeading'),
    fontBody: pick('fontBody'),
    tokens: override.tokens ?? base.tokens,
  };
}

/** Diff the current (effective) brand fields against the tenant base into an
 *  override: a field equal to the base inherits (null); a field that differs is
 *  stored. Returns null when nothing differs (clear the override → full inherit).
 *  Used by a non-primary site's autosave. */
export function computeBrandOverride(current: BrandDto, base: BrandDto): BrandOverride | null {
  const override: BrandOverride = {};
  let any = false;
  for (const f of SITE_BRAND_FIELDS) {
    const cur = current[f] ?? null;
    const baseVal = base[f] ?? null;
    if (cur !== baseVal) {
      override[f] = cur;
      any = true;
    }
  }
  // tokens — compare structurally (a small JSON doc).
  const curTokens = current.tokens ?? null;
  const baseTokens = base.tokens ?? null;
  if (JSON.stringify(curTokens) !== JSON.stringify(baseTokens)) {
    override.tokens = curTokens;
    any = true;
  }
  return any ? override : null;
}
