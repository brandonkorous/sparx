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

import { daysUntil, formatDate, hazmatLabel, recallBadge, type LotRow } from './types';

// Client wrapper for the lot list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server page
// hands rows + view here. The lot number links to the lot detail.

interface LotsListProps {
  rows: LotRow[];
  view: 'table' | 'card';
}

export function LotsList({ rows, view }: LotsListProps) {
  const nowMs = Date.now();

  const lotLink = (l: LotRow) => (
    <Link
      href={`/inventory/lots/${l.id}`}
      className="font-mono text-xs hover:text-[var(--module-active)]"
    >
      {l.lotNumber}
    </Link>
  );

  const item = (l: LotRow) => (
    <Stack gap={0} className="min-w-0">
      <Text size="sm" className="truncate font-medium">
        {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
      </Text>
      {l.variantSku ? (
        <Text size="xs" variant="muted" className="font-mono">
          {l.variantSku}
        </Text>
      ) : null}
    </Stack>
  );

  const expires = (l: LotRow) => {
    const days = daysUntil(l.expiresAt, nowMs);
    return (
      <Stack gap={0}>
        <Text size="sm">{formatDate(l.expiresAt)}</Text>
        {days !== null ? (
          <Text
            size="xs"
            className={days < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}
          >
            {days < 0 ? `expired ${-days}d ago` : `${days}d left`}
          </Text>
        ) : null}
      </Stack>
    );
  };

  const hazmat = (l: LotRow) =>
    l.hazmatClass === 'none' ? (
      <Text size="xs" variant="muted">
        none
      </Text>
    ) : (
      <Badge color="warning" variant="soft">
        {hazmatLabel(l.hazmatClass)}
      </Badge>
    );

  const recall = (l: LotRow) => {
    const b = recallBadge(l.recallStatus);
    return b ? (
      <Badge color={b.color}>{b.label}</Badge>
    ) : (
      <Text size="xs" variant="muted">
        —
      </Text>
    );
  };

  const columns: SelectionColumn<LotRow>[] = [
    { header: 'Lot', cell: lotLink },
    { header: 'Item', cell: item },
    { header: 'Warehouse', cell: (l) => l.warehouseName ?? l.warehouseCode ?? '—' },
    { header: 'Qty', cell: (l) => String(l.quantity) },
    { header: 'Serials', cell: (l) => String(l.serialCount) },
    { header: 'Expires', cell: expires },
    { header: 'Hazmat', cell: hazmat },
    { header: 'Recall', cell: recall },
  ];

  const card: SelectionCard<LotRow> = {
    title: item,
    subtitle: lotLink,
    badge: (l) => {
      const b = recallBadge(l.recallStatus);
      return b ? <Badge color={b.color}>{b.label}</Badge> : null;
    },
    body: (l) => (
      <Stack gap={2}>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {l.warehouseName ?? l.warehouseCode ?? '—'}
          </Text>
          <Text size="sm">
            {l.quantity} qty · {l.serialCount} serial{l.serialCount === 1 ? '' : 's'}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          {expires(l)}
          {hazmat(l)}
        </Stack>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(l) => l.id}
      selectable={false}
      entityLabelPlural="lots"
      getRowLabel={(l) => l.lotNumber}
      columns={columns}
      card={card}
    />
  );
}
