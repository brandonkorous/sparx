'use client';

import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  statusLabel,
  statusTone,
  Text,
} from '@sparx/ui';

import { DiscountStatusToggle } from './discount-status-toggle';

// Client wrapper for the discounts list. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar). The trailing actions column
// keeps the existing DiscountStatusToggle client island unchanged.

export interface DiscountRow {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: string;
  scope: string;
  valueCents: number | null;
  valuePercent: number | null;
  currency: string | null;
  conditions: unknown[];
  startAt: string | null;
  endAt: string | null;
  totalUsageLimit: number | null;
  perCustomerLimit: number;
  stacking: string;
  priority: number;
  status: string;
  usageCount: number;
  updatedAt: string;
}

interface DiscountsListProps {
  discounts: DiscountRow[];
  view: 'table' | 'card';
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function codeName(d: DiscountRow) {
  return (
    <Stack gap={0}>
      {d.code ? (
        <span className="font-mono text-xs">{d.code}</span>
      ) : (
        <Badge variant="outline" className="text-xs">
          automatic
        </Badge>
      )}
      <Text size="xs" variant="muted">
        {d.name}
      </Text>
    </Stack>
  );
}

function valueLabel(d: DiscountRow) {
  return (
    <>
      {d.type === 'percent' && `${d.valuePercent}%`}
      {d.type === 'fixed' && moneyFmt.format((d.valueCents ?? 0) / 100)}
      {d.type === 'free_shipping' && 'free shipping'}
      {d.type === 'buy_x_get_y' && 'BOGO'}
      {d.type === 'bundle' && 'bundle'}
    </>
  );
}

function usageLabel(d: DiscountRow): string {
  return `${d.usageCount}${d.totalUsageLimit !== null ? ` / ${d.totalUsageLimit}` : ''}`;
}

function statusBadge(d: DiscountRow) {
  return (
    <Badge color={statusTone(d.status)} variant="soft" size="sm">
      {statusLabel(d.status)}
    </Badge>
  );
}

export function DiscountsList({ discounts, view }: DiscountsListProps) {
  const columns: SelectionColumn<DiscountRow>[] = [
    { header: 'Code / Name', cell: codeName },
    { header: 'Type', cell: (d) => <Badge variant="outline">{d.type}</Badge> },
    { header: 'Value', cell: valueLabel },
    { header: 'Usage', cell: usageLabel },
    { header: 'Status', cell: statusBadge },
    {
      header: '',
      id: 'actions',
      cell: (d) => <DiscountStatusToggle discountId={d.id} status={d.status} />,
    },
  ];

  const card: SelectionCard<DiscountRow> = {
    title: (d) =>
      d.code ? (
        <span className="truncate font-mono text-sm">{d.code}</span>
      ) : (
        <Badge variant="outline" className="text-xs">
          automatic
        </Badge>
      ),
    subtitle: (d) => (
      <Text size="xs" variant="muted">
        {d.name}
      </Text>
    ),
    badge: statusBadge,
    body: (d) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Badge variant="outline">{d.type}</Badge>
          <Text size="sm" className="tabular-nums">
            {valueLabel(d)}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            Used {usageLabel(d)}
          </Text>
          <DiscountStatusToggle discountId={d.id} status={d.status} />
        </Stack>
      </>
    ),
  };

  return (
    <SelectionList
      items={discounts}
      view={view}
      getId={(d) => d.id}
      selectable={false}
      getRowLabel={(d) => d.code ?? d.name}
      entityLabelPlural="discounts"
      columns={columns}
      card={card}
    />
  );
}
