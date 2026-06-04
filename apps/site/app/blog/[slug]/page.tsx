// Blog post route (docs/44 §3 B — the per-record router for CMS content). Server-
// loads the published `blog_post` entry at `/blog/<slug>`, resolves the tenant's
// published `cms.blog_post` collection template, binds THIS entry into it, and
// renders through the shared BuilderRenderer — the CMS analogue of the product PDP
// (apps/site/app/products/[handle]). Falls back to a bare PageView when no builder
// template is published, so a tenant without a blog layout still serves the post;
// a tenant-managed redirect or 404 when no such post exists.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BuilderRenderer } from '@/components/builder-renderer';
import { PageView } from '@/components/page-view';
import { getPublishedBuilderCollection } from '@/lib/builder';
import { loadBuilderData, postToBuilderRecord } from '@/lib/builder-data';
import { getBlogPostBySlug } from '@/lib/content';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { applyRedirect } from '@/lib/redirects';
import { resolveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

interface BlogPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sparxPreview?: string }>;
}

export async function generateMetadata({ params, searchParams }: BlogPageProps): Promise<Metadata> {
  const tenant = await resolveTenant();
  if (!tenant) return {};
  const { slug } = await params;
  const previewToken = (await searchParams)?.sparxPreview;
  const post = await getBlogPostBySlug(tenant.slug, slug, previewToken ? { previewToken } : {});
  if (!post) return {};

  const body = post.body ?? {};
  const seo = post.seo ?? {};
  const seoTitle = typeof seo.title === 'string' && seo.title ? seo.title : undefined;
  const seoDescription =
    typeof seo.description === 'string' && seo.description ? seo.description : undefined;
  const title = seoTitle ?? body.title ?? tenant.name;
  const description = seoDescription ?? body.excerpt ?? undefined;
  // The featured image is the best OG card; else a tenant-branded generated one.
  const featured =
    mediaUrl(typeof body.featuredImage === 'string' ? body.featuredImage : null, tenant.slug) ??
    ogImageUrl({
      title: body.title ?? tenant.name,
      eyebrow: 'Article',
      brand: tenant.name,
      accent: tenant.theme?.colorPrimary,
    });
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      images: [{ url: featured }],
    },
    robots: post.status === 'published' ? { index: true, follow: true } : { index: false },
  };
}

export default async function BlogPostPage({ params, searchParams }: BlogPageProps) {
  const tenant = await resolveTenant();
  if (!tenant) notFound();
  const { slug } = await params;
  const previewToken = (await searchParams)?.sparxPreview;

  const post = await getBlogPostBySlug(tenant.slug, slug, previewToken ? { previewToken } : {});
  if (!post) {
    // Last chance before 404: a tenant-managed redirect for this path.
    await applyRedirect(tenant.slug, `/blog/${slug}`);
    notFound();
  }

  // The generic per-record router (docs/44 §3 B): a published `cms.blog_post`
  // collection template renders the post through the node tree, binding THIS entry
  // as `blog_post`. Falls through to the legacy render when none is published.
  const builderTemplate = await getPublishedBuilderCollection(tenant.slug, 'cms.blog_post');
  if (builderTemplate) {
    const data = await loadBuilderData(tenant.slug, builderTemplate.tree, {
      key: 'blog_post',
      value: postToBuilderRecord(post, tenant.slug),
    });
    return <BuilderRenderer tree={builderTemplate.tree} data={data} />;
  }

  // No builder template published — degrade to a bare CMS article so the post is
  // still readable (PageView already renders the body doc + title).
  return <PageView entry={post} />;
}
