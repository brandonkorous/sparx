'use client';

import Link from 'next/link';

import { SelectionList, type SelectionCard, type SelectionColumn, statusLabel } from '@sparx/ui';
import { Badge } from 'silicaui-react';

// Client wrapper for the suppliers list. SelectionList takes render functions
// (columns/card) which can't cross the server→client boundary, so the server
// page hands rows + view here. Read-only; the code/name links to the supplier's
// detail page (page-based, not an overlay).

export interface SupplierRow {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SuppliersListProps {
  rows: SupplierRow[];
  view: 'table' | 'card';
}

export function SuppliersList({ rows, view }: SuppliersListProps) {
  const codeLink = (s: SupplierRow) => (
    <Link
      href={`/inventory/suppliers/${s.id}`}
      className="font-mono text-xs hover:text-[var(--module-active)]"
    >
      {s.code}
    </Link>
  );

  const nameLink = (s: SupplierRow) => (
    <Link href={`/inventory/suppliers/${s.id}`} className="hover:text-[var(--module-active)]">
      {s.name}
    </Link>
  );

  const location = (s: SupplierRow) =>
    [s.city, s.region, s.country].filter(Boolean).join(', ') || '—';

  const terms = (s: SupplierRow) =>
    s.paymentTerms ? (
      <Badge color="neutral" variant="soft" size="sm">
        {statusLabel(s.paymentTerms)}
      </Badge>
    ) : (
      <p className="text-base-content/70 text-xs">—</p>
    );

  const lead = (s: SupplierRow) =>
    s.leadTimeDays !== null ? (
      `${s.leadTimeDays}d`
    ) : (
      <p className="text-base-content/70 text-xs">—</p>
    );

  const statusBadge = (s: SupplierRow) =>
    s.isActive ? (
      <Badge color="success" variant="soft" size="sm">
        active
      </Badge>
    ) : (
      <Badge color="neutral" variant="soft" size="sm">
        inactive
      </Badge>
    );

  const columns: SelectionColumn<SupplierRow>[] = [
    { header: 'Code', cell: codeLink },
    { header: 'Name', cell: nameLink },
    { header: 'Contact', cell: (s) => s.contactName ?? s.email ?? '—' },
    { header: 'Location', cell: location },
    { header: 'Terms', cell: terms },
    { header: 'Lead time', cell: lead },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<SupplierRow> = {
    title: (s) => <p className="truncate text-sm font-medium">{s.name}</p>,
    subtitle: codeLink,
    badge: statusBadge,
    body: (s) => (
      <div className="flex flex-col gap-2">
        <p className="text-base-content/70 text-xs">{location(s)}</p>
        <div className="flex flex-row items-center gap-2">
          {terms(s)}
          <p className="text-base-content/70 text-xs">{s.contactName ?? s.email ?? 'no contact'}</p>
        </div>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(s) => s.id}
      selectable={false}
      entityLabelPlural="suppliers"
      getRowLabel={(s) => s.name}
      columns={columns}
      card={card}
    />
  );
}
