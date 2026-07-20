// The storefront's map of pinned-core key → real interactive component (docs/122).
// silica lowers a `kind:"host"` node to an empty `<div data-sui-host="<key>">`; the
// React walk (`SilicaFunctionalBody`) mounts the component this registry returns at
// that node, so a tenant's editable shell wraps the LIVE transaction, never a mock.
//
// This is the site half of the contract whose keys live in @sparx/silica-catalog
// (`HOST_KEYS`); the dashboard half maps the same keys to canvas skeletons. A key with
// no case here renders an empty wrapper — so an entry is added only once its real
// component is wired (never a palette core that renders nothing live).
//
// A server module (no 'use client'): it only RETURNS client-component elements, the
// standard RSC pattern — the walk runs server-side and each core hydrates as an island.

import { HOST_KEYS } from '@sparx/silica-catalog';
import type { HostNode } from '@wizeworks/silicaui-html';
import type { HostRenderer } from '@/components/silica-chrome';

import { CartView } from '@/components/cart-view';
import { SearchExperience, type SearchParams } from '@/components/search/search-experience';
import { ProductListing } from '@/components/products/product-listing';
import { CollectionIndex } from '@/components/collections/collection-index';
import { CategoryIndex } from '@/components/category/category-index';
import { CategoryDetail } from '@/components/category/category-detail';
import { BookingServices } from '@/components/booking/booking-services';
import { BookingServiceDetail } from '@/components/booking/booking-service-detail';
import { AccountAuth, toAuthMode } from '@/components/account/account-auth';
import { SiteBrand, toBrandShow } from '@/components/brand/site-brand';
import { ArticleBody } from '@/components/cms/article-body';
import { mediaUrl } from '@/lib/media';
import type { ResolvedSite } from '@/lib/site-context';

/** Route-supplied context a core may need beyond its author-set `node.props` — the
 *  resolved site + route params the storefront already has in hand. A host node can't
 *  read the URL or resolve the tenant itself, so the route passes what its cores need;
 *  the context is a superset (each core reads only its slice — the cart needs nothing,
 *  search needs `searchParams`). */
export interface HostCoreContext {
  site: ResolvedSite;
  propertySlug?: string;
  /** The route's resolved URL search params — for cores whose state lives in the URL
   *  (search filters/sort/page). Absent for cores that don't read it. */
  searchParams?: SearchParams;
  /** The in-scope record's URL handle, for a per-record template whose core resolves by
   *  handle (the category-detail core). Absent for non-per-record cores. */
  recordHandle?: string;
  /** The in-scope record's id, for a per-record template whose core resolves by id (the
   *  booking-service-detail core). Absent for non-per-record cores. */
  recordId?: string;
  /** The in-scope CMS entry's rich-text doc, for the article-body core. Passed as DATA
   *  rather than fetched by the core because the route already holds the entry it
   *  resolved the template for — re-reading it here would be a second round trip for a
   *  document we have in hand. */
  articleDoc?: unknown;
}

/** Build the storefront `HostRenderer` for a route — a single switch over the pinned
 *  keys, closing over the route's context. Passed to `SilicaFunctionalBody`. This is a
 *  render CALLBACK invoked imperatively by the walk, not a React component (hence the
 *  lowercase name — it never appears in JSX as `<mountHostCore/>`). */
export function storefrontHostRenderer(ctx: HostCoreContext): HostRenderer {
  return function mountHostCore(node: HostNode): React.ReactNode {
    switch (node.component) {
      case HOST_KEYS.commerceCart:
        // Self-contained: cart state is client-side, so no props/context needed.
        return <CartView />;
      case HOST_KEYS.commerceSearch:
        return <SearchExperience site={ctx.site} searchParams={ctx.searchParams ?? {}} />;
      case HOST_KEYS.commercePlp:
        return <ProductListing site={ctx.site} searchParams={ctx.searchParams ?? {}} />;
      case HOST_KEYS.commerceCollections:
        return <CollectionIndex site={ctx.site} />;
      case HOST_KEYS.commerceCategories:
        return <CategoryIndex site={ctx.site} />;
      case HOST_KEYS.schedulingServices:
        // Self-contained: resolves the tenant from the request host, no props/context.
        return <BookingServices />;
      case HOST_KEYS.commerceCategoryDetail:
        // Per-record: the route passes the category handle (+ page in searchParams).
        return (
          <CategoryDetail
            site={ctx.site}
            handle={ctx.recordHandle ?? ''}
            searchParams={ctx.searchParams}
          />
        );
      case HOST_KEYS.schedulingServiceDetail:
        // Per-record: the route passes the service id.
        return <BookingServiceDetail serviceId={ctx.recordId ?? ''} />;
      case HOST_KEYS.commerceAuth:
        // Mode-parameterized: the composite/route bakes `mode` into the node's props
        // (signin | register | forgot | reset); the form reads its own URL params.
        return <AccountAuth mode={toAuthMode(node.props?.mode)} />;
      case HOST_KEYS.cmsArticleBody:
        // Per-record: the route passes the entry's doc. `node.class` is deliberately NOT
        // forwarded — the walk already puts it on the host wrapper this mounts inside, so
        // passing it again would apply the author's measure and padding twice (a max-w-3xl
        // inside a max-w-3xl, py-10 doubled). The brand core forwards it because it renders
        // an inline mark whose own sizing classes matter; a prose block just fills its shell.
        return <ArticleBody doc={ctx.articleDoc} />;
      case HOST_KEYS.siteBrand:
        // The brand mark — resolved straight off the site the route already has, so the
        // header always reflects what's in Site settings right now. `show` is the
        // author's Inspector choice; `node.class` is their styling, which wins over the
        // component's default so the mark stays theirs to place.
        return (
          <SiteBrand
            name={ctx.site.name}
            logoUrl={mediaUrl(ctx.site.theme?.logoMediaId ?? null, ctx.site.slug)}
            logoDarkUrl={mediaUrl(ctx.site.theme?.logoDarkMediaId ?? null, ctx.site.slug)}
            show={toBrandShow(node.props?.show)}
            {...(node.class ? { className: node.class } : {})}
          />
        );
      default:
        return null;
    }
  };
}
