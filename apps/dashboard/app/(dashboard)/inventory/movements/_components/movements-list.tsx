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
  actorLabel,
  formatDateTime,
  formatDelta,
  reasonColor,
  reasonLabel,
  type MovementRow,
} from './types';

// Client wrapper for the movement / audit-log list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands rows + view here. Read-only — the ledger is append-only. The
// item links to filter the log to that variant.

interface MovementsListProps {
  rows: MovementRow[];
  view: 'table' | 'card';
}

export function MovementsList({ rows, view }: MovementsListProps) {
  const item = (m: MovementRow) => (
    <Stack gap={0} className="min-w-0">
      <Link
        href={`/inventory/movements?variant_id=${m.variantId}${m.variantSku ? `&sku=${encodeURIComponent(m.variantSku)}` : ''}`}
        className="truncate text-sm font-medium hover:text-[var(--module-active)]"
      >
        {m.productTitle ?? m.variantSku ?? m.variantId.slice(0, 8)}
      </Link>
      {m.variantSku ? (
        <Text size="xs" variant="muted" className="font-mono">
          {m.variantSku}
        </Text>
      ) : null}
    </Stack>
  );

  const reason = (m: MovementRow) => (
    <Badge color={reasonColor(m.reason)}>{reasonLabel(m.reason)}</Badge>
  );

  const change = (m: MovementRow) => (
    <Text
      size="sm"
      className={
        m.delta > 0
          ? 'font-medium text-[var(--color-success)]'
          : m.delta < 0
            ? 'font-medium text-[var(--color-danger)]'
            : 'font-medium'
      }
    >
      {formatDelta(m.delta)}
    </Text>
  );

  const actor = (m: MovementRow) => (
    <Stack gap={0} className="min-w-0">
      <Text size="sm">{actorLabel(m.actorType)}</Text>
      {m.source ? (
        <Text size="xs" variant="muted" className="truncate">
          {m.source}
        </Text>
      ) : null}
    </Stack>
  );

  const reference = (m: MovementRow) =>
    m.referenceType ? (
      <Text size="xs" variant="muted">
        {m.referenceType}
      </Text>
    ) : (
      <Text size="xs" variant="muted">
        —
      </Text>
    );

  const columns: SelectionColumn<MovementRow>[] = [
    { header: 'When', cell: (m) => formatDateTime(m.createdAt) },
    { header: 'Item', cell: item },
    { header: 'Location', cell: (m) => m.warehouseName ?? m.warehouseCode ?? '—' },
    { header: 'Reason', cell: reason },
    { header: 'Change', cell: change },
    { header: 'Balance', cell: (m) => (m.balanceAfter === null ? '—' : String(m.balanceAfter)) },
    { header: 'Actor', cell: actor },
    { header: 'Reference', cell: reference },
  ];

  const card: SelectionCard<MovementRow> = {
    title: item,
    badge: reason,
    subtitle: (m) => (
      <Text size="xs" variant="muted">
        {formatDateTime(m.createdAt)}
      </Text>
    ),
    body: (m) => (
      <Stack gap={2}>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {m.warehouseName ?? m.warehouseCode ?? '—'}
          </Text>
          <Stack direction="row" align="center" gap={2}>
            {change(m)}
            <Text size="xs" variant="muted">
              bal {m.balanceAfter ?? '—'}
            </Text>
          </Stack>
        </Stack>
        <Text size="xs" variant="muted">
          {actorLabel(m.actorType)}
          {m.referenceType ? ` · ${m.referenceType}` : ''}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(m) => m.id}
      selectable={false}
      entityLabelPlural="movements"
      getRowLabel={(m) => `${reasonLabel(m.reason)} ${formatDelta(m.delta)}`}
      columns={columns}
      card={card}
    />
  );
}
