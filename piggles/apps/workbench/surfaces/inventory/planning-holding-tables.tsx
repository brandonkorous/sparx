'use client';

// The two tables on Cost to keep: what each group costs a year, and the most
// expensive things to KEEP, which are not the most valuable things to own.

import { Badge, Card, Heading, Text, Tooltip } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatCents } from './data';
import { abcLabel, abcTone, type HoldingCostReport } from './planning-data';
import { coverNote } from './cover-note';

type TopItem = HoldingCostReport['topItems'][number];

export function HoldingByClassCard({ data }: { data: HoldingCostReport }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <Heading level={3} className="text-base">
        By how much the item matters
      </Heading>
      <Table size="sm">
        <thead>
          <tr>
            <th>Group</th>
            <th className="text-right">Worth</th>
            <th className="text-right">Costs a year</th>
          </tr>
        </thead>
        <tbody>
          {data.byClass.map((c) => (
            <tr key={c.abcClass}>
              <td>
                <Badge color={abcTone(c.abcClass)} variant="soft" size="sm">
                  {abcLabel(c.abcClass === 'unclassified' ? null : c.abcClass)}
                </Badge>
              </td>
              <td className="text-right tabular-nums">{formatCents(c.valueCents)}</td>
              <td className="text-right tabular-nums">{formatCents(c.annualHoldingCostCents)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function TopItemRow({ item, multiLocation }: { item: TopItem; multiLocation: boolean }) {
  return (
    <tr>
      <td className="w-full max-w-0 min-w-56">
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{item.title ?? 'Untitled product'}</span>
          <span className="truncate text-sm">
            <span className="font-mono">{item.sku ?? 'No code'}</span>
            {/* Stock kept in two places is two rows; the place tells them apart. */}
            {multiLocation && item.warehouseName ? <span> · {item.warehouseName}</span> : null}
          </span>
        </span>
      </td>
      <td className="text-right tabular-nums">{item.onHand}</td>
      <td className="text-right tabular-nums">
        {item.costKnown ? (
          formatCents(item.valueCents)
        ) : (
          <Tooltip content="No cost price recorded for this item, so what it is worth cannot be worked out.">
            <span>No cost set</span>
          </Tooltip>
        )}
      </td>
      <td className="text-right tabular-nums">
        {item.daysOfCover === null ? '—' : `${Math.round(item.daysOfCover)} days`}
      </td>
      <td className="text-right tabular-nums">
        {item.costKnown ? formatCents(item.annualHoldingCostCents) : '—'}
      </td>
    </tr>
  );
}

export function HoldingTopItemsCard({ data }: { data: HoldingCostReport }) {
  const multiLocation = new Set(data.topItems.map((item) => item.warehouseId)).size > 1;
  // Counted from the rows on screen, so it cannot disagree with what is read.
  const coverMissing = coverNote(data.topItems);
  return (
    <Card className="flex flex-col gap-2 p-3">
      <Heading level={3} className="text-base">
        The most expensive things to keep
      </Heading>
      <Text className="text-sm">
        Not the same list as the most valuable things to own: a slow item ties its money up for far
        longer.
      </Text>
      {/* Cover is the other absent measure here; say why its column has dashes. */}
      {coverMissing ? <Text className="text-sm">{coverMissing}</Text> : null}
      <div className="overflow-x-auto">
        <Table size="sm">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">In stock</th>
              <th className="text-right">Worth</th>
              <th className="text-right">Cover</th>
              <th className="text-right">Costs a year</th>
            </tr>
          </thead>
          <tbody>
            {data.topItems.map((item) => (
              <TopItemRow
                key={`${item.variantId}:${item.warehouseId}`}
                item={item}
                multiLocation={multiLocation}
              />
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
