// Breadcrumb trail. Renders BreadcrumbList JSON-LD alongside the visual trail
// so search engines get the hierarchy for free.

import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: c.href } : {}),
    })),
  };

  return (
    <nav
      className="text-base-content flex flex-wrap items-center gap-2 py-4 text-sm"
      aria-label="Breadcrumb"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} style={{ display: 'inline-flex', gap: '0.5rem' }}>
            {c.href && !last ? (
              <Link href={c.href} className="text-base-content no-underline hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current={last ? 'page' : undefined}>{c.label}</span>
            )}
            {!last ? (
              <span className="text-base-content/40" aria-hidden="true">
                /
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
