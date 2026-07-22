'use client';

// The deals list — the sales you are working on.
//
// A table, matching the other CRM lists: the deal's title is the anchor, with its
// stage, what it is worth, and who it is for in their own columns. Value sorts to
// the right with tabular figures; the stage badge carries won/lost/in-progress
// colour so a glance down the column reads as the state of the pipeline.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Select,
  Table,
} from '@wizeworks/silicaui-react';
import { Plus, Target } from 'lucide-react';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import { usePipelines, stageTypeMeta } from './pipelines-data';
import {
  dealCustomerName,
  formatMoney,
  useDeals,
  type Deal,
  type DealListParams,
} from './deals-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function DealsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [pipelineId, setPipelineId] = useState('all');
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');

  const { data: pipelines } = usePipelines();

  const params: DealListParams = {
    q: search,
    pipelineId: pipelineId === 'all' ? undefined : pipelineId,
    state: state === 'all' ? undefined : state,
  };
  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useDeals(params);

  const rows = data?.items ?? [];
  const total = data?.total;
  const filtered = search.trim() !== '' || pipelineId !== 'all' || state !== 'open';

  const pipelineItems = useMemo(() => {
    const items: Record<string, string> = { all: 'All pipelines' };
    for (const p of pipelines?.items ?? []) items[p.id] = p.name;
    return items;
  }, [pipelines]);

  const open = (deal: Deal, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('crm.deal.detail', { id: deal.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Deal list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search deals"
            placeholder="Search deals…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <div className="hidden w-40 shrink-0 @xl:block">
          <Select
            size="sm"
            aria-label="Which pipeline"
            value={pipelineId}
            items={pipelineItems}
            onValueChange={(next) => {
              setPipelineId(next as string);
            }}
          />
        </div>
        <div className="hidden w-32 shrink-0 @lg:block">
          <Select
            size="sm"
            aria-label="Open or closed"
            value={state}
            items={{ open: 'Open', closed: 'Closed', all: 'All deals' }}
            onValueChange={(next) => {
              setState(next as 'open' | 'closed' | 'all');
            }}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          title="New deal — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open('crm.deal.detail', { id: 'new' }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          New deal
        </Button>
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            icon={<Target className="size-6" aria-hidden />}
            title="Could not load your deals"
            description="Something went wrong reaching the server. It may be a temporary problem — try again in a moment."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <ListEmptyState
            filtered={filtered}
            noResults={{
              icon: <Target className="size-6" aria-hidden />,
              title: 'No deals match those filters',
              description:
                'Try a different word, or change the filters — closed deals are hidden unless you ask for them.',
            }}
            firstRun={{
              title: 'No deals yet',
              description:
                'A deal tracks a sale you are working on, from first contact to close. Add your first one to start a pipeline.',
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Stage</th>
                <th className="text-right">Value</th>
                <th className="hidden @lg:table-cell">For</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = stageTypeMeta(row.stage?.stageType ?? 'open');
                const customer = dealCustomerName(row.customer);
                return (
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
                    <td className="font-medium">{row.title}</td>
                    <td>
                      <Badge color={meta.tone} variant="soft" size="sm">
                        {row.stage?.name ?? meta.label}
                      </Badge>
                    </td>
                    <td className="text-right font-mono text-sm tabular-nums">
                      {formatMoney(row.value, row.currency)}
                    </td>
                    <td className="hidden text-sm @lg:table-cell">{customer ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="flex shrink-0 items-center justify-between px-1">
        <p className="text-xs">
          Click to open · Shift-click to open alongside · Alt-click for a new window
        </p>
        {typeof total === 'number' && !isPending ? (
          <p className="text-xs">
            {filtered ? `${rows.length.toLocaleString()} shown` : `${total.toLocaleString()} open`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
