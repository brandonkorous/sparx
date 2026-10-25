// The two authored tiers the catch-all route renders: a silica page, then a builder page.

import { notFound } from 'next/navigation';
import type { PublishedPageDto, PublishedSilicaPageDto } from '@wizeworks/builder-schemas';
import { resolveActivePropertySlug, type ResolvedSite } from '@/lib/site-context';
import { getPublishedBuilderStyles } from '@/lib/builder';
import { hostKeysIn, treeHasHostNode } from '@/lib/silica';
import { siteShowsPage } from '@/lib/site-modules';
import { buildSilicaHost, pageOutOfRange, silicaSiteIdentity } from '@/lib/silica-data';
import { loadBuilderData } from '@/lib/builder-data';
import { BuilderRenderer } from '@/components/builder-renderer';
import { SilicaBody, SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';

type SearchParams = Record<string, string | string[] | undefined>;

// A site with Selling off refuses pages whose host cores exist to sell; `?page=99` past the end is Not Found.
export async function SilicaSlugPage(props: {
  site: ResolvedSite;
  page: PublishedSilicaPageDto;
  slug: string;
  searchParams: SearchParams;
}) {
  const { site, page, slug, searchParams } = props;
  if (!siteShowsPage(site, { hostKeys: hostKeysIn(page.root) })) notFound();
  const { resolver, paging } = await buildSilicaHost(site.slug, page.root, {
    currency: site.commerce.defaultCurrency,
    locale: site.commerce.defaultLocale,
    site: silicaSiteIdentity(site),
    searchParams,
  });
  if (pageOutOfRange(paging)) notFound();
  // A host core (the faceted PLP on /shop) needs the React walk; pure content keeps the HTML path.
  if (!treeHasHostNode(page.root)) {
    return <SilicaBody root={page.root} symbols={page.symbols} host={resolver} />;
  }
  const renderHost = SiteHostRenderer({
    site,
    propertySlug: (await resolveActivePropertySlug()) ?? undefined,
    searchParams,
    paging,
    basePath: `/${slug}`,
  });
  return (
    <SilicaFunctionalBody
      root={page.root}
      symbols={page.symbols}
      host={resolver}
      renderHost={renderHost}
    />
  );
}

// In preview the DRAFT Surface sheet is injected so classes authored since the last publish resolve.
export async function BuilderSlugPage(props: {
  site: ResolvedSite;
  page: PublishedPageDto;
  sitePreview: string | undefined;
}) {
  const { site, page, sitePreview } = props;
  const data = await loadBuilderData(site.slug, page.tree);
  const draftCss = sitePreview
    ? await getPublishedBuilderStyles(site.slug, { previewToken: sitePreview })
    : '';
  return (
    <>
      {draftCss ? (
        <style data-surface-preview dangerouslySetInnerHTML={{ __html: draftCss }} />
      ) : null}
      <BuilderRenderer tree={page.tree} data={data} />
    </>
  );
}
