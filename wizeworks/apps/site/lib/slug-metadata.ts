// Metadata for the catch-all route: an authored (silica or builder) page, a CMS page, or nothing.

import type { Metadata } from 'next';
import type { ApiEntry, PageBody } from './content';
import { ogImageUrl } from './og';
import { metadataTitle, socialTitle } from './page-title';
import type { ResolvedSite } from './site-context';

/** What app/not-found.tsx says, so the tab does not read only the shop's name. */
export const NOT_FOUND_METADATA: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/** The SEO fields a silica page and a builder page share. */
export interface AuthoredPageSeo {
  name: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
}

function clean(v: string | null): string | undefined {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

function cardUrl(title: string, site: ResolvedSite): string {
  return ogImageUrl({
    title,
    brand: site.name,
    accent: site.theme?.colorPrimary,
    platformBrand: site.platformBrand,
  });
}

// The layout's title template appends ` · <site>`, so the page title must not; openGraph keeps it.
export function authoredPageMetadata(page: AuthoredPageSeo, site: ResolvedSite): Metadata {
  const title = clean(page.seoTitle) ?? page.name;
  const description = clean(page.seoDescription);
  const canonical = clean(page.canonical);
  return {
    title: metadataTitle(title, site.name),
    ...(description ? { description } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: socialTitle(title, site.name),
      ...(description ? { description } : {}),
      images: [{ url: clean(page.ogImage) ?? cardUrl(title, site) }],
    },
    robots: page.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

// A title-less CMS page falls back to the site name as an `absolute` title (no doubled suffix).
export function cmsPageMetadata(page: ApiEntry<PageBody>, site: ResolvedSite): Metadata {
  const seo = page.seo ?? {};
  const seoDescription = typeof seo.description === 'string' ? seo.description : undefined;
  const title =
    (typeof seo.title === 'string' ? seo.title : undefined) ??
    (typeof page.body.title === 'string' ? page.body.title : undefined);
  return {
    title: title ? metadataTitle(title, site.name) : { absolute: site.name },
    ...(seoDescription ? { description: seoDescription } : {}),
    openGraph: {
      title: title ? socialTitle(title, site.name) : site.name,
      ...(seoDescription ? { description: seoDescription } : {}),
      images: [{ url: cardUrl(title ?? site.name, site) }],
    },
    robots: page.status === 'published' ? { index: true, follow: true } : { index: false },
  };
}
