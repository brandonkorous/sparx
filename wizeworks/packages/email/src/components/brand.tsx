import * as React from 'react';
import {
  currentPlatformBrand,
  platformBrandIdentity,
  resolveEmailPalette,
  PLAIN_EMAIL_PALETTE,
  type EmailPalette,
} from '@wizeworks/brand-core';
import { fontFamily } from './tokens';

// Per-tenant brand for email rendering.
//
// Mail clients strip <style> blocks and don't honour CSS custom properties, so
// brand values must be concrete and inlined on each element. Rather than thread
// a `brand` prop through every template + atom, we put the resolved brand on a
// React context: `renderTemplate` wraps the tree in <BrandProvider brand={…}>
// and every atom reads it via `useBrand()`. With no provider, atoms fall back to
// `defaultBrand` — which is now brand-BLIND (see its own note below; it used to
// be sparx's chrome, which is how one product's colors reached the other's mail).
//
// The brand is resolved per tenant by @wizeworks/email-platform's brand-service
// (site theme tokens → settings override → the platform fallback), light palette
// only (email-client dark mode is unreliable).
//
// THREE THINGS ARE RESOLVED HERE, and they answer different questions:
//   useBrand()    — whose SHOP this is on behalf of (the tenant)
//   usePlatform() — which PRODUCT is sending (sparx / Piggles): name, url, links
//   usePalette()  — what that product's email is PAINTED in

/** The brand's DARK-theme surfaces — the SAME dark palette the tenant's SITE uses
 *  (resolved from `@wizeworks/site-themes`' dark tokens). When a brand carries this, the
 *  send emits an `@media (prefers-color-scheme: dark)` block that remaps the light
 *  neutrals to these values, so a dark-mode client (Apple Mail / iOS Mail / Outlook
 *  for Mac) renders the email in the same dark theme as the site rather than the light
 *  design on a dark screen. Neutrals are required; brand hues are optional — omit
 *  `primary`/`accent`/`primaryForeground` and they stay their light value (unmapped),
 *  which is right when the brand doesn't shift its hue for dark. Gmail / Outlook.com
 *  ignore all of this and force-invert on their own terms — dark mode is progressive
 *  enhancement, never a design to rely on. */
export interface BrandDark {
  /** Content surface (the inner card) in dark. */
  background: string;
  /** Body + heading text in dark. */
  foreground: string;
  /** Page background + subtle fills in dark. */
  muted: string;
  /** Hairlines / dividers / borders in dark. */
  border: string;
  /** Filled-button / brand-bar hue in dark (omit → same as light). */
  primary?: string;
  /** Text on top of `primary` in dark (omit → same as light). */
  primaryForeground?: string;
  /** Link / secondary accent in dark (omit → same as light). */
  accent?: string;
}

