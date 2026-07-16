'use client';

import Link from 'next/link';
import { Send, XCircle } from 'lucide-react';
import {
  Badge,
  type BadgeProps,
  type BulkAction,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';
import { Button } from '@wizeworks/silicaui-react';

import { bulkCancelBroadcastsAction } from '../actions';
import type { BroadcastRow } from '../../_lib/types';

// Client wrapper for the broadcasts list. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands rows + view here and this builds both views. Selectable with a
// single bulk "Cancel" action; the server action only cancels draft/scheduled
// sends (the authority), so selecting an already-sent row is a no-op.

const STATUS_BADGE: Record<BroadcastRow['status'], BadgeProps['color']> = {
  draft: 'outline',
  scheduled: 'warning',
  sending: 'soft',
  sent: 'success',
  cancelled: 'default',
  failed: 'danger',
};

interface BroadcastsListProps {
  rows: BroadcastRow[];
  view: 'table' | 'card';
}

export function BroadcastsList({ rows, view }: BroadcastsListProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Cancel',
      icon: XCircle,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Cancel {count} broadcast{count === 1 ? "" : "s"}? Scheduled sends will be aborted. This cannot be undone.',
      onAction: async (ids) => {
        await bulkCancelBroadcastsAction(ids);
      },
    },
  ];

  const statusBadge = (b: BroadcastRow) => <Badge color={STATUS_BADGE[b.status]}>{b.status}</Badge>;

  const nameLink = (b: BroadcastRow, className: string) => (
    <Link href={`/email/broadcasts/${b.id}`} className={className}>
      {b.name}
    </Link>
  );

  const recipientsLabel = (b: BroadcastRow) =>
    b.status === 'sent' || b.status === 'scheduled'
      ? `${b.recipientCount} recipient${b.recipientCount === 1 ? '' : 's'}`
      : '—';

  const columns: SelectionColumn<BroadcastRow>[] = [
    {
      header: 'Name',
      cell: (b) => (
        <div className="flex flex-col gap-1">
          {nameLink(b, 'text-sm font-medium hover:text-module hover:underline')}
          <p className="text-base-content truncate text-xs">{b.subject}</p>
        </div>
      ),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Recipients',
      align: 'right',
      cell: (b) => <p className="text-base-content text-sm">{recipientsLabel(b)}</p>,
    },
    {
      header: '',
      id: 'open',
      align: 'right',
      cell: (b) => (
        <Button variant="outline" size="sm" render={<Link href={`/email/broadcasts/${b.id}`} />}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Open
        </Button>
      ),
    },
  ];

  const card: SelectionCard<BroadcastRow> = {
    title: (b) => nameLink(b, 'truncate text-sm font-medium hover:text-module hover:underline'),
    subtitle: (b) => <p className="text-base-content truncate text-xs">{b.subject}</p>,
    badge: statusBadge,
    body: (b) => (
      <div className="flex flex-col gap-2">
        {b.status === 'sent' || b.status === 'scheduled' ? (
          <p className="text-base-content text-sm">{recipientsLabel(b)}</p>
        ) : null}
        <Button variant="outline" size="sm" render={<Link href={`/email/broadcasts/${b.id}`} />}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Open
        </Button>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(b) => b.id}
      getRowLabel={(b) => b.name}
      entityLabelPlural="broadcasts"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
