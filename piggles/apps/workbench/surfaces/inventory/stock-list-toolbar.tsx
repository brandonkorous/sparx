'use client';

// The stock list's controls — search, which location, which state, saved views
// and refresh. Separated from the pane because choosing what to ask the server
// for is a different job from holding the answer.
//
// There is deliberately no primary action here: stock is not something you
// create on this screen, it arrives by counting, receiving or selling.

import { SearchInput } from '@wizeworks/silicaui-react';
import { PaneToolbar } from '../../components/pane-toolbar';
import { surfaceTitle } from '../../lib/surfaces/registry';
import type { ToolbarFilter } from '../../components/pane-toolbar-filters';
import { RefreshButton } from '../../components/refresh-button';
import type { SortDirection, StockLocation, StockSortKey } from './data';

/**
 * Which states of stock the list is narrowed to.
 *
 * Three values rather than two booleans, because they are the answers to ONE
 * question and the server makes them mutually exclusive: "running low" is paired
 * with `sellable_only`, so a level at zero is `out` and never also `low`. Two
 * independent toggles would offer a both-on combination that means neither.
 */
export type StockLevelFilter = '' | 'low' | 'out';

/** The words the STATE column badges on every row a choice returns, so the chip
 *  and the rows under it say the same thing. Home says "sold out" — the
 *  shopper's word, which is right where it stands and is one click away. */
const LEVELS: readonly { value: StockLevelFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'low', label: 'Running low' },
  { value: 'out', label: 'None to sell' },
];

interface ToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  locationId: string;
  onLocation: (next: string) => void;
  locations: StockLocation[];
  level: StockLevelFilter;
  onLevel: (next: StockLevelFilter) => void;
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

  // Chips, because the set is short and fixed and the current one should be a
  // filled shape you read without reading. This was one pressed "Running low"
  // button while there was a single yes/no question; there are now two states
  // that are genuinely different problems, and a subset of a toggle is not a
  // toggle. The bar folds it into a labelled select on a narrow pane.
  const levelFilter: ToolbarFilter = {
    label: 'Show',
    key: 'level',
    value: props.level,
    neutralValue: '',
    options: LEVELS,
    onValueChange: (next) => {
      props.onLevel((next as StockLevelFilter | null) ?? '');
    },
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
      filters={[levelFilter, locationFilter]}
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

/** A `level` arriving from outside — a deep link from Home, or a saved view
 *  written before this was a three-way choice. Anything unrecognised means
 *  "no narrowing", never a guess. */
export function parseLevel(raw: string | undefined): StockLevelFilter {
  if (raw === 'low' || raw === 'out') return raw;
  return '';
}

/**
 * What the TAB says, in the same words as the chips.
 *
 * Params make a distinct pane, so opening this one narrowed adds a SECOND tab
 * beside any already open, and two reading "Stock" — one showing 62 rows and one
 * showing 1 — is worse than the deep link is better. Base from the registry, so
 * a brand that renames the screen renames these too.
 */
export function titleForLevel(level: StockLevelFilter): string {
  const base = surfaceTitle('inventory.stock.list') ?? 'Stock';
  const chosen = LEVELS.find((option) => option.value === level);
  return level === '' || !chosen ? base : `${base} · ${chosen.label.toLowerCase()}`;
}
