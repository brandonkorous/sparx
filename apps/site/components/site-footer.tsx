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
    <div className="st-sitefooter__social">
      {socialLinks.map((s) => (
        <a
          key={s.platform}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="st-iconbtn"
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
      <footer className="st-sitefooter st-sitefooter--minimal">
        <div className="st-container">
          <div className="st-sitefooter__minimal">
            {links.length > 0 ? (
              <nav className="st-sitefooter__minimal-links" aria-label="Footer">
                {links.map((link) => (
                  <FooterLink key={link.href} link={link} />
                ))}
              </nav>
            ) : null}
            <SocialRow socialLinks={social} />
            <div className="st-sitefooter__minimal-legal">
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
    <footer className="st-sitefooter">
      <div className="st-container">
        <div className="st-sitefooter__grid">
          <div className="st-sitefooter__col">
            <span className="st-header__brand">{site.name}</span>
            <p
              className="st-muted"
              style={{ marginTop: '0.75rem', maxWidth: '34ch', lineHeight: 1.6 }}
            >
              {tagline && tagline.length > 0 ? tagline : DEFAULT_TAGLINE}
            </p>
            <SocialRow socialLinks={social} />
          </div>
          {columns.map((col) => (
            <div key={col.title} className="st-sitefooter__col">
              <h4>{col.title}</h4>
              {col.links.map((link) => (
                <FooterLink key={link.href} link={link} />
              ))}
            </div>
          ))}
        </div>
        <div className="st-sitefooter__bottom">
          <span>{legal}</span>
          {/* sparx attribution is the always-on <MadeWithSparx> badge injected
              at the site-shell level (app/layout.tsx), not an inline footer line. */}
        </div>
      </div>
    </footer>
  );
}
