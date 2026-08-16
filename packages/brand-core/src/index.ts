// @wizeworks/brand-core — who the platform is talking as.
//
// WizeWorks runs more than one product on one platform, and a tenant belongs to
// the brand it signed up under (`tenants.platform_brand`). Shared code that
// writes to a customer — an email worker, a support reply, a receipt — therefore
// has to know which product's voice it is speaking in. Before this existed it
// did not, and it guessed: a Piggles customer got platform email signed "sparx
// Support", rendered under the wordmark "sparx".
//
// ── WHY THE VALUES ARE CONFIGURATION AND NOT CODE ───────────────────────────
//
// wizeworks/CLAUDE.md draws the line as: this layer owns EXISTENCE, each brand
// owns VALUES. That is easy to satisfy in the UI, where a brand's own package
// supplies its tokens — and impossible to satisfy the same way here, because the
// consumers are shared workers that may not import `@sparx/*` or `@piggles/*` at
// all (RULE #0). A worker draining one queue renders for both brands.
//
// So the values arrive as CONFIGURATION, keyed by brand, with the variable name
// DERIVED from the brand key. This file names no brand and holds no brand's
// value; adding a third is setting three environment variables. Same shape as
// `appOrigin()` in @sparx/links/server, and for the same reason.
//
// ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
//
// The email FALLBACK PALETTE — the colours a platform email uses when a tenant
// has supplied no identity of its own. Those still come from `@sparx/email`'s
// `defaultBrand`, and they are the one remaining place a platform send carries
// one brand's values. That is a design decision (what SHOULD a brand-neutral
// platform email look like?) rather than a bug, so it is recorded in
// piggles/docs/migration rather than quietly changed here. The NAME on that
// email is a bug, and this file fixes it.

/** The brand every tenant provisioned before the second brand existed carries,
 *  and the `tenants.platform_brand` column's own default. */
export const DEFAULT_PLATFORM_BRAND = 'sparx';

export interface PlatformBrandIdentity {
  /** The `platform_brand` key itself, normalised. */
  key: string;
  /**
   * The product's name as a person reads it.
   *
   * Case matters and is not derivable: sparx is deliberately lowercase, Piggles
   * is deliberately capitalised. So this is configured, never computed from the
   * key by a `capitalize()` that would get one of them wrong.
   */
  name: string;
  /** Who a support reply appears to come from. */
  supportName: string;
  /**
   * Where a customer can write back, or null when the brand has not published
   * one. Null is honest and renders nothing; an invented address bounces, which
   * is worse than an absent one.
   */
  supportEmail: string | null;
}

/** `PIGGLES_BRAND_NAME` from (`piggles`, `BRAND_NAME`). */
function varName(key: string, suffix: string): string {
  return `${key
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')}_${suffix}`;
}

function readEnv(name: string): string | null {
  if (typeof process === 'undefined') return null;
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function normalizeBrandKey(brand: string | null | undefined): string {
  return (brand ?? '').trim().toLowerCase() || DEFAULT_PLATFORM_BRAND;
}

/**
 * The identity to speak as, for one brand.
 *
 * Never throws. A missing name falls back to the KEY, which is right for the
 * default brand (whose key really is its lowercase name) and is at worst
 * unstyled for a brand nobody has configured — and "piggles" reaching a customer
 * is a cosmetic miss, where "sparx" reaching that same customer is the wrong
 * company. Failing loudly is the correct posture for a LINK, which is why
 * `appOrigin` throws; it is the wrong posture for a display name, where the
 * consequence of the fallback is small and the consequence of a thrown email
 * worker is a queue that stops.
 */
export function platformBrandIdentity(brand?: string | null): PlatformBrandIdentity {
  const key = normalizeBrandKey(brand);
  const name = readEnv(varName(key, 'BRAND_NAME')) ?? key;
  return {
    key,
    name,
    supportName: readEnv(varName(key, 'SUPPORT_NAME')) ?? `${name} Support`,
    supportEmail: readEnv(varName(key, 'SUPPORT_EMAIL')),
  };
}
