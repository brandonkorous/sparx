import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VerticalPage } from '@/components/marketing/verticals/vertical-page';
import { getVertical, VERTICALS } from '@/components/marketing/verticals/registry';

/**
 * The industry landing pages — `/for/salons`, `/for/auto-shops`, and so on.
 *
 * These are the destinations for search, social and paid: one URL per kind of
 * business, each answering "is this for me, and what does it cost me" for that
 * business alone. The slug is chosen for how people SEARCH, never for our own
 * naming — `/for/auto-shops`, not `/for/garage`, which is the blueprint's
 * codename and nobody's search term.
 *
 * Statically rendered at build with `dynamicParams = false`, so the six real
 * pages are files on the CDN and anything else is an honest 404 rather than a
 * generated page for a slug someone guessed. Thin auto-generated permutations
 * are exactly what search engines penalise, and the only defence is that every
 * URL here is a page a person wrote.
 */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return VERTICALS.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vertical = getVertical(slug);
  if (!vertical) return {};

  const path = `/for/${vertical.slug}`;
  const url = `https://sparx.works${path}`;
  const title = `${vertical.seoTitle} · sparx`;
  // Per-page OG image. Without one these pages would inherit the site-root card,
  // and a link to /for/restaurants would preview as the homepage — the fastest
  // way to waste the click a social post just earned.
  const image = `https://sparx.works/for/og/${vertical.slug}`;

  return {
    title,
    description: vertical.seoDescription,
    keywords: vertical.keywords,
    alternates: { canonical: path },
    // Per-page og:url — inheriting the layout's site-root url breaks LinkedIn's
    // share de-duplication (see app/pricing/page.tsx for the same note).
    openGraph: {
      title,
      description: vertical.seoDescription,
      url,
      siteName: 'sparx',
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: `sparx for ${vertical.plural}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: vertical.seoDescription,
      images: [image],
    },
  };
}

export default async function ForVertical({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vertical = getVertical(slug);
  if (!vertical) notFound();
  return <VerticalPage vertical={vertical} />;
}
