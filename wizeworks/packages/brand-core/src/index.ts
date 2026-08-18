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
// `appOrigin()` in @wizeworks/links/server, and for the same reason.
//
// ── THE EMAIL PALETTE IS NEXT DOOR ──────────────────────────────────────────
//
// The colors a platform email paints itself in were the other half of this
// problem, and for a while they were deliberately left out of this file as "a
// design decision rather than a bug". They are now in `./email-palette.ts`,
// resolved the same way and for the same reason — see that file's header for the
// decision that closed it (piggles/docs/migration B5.1).

export {
  PLAIN_EMAIL_PALETTE,
  resolveEmailPalette,
  type EmailPalette,
  type EmailPaletteInput,
  type ResolvedEmailPalette,
} from './email-palette';

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
  /**
   * The brand's public home, for the legal line at the foot of a platform
   * email. Not `appOrigin` — that is where a signed-in person works, and the
   * two are different hosts for a brand whose console has no front door.
   */
  siteUrl: string | null;
  /**
   * The `From` a platform send is addressed from, envelope name included
   * (`Piggles <noreply@…>`).
   *
   * Null when the brand has published no sending identity, and the caller then
   * decides — an email worker keeps the platform default address and corrects
   * only the display NAME, because the address has to resolve to a domain the
   * provider is authorised to send for and a name does not.
   */
  fromEmail: string | null;
  /**
   * How many TRAILING characters of `name` wear the accent color where the
   * name is set as a wordmark (the masthead of a platform email).
   *
   * sparx sets 1 — "spar" in the masthead ink, an Ember "x". That flourish was
   * hardcoded as literal JSX, which is how a Piggles owner's password-reset
   * email came to carry another company's wordmark at the top of it.
   *
   * Default 0: a brand that has not said otherwise gets its name set plainly,
   * which is right for every name whose last letter means nothing in
   * particular. Configuration rather than a lookup, so this file still names
   * no brand.
   */
  accentChars: number;
  /**
   * Where a billing question goes — the masthead meta on a receipt, and the
   * "reach us at …" line under it.
   *
   * Falls back to `supportEmail`, because a brand with one inbox has one
   * inbox and being told to write to a `billing@` address that does not exist
   * is worse than being told to write to the one that does. Null when the
   * brand has published neither, and then the line is omitted rather than
   * invented.
   */
  billingEmail: string | null;
  /**
   * The zone a tenant of this brand gets its free subdomain in —
   * `<slug>.piggles.site` rather than `<slug>.sparx.zone`.
   *
   * Null when the brand has published none, and the caller then falls back to
   * the deployment's default zone. `provisionTenant` still takes the zone as
   * an explicit parameter; this is what a caller that HAS a brand but no zone
   * argument should be reaching for.
   */
  zoneDomain: string | null;
  /**
   * The brand's accent, as a literal hex.
   *
   * A hex in configuration rather than a token, deliberately: the one consumer
   * is the attribution badge on a TENANT's public site, which must be immune to
   * the tenant's own CSS and therefore inlines every value it paints. A token
   * would resolve against the tenant's theme and the badge would change colour
   * from one site to the next.
   *
   * Null when the brand has published none — the badge then sets its name in one
   * weight rather than inventing a colour.
   */
  accentHex: string | null;
  /**
   * Where the attribution badge links. Configured rather than derived from
   * `siteUrl`, because it carries campaign parameters and guessing at somebody's
   * analytics scheme is worse than linking to the bare home.
   */
  creditUrl: string | null;
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
 * Which brand THIS PROCESS is, from `PLATFORM_BRAND`.
 *
 * ── WHEN THIS IS THE RIGHT QUESTION, AND WHEN IT IS THE WRONG ONE ───────────
 *
 * Right for a **single-brand app process**: each brand's account app is its own
 * deployment mounting its own Better Auth handler, so a signup arriving there
 * belongs to that brand by construction, and there is nothing else to ask. This
 * is how a Google signup learns which brand it is — the OAuth hook has a user
 * and no tenant yet, so the tenant's own column does not exist to read.
 *
 * WRONG for a **shared process**. api-rest and the event workers serve every
 * brand from one container, and there this returns whatever the deployment was
 * labelled — one answer to a question that has a different answer per request.
 * Those read `tenants.platform_brand` instead. Getting this backwards would
 * stamp one brand's identity onto the other's mail, which is the exact failure
 * this package was written for.
 *
 * Unset → the default brand, which is correct for every deployment that existed
 * before there was a second one.
 */
export function currentPlatformBrand(): string {
  return normalizeBrandKey(readEnv('PLATFORM_BRAND'));
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
  const supportEmail = readEnv(varName(key, 'SUPPORT_EMAIL'));
  return {
    key,
    name,
    supportName: readEnv(varName(key, 'SUPPORT_NAME')) ?? `${name} Support`,
    supportEmail,
    billingEmail: readEnv(varName(key, 'BILLING_EMAIL')) ?? supportEmail,
    zoneDomain: readEnv(varName(key, 'ZONE_DOMAIN')),
    accentHex: readEnv(varName(key, 'BRAND_ACCENT')),
    creditUrl: readEnv(varName(key, 'CREDIT_URL')),
    siteUrl: readEnv(varName(key, 'BRAND_URL')),
    fromEmail: readEnv(varName(key, 'EMAIL_FROM')),
    accentChars: readAccentChars(varName(key, 'BRAND_ACCENT_CHARS'), name),
  };
}

/** Clamped to the name, so a stale value can never slice past its end. */
function readAccentChars(name: string, brandName: string): number {
  const parsed = Number.parseInt(readEnv(name) ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, brandName.length);
}

/**
 * The display name to put in front of a sending address the brand does not own.
 *
 * Both brands send through one Mailgun domain, so a Piggles tenant's mail leaves
 * from a sparx address and will until Piggles has DNS of its own. The address is
 * a deliverability fact and cannot be rewritten from configuration; the NAME
 * beside it is presentation and can. `sparx <noreply@sparx.email>` reaching a
 * Piggles customer names the wrong company twice — this fixes the half that is
 * safe to fix, and leaves the half that is not visible in the address bar of
 * approximately nobody's mail client.
 *
 * Returns `fromEmail` verbatim when the brand HAS published one, since a brand
 * with its own sending domain needs no correction.
 */
export function platformFrom(identity: PlatformBrandIdentity, fallbackFrom: string): string {
  if (identity.fromEmail) return identity.fromEmail;
  const address = /<([^>]+)>/.exec(fallbackFrom)?.[1] ?? fallbackFrom.trim();
  return `${identity.name} <${address}>`;
}
