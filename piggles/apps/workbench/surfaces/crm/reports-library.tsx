'use client';

// Saved reports (docs/144 §8): the library, and the front door to the builder.
// The shipped reports lead, labelled as such, because copying a working one and
// changing a thing teaches more than an empty list with a "New report" button.

import { Button, EmptyState, Input, Text } from '@wizeworks/silicaui-react';
import { faChartColumn } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SavedReport } from './report-builder-data';
import type { FieldLabel } from './reports-library-describe';
import { ReportRow, type ReportRowActions } from './reports-library-row';
import { useReportsLibrary } from './use-reports-library';

interface ReportsLibraryBodyProps extends ReportRowActions {
  isPending: boolean;
  needle: string;
  rows: SavedReport[];
  mine: SavedReport[];
  builtins: SavedReport[];
  fieldLabel: FieldLabel;
}

/** The list itself: loading, empty, or the tenant's reports above the built-ins. */
function ReportsLibraryBody({
  isPending,
  needle,
  rows,
  mine,
  builtins,
  ...rowProps
}: ReportsLibraryBodyProps) {
  return (
    <div className="flex flex-col gap-6 overflow-auto p-6 [&>*]:shrink-0">
      {isPending ? (
        <div className="skeleton h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
          title={needle ? 'Nothing matches that' : 'No reports yet'}
          description={
            needle
              ? 'Try a different word.'
              : 'Build one to answer a question about your business, or open one of ours and copy it.'
          }
        />
      ) : (
        <>
          {mine.length > 0 ? (
            <section className="flex flex-col gap-2">
              <Text>Yours</Text>
              {mine.map((report) => (
                <ReportRow key={report.id} report={report} {...rowProps} />
              ))}
            </section>
          ) : null}
          {builtins.length > 0 ? (
            <section className="flex flex-col gap-2">
              <Text>
                Ready-made. Open one to see how it is built, then copy it and change a thing.
              </Text>
              {builtins.map((report) => (
                <ReportRow key={report.id} report={report} {...rowProps} />
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export function ReportsLibrarySurface({ ctx }: { ctx: SurfaceContext }) {
  const { data, isFetching, dataUpdatedAt, refetch, q, setQ, body } = useReportsLibrary(ctx);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Build a report controls"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            onClick={(event) =>
              ctx.open(
                'crm.report.builder',
                { id: 'new' },
                { target: event.shiftKey ? 'beside' : 'tab' }
              )
            }
          >
            New report
          </Button>
        }
        controls={
          <div className="max-w-xs min-w-0 flex-1">
            <Input
              color="module"
              size="sm"
              aria-label="Search reports"
              value={q}
              placeholder="Search reports…"
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
        }
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
      <ReportsLibraryBody {...body} />
    </div>
  );
}
