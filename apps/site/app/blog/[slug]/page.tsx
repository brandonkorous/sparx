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
// `postToBuilderRecord` shapes a post for the RESOLVER, not for the deleted builder
// renderer — the silica host reads the same record shape, so the name outlived the tier.
import { postToBuilderRecord } from '@/lib/builder-data';
import { getPublishedSilicaCollection } from '@/lib/silica';
import { buildSilicaHost } from '@/lib/silica-data';
import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';
import { getBlogPostBySlug } from '@/lib/content';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { applyRedirect } from '@/lib/redirects';
import { resolveSite } from '@/lib/site-context';

// NO `force-dynamic` (docs/127 §6). It was doing two things and only one was wanted:
// forcing dynamic rendering, and forcing `no-store` on every fetch beneath it — which
// overrode the revalidate window + purge tags each read in lib/* already declares. This
// route still renders per-request either way, because `resolveSite()` reads the Host
// header; what changed is that its data is now cached and purged on publish.

interface BlogPageProps {
  params: Promise<{ slug: string }>;
  // `sparxPreview` authorizes a DRAFT post (the CMS entry); `sparxSitePreview`
  // authorizes the DRAFT blog-post TEMPLATE (the builder tree that renders it). Two
  // different drafts, two different tokens — an author restyling the template needs
  // the second one even when the post itself is long published.
  searchParams?: Promise<{ sparxPreview?: string; sparxSitePreview?: string }>;
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
  const sp = (await searchParams) ?? {};
  const previewToken = sp.sparxPreview;
  const sitePreview = sp.sparxSitePreview;

  const post = await getBlogPostBySlug(site.slug, slug, previewToken ? { previewToken } : {});
  if (!post) {
    // Last chance before 404: a tenant-managed redirect for this path.
    await applyRedirect(site.slug, `/blog/${slug}`);
    notFound();
  }

  // The silica engine's published `cms.blog_post` collection template wins first
  // (docs/118 Stage 6), mirroring the PDP: render through the shared silica walker
  // with THIS entry injected as the `blog_post` object scope. The record shape
  // (`title` / `excerpt` / `featuredImage:{url,alt}` / `date`) is the same one the
  // sparx path binds, so `postToBuilderRecord` serves both. Null → fall through.
  const silicaTemplate = await getPublishedSilicaCollection(
    site.slug,
    'cms.blog_post',
    post.id,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (silicaTemplate) {
    // No `searchParams`: a post is one record, so nothing on this page paginates.
    const { resolver } = await buildSilicaHost(site.slug, silicaTemplate.root, {
      record: { key: 'blog_post', value: postToBuilderRecord(post, site.slug) },
      currency: site.commerce.defaultCurrency,
      locale: site.commerce.defaultLocale,
    });
    // The FUNCTIONAL walk, not the HTML-string one: a post template's whole point is
    // showing the written body, and the body is a rich-text document no binding can
    // render — it mounts through the `cms.article-body` host core, which only exists in
    // React. The string path would leave it an empty `<div data-sui-host>`, i.e. a post
    // page with everything except the post.
    return (
      <>
        <ArticleJsonLd post={post} site={site} />
        <SilicaFunctionalBody
          root={silicaTemplate.root}
          symbols={silicaTemplate.symbols}
          host={resolver}
          renderHost={SiteHostRenderer({
            site,
            recordId: post.id,
            articleDoc: post.body?.body ?? null,
          })}
        />
      </>
    );
  }

  // UNREACHABLE below this point (docs/127 §6). Two tiers used to follow — a published
  // sparx-builder `cms.blog_post` template, then a bare `PageView` of the entry —
  // and neither could run: the silica branch above takes every post, because a 404
  // from api-rest resolves to the code-authored `cms.blog_post` record template, and
  // that template is guaranteed to exist by `RECORD_TEMPLATES` + its exhaustiveness
  // test. (`cms.blog_post` going missing from the OLD if-chain is precisely the silent
  // bug that registry was built to make impossible — see record-templates.ts.)
  //
  // Loud, not silent: a post rendering as a blank draft with nothing to explain why is
  // the exact failure this route has already had once.
  throw new Error(`No silica template resolved for blog post "${post.slug ?? post.id}"`);
}
