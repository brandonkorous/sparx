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
  site: { slug: string; name: string; siteOrigin?: string | null };
  /** Where the piece lives. A blog post's is `/blog/<slug>`; a piece of another kind
   *  passes its own (`/articles/<slug>`), along with the fields its kind names
   *  differently from a post's `title` / `excerpt` / `featuredImage`. */
  path?: string;
  headline?: string;
  description?: string;
  image?: string | null;
  /** `Article` for a kind that is not the blog. */
  schemaType?: 'BlogPosting' | 'Article';
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export async function ArticleJsonLd(props: ArticleJsonLdProps) {
  const { post, site } = props;
  const body = post.body ?? {};
  const seo = post.seo ?? {};

  const headline = str(seo.title) ?? str(props.headline) ?? str(body.title) ?? site.name;
  const description = str(seo.description) ?? str(props.description) ?? str(body.excerpt);
  // The featured image is the best article image; it's a media-asset id (or an
  // absolute URL) — mediaUrl resolves both to an absolute, CDN-served URL.
  const image =
    props.image !== undefined
      ? props.image
      : mediaUrl(typeof body.featuredImage === 'string' ? body.featuredImage : null, site.slug);
  const path = props.path ?? (post.slug ? `/blog/${post.slug}` : undefined);

  // Absolute address for mainEntityOfPage: the site's own origin, the host its
  // canonical link and sitemap name. It read the host that served the request with
  // `https://` in front, so on a plain-http host it named an address that does not
  // answer, and on a second host it named a second address for one piece.
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const origin = site.siteOrigin ?? (host ? `https://${host}` : undefined);
  const url = origin && path ? `${origin}${path}` : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': props.schemaType ?? 'BlogPosting',
    headline,
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    ...(url ? { mainEntityOfPage: { '@type': 'WebPage', '@id': url } } : {}),
    // The writer the piece names, once it names one (the CMS author picker). Without
    // one, the business itself is who published it.
    author: post.author?.display_name
      ? { '@type': 'Person', name: post.author.display_name }
      : { '@type': 'Organization', name: site.name },
    publisher: { '@type': 'Organization', name: site.name },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
