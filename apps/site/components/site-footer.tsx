// Storefront footer — brand blurb, link columns (shop + collections + info),
// and a legal bottom bar. Link columns are data-driven so the layout can feed
// in collections and CMS/legal pages.

import Link from 'next/link';

import type { ResolvedSite } from '@/lib/site-context';

export interface FooterColumn {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}

export interface FooterSocialLink {
  platform: string;
  url: string;
}

export interface SiteFooterProps {
  site: ResolvedSite;
  columns: FooterColumn[];
  year: number;
  /** Tenant copyright line (Site Builder footer config); falls back to the
   *  default "© {year} {name}" when empty. */
  copyright?: string | null;
  socialLinks?: FooterSocialLink[];
  /** 'columns' = full multi-column footer; 'minimal' = a single compact,
   *  centered link row (Site Builder footer config). */
  variant?: 'columns' | 'minimal';
  /** Brand blurb under the name in the 'columns' variant; falls back to a
   *  generic line when empty. Ignored by 'minimal'. */
  tagline?: string | null;
}

const DEFAULT_TAGLINE = 'Quality products, fast shipping, and support that actually helps.';

function FooterLink({ link }: { link: FooterColumn['links'][number] }) {
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer">
      {link.label}
    </a>
  ) : (
    <Link href={link.href}>{link.label}</Link>
  );
}

function SocialRow({ socialLinks }: { socialLinks: FooterSocialLink[] }) {
  if (socialLinks.length === 0) return null;
  return (
    <div className="mt-4 flex gap-2">
      {socialLinks.map((s) => (
        <a
          key={s.platform}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-field text-base-content hover:bg-base-200 inline-flex h-10 w-10 items-center justify-center no-underline transition-colors"
          aria-label={s.platform}
        >
          {s.platform.charAt(0).toUpperCase()}
        </a>
      ))}
    </div>
  );
}

export function SiteFooter({
  site,
  columns,
  year,
  copyright,
  socialLinks,
  variant = 'columns',
  tagline,
}: SiteFooterProps) {
  const social = socialLinks ?? [];
  const legal = copyright ?? `© ${year} ${site.name}. All rights reserved.`;

  // Minimal: a flat, centered row of every link + a legal line. Suits sites
  // whose footer is a thin legal/locale strip rather than a sitemap.
  if (variant === 'minimal') {
    const links = columns.flatMap((c) => c.links);
    return (
      <footer className="border-base-300 bg-base-100 mt-[clamp(3rem,6vw,5rem)] border-t">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex flex-col items-center gap-4 py-[clamp(1.75rem,4vw,2.5rem)] text-center">
            {links.length > 0 ? (
              <nav
                className="[&_a]:text-base-content flex flex-wrap justify-center gap-x-6 gap-y-2 [&_a]:text-[0.82rem] [&_a]:no-underline [&_a]:hover:underline"
                aria-label="Footer"
              >
                {links.map((link) => (
                  <FooterLink key={link.href} link={link} />
                ))}
              </nav>
            ) : null}
            <SocialRow socialLinks={social} />
            <div className="text-base-content flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm">
              <span>{legal}</span>
              {/* sparx attribution is the always-on <MadeWithSparx> badge injected
                  at the site-shell level (app/layout.tsx), not an inline footer line. */}
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-base-300 bg-base-100 mt-[clamp(4rem,8vw,7rem)] border-t">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="grid grid-cols-[1.5fr_repeat(3,1fr)] gap-10 py-[clamp(2.5rem,5vw,4rem)] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1 max-[520px]:gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-base-content text-xl font-semibold tracking-tight">
              {site.name}
            </span>
            <p className="text-base-content mt-3 max-w-[34ch] leading-relaxed">
              {tagline && tagline.length > 0 ? tagline : DEFAULT_TAGLINE}
            </p>
            <SocialRow socialLinks={social} />
          </div>
          {columns.map((col) => (
            <div
              key={col.title}
              className="[&_a]:text-base-content [&_h4]:text-base-content flex flex-col gap-2 [&_a]:block [&_a]:py-1 [&_a]:text-sm [&_a]:no-underline [&_a]:hover:underline [&_h4]:mb-4 [&_h4]:text-sm [&_h4]:tracking-wide [&_h4]:uppercase"
            >
              <h4>{col.title}</h4>
              {col.links.map((link) => (
                <FooterLink key={link.href} link={link} />
              ))}
            </div>
          ))}
        </div>
        <div className="border-base-300 text-base-content flex flex-wrap items-center justify-between gap-4 border-t py-6 text-[0.82rem]">
          <span>{legal}</span>
          {/* sparx attribution is the always-on <MadeWithSparx> badge injected
              at the site-shell level (app/layout.tsx), not an inline footer line. */}
        </div>
      </div>
    </footer>
  );
}
