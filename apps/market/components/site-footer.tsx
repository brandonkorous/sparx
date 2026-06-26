// Marketplace footer chrome. A server component. Four-column link map (shop /
// categories / sell / company) plus a "Sell on sparx.market" CTA column and the
// legal strip. Category links are driven by MARKET_CATEGORIES so the footer
// tracks the same taxonomy as the header.

import Link from 'next/link';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Wordmark, Button } from '@sparx/ui';

const FOOTER_YEAR = 2026; // static so SSR output stays deterministic/cacheable

interface FooterLink {
  label: string;
  href: string;
}

const SHOP_LINKS: FooterLink[] = [
  { label: 'All products', href: '/products' },
  { label: 'Merchants', href: '/merchants' },
  { label: 'New arrivals', href: '/products?sort=newest' },
  { label: 'Your cart', href: '/cart' },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About sparx.market', href: '/about' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Help center', href: '/help' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Privacy', href: '/legal/privacy' },
  { label: 'Terms', href: '/legal/terms' },
  { label: 'Buyer protection', href: '/legal/buyer-protection' },
];

export function SiteFooter() {
  return (
    <footer className="mx-footer">
      <div className="mx-container">
        <div className="mx-footer__grid">
          {/* Brand + sell CTA column. */}
          <div>
            <Link href="/" aria-label="sparx.market home" className="inline-flex items-baseline">
              <Wordmark size={22} />
              <span
                className="ml-0.5 text-sm font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                .market
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              One destination for thousands of independent sellers. Real shops, real makers, shipped
              direct.
            </p>
            <Button asChild color="primary" variant="solid" size="sm" className="mt-4">
              <Link href="/sell">Start selling</Link>
            </Button>
          </div>

          <div>
            <h2 className="mx-footer__col-title">Shop</h2>
            {SHOP_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="mx-footer__link">
                {link.label}
              </Link>
            ))}
          </div>

          <div>
            <h2 className="mx-footer__col-title">Categories</h2>
            {MARKET_CATEGORIES.map((category) => (
              <Link key={category.slug} href={`/${category.slug}`} className="mx-footer__link">
                {category.name}
              </Link>
            ))}
          </div>

          <div>
            <h2 className="mx-footer__col-title">Company</h2>
            {COMPANY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="mx-footer__link">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-footer__legal">
          <span>© {FOOTER_YEAR} WizeWorks, Inc. sparx.market is a sparx property.</span>
          <nav className="flex flex-wrap items-center gap-4" aria-label="Legal">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
