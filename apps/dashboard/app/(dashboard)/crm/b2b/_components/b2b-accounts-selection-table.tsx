'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  Stack,
  Text,
} from '@sparx/ui';

import { bulkDeleteB2bAccountsAction, bulkSetB2bStatusAction } from '../../b2b-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

// B2B accounts table/grid — selection + bulk actions on top of the shared
// `SelectionList` dual-view substrate (docs/34 §7). The server page renders the
// toolbar + header and passes `view`; this owns the interactive layer only.

export interface B2bAccountRow {
  id: string;
  companyName: string;
  status: string;
  pricingTier: string | null;
  creditLimit: string | number;
  creditUsed: string | number;
  fleetSize: number | null;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'danger'> = {
  active: 'success',
  credit_hold: 'warning',
  suspended: 'danger',
  inactive: 'outline',
};

interface B2bAccountsSelectionTableProps {
  accounts: B2bAccountRow[];
  view: 'table' | 'card';
}

export function B2bAccountsSelectionTable({ accounts, view }: B2bAccountsSelectionTableProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Set active',
      onAction: async (ids) => {
        await bulkSetB2bStatusAction(ids, 'active');
      },
    },
    {
      label: 'Set credit hold',
      onAction: async (ids) => {
        await bulkSetB2bStatusAction(ids, 'credit_hold');
      },
    },
    {
      label: 'Suspend',
      onAction: async (ids) => {
        await bulkSetB2bStatusAction(ids, 'suspended');
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} B2B account{count === 1 ? "" : "s"}? Credit history and contacts are also removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteB2bAccountsAction(ids);
      },
    },
  ];

  const companyLink = (a: B2bAccountRow, className: string) => (
    <EntityRowLink
      href={`/crm/b2b/${a.id}`}
      entityType="b2b-account"
      entityId={a.id}
      className={className}
    >
      {a.companyName}
    </EntityRowLink>
  );

  const statusBadge = (a: B2bAccountRow) => (
    <Badge color={STATUS_VARIANT[a.status] ?? 'outline'} className="text-xs">
      {a.status}
    </Badge>
  );

  const usedCell = (a: B2bAccountRow) => {
    const limit = Number(a.creditLimit);
    const used = Number(a.creditUsed);
    const utilization = limit > 0 ? used / limit : 0;
    return (
      <Stack direction="row" gap={1} align="center" justify="end">
        <span className="tabular-nums">${used.toLocaleString()}</span>
        {utilization >= 0.85 && (
          <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning-500)]" />
        )}
      </Stack>
    );
  };

  const columns: SelectionColumn<B2bAccountRow>[] = [
    {
      header: 'Company',
      cell: (a) =>
        companyLink(a, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Pricing tier',
      cell: (a) => (
        <Text size="sm" variant="muted">
          {a.pricingTier ?? '—'}
        </Text>
      ),
    },
    {
      header: 'Credit limit',
      align: 'right',
      cell: (a) => `$${Number(a.creditLimit).toLocaleString()}`,
    },
    { header: 'Used', align: 'right', cell: usedCell },
    {
      header: 'Fleet',
      cell: (a) => (
        <Text size="sm" variant="muted">
          {a.fleetSize ?? '—'}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<B2bAccountRow> = {
    title: (a) =>
      companyLink(
        a,
        'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
      ),
    subtitle: (a) => (
      <Text size="xs" variant="muted">
        {a.pricingTier ?? 'No pricing tier'}
      </Text>
    ),
    badge: statusBadge,
    body: (a) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Limit ${Number(a.creditLimit).toLocaleString()}
          </Text>
          {usedCell(a)}
        </Stack>
        <Text size="xs" variant="muted">
          Fleet: {a.fleetSize ?? '—'}
        </Text>
      </>
    ),
  };

  return (
    <SelectionList
      items={accounts}
      view={view}
      getId={(a) => a.id}
      getRowLabel={(a) => a.companyName}
      entityLabelPlural="B2B accounts"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
