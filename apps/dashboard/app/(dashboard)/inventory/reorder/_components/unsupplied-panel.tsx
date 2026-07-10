import Link from 'next/link';
import { Truck } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import type { UnsuppliedSuggestion } from './types';

// Low items with no purchasing supplier linked — surfaced separately since
// they can't become a draftable reorder suggestion until linked.

export function UnsuppliedPanel({ items }: { items: UnsuppliedSuggestion[] }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-row items-center gap-2">
            <Truck className="h-4 w-4" />
            <h3 className="text-xl font-semibold">Low — no supplier linked</h3>
            <Badge color="warning">{items.length}</Badge>
          </div>
          <p className="text-base-content/70 text-sm">
            These items are low but have no purchasing supplier. Link one to a supplier&apos;s
            catalog and they&apos;ll become draftable reorder suggestions.
          </p>
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div
                key={`${it.variantId}-${it.warehouseId}`}
                className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2"
              >
                <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
                  <p className="text-sm font-medium">
                    {it.title ?? it.sku ?? it.variantId.slice(0, 8)}
                  </p>
                  <p className="text-base-content/70 font-mono text-xs">
                    {it.sku ?? it.variantId} · {it.warehouseName ?? it.warehouseCode}
                  </p>
                </div>
                <p className="text-base-content/70 text-sm">
                  {it.available} / {it.reorderPoint} reorder pt
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/inventory/suppliers?variant=${it.variantId}`} />}
                >
                  Link supplier
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
