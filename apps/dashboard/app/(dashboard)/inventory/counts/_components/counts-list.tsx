'use client';

import Link from 'next/link';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

import {
  countStatus,
  countTypeLabel,
  formatDate,
  formatMoney,
  type InventoryCountRow,
} from './types';

// Client wrapper for the count list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server page
// hands rows + view here. Read-only; the number links to the count detail.

interface CountsListProps {
  rows: InventoryCountRow[];
  view: 'table' | 'card';
}

export function CountsList({ rows, view }: CountsListProps) {
  const numberLink = (c: InventoryCountRow) => (
    <Link
      href={`/inventory/counts/${c.id}`}
      className="font-mono text-xs hover:text-[var(--module-active)]"
    >
      {c.number}
    </Link>
  );

  const statusBadge = (c: InventoryCountRow) => {
    const s = countStatus(c.status);
    return (
      <Stack direction="row" align="center" gap={1} wrap>
        <Badge color={s.color}>{s.label}</Badge>
        {c.requiresApproval && c.status !== 'posted' && c.status !== 'cancelled' ? (
          <Badge color="warning" variant="soft">
            needs approval
          </Badge>
        ) : null}
      </Stack>
    );
  };

  const progress = (c: InventoryCountRow) => (
    <Text size="xs" variant="muted">
      {c.countedLineCount}/{c.lineCount} counted
    </Text>
  );

  const variance = (c: InventoryCountRow) =>
    c.status === 'counting' ? '—' : formatMoney(c.varianceValueCents);

  const columns: SelectionColumn<InventoryCountRow>[] = [
    { header: 'Number', cell: numberLink },
    { header: 'Type', cell: (c) => countTypeLabel(c.type) },
    { header: 'Warehouse', cell: (c) => c.warehouseName ?? c.warehouseCode ?? '—' },
    { header: 'Status', cell: statusBadge },
    { header: 'Counted', cell: progress },
    { header: 'Variance', cell: variance },
    { header: 'Started', cell: (c) => formatDate(c.startedAt) },
  ];

  const card: SelectionCard<InventoryCountRow> = {
    title: (c) => (
      <Text size="sm" className="truncate font-medium">
        {countTypeLabel(c.type)} · {c.warehouseName ?? c.warehouseCode ?? '—'}
      </Text>
    ),
    subtitle: numberLink,
    badge: statusBadge,
    body: (c) => (
      <Stack gap={2}>
        <Stack direction="row" align="center" justify="between" gap={2}>
          {progress(c)}
          <Text size="sm" className="font-medium">
            {variance(c)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          started {formatDate(c.startedAt)}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(c) => c.id}
      selectable={false}
      entityLabelPlural="counts"
      getRowLabel={(c) => c.number}
      columns={columns}
      card={card}
    />
  );
}
