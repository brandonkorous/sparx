'use client';

import {
  Badge,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
  statusLabel,
} from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the tax-zones list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server
// page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); rows open the zone detail
// (rates) via EntityRowLink in the user's detail-view surface. The "New tax
// zone" launcher lives in the page's PageHeader (EntityCreateButton).

export interface TaxZoneRow {
  id: string;
  country: string;
  region: string | null;
  nexusType: string;
  registrationNumber: string | null;
  registeredAt: string | null;
  isActive: boolean;
  rateCount: number;
}

interface TaxZonesListProps {
  zones: TaxZoneRow[];
  view: 'table' | 'card';
}

export function TaxZonesList({ zones, view }: TaxZonesListProps) {
  const countryLink = (z: TaxZoneRow, className?: string) => (
    <EntityRowLink
      href={`/commerce/tax/zones/${z.id}`}
      entityType="tax-zone"
      entityId={z.id}
      className={className ?? 'font-medium hover:text-[var(--module-active)]'}
    >
      {z.country}
    </EntityRowLink>
  );

  const statusBadge = (z: TaxZoneRow) =>
    z.isActive ? (
      <Badge color="success" variant="soft" size="sm">
        active
      </Badge>
    ) : (
      <Badge color="neutral" variant="soft" size="sm">
        inactive
      </Badge>
    );

  const columns: SelectionColumn<TaxZoneRow>[] = [
    { header: 'Country', cell: (z) => countryLink(z) },
    {
      header: 'Region',
      cell: (z) =>
        z.region ?? (
          <Text size="xs" variant="muted">
            —
          </Text>
        ),
    },
    {
      header: 'Nexus',
      cell: (z) => (
        <Badge color="neutral" variant="soft" size="sm">
          {statusLabel(z.nexusType)}
        </Badge>
      ),
    },
    {
      header: 'Registration #',
      cell: (z) => (
        <Text size="xs" className="font-mono">
          {z.registrationNumber ?? '—'}
        </Text>
      ),
    },
    { header: 'Rates', cell: (z) => z.rateCount },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<TaxZoneRow> = {
    title: (z) => countryLink(z, 'truncate font-medium hover:text-[var(--module-active)]'),
    subtitle: (z) =>
      z.region ? (
        <Text size="xs" variant="muted">
          {z.region}
        </Text>
      ) : null,
    badge: statusBadge,
    body: (z) => (
      <Stack direction="row" align="center" gap={2} wrap>
        <Badge color="neutral" variant="soft" size="sm">
          {statusLabel(z.nexusType)}
        </Badge>
        <Text size="xs" variant="muted">
          {z.rateCount} rate{z.rateCount === 1 ? '' : 's'}
          {z.registrationNumber ? ` · reg ${z.registrationNumber}` : ''}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={zones}
      view={view}
      getId={(z) => z.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
