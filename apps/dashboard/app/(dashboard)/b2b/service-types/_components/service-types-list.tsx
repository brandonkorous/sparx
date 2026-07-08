'use client';

import { type SelectionCard, type SelectionColumn, SelectionList } from '@sparx/ui';
import { Badge } from 'silicaui-react';

import { ServiceTypeActions } from './service-type-actions';

// Client wrapper for the B2B service-types list. SelectionList takes render
// functions (columns/card) which can't cross the server→client boundary, so the
// server page hands serializable rows + view and this builds both views.
// Read-only list (`selectable={false}` — no checkboxes / bulk bar); each row
// keeps its per-type edit / activate / delete dropdown island.

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  color: string | null;
  isActive: boolean;
  requiresVehicle: boolean;
  notes: string | null;
  createdAt: string;
}

interface ServiceTypesListProps {
  types: ServiceType[];
  view: 'table' | 'card';
}

export function ServiceTypesList({ types, view }: ServiceTypesListProps) {
  const nameCell = (t: ServiceType) => (
    <div className="flex flex-row items-center gap-2">
      {t.color && (
        <span
          className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: t.color }}
        />
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t.name}</p>
        {t.description && (
          <p className="text-base-content/70 line-clamp-1 text-xs">{t.description}</p>
        )}
      </div>
    </div>
  );

  const statusBadge = (t: ServiceType) => (
    <Badge color={t.isActive ? 'success' : 'warning'} variant="soft" size="sm">
      {t.isActive ? 'Active' : 'Inactive'}
    </Badge>
  );

  const columns: SelectionColumn<ServiceType>[] = [
    { header: 'Name', cell: nameCell },
    {
      header: 'Duration',
      cell: (t) => <p className="text-sm">{t.durationMinutes} min</p>,
    },
    {
      header: 'Requires vehicle',
      cell: (t) => <p className="text-sm">{t.requiresVehicle ? 'Yes' : 'No'}</p>,
    },
    { header: 'Status', cell: statusBadge },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (t) => <ServiceTypeActions type={t} />,
    },
  ];

  const card: SelectionCard<ServiceType> = {
    title: (t) => (
      <div className="flex flex-row items-center gap-2">
        {t.color && (
          <span
            className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: t.color }}
          />
        )}
        <p className="truncate text-sm font-medium">{t.name}</p>
      </div>
    ),
    subtitle: (t) =>
      t.description ? (
        <p className="text-base-content/70 line-clamp-1 text-xs">{t.description}</p>
      ) : null,
    badge: statusBadge,
    body: (t) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Duration</p>
          <p className="text-sm">{t.durationMinutes} min</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Requires vehicle</p>
          <p className="text-sm">{t.requiresVehicle ? 'Yes' : 'No'}</p>
        </div>
        <div className="flex flex-row items-center justify-end gap-2">
          <ServiceTypeActions type={t} />
        </div>
      </>
    ),
  };

  return (
    <SelectionList
      items={types}
      view={view}
      getId={(t) => t.id}
      getRowLabel={(t) => t.name}
      selectable={false}
      entityLabelPlural="service types"
      columns={columns}
      card={card}
    />
  );
}
