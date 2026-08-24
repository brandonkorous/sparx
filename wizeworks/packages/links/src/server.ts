// Where the workbench lives, for code that writes links someone will click in
// an email — server side only.
//
// A separate entry point rather than part of the root barrel, so nothing in a
// browser bundle can reach for `process.env` by accident. In a browser the
// answer is always `window.location.origin` and never a build-time constant.
//
// WHY THIS EXISTS AT ALL. Four environment variables named the same URL —
// `SPARX_DASHBOARD_URL`, `NEXT_PUBLIC_APP_URL`, `WORKBENCH_BASE_URL`,
// `NEXT_PUBLIC_DASHBOARD_URL` — and each emitter picked one, with its own
// fallback, so which host an email pointed at depended on which service sent it.
// Only `NEXT_PUBLIC_APP_URL` was actually set in all three environments; the
// others were set in one each. `SPARX_APP_URL` is now the canonical name and is
// set everywhere, and the rest are kept as fallbacks so nothing breaks in the
// window between the config landing and the images rolling.
//
// ── AND WHY IT TAKES A BRAND (2026-08-16) ───────────────────────────────────
//
// WizeWorks runs more than one product on this platform, and a tenant belongs to
// the brand it signed up under. This file used to answer with ONE origin and a
// literal `https://app.sparx.works` fallback, so every absolute link the platform
// built for a Piggles tenant — team invitations above all — pointed a Piggles
// customer at sparx. A link is not a cosmetic detail; it is where a person ends
// up.
//
// There is no brand conditional here and there is no hostname literal. The
// variable NAME is derived from the brand key (`PIGGLES_APP_URL`), so adding a
// third brand is configuration, not an edit to this file. If a brand's origin is
// unconfigured in production this THROWS rather than guessing: a guess mails
// somebody another company's URL, and the whole point of the file is that the
// answer is right or absent.

import { buildPath } from './resolve';
import type { LinkOptions } from './types';

/**
 * The brand assumed when a caller has no tenant to ask.
 *
 * Matches the `tenants.platform_brand` column default, which is what every
 * tenant provisioned before the second brand existed carries.
 */
export const DEFAULT_BRAND = 'sparx';

/**
 * Legacy, brand-UNSCOPED names, read only after the scoped one misses.
 *
 * They predate the second brand and name a single origin, so they are correct in
 * a process serving one brand and ambiguous in one serving two. The scoped name
 * always wins, which is what makes them safe to keep: nothing breaks in the
 * window between this landing and every environment growing a `<BRAND>_APP_URL`.
 */
const LEGACY_ORIGIN_VARS = [
  'SPARX_APP_URL',
  'SPARX_DASHBOARD_URL',
  'NEXT_PUBLIC_APP_URL',
  'WORKBENCH_BASE_URL',
  'NEXT_PUBLIC_DASHBOARD_URL',
] as const;

/**
 * Localhost ports, for a laptop where nothing is configured.
 *
 * DEV ONLY, and that is the whole reason a map of literals is acceptable here: a
 * loopback port cannot reach a customer, cannot appear in an email anybody
 * receives, and cannot leak one brand's host into another's product. Production
 * has no such table — see `appOrigin`.
 */
const DEV_PORTS: Readonly<Record<string, number>> = { sparx: 3011, piggles: 3022 };

/** `PIGGLES_APP_URL` from `piggles`. Derived, so this file names no brand. */
function scopedVarName(brand: string): string {
  return `${brand
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')}_APP_URL`;
}

function readEnv(name: string): string | null {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim().replace(/\/$/, '') : null;
}

/**
 * The origin of a brand's operating console, with no trailing slash.
 *
 * Pass the tenant's `platformBrand` wherever one is in reach. A caller with no
 * tenant — a signup flow, a platform-wide notice — gets the default brand, which
 * is the same answer this function has always given.
 */
export function appOrigin(brand: string = DEFAULT_BRAND): string {
  const key = brand.trim().toLowerCase() || DEFAULT_BRAND;
  if (typeof process === 'undefined') {
    throw new Error(`appOrigin(${key}) called with no process environment — server only.`);
  }

  const scoped = readEnv(scopedVarName(key));
  if (scoped) return scoped;

  for (const name of LEGACY_ORIGIN_VARS) {
    const value = readEnv(name);
    if (value) return value;
  }

  // Nothing configured. On a laptop that is normal; in production it is a
  // misconfiguration, and a rollout must fail on it rather than quietly mail
  // every customer a link to whichever brand this file happened to name.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `No origin configured for brand "${key}". Set ${scopedVarName(key)} on this deployment.`
    );
  }
  const port = DEV_PORTS[key];
  if (port === undefined) {
    throw new Error(
      `No dev origin known for brand "${key}". Set ${scopedVarName(key)}, or add its localhost port to DEV_PORTS in @wizeworks/links/server.`
    );
  }
  return `http://localhost:${port}`;
}

/**
 * Where a brand's people AUTHENTICATE — sign in, sign up, accept an invitation,
 * approve an OAuth consent.
 *
 * For sparx this is the same host as the console: the workbench mounts Better
 * Auth and carries `/sign-in` itself, so the fallback below is `appOrigin` and
 * nothing needs configuring. For Piggles it is a DIFFERENT registrable domain —
 * getpiggles.com is the auth authority and mypiggles.com deliberately has no
 * sign-in page at all — so an auth link built against `appOrigin` lands on a
 * route that does not exist and never will.
 *
 * That is the whole reason this is a separate function rather than a second
 * lookup inside `appOrigin`. "Where you work" and "where you prove who you are"
 * are the same place in one product and not in the other, and code that assumes
 * they are the same is code that breaks for exactly one brand.
 */
