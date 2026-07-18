// The `site.brand` host core — the tenant's brand mark in the site chrome.
//
// This is what a visitor sees in the header: the logo and/or site name, linked home.
// It is a HOST core rather than a stamped node so the platform renders it LIVE on every
// request: a tenant uploads a logo in Site settings and it appears, with no builder trip
// and no re-publish. A stamped mark freezes at publish — which is exactly how tenants
// ended up with a text-only header no fix could reach (see `HOST_KEYS.siteBrand`).
//
// PURE + PROP-DRIVEN ON PURPOSE. The frame wraps EVERY page, so this component renders on
// every route of the site. It must never fetch (a per-request round trip on every page)
// and must never throw (a throw here 500s the entire storefront, not one section). Every
// input arrives as a prop the layout already had in hand; every branch degrades to
// something renderable.

import Link from 'next/link';

/** Which parts of the mark to render — the author's `show` host prop. A bound tree can't
 *  express this conditional (two bound children always both render, which is why the old
 *  composite told authors to "delete the part you don't want"); rendering in React can. */
export type BrandShow = 'logo' | 'name' | 'both';

export interface SiteBrandProps {
  /** The customer-facing SITE name (`Property.name`) — never the tenant's legal name. */
  name: string;
  /** The resolved light-background logo URL, or null when the tenant hasn't set one. */
  logoUrl?: string | null;
  /** The resolved dark-background logo URL, if the tenant set one. */
  logoDarkUrl?: string | null;
  show?: BrandShow;
  /** Wrapper classes from the author's node — they own the mark's look and placement. */
  className?: string;
}

/** Coerce the author's `show` prop. Unknown/absent → 'both': the mark must always render
 *  something, and a typo in stored JSON must not blank a tenant's header. */
export function toBrandShow(value: unknown): BrandShow {
  return value === 'logo' || value === 'name' || value === 'both' ? value : 'both';
}

export function SiteBrand({
  name,
  logoUrl,
  logoDarkUrl,
  show = 'both',
  className,
}: SiteBrandProps) {
  const hasLogo = Boolean(logoUrl);
  // The load-bearing degradation: "logo only" with no logo uploaded would render an
  // EMPTY link — an invisible, unclickable header. Fall back to the name, which every
  // site has. This is the case the old placeholder image existed to paper over; here we
  // can just render the true thing instead of a grey "Logo" box.
  const mode: BrandShow = show === 'logo' && !hasLogo ? 'name' : show;
  const showLogo = hasLogo && (mode === 'logo' || mode === 'both');
  const showName = mode === 'name' || mode === 'both';

  return (
    <Link href="/" className={className ?? 'wordmark inline-flex items-center gap-2.5'}>
      {showLogo ? (
        <>
          {/* Both logos ship; CSS picks. The theme can flip client-side, so choosing in
              JS would need an effect (and would flash the wrong mark on first paint).
              Rendering both and letting `dark:` decide is correct at SSR. */}
          {/* A raw <img>, not next/image: the logo is an arbitrary tenant media URL and
              usually an SVG, which next/image can neither optimize nor size. */}
          <img
            src={logoUrl!}
            alt={showName ? '' : name}
            className={
              logoDarkUrl ? 'h-8 w-auto object-contain dark:hidden' : 'h-8 w-auto object-contain'
            }
            {...(showName ? { 'aria-hidden': true } : {})}
          />
          {logoDarkUrl ? (
            <img
              src={logoDarkUrl}
              alt={showName ? '' : name}
              className="hidden h-8 w-auto object-contain dark:block"
              {...(showName ? { 'aria-hidden': true } : {})}
            />
          ) : null}
        </>
      ) : null}
      {/* When the logo carries the name visually, the text is still rendered for screen
          readers rather than dropped — the mark is the site's primary "home" affordance. */}
      {showName ? <span>{name}</span> : <span className="sr-only">{name}</span>}
    </Link>
  );
}
