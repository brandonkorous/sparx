'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Code,
  toast,
  type BadgeProps,
} from '@sparx/ui';
import { Button } from 'silicaui-react';

import { removeSuppressionAction } from '../actions';
import type { SuppressionRow } from '../../_lib/types';

// Client wrapper for the suppressions list. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands rows + view here and this builds both views. Selection is off
// (`selectable={false}`) — there's no bulk action; instead each row keeps its
// per-row Remove mutation island.

const SCOPE_BADGE: Record<SuppressionRow['scope'], BadgeProps['color']> = {
  all: 'default',
  marketing: 'soft',
  transactional: 'outline',
};

const REASON_BADGE: Record<SuppressionRow['reason'], BadgeProps['color']> = {
  bounce: 'danger',
  complaint: 'danger',
  unsubscribe: 'warning',
  manual: 'default',
};

function RemoveButton({ id, email }: { id: string; email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Remove ${email}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeSuppressionAction(id);
          if (result.ok) toast.success(`${email} removed from suppressions.`);
          else toast.error(result.error.message);
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

interface SuppressionsListProps {
  rows: SuppressionRow[];
  view: 'table' | 'card';
}

export function SuppressionsList({ rows, view }: SuppressionsListProps) {
  const emailCell = (row: SuppressionRow) => <Code>{row.email}</Code>;
  const scopeBadge = (row: SuppressionRow) => (
    <Badge color={SCOPE_BADGE[row.scope]}>{row.scope}</Badge>
  );
  const reasonBadge = (row: SuppressionRow) => (
    <Badge color={REASON_BADGE[row.reason]}>{row.reason}</Badge>
  );

  const columns: SelectionColumn<SuppressionRow>[] = [
    { header: 'Email', cell: emailCell },
    { header: 'Scope', cell: scopeBadge },
    { header: 'Reason', cell: reasonBadge },
    { header: 'Source', cell: (row) => row.source ?? '—' },
    { header: 'Added', cell: (row) => new Date(row.createdAt).toLocaleDateString() },
    {
      header: '',
      id: 'remove',
      align: 'right',
      cell: (row) => <RemoveButton id={row.id} email={row.email} />,
    },
  ];

  const card: SelectionCard<SuppressionRow> = {
    title: emailCell,
    badge: scopeBadge,
    body: (row) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-2">
          {reasonBadge(row)}
          <p className="text-base-content/70 text-xs">
            {row.source ?? '—'} · {new Date(row.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-row justify-end">
          <RemoveButton id={row.id} email={row.email} />
        </div>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(row) => row.id}
      selectable={false}
      entityLabelPlural="addresses"
      getRowLabel={(row) => row.email}
      columns={columns}
      card={card}
    />
  );
}
