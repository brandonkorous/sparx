// Public partner directory (docs/114 §B.6). The discovery surface for businesses
// hiring a sparx partner — and social proof that the ecosystem exists. URL-driven
// SSR facets (tier / specialty / Remote) + a search-within (name/bio + location),
// certified-first result grid, and a cursor Load-more island. Degrades to a
// helpful empty state while the endpoint stands up.

import type { Metadata } from 'next';
import { Button, Input, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Section, SectionHeader } from '@/components/marketing/primitives';
import { fetchPartners } from '@/lib/partners';
import { PartnerDirectoryCard } from './_components/partner-card';
import { PartnerFacetBar, type DirectoryParams } from './_components/facet-bar';
import { LoadMorePartners } from './_components/load-more';

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: 'Find a sparx partner — partner directory',
  description:
    'Browse certified sparx partners by tier, specialty, and location. Consultants, agencies, and developers who build and manage businesses on sparx.',
  alternates: { canonical: '/partners/directory' },
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
    <Section padding="lg">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-5">
          <a href="/partners" className="text-caption text-ink-subtle no-underline">
            ← Partner program
          </a>
          <SectionHeader
            accent="var(--color-primary)"
            headlineSize={56}
            headline="Find a sparx partner"
            lede="Consultants, agencies, and developers who build and manage businesses on sparx. Certified partners first."
          />
          <form
            method="get"
            action="/partners/directory"
            className="flex flex-wrap items-center gap-2"
          >
            {current.tier ? <input type="hidden" name="tier" value={current.tier} /> : null}
            {current.specialty ? (
              <input type="hidden" name="specialty" value={current.specialty} />
            ) : null}
            {current.remote ? <input type="hidden" name="remote" value={current.remote} /> : null}
            <Input
              type="search"
              name="q"
              defaultValue={current.q ?? ''}
              placeholder="Search partners…"
              className="max-w-[260px]"
            />
            <Input
              type="text"
              name="location"
              defaultValue={current.location ?? ''}
              placeholder="City or state"
              className="max-w-[200px]"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </div>

        <PartnerFacetBar facets={page.facets} current={current} />

        <Text className="border-base-300 text-small text-ink-muted border-t pt-5">
          {showing > 0
            ? `${showing}${page.next_cursor ? '+' : ''} partner${showing === 1 ? '' : 's'}`
            : 'No partners yet'}
        </Text>

        {showing > 0 ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    </Section>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-[18px] py-16 text-center">
      <Text className="text-body-lg text-ink-muted max-w-[420px]">
        {filtered
          ? 'No partners match these filters yet. Try widening your search — or be the first here.'
          : 'No partners in your area yet. Want to be the first?'}
      </Text>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="/partners#apply" className={buttonClasses({ size: 'lg' })}>
          Apply to become a partner →
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
