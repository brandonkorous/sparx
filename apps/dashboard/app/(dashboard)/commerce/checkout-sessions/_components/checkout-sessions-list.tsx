'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { Badge } from 'silicaui-react';

// Client wrapper for the checkout-sessions diagnostic list. SelectionList takes
// render functions (columns/card), which can't cross the server→client
// boundary, so the server page hands rows + view here and this builds the
// views. Read-only — `selectable={false}` (no checkboxes / bulk bar); there is
// no row link (the session id is a diagnostic identifier only).

export interface CheckoutSessionRow {
  id: string;
  step: string;
  channel: string;
  currency: string;
  customerId: string | null;
  customerEmail: string | null;
  subtotalCents: number;
  totalCents: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface CheckoutSessionsListProps {
  rows: CheckoutSessionRow[];
  view: 'table' | 'card';
}

function StepBadge({ step }: { step: string }) {
  return (
    <Badge color={statusTone(step)} variant="soft" size="sm">
      {statusLabel(step)}
    </Badge>
  );
}

export function CheckoutSessionsList({ rows, view }: CheckoutSessionsListProps) {
  const totalLabel = (s: CheckoutSessionRow) => `$${(s.totalCents / 100).toFixed(2)} ${s.currency}`;

  const columns: SelectionColumn<CheckoutSessionRow>[] = [
    {
      header: 'Session',
      cell: (s) => <p className="font-mono text-xs">{s.id.slice(0, 8)}</p>,
    },
    { header: 'Customer', cell: (s) => <>{s.customerEmail ?? '—'}</> },
    {
      header: 'Channel',
      cell: (s) => (
        <Badge color="neutral" variant="soft" size="sm">
          {statusLabel(s.channel)}
        </Badge>
      ),
    },
    { header: 'Step', cell: (s) => <StepBadge step={s.step} /> },
    { header: 'Total', cell: (s) => <>{totalLabel(s)}</> },
    { header: 'Updated', cell: (s) => <>{new Date(s.updatedAt).toLocaleString()}</> },
  ];

  const card: SelectionCard<CheckoutSessionRow> = {
    title: (s) => <p className="truncate font-mono text-sm">{s.id.slice(0, 8)}</p>,
    subtitle: (s) => <p className="text-base-content/70 text-xs">{s.customerEmail ?? '—'}</p>,
    badge: (s) => <StepBadge step={s.step} />,
    body: (s) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <Badge color="neutral" variant="soft" size="sm">
            {statusLabel(s.channel)}
          </Badge>
          <p className="text-sm tabular-nums">{totalLabel(s)}</p>
        </div>
        <p className="text-base-content/70 text-xs">
          updated {new Date(s.updatedAt).toLocaleString()}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(s) => s.id}
      getRowLabel={(s) => s.id.slice(0, 8)}
      entityLabelPlural="sessions"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
