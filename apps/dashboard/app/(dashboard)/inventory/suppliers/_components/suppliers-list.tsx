'use client';

import Link from 'next/link';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
  statusLabel,
} from '@sparx/ui';

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
      <Text size="xs" variant="muted">
        —
      </Text>
    );

  const lead = (s: SupplierRow) =>
    s.leadTimeDays !== null ? (
      `${s.leadTimeDays}d`
    ) : (
      <Text size="xs" variant="muted">
        —
      </Text>
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
    title: (s) => (
      <Text size="sm" className="truncate font-medium">
        {s.name}
      </Text>
    ),
    subtitle: codeLink,
    badge: statusBadge,
    body: (s) => (
      <Stack gap={2}>
        <Text size="xs" variant="muted">
          {location(s)}
        </Text>
        <Stack direction="row" align="center" gap={2}>
          {terms(s)}
          <Text size="xs" variant="muted">
            {s.contactName ?? s.email ?? 'no contact'}
          </Text>
        </Stack>
      </Stack>
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
