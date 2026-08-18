'use client';

// RUNS — what is being made, and what has been.
//
// A run is the thing that actually moves stock: parts come off the shelf and a
// finished thing goes on it. The recipe says what to make; this says when it
// happened and what it cost.
//
// Color carries the state, because that is what someone scans this list for.
// "On paper" is neutral — nothing has happened. "Parts held" is amber: stock is
// spoken for and somebody should finish or cancel it. "Made" is green and done.
// A grey list of four statuses would need reading; this one does not.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Badge,
  Button,
  Card,
  NativeSelect,
  SearchInput,
  Text,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faHammer, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, useStockLocations } from './data';

/** Registry module for this pane, so the brand draws Stock's own picture rather
 *  than the generic one. */
const MODULE = 'inventory';
import { runKindLabel, runState, useAssemblyOrders, type AssemblyOrder } from './assembly-data';

const PAGE = 50;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function AssembliesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [locationId, setLocationId] = useState('');
  const [skip, setSkip] = useState(0);

  const runs = useAssemblyOrders({
    q,
    status,
    kind: '',
    warehouseId: locationId,
    take: PAGE,
    skip,
  });
  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((l) => l.isActive);

  const rows = runs.data?.items ?? [];
  const total = runs.data?.total ?? 0;

  const open = (run: AssemblyOrder, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.assemblies.detail', { id: run.id }, { target: targetFor(event) });
  };

  const narrowed = Boolean(q || status || locationId);

  const body = () => {
    if (runs.isError) {
      return (
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faHammer} className="size-6" aria-hidden />}
          title="Could not load your runs"
          description="This is a problem reaching the server. Nothing you have made is affected."
          onRetry={() => {
            void runs.refetch();
          }}
        />
      );
    }
    if (runs.isPending) {
      return <PaneWaiting module={MODULE} />;
    }
    if (rows.length === 0) {
      // "Nothing matched your filter" and "you have never made anything" are
      // different facts; <ListEmptyState> owns that choice so this pane does not
      // re-decide it.
      return (
        <ListEmptyState
          module={MODULE}
          filtered={narrowed}
          noResults={{
            icon: <Icon glyph={faHammer} className="size-6" aria-hidden />,
            title: 'Nothing matches that',
            description: 'Try a different search, or clear the filters.',
          }}
          firstRun={{
            title: 'Nothing made yet',
            description:
              'A run is where parts come off the shelf and a finished thing goes on it. Write a recipe first, then plan a run against it — the stock moves when you mark it made.',
            actions: (
              <Button
                color="module"
                onClick={() => {
                  ctx.open('inventory.boms.list', {}, { target: 'tab' });
                }}
              >
                Go to recipes
              </Button>
            ),
          }}
        />
      );
    }

    return (
      <Table hover>
        <thead>
          <tr>
            <th className="whitespace-nowrap">Run</th>
            <th>Making</th>
            <th className="hidden @xl:table-cell">Where</th>
            <th className="text-right whitespace-nowrap">How many</th>
            <th className="hidden text-right whitespace-nowrap @lg:table-cell">Cost each</th>
            <th className="hidden text-right whitespace-nowrap @md:table-cell">When</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((run) => {
            const state = runState(run.status);
            return (
              <tr
                key={run.id}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                onClick={(event) => {
                  open(run, event);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  open(run, event);
                }}
              >
                <td className="font-mono whitespace-nowrap">{run.number}</td>
                <td className="w-full max-w-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{run.outputTitle ?? 'Untitled product'}</span>
                    <span className="truncate text-sm">
                      {runKindLabel(run.kind)} · {run.outputSku ?? 'No code'}
                    </span>
                  </span>
                </td>
                <td className="hidden max-w-32 truncate @xl:table-cell">
                  {run.warehouseName ?? '—'}
                </td>
                <td className="text-right tabular-nums">
                  {run.status === 'completed' ? run.quantityCompleted : run.quantityPlanned}
                </td>
                <td className="hidden text-right tabular-nums @lg:table-cell">
                  {run.outputUnitCostCents === null ? '—' : formatCents(run.outputUnitCostCents)}
                </td>
                <td className="hidden text-right whitespace-nowrap @md:table-cell">
                  <Timestamp
                    value={run.completedAt ?? run.plannedFor ?? run.createdAt}
                    format="relative"
                  />
                </td>
                <td className="text-right">
                  <Badge color={state.tone} variant="soft" size="sm">
                    {state.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Run list controls"
        search={
          <SearchInput
            value={q}
            placeholder="Search runs"
            onValueChange={(value) => {
              setQ(value);
              setSkip(0);
            }}
          />
        }
        primaryAction={{
          label: 'Plan a run',
          icon: faPlus,
          onClick: (event) => {
            ctx.open(
              'inventory.assemblies.detail',
              { id: 'new' },
              { target: event.shiftKey ? 'beside' : 'tab' }
            );
          },
        }}
        controls={
          <>
            <NativeSelect
              size="sm"
              className="max-w-36 shrink"
              aria-label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setSkip(0);
              }}
            >
              <option value="">Any status</option>
              <option value="planned">On paper</option>
              <option value="released">Parts held</option>
              <option value="completed">Made</option>
              <option value="cancelled">Called off</option>
            </NativeSelect>
            <NativeSelect
              size="sm"
              className="max-w-40 shrink"
              aria-label="Location"
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value);
                setSkip(0);
              }}
            >
              <option value="">Everywhere</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
          </>
        }
        views={{
          target: '/inventory/assemblies',
          params: { q, status, warehouse: locationId },
          onApply: (next) => {
            setQ(next.q ?? '');
            setStatus(next.status ?? '');
            setLocationId(next.warehouse ?? '');
            setSkip(0);
          },
        }}
        refresh={
          <RefreshButton
            isFetching={runs.isFetching}
            updatedAt={runs.dataUpdatedAt}
            onRefresh={() => {
              void runs.refetch();
            }}
          />
        }
      />

      {/* ONE card around the whole conditional — loading, failure, empty and the
          table all fill the same content region, so the pane never jumps. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">{body()}</Card>

      {total > PAGE ? (
        <div className="border-base-300 flex items-center justify-between gap-2 border-t px-3 py-2">
          <Text className="text-sm">
            {plural(total, 'run', 'runs')} · showing {skip + 1}–{Math.min(skip + PAGE, total)}
          </Text>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              disabled={skip === 0}
              onClick={() => {
                setSkip(Math.max(0, skip - PAGE));
              }}
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              disabled={skip + PAGE >= total}
              onClick={() => {
                setSkip(skip + PAGE);
              }}
            >
              Next
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
