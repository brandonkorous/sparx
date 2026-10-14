'use client';

// The authors list's toolbar: search, a count, "New author", saved views, refresh.

import { SearchInput } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';

interface AuthorsToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  /** How many authors the search matched, and how many there are in all. */
  matched: number;
  total: number;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
  onCreate: (event: { shiftKey: boolean; altKey: boolean }) => void;
}

function countWords(searching: boolean, matched: number, total: number): string {
  if (searching) return `${String(matched)} of ${String(total)}`;
  return total === 1 ? '1 author' : `${String(total)} authors`;
}

// Search, a count and the primary action fit one line; below @xl the count gives
// way first, since search is used constantly and the count is a glance.
export function AuthorsToolbar(props: AuthorsToolbarProps) {
  const { search, onSearch } = props;
  return (
    <PaneToolbar
      label="Authors controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search authors"
            placeholder="Search by name…"
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
        label: 'New author',
        icon: faPlus,
        onClick: props.onCreate,
        title: 'Add an author: hold Shift to open alongside, Alt for a new window',
      }}
      views={{
        target: '/cms/authors',
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
