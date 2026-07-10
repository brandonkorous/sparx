'use client';

// Reorder workspace — wraps the reorder board + the unsupplied panel with a
// search/filter bar (docs/100 P3d). Unlike every other list page, the reorder
// surface is a single bounded fetch (suggestions are computed, not paginated)
// feeding a stateful batch-edit tool (checkbox + quantity per line, drafted
// into a PO) — so filtering runs client-side over the already-loaded data
// instead of a URL-synced server round-trip, using `@sparx/ui`'s presentational
// `ListToolbar` directly (not the dashboard's router-wired wrapper) with local
// React state. This is also why there's no Table/Cards view toggle here: the
// board's rows are an editable form, not a browsable row — a "card view" of
// per-line checkboxes and quantity inputs isn't a meaningful alternate layout.

import * as React from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { ListToolbar, type ListToolbarFilter } from '@sparx/ui';

import { ReorderBoard } from './reorder-board';
import { UnsuppliedPanel } from './unsupplied-panel';
import type { ReorderGroup, ReorderSuggestionLine, UnsuppliedSuggestion } from './types';

interface ReorderWorkspaceProps {
  groups: ReorderGroup[];
  unsupplied: UnsuppliedSuggestion[];
}

function matchesSearch(
  needle: string,
  line: Pick<ReorderSuggestionLine, 'sku' | 'title'> & { supplierSku?: string | null }
): boolean {
  if (!needle) return true;
  return (
    (line.sku ?? '').toLowerCase().includes(needle) ||
    (line.title ?? '').toLowerCase().includes(needle) ||
    (line.supplierSku ?? '').toLowerCase().includes(needle)
  );
}

export function ReorderWorkspace({ groups, unsupplied }: ReorderWorkspaceProps) {
  const [search, setSearch] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState('');

  const supplierOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of groups) seen.set(g.supplierId, g.supplierName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [groups]);

  const warehouseOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of groups) seen.set(g.warehouseId, g.warehouseName);
    for (const u of unsupplied) seen.set(u.warehouseId, u.warehouseName ?? u.warehouseCode);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [groups, unsupplied]);

  const needle = search.trim().toLowerCase();

  const filteredGroups = React.useMemo(
    () =>
      groups
        .filter(
          (g) =>
            (!supplierId || g.supplierId === supplierId) &&
            (!warehouseId || g.warehouseId === warehouseId)
        )
        .map((g) => ({ ...g, lines: g.lines.filter((l) => matchesSearch(needle, l)) }))
        .filter((g) => g.lines.length > 0),
    [groups, supplierId, warehouseId, needle]
  );

  const filteredUnsupplied = React.useMemo(
    () =>
      unsupplied.filter(
        (u) => (!warehouseId || u.warehouseId === warehouseId) && matchesSearch(needle, u)
      ),
    [unsupplied, warehouseId, needle]
  );

  const filters: ListToolbarFilter[] = [
    ...(supplierOptions.length > 1
      ? [{ key: 'supplier', label: 'Suppliers', options: supplierOptions, value: supplierId }]
      : []),
    ...(warehouseOptions.length > 1
      ? [{ key: 'warehouse', label: 'Warehouses', options: warehouseOptions, value: warehouseId }]
      : []),
  ];

  function onFilterChange(key: string, value: string) {
    if (key === 'supplier') setSupplierId(value);
    if (key === 'warehouse') setWarehouseId(value);
  }

  const hasAnyFilter = search !== '' || supplierId !== '' || warehouseId !== '';
  const hasResults = filteredGroups.length > 0 || filteredUnsupplied.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {(supplierOptions.length > 1 || warehouseOptions.length > 1) && (
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search SKU or product…"
          filters={filters}
          onFilterChange={onFilterChange}
        />
      )}

      {!hasResults ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title={hasAnyFilter ? 'No suggestions match this search' : 'Nothing to reorder'}
              description={
                hasAnyFilter
                  ? 'Try a different SKU, product name, or filter.'
                  : 'Every tracked item is above its reorder point. Set reorder points on the stock grid to have low items surface here.'
              }
              actions={
                hasAnyFilter ? undefined : (
                  <Button variant="outline" size="sm" render={<Link href="/inventory/stock" />}>
                    Go to stock
                  </Button>
                )
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {filteredGroups.length > 0 && <ReorderBoard groups={filteredGroups} />}
          {filteredUnsupplied.length > 0 && <UnsuppliedPanel items={filteredUnsupplied} />}
        </>
      )}
    </div>
  );
}
