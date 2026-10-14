'use client';

// The email-sequences list: the journeys that follow up with people for you, one
// email at a time, on their own clock. Status filters server-side; search is
// local, since the whole in-scope set comes back in one call.

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { faPlus, faRoute } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { RefreshButton } from '../../components/refresh-button';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { useSites } from '../../lib/api/shell-data';
import { createLabelFor, type OpenTarget, type SurfaceContext } from '../../lib/surfaces/registry';
import { useSequences } from './sequences-data';
import { RowOpenHint } from '../../components/row-open-hint';
import { SequencesTable } from './sequences-table';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'email';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type Pane = ReturnType<typeof useSequencesPane>;

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function StatusSelect(props: { status: string; setStatus: Dispatch<SetStateAction<string>> }) {
  return (
    <div className="w-40 shrink-0">
      <Select
        size="sm"
        aria-label="Filter by status"
        value={props.status}
        items={{
          all: 'Any status',
          active: 'On',
          draft: 'Draft',
          archived: 'Stopped',
        }}
        onValueChange={(next) => {
          props.setStatus((next as string) || 'all');
        }}
      />
    </div>
  );
}

function SequencesToolbar({ pane }: { pane: Pane }) {
  const { search, setSearch, status, setStatus, query, createLabel } = pane;
  return (
    <PaneToolbar
      label="Automatic emails controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search automatic emails"
            placeholder="Search automatic emails…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      primaryAction={{
        label: createLabel,
        icon: faPlus,
        onClick: pane.onCreate,
        title: `${createLabel}: hold Shift to open alongside, Alt for a new window`,
      }}
      controls={<StatusSelect status={status} setStatus={setStatus} />}
      views={{
        target: '/email/sequences',
        params: { q: search.trim(), status },
        onApply: (next) => {
          setSearch(next.q ?? '');
          setStatus(next.status ?? 'all');
        },
      }}
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

function SequencesBody({ pane }: { pane: Pane }) {
  const { query, rows } = pane;
  if (query.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faRoute} className="size-6" aria-hidden />}
        title="Could not load your automatic emails"
        description="Something went wrong reaching the server. Anyone already partway through is unaffected. Try again in a moment."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) return <PaneWaiting label="Loading your automatic emails…" />;
  if (rows.length > 0) {
    return <SequencesTable rows={rows} siteName={pane.siteName} onOpen={pane.open} />;
  }
  return (
    <ListEmptyState
      module={MODULE}
      filtered={pane.filtering}
      noResults={{
        icon: <Icon glyph={faRoute} className="size-6" aria-hidden />,
        title: 'Nothing matches those filters',
        description: 'Try a different search, or switch the status filter back to Any.',
      }}
      firstRun={{
        title: 'No automatic emails yet',
        description:
          'A series follows somebody up over time: a welcome today, a nudge in two days, an offer in a week, each one going out on its own. Create your first one and it runs without you.',
        actions: (
          <Button size="sm" color="module" onClick={pane.onCreate}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            {pane.createLabel}
          </Button>
        ),
      }}
    />
  );
}

function useSequencesPane(ctx: SurfaceContext) {
  const createLabel = createLabelFor('email.sequences.list');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const query = useSequences({ status });
  const { data: sites } = useSites();

  const siteName = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites ?? []) map.set(site.id, site.name);
    return (propertyId: string | null) =>
      propertyId ? (map.get(propertyId) ?? 'One business') : 'Every business';
  }, [sites]);

  const needle = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const all = query.data ?? [];
    const filtered = needle
      ? all.filter(
          (s) =>
            s.name.toLowerCase().includes(needle) ||
            (s.description ?? '').toLowerCase().includes(needle)
        )
      : all;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data, needle]);

  const open = (id: string, event: OpenEvent) => {
    ctx.open('email.sequences.detail', { id }, { target: targetFor(event) });
  };
  const onCreate = (event: OpenEvent) => {
    ctx.open('email.sequences.detail', { id: 'new' }, { target: targetFor(event) });
  };
  const filtering = status !== 'all' || needle !== '';
  const state = { status, setStatus, search, setSearch };
  return { ...state, createLabel, query, siteName, rows, open, onCreate, filtering };
}

export function SequencesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const pane = useSequencesPane(ctx);
  return (
    <div className={PANE_SHELL}>
      <SequencesToolbar pane={pane} />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <SequencesBody pane={pane} />
      </Card>

      {pane.rows.length > 0 ? <RowOpenHint what="a series to open it" /> : null}
    </div>
  );
}
