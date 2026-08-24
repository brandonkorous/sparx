'use client';

// Search, the kind filter, the closed-locations toggle, and New. No sort — the
// list is short enough that "in use first, then by code" is the whole answer.

import { NativeSelect, SearchInput, ToggleGroup, ToggleGroupItem } from '@wizeworks/silicaui-react';
import { faEyeSlash, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { Icon } from '@piggles/ui';
import { LOCATION_TYPES } from './locations-data';

function Filters({
  type,
  onType,
  includeClosed,
  onIncludeClosed,
}: {
  type: string;
  onType: (next: string) => void;
  includeClosed: boolean;
  onIncludeClosed: (next: boolean) => void;
}) {
  return (
    <>
      <NativeSelect
        size="sm"
        className="max-w-40 shrink"
        aria-label="Show only one kind of place"
        value={type}
        onChange={(event) => {
          onType(event.target.value);
        }}
      >
        <option value="">Every kind</option>
        {LOCATION_TYPES.map((kind) => (
          <option key={kind.value} value={kind.value}>
            {kind.label}
          </option>
        ))}
      </NativeSelect>
      {/* One pressed button, not a chip pair: this is a single yes/no question,
              and two chips would read as two categories of location. It sheds its
              label below @2xl — the eye icon plus the tooltip carries it. */}
      <ToggleGroup
        size="sm"
        color="module"
        className="shrink-0"
        value={includeClosed ? ['closed'] : []}
        onValueChange={(next: unknown[]) => {
          onIncludeClosed(next.includes('closed'));
        }}
      >
        <ToggleGroupItem
          value="closed"
          aria-label="Also show closed locations"
          title="Also show closed locations"
        >
          <Icon glyph={faEyeSlash} className="size-4" aria-hidden />
          <span>Show closed</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </>
  );
}

export function LocationsListToolbar({
  search,
  onSearch,
  type,
  onType,
  includeClosed,
  onIncludeClosed,
  onNew,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  search: string;
  onSearch: (next: string) => void;
  type: string;
  onType: (next: string) => void;
  includeClosed: boolean;
  onIncludeClosed: (next: boolean) => void;
  onNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  return (
    <PaneToolbar
      label="Locations list controls"
      search={
        /* The width sits on a WRAPPER: SearchInput forwards className to its
          inner <input>, so a sizing class aimed at the control never reaches
          the element that lays out. */
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search locations"
            placeholder="Name or code…"
            value={search}
            onValueChange={onSearch}
          />
        </div>
      }
      primaryAction={{
        label: 'New location',
        icon: faPlus,
        onClick: onNew,
        title: 'New location — hold Shift to open alongside, Alt for a new window',
      }}
      controls={
        <Filters
          type={type}
          onType={onType}
          includeClosed={includeClosed}
          onIncludeClosed={onIncludeClosed}
        />
      }
      views={{
        target: '/inventory/warehouses',
        params: { q: search.trim(), kind: type, closed: includeClosed ? '1' : '' },
        onApply: (next) => {
          onSearch(next.q ?? '');
          onType(next.kind ?? '');
          onIncludeClosed(next.closed === '1');
        },
      }}
      refresh={
        /* ALWAYS the last child of a list toolbar — see RefreshButton. */
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}
