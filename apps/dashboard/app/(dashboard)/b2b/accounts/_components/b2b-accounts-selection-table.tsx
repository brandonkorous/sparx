'use client';

// B2B Accounts list with row selection + fleet-level bulk action bar
// (docs/68 B-3): Set status (Active / Inactive) and Delete. Built on the shared
// `SelectionList` dual-view substrate (docs/34 §7) — Table/Cards toggle driven
// by the server page's `view`. Mirrors the customers selection table;
// assign-rep is deferred (needs a rep picker).

import Link from 'next/link';
import { CircleCheck, CircleSlash, Trash2 } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
} from '@sparx/ui';

import type { B2bAccountRow } from '../page';
import {
  bulkDeleteB2bAccountsAction,
  bulkSetB2bAccountStatusAction,
} from './b2b-accounts-bulk-actions';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'outline'> = {
  active: 'success',
  credit_hold: 'warning',
  suspended: 'danger',
  inactive: 'outline',
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
    <Badge color={STATUS_VARIANT[a.status] ?? 'outline'} variant="soft">
      {STATUS_LABEL[a.status] ?? a.status}
    </Badge>
  );

  const tierCell = (a: B2bAccountRow) =>
    a.pricingTierName ? (
      <Badge color="module" variant="outline">
        {a.pricingTierName}
      </Badge>
    ) : (
      <Text size="sm" variant="muted">
        —
      </Text>
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
      cell: (a) => <Text size="sm">{formatDollars(a.creditLimitCents)}</Text>,
    },
    {
      header: 'Remaining',
      cell: (a) => <Text size="sm">{formatDollars(a.creditRemainingCents)}</Text>,
    },
    { header: 'Terms', cell: (a) => <Text size="sm">{a.paymentTerms ?? '—'}</Text> },
    {
      header: 'Discount',
      cell: (a) => <Text size="sm">{a.discountPercent > 0 ? `${a.discountPercent}%` : '—'}</Text>,
    },
  ];

  const card: SelectionCard<B2bAccountRow> = {
    title: (a) =>
      companyLink(a, 'truncate font-medium hover:text-[var(--module-active)] hover:underline'),
    subtitle: (a) =>
      a.pricingTierName ? (
        <Badge color="module" variant="outline" className="self-start">
          {a.pricingTierName}
        </Badge>
      ) : null,
    badge: statusBadge,
    body: (a) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            Credit limit
          </Text>
          <Text size="sm" className="tabular-nums">
            {formatDollars(a.creditLimitCents)}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            Remaining
          </Text>
          <Text size="sm" className="tabular-nums">
            {formatDollars(a.creditRemainingCents)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          Terms: {a.paymentTerms ?? '—'}
          {a.discountPercent > 0 ? ` · ${a.discountPercent}% discount` : ''}
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
      entityLabelPlural="accounts"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