export interface BrandTokens {
  /** Filled-button / link / wordmark accent. */
  primary: string;
  /** Text/icon color on top of `primary`. */
  primaryForeground: string;
  /** Secondary accent (used for links when distinct from primary). */
  accent: string;
  /** Card/content surface — the inner container background. */
  background: string;
  /** Body + heading text color. */
  foreground: string;
  /** Page background behind the card + subtle fills. */
  muted: string;
  /** Hairlines + dividers + card border. */
  border: string;
  /** The brand's dark-theme surfaces (see `BrandDark`). Absent → light-only: the send
   *  emits no dark-mode CSS and the email renders its light design everywhere. */
  dark?: BrandDark;
  /** CSS font-family stack for headings (name + web-safe fallback). */
  fontHeading: string;
  /** CSS font-family stack for body copy. */
  fontBody: string;
  /** Absolute logo URL; when present the wordmark renders the image. */
  logoUrl?: string;
  /** Store name — wordmark fallback + footer. */
  siteName?: string;
  /**
   * True when `siteName` is the PLATFORM's own name rather than one the tenant
   * chose — i.e. this send found no tenant identity and fell back.
   *
   * The wordmark needs the distinction and cannot infer it: it used to ask
   * `siteName !== 'sparx'`, which hardcoded one brand as the meaning of
   * "unbranded" and put that brand's name on the other brand's email. Whoever
   * builds the fallback knows the answer; nobody downstream can work it out.
   */
  siteNameIsPlatformDefault?: boolean;
  /**
   * WHICH PRODUCT is sending, as distinct from which shop the mail is on behalf
   * of. Every field above describes the TENANT; this one describes us.
   *
   * The footer's legal line needs it and cannot get it from anything else: a
   * fully-branded Piggles shop, with its own logo and palette and nothing
   * defaulted, still had "WizeWorks · sparx.works" under it — because the
   * tenant's identity was never the thing that line was stating. Set by whoever
   * resolves the send (email-worker), from `tenants.platform_brand`.
   */
  platform?: {
    /** The product's name, as `@wizeworks/brand-core` resolves it. */
    name: string;
    /** Its public home, or null when the brand has published none. */
    url: string | null;
    /** Trailing characters of `name` set in the accent color where the name is
     *  used as a wordmark. 0 / absent → the name is set plainly. */
    accentChars?: number;
    /** Where a billing question goes. Null/absent → the line is omitted, which
     *  is the honest rendering for a brand that has published no address. */
    billingEmail?: string | null;
    /** The console origin — where a "manage your plan" link in a platform email
     *  has to land. Distinct from `url`, which is the marketing site: for a brand
     *  whose console is a separate host, linking to `url/settings/billing` is a
     *  404. Resolved by the sender via `appOrigin(brand)`. */
    appUrl?: string | null;
    /**
     * The colors this brand's platform email paints itself in, already resolved
     * (`@wizeworks/brand-core`'s `resolveEmailPalette`).
     *
     * Absent → `PLAIN_EMAIL_PALETTE`, an achromatic ramp that belongs to no
     * brand. Deliberately not one brand's values: a default that happens to be
     * sparx's is how the masthead came to be Ember on every Piggles email, and a
     * wrong palette that renders perfectly is harder to notice than a plain one.
     */
    palette?: EmailPalette;
  };
  /** The site's social links, rendered as self-contained badges in the footer.
   *  Platform is a free string here; the footer maps it to silica's supported
   *  badge set and drops the rest. */
  socials?: { platform: string; url: string }[];
}

/**
 * The floor: what a send renders as when NOBODY has said who it is from.
 *
 * Every value here used to be sparx's — Ember as `primary`, the sparx theme's
 * dark neutrals, `siteName: 'sparx'`, and a `platform` block naming sparx's site
 * and billing address. It was defended in a comment as "the pre-multibrand
 * default, kept so a send that names no brand renders exactly as it always has",
 * and that is exactly the shape of this bug: one brand's values, sitting in the
 * shared platform, reached by anything that failed to override them. A default
 * that happens to be a brand is a leak with a justification attached.
 *
 * So the colors come from `PLAIN_EMAIL_PALETTE` — achromatic, legible, nobody's.
 * A real send never sees them: `email-worker` resolves the tenant's brand and
 * overrides every one (`platformFallbackBrand`). What reaches this floor is a
 * send with no brand and no overlay at all, and the honest rendering of that is
 * an email that looks unstyled rather than one that looks like sparx.
 */
export const defaultBrand: BrandTokens = {
  primary: PLAIN_EMAIL_PALETTE.accent,
  primaryForeground: PLAIN_EMAIL_PALETTE.accentContent,
  accent: PLAIN_EMAIL_PALETTE.accent,
  background: PLAIN_EMAIL_PALETTE.paper,
  foreground: PLAIN_EMAIL_PALETTE.body,
  muted: PLAIN_EMAIL_PALETTE.canvas,
  border: PLAIN_EMAIL_PALETTE.line,
  fontHeading: fontFamily,
  fontBody: fontFamily,
  // No name, rather than a placeholder one. The flag is what tells the wordmark
  // and the footer to sign with the PLATFORM's name instead of a shop's — and
  // seeding a brand name here is how "sparx" came to be signed on Piggles mail.
  siteName: undefined,
  siteNameIsPlatformDefault: true,
  // `platform` is deliberately absent. `usePlatform()` resolves it from the
  // process's own `PLATFORM_BRAND` instead, which is a real answer for a
  // single-brand app process and a documented non-answer for a shared one —
  // where the overlay always wins anyway.
  //
  // `dark` is absent for the same reason the palette has no dark half: a brand's
  // dark surfaces are a second set of decisions nobody has published, and an
  // unbranded send is light-only rather than wearing another product's night.
};

