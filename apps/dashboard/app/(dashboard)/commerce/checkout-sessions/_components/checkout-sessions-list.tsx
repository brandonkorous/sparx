'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
  statusLabel,
  statusTone,
} from '@sparx/ui';

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
      cell: (s) => (
        <Text size="xs" className="font-mono">
          {s.id.slice(0, 8)}
        </Text>
      ),
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
    title: (s) => (
      <Text size="sm" className="truncate font-mono">
        {s.id.slice(0, 8)}
      </Text>
    ),
    subtitle: (s) => (
      <Text size="xs" variant="muted">
        {s.customerEmail ?? '—'}
      </Text>
    ),
    badge: (s) => <StepBadge step={s.step} />,
    body: (s) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Badge color="neutral" variant="soft" size="sm">
            {statusLabel(s.channel)}
          </Badge>
          <Text size="sm" className="tabular-nums">
            {totalLabel(s)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          updated {new Date(s.updatedAt).toLocaleString()}
        </Text>
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
