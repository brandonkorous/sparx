'use client';

import {
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { Badge } from 'silicaui-react';

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
    <div className="flex flex-col gap-0">
      {d.code ? (
        <span className="font-mono text-xs">{d.code}</span>
      ) : (
        <Badge color="neutral" variant="soft" size="sm">
          automatic
        </Badge>
      )}
      <p className="text-base-content/70 text-xs">{d.name}</p>
    </div>
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
    {
      header: 'Type',
      cell: (d) => (
        <Badge color="info" variant="soft" size="sm">
          {statusLabel(d.type)}
        </Badge>
      ),
    },
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
        <Badge color="neutral" variant="soft" size="sm">
          automatic
        </Badge>
      ),
    subtitle: (d) => <p className="text-base-content/70 text-xs">{d.name}</p>,
    badge: statusBadge,
    body: (d) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <Badge color="info" variant="soft" size="sm">
            {statusLabel(d.type)}
          </Badge>
          <p className="text-sm tabular-nums">{valueLabel(d)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">Used {usageLabel(d)}</p>
          <DiscountStatusToggle discountId={d.id} status={d.status} />
        </div>
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
