// Category browse (docs/60 §4 Category-browse tier, §8). The scale workhorse:
// search-within + facet bar + sort + paginated grid + result count, generic over
// any category via the registry + the public catalog API. A coming-soon category
// renders a teaser (M7) instead of live data. Public + indexable: filtering and
// sorting are URL-driven navigations; only "Load more" is a client island.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, Input } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Display, Spark } from '@/components/marketing/primitives';
import { fetchCategory, signUpHref } from '@/lib/marketplace';
import { getCategory, type MarketplaceCategory } from '@/lib/marketplace-registry';
import { ListingCard } from '../_components/listing-card';
import { FacetBar, type BrowseParams } from '../_components/facet-bar';
import { LoadMore } from './load-more';

export const revalidate = 300;

const SORT_KEYS = new Set(['popular', 'newest', 'name', 'price_low', 'price_high']);

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return { title: 'Marketplace — sparx' };
  return {
    title: `${cat.label} — sparx Marketplace`,
    description: cat.tagline,
    alternates: { canonical: `/market/${cat.id}` },
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
  delete out.cursor;
  delete out.limit;
  return out;
}

/** Build a `/market/:cat?…` href from the current params with `sort` set. */
function sortHref(cat: MarketplaceCategory, current: BrowseParams, sort: string): string {
  const next: BrowseParams = { ...current, sort };
  if (sort === 'popular') delete next.sort; // popular is the default — keep URLs clean
  const qs = new URLSearchParams(next).toString();
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

  if (cat.status !== 'live') {
    return <ComingSoonCategory cat={cat} />;
  }

  const page = await fetchCategory(cat.id, { ...current, limit: '24' });
  const activeSort = current.sort ?? 'popular';
  const showing = page.items.length;

  return (
    <Section surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <a
            href="/market"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              textDecoration: 'none',
            }}
          >
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
            className="mkt-cluster"
            style={{ gap: '8px' }}
          >
            {current.sort ? <input type="hidden" name="sort" value={current.sort} /> : null}
            <Input
              type="search"
              name="q"
              defaultValue={current.q ?? ''}
              placeholder={`Search ${cat.label.toLowerCase()}…`}
              style={{ maxWidth: '320px' }}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </div>

        {/* Facets */}
        <FacetBar category={cat} facetCounts={page.facets} current={current} />

        {/* Result count + sort */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            borderTop: '1px solid var(--color-base-300)',
            paddingTop: '20px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            }}
          >
            {page.total} {page.total === 1 ? cat.singular : cat.label.toLowerCase()}
          </span>
          <div className="mkt-cluster" style={{ gap: '14px' }}>
            {cat.sorts.map((s) => {
              const isOn = activeSort === s.key;
              return (
                <a
                  key={s.key}
                  href={sortHref(cat, current, s.key)}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: isOn ? 500 : 400,
                    color: isOn
                      ? 'var(--color-base-content)'
                      : 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                    textDecoration: 'none',
                  }}
                >
                  {s.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* Grid + load more, or empty state */}
        {showing > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="mkt-grid-3-2-1">
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '64px 0',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '16px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          margin: 0,
        }}
      >
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          alignItems: 'flex-start',
        }}
      >
        <a
          href="/market"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            textDecoration: 'none',
          }}
        >
          ← Marketplace
        </a>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '11px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: cat.accent,
          }}
        >
          Coming soon
        </span>
        <Display as="h1" size={72}>
          {cat.label}
          <Spark color={cat.accent} />
        </Display>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '18px',
            lineHeight: '30px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            maxWidth: '560px',
            margin: 0,
          }}
        >
          {cat.tagline} This category is landing next — start with a blueprint today and add{' '}
          {cat.label.toLowerCase()} when they go live.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/market/blueprints">
            <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
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
