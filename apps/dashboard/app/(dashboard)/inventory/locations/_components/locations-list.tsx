'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

// Client wrapper for the stock-locations list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar) and rows have no detail route
// yet, so the name renders as plain text.

export interface StockLocation {
  id: string;
  name: string;
  type: string;
  countryCode: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  warehouse: 'Warehouse',
  bin: 'Bin',
  '3pl': '3PL',
  virtual: 'Virtual',
  transit: 'Transit',
};

interface LocationsListProps {
  rows: StockLocation[];
  view: 'table' | 'card';
}

export function LocationsList({ rows, view }: LocationsListProps) {
  const name = (loc: StockLocation) => (
    <Stack direction="row" align="center" gap={2} className="min-w-0">
      <Text size="sm" className="truncate font-medium">
        {loc.name}
      </Text>
      {loc.isDefault && (
        <Badge color="primary" variant="soft" size="sm">
          Default
        </Badge>
      )}
    </Stack>
  );

  const typeLabel = (loc: StockLocation) => TYPE_LABELS[loc.type] ?? loc.type;

  const statusBadge = (loc: StockLocation) => (
    <Badge color={loc.active ? 'success' : 'neutral'} variant="soft" size="sm">
      {loc.active ? 'Active' : 'Inactive'}
    </Badge>
  );

  const columns: SelectionColumn<StockLocation>[] = [
    { header: 'Name', cell: name, cellClassName: 'font-medium' },
    { header: 'Type', cell: typeLabel },
    { header: 'Country', cell: (loc) => loc.countryCode ?? '—' },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<StockLocation> = {
    title: name,
    badge: statusBadge,
    body: (loc) => (
      <Stack direction="row" align="center" gap={2}>
        <Text size="xs" variant="muted">
          {typeLabel(loc)}
        </Text>
        <Text size="xs" variant="muted">
          {loc.countryCode ?? '—'}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(loc) => loc.id}
      selectable={false}
      entityLabelPlural="locations"
      getRowLabel={(loc) => loc.name}
      columns={columns}
      card={card}
    />
  );
}
