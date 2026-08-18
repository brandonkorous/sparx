import type { Metadata } from 'next';
import { getTool } from './registry';
import { getToolSeo } from './tool-seo';

/**
 * Build a tool page's <head> metadata from the registry + SEO entries, so every
 * tool is its own keyword-targeted landing page with zero per-page boilerplate
 * or drift. The title front-loads the head keyword (better than a brand-led
 * title); the OG/Twitter image points at the per-tool generated card
 * (app/tools/og/[slug]). The strong `robots` directives (max-image-preview:
 * large, max-snippet:-1) are inherited from the root layout.
 */
export function toolMetadata(slug: string): Metadata {
  const tool = getTool(slug);
  if (!tool) return {};
  const seo = getToolSeo(slug);
  const path = `/tools/${tool.slug}`;
  const url = `https://sparx.works${path}`;
  const title = `${seo?.seoTitle ?? `${tool.name} — free, in your browser`} · sparx`;
  const image = `https://sparx.works/tools/og/${tool.slug}`;

  return {
    title,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: tool.description,
      url,
      siteName: 'sparx',
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: tool.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: tool.tagline,
      images: [image],
    },
  };
}
