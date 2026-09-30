'use client';

// The pipelines list — the ways you win work.
//
// A pipeline is the set of stages a deal moves through. This is a table: the
// pipeline's name is the anchor, with how many stages it has and whether it is
// the default or archived in their own columns. Deal counts are not in the list
// payload, so they are not shown here — they live where a pipeline's deals do.

import { Badge, Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { faDiagramProject, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import { usePipelines, type Pipeline } from './pipelines-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'crm';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function PipelinesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'active' | 'all'>('active');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = usePipelines({
    q: search,
    includeArchived: scope === 'all',
    // BOTH kinds (docs/144 §7.2) — sales pipelines and support queues. This is
    // the only surface where a support queue's stages can be renamed or
    // reordered, so filtering to deals here would leave it unreachable.
    objectKey: 'all',
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const filtered = search.trim() !== '' || scope !== 'active';

  const open = (pipeline: Pipeline, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('crm.pipeline.detail', { id: pipeline.id }, { target: targetFor(event) });
  };
  // ONE object, two places: the toolbar's button and the empty state's
  // invitation. Split, the label drifts — and the first-run state used to
  // have no button at all, so "Add your first one" pointed at nothing.
  const createFirst = {
    label: 'New process',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('crm.pipeline.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Controls for how things move"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              color="module"
              size="sm"
              aria-label="Search the steps things go through"
              placeholder="Search by name…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            title="New process: hold Shift to open alongside, Alt for a new window"
            onClick={createFirst.onClick}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            {createFirst.label}
          </Button>
        }
        controls={
          <div className="w-44 shrink-0">
            <Select
              color="module"
              size="sm"
              aria-label="Which ones to show"
              value={scope}
              items={{ active: 'In use', all: 'Including put away' }}
              onValueChange={(next) => {
                setScope(next as 'active' | 'all');
              }}
            />
          </div>
        }
        views={{
          target: '/crm/pipelines',
          params: { q: search, scope },
          onApply: (next) => {
            setSearch(next.q ?? '');
            setScope(next.scope === 'all' ? 'all' : 'active');
          },
        }}
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
        {isError ? (
          <PaneLoadError
            icon={<Icon glyph={faDiagramProject} className="size-6" aria-hidden />}
            title="Could not load these"
            description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={filtered}
            noResults={{
              icon: <Icon glyph={faDiagramProject} className="size-6" aria-hidden />,
              title: 'Nothing matches that',
              description: 'Try a different word, or switch back to the ones in use.',
            }}
            firstRun={{
              title: 'Nothing set up yet',
              description:
                'A process is the set of steps something moves through: a sale going from a first inquiry to won, or a help request from asked to answered. Create your first one to start following them.',
              action: createFirst,
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Name</th>
                <th>Moves</th>
                <th className="hidden text-right @md:table-cell">Steps</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  onClick={(event) => {
                    open(row, event);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    open(row, event);
                  }}
                >
                  <td className="font-medium">{row.name}</td>
                  <td>
                    {/* WHAT this process moves (docs/144 §7.2). Two things live
                        in one list now, and their stage words mean different
                        things — so which is which cannot be left to the name a
                        tenant happened to pick. Distinct hues, because that is
                        the distinction the column exists to draw. */}
                    <Badge
                      color={row.objectKey === 'ticket' ? 'info' : 'module'}
                      variant="soft"
                      size="sm"
                    >
                      {row.objectKey === 'ticket' ? 'Help requests' : 'Sales deals'}
                    </Badge>
                  </td>
                  <td className="hidden text-right text-sm tabular-nums @md:table-cell">
                    {row.stages.length}
                  </td>
                  <td>
                    {/* "Put away" is this console's word for hidden-but-kept
                        (the object-type editor, the all-apps dialog). The filter
                        above says it too; this badge said "Archived". */}
                    {row.archivedAt ? (
                      <Badge color="neutral" variant="soft" size="sm">
                        Put away
                      </Badge>
                    ) : row.isDefault ? (
                      <Badge color="module" variant="soft" size="sm">
                        Default
                      </Badge>
                    ) : (
                      <Badge color="success" variant="soft" size="sm">
                        Active
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="flex shrink-0 items-center justify-between px-1">
        {rows.length > 0 ? <RowOpenHint /> : null}
        {typeof total === 'number' && !isPending ? (
          <p className="text-xs">
            {filtered
              ? `${rows.length.toLocaleString()} shown`
              : `${total.toLocaleString()} in total`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
