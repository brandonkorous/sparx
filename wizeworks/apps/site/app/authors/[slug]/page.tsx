// One author's page — `/authors/rosalind-pike`. Who they are and everything on this
// site they wrote or are credited on, so a byline is a way to the rest of their work.
//
// The owner's own "Each author" design wins when she has published one, as the post
// route takes the published blog-post design; until then the record page's default
// (`authorPage`) draws it. An author with nothing published here is a 404: a page
// listing nothing is a dead end.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';
import { authorRecord, getPublicAuthor } from '@/lib/authors';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { metadataTitle, socialTitle } from '@/lib/page-title';
import { applyRedirect } from '@/lib/redirects';
import { resolveSite } from '@/lib/site-context';
import { requireSiteModule } from '@/lib/site-modules';
import { getPublishedSilicaCollection } from '@/lib/silica';
import { buildSilicaHost, silicaSiteIdentity } from '@/lib/silica-data';
import { SUSPENDED_METADATA } from '@/lib/suspended';

interface AuthorPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sparxSitePreview?: string }>;
}

/** The first sentence of a biography, for the page description. */
function firstSentence(bio: string | null): string | undefined {
  const text = (bio ?? '').trim();
  if (!text) return undefined;
  const end = text.search(/[.!?](\s|$)/);
  return end > 0 ? text.slice(0, end + 1) : text;
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  if (site.billingPhase === 'suspended') return SUSPENDED_METADATA;
  const { slug } = await params;
  const page = await getPublicAuthor(site.slug, slug);
  if (!page) return {};
  const { author } = page;
  const description = firstSentence(author.bio);
  const image =
    mediaUrl(author.avatar_asset_id, site.slug) ??
    ogImageUrl({
      title: author.display_name,
      brand: site.name,
      accent: site.theme?.colorPrimary,
      platformBrand: site.platformBrand,
    });
  return {
    title: metadataTitle(author.display_name, site.name),
    ...(description ? { description } : {}),
    openGraph: {
      title: socialTitle(author.display_name, site.name),
      ...(description ? { description } : {}),
      images: [{ url: image }],
    },
  };
}

export default async function AuthorPage({ params, searchParams }: AuthorPageProps) {
  const site = await resolveSite();
  if (!site) notFound();
  requireSiteModule(site, 'cms');
  const { slug } = await params;
  const sitePreview = (await searchParams)?.sparxSitePreview;

  const page = await getPublicAuthor(site.slug, slug);
  if (!page) {
    await applyRedirect(site.slug, `/authors/${slug}`);
    notFound();
  }

  const template = await getPublishedSilicaCollection(
    site.slug,
    'cms.author',
    page.author.id,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (!template) {
    // The code-authored record page always resolves (`RECORD_TEMPLATES`), so this is a
    // broken registry, said loudly rather than served as a blank page.
    throw new Error(`No silica template resolved for author "${slug}"`);
  }
  const { resolver } = await buildSilicaHost(site.slug, template.root, {
    record: {
      key: 'author',
      value: authorRecord(page, site.slug, site.timezone, site.commerce.defaultLocale),
    },
    currency: site.commerce.defaultCurrency,
    locale: site.commerce.defaultLocale,
    site: silicaSiteIdentity(site),
  });
  return (
    <SilicaFunctionalBody
      root={template.root}
      symbols={template.symbols}
      host={resolver}
      renderHost={SiteHostRenderer({ site, recordId: page.author.id, articleDoc: null })}
    />
  );
}
