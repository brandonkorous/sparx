'use client';

import Link from 'next/link';
import { Send, XCircle } from 'lucide-react';
import {
  Badge,
  type BadgeProps,
  type BulkAction,
  Button,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
} from '@sparx/ui';

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
        <Stack gap={1}>
          {nameLink(b, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline')}
          <Text size="xs" variant="muted" className="truncate">
            {b.subject}
          </Text>
        </Stack>
      ),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Recipients',
      align: 'right',
      cell: (b) => (
        <Text size="sm" variant="muted">
          {recipientsLabel(b)}
        </Text>
      ),
    },
    {
      header: '',
      id: 'open',
      align: 'right',
      cell: (b) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/email/broadcasts/${b.id}`}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Open
          </Link>
        </Button>
      ),
    },
  ];

  const card: SelectionCard<BroadcastRow> = {
    title: (b) =>
      nameLink(b, 'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'),
    subtitle: (b) => (
      <Text size="xs" variant="muted" className="truncate">
        {b.subject}
      </Text>
    ),
    badge: statusBadge,
    body: (b) => (
      <Stack gap={2}>
        {b.status === 'sent' || b.status === 'scheduled' ? (
          <Text size="sm" variant="muted">
            {recipientsLabel(b)}
          </Text>
        ) : null}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/email/broadcasts/${b.id}`}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Open
          </Link>
        </Button>
      </Stack>
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
