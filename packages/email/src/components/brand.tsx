import * as React from 'react';
import { colors, fontFamily } from './tokens';

// Per-tenant brand for email rendering.
//
// Mail clients strip <style> blocks and don't honour CSS custom properties, so
// brand values must be concrete and inlined on each element. Rather than thread
// a `brand` prop through every template + atom, we put the resolved brand on a
// React context: `renderTemplate` wraps the tree in <BrandProvider brand={…}>
// and every atom reads it via `useBrand()`. With no provider, atoms fall back
// to `defaultBrand` (the sparx chrome) — so existing render paths are unchanged.
//
// The brand is resolved per tenant by @sparx/email-platform's brand-service
// (storefront theme tokens → settings override → sparx defaults), light palette
// only (email-client dark mode is unreliable).

/** The brand's DARK-theme surfaces — the SAME dark palette the tenant's SITE uses
 *  (resolved from `@sparx/site-themes`' dark tokens). When a brand carries this, the
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
  /** The site's social links, rendered as self-contained badges in the footer.
   *  Platform is a free string here; the footer maps it to silica's supported
   *  badge set and drops the rest. */
  socials?: { platform: string; url: string }[];
}

export const defaultBrand: BrandTokens = {
  primary: colors.brand,
  primaryForeground: colors.textInverse,
  accent: colors.brand,
  background: colors.surface,
  foreground: colors.textPrimary,
  muted: colors.surfaceMuted,
  border: colors.border,
  fontHeading: fontFamily,
  fontBody: fontFamily,
  // The pre-multibrand default, kept so a send that names no brand renders
  // exactly as it always has. A caller that KNOWS the platform brand overrides
  // this — see email-worker's handler — and the flag below is what tells the
  // wordmark this is a fallback rather than somebody's actual shop name.
  siteName: 'sparx',
  siteNameIsPlatformDefault: true,
  // The sparx default theme's DARK neutrals (the `apex` preset's dark tokens in
  // @sparx/site-themes) — so an unbranded send still renders a real dark theme on a
  // dark-mode client, not the light card on a black screen. Brand hue (`primary`) is
  // omitted deliberately: sparx keeps its accent in both modes.
  dark: {
    background: '#0b1120',
    foreground: '#e2e8f0',
    muted: '#111827',
    border: '#1f2937',
  },
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
