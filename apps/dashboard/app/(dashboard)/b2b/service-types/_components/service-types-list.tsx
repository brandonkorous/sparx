'use client';

import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';

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
    <Stack direction="row" gap={2} className="items-center">
      {t.color && (
        <span
          className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: t.color }}
        />
      )}
      <Stack gap={1}>
        <Text size="sm" className="font-medium">
          {t.name}
        </Text>
        {t.description && (
          <Text size="xs" variant="muted" className="line-clamp-1">
            {t.description}
          </Text>
        )}
      </Stack>
    </Stack>
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
      cell: (t) => <Text size="sm">{t.durationMinutes} min</Text>,
    },
    {
      header: 'Requires vehicle',
      cell: (t) => <Text size="sm">{t.requiresVehicle ? 'Yes' : 'No'}</Text>,
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
      <Stack direction="row" gap={2} className="items-center">
        {t.color && (
          <span
            className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: t.color }}
          />
        )}
        <Text size="sm" className="truncate font-medium">
          {t.name}
        </Text>
      </Stack>
    ),
    subtitle: (t) =>
      t.description ? (
        <Text size="xs" variant="muted" className="line-clamp-1">
          {t.description}
        </Text>
      ) : null,
    badge: statusBadge,
    body: (t) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Duration
          </Text>
          <Text size="sm">{t.durationMinutes} min</Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Requires vehicle
          </Text>
          <Text size="sm">{t.requiresVehicle ? 'Yes' : 'No'}</Text>
        </Stack>
        <Stack direction="row" align="center" justify="end" gap={2}>
          <ServiceTypeActions type={t} />
        </Stack>
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
