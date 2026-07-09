'use client';

import { Badge } from '@wizeworks/silicaui-react';

import { SelectionList, type SelectionCard, type SelectionColumn, statusLabel } from '@sparx/ui';

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
      className={className ?? 'hover:text-module font-medium'}
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
      cell: (z) => z.region ?? <p className="text-base-content/70 text-xs">—</p>,
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
      cell: (z) => <p className="font-mono text-xs">{z.registrationNumber ?? '—'}</p>,
    },
    { header: 'Rates', cell: (z) => z.rateCount },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<TaxZoneRow> = {
    title: (z) => countryLink(z, 'truncate font-medium hover:text-module'),
    subtitle: (z) => (z.region ? <p className="text-base-content/70 text-xs">{z.region}</p> : null),
    badge: statusBadge,
    body: (z) => (
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Badge color="neutral" variant="soft" size="sm">
          {statusLabel(z.nexusType)}
        </Badge>
        <p className="text-base-content/70 text-xs">
          {z.rateCount} rate{z.rateCount === 1 ? '' : 's'}
          {z.registrationNumber ? ` · reg ${z.registrationNumber}` : ''}
        </p>
      </div>
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
