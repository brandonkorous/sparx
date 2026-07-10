'use client';

import * as React from 'react';
import { LayoutGrid, MoreHorizontal, RefreshCw, Rows3 } from 'lucide-react';
import {
  Button,
  Divider,
  NativeSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@wizeworks/silicaui-react';
import { useMediaQuery } from '../../hooks/use-media-query';
import { cn } from '../../utils/cn';

// ListToolbar — the standard toolbar above every Collection/List (docs/34 §7.1).
// One row: a leading saved-views control, a search box that grows, inline
// quick-filter selects, and a right cluster (refresh + sort + secondary
// actions + primary action + the Table/Cards toggle). Built entirely from
// silicaui primitives (`SearchInput`/`NativeSelect`/`ToggleGroup`/`Button`/
// `Popover`) — no hand-rolled inputs or buttons.
//
// Below `md`, only saved views, the search box, and `primaryAction` stay
// inline — every other control (filters, refresh, sort, secondary `actions`,
// the view toggle) collapses into a single "More" popover, so the row never
// wraps into a multi-line mess on a phone. Saved views and `primaryAction`
// stay outside the popover because they're navigation/primary controls
// people reach for most — burying them behind an overflow menu would hurt
// discoverability.
//
// Presentational + controlled only: every control reports changes through a
// callback and this component holds no URL/router knowledge — so `@sparx/ui`
// stays framework-agnostic. The dashboard's URL-sync wrapper turns these
// callbacks into debounced `searchParams` updates; the server page reads the
// params and refetches. Filtering is live — there is no "Apply" button.

export interface ListToolbarOption {
  value: string;
  label: string;
}

export interface ListToolbarFilter {
  /** The query-string key this filter writes (e.g. `status`). */
  key: string;
  /** Human label — used for the "All {label}" default option. */
  label: string;
  options: ListToolbarOption[];
  /** Current value; `''` means no filter applied. */
  value: string;
}

export interface ListToolbarSort {
  options: ListToolbarOption[];
  value: string;
}

export type ListToolbarView = 'table' | 'card';

export interface ListToolbarProps {
  /** Current search text. Omit (with `onSearchChange`) to hide the search box —
   *  e.g. on lists whose endpoint has no text search. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Quick-filter selects, rendered inline after the search box on desktop;
   *  collapse into the overflow popover below `md`. */
  filters?: ListToolbarFilter[];
  onFilterChange?: (key: string, value: string) => void;

  /** Sort control. Collapses into the overflow popover below `md`. */
  sort?: ListToolbarSort;
  onSortChange?: (value: string) => void;

  /** Table/Cards toggle, far right on desktop. Omit to hide it (single-rendering
   *  lists). Collapses into the overflow popover below `md`. */
  view?: ListToolbarView;
  onViewChange?: (view: ListToolbarView) => void;

  /** Manual refresh. Omit to hide the button — e.g. lists that already carry
   *  their own re-fetch action. The icon spins briefly on click for feedback.
   *  Collapses into the overflow popover below `md`. */
  onRefresh?: () => void;

  /** Optional leading slot for a saved-views control, rendered first in the
   *  row (before search) — always visible, like `primaryAction`, since it's
   *  a navigation control (switching views) rather than a filter. Never
   *  collapses into the mobile overflow popover. Presentational-agnostic:
   *  the dashboard wrapper supplies the control. */
  views?: React.ReactNode;

  /** Secondary action(s) — e.g. Import/Export — rendered inline before
   *  `primaryAction` on desktop. Collapses into the overflow popover below
   *  `md` (unlike `primaryAction`, which always stays visible). */
  actions?: React.ReactNode;

  /** The primary page action — e.g. "New product" — pinned as the rightmost
   *  element on desktop, and kept visible (next to search) on mobile even
   *  though every other control collapses. Toolbars carry buttons, not the
   *  page header: keep `PageHeader.actions` for secondary/utility actions,
   *  and put the primary create action here. */
  primaryAction?: React.ReactNode;

  className?: string;
}

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  onFilterChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  onRefresh,
  views,
  actions,
  primaryAction,
  className,
}: ListToolbarProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const hasOverflow =
    filters.length > 0 || Boolean(onRefresh) || Boolean(sort) || Boolean(actions) || Boolean(view);

  const filterSelects = filters.map((f) => (
    <NativeSelect
      key={f.key}
      className="w-auto"
      aria-label={f.label}
      value={f.value}
      onChange={(e) => onFilterChange?.(f.key, e.target.value)}
    >
      <option value="">All {f.label.toLowerCase()}</option>
      {f.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  ));

  const sortSelect = sort && (
    <NativeSelect
      className="w-auto"
      aria-label="Sort by"
      value={sort.value}
      onChange={(e) => onSortChange?.(e.target.value)}
    >
      {sort.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );

  const viewToggle = view && (
    <ToggleGroup
      aria-label="List view"
      value={[view]}
      onValueChange={(next: string[]) => {
        const v = next[0];
        if (v) onViewChange?.(v as ListToolbarView);
      }}
    >
      <ToggleGroupItem value="table" aria-label="Table view">
        <Rows3 className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="card" aria-label="Card view">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <div role="search" className={cn('flex flex-wrap items-center gap-2', className)}>
      {views}

      {onSearchChange && (
        <div className="min-w-48 flex-1">
          <SearchInput
            placeholder={searchPlaceholder}
            value={searchValue ?? ''}
            onValueChange={onSearchChange}
            aria-label="Search"
          />
        </div>
      )}

      {isDesktop ? (
        <>
          {filterSelects}

          {(Boolean(sort) ||
            Boolean(view) ||
            Boolean(onRefresh) ||
            Boolean(actions) ||
            Boolean(primaryAction)) && (
            <div className="ml-auto flex items-center gap-2">
              {onRefresh && <RefreshButton onRefresh={onRefresh} />}

              {sortSelect}

              {Boolean(sort) && Boolean(actions) && (
                <Divider orientation="vertical" className="m-0 h-6 p-0" />
              )}

              {actions}
              {primaryAction}

              {(Boolean(actions) || Boolean(primaryAction)) && Boolean(view) && (
                <Divider orientation="vertical" className="m-0 h-6 p-0" />
              )}

              {viewToggle}
            </div>
          )}
        </>
      ) : (
        <div className="ml-auto flex items-center gap-2">
          {primaryAction}

          {hasOverflow && (
            <Popover>
              <PopoverTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  shape="square"
                  aria-label="More list controls"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-64 flex-col gap-2">
                {filterSelects}
                {sortSelect}
                {onRefresh && <RefreshButton onRefresh={onRefresh} full />}
                {actions}
                {viewToggle}
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
    </div>
  );
}

function RefreshButton({ onRefresh, full }: { onRefresh: () => void; full?: boolean }) {
  const [spinning, setSpinning] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function handleClick() {
    onRefresh();
    setSpinning(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSpinning(false), 600);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      shape={full ? undefined : 'square'}
      block={full}
      iconStart={
        full ? <RefreshCw className={cn('h-4 w-4', spinning && 'animate-spin')} /> : undefined
      }
      aria-label="Refresh"
      onClick={handleClick}
    >
      {full ? 'Refresh' : <RefreshCw className={cn('h-4 w-4', spinning && 'animate-spin')} />}
    </Button>
  );
}
