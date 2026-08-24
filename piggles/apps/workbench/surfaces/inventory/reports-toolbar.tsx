'use client';

// The pane's two filters and its refresh. No primary action: there is nothing
// to create on a reporting surface.

import { NativeSelect } from '@wizeworks/silicaui-react';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { RANGE_PRESETS } from './reports-data';
import type { StockLocation } from './data';

function PeriodPicker({ days, onDays }: { days: number; onDays: (days: number) => void }) {
  return (
    /* Sets the window for the selling-pace figures. Named for what it does,
       not "range". */
    <NativeSelect
      size="sm"
      className="max-w-40 shrink"
      aria-label="Selling period for turnover"
      value={String(days)}
      onChange={(event) => {
        onDays(Number(event.target.value));
      }}
    >
      {RANGE_PRESETS.map((preset) => (
        <option key={preset.days} value={preset.days}>
          {preset.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function LocationPicker({
  locationId,
  onLocation,
  locations,
}: {
  locationId: string;
  onLocation: (id: string) => void;
  locations: StockLocation[];
}) {
  return (
    /* Narrows the ageing breakdown to one place — "which shop is holding money
       it isn't turning" is a real question. */
    <NativeSelect
      size="sm"
      className="max-w-40 shrink"
      aria-label="Location for the ageing breakdown"
      value={locationId}
      onChange={(event) => {
        onLocation(event.target.value);
      }}
    >
      <option value="">Every location</option>
      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.name}
        </option>
      ))}
    </NativeSelect>
  );
}

export function ReportsToolbar({
  rangeDays,
  onRangeDays,
  locationId,
  onLocation,
  locations,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  rangeDays: number;
  onRangeDays: (days: number) => void;
  locationId: string;
  onLocation: (id: string) => void;
  locations: StockLocation[];
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  return (
    <PaneToolbar
      label="Report controls"
      controls={
        <>
          <PeriodPicker days={rangeDays} onDays={onRangeDays} />
          <LocationPicker locationId={locationId} onLocation={onLocation} locations={locations} />
        </>
      }
      refresh={
        /* ALWAYS the last child of a toolbar. */
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}