export function accountOrigin(brand: string = DEFAULT_BRAND): string {
  const key = brand.trim().toLowerCase() || DEFAULT_BRAND;
  if (typeof process === 'undefined') {
    throw new Error(`accountOrigin(${key}) called with no process environment — server only.`);
  }
  const scoped = readEnv(`${key.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_ACCOUNT_URL`);
  if (scoped) return scoped;
  // Unconfigured means "auth lives in the console", which is true for every
  // brand that has not split the two apart. Piggles configures it; sparx does
  // not need to.
  return appOrigin(key);
}

/**
 * Legacy, brand-UNSCOPED name for the MCP resource identifier.
 *
 * Read only after the scoped one misses, for the same reason as
 * `LEGACY_ORIGIN_VARS`: it predates the second brand and names a single
 * address, so it is correct in a platform serving one brand and wrong for
 * exactly one brand in a platform serving two.
 */
const LEGACY_MCP_VAR = 'MCP_RESOURCE_URL';

/**
 * The dev address of the MCP server, shared by every brand.
 *
 * DEV ONLY, and acceptable as a literal for the same reason as `DEV_PORTS`: one
 * api-mcp process listens on a laptop, no customer can reach a loopback address,
 * and a loopback address carries no brand to leak. Production has no such
 * constant — see `mcpResourceUrl`.
 */
const DEV_MCP_URL = 'http://localhost:3000/mcp';

/** `PIGGLES_MCP_URL` from `piggles`. Derived, so this file names no brand. */
function mcpVarName(brand: string): string {
  return `${brand
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')}_MCP_URL`;
}

/**
 * A brand's MCP server, as its canonical OAuth resource identifier — origin AND
 * path, because that is what the protocol compares.
 *
 * ── WHY THIS IS PER BRAND AND NOT ONE PLATFORM ADDRESS ──────────────────────
 *
 * This is the single most VISIBLE address the platform owns. A customer does not
 * merely receive it in a link they may or may not look at — the console tells
 * them to copy it and paste it into Claude or ChatGPT by hand, and then their AI
 * client shows it back to them on every reconnection. One shared value meant a
 * Piggles customer was told, in the Piggles console, to hand another company's
 * hostname to their assistant. Same failure `api.mypiggles.com` was created to
 * close, on the one address that gets read aloud.
 *
 * It is not only a label. The document served at this origin names the
 * AUTHORIZATION SERVER a client must go to (RFC 9728), and discovery happens
 * BEFORE any token exists — so there is no tenant to ask and the hostname is the
 * only thing carrying the brand. With one address there was one answer, and it
 * sent a Piggles customer to app.sparx.works to sign in and approve access to
 * their own business, on a sparx consent screen, while getpiggles.com — the only
 * place Piggles mounts Better Auth — served a consent route nothing ever reached.
 *
 * There is no brand conditional here and no hostname literal: the variable name
 * is derived from the brand key, so a third brand is configuration. Unconfigured
 * in production THROWS, matching `appOrigin` — an address a customer is told to
 * paste into an AI client must be right or absent, never guessed.
 */
export function mcpResourceUrl(brand: string = DEFAULT_BRAND): string {
  const key = brand.trim().toLowerCase() || DEFAULT_BRAND;
  if (typeof process === 'undefined') {
    throw new Error(`mcpResourceUrl(${key}) called with no process environment — server only.`);
  }

  const scoped = readEnv(mcpVarName(key));
  if (scoped) return scoped;

  const legacy = readEnv(LEGACY_MCP_VAR);
  if (legacy) return legacy;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `No MCP address configured for brand "${key}". Set ${mcpVarName(key)} on this deployment.`
    );
  }
  return DEV_MCP_URL;
}

/**
 * The authorization server an MCP client is sent to for a brand — the origin
 * advertised in that brand's protected-resource metadata.
 *
 * It is `accountOrigin` and deliberately nothing of its own: "approve an OAuth
 * consent" is already in that function's job description, and the place a brand
 * mounts Better Auth is the only place its consent screen can exist. A separate
 * lookup here would be a second answer to a settled question, free to drift.
 */
export function mcpAuthServerOrigin(brand: string = DEFAULT_BRAND): string {
  return accountOrigin(brand);
}

/**
 * An absolute link to a surface, resolved against the brand's origin.
 *
 * This is what a service calls. It never takes a surface key from a caller's
 * imagination — `buildPath` returns null for a surface that is not in the table,
 * and null for a detail address with no record, so a link is either right or
 * absent. Absent is recoverable (the email says what happened without a button);
 * a link to `/undefined` is not.
 *
 * `brand` is the tenant's `platformBrand`. Pass it whenever a tenant is in
 * reach — a link in an email is read by that tenant's people, on that tenant's
 * product, and getting it wrong sends them to a different company.
 */
export function appLink(
  surface: string,
  params?: Readonly<Record<string, string | undefined>>,
  options?: Omit<LinkOptions, 'origin'> & { brand?: string }
): string | null {
  const { brand, ...rest } = options ?? {};
  return buildPath(surface, params, { ...rest, origin: appOrigin(brand) });
}
