'use client';

// Create a fulfillment for an order's still-unfulfilled lines. This is the
// missing first step ahead of FulfillmentLabelPanel's "Buy shipping label" —
// that panel only renders once a fulfillment row exists, and nothing on this
// page created one. Defaults every line to its full remaining quantity (the
// common one-shipment case); each is still independently editable for a
// partial shipment.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PackagePlus } from 'lucide-react';
import { Button, Input, Label } from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';

import { createFulfillmentAction } from '../actions/order-fulfillment-actions';

export interface UnfulfilledLine {
  orderItemId: string;
  sku: string;
  name: string;
  remaining: number;
}

export function CreateFulfillmentPanel({
  orderId,
  lines,
}: {
  orderId: string;
  lines: UnfulfilledLine[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [quantities, setQuantities] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.orderItemId, l.remaining]))
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fulfillLines = lines
      .map((l) => ({ orderItemId: l.orderItemId, quantity: quantities[l.orderItemId] ?? 0 }))
      .filter((l) => l.quantity > 0);
    if (fulfillLines.length === 0) {
      toast.error('Enter a quantity for at least one item.');
      return;
    }
    startTransition(async () => {
      const result = await createFulfillmentAction({ orderId, lines: fulfillLines });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('Fulfillment created.');
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-base-300 flex flex-col gap-3 rounded-lg border border-dashed p-3"
    >
      <p className="text-sm font-medium">Ship these items</p>
      <div className="flex flex-col gap-2">
        {lines.map((l) => (
          <div key={l.orderItemId} className="flex flex-row items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{l.name}</p>
              <p className="text-base-content font-mono text-xs">{l.sku}</p>
            </div>
            <div className="flex w-24 flex-col gap-1">
              <Label htmlFor={`qty-${l.orderItemId}`} className="text-base-content text-xs">
                Qty (of {l.remaining})
              </Label>
              <Input
                id={`qty-${l.orderItemId}`}
                type="number"
                min={0}
                max={l.remaining}
                value={quantities[l.orderItemId] ?? 0}
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [l.orderItemId]: Math.max(
                      0,
                      Math.min(l.remaining, Number(e.target.value) || 0)
                    ),
                  }))
                }
              />
            </div>
          </div>
        ))}
      </div>
      <Button type="submit" color="module" size="sm" disabled={pending} className="self-start">
        <PackagePlus className="h-3.5 w-3.5" />
        {pending ? 'Creating…' : 'Create fulfillment'}
      </Button>
    </form>
  );
}
