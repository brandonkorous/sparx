'use client';

import { Building2, Trash2 } from 'lucide-react';
import { Badge } from '@wizeworks/silicaui-react';
import {
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
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
            className="text-base-content hover:text-module text-sm font-medium hover:underline"
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
          <div className="flex flex-row items-center gap-1">
            <Building2 className="text-base-content/50 h-3.5 w-3.5" />
            <p className="text-sm">{c.company}</p>
          </div>
        ) : (
          <p className="text-base-content/70 text-sm">—</p>
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
        <p className="text-base-content/70 text-sm">
          {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}
        </p>
      ),
    },
    {
      header: 'Updated',
      cell: (c) => (
        <p className="text-base-content/70 text-sm">{new Date(c.updatedAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<CustomerListRow> = {
    title: (c) => (
      <EntityRowLink
        href={`/crm/customers/${c.id}`}
        entityType="customer"
        entityId={c.id}
        className="hover:text-module truncate text-sm font-medium hover:underline"
      >
        {customerDisplayName(c)}
      </EntityRowLink>
    ),
    subtitle: (c) =>
      c.company ? (
        <div className="flex min-w-0 flex-row items-center gap-1">
          <Building2 className="text-base-content/50 h-3.5 w-3.5 shrink-0" />
          <p className="text-base-content/70 truncate text-xs">{c.company}</p>
        </div>
      ) : c.email ? (
        <p className="text-base-content/70 truncate text-xs">{c.email}</p>
      ) : null,
    badge: typeBadge,
    body: (c) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
          </p>
          <p className="text-sm tabular-nums">${Number(c.totalSpent).toLocaleString()}</p>
        </div>
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
