'use client';

// Search, the two filters and the sort. No permanent primary action — drafting
// appears in its own bar once lines are chosen.

import { NativeSelect, SearchInput } from '@wizeworks/silicaui-react';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { StockLocation } from './data';
import type { ReorderSort, ReorderSupplier } from './reorder-data';

export interface ReorderFilters {
  search: string;
  locationId: string;
  supplierId: string;
  sort: ReorderSort;
}

function Picker({
  label,
  value,
  onChange,
  width,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  width: string;
  children: React.ReactNode;
}) {
  return (
    <NativeSelect
      size="sm"
      className={width}
      aria-label={label}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {children}
    </NativeSelect>
  );
}

interface ControlProps {
  filters: ReorderFilters;
  onNarrow: (next: ReorderFilters) => void;
  onSort: (sort: ReorderSort) => void;
  locations: StockLocation[];
  suppliers: ReorderSupplier[];
}

/** Default order is the one that spends an hour best — most money at risk first.
 *  The others are lenses on the same set: "least in stock" for a walk round the
 *  shelves, "runs out soonest" for a deadline, "furthest below target" for
 *  finding rules that are mis-set rather than stock that needs buying. */
function SortPicker({ sort, onSort }: { sort: ReorderSort; onSort: (s: ReorderSort) => void }) {
  return (
    <Picker
      label="Order the list by"
      width="max-w-48 shrink"
      value={sort}
      onChange={(next) => {
        onSort(next as ReorderSort);
      }}
    >
      <option value="risk">Costs the most to miss</option>
      <option value="cover">Runs out soonest</option>
      <option value="urgency">Least in stock first</option>
      <option value="shortfall">Furthest below target</option>
    </Picker>
  );
}

function FilterControls({ filters, onNarrow, onSort, locations, suppliers }: ControlProps) {
  return (
    <>
      <Picker
        label="Show items kept at"
        width="max-w-40 shrink"
        value={filters.locationId}
        onChange={(locationId) => {
          onNarrow({ ...filters, locationId });
        }}
      >
        <option value="">Every location</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </Picker>
      <Picker
        label="Show items bought from"
        width="max-w-40 shrink"
        value={filters.supplierId}
        onChange={(supplierId) => {
          onNarrow({ ...filters, supplierId });
        }}
      >
        <option value="">Every supplier</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </Picker>
      <SortPicker sort={filters.sort} onSort={onSort} />
    </>
  );
}

/** A saved view carries every narrowing, so applying one is a whole new filter
 *  set rather than a field at a time. */
function viewSlot(filters: ReorderFilters, onNarrow: (next: ReorderFilters) => void) {
  return {
    target: '/inventory/reorder',
    params: {
      q: filters.search.trim(),
      warehouse: filters.locationId,
      supplier: filters.supplierId,
      sort: filters.sort,
    },
    onApply: (next: Record<string, string | undefined>) => {
      onNarrow({
        search: next.q ?? '',
        locationId: next.warehouse ?? '',
        supplierId: next.supplier ?? '',
        sort: next.sort ? (next.sort as ReorderSort) : 'risk',
      });
    },
  };
}

export function ReorderListToolbar({
  isFetching,
  updatedAt,
  onRefresh,
  ...controls
}: ControlProps & {
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  const { filters, onNarrow } = controls;
  return (
    <PaneToolbar
      label="Reorder controls"
      search={
        /* Width sits on a WRAPPER: SearchInput forwards className to its inner
           <input>, so a size aimed at the control never reaches what lays out. */
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search what needs reordering"
            placeholder="Product name or code…"
            value={filters.search}
            onValueChange={(search) => {
              onNarrow({ ...filters, search });
            }}
          />
        </div>
      }
      controls={<FilterControls {...controls} />}
      views={viewSlot(filters, onNarrow)}
      refresh={
        /* ALWAYS the last child of a list toolbar. */
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}
