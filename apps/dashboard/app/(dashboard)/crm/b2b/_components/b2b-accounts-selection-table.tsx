'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

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
      requiresConfirm: true,
      confirmLabel:
        'Suspend {count} B2B account(s)? Their portal access is blocked immediately. Set them active again any time.',
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
    <Badge color={statusTone(a.status)} variant="soft" size="sm">
      {statusLabel(a.status)}
    </Badge>
  );

  const usedCell = (a: B2bAccountRow) => {
    const limit = Number(a.creditLimit);
    const used = Number(a.creditUsed);
    const utilization = limit > 0 ? used / limit : 0;
    return (
      <div className="flex flex-row items-center justify-end gap-1">
        <span className="tabular-nums">${used.toLocaleString()}</span>
        {utilization >= 0.85 && <AlertTriangle className="text-warning h-3.5 w-3.5" />}
      </div>
    );
  };

  const columns: SelectionColumn<B2bAccountRow>[] = [
    {
      header: 'Company',
      cell: (a) => companyLink(a, 'text-sm font-medium hover:text-module hover:underline'),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Pricing tier',
      cell: (a) => <p className="text-base-content/70 text-sm">{a.pricingTier ?? '—'}</p>,
    },
    {
      header: 'Credit limit',
      align: 'right',
      cell: (a) => `$${Number(a.creditLimit).toLocaleString()}`,
    },
    { header: 'Used', align: 'right', cell: usedCell },
    {
      header: 'Fleet',
      cell: (a) => <p className="text-base-content/70 text-sm">{a.fleetSize ?? '—'}</p>,
    },
  ];

  const card: SelectionCard<B2bAccountRow> = {
    title: (a) => companyLink(a, 'truncate text-sm font-medium hover:text-module hover:underline'),
    subtitle: (a) => (
      <p className="text-base-content/70 text-xs">{a.pricingTier ?? 'No pricing tier'}</p>
    ),
    badge: statusBadge,
    body: (a) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            Limit ${Number(a.creditLimit).toLocaleString()}
          </p>
          {usedCell(a)}
        </div>
        <p className="text-base-content/70 text-xs">Fleet: {a.fleetSize ?? '—'}</p>
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
