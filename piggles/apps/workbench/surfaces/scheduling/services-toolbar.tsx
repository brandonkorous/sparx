'use client';

// What narrows the services list. Split out of services-list.tsx (RULE #0.5).
// Every control here is a SERVER filter, so a page of results is the answer to
// the whole question rather than fifty rows sieved in the browser.

import { NativeSelect, SearchInput, ToggleGroup, ToggleGroupItem } from '@wizeworks/silicaui-react';
import { faEyeSlash, faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { BOOKING_TYPES } from './setup-data';

export interface ServicesFilters {
  search: string;
  type: string;
  activeOnly: boolean;
  showRemoved: boolean;
}

export function ServicesToolbar({
  filters,
  onChange,
  onNew,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  filters: ServicesFilters;
  onChange: (next: ServicesFilters) => void;
  onNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  const { search, type, activeOnly, showRemoved } = filters;
  const put = (patch: Partial<ServicesFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <PaneToolbar
      label="Services list controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search services"
            placeholder="Service name…"
            value={search}
            onValueChange={(next) => {
              put({ search: next });
            }}
          />
        </div>
      }
      primaryAction={{
        label: 'New service',
        icon: faPlus,
        onClick: onNew,
        title: 'New service — hold Shift to open alongside, Alt for a new window',
      }}
      controls={
        <>
          <NativeSelect
            size="sm"
            className="max-w-44 shrink"
            aria-label="Show only one kind of booking"
            value={type}
            onChange={(event) => {
              put({ type: event.target.value });
            }}
          >
            <option value="">Every kind</option>
            {BOOKING_TYPES.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </NativeSelect>
          <ToggleGroup
            size="sm"
            color="module"
            className="shrink-0"
            value={activeOnly ? ['active'] : []}
            onValueChange={(next: unknown[]) => {
              put({ activeOnly: next.includes('active') });
            }}
          >
            <ToggleGroupItem
              value="active"
              aria-label="Hide switched-off services"
              title="Hide switched-off services"
            >
              <Icon glyph={faEyeSlash} className="size-4" aria-hidden />
              <span>Active only</span>
            </ToggleGroupItem>
          </ToggleGroup>
          {/* Its own group, not a third state of the one above: that toggle
              narrows what is live, this one widens to what is gone. */}
          <ToggleGroup
            size="sm"
            color="module"
            className="shrink-0"
            value={showRemoved ? ['removed'] : []}
            onValueChange={(next: unknown[]) => {
              put({ showRemoved: next.includes('removed') });
            }}
          >
            <ToggleGroupItem
              value="removed"
              aria-label="Show services you have removed"
              title="Show services you have removed, so you can put one back"
            >
              <Icon glyph={faTrashCan} className="size-4" aria-hidden />
              <span>Removed</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </>
      }
      views={{
        target: '/scheduling/services',
        params: {
          q: search.trim(),
          type,
          active: activeOnly ? '1' : '',
          removed: showRemoved ? '1' : '',
        },
        onApply: (next) => {
          onChange({
            search: next.q ?? '',
            type: next.type ?? '',
            activeOnly: next.active === '1',
            showRemoved: next.removed === '1',
          });
        },
      }}
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}
