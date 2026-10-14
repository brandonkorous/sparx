'use client';

// Did the page you built actually work? Traffic, sales, search grade and speed, keyed
// on the page, in one table because people scan DOWN a column. The columns say what
// they mean in business words, never "bounce rate" or "LCP". Rows: page-results-table.tsx.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  EmptyState,
} from '@wizeworks/silicaui-react';
import { faChartColumn } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { loadFailureWords } from '../../lib/api-error';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  RESULT_WINDOWS,
  salesUntraced,
  usePageResults,
  type PageResultRow,
  type ResultWindow,
} from './page-results-data';
import { ReportFootnotes } from './page-results-notes';
import { PageResultsTable } from './page-results-table';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type ResultsQuery = ReturnType<typeof usePageResults>;

/** Same modifier contract as every other list in the app. */
function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function ResultsToolbar({
  days,
  setDays,
  query,
}: {
  days: ResultWindow;
  setDays: (next: ResultWindow) => void;
  query: ResultsQuery;
}) {
  return (
    <PaneToolbar
      label="Controls for how your pages do"
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
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

function StaleAlert({ query }: { query: ResultsQuery }) {
  return (
    <Alert color="warning" className="m-2">
      <AlertContent>
        <AlertTitle>Could not refresh these figures just now</AlertTitle>
        <AlertDescription>
          {loadFailureWords(
            query.error,
            'This is a problem reaching the server. What you see below is what loaded last, and may be out of date.'
          )}
        </AlertDescription>
      </AlertContent>
      <Button
        size="sm"
        color="warning"
        variant="soft"
        onClick={() => {
          void query.refetch();
        }}
      >
        Try again
      </Button>
    </Alert>
  );
}

function ResultsBody({
  query,
  stale,
  onOpen,
}: {
  query: ResultsQuery;
  stale: boolean;
  onOpen: (row: PageResultRow, event: OpenEvent) => void;
}) {
  const { data, error, isLoading } = query;
  const rows = data?.pages ?? [];
  if (error && !stale) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
        title="Could not load how your pages are doing"
        description="This is a problem reaching the server. Nothing about your site or your figures has changed."
        error={error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (isLoading) return <PaneWaiting label="Adding up your pages…" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
        title="No pages yet"
        description="Once you have built a page and someone has visited it, this is where you find out how it did: how many people saw it, how many of them bought something, and how quickly it appeared for them."
      />
    );
  }
  return (
    <>
      <PageResultsTable
        rows={rows}
        commerce={data?.commerce ?? false}
        // Sales happened and none could be tied to a page: no money column is a measurement.
        untraced={data ? salesUntraced(data) : false}
        onOpen={onOpen}
      />
      <ReportFootnotes report={data} />
    </>
  );
}

export function PageResultsSurface({ ctx }: { ctx: SurfaceContext }) {
  const [days, setDays] = useState<ResultWindow>(30);
  const query = usePageResults(days);
  const rows = query.data?.pages ?? [];
  const staleAfterFailure = Boolean(query.error) && rows.length > 0;

  const openEditor = (row: PageResultRow, event: OpenEvent) => {
    ctx.open('builder.page', { pageId: row.pageId }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <ResultsToolbar days={days} setDays={setDays} query={query} />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        {staleAfterFailure ? <StaleAlert query={query} /> : null}
        <ResultsBody query={query} stale={staleAfterFailure} onOpen={openEditor} />
      </Card>
    </div>
  );
}
