'use client';

// The old-links list's toolbar: search, the type filter, add, bulk import, views, refresh.

import { SearchInput } from '@wizeworks/silicaui-react';
import { faPlus, faUpload } from '@fortawesome/pro-solid-svg-icons';
import { PaneToolbar } from '../../components/pane-toolbar';
import type { ToolbarFilter } from '../../components/pane-toolbar-filters';
import { RefreshButton } from '../../components/refresh-button';
import { TYPE_FILTERS, type TypeFilterValue } from './redirects-filter';

interface RedirectsToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  typeFilter: TypeFilterValue;
  onTypeFilter: (next: TypeFilterValue) => void;
  onAdd: () => void;
  onImport: (event: { shiftKey: boolean; altKey: boolean }) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

function typeFilters(props: RedirectsToolbarProps): ToolbarFilter[] {
  return [
    {
      label: 'Show',
      key: 'type',
      value: props.typeFilter,
      neutralValue: 'all',
      options: TYPE_FILTERS.map((entry) => ({ value: entry.value, label: entry.label })),
      onValueChange: (next) => {
        props.onTypeFilter(next as TypeFilterValue);
      },
    },
  ];
}

export function RedirectsToolbar(props: RedirectsToolbarProps) {
  const { search, onSearch } = props;
  return (
    <PaneToolbar
      label="Old links controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search old links"
            placeholder="Old or new address…"
            value={search}
            onValueChange={onSearch}
          />
        </div>
      }
      primaryAction={{ label: 'Add an old link', icon: faPlus, onClick: props.onAdd }}
      filters={typeFilters(props)}
      actions={[
        {
          label: 'Bulk import',
          icon: faUpload,
          onClick: props.onImport,
          title: 'Import a list of old links: hold Alt to open in a new window',
        },
      ]}
      views={{
        target: '/cms/redirects',
        params: { q: search },
        onApply: (next) => {
          onSearch(next.q ?? '');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={props.isFetching}
          updatedAt={props.updatedAt}
          onRefresh={props.onRefresh}
        />
      }
    />
  );
}
