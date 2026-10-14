'use client';

// The kinds-of-content list's toolbar: search, the Kind filter, create, saved views, refresh.

import { SearchInput } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';

export const KIND_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'custom', label: 'Yours' },
  { value: 'built_in', label: 'Built-in' },
] as const;

export type KindFilterValue = (typeof KIND_FILTERS)[number]['value'];

interface ContentTypesToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  kind: KindFilterValue;
  onKind: (next: KindFilterValue) => void;
  createLabel: string;
  onCreate: (event: { shiftKey: boolean; altKey: boolean }) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

export function ContentTypesToolbar(props: ContentTypesToolbarProps) {
  const { search, onSearch, kind, onKind } = props;
  return (
    <PaneToolbar
      label="Kinds of content controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search kinds of content"
            placeholder="Name or reference…"
            value={search}
            onValueChange={onSearch}
          />
        </div>
      }
      primaryAction={{
        label: props.createLabel,
        icon: faPlus,
        onClick: props.onCreate,
        title: 'Define a new kind of content. Hold Shift to open alongside, Alt for a new window',
      }}
      filters={[
        {
          label: 'Kind',
          value: kind,
          onValueChange: (next) => {
            onKind((next as KindFilterValue | null) ?? 'all');
          },
          options: KIND_FILTERS,
        },
      ]}
      views={{
        target: '/cms/types',
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
