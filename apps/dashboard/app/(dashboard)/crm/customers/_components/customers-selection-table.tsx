'use client';

import { Building2, Trash2 } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  Stack,
  Text,
} from '@sparx/ui';

import { bulkDeleteCustomersAction } from '../../customer-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface CustomerListRow {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  doNotContact: boolean;
  orderCount: number;
  totalSpent: string | number;
  lastOrderAt: string | null;
  updatedAt: string;
}

const TYPE_LABELS = {
  prospect: 'Prospect',
  retail: 'Customer',
  b2b: 'B2B contact',
} as const;

interface CustomersSelectionTableProps {
  customers: CustomerListRow[];
  view: 'table' | 'card';
}

export function CustomersSelectionTable({ customers, view }: CustomersSelectionTableProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} customer{count === 1 ? "" : "s"}? Their activity, notes, and orders are preserved but the contact record will be removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteCustomersAction(ids);
      },
    },
  ];

  const typeBadge = (c: CustomerListRow) => (
    <Badge color="neutral" variant="soft" size="sm">
      {TYPE_LABELS[c.type as keyof typeof TYPE_LABELS] ?? c.type}
    </Badge>
  );

  const columns: SelectionColumn<CustomerListRow>[] = [
    {
      header: 'Name',
      cell: (c) => (
        <>
          <EntityRowLink
            href={`/crm/customers/${c.id}`}
            entityType="customer"
            entityId={c.id}
            className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--module-active)] hover:underline"
          >
            {customerDisplayName(c)}
          </EntityRowLink>
          {c.doNotContact && (
            <Badge color="warning" className="ml-2">
              DNC
            </Badge>
          )}
        </>
      ),
    },
    { header: 'Type', cell: typeBadge },
    {
      header: 'Company',
      cell: (c) =>
        c.company ? (
          <Stack direction="row" align="center" gap={1}>
            <Building2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
            <Text size="sm">{c.company}</Text>
          </Stack>
        ) : (
          <Text size="sm" variant="muted">
            —
          </Text>
        ),
    },
    { header: 'Orders', align: 'right', cell: (c) => c.orderCount },
    {
      header: 'Spent',
      align: 'right',
      cell: (c) => `$${Number(c.totalSpent).toLocaleString()}`,
    },
    {
      header: 'Last order',
      cell: (c) => (
        <Text size="sm" variant="muted">
          {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}
        </Text>
      ),
    },
    {
      header: 'Updated',
      cell: (c) => (
        <Text size="sm" variant="muted">
          {new Date(c.updatedAt).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<CustomerListRow> = {
    title: (c) => (
      <EntityRowLink
        href={`/crm/customers/${c.id}`}
        entityType="customer"
        entityId={c.id}
        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
      >
        {customerDisplayName(c)}
      </EntityRowLink>
    ),
    subtitle: (c) =>
      c.company ? (
        <Stack direction="row" align="center" gap={1} className="min-w-0">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
          <Text size="xs" variant="muted" className="truncate">
            {c.company}
          </Text>
        </Stack>
      ) : c.email ? (
        <Text size="xs" variant="muted" className="truncate">
          {c.email}
        </Text>
      ) : null,
    badge: typeBadge,
    body: (c) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
          </Text>
          <Text size="sm" className="tabular-nums">
            ${Number(c.totalSpent).toLocaleString()}
          </Text>
        </Stack>
        {c.doNotContact && (
          <Badge color="warning" className="self-start text-xs">
            DNC
          </Badge>
        )}
      </>
    ),
  };

  return (
    <SelectionList
      items={customers}
      view={view}
      getId={(c) => c.id}
      getRowLabel={customerDisplayName}
      entityLabelPlural="customers"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}

function customerDisplayName(c: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (c.company) return c.company;
  if (c.email) return c.email;
  return 'Unnamed customer';
}
