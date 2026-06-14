// Blog post route (docs/44 §3 B — the per-record router for CMS content). Server-
// loads the published `blog_post` entry at `/blog/<slug>`, resolves the tenant's
// published `cms.blog_post` collection template, binds THIS entry into it, and
// renders through the shared BuilderRenderer — the CMS analogue of the product PDP
// (apps/site/app/products/[handle]). Falls back to a bare PageView when no builder
// template is published, so a tenant without a blog layout still serves the post;
// a tenant-managed redirect or 404 when no such post exists.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticleJsonLd } from '@/components/article-json-ld';
import { BuilderRenderer } from '@/components/builder-renderer';
import { PageView } from '@/components/page-view';
import { getPublishedBuilderCollection } from '@/lib/builder';
import { loadBuilderData, postToBuilderRecord } from '@/lib/builder-data';
import { getBlogPostBySlug } from '@/lib/content';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { applyRedirect } from '@/lib/redirects';
import { resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

interface BlogPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sparxPreview?: string }>;
}

export async function generateMetadata({ params, searchParams }: BlogPageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  const { slug } = await params;
  const previewToken = (await searchParams)?.sparxPreview;
  const post = await getBlogPostBySlug(site.slug, slug, previewToken ? { previewToken } : {});
  if (!post) return {};

  const body = post.body ?? {};
  // Per-entry SEO authored in the CMS editor (docs/50). title/description override
  // the body; canonical, social image, and the index toggle are honoured below so
  // none of those authoring controls is a dead end.
  const seo = post.seo ?? {};
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const seoTitle = str(seo.title);
  const seoDescription = str(seo.description);
  const canonical = str(seo.canonical);
  const title = seoTitle ?? body.title ?? site.name;
  const description = seoDescription ?? body.excerpt ?? undefined;
  // OG image: the author's chosen social image wins (a media id or absolute URL),
  // then the post's featured image, then a tenant-branded generated card.
  const seoOg = str(seo.ogImage);
  const ogImage =
    (seoOg ? (seoOg.startsWith('http') ? seoOg : mediaUrl(seoOg, site.slug)) : undefined) ??
    mediaUrl(typeof body.featuredImage === 'string' ? body.featuredImage : null, site.slug) ??
    ogImageUrl({
      title: body.title ?? site.name,
      eyebrow: 'Article',
      brand: site.name,
      accent: site.theme?.colorPrimary,
    });
  // Indexable only when published AND the author hasn't flagged the entry noindex.
  const noindex = typeof seo.robots === 'string' && seo.robots.includes('noindex');
  const indexable = post.status === 'published' && !noindex;
  return {
    title,
    ...(description ? { description } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      images: [{ url: ogImage }],
    },
    robots: indexable ? { index: true, follow: true } : { index: false },
  };
}

export default async function BlogPostPage({ params, searchParams }: BlogPageProps) {
  const site = await resolveSite();
  if (!site) notFound();
  const { slug } = await params;
  const previewToken = (await searchParams)?.sparxPreview;

  const post = await getBlogPostBySlug(site.slug, slug, previewToken ? { previewToken } : {});
  if (!post) {
    // Last chance before 404: a tenant-managed redirect for this path.
    await applyRedirect(site.slug, `/blog/${slug}`);
    notFound();
  }

  // The generic per-record router (docs/44 §3 B): a published `cms.blog_post`
  // collection template renders the post through the node tree, binding THIS entry
  // as `blog_post`. Falls through to the legacy render when none is published.
  const builderTemplate = await getPublishedBuilderCollection(site.slug, 'cms.blog_post', post.id);
  if (builderTemplate) {
    const data = await loadBuilderData(site.slug, builderTemplate.tree, {
      key: 'blog_post',
      value: postToBuilderRecord(post, site.slug),
    });
    return (
      <>
        <ArticleJsonLd post={post} site={site} />
        <BuilderRenderer tree={builderTemplate.tree} data={data} />
      </>
    );
  }

  // No builder template published — degrade to a bare CMS article so the post is
  // still readable (PageView already renders the body doc + title).
  return (
    <>
      <ArticleJsonLd post={post} site={site} />
      <PageView entry={post} />
    </>
  );
}
