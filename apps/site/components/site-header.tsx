// Storefront header — brand, primary nav, search, account + cart actions.
// Server component: nav links are derived from the tenant's collections plus
// the standard storefront routes. The cart count is a client island
// (CartCount) so the rest of the header stays static/streamable.

import Link from 'next/link';

import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media';
import type { ResolvedSite } from '@/lib/site-context';
import { CartButton } from './cart-button';
import { HeaderScroll } from './header-scroll';
import { MobileNav } from './mobile-nav';
import { SearchBox } from './search-box';

// Icon-button chrome (search/account/cart/menu) — shared by the header + mobile nav.
const ICON_BTN =
  'relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-field text-base-content no-underline transition-colors hover:bg-base-200';

export interface NavItem {
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  site: ResolvedSite;
  nav: NavItem[];
  announcement?: string | null;
  /** Announcement link target (when the announcement bar links somewhere). */
  announcementHref?: string | null;
  /** Hide the inline search box when the tenant's header config disables it. */
  showSearch?: boolean;
  /** Where the logo sits in the bar (Site Builder header config). */
  logoPlacement?: 'left' | 'center';
  /** Transparent header that floats over the first full-bleed section and turns
   *  solid on scroll (Site Builder header config). */
  overlay?: boolean;
  /** Light/dark toggle island, rendered only when appearancePolicy = toggle. */
  modeToggle?: React.ReactNode;
}

export function SiteHeader({
  site,
  nav,
  announcement,
  announcementHref,
  showSearch = true,
  logoPlacement = 'left',
  overlay = false,
  modeToggle,
}: SiteHeaderProps) {
  const logo = mediaUrl(site.theme?.logoMediaId ?? null, site.slug);

  // Overlay header floats transparent over the first full-bleed section and turns
  // solid once HeaderScroll flags <html data-scrolled="1"> — reacted to here via
  // Tailwind arbitrary variants keyed on that ancestor attribute.
  const headerClass = overlay
    ? "fixed top-0 right-0 left-0 z-40 border-b border-transparent bg-transparent transition-colors duration-200 [html[data-scrolled='1']_&]:border-base-300 [html[data-scrolled='1']_&]:bg-base-100/90 [html[data-scrolled='1']_&]:backdrop-blur-md [html[data-scrolled='1']_&]:backdrop-saturate-150"
    : 'sticky top-0 z-40 border-b border-base-300 bg-base-100/90 backdrop-blur-md backdrop-saturate-150';
  const brandInk = overlay
    ? "text-white [html[data-scrolled='1']_&]:text-base-content"
    : 'text-base-content';
  const iconInk = overlay
    ? "text-white [html[data-scrolled='1']_&]:text-base-content hover:bg-white/15 [html[data-scrolled='1']_&]:hover:bg-base-200"
    : '';

  return (
    <header className={headerClass}>
      {overlay ? <HeaderScroll /> : null}
      {announcement ? (
        <div className="bg-base-content text-base-200 px-4 py-2 text-center text-sm font-medium tracking-wide">
          {announcementHref ? (
            <Link href={announcementHref} className="text-inherit underline underline-offset-2">
              {announcement}
            </Link>
          ) : (
            announcement
          )}
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-6xl px-6">
        <div
          className={cn(
            'flex h-[68px] items-center gap-6',
            logoPlacement === 'center' && 'relative'
          )}
        >
          <MobileNav nav={nav} brand={site.name} />

          <Link
            href="/"
            className={cn(
              'inline-flex items-center gap-2.5 text-xl font-semibold tracking-tight no-underline',
              brandInk,
              logoPlacement === 'center' && 'absolute left-1/2 -translate-x-1/2'
            )}
            aria-label={`${site.name} home`}
          >
            {/* Plain <img>: a tenant logo has unknown intrinsic dimensions and
                a redirecting media src, so next/image (which needs width+height
                or a sized fill parent) doesn't fit; capped at 34px tall. */}
            {logo ? (
              <img src={logo} alt={site.name} className="block max-h-[34px] w-auto" />
            ) : (
              site.name
            )}
          </Link>

          <nav className="mx-auto hidden items-center gap-6 min-[760px]:flex" aria-label="Primary">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative py-1.5 text-[0.95rem] font-medium no-underline underline-offset-4 hover:underline',
                  overlay
                    ? "[html[data-scrolled='1']_&]:text-base-content text-white/85 hover:text-white"
                    : 'text-base-content'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {showSearch ? (
            <div className="hidden flex-1 justify-end min-[760px]:flex">
              <SearchBox tenantSlug={site.slug} />
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            {showSearch ? (
              <Link
                href="/search"
                className={cn(ICON_BTN, iconInk, 'min-[760px]:hidden')}
                aria-label="Search"
              >
                <SearchIcon />
              </Link>
            ) : null}
            {modeToggle}
            <Link href="/account" className={cn(ICON_BTN, iconInk)} aria-label="Account">
              <UserIcon />
            </Link>
            <CartButton />
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
