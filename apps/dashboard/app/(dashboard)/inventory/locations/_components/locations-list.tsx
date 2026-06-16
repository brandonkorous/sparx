'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

// Client wrapper for the stock-locations list. A "location" is a Warehouse in the
// unified stock model (docs/100 P1c). SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar) and rows have no detail route
// yet, so the name renders as plain text.

export interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  city: string | null;
  region: string | null;
  country: string | null;
  isActive: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  owned: 'Owned',
  '3pl': '3PL',
  dropship: 'Dropship',
  virtual: 'Virtual',
};

interface LocationsListProps {
  rows: WarehouseRow[];
  view: 'table' | 'card';
}

function placeOf(w: WarehouseRow): string {
  const parts = [w.city, w.region, w.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

export function LocationsList({ rows, view }: LocationsListProps) {
  const name = (w: WarehouseRow) => (
    <Stack direction="row" align="center" gap={2} className="min-w-0">
      <Text size="sm" className="truncate font-medium">
        {w.name}
      </Text>
      <Badge color="neutral" variant="soft" size="sm">
        {w.code}
      </Badge>
    </Stack>
  );

  const typeLabel = (w: WarehouseRow) => TYPE_LABELS[w.type] ?? w.type;

  const statusBadge = (w: WarehouseRow) => (
    <Badge color={w.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
      {w.isActive ? 'Active' : 'Archived'}
    </Badge>
  );

  const columns: SelectionColumn<WarehouseRow>[] = [
    { header: 'Name', cell: name, cellClassName: 'font-medium' },
    { header: 'Type', cell: typeLabel },
    { header: 'Location', cell: placeOf },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<WarehouseRow> = {
    title: name,
    badge: statusBadge,
    body: (w) => (
      <Stack direction="row" align="center" gap={2}>
        <Text size="xs" variant="muted">
          {typeLabel(w)}
        </Text>
        <Text size="xs" variant="muted">
          {placeOf(w)}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(w) => w.id}
      selectable={false}
      entityLabelPlural="locations"
      getRowLabel={(w) => w.name}
      columns={columns}
      card={card}
    />
  );
}
