'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

import { EntityRowLink } from '../../_components/entity-row-link';
import { AR_STATUS_VARIANT, formatMoney } from './format';

// Client wrapper for the invoicing documents list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands serializable rows + view here and this builds both views.
// Read-only — `selectable={false}` (no checkboxes / bulk bar); rows open the
// document via EntityRowLink in the user's detail-view surface.

export interface DocumentRow {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  total: string | number;
  balance: string | number;
  stageId: string;
  workflowId: string;
  updatedAt: string;
}

interface DocumentsListProps {
  items: DocumentRow[];
  view: 'table' | 'card';
  /** stageId → customer-facing label (Estimate / Invoice / Work Order). */
  stageLabels: Record<string, string>;
}

export function DocumentsList({ items, view, stageLabels }: DocumentsListProps) {
  const numberLink = (d: DocumentRow, className: string) => (
    <EntityRowLink
      href={`/invoicing/documents/${d.id}`}
      entityType="billing-document"
      entityId={d.id}
      className={className}
    >
      {d.number ?? 'Draft'}
    </EntityRowLink>
  );

  const statusBadge = (d: DocumentRow) => (
    <Badge color={AR_STATUS_VARIANT[d.status] ?? 'neutral'} className="text-xs">
      {d.status}
    </Badge>
  );

  const columns: SelectionColumn<DocumentRow>[] = [
    {
      header: 'Number',
      cell: (d) =>
        numberLink(d, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    {
      header: 'Kind',
      cell: (d) => (
        <Text size="sm" variant="muted">
          {stageLabels[d.stageId] ?? '—'}
        </Text>
      ),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Total',
      align: 'right',
      cell: (d) => formatMoney(d.total, d.currency),
    },
    {
      header: 'Balance',
      align: 'right',
      cell: (d) => formatMoney(d.balance, d.currency),
    },
    {
      header: 'Updated',
      cell: (d) => (
        <Text size="sm" variant="muted">
          {new Date(d.updatedAt).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<DocumentRow> = {
    title: (d) =>
      numberLink(
        d,
        'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
      ),
    subtitle: (d) => (
      <Text size="xs" variant="muted">
        {stageLabels[d.stageId] ?? '—'}
      </Text>
    ),
    badge: statusBadge,
    body: (d) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Total
          </Text>
          <Text size="sm" className="tabular-nums">
            {formatMoney(d.total, d.currency)}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Balance
          </Text>
          <Text size="sm" className="tabular-nums">
            {formatMoney(d.balance, d.currency)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          Updated {new Date(d.updatedAt).toLocaleDateString()}
        </Text>
      </>
    ),
  };

  return (
    <SelectionList
      items={items}
      view={view}
      getId={(d) => d.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
