'use client';

// "Recent receipts" section — posted goods receipts, rendered through the
// shared `SelectionList` dual-view substrate (docs/34 §7). Read-only:
// receipts are immutable once posted, so there's nothing to select for.

import Link from 'next/link';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { formatDate, type GoodsReceiptRow } from './types';

interface ReceiptsListProps {
  receipts: GoodsReceiptRow[];
  view: 'table' | 'card';
}

function quantityLine(r: GoodsReceiptRow): string {
  return `${r.quantityReceived} unit${r.quantityReceived === 1 ? '' : 's'} · ${r.lineCount} line${r.lineCount === 1 ? '' : 's'}`;
}

export function ReceiptsList({ receipts, view }: ReceiptsListProps) {
  const numberLink = (r: GoodsReceiptRow, className: string) => (
    <Link href={`/inventory/receiving/${r.id}`} className={className}>
      {r.number}
    </Link>
  );

  const columns: SelectionColumn<GoodsReceiptRow>[] = [
    {
      header: 'Receipt',
      cell: (r) => (
        <div className="flex flex-col gap-1">
          {numberLink(r, 'font-mono text-sm hover:text-module hover:underline')}
          <p className="text-base-content/70 text-xs">{r.purchaseOrderNumber ?? '—'}</p>
        </div>
      ),
    },
    {
      header: 'Warehouse',
      cell: (r) => <p className="text-sm">{r.warehouseName ?? r.warehouseCode ?? '—'}</p>,
    },
    {
      header: 'Received',
      cell: (r) => <p className="text-base-content/70 text-sm">{formatDate(r.receivedAt)}</p>,
    },
    {
      header: 'Quantity',
      align: 'right',
      cell: (r) => <p className="text-sm">{quantityLine(r)}</p>,
    },
  ];

  const card: SelectionCard<GoodsReceiptRow> = {
    title: (r) => numberLink(r, 'font-mono text-sm hover:text-module hover:underline'),
    subtitle: (r) => (
      <p className="text-base-content/70 text-xs">
        {r.purchaseOrderNumber ?? '—'} · {formatDate(r.receivedAt)}
      </p>
    ),
    body: (r) => (
      <p className="text-base-content/70 text-sm">
        {quantityLine(r)}
        {r.reference ? ` · ${r.reference}` : ''}
      </p>
    ),
  };

  return (
    <SelectionList
      items={receipts}
      view={view}
      getId={(r) => r.id}
      getRowLabel={(r) => r.number}
      entityLabelPlural="receipts"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
