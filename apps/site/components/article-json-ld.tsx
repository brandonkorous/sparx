// BlogPosting (Article) structured data for CMS blog posts (docs/50 §4). Gives
// search + AI crawlers the post's headline, dates, image, and publisher so a
// post can surface as a rich article result. Rendered as page chrome around
// whatever template the post resolves to (builder collection or bare PageView),
// mirroring how the PDP emits Product JSON-LD around its rendered template.

import { headers } from 'next/headers';

import type { ApiEntry, BlogPostBody } from '@/lib/content';
import { mediaUrl } from '@/lib/media';

interface ArticleJsonLdProps {
  post: ApiEntry<BlogPostBody>;
  tenant: { slug: string; name: string };
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export async function ArticleJsonLd({ post, tenant }: ArticleJsonLdProps) {
  const body = post.body ?? {};
  const seo = post.seo ?? {};

  const headline = str(seo.title) ?? str(body.title) ?? tenant.name;
  const description = str(seo.description) ?? str(body.excerpt);
  // The featured image is the best article image; it's a media-asset id (or an
  // absolute URL) — mediaUrl resolves both to an absolute, CDN-served URL.
  const image = mediaUrl(
    typeof body.featuredImage === 'string' ? body.featuredImage : null,
    tenant.slug
  );

  // Absolute canonical for mainEntityOfPage. The tenant origin is whatever host
  // served this request (slug.sparx.zone or a custom domain), so read it off the
  // forwarded host like the root layout's metadataBase does.
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const url = host && post.slug ? `https://${host}/blog/${post.slug}` : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline,
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    ...(url ? { mainEntityOfPage: { '@type': 'WebPage', '@id': url } } : {}),
    // No first-class author field on a blog_post yet — attribute to the tenant
    // as the publishing organization. Swap to a Person once authors are modeled.
    author: { '@type': 'Organization', name: tenant.name },
    publisher: { '@type': 'Organization', name: tenant.name },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
