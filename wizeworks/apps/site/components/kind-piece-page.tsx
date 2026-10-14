// One piece of a content kind, on its own page — `/articles/the-last-mill`.
//
// The kind's own page design wins when the owner has published one ("Each article" in
// her page list), exactly as the post route takes the published blog-post design. Until
// then the page is composed from the kind's fields (`contentKindPage`), so a kind is
// readable the moment it has a published piece.

import type { Metadata } from 'next';
import { contentKindPage } from '@wizeworks/silica-catalog';

import { ArticleJsonLd } from '@/components/article-json-ld';
import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';
import {
  pieceDoc,
  pieceImage,
  pieceRecord,
  pieceSummary,
  pieceTitle,
  type KindPiece,
} from '@/lib/kind-pieces';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { metadataTitle, socialTitle } from '@/lib/page-title';
import type { ResolvedSite } from '@/lib/site-context';
import { getPublishedSilicaCollection } from '@/lib/silica';
import { buildSilicaHost, silicaSiteIdentity } from '@/lib/silica-data';

/** The record type a kind's page renders, as the builder stores it on the page row. */
export function kindRecordType(key: string): string {
  return `cms.${key}`;
}

/** A piece's page title, description and social card — its own SEO fields first, as the
 *  post route reads them, then what its kind's fields say. */
export function kindPieceMetadata(piece: KindPiece, site: ResolvedSite): Metadata {
  const { entry, kind } = piece;
  const body = entry.body ?? {};
  const seo = entry.seo ?? {};
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const title = str(seo.title) ?? (pieceTitle(kind.fields, body) || site.name);
  const description = str(seo.description) ?? (pieceSummary(kind.fields, body) || undefined);
  const canonical = str(seo.canonical);
  const seoOg = str(seo.ogImage);
  const ogImage =
    (seoOg ? (seoOg.startsWith('http') ? seoOg : mediaUrl(seoOg, site.slug)) : undefined) ??
    pieceImage(kind.fields, body, site.slug) ??
    ogImageUrl({
      title,
      brand: site.name,
      accent: site.theme?.colorPrimary,
      platformBrand: site.platformBrand,
    });
  const noindex = typeof seo.robots === 'string' && seo.robots.includes('noindex');
  const indexable = entry.status === 'published' && !noindex;
  return {
    title: metadataTitle(title, site.name),
    ...(description ? { description } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: socialTitle(title, site.name),
      ...(description ? { description } : {}),
      images: [{ url: ogImage }],
    },
    robots: indexable ? { index: true, follow: true } : { index: false },
  };
}

export async function KindPiecePage({
  site,
  piece,
  sitePreview,
}: {
  site: ResolvedSite;
  piece: KindPiece;
  sitePreview?: string;
}) {
  const { entry, kind } = piece;
  const body = entry.body ?? {};
  const path = `${kind.prefix}${entry.slug ?? ''}`;

  const published = await getPublishedSilicaCollection(
    site.slug,
    kindRecordType(kind.key),
    entry.id,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  const root = published?.root ?? contentKindPage(kind);
  const symbols = published?.symbols ?? {};

  const { resolver } = await buildSilicaHost(site.slug, root, {
    record: {
      key: kind.key,
      value: pieceRecord(
        entry,
        kind.fields,
        path,
        site.slug,
        site.timezone,
        site.commerce.defaultLocale,
        piece.people
      ),
    },
    currency: site.commerce.defaultCurrency,
    locale: site.commerce.defaultLocale,
    site: silicaSiteIdentity(site),
  });

  return (
    <>
      <ArticleJsonLd
        post={entry}
        site={site}
        path={path}
        headline={pieceTitle(kind.fields, body)}
        description={pieceSummary(kind.fields, body)}
        image={pieceImage(kind.fields, body, site.slug)}
        schemaType="Article"
      />
      {/* The functional walk, for the reason the post route gives: the written body is a
          rich-text document, drawn by the article-body core, which only exists in React. */}
      <SilicaFunctionalBody
        root={root}
        symbols={symbols}
        host={resolver}
        renderHost={SiteHostRenderer({
          site,
          recordId: entry.id,
          articleDoc: pieceDoc(kind.fields, body),
        })}
      />
    </>
  );
}
