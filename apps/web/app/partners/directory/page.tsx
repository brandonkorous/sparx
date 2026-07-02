// Public partner directory (docs/114 §B.6). The discovery surface for businesses
// hiring a sparx partner — and social proof that the ecosystem exists. URL-driven
// SSR facets (tier / specialty / Remote) + a search-within (name/bio + location),
// certified-first result grid, and a cursor Load-more island. Degrades to a
// helpful empty state while the endpoint stands up.

import type { Metadata } from 'next';
import { Button, Input } from '@sparx/ui';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { SectionHeader } from '@/components/marketing/primitives';
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
    <>
      <Nav />
      <section
        style={{
          paddingTop: 'var(--section-py-lg)',
          paddingBottom: 'var(--section-py-lg)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <a
                href="/partners"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: 'var(--color-text-tertiary)',
                  textDecoration: 'none',
                }}
              >
                ← Partner program
              </a>
              <SectionHeader
                accent="var(--sparx-primary)"
                headlineSize={56}
                headline="Find a sparx partner"
                lede="Consultants, agencies, and developers who build and manage businesses on sparx. Certified partners first."
              />
              <form
                method="get"
                action="/partners/directory"
                className="mkt-cluster"
                style={{ gap: '8px' }}
              >
                {current.tier ? <input type="hidden" name="tier" value={current.tier} /> : null}
                {current.specialty ? (
                  <input type="hidden" name="specialty" value={current.specialty} />
                ) : null}
                {current.remote ? (
                  <input type="hidden" name="remote" value={current.remote} />
                ) : null}
                <Input
                  type="search"
                  name="q"
                  defaultValue={current.q ?? ''}
                  placeholder="Search partners…"
                  style={{ maxWidth: '260px' }}
                />
                <Input
                  type="text"
                  name="location"
                  defaultValue={current.location ?? ''}
                  placeholder="City or state"
                  style={{ maxWidth: '200px' }}
                />
                <Button type="submit" variant="outline">
                  Search
                </Button>
              </form>
            </div>

            <PartnerFacetBar facets={page.facets} current={current} />

            <div
              style={{
                borderTop: '1px solid var(--color-border-default)',
                paddingTop: '20px',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {showing > 0
                ? `${showing}${page.next_cursor ? '+' : ''} partner${showing === 1 ? '' : 's'}`
                : 'No partners yet'}
            </div>

            {showing > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="mkt-grid-3-2-1">
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
        </div>
      </section>
      <Footer />
    </>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '18px',
        padding: '64px 0',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '17px',
          color: 'var(--color-text-secondary)',
          margin: 0,
          maxWidth: '420px',
        }}
      >
        {filtered
          ? 'No partners match these filters yet. Try widening your search — or be the first here.'
          : 'No partners in your area yet. Want to be the first?'}
      </p>
      <div className="mkt-cluster" style={{ gap: '12px', justifyContent: 'center' }}>
        <a href="/partners#apply">
          <Button size="lg">Apply to become a partner →</Button>
        </a>
        {filtered ? (
          <a href="/partners/directory">
            <Button size="lg" variant="outline">
              Clear filters
            </Button>
          </a>
        ) : null}
      </div>
    </div>
  );
}
