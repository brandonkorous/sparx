'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ListToolbar as UiListToolbar,
  type ListToolbarOption,
  type ListToolbarView,
} from '@sparx/ui';
import { usePreferences } from './preferences-provider';
import { SavedViewsMenu } from './saved-views-menu';

// URL-sync wrapper around the presentational `@sparx/ui` ListToolbar (docs/34
// §7.1). It owns all Next-router knowledge: every control writes its value into
// the query string (search debounced, the rest immediately) via
// `router.replace`, and the server page re-reads `searchParams` and refetches —
// so filtering is live with no client data layer and no "Apply" button.
//
// The Table/Cards toggle reads `?view=` falling back to the user's
// `defaultListView` preference (§7.2); the toggle writes an explicit `?view=`
// override for the current view only (never persisted per-list).

export interface ListToolbarFilterConfig {
  key: string;
  label: string;
  options: ListToolbarOption[];
  /** Value to show as selected when the URL has no param for this filter — e.g.
   *  the multi-site "Site" filter shows the ACTIVE site by default (docs/49), so
   *  the list follows the global site switcher without an explicit `?site=`. */
  defaultValue?: string;
}

export interface ListToolbarProps {
  /** Show the search box. Set false on lists whose endpoint has no text search
   *  (avoids a dead control). Default true. */
  searchable?: boolean;
  /** Query key for the search box. Default `q`. */
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: ListToolbarFilterConfig[];
  /** Query key the sort select writes. Default `sort_by`. */
  sortKey?: string;
  sortOptions?: ListToolbarOption[];
  /** Show the Table/Cards toggle. Default false. */
  enableViewToggle?: boolean;
  /** Query key the view toggle writes. Default `view`. */
  viewKey?: string;
  /** Show the manual refresh button (re-runs the server fetch via
   *  `router.refresh()` without changing any filters). Default true — set false
   *  on lists that carry their own re-fetch action (e.g. SEO "Re-scan"). */
  enableRefresh?: boolean;
  /** Search debounce in ms. Default 250. */
  debounceMs?: number;
  /** Show the saved-views control. Default true; auto-hidden when the list has
   *  no view-defining params (nothing to save). */
  enableSavedViews?: boolean;
  /** Secondary action(s) — e.g. Import/Export — rendered inline before
   *  `primaryAction`. Collapses into the mobile overflow popover. */
  actions?: React.ReactNode;
  /** The primary page action — e.g. "New product" — pinned rightmost on
   *  desktop and kept visible (next to search) on mobile. */
  primaryAction?: React.ReactNode;
}

export function ListToolbar({
  searchable = true,
  searchKey = 'q',
  searchPlaceholder = 'Search…',
  filters = [],
  sortKey = 'sort_by',
  sortOptions,
  enableViewToggle = false,
  viewKey = 'view',
  enableRefresh = true,
  debounceMs = 250,
  enableSavedViews = true,
  actions,
  primaryAction,
}: ListToolbarProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const prefs = usePreferences();

  const urlSearch = searchParams?.get(searchKey) ?? '';
  const [search, setSearch] = React.useState(urlSearch);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local search in sync if the URL changes from elsewhere (e.g. back/fwd
  // or a chip clearing a different filter resets the param set).
  React.useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  const commit = React.useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      // Any filter/search/sort change resets pagination.
      next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function onSearchChange(value: string) {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit({ [searchKey]: value }), debounceMs);
  }

  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const view: ListToolbarView =
    (searchParams?.get(viewKey) as ListToolbarView | null) ?? prefs.defaultListView;

  // Saved views snapshot the view-defining params for THIS list. Target = the
  // route path, so every list gets the control with no per-list wiring; skip it
  // only when there's nothing filterable to save (or an explicit opt-out).
  const paramKeys = [
    ...(searchable ? [searchKey] : []),
    ...filters.map((f) => f.key),
    ...(sortOptions ? [sortKey] : []),
    ...(enableViewToggle ? [viewKey] : []),
  ];
  const savedViews =
    enableSavedViews && paramKeys.length > 0 ? (
      <SavedViewsMenu target={pathname} paramKeys={paramKeys} />
    ) : undefined;

  return (
    <UiListToolbar
      views={savedViews}
      searchValue={searchable ? search : undefined}
      onSearchChange={searchable ? onSearchChange : undefined}
      searchPlaceholder={searchPlaceholder}
      filters={filters.map(({ defaultValue, ...f }) => ({
        ...f,
        value: searchParams?.get(f.key) ?? defaultValue ?? '',
      }))}
      onFilterChange={(key, value) => commit({ [key]: value })}
      sort={
        sortOptions
          ? {
              options: sortOptions,
              value: searchParams?.get(sortKey) ?? sortOptions[0]?.value ?? '',
            }
          : undefined
      }
      onSortChange={(value) => commit({ [sortKey]: value })}
      view={enableViewToggle ? view : undefined}
      onViewChange={(v) => commit({ [viewKey]: v })}
      onRefresh={enableRefresh ? () => router.refresh() : undefined}
      actions={actions}
      primaryAction={primaryAction}
    />
  );
}
