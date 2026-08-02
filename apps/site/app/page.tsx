// Storefront home. Renders the silica engine's published HOME body — the tenant's own
// tree once they publish one, and the code-authored starter until then, so a brand-new
// site is live rather than blank. That is the ONLY tier; see the note at the bottom of
// the component for what used to sit beneath it and why it could never run.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPublishedSilicaHome, treeHasHostNode } from '@/lib/silica';
import { buildSilicaHost } from '@/lib/silica-data';
import { SilicaBody, SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';
import { ogImageUrl } from '@/lib/og';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

// NO `force-dynamic` (docs/127 §6). It was doing two things and only one was wanted:
// forcing dynamic rendering, and forcing `no-store` on every fetch beneath it — which
// overrode the revalidate window + purge tags each read in lib/* already declares. This
// route still renders per-request either way, because `resolveSite()` reads the Host
// header; what changed is that its data is now cached and purged on publish.

interface RootPageProps {
  // Open-ended beyond the two preview tokens: a home page can carry a paginated list
  // (a product grid, a journal index), whose `?page=` — or `?page-blog-post=` when
  // two lists share the URL — is read by the data loader rather than named here.
  searchParams?: Promise<
    { sparxPreview?: string; sparxSitePreview?: string } & Record<
      string,
      string | string[] | undefined
    >
  >;
}

// The silica engine's published HOME page owns `/` (docs/118 Stage 6) — title it
// from its own SEO fields, mirroring the [...slug] route's silica branch. Every
// other home path (legacy Builder, Site Builder, empty-store) keeps the generic
// layout-level fallback, unchanged.
export async function generateMetadata({ searchParams }: RootPageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  // Same preview token as the body below: an author previewing an unpublished home
  // should see its unpublished title/description too, not the live page's.
  const sitePreview = (await searchParams)?.sparxSitePreview;
  const silicaHome = await getPublishedSilicaHome(
    site.slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (!silicaHome) return {};

  const clean = (v: string | null): string | undefined => {
    const t = v?.trim();
    return t && t.length > 0 ? t : undefined;
  };
  const title = clean(silicaHome.seoTitle) ?? site.name;
  const description = clean(silicaHome.seoDescription);
  const canonical = clean(silicaHome.canonical);
  const ogImage =
    clean(silicaHome.ogImage) ??
    ogImageUrl({
      title: clean(silicaHome.seoTitle) ?? site.name,
      eyebrow: 'Home',
      brand: site.name,
      accent: site.theme?.colorPrimary,
    });
  return {
    title,
    ...(description ? { description } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: { title, ...(description ? { description } : {}), images: [{ url: ogImage }] },
    robots: silicaHome.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function SiteRoot({ searchParams }: RootPageProps) {
  const site = await resolveSite();
  if (!site) notFound();

  const sp = (await searchParams) ?? {};

  // The silica engine's published HOME body (docs/118 Stage 6) owns `/` and wins
  // over every path below — the same additive rule, one layer up. Rendered end to
  // end through `renderSilicaBody` (SilicaBody), bindings resolved against the sparx
  // host built over its data needs. Null until a silica home is published.
  //
  // A `?sparxSitePreview=` token serves the DRAFT home. This read used to ignore the
  // token entirely — `sp.sparxSitePreview` was only consulted further down, on the
  // legacy paths — and because the silica branch ALWAYS resolves (the code starter is
  // the universal fallback), Preview could never show unpublished work on `/`, the page
  // authors edit most. A tenant who had never published saw the starter instead.
  const silicaHome = await getPublishedSilicaHome(
    site.slug,
    sp.sparxSitePreview ? { previewToken: sp.sparxSitePreview } : {}
  );
  if (silicaHome) {
    const { resolver, paging } = await buildSilicaHost(site.slug, silicaHome.root, {
      currency: site.commerce.defaultCurrency,
      locale: site.commerce.defaultLocale,
      // Where `?page=` is read from. A home page carrying a product grid or a journal
      // index is paginated like any other, and without this it was permanently stuck
      // on the first 24 records with no way to say so.
      searchParams: sp,
    });
    // A home page that embeds a host core — the page-links core under a grid, a theme
    // toggle, the brand mark — renders through the React walk so the core mounts live.
    // This branch did not exist: every core on a home page lowered to an empty div and
    // silently rendered nothing, which the catch-all route has always handled.
    if (treeHasHostNode(silicaHome.root)) {
      return (
        <SilicaFunctionalBody
          root={silicaHome.root}
          symbols={silicaHome.symbols}
          host={resolver}
          renderHost={SiteHostRenderer({
            site,
            propertySlug: (await resolveActivePropertySlug()) ?? undefined,
            searchParams: sp,
            paging,
            basePath: '/',
          })}
        />
      );
    }
    return <SilicaBody root={silicaHome.root} symbols={silicaHome.symbols} host={resolver} />;
  }

  // UNREACHABLE, and deliberately loud rather than a fallback.
  //
  // Three tiers used to live here — a published sparx-Builder home, a Site Builder
  // section composition, and a hand-composed "empty store" homepage. All three were
  // dead code: `getPublishedSilicaHome` cannot return null once `site` resolves,
  // because api-rest 404s when nothing is published and the client answers that 404
  // with the code-authored starter, whose `starterPages` always contains a Home at `/`
  // (silica-catalog/site.ts). The tiers could not run, but they still had to be read,
  // maintained and reasoned about by anyone touching this route — and one of them
  // hardcoded selling copy onto the homepage of a platform that is content AND/OR
  // commerce.
  //
  // A `throw` rather than a silent fallback: if that invariant is ever broken, this
  // says so on the first request instead of quietly rendering a tier nobody has looked
  // at in months.
  throw new Error(`No silica home resolved for site "${site.slug}" — see lib/silica.ts`);
}
