'use client';

// STOCK SOURCES — the connections that keep your numbers in step with something
// outside sparx (a published spreadsheet, another system, an on-site bridge).
//
// ── Cards, not a table ───────────────────────────────────────────────────
//
// A business has a handful of these, and each is a one-line thing — a name, what
// kind it is, whether it is working, when it last ran. A table would invent
// columns to justify itself; a card per source keeps the identity as the content
// and the state as one badge. Each card opens its setup pane; "Sync now" sits
// beside it as its own control rather than being swallowed by the row.
//
// ── Search and status go to the server ───────────────────────────────────
//
// Both are query params, so the list you see is the server's answer, not a page
// filtered in the browser.

import { useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  NativeSelect,
  SearchInput,
  Timestamp,
  ToolbarSeparator,
  useToast,
} from '@wizeworks/silicaui-react';
import { Cable, FileSpreadsheet, Link2, Plus, RefreshCw, Server } from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  sourceErrorMessage,
  sourceState,
  sourceTypeLabel,
  useInventorySources,
  useSyncSource,
  type InventorySource,
  type SourceStatus,
  type SourceType,
} from './sources-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The mark for each kind of connection. */
function TypeIcon({ type }: { type: SourceType }) {
  const Icon = type === 'csv' ? FileSpreadsheet : type === 'api' ? Cable : Server;
  return <Icon className="text-module size-5 shrink-0" aria-hidden />;
}

function SourceCard({
  source,
  onOpen,
}: {
  source: InventorySource;
  onOpen: (source: InventorySource, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const toast = useToast();
  const sync = useSyncSource();
  const state = sourceState(source);

  const runSync = () => {
    sync.mutate(source.id, {
      onSuccess: () => {
        toast.add({
          title: `${source.name} is syncing`,
          description: 'We have started pulling the latest numbers. They will land shortly.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not start a sync',
          description: sourceErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <li className="card bg-base-100 flex flex-wrap items-center gap-3 p-4">
      {/* The row is a real button; "Sync now" is its sibling, never nested — an
          action inside a button is invalid and unreachable by keyboard. */}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={(event) => {
          onOpen(source, event);
        }}
      >
        <TypeIcon type={source.type} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold">{source.name}</span>
          <span className="text-sm">
            {sourceTypeLabel(source.type)}
            {' · '}
            {source.lastSyncAt ? (
              <>
                last updated <Timestamp value={source.lastSyncAt} format="relative" />
              </>
            ) : (
              'not run yet'
            )}
          </span>
        </span>
      </button>

      <Badge color={state.tone} variant="soft" size="sm">
        {state.label}
      </Badge>

      {/* An on-site bridge pushes to us — there is nothing for us to pull on
          demand, so it gets no "Sync now". */}
      {source.type === 'agent' ? null : (
        <Button
          size="sm"
          variant="outline"
          color="neutral"
          className="shrink-0"
          loading={sync.isPending}
          disabled={source.status === 'paused'}
          title={
            source.status === 'paused'
              ? 'This source is paused — turn it back on to sync'
              : 'Pull the latest numbers now'
          }
          onClick={runSync}
        >
          <RefreshCw className="size-4" aria-hidden />
          <span className="hidden @sm:inline">Sync now</span>
        </Button>
      )}
    </li>
  );
}

const STATUS_OPTIONS: { value: SourceStatus | ''; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'error', label: 'Having trouble' },
];

export function SourcesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SourceStatus | ''>('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;
  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useInventorySources({
    q: search.trim(),
    status,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const narrowed = search.trim() !== '' || status !== '';

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openSource = (source: InventorySource, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.sources.detail', { id: source.id }, { target: targetFor(event) });
  };

  const addSource = () => {
    ctx.open('inventory.sources.detail', { id: 'new' }, { target: 'tab' });
  };

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<Link2 className="size-6" aria-hidden />}
          title="Could not load your stock sources"
          description="This is a problem reaching the server. Your connections are unaffected — they just could not be listed just now."
        />
      );
    }

    if (isLoading) {
      return (
        <p className="p-4 text-sm" role="status">
          Loading your sources…
        </p>
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          icon={<Link2 className="size-6" aria-hidden />}
          title={narrowed ? 'Nothing matches that' : 'No stock sources yet'}
          description={
            narrowed
              ? 'Try part of a source’s name, or switch the status back to “Any status”.'
              : 'Connect a stock source when something outside sparx keeps the count — a spreadsheet you publish, another system, or a bridge on your own computers. Its numbers then flow in and become what you sell against.'
          }
          actions={
            narrowed ? undefined : (
              <Button size="sm" color="module" onClick={addSource}>
                <Plus className="size-4" aria-hidden />
                Add a source
              </Button>
            )
          }
        />
      );
    }

    return (
      <ul className="flex flex-col gap-2">
        {rows.map((source) => (
          <SourceCard key={source.id} source={source} onOpen={openSource} />
        ))}
      </ul>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Stock source controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search stock sources"
            placeholder="Source name…"
            value={search}
            onValueChange={(next) => {
              setSearch(next);
              resetWindow();
            }}
          />
        </div>

        <ToolbarSeparator className="hidden @xl:block" />

        <NativeSelect
          size="sm"
          className="max-w-40 shrink"
          aria-label="Show sources with status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as SourceStatus | '');
            resetWindow();
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>

        <Button size="sm" color="module" className="ml-auto shrink-0" onClick={addSource}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden @sm:inline">Add a source</span>
        </Button>

        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto">{body()}</div>

      <div className="mx-auto w-full max-w-3xl shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
      </div>
    </div>
  );
}
