// Public partner directory (docs/114 §B.6). The discovery surface for businesses
// hiring a sparx partner — and social proof that the ecosystem exists. URL-driven
// SSR facets (tier / specialty / Remote) + a search-within (name/bio + location),
// certified-first result grid, and a cursor Load-more island. Degrades to a
// helpful empty state while the endpoint stands up.
//
// Rebuilt onto `<Band>` alongside the rest of the marketing site. What was here
// opened with a 14px back-link and a `SectionHeader`, stacked its filters into
// three labelled rows, then ended — no close, no route back into the program.
// The grid was `lg:grid-cols-3`, which with the handful of partners the
// directory actually holds rendered one narrow card marooned in two empty
// columns; two is the honest maximum until the list is long enough to need three.

import type { Metadata } from 'next';
import { Button, Heading, Input, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '@/components/marketing/band';
import { fetchPartners } from '@/lib/partners';
import { PartnerDirectoryCard } from './_components/partner-card';
import { PartnerFacetBar, type DirectoryParams } from './_components/facet-bar';
import { DirectoryHero } from './_components/hero';
import { LoadMorePartners } from './_components/load-more';

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: 'Find a sparx partner — partner directory',
  description:
    'Browse sparx partners by the work you need doing, by tier, and by location. Consultants, agencies and developers who set businesses up on sparx and keep them running — contact them directly, with no introduction fee.',
  alternates: { canonical: '/partners/directory' },
  openGraph: {
    title: 'Find someone to build it with you',
    description:
      'Consultants, agencies and developers who build and run businesses on sparx. Filter by specialty and location, then contact them directly.',
    url: 'https://sparx.works/partners/directory',
    type: 'website',
  },
};

function normalize(sp: SearchParams): DirectoryParams {
  const out: DirectoryParams = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v.join(',') : v;
    if (val) out[k] = val;
  }
  delete out.cursor;
  delete out.limit;
  return out;
}

export default async function PartnerDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const current = normalize(await searchParams);
  const page = await fetchPartners({ ...current, limit: '24' });
  const showing = page.items.length;
  const filtered = Object.keys(current).length > 0;

  return (
    <main>
      <DirectoryHero tierFacets={page.facets.tier} specialtyCount={page.facets.specialty.length} />

      <Band id="results" tone="page">
        <div className="flex flex-col gap-8">
          {/* Search and facets are ONE control block. They were separated by a
              200px stack of labelled filter rows, so the two halves of "narrow
              this down" did not read as belonging to each other. */}
          <div className="flex flex-col gap-5">
            <form
              method="get"
              action="/partners/directory"
              className="flex flex-wrap items-center gap-2.5"
            >
              {current.tier ? <input type="hidden" name="tier" value={current.tier} /> : null}
              {current.specialty ? (
                <input type="hidden" name="specialty" value={current.specialty} />
              ) : null}
              {current.remote ? <input type="hidden" name="remote" value={current.remote} /> : null}
              <Input
                type="search"
                name="q"
                size="lg"
                defaultValue={current.q ?? ''}
                aria-label="Search partners by name or description"
                placeholder="Search by name or what they do…"
                className="w-full max-w-sm"
              />
              <Input
                type="text"
                name="location"
                size="lg"
                defaultValue={current.location ?? ''}
                aria-label="City or state"
                placeholder="City or state"
                className="w-full max-w-[13rem]"
              />
              {/* The form's own action, solid. It was `variant="outline"` — the
                  one button on the page whose entire job is to be pressed. */}
              <Button type="submit" size="lg" color="primary">
                Search
              </Button>
            </form>

            <PartnerFacetBar facets={page.facets} current={current} />
          </div>

          <div className="border-base-300 border-t pt-6">
            <Text className="text-lg">
              {showing > 0
                ? `${showing}${page.next_cursor ? '+' : ''} ${showing === 1 ? 'partner' : 'partners'}${
                    filtered ? ' match what you asked for.' : ' listed.'
                  }`
                : 'Nothing here yet.'}
            </Text>
          </div>

          {showing > 0 ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                {page.items.map((p) => (
                  <PartnerDirectoryCard key={p.id} partner={p} />
                ))}
              </div>
              {page.next_cursor ? (
                <LoadMorePartners query={current} initialCursor={page.next_cursor} />
              ) : null}
            </div>
          ) : (
            <EmptyState filtered={filtered} />
          )}
        </div>
      </Band>

      <ClosingBand />
    </main>
  );
}

/**
 * The empty state. Left-aligned and at real size — it was centred 14px prose,
 * which is how a page apologises. There is nothing to apologise for: an empty
 * directory on a program that is opening is an invitation, and it says so.
 */
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-col items-start gap-5 rounded-4xl border p-10">
      <Heading level={2} size={3} className="tracking-tight">
        {filtered ? 'Nothing matches that yet' : 'No partners listed here yet'}
      </Heading>
      <Text variant="lead" className="max-w-2xl">
        {filtered
          ? 'Try dropping a filter — the directory is young, so a narrow search often comes back empty where a wider one would not.'
          : 'The program is opening now. If you build sites for other businesses, this is a good moment to be the first name on the page.'}
      </Text>
      <div className="flex flex-wrap gap-3">
        <a
          href="/partners#apply"
          className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
        >
          Become a partner &rarr;
        </a>
        {filtered ? (
          <a
            href="/partners/directory"
            className={buttonClasses({ size: 'lg', variant: 'outline' })}
          >
            Clear filters
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** The close the page never had — it simply stopped after the last card. */
function ClosingBand() {
  return (
    <Band tone="dark">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-6">
          <Heading
            level={2}
            size="display"
            className="text-5xl leading-[0.95] tracking-tight sm:text-6xl"
          >
            Do this for a living
            <span className="text-primary">?</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-xl">
            Everyone on this page earns on the clients they bring over and keeps the fee they charge
            for the work itself. Listing is free and there is no quota.
          </Text>
        </div>
        <div className="flex flex-col items-start gap-3.5">
          <a
            href="/partners#apply"
            aria-label="Become a partner"
            className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
          >
            Become a partner &rarr;
          </a>
          <a
            href="/partners#earnings"
            aria-label="See what it pays"
            className={buttonClasses({ size: 'xl', variant: 'outline' })}
          >
            See what it pays
          </a>
        </div>
      </div>
    </Band>
  );
}
