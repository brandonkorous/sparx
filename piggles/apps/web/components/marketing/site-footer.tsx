import Link from 'next/link';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Logo } from '@piggles/brand/react';
import { accountUrl, APP_COUNT_WORD, PRODUCT } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { TRADE_LINKS } from '@/content/trades/list';
import { TOOLS } from './tools/registry';

// The footer answers the questions a visitor still has at the bottom of a page:
// what is it, who is it for, can I trust it, and what does it cost.
// Every app is one click away in the header's Apps panel, so it is not repeated here.

interface FooterLink {
  href: string;
  label: string;
  /** Links to getpiggles.com leave the site, so they are plain anchors. */
  external?: boolean;
}

/** The tools people search for most, first. The rest are on /tools. */
const TOP_TOOLS = ['invoice', 'quote', 'qr-code', 'email-signature', 'privacy-policy'];

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Piggles',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/apps', label: `All ${APP_COUNT_WORD} apps` },
      { href: '/pricing', label: 'Pricing' },
      { href: '/compare', label: 'Compared with others' },
      { href: '/switching', label: 'Switching to Piggles' },
      { href: '/what-connects', label: 'What connects' },
      { href: '/whats-new', label: 'What’s new' },
      { href: '/about', label: 'About us' },
    ],
  },
  {
    title: 'For your business',
    links: [
      ...TRADE_LINKS.slice(0, 6).map((t) => ({ href: `/for/${t.slug}`, label: t.plural })),
      { href: '/who-its-for', label: `All ${TRADE_LINKS.length} kinds of business` },
    ],
  },
  {
    title: 'Free tools',
    links: [
      ...TOP_TOOLS.flatMap((slug) => {
        const tool = TOOLS.find((t) => t.slug === slug);
        return tool ? [{ href: `/tools/${tool.slug}`, label: tool.name }] : [];
      }),
      { href: '/tools', label: `All ${TOOLS.length} free tools` },
    ],
  },
  {
    title: 'Trust and help',
    links: [
      { href: '/faq', label: 'Questions and answers' },
      { href: '/trust', label: 'Your data and safety' },
      { href: '/status', label: 'Is it working right now?' },
      { href: accountUrl('contact', 'footer'), label: 'Talk to a person', external: true },
      { href: accountUrl('sign-in'), label: 'Sign in', external: true },
    ],
  },
];

const LEGAL: FooterLink[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/data-processing', label: 'Data processing' },
  { href: '/brand', label: 'Brand' },
];

function FooterAnchor({ link, className }: { link: FooterLink; className: string }) {
  return link.external ? (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

function FooterAsk() {
  return (
    <div className="lg:col-span-2">
      <Link href="/" aria-label={`${PRODUCT.name} home`}>
        <Logo />
      </Link>
      <p className="mt-5 max-w-[32ch] text-lg font-semibold">{PRODUCT.tagline}</p>
      <p className="mt-2 text-base">
        {PRICE_LABEL} a month. Every app included. 14 days free, no card needed.
      </p>
      <a
        className={`${buttonClasses({ color: 'primary', size: 'lg' })} mt-6`}
        href={accountUrl('signup', 'footer')}
      >
        Start free
      </a>
    </div>
  );
}

export function SiteFooter() {
  return (
    <div className="bg-base-100 border-base-300 mt-16 border-t">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-6 lg:gap-10">
          <FooterAsk />
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-base font-bold">{col.title}</h2>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterAnchor link={link} className="text-base" />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Every link here resolves. Add a link the same day its page exists, never before. */}
        <div className="border-base-300 mt-16 grid gap-6 border-t pt-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-7 gap-y-3">
            {LEGAL.map((link) => (
              <FooterAnchor key={link.href} link={link} className="text-base font-semibold" />
            ))}
          </nav>
          <p className="text-base lg:text-right">
            © {new Date().getFullYear()} WizeWorks LLC · {PRODUCT.hosts.marketing}
          </p>
        </div>
      </div>
    </div>
  );
}
