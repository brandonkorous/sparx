import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MigratePage } from '@/components/marketing/migrate/migrate-page';
import { MIGRATE_STORIES, getStory } from '@/components/marketing/migrate/stories';

/**
 * `/migrate/shopify`, `/migrate/hubspot`, and eighteen more.
 *
 * Statically rendered with `dynamicParams = false`, so each page is a file on the CDN
 * and any other slug is an honest 404 rather than a thin generated page for something
 * somebody guessed. Auto-generated permutations are exactly what search engines
 * penalise, and the only defence is that every URL here is a page a person wrote —
 * which is why the copy lives in `stories.ts` per vendor rather than in a template
 * with the name swapped out.
 */
export const dynamicParams = false;

export function generateStaticParams(): { vendor: string }[] {
  return MIGRATE_STORIES.map((story) => ({ vendor: story.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vendor: string }>;
}): Promise<Metadata> {
  const { vendor } = await params;
  const story = getStory(vendor);
  if (story === undefined) return {};

  const path = `/migrate/${story.slug}`;
  const url = `https://sparx.works${path}`;
  const title = `${story.seoTitle} · sparx`;
  // Per-page card. Without one, a link pasted into the forum thread where somebody
  // is asking whether to leave previews as the homepage — the fastest way to waste
  // the click that thread just earned.
  const image = `https://sparx.works/migrate/og/${story.slug}`;

  return {
    title,
    description: story.seoDescription,
    keywords: story.keywords,
    alternates: { canonical: path },
    // Per-page og:url — inheriting the layout's site-root url breaks LinkedIn's share
    // de-duplication, which matters here because these pages are shared into exactly
    // the kind of forum thread where somebody is asking whether to leave.
    openGraph: {
      title,
      description: story.seoDescription,
      url,
      siteName: 'sparx',
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: `Move from ${story.name} to sparx` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: story.seoDescription,
      images: [image],
    },
  };
}

export default async function VendorMigratePage({
  params,
}: {
  params: Promise<{ vendor: string }>;
}) {
  const { vendor } = await params;
  const story = getStory(vendor);
  if (story === undefined) notFound();

  return <MigratePage story={story} />;
}
