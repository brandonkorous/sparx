'use client';

// B2B Accounts list with row selection + fleet-level bulk action bar
// (docs/68 B-3): Set status (Active / Inactive) and Delete. Built on the shared
// `SelectionList` dual-view substrate (docs/34 §7) — Table/Cards toggle driven
// by the server page's `view`. Mirrors the customers selection table;
// assign-rep is deferred (needs a rep picker).

import Link from 'next/link';
import { CircleCheck, CircleSlash, Trash2 } from 'lucide-react';
import {
  type BulkAction,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';
import { Badge } from 'silicaui-react';

import type { B2bAccountRow } from '../page';
import {
  bulkDeleteB2bAccountsAction,
  bulkSetB2bAccountStatusAction,
} from './b2b-accounts-bulk-actions';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  credit_hold: 'warning',
  suspended: 'danger',
  inactive: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  credit_hold: 'Credit hold',
  suspended: 'Suspended',
  inactive: 'Inactive',
};

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

interface B2bAccountsSelectionTableProps {
  accounts: B2bAccountRow[];
  view: 'table' | 'card';
}

export function B2bAccountsSelectionTable({ accounts, view }: B2bAccountsSelectionTableProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Set active',
      icon: CircleCheck,
      onAction: async (ids) => {
        await bulkSetB2bAccountStatusAction(ids, 'active');
      },
    },
    {
      label: 'Set inactive',
      icon: CircleSlash,
      onAction: async (ids) => {
        await bulkSetB2bAccountStatusAction(ids, 'inactive');
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} B2B account{count === 1 ? "" : "s"}? Their contacts, quotes, and history are preserved but the account record will be removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteB2bAccountsAction(ids);
      },
    },
  ];

  const companyLink = (a: B2bAccountRow, className: string) => (
    <Link href={`/b2b/accounts/${a.id}`} className={className}>
      {a.companyName}
    </Link>
  );

  const statusBadge = (a: B2bAccountRow) => (
    <Badge color={STATUS_VARIANT[a.status] ?? 'neutral'} variant="soft" size="sm">
      {STATUS_LABEL[a.status] ?? a.status}
    </Badge>
  );

  const tierCell = (a: B2bAccountRow) =>
    a.pricingTierName ? (
      <Badge color="module" variant="soft" size="sm">
        {a.pricingTierName}
      </Badge>
    ) : (
      <p className="text-base-content/70 text-sm">—</p>
    );

  const columns: SelectionColumn<B2bAccountRow>[] = [
    {
      header: 'Company',
      cell: (a) => companyLink(a, 'font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    { header: 'Status', cell: statusBadge },
    { header: 'Pricing tier', cell: tierCell },
    {
      header: 'Credit limit',
      cell: (a) => <p className="text-sm">{formatDollars(a.creditLimitCents)}</p>,
    },
    {
      header: 'Remaining',
      cell: (a) => <p className="text-sm">{formatDollars(a.creditRemainingCents)}</p>,
    },
    { header: 'Terms', cell: (a) => <p className="text-sm">{a.paymentTerms ?? '—'}</p> },
    {
      header: 'Discount',
      cell: (a) => (
        <p className="text-sm">{a.discountPercent > 0 ? `${a.discountPercent}%` : '—'}</p>
      ),
    },
  ];

  const card: SelectionCard<B2bAccountRow> = {
    title: (a) =>
      companyLink(a, 'truncate font-medium hover:text-[var(--module-active)] hover:underline'),
    subtitle: (a) =>
      a.pricingTierName ? (
        <Badge color="module" variant="soft" size="sm" className="self-start">
          {a.pricingTierName}
        </Badge>
      ) : null,
    badge: statusBadge,
    body: (a) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">Credit limit</p>
          <p className="text-sm tabular-nums">{formatDollars(a.creditLimitCents)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">Remaining</p>
          <p className="text-sm tabular-nums">{formatDollars(a.creditRemainingCents)}</p>
        </div>
        <p className="text-base-content/70 text-xs">
          Terms: {a.paymentTerms ?? '—'}
          {a.discountPercent > 0 ? ` · ${a.discountPercent}% discount` : ''}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={accounts}
      view={view}
      getId={(a) => a.id}
      getRowLabel={(a) => a.companyName}
      entityLabelPlural="accounts"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
