// The /bootcamp faceted directory section (docs/114 §B.6). Rendered inline on the
// bootcamp page below the marketing sections. URL-driven SSR facets (format /
// when / where) + a title search-within, result grid, cursor Load-more island,
// and a helpful empty state. Anchored #directory so the hero "Find a bootcamp"
// CTA and the facet links land here.

import { Button, Input } from '@sparx/ui';
import { SectionHeader } from '@/components/marketing/primitives';
import type { BootcampListResponse } from '@/lib/bootcamp';
import { BootcampDirectoryCard } from './bootcamp-card';
import { BootcampFacetBar, type BootcampParams, type DatePreset } from './facet-bar';
import { LoadMoreBootcamps } from './load-more';

export function BootcampDirectory({
  page,
  current,
  datePresets,
}: {
  page: BootcampListResponse;
  current: BootcampParams;
  datePresets: DatePreset[];
}) {
  const showing = page.items.length;
  const filtered = Object.keys(current).length > 0;

  return (
    <section
      id="directory"
      style={{
        paddingTop: 'var(--section-py-lg)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-bg-page)',
        borderTop: '1px solid var(--color-border-default)',
        scrollMarginTop: '80px',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <SectionHeader accent="var(--module-commerce)" headline={<>Upcoming bootcamps</>} />
            <form method="get" action="/bootcamp" className="mkt-cluster" style={{ gap: '8px' }}>
              {current.format ? <input type="hidden" name="format" value={current.format} /> : null}
              {current.location ? (
                <input type="hidden" name="location" value={current.location} />
              ) : null}
              {current.from ? <input type="hidden" name="from" value={current.from} /> : null}
              {current.to ? <input type="hidden" name="to" value={current.to} /> : null}
              <Input
                type="search"
                name="q"
                defaultValue={current.q ?? ''}
                placeholder="Search bootcamps…"
                style={{ maxWidth: '300px' }}
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
          </div>

          <BootcampFacetBar facets={page.facets} current={current} datePresets={datePresets} />

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
              ? `${showing}${page.next_cursor ? '+' : ''} bootcamp${showing === 1 ? '' : 's'}`
              : 'No bootcamps yet'}
          </div>

          {showing > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="mkt-grid-3-2-1">
                {page.items.map((b) => (
                  <BootcampDirectoryCard key={b.id} bootcamp={b} />
                ))}
              </div>
              {page.next_cursor ? (
                <LoadMoreBootcamps query={current} initialCursor={page.next_cursor} />
              ) : null}
            </div>
          ) : (
            <EmptyState filtered={filtered} />
          )}
        </div>
      </div>
    </section>
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
        padding: '56px 0',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '17px',
          color: 'var(--color-text-secondary)',
          margin: 0,
          maxWidth: '440px',
          lineHeight: '26px',
        }}
      >
        {filtered
          ? 'No bootcamps match these filters yet. Try clearing them — new sessions are added all the time.'
          : 'No bootcamps in your area yet. Check back soon — or ask your sparx partner about hosting one.'}
      </p>
      <div className="mkt-cluster" style={{ gap: '12px', justifyContent: 'center' }}>
        {filtered ? (
          <a href="/bootcamp#directory">
            <Button size="lg" variant="outline">
              Clear filters
            </Button>
          </a>
        ) : (
          <a href="/partners">
            <Button size="lg" color="commerce">
              Host a bootcamp →
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
