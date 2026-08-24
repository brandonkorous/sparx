'use client';

// The stock list's controls — search, which location, "running low", saved
// views and refresh. Separated from the pane because choosing what to ask the
// server for is a different job from holding the answer.
//
// There is deliberately no primary action here: stock is not something you
// create on this screen, it arrives by counting, receiving or selling.

import { SearchInput, ToggleGroup, ToggleGroupItem } from '@wizeworks/silicaui-react';
import { faArrowTrendDown } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import type { ToolbarFilter } from '../../components/pane-toolbar-filters';
import { RefreshButton } from '../../components/refresh-button';
import type { SortDirection, StockLocation, StockSortKey } from './data';

interface ToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  locationId: string;
  onLocation: (next: string) => void;
  locations: StockLocation[];
  lowOnly: boolean;
  onLowOnly: (next: boolean) => void;
  viewParams: Record<string, string>;
  onApplyView: (next: Record<string, string | undefined>) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

export function StockListToolbar(props: ToolbarProps) {
  // A picker rather than chips: a business can have twenty locations, and twenty
  // chips is a toolbar taller than the table.
  const locationFilter: ToolbarFilter = {
    label: 'Show stock kept at',
    key: 'warehouse',
    present: 'select',
    value: props.locationId,
    neutralValue: '',
    options: [
      { value: '', label: 'Every location' },
      ...props.locations.map((location) => ({ value: location.id, label: location.name })),
    ],
    onValueChange: props.onLocation,
  };

  return (
    <PaneToolbar
      label="Stock list controls"
      search={
        <SearchInput
          size="sm"
          aria-label="Search stock"
          placeholder="Product name or code…"
          value={props.search}
          onValueChange={props.onSearch}
        />
      }
      filters={[locationFilter]}
      // One pressed button, not a chip pair: this is a single yes/no question,
      // and "All / Running low" as two chips reads as two categories of stock.
      controls={
        <ToggleGroup
          size="sm"
          color="module"
          className="shrink-0"
          value={props.lowOnly ? ['low'] : []}
          onValueChange={(next: unknown[]) => {
            props.onLowOnly(next.includes('low'));
          }}
        >
          <ToggleGroupItem
            value="low"
            aria-label="Only show what is running low"
            title="Only show what is running low"
          >
            <Icon glyph={faArrowTrendDown} className="size-4" aria-hidden />
            <span className="hidden @2xl:inline">Running low</span>
          </ToggleGroupItem>
        </ToggleGroup>
      }
      activeControls={props.lowOnly ? 1 : 0}
      // A person who has got this list exactly right — one location, running
      // low, sorted by what to sell — should not rebuild it tomorrow.
      views={{ target: '/inventory/stock', params: props.viewParams, onApply: props.onApplyView }}
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

/** The sort a saved view carries, parsed back into state. Kept beside the
 *  toolbar because the string shape is the toolbar's contract. */
export function parseSort(
  raw: string | undefined
): { key: StockSortKey; dir: SortDirection } | null {
  const [key, dir] = (raw ?? '').split(':');
  if (!key || (dir !== 'asc' && dir !== 'desc')) return null;
  return { key: key as StockSortKey, dir };
}
