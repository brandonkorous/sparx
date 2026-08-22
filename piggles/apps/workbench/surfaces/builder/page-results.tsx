'use client';

// Did the page you built actually work?
//
// THE GAP THIS CLOSES. Everything else in the builder tells an owner what they made.
// Nothing told them whether it did anything — traffic lived in one place, sales in
// another, the search grade in a third, speed in a fourth, and none of them were
// keyed on "the page I spent Tuesday afternoon on". This is that one table, and it
// is the builder's equivalent of what click attribution did for email.
//
// A TABLE, BECAUSE THIS IS GENUINELY TABULAR. Every row has the same facts and
// people scan DOWN a column — "which page nobody reads", "which one is slow". A set
// of cards would defeat the only reading anyone does here.
//
// EVERY PAGE, INCLUDING THE ONES NOBODY VISITED. The row with 0 views is the most
// actionable line on the screen: it means a page exists that nothing links to, or
// that search has never found. Filtering the list down to pages with traffic would
// answer the question the owner already knew the answer to.
//
// AND THE COLUMNS SAY WHAT THEY MEAN. "Bounce rate" and "LCP" are jargon; "Nobody
// came back" and "How long it takes to appear" are the same facts in the language of
// someone who runs a business rather than a website.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faChartColumn } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  formatCount,
  formatLoad,
  formatMoney,
  loadTone,
  RESULT_WINDOWS,
  seoTone,
  usePageResults,
  type PageResultRow,
  type ResultWindow,
} from './page-results-data';
import { productCopyWith } from '../../lib/product';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * What a row is ABOUT, under its name.
 *
 * A collection template needs saying out loud or its numbers look wrong: it shows
 * the total across every product (or post, or service) it renders, which is why it
 * is usually the busiest line on the page and never matches its own address.
 */
function subtitleOf(row: PageResultRow): string {
  if (row.pathPrefix) {
    return row.pathsCovered === 0
      ? `Every page under ${row.pathPrefix} — none of them visited yet`
      : `Every page under ${row.pathPrefix} — ${formatCount(row.pathsCovered)} of them visited`;
  }
  return row.path;
}

