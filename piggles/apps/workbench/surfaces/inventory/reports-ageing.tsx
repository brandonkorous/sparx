'use client';

// How long stock has sat unsold, and which of it has the most money tied up.

import { Badge, Text, Timestamp } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatCents } from './data';
import {
  agingBucketLabel,
  agingBucketTone,
  type AgingBucket,
  type AgingReport,
  type DeadStockItem,
} from './reports-data';
import { NUMBER, barWidthClass } from './reports-shared';
import { ReportCard } from './reports-card';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

function AgeingRow({
  bucket,
  currency,
  share,
}: {
  bucket: AgingBucket;
  currency: string;
  share: number;
}) {
  return (
    <tr>
      <td>
        <Badge color={agingBucketTone(bucket.bucket)} variant="soft" size="sm">
          {agingBucketLabel(bucket.bucket)}
        </Badge>
      </td>
      <td className="text-right font-medium whitespace-nowrap tabular-nums">
        {formatCents(bucket.costCents, currency)}
      </td>
      <td className="hidden text-right tabular-nums @lg:table-cell">
        {NUMBER.format(bucket.units)}
      </td>
      <td className="hidden @xl:table-cell">
        <div className="bg-base-200 h-2 w-full max-w-40 overflow-hidden rounded-full">
          <div className={`bg-module h-full rounded-full ${barWidthClass(share)}`} />
        </div>
      </td>
    </tr>
  );
}

export function AgeingCard({
  report,
  currency,
  locationName,
}: {
  report: AgingReport;
  currency: string;
  locationName: string | null;
}) {
  const withStock = report.buckets.filter((b) => b.levels > 0);
  const totalValue = report.buckets.reduce((sum, b) => sum + b.costCents, 0);
  const where = locationName ? ` at ${locationName}` : '';

  return (
    <ReportCard
      title="How long your stock has sat unsold"
      blurb={`The value of what you hold, grouped by how long since it last sold${where}. The lower bands are money working the hardest.`}
    >
      {withStock.length === 0 ? (
        <Text className="text-sm">There is no stock on hand to age{where} just yet.</Text>
      ) : (
        <Table size="sm">
          <thead>
            <tr>
              <th>How recently it sold</th>
              <th className="text-right whitespace-nowrap">Value held</th>
              <th className="hidden text-right @lg:table-cell">Units</th>
              <th className="hidden @xl:table-cell">Share</th>
            </tr>
          </thead>
          <tbody>
            {withStock.map((bucket) => (
              <AgeingRow
                key={bucket.bucket}
                bucket={bucket}
                currency={currency}
                share={totalValue > 0 ? bucket.costCents / totalValue : 0}
              />
            ))}
          </tbody>
        </Table>
      )}
    </ReportCard>
  );
}

function DeadStockRow({
  item,
  currency,
  onOpen,
}: {
  item: DeadStockItem;
  currency: string;
  onOpen: (item: DeadStockItem, event: Modifiers) => void;
}) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(item, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(item, event);
      }}
    >
      <td className="w-full max-w-0">
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{item.title ?? 'Untitled product'}</span>
          <span className="truncate font-mono text-sm">{item.sku ?? 'No code'}</span>
        </span>
      </td>
      <td className="hidden max-w-40 truncate @lg:table-cell">{item.warehouseCode}</td>
      <td className="text-right font-medium whitespace-nowrap tabular-nums">
        {formatCents(item.costCents, currency)}
      </td>
      <td className="hidden text-right whitespace-nowrap @xl:table-cell">
        {item.lastSaleAt ? <Timestamp value={item.lastSaleAt} format="relative" /> : 'Never'}
      </td>
    </tr>
  );
}

export function DeadStockCard({
  items,
  currency,
  onOpen,
}: {
  items: DeadStockItem[];
  currency: string;
  onOpen: (item: DeadStockItem, event: Modifiers) => void;
}) {
  return (
    <ReportCard
      title="Worth freeing up first"
      blurb="The items with the most money tied up that have not sold in months. Discounting, moving or returning these is where cash comes back quickest."
    >
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Item</th>
            <th className="hidden @lg:table-cell">Where</th>
            <th className="text-right whitespace-nowrap">Value</th>
            <th className="hidden text-right whitespace-nowrap @xl:table-cell">Last sold</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <DeadStockRow
              key={`${item.variantId}:${item.warehouseId}`}
              item={item}
              currency={currency}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </Table>
    </ReportCard>
  );
}
