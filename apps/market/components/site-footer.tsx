// Marketplace footer chrome. A server component. Four-column link map (brand +
// sell CTA / shop / categories / company) plus the legal strip. Layout is
// composed from silicaui utilities (no more mx-footer-*); category links are
// driven by MARKET_CATEGORIES so the footer tracks the same taxonomy as the header.

import Link from 'next/link';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Button } from '@wizeworks/silicaui-react';

import { Wordmark } from '@/components/sparx-brand';
import { Container } from '@/components/ui/layout';

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

const colTitle = 'mb-3 text-xs font-semibold tracking-[0.04em] text-base-content/70 uppercase';
const footerLink =
  'block py-1 text-sm text-base-content/70 transition-colors hover:text-base-content';

export function SiteFooter() {
  return (
    <footer className="border-base-300 bg-base-100 border-t">
      <Container>
        <div className="grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* Brand + sell CTA column. */}
          <div>
            <Link href="/" aria-label="sparx.market home" className="inline-flex items-baseline">
              <Wordmark size={22} />
              <span className="text-base-content/70 ml-0.5 text-sm font-medium">.market</span>
            </Link>
            <p className="text-base-content/70 mt-3 max-w-xs text-sm">
              One destination for thousands of independent sellers. Real shops, real makers, shipped
              direct.
            </p>
            <Button
              render={<Link href="/sell" />}
              color="primary"
              variant="solid"
              size="sm"
              className="mt-4"
            >
              Start selling
            </Button>
          </div>

          <div>
            <h2 className={colTitle}>Shop</h2>
            {SHOP_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={footerLink}>
                {link.label}
              </Link>
            ))}
          </div>

          <div>
            <h2 className={colTitle}>Categories</h2>
            {MARKET_CATEGORIES.map((category) => (
              <Link key={category.slug} href={`/${category.slug}`} className={footerLink}>
                {category.name}
              </Link>
            ))}
          </div>

          <div>
            <h2 className={colTitle}>Company</h2>
            {COMPANY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={footerLink}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="border-base-300 text-base-content/70 flex flex-wrap items-center justify-between gap-4 border-t py-6 text-[0.8125rem]">
          <span>© {FOOTER_YEAR} WizeWorks, Inc. sparx.market is a sparx property.</span>
          <nav className="flex flex-wrap items-center gap-4" aria-label="Legal">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-base-content/70 hover:text-base-content transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