export function PageResultsSurface({ ctx }: { ctx: SurfaceContext }) {
  const [days, setDays] = useState<ResultWindow>(30);
  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = usePageResults(days);

  const rows = data?.pages ?? [];
  const commerce = data?.commerce ?? false;
  const staleAfterFailure = Boolean(error) && rows.length > 0;

  const openEditor = (row: PageResultRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('builder.studio', { pageId: row.pageId }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Page results controls"
        filters={[
          {
            label: 'How far back',
            value: String(days),
            onValueChange: (next) => {
              setDays((Number(next ?? 30) || 30) as ResultWindow);
            },
            // RESULT_WINDOWS keys its entries by `days`, not `value`.
            options: RESULT_WINDOWS.map((window) => ({
              value: String(window.days),
              label: window.label,
            })),
          },
        ]}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {staleAfterFailure ? (
          <Alert color="warning" className="m-2">
            <AlertContent>
              <AlertTitle>Could not refresh these figures just now</AlertTitle>
              <AlertDescription>
                This is a problem reaching the server. What you see below is what loaded last, and
                may be out of date.
              </AlertDescription>
            </AlertContent>
            <Button
              size="sm"
              color="warning"
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </Alert>
        ) : null}

        {error && !staleAfterFailure ? (
          <PaneLoadError
            icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
            title="Could not load your page results"
            description="This is a problem reaching the server. Nothing about your site or your figures has changed."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isLoading ? (
          <PaneWaiting label="Adding up your pages…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
            title="No pages yet"
            description="Once you have built a page and someone has visited it, this is where you find out how it did — how many people saw it, how many of them bought something, and how quickly it appeared for them."
          />
        ) : (
          <>
            <Table size="sm" hover>
              <thead>
                <tr>
                  <th>Page</th>
                  <th className="text-right">People</th>
                  <th className="hidden text-right @lg:table-cell">Times opened</th>
                  {commerce ? <th className="hidden text-right @xl:table-cell">Bought</th> : null}
                  {commerce ? <th className="text-right">Sales</th> : null}
                  <th className="hidden @2xl:table-cell">Time to appear</th>
                  <th className="hidden @3xl:table-cell">Found by search</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.pageId}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      openEditor(row, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      openEditor(row, event);
                    }}
                  >
                    <td>
                      <span className="block max-w-64 truncate font-semibold">{row.name}</span>
                      <span className="block max-w-64 truncate">{subtitleOf(row)}</span>
                    </td>
                    <td className="text-right">{formatCount(row.visitors)}</td>
                    <td className="hidden text-right @lg:table-cell">{formatCount(row.views)}</td>
                    {commerce ? (
                      <td className="hidden text-right @xl:table-cell">
                        {/* Orders alongside the rate, because a rate on its own is
                            unreadable at small numbers — "20%" of five people is one
                            sale, and the owner needs to know which they are looking at. */}
                        {row.conversionPct == null
                          ? '—'
                          : `${formatCount(row.orders)} (${String(row.conversionPct)}%)`}
                      </td>
                    ) : null}
                    {commerce ? (
                      <td className="text-right">
                        {row.revenueCents > 0 ? formatMoney(row.revenueCents) : '—'}
                      </td>
                    ) : null}
                    <td className="hidden @2xl:table-cell">
                      <Badge color={loadTone(row.loadMs)} variant="soft" size="sm">
                        {formatLoad(row.loadMs)}
                      </Badge>
                    </td>
                    <td className="hidden @3xl:table-cell">
                      {row.noindex ? (
                        <Badge color="neutral" variant="soft" size="sm">
                          Hidden on purpose
                        </Badge>
                      ) : (
                        <Badge color={seoTone(row.seoScore)} variant="soft" size="sm">
                          {row.seoScore == null
                            ? 'Not checked yet'
                            : `${String(row.seoScore)} / 100`}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <ReportFootnotes report={data} />
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * The caveats, stated where the numbers are rather than left for someone to
 * discover by being confused.
 *
 * Each one exists because leaving it out would make an honest number read as a wrong
 * one: sales are credited to the page that BROUGHT the buyer in, not the one they
 * checked out from; some visits belong to no row here at all; and a load time
 * measured on four visits is not a fact about the page.
 *
 * The leftovers note names cart/checkout/sign-in/legal, NOT products and posts. It
 * used to name those, and that was true while a record template had no address and
 * therefore no row — every product view fell through to this sentence. Now the
 * template owns its prefix and its traffic is rolled up into a real row above, so
 * naming products here would send an owner hunting for a row that is already there.
 */
function ReportFootnotes({ report }: { report: ReturnType<typeof usePageResults>['data'] }) {
  if (!report) return null;
  const otherViews = report.otherPaths.reduce((sum, row) => sum + row.views, 0);

  return (
    <div className="flex flex-col gap-2 p-3">
      {report.commerce ? (
        <p className="text-base">
          Sales are credited to the page that brought the buyer to your site that day — not the page
          they bought from. So your home page can earn credit for a sale that happened three clicks
          later, which is the point: that is the page that did the work.
        </p>
      ) : null}
      {otherViews > 0 ? (
        <p className="text-base">
          {productCopyWith(
            'builder.pages.otherViews',
            `Another ${formatCount(otherViews)} visits landed on addresses no page here owns — your cart, checkout, sign-in and legal pages, which Piggles builds for you. They are counted in your traffic figures but have no row above.`,
            { count: formatCount(otherViews) }
          )}
        </p>
      ) : null}
      <p className="text-base">
        “Time to appear” is measured in your visitors&rsquo; own browsers, so a page nobody has
        opened has no measurement rather than a fast one.
      </p>
    </div>
  );
}