const BrandContext = React.createContext<BrandTokens>(defaultBrand);

export function BrandProvider({
  brand,
  children,
}: {
  brand?: Partial<BrandTokens>;
  children: React.ReactNode;
}) {
  // Merge over defaults so a partial brand (e.g. only a primary color) still
  // produces a complete, renderable token set.
  const value = React.useMemo<BrandTokens>(() => ({ ...defaultBrand, ...brand }), [brand]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandTokens {
  return React.useContext(BrandContext);
}

/** Required-shape `platform` — who the email is FROM, as opposed to on behalf of. */
export type PlatformIdentity = NonNullable<BrandTokens['platform']>;

/**
 * The identity to use when the send supplied no overlay.
 *
 * This used to be four sparx literals. It is now the PROCESS's own brand, read
 * from `PLATFORM_BRAND` — which is the right question in a single-brand app
 * process (each brand's account app is its own deployment, so a direct send
 * there belongs to that brand by construction) and the wrong one in a shared
 * process, where `email-worker` always supplies the overlay from the tenant's
 * `platform_brand` and this branch is never reached.
 *
 * Resolved once, lazily: it reads environment variables, and an email renders a
 * few hundred elements.
 */
let processIdentity: PlatformIdentity | null = null;

function currentProcessIdentity(): PlatformIdentity {
  if (!processIdentity) {
    const id = platformBrandIdentity(currentPlatformBrand());
    processIdentity = {
      name: id.name,
      url: id.siteUrl,
      accentChars: id.accentChars,
      billingEmail: id.billingEmail,
      // `appUrl` is deliberately absent: resolving a console origin can throw on
      // an unconfigured deployment, and a template that omits a link is better
      // than one that renders a guess. The overlay supplies it (email-worker
      // catches that throw); this floor does not invent one.
      palette: currentProcessPalette(),
    };
  }
  return processIdentity;
}

export function usePlatform(): PlatformIdentity {
  return React.useContext(BrandContext).platform ?? currentProcessIdentity();
}

/**
 * The name of the product this email is FROM, for use in copy.
 *
 * Platform templates said "your sparx account", "Sign in to sparx", "your sparx
 * subscription" — 110-odd literals across 29 files, every one of which reached a
 * Piggles owner naming the wrong company. Copy is the largest surface of the
 * leak and the least visible, because each sentence reads perfectly.
 *
 * Only for the PLATFORM's name. A tenant's own shop name is `brand.siteName`,
 * and the two are never interchangeable.
 */
export function usePlatformName(): string {
  return usePlatform().name;
}

/**
 * The same value outside React — for subject lines, which are computed in
 * `renderTemplate`'s switch rather than rendered.
 */
export function platformNameOf(brand?: Partial<BrandTokens>): string {
  return brand?.platform?.name ?? currentProcessIdentity().name;
}

/**
 * The palette this send paints in.
 *
 * Three sources, in order, and the order is the whole design:
 *
 *  1. **The overlay.** `email-worker` resolves the palette from the tenant's
 *     `platform_brand` and puts it on every send. In a SHARED process — the
 *     worker, api-rest — this is the only correct answer, because the brand is a
 *     property of the tenant rather than of the container.
 *  2. **The process's own brand**, when no overlay was supplied. Right for a
 *     single-brand app process (each brand's account app is its own deployment
 *     with its own `PLATFORM_BRAND`), which is where the direct-send escape
 *     hatch lives — an OTP goes out through `sendTemplate`, not the bus. Never
 *     reached in a shared process, because step 1 always answers there.
 *  3. **`PLAIN_EMAIL_PALETTE`**, if that brand has published none.
 *
 * Resolved once per process, not per render: it reads environment variables, and
 * an email renders a few hundred elements.
 */
let processPalette: EmailPalette | null = null;

function currentProcessPalette(): EmailPalette {
  processPalette ??= resolveEmailPalette(currentPlatformBrand()).palette;
  return processPalette;
}

export function usePalette(): EmailPalette {
  return React.useContext(BrandContext).platform?.palette ?? currentProcessPalette();
}

/** The same value outside React, for the rare caller that composes a style
 *  outside a component (a module-level helper, a subject-adjacent string). */
export function paletteOf(brand?: Partial<BrandTokens>): EmailPalette {
  return brand?.platform?.palette ?? currentProcessPalette();
}
