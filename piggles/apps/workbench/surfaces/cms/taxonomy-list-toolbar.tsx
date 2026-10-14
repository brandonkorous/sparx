'use client';

// The ways-to-file list's toolbar: search, a count, create, saved views, refresh.

import { SearchInput } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';

interface TaxonomyToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  matched: number;
  total: number;
  createLabel: string;
  onCreate: (event: { shiftKey: boolean; altKey: boolean }) => void;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

function countWords(searching: boolean, matched: number, total: number): string {
  if (searching) return `${String(matched)} of ${String(total)}`;
  return total === 1 ? '1 way to file' : `${String(total)} ways to file`;
}

export function TaxonomyToolbar(props: TaxonomyToolbarProps) {
  const { search, onSearch, createLabel } = props;
  return (
    <PaneToolbar
      label="Tags and topics controls"
      search={
        // The width sits on a WRAPPER: SearchInput forwards className to its inner
        // <input>, so a class aimed at the control never reaches the element that lays out.
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search tags and topics"
            placeholder="Search…"
            value={search}
            onValueChange={onSearch}
          />
        </div>
      }
      status={
        <p className="hidden shrink-0 text-sm whitespace-nowrap @xl:block">
          {countWords(Boolean(search.trim()), props.matched, props.total)}
        </p>
      }
      statusReady={!props.isPending}
      statusFailed={props.isError}
      primaryAction={{
        label: createLabel,
        icon: faPlus,
        onClick: props.onCreate,
        title: `${createLabel}: hold Shift to open alongside, Alt for a new window`,
      }}
      views={{
        target: '/cms/taxonomy',
        params: { q: search },
        onApply: (next) => {
          onSearch(next.q ?? '');
        },
      }}
      refresh={
        // ALWAYS the last child of a list toolbar; see RefreshButton.
        <RefreshButton
          isFetching={props.isFetching}
          updatedAt={props.updatedAt}
          onRefresh={props.onRefresh}
        />
      }
    />
  );
}
