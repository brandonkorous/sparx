import type { Metadata } from 'next';
import { getTool } from './registry';

/**
 * Build a tool page's <head> metadata from the registry entry, so every tool is
 * its own SEO landing page (own title, description, keywords, canonical, OG/
 * Twitter card) with zero per-page boilerplate or drift.
 */
export function toolMetadata(slug: string): Metadata {
  const tool = getTool(slug);
  if (!tool) return {};
  const url = `https://sparx.works/tools/${tool.slug}`;
  const ogTitle = `${tool.name} · free sparx tool`;

  return {
    title: `${tool.name} — free, runs in your browser`,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: ogTitle,
      description: tool.description,
      url,
      siteName: 'sparx',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: tool.tagline,
    },
  };
}
