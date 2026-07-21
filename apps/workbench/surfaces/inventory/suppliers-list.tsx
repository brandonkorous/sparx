'use client';

// SUPPLIERS — the businesses you buy from, and what you buy from each.
//
// ── Cards, not a table ────────────────────────────────────────────────────
//
// A supplier is a name, a way to reach them, and a couple of default terms —
// one-line things, not columns of numbers you scan down. The house rule sends
// that to cards: the supplier's identity is the content, and the only thing that
// earns a badge is the exceptional state (archived). A table here would invent a
// "Terms" column to justify itself and badge every active row green for no gain.
//
// ── Two different empties ─────────────────────────────────────────────────
//
// Nothing matches a search · you have not added a supplier yet. Telling someone
// to add their first supplier when they have forty and mistyped a name is the
// worse mistake, so the two are told apart.

import { useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  SearchInput,
  Text,
  ToggleGroup,
  ToggleGroupItem,
} from '@wizeworks/silicaui-react';
import { Archive, Mail, Phone, Plus, Truck } from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  supplierAddress,
  supplierState,
  supplierTerms,
  useSuppliers,
  type Supplier,
} from './suppliers-data';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function SupplierCard({
  supplier,
  onOpen,
}: {
  supplier: Supplier;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const state = supplierState(supplier);
  const terms = supplierTerms(supplier);
  const address = supplierAddress(supplier);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card bg-base-100 border-base-300 hover:border-module flex w-full flex-col gap-2 border p-4 text-left transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text className="truncate text-lg font-semibold">{supplier.name}</Text>
          <Text className="truncate font-mono text-sm">{supplier.code}</Text>
        </div>
        {/* Only the exceptional state is badged — a wall of green "Active" pills
            is noise, so an active supplier's card carries its details instead. */}
        {supplier.isActive ? null : (
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        )}
      </div>

      {supplier.contactName ? (
        <Text className="truncate text-sm">{supplier.contactName}</Text>
      ) : null}

      {supplier.email || supplier.phone ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {supplier.email ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <Text className="truncate text-sm">{supplier.email}</Text>
            </span>
          ) : null}
          {supplier.phone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" aria-hidden />
              <Text className="text-sm">{supplier.phone}</Text>
            </span>
          ) : null}
        </div>
      ) : null}

      {terms ? <Text className="text-sm">{terms}</Text> : null}
      {address ? <Text className="truncate text-sm">{address}</Text> : null}
    </button>
  );
}

export function SuppliersListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;

  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useSuppliers({
    q: search.trim(),
    includeArchived,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const searching = search.trim() !== '';

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openSupplier = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.suppliers.detail', { id }, { target: targetFor(event) });
  };

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<Truck className="size-6" aria-hidden />}
          title="Could not load your suppliers"
          description="This is a problem reaching the server. Your suppliers are unaffected — the list just could not be read just now."
        />
      );
    }

    if (isLoading) {
      return (
        <p className="p-4 text-sm" role="status">
          Loading suppliers…
        </p>
      );
    }

    if (rows.length === 0) {
      if (searching) {
        return (
          <EmptyState
            icon={<Truck className="size-6" aria-hidden />}
            title="No supplier matches that"
            description="Try part of a supplier's name or their short code. Retired suppliers are hidden unless you include archived ones."
          />
        );
      }
      return (
        <EmptyState
          icon={<Truck className="size-6" aria-hidden />}
          title={includeArchived ? 'No suppliers yet' : 'No active suppliers'}
          description={
            includeArchived
              ? 'A supplier is a business you buy stock from. Add your first one and you can raise purchase orders against it.'
              : 'Every supplier you buy from is retired, or you have not added one yet. Add a supplier to start ordering stock, or include archived ones to see retired records.'
          }
          actions={
            <Button
              size="sm"
              color="module"
              onClick={() => {
                ctx.open('inventory.suppliers.detail', { id: 'new' }, { target: 'tab' });
              }}
            >
              <Plus className="size-4" aria-hidden />
              New supplier
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-3 @3xl:grid-cols-2">
        {rows.map((supplier) => (
          <SupplierCard
            key={supplier.id}
            supplier={supplier}
            onOpen={(event) => {
              openSupplier(supplier.id, event);
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Supplier list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search suppliers"
            placeholder="Supplier name or code…"
            value={search}
            onValueChange={(next) => {
              setSearch(next);
              resetWindow();
            }}
          />
        </div>

        <ToggleGroup
          size="sm"
          color="module"
          className="ml-auto shrink-0"
          value={includeArchived ? ['archived'] : []}
          onValueChange={(next: unknown[]) => {
            setIncludeArchived(next.includes('archived'));
            resetWindow();
          }}
        >
          <ToggleGroupItem
            value="archived"
            aria-label="Include archived suppliers"
            title="Include archived suppliers"
          >
            <Archive className="size-4" aria-hidden />
            <span className="hidden @2xl:inline">Archived</span>
          </ToggleGroupItem>
        </ToggleGroup>

        <Button
          size="sm"
          color="module"
          className="shrink-0 whitespace-nowrap"
          onClick={() => {
            ctx.open('inventory.suppliers.detail', { id: 'new' }, { target: 'tab' });
          }}
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden @lg:inline">New supplier</span>
        </Button>

        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto">{body()}</div>

      <div className="mx-auto w-full max-w-5xl shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
      </div>
    </div>
  );
}
