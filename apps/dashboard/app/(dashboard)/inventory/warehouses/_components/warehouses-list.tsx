'use client';

import { SelectionList, type SelectionCard, type SelectionColumn, statusLabel } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the warehouses list. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); the row link opens the
// warehouse in the user's detail-view surface.

export interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultForChannel: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WarehousesListProps {
  rows: WarehouseRow[];
  view: 'table' | 'card';
}

export function WarehousesList({ rows, view }: WarehousesListProps) {
  const codeLink = (w: WarehouseRow) => (
    <EntityRowLink
      href={`/inventory/warehouses/${w.id}`}
      entityType="warehouse"
      entityId={w.id}
      className="hover:text-module font-mono text-xs"
    >
      {w.code}
    </EntityRowLink>
  );

  const location = (w: WarehouseRow) =>
    [w.city, w.region, w.country].filter(Boolean).join(', ') || '—';

  const channels = (w: WarehouseRow) =>
    w.defaultForChannel.length > 0 ? (
      <div className="flex flex-row flex-wrap gap-1">
        {w.defaultForChannel.map((c) => (
          <Badge key={c} color="neutral" variant="soft" size="sm">
            {statusLabel(c)}
          </Badge>
        ))}
      </div>
    ) : (
      <p className="text-base-content text-xs">none</p>
    );

  const statusBadge = (w: WarehouseRow) =>
    w.isActive ? (
      <Badge color="success" variant="soft" size="sm">
        active
      </Badge>
    ) : (
      <Badge color="neutral" variant="soft" size="sm">
        inactive
      </Badge>
    );

  const columns: SelectionColumn<WarehouseRow>[] = [
    { header: 'Code', cell: codeLink },
    { header: 'Name', cell: (w) => w.name },
    {
      header: 'Type',
      cell: (w) => (
        <Badge color="info" variant="soft" size="sm">
          {statusLabel(w.type)}
        </Badge>
      ),
    },
    { header: 'Location', cell: location },
    { header: 'Channels', cell: channels },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<WarehouseRow> = {
    title: (w) => <p className="truncate text-sm font-medium">{w.name}</p>,
    subtitle: codeLink,
    badge: statusBadge,
    body: (w) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-2">
          <Badge color="info" variant="soft" size="sm">
            {statusLabel(w.type)}
          </Badge>
          <p className="text-base-content text-xs">{location(w)}</p>
        </div>
        {channels(w)}
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(w) => w.id}
      selectable={false}
      entityLabelPlural="warehouses"
      getRowLabel={(w) => w.name}
      columns={columns}
      card={card}
    />
  );
}
