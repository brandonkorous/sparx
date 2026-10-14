'use client';

import { useState } from 'react';
import type { PageSize } from '../../components/list-pagination';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useStockLocations } from './data';
import { useBins, type Bin } from './bins-data';
import { emptyShelvesNote } from './location-stock-line';

/** A location whose shelves are on screen, and whether one of them is the default. */
export interface PlaceInView {
  name: string;
  hasDefault: boolean;
}

export type BinsList = ReturnType<typeof useBinsList>;

function useBinFilters(ctx: SurfaceContext) {
  const [search, setSearch] = useState('');
  // Seeded from the address so a location's "See its shelves" opens this on
  // that place (issue 929). Read ONCE: after that the picker owns it.
  const [locationId, setLocationId] = useState(() =>
    typeof ctx.params.location === 'string' ? ctx.params.location : ''
  );
  const [type, setType] = useState('');
  const [nonEmptyOnly, setNonEmptyOnly] = useState(false);
  return {
    search,
    setSearch,
    locationId,
    setLocationId,
    type,
    setType,
    nonEmptyOnly,
    setNonEmptyOnly,
  };
}

function usePageWindow() {
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };
  return {
    pageSize,
    setPageSize,
    page,
    setPage,
    take,
    setTake,
    skip: (page - 1) * pageSize,
    resetWindow,
  };
}

/** Locations with no default shelf in view. A put-away naming no shelf lands on the
 *  default, so these refuse every delivery, transfer and return. Judged only from
 *  the rows on screen, so nothing is claimed about shelves not looked at. */
export function locationsWithoutDefault(rows: Bin[]): PlaceInView[] {
  const shelvesInView = new Map<string, PlaceInView>();
  for (const bin of rows) {
    const seen = shelvesInView.get(bin.warehouseId);
    shelvesInView.set(bin.warehouseId, {
      name: bin.warehouseName ?? seen?.name ?? 'this location',
      hasDefault: (seen?.hasDefault ?? false) || bin.isDefault,
    });
  }
  return [...shelvesInView.values()].filter((place) => !place.hasDefault);
}

/** Filters, paging and the shelves they select. Rows arrive in walk (pick-sequence)
 *  order, so the list is a route through the room rather than an alphabet. */
export function useBinsList(ctx: SurfaceContext) {
  const filters = useBinFilters(ctx);
  const { search, locationId, type, nonEmptyOnly } = filters;
  const paging = usePageWindow();
  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((l) => l.isActive);
  const locationName = activeLocations.find((l) => l.id === locationId)?.name ?? null;

  const { data, isLoading, isFetching, dataUpdatedAt, isError, error, refetch } = useBins({
    q: search.trim(),
    ...(locationId ? { warehouseId: locationId } : {}),
    ...(type ? { type } : {}),
    nonEmptyOnly,
    take: paging.take,
    skip: paging.skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  // Null while the locations are still loading, so the note waits rather than
  // deciding on facts it does not have yet.
  const emptyNote = emptyShelvesNote(rows, locations.data ? activeLocations : null);
  // Whether this page shows EVERY shelf of the locations it names, which the
  // "no default shelf" claim needs in order to be true.
  const narrowedToOneLocation = total !== undefined && rows.length === total;
  const noDefault =
    narrowedToOneLocation && !search.trim() && type === '' && !nonEmptyOnly
      ? locationsWithoutDefault(rows)
      : [];
  const narrowed = search.trim() !== '' || locationId !== '' || type !== '' || nonEmptyOnly;

  const query = { data, isLoading, isFetching, dataUpdatedAt, isError, error, refetch };
  const shown = { activeLocations, locationName, rows, total, emptyNote, noDefault, narrowed };
  return { ...filters, ...paging, ...query, ...shown };
}
