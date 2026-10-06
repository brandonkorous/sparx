'use client';

import { SearchInput, Select } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { RefreshButton } from '../../../components/refresh-button';
import { PaneToolbar } from '../../../components/pane-toolbar';
import type { ToolbarViews } from '../../../components/pane-toolbar-views';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { productCopy } from '../../../lib/product';
import { targetFor } from '../target-for';
import type { SortKey } from './rows';
import type { AutomationsList } from './use-automations-list';

function ListFilters({ list }: { list: AutomationsList }) {
  const { status, setStatus, origin, setOrigin } = list;
  return (
    <>
      <div className="w-36 shrink-0">
        <Select
          size="sm"
          aria-label="Filter by status"
          value={status}
          items={{
            all: 'Any status',
            active: 'On',
            paused: 'Paused',
            draft: 'Draft',
            error: 'Needs attention',
          }}
          onValueChange={(next) => {
            setStatus((next as string) || 'all');
          }}
        />
      </div>
      <div className="w-36 shrink-0">
        <Select
          size="sm"
          aria-label="Filter by who made it"
          value={origin}
          items={{
            all: 'Anyone',
            user: 'Made by you',
            system: productCopy('automations.recipe.byPlatform', 'Set up by sparx'),
          }}
          onValueChange={(next) => {
            setOrigin((next as string) || 'all');
          }}
        />
      </div>
    </>
  );
}

/** The saved-views binding: what the list's state looks like as a shareable view. */
function listViews(list: AutomationsList): ToolbarViews {
  const { search, status, origin, sort, setSearch, setStatus, setOrigin, setSort } = list;
  return {
    target: '/automations',
    params: { q: search.trim(), status, origin, sort: `${sort.key}:${sort.dir}` },
    onApply: (next) => {
      setSearch(next.q ?? '');
      setStatus(next.status ?? 'all');
      setOrigin(next.origin ?? 'all');
      const [key, dir] = (next.sort ?? '').split(':');
      if (key && (dir === 'asc' || dir === 'desc')) {
        setSort({ key: key as SortKey, dir });
      }
    },
  };
}

export function ListToolbar({ ctx, list }: { ctx: SurfaceContext; list: AutomationsList }) {
  const { search, setSearch, isFetching, data, dataUpdatedAt, refetch } = list;
  return (
    <PaneToolbar
      label="Automations controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search automations"
            placeholder="Search automations…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      primaryAction={{
        label: 'New automation',
        icon: faPlus,
        onClick: (event) => {
          ctx.open('automations.detail', { id: 'new' }, { target: targetFor(event) });
        },
        title: 'New automation: hold Shift to open alongside, Alt for a new window',
      }}
      controls={<ListFilters list={list} />}
      views={listViews(list)}
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
  );
}
