'use client';

// The typing column on What your stock cost you: one box per item, biggest
// holdings first, and Enter moves down rather than submitting.

import { Card } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { UncostedRow } from './uncosted-row';
import type { UncostedVariant } from './uncosted-data';

/** Enter moves down the column: a long typing job should never need the mouse. */
function focusNext(index: number) {
  const boxes = document.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]');
  boxes[index + 1]?.focus();
}

export function UncostedTable({
  items,
  typed,
  onTyped,
}: {
  items: UncostedVariant[];
  typed: Record<string, string>;
  onTyped: (variantId: string, next: string) => void;
}) {
  return (
    <Card className="overflow-x-auto">
      <Table size="sm">
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right whitespace-nowrap">You hold</th>
            <th className="hidden text-right whitespace-nowrap @lg:table-cell">Sells for</th>
            <th className="whitespace-nowrap">Cost to you</th>
            <th className="hidden text-right whitespace-nowrap @xl:table-cell">Worth in total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <UncostedRow
              key={item.variantId}
              item={item}
              value={typed[item.variantId] ?? ''}
              onValue={(next) => {
                onTyped(item.variantId, next);
              }}
              onEnter={() => {
                focusNext(index);
              }}
            />
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
