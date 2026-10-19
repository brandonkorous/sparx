'use client';

// PAST MOVES: every migration this account has run, so "did the orders ever come
// across?" can be answered weeks later. Practice runs are listed and labelled too,
// so three practices and no real import never reads as work that was done.

import { Badge, Button, Card, Heading, Text } from '@wizeworks/silicaui-react';
import { faArrowRight, faBoxOpen } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { entityLabel, runTone, useMigrationRuns, type RunSummary } from './data';
import { landedBreakdown } from './run-outcome';
import { getVendor, type CanonicalEntity } from '@wizeworks/migration';

/** Registry module for this pane, so the brand draws the right picture in the
 *  empty and waiting states rather than the generic one. */
const MODULE = 'platform';

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function RunRowSummary({ run }: { run: RunSummary }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level={3} className="text-base">
          {/* The platform's own name ("Shopify"), not its slug (sparx persona 053). */}
          {run.vendor === null ? 'A file' : (getVendor(run.vendor)?.name ?? run.vendor)}
        </Heading>
        <Badge color={runTone(run.status)} variant="soft" size="sm">
          {run.status === 'running'
            ? 'Still going'
            : run.status === 'failed'
              ? 'Had trouble'
              : 'Done'}
        </Badge>
        {run.dryRun ? (
          <Badge color="info" variant="outline" size="sm">
            Practice
          </Badge>
        ) : null}
      </div>
      <Text className="text-sm">
        {when(run.startedAt)}
        {run.fileName !== null ? ` · ${run.fileName}` : ''}
      </Text>
      <Text className="text-sm">
        {run.entities.map((entity) => entityLabel(entity as CanonicalEntity)).join(' · ')}
      </Text>
    </div>
  );
}

function RunRowCount({ run }: { run: RunSummary }) {
  const landed = run.importedCount + run.updatedCount;
  // Without this, a run that added twenty five people and one that overwrote twenty
  // five read the same; see run-outcome.
  const breakdown = landedBreakdown(
    { imported: run.importedCount, updated: run.updatedCount },
    run.dryRun,
    run.entities.every((entity) => entity === 'customers')
  );
  return (
    <div className="flex flex-col items-end gap-0.5">
      <Text className="text-2xl font-semibold tabular-nums">{landed.toLocaleString()}</Text>
      <Text className="text-sm">
        {/* Rows, said as rows: a product with versions is several (sparx 053). */}
        {run.dryRun ? 'rows would come across' : 'rows brought across'}
        {run.errorCount > 0 ? ` · ${run.errorCount.toLocaleString()} skipped` : ''}
      </Text>
      {breakdown === null ? null : <Text className="text-end text-sm">{breakdown}</Text>}
    </div>
  );
}

function RunRow({ run, onOpen }: { run: RunSummary; onOpen: () => void }) {
  return (
    // A silica Card carries the resting shadow a hairline cannot (DESIGN.md §4).
    // `shrink-0` so the scrolling flex column scrolls instead of squashing each row.
    <Card className="flex shrink-0 flex-wrap items-center gap-3 p-4">
      <RunRowSummary run={run} />
      <RunRowCount run={run} />
      <Button variant="ghost" size="sm" onClick={onOpen}>
        See what happened
        <Icon glyph={faArrowRight} className="size-4" aria-hidden />
      </Button>
    </Card>
  );
}

function HistoryToolbar({
  ctx,
  runs,
}: {
  ctx: SurfaceContext;
  runs: ReturnType<typeof useMigrationRuns>;
}) {
  return (
    <PaneToolbar
      label="Past moves controls"
      primary={
        <Button
          color="primary"
          size="sm"
          onClick={() => ctx.open('platform.migrate', {}, { target: 'tab' })}
        >
          <Icon glyph={faBoxOpen} className="size-4" aria-hidden />
          Move something in
        </Button>
      }
      refresh={
        <div className="ml-auto flex items-center gap-2">
          <RefreshButton
            onRefresh={() => void runs.refetch()}
            isFetching={runs.isFetching}
            updatedAt={runs.dataUpdatedAt}
          />
        </div>
      }
    />
  );
}

function NothingMovedYet({ ctx }: { ctx: SurfaceContext }) {
  return (
    <Card>
      <ListEmptyState
        module={MODULE}
        filtered={false}
        noResults={{
          icon: <Icon glyph={faBoxOpen} className="size-6" aria-hidden />,
          title: 'No moves match',
        }}
        firstRun={{
          icon: <Icon glyph={faBoxOpen} className="size-6" aria-hidden />,
          title: 'Nothing has been moved in yet',
          description:
            'When you bring a catalog, a contact list or a blog over from another platform, each move is recorded here with exactly what landed.',
          actions: (
            <Button
              color="module"
              onClick={() => ctx.open('platform.migrate', {}, { target: 'tab' })}
            >
              Move something in
            </Button>
          ),
        }}
      />
    </Card>
  );
}

export function MigrationHistorySurface({ ctx }: { ctx: SurfaceContext }) {
  const query = useMigrationRuns();
  const { isPending, isError, error, refetch } = query;
  const runs = query.data?.runs ?? [];

  return (
    <div className={PANE_SHELL}>
      <HistoryToolbar ctx={ctx} runs={query} />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
        {/* Carded like the runs, so the pane keeps its shape in every state. */}
        {isPending ? (
          <Card>
            <PaneWaiting module={MODULE} />
          </Card>
        ) : null}

        {isError && runs.length === 0 ? (
          // Not the empty branch: "nothing has been moved in yet" must never show over
          // a failed read. A failed poll over runs still on screen leaves them be.
          <Card>
            <PaneLoadError
              icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
              title="Could not load your past moves"
              description="This is a problem reaching the server. Everything you have already moved in is unaffected."
              error={error}
              onRetry={() => {
                void refetch();
              }}
            />
          </Card>
        ) : null}

        {!isError && !isPending && runs.length === 0 ? <NothingMovedYet ctx={ctx} /> : null}

        {runs.map((run) => (
          <RunRow
            key={run.runId}
            run={run}
            onOpen={() => ctx.open('platform.migrate.run', { runId: run.runId }, { target: 'tab' })}
          />
        ))}
      </div>
    </div>
  );
}
