'use client';

import {
  Button,
  NativeSelect,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faQrcode } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import type { ToolbarViews } from '../../components/pane-toolbar-views';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { BIN_TYPES } from './bins-data';
import type { BinsList } from './use-bins-list';

interface ToolbarProps {
  ctx: SurfaceContext;
  list: BinsList;
}

function LabelsButton({ ctx, list }: ToolbarProps) {
  return (
    <Tooltip content="Print labels for the shelves you are looking at">
      <Button
        size="sm"
        variant="outline"
        color="neutral"
        onClick={() => {
          ctx.open(
            'inventory.bins.labels',
            { ...(list.locationId ? { warehouseId: list.locationId } : {}) },
            { target: 'beside' }
          );
        }}
      >
        <Icon glyph={faQrcode} className="size-4" aria-hidden />
        Labels
      </Button>
    </Tooltip>
  );
}

function LocationSelect({ list }: { list: BinsList }) {
  return (
    <NativeSelect
      size="sm"
      className="shrink"
      aria-label="Location"
      value={list.locationId}
      onChange={(event) => {
        list.setLocationId(event.target.value);
        list.resetWindow();
      }}
    >
      <option value="">Every location</option>
      {list.activeLocations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function KindSelect({ list }: { list: BinsList }) {
  return (
    <NativeSelect
      size="sm"
      className="max-w-36 shrink"
      aria-label="Kind of shelf"
      value={list.type}
      onChange={(event) => {
        list.setType(event.target.value);
        list.resetWindow();
      }}
    >
      <option value="">Every kind</option>
      {BIN_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function HoldingStockToggle({ list }: { list: BinsList }) {
  return (
    <ToggleGroup
      value={list.nonEmptyOnly ? ['non-empty'] : []}
      onValueChange={(value) => {
        list.setNonEmptyOnly(value.includes('non-empty'));
        list.resetWindow();
      }}
    >
      <ToggleGroupItem value="non-empty" aria-label="Only show shelves holding stock">
        Holding stock
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function binsListViews(list: BinsList): ToolbarViews {
  return {
    target: '/inventory/bins',
    params: {
      q: list.search.trim(),
      warehouse: list.locationId,
      kind: list.type,
      nonEmpty: list.nonEmptyOnly ? '1' : '',
    },
    onApply: (next) => {
      list.setSearch(next.q ?? '');
      list.setLocationId(next.warehouse ?? '');
      list.setType(next.kind ?? '');
      list.setNonEmptyOnly(next.nonEmpty === '1');
      list.resetWindow();
    },
  };
}

/** "New shelf" sits in `primary`: `controls` folds into a menu on a narrow pane,
 *  which hid it on a phone (persona issue 244). */
export function BinsListToolbar({ ctx, list }: ToolbarProps) {
  return (
    <PaneToolbar
      label="Shelves controls"
      search={
        <SearchInput
          value={list.search}
          placeholder="Shelf label or zone"
          onValueChange={(value) => {
            list.setSearch(value);
            list.resetWindow();
          }}
        />
      }
      primary={
        <Button
          color="module-inventory"
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => {
            ctx.open('inventory.bins.detail', { id: 'new' });
          }}
        >
          New shelf
        </Button>
      }
      controls={
        <>
          <LabelsButton ctx={ctx} list={list} />
          <LocationSelect list={list} />
          <KindSelect list={list} />
          <HoldingStockToggle list={list} />
        </>
      }
      views={binsListViews(list)}
      refresh={
        <RefreshButton
          isFetching={list.isFetching}
          updatedAt={list.data ? list.dataUpdatedAt : undefined}
          onRefresh={() => {
            void list.refetch();
          }}
        />
      }
    />
  );
}
