'use client';

// Everything the reorder pane knows before it draws: the filters, the window
// over the results, the four reads behind them, and the selection built from
// the rows they return. Kept together because every change to one is a
// decision about the others.

import { useState } from 'react';
import { type PageSize } from '../../components/list-pagination';
import { useStockLocations } from './data';
import {
  useReorderSummary,
  useReorderSuppliers,
  useReorderWorklist,
  type ReorderSort,
} from './reorder-data';
import { useReorderSelection } from './reorder-selection';
import type { ReorderFilters } from './reorder-list-toolbar';

const NO_FILTERS: ReorderFilters = { search: '', locationId: '', supplierId: '', sort: 'risk' };

export function useReorderWindow() {
  const [filters, setFilters] = useState<ReorderFilters>(NO_FILTERS);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const rewind = () => {
    setPage(1);
    setTake(pageSize);
  };

  /** A change to WHICH rows match returns to the first window. The caller also
   *  drops the selection — chosen lines that no longer match would draft
   *  invisibly — which it must, because the selection is built from the rows
   *  this window returns. */
  const onNarrow = (next: ReorderFilters) => {
    setFilters(next);
    rewind();
  };

  /** Re-sorting keeps the selection: it is the same result set in a different
   *  order, not a different set. */
  const onSort = (sort: ReorderSort) => {
    setFilters((current) => ({ ...current, sort }));
    rewind();
  };

  return {
    filters,
    onNarrow,
    onSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    take,
    setTake,
    skip: (page - 1) * pageSize,
    narrowed:
      filters.search.trim() !== '' || filters.locationId !== '' || filters.supplierId !== '',
  };
}

export type ReorderPane = ReturnType<typeof useReorderPane>;

export function useReorderPane() {
  const w = useReorderWindow();

  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((l) => l.isActive);
  const activeSuppliers = (useReorderSuppliers().data?.items ?? []).filter((s) => s.isActive);
  const summary = useReorderSummary();

  const query = useReorderWorklist({
    q: w.filters.search.trim(),
    ...(w.filters.locationId ? { warehouseId: w.filters.locationId } : {}),
    ...(w.filters.supplierId ? { supplierId: w.filters.supplierId } : {}),
    sort: w.filters.sort,
    take: w.take,
    skip: w.skip,
  });

  const rows = query.data?.items ?? [];
  const selection = useReorderSelection(rows);

  return {
    w,
    query,
    rows,
    selection,
    activeLocations,
    activeSuppliers,
    policyCount: summary.data?.policyCount,
    locationName: activeLocations.find((l) => l.id === w.filters.locationId)?.name ?? null,
    supplierName: activeSuppliers.find((s) => s.id === w.filters.supplierId)?.name ?? null,
    // The selection is built from the rows the window returns, so narrowing
    // drops it here rather than inside the window hook, which runs before them.
    onNarrow: (next: ReorderFilters) => {
      w.onNarrow(next);
      selection.clear();
    },
  };
}
