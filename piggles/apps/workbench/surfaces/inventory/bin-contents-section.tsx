'use client';

import { Badge, Heading, Text, Timestamp } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { plural } from './data';
import { binTypeLabel, binTypeTone, type BinContent, type useBin } from './bins-data';

const NUMBER = new Intl.NumberFormat();

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function BinContentsRow({ ctx, row }: { ctx: SurfaceContext; row: BinContent }) {
  return (
    <tr
      className="hover:bg-base-200 cursor-pointer"
      tabIndex={0}
      onClick={(event) => {
        ctx.open(
          'inventory.stock.item',
          { variantId: row.variantId },
          { target: targetFor(event) }
        );
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        ctx.open('inventory.stock.item', { variantId: row.variantId });
      }}
    >
      <td className="max-w-56">
        <span className="block truncate font-medium">
          {row.productTitle ?? row.sku ?? 'Unnamed item'}
        </span>
        {row.sku ? <span className="truncate font-mono text-sm">{row.sku}</span> : null}
      </td>
      <td data-label="Here" className="text-right font-medium tabular-nums">
        {NUMBER.format(row.onHand)}
      </td>
      <td data-label="Last checked" className="hidden whitespace-nowrap @lg:table-cell">
        {row.lastCountedAt ? (
          <Timestamp value={row.lastCountedAt} format="relative" />
        ) : (
          <Text className="text-sm">Never</Text>
        )}
      </td>
    </tr>
  );
}

interface ContentsProps {
  ctx: SurfaceContext;
  bin: ReturnType<typeof useBin>;
  rows: BinContent[];
}

export function BinContentsSection({ ctx, bin, rows }: ContentsProps) {
  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex flex-wrap items-start justify-between gap-2 border-b pb-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading level={2} className="text-lg font-semibold">
            What is on it
          </Heading>
          <Text className="text-sm">
            {bin.data
              ? `${plural(bin.data.itemCount, 'item', 'items')} · ${plural(bin.data.unitCount, 'unit', 'units')}`
              : ''}
          </Text>
        </div>
        {bin.data ? (
          <Badge color={binTypeTone(bin.data.type)} variant="soft">
            {binTypeLabel(bin.data.type)}
          </Badge>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Text className="text-sm">
          Nothing is recorded on this shelf. It will fill up as deliveries are put away here.
        </Text>
      ) : (
        <Table className="table-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Here</th>
              <th className="hidden @lg:table-cell">Last checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <BinContentsRow key={row.variantId} ctx={ctx} row={row} />
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
