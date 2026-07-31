// Category browse (docs/60 §4 Category-browse tier, §8). The scale workhorse:
// search-within + facet bar + sort + paginated grid + result count, generic over
// any category via the registry + the public catalog API. A coming-soon category
// renders a teaser (M7) instead of live data. Public + indexable: filtering and
// sorting are URL-driven navigations; only "Load more" is a client island.

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Button, Input } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Display, Spark } from '@/components/marketing/primitives';
import { fetchCategory, signUpHref } from '@/lib/marketplace';
import { getCategory, type MarketplaceCategory } from '@/lib/marketplace-registry';
import { canonicalQueryString, type BrowseParams } from '@/lib/browse-params';
import { ListingCard } from '../_components/listing-card';
import { FacetBar } from '../_components/facet-bar';
import { ComponentPreviewStyles } from '../_components/component-preview-styles';
import { ComponentThemePicker } from '../_components/component-theme-picker';
import { PREVIEW_THEME_GROUPS } from '@/lib/preview-themes';
import { LoadMore } from './load-more';

export const revalidate = 300;

const SORT_KEYS = new Set(['popular', 'newest', 'name', 'price_low', 'price_high']);

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return { title: 'Marketplace — sparx' };

  // A filtered view is a slice of the same catalog, not its own page: it points
  // its canonical at the unfiltered category and asks not to be indexed. Only the
  // bare category page competes in search, which is also what keeps the facet
  // combination space out of the index entirely.
  const filtered = Object.keys(normalize(await searchParams)).length > 0;
  return {
    title: `${cat.label} — sparx Marketplace`,
    description: cat.tagline,
    alternates: { canonical: `/market/${cat.id}` },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Normalize the framework's searchParams into flat string params, dropping
 *  paging (the canonical filter/sort state used to build links + the fetch). */
function normalize(sp: SearchParams): BrowseParams {
  const out: BrowseParams = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v.join(',') : v;
    if (val) out[k] = val;
  }
  if (out.sort && !SORT_KEYS.has(out.sort)) delete out.sort;
  if (out.sort === 'popular') delete out.sort; // the default — never spell it out
  delete out.cursor;
  delete out.limit;
  return out;
}

/** Build a `/market/:cat?…` href from the current params with `sort` set. */
function sortHref(cat: MarketplaceCategory, current: BrowseParams, sort: string): string {
  const next: BrowseParams = { ...current, sort };
  if (sort === 'popular') delete next.sort; // popular is the default — keep URLs clean
  const qs = canonicalQueryString(cat.id, next);
  return `/market/${cat.id}${qs ? `?${qs}` : ''}`;
}

export default async function CategoryBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  const current = normalize(await searchParams);

  // One logical query, one URL. Any other spelling of the same selection (facet
  // values in click order, keys in arrival order) redirects here rather than
  // rendering — otherwise each spelling is its own page-cache entry AND its own
  // catalog fetch, and the space grows factorially. Safe from loops because
  // canonicalization is idempotent: the target always re-canonicalizes to itself.
  const canonical = canonicalQueryString(cat.id, current);
  if (canonical !== new URLSearchParams(current).toString()) {
    permanentRedirect(`/market/${cat.id}${canonical ? `?${canonical}` : ''}`);
  }

  if (cat.status !== 'live') {
    return <ComingSoonCategory cat={cat} />;
  }

  const page = await fetchCategory(cat.id, { ...current, limit: '24' });
  const activeSort = current.sort ?? 'popular';
  const showing = page.items.length;

  return (
    <Section surface="page" padding="lg">
      <div className="flex flex-col gap-10">
        {/* The one shared base-theme stylesheet every component preview on this page
            reads (docs/118) — emitted once here, not per card. */}
        {cat.id === 'components' ? <ComponentPreviewStyles /> : null}
        {/* Header */}
        <div className="flex flex-col gap-5">
          <a href="/market" className="text-ink-muted text-caption no-underline">
            ← Marketplace
          </a>
          <SectionHeader
            accent={cat.accent}
            headlineSize={56}
            headline={cat.label}
            lede={cat.tagline}
          />
          {/* Search-within */}
          <form
            method="get"
            action={`/market/${cat.id}`}
            className="flex flex-wrap items-center gap-2"
          >
            {current.sort ? <input type="hidden" name="sort" value={current.sort} /> : null}
            <Input
              type="search"
              name="q"
              defaultValue={current.q ?? ''}
              placeholder={`Search ${cat.label.toLowerCase()}…`}
              className="max-w-[320px]"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </div>

        {/* Facets */}
        <FacetBar category={cat} facetCounts={page.facets} current={current} />

        {/* Preview theme picker — re-themes every component preview on this page
            (light/dark + any of the 20 themes), affecting only the previews. */}
        {cat.id === 'components' ? (
          <div className="flex justify-end">
            <ComponentThemePicker groups={PREVIEW_THEME_GROUPS} />
          </div>
        ) : null}

        {/* Result count + sort */}
        <div className="border-base-300 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
          <span className="text-ink-muted text-small">
            {page.total} {page.total === 1 ? cat.singular : cat.label.toLowerCase()}
          </span>
          <div className="flex flex-wrap items-center gap-3.5">
            {cat.sorts.map((s) => {
              const isOn = activeSort === s.key;
              return (
                <a
                  key={s.key}
                  href={sortHref(cat, current, s.key)}
                  className={`text-caption no-underline ${isOn ? 'font-medium' : 'text-ink-muted'}`}
                >
                  {s.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* Grid + load more, or empty state */}
        {showing > 0 ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {page.items.map((item) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </div>
            {page.next_cursor ? (
              <LoadMore category={cat.id} query={current} initialCursor={page.next_cursor} />
            ) : null}
          </div>
        ) : (
          <EmptyState cat={cat} filtered={Object.keys(current).length > 0} />
        )}
      </div>
    </Section>
  );
}

function EmptyState({ cat, filtered }: { cat: MarketplaceCategory; filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-ink-muted text-body m-0">
        {filtered
          ? `No ${cat.label.toLowerCase()} match these filters yet.`
          : `No ${cat.label.toLowerCase()} published yet — check back soon.`}
      </p>
      {filtered ? (
        <a href={`/market/${cat.id}`}>
          <Button variant="outline">Clear filters</Button>
        </a>
      ) : null}
    </div>
  );
}

function ComingSoonCategory({ cat }: { cat: MarketplaceCategory }) {
  return (
    <Section surface="page" padding="xl">
      <div className="flex flex-col items-start gap-7">
        <a href="/market" className="text-ink-muted text-caption no-underline">
          ← Marketplace
        </a>
        {/* RULE #2: the uppercase "Coming soon" kicker that sat above this
            headline is gone — the lede below already says the category is next. */}
        <Display as="h1" size={72}>
          {cat.label}
          <Spark color={cat.accent} />
        </Display>
        <p className="text-ink-muted text-lede m-0 max-w-[560px]">
          {cat.tagline} This category is landing next — start with a blueprint today and add{' '}
          {cat.label.toLowerCase()} when they go live.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/market/blueprints">
            <Button color="neutral" size="lg">
              Browse blueprints
            </Button>
          </a>
          <a href={signUpHref()}>
            <Button size="lg" variant="outline">
              Start free
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
