// The /bootcamp faceted directory section (docs/114 §B.6). Rendered inline on the
// bootcamp page below the marketing sections. URL-driven SSR facets (format /
// when / where) + a title search-within, result grid, cursor Load-more island,
// and a helpful empty state. Anchored #directory so the hero "Find a bootcamp"
// CTA and the facet links land here.

import { Button, Input } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, SectionHeader } from '@/components/marketing/primitives';
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
      className="bg-base-200 border-base-300 px-page py-section-lg scroll-mt-20 border-t"
    >
      <Container>
        <div className="flex flex-col gap-9">
          <div className="flex flex-col gap-5">
            <SectionHeader accent="var(--color-primary)" headline={<>Upcoming bootcamps</>} />
            <form method="get" action="/bootcamp" className="flex flex-wrap items-center gap-2">
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
                className="max-w-[300px]"
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
          </div>

          <BootcampFacetBar facets={page.facets} current={current} datePresets={datePresets} />

          <div className="border-base-300 text-small text-ink-muted border-t pt-5">
            {showing > 0
              ? `${showing}${page.next_cursor ? '+' : ''} bootcamp${showing === 1 ? '' : 's'}`
              : 'No bootcamps yet'}
          </div>

          {showing > 0 ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      </Container>
    </section>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-[18px] py-14 text-center">
      <p className="text-body-lg text-ink-muted m-0 max-w-[440px]">
        {filtered
          ? 'No bootcamps match these filters yet. Try clearing them — new sessions are added all the time.'
          : 'No bootcamps in your area yet. Check back soon — or ask your sparx partner about hosting one.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {filtered ? (
          <a
            href="/bootcamp#directory"
            className={buttonClasses({ size: 'lg', variant: 'outline' })}
          >
            Clear filters
          </a>
        ) : (
          <a href="/partners" className={buttonClasses({ size: 'lg', color: 'primary' })}>
            Host a bootcamp →
          </a>
        )}
      </div>
    </div>
  );
}
