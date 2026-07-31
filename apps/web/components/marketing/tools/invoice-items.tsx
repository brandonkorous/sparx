'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, Input } from '@wizeworks/silicaui-react';
import { Field } from './ui-kit';
import { newLineItem, formatMoney, type LineItem } from './lib/invoice';

/** The editable line-item list for the invoice generator. */
export function InvoiceItems({
  items,
  currency,
  onChange,
}: {
  items: LineItem[];
  currency: string;
  onChange: (items: LineItem[]) => void;
}) {
  const update = (id: string, patch: Partial<LineItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        // Each line item is a silica `Card`, not a `<table>` row: this repeater
        // lives in the NARROW controls column of the two-pane workbench, where a
        // real table (description + qty + price + total + remove) would overflow
        // and scroll sideways. The card stacks the description over a wrapping
        // qty/price/total row, so it stays usable at phone width.
        <Card key={item.id}>
          <CardBody className="gap-2.5 p-3">
            <Input
              placeholder="Description"
              value={item.description}
              onChange={(e) => update(item.id, { description: e.target.value })}
            />
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="w-[72px]">
                <Field label="Qty">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={item.quantity}
                    onChange={(e) => update(item.id, { quantity: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="w-[110px]">
                <Field label="Unit price">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => update(item.id, { unitPrice: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="min-w-[80px] flex-1 text-right">
                <span className="text-caption font-mono">
                  {formatMoney(
                    (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
                    currency
                  )}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                color="neutral"
                size="sm"
                shape="square"
                aria-label="Remove item"
                disabled={items.length === 1}
                onClick={() => onChange(items.filter((it) => it.id !== item.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          color="neutral"
          size="sm"
          onClick={() => onChange([...items, newLineItem()])}
        >
          <Plus className="h-4 w-4" />
          Add line item
        </Button>
      </div>
    </div>
  );
}
