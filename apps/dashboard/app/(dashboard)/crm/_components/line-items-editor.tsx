'use client';

// Shared line-items editor used by the new-order and new-quote forms.
// Owns the items array + a running total. The parent renders the surrounding
// form and reads items via `getItems()` on submit; this component never
// touches Server Actions itself.

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button, Input, Label } from 'silicaui-react';

export interface LineItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  discountAmount: number;
}

interface LineItemsEditorProps {
  /** Called every time the items array changes so the parent can mirror
   *  it into a hidden field / state for submission. */
  onChange: (items: LineItem[]) => void;
  initialItems?: LineItem[];
}

const EMPTY_ITEM: LineItem = {
  sku: '',
  name: '',
  quantity: 1,
  unitPrice: 0,
  taxAmount: 0,
  discountAmount: 0,
};

export function LineItemsEditor({ onChange, initialItems }: LineItemsEditorProps) {
  const [items, setItems] = React.useState<LineItem[]>(initialItems ?? [{ ...EMPTY_ITEM }]);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => {
      const next = prev.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      onChange(next);
      return next;
    });
  }

  function addItem() {
    setItems((prev) => {
      const next = [...prev, { ...EMPTY_ITEM }];
      onChange(next);
      return next;
    });
  }

  function removeItem(idx: number) {
    setItems((prev) => {
      const next = prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev;
      onChange(next);
      return next;
    });
  }

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxSum = items.reduce((s, it) => s + (it.taxAmount || 0), 0);
  const discountSum = items.reduce((s, it) => s + (it.discountAmount || 0), 0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-md border border-[var(--color-border-default)] p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-row gap-3">
              <div className="flex w-32 flex-col gap-1">
                <Label htmlFor={`sku-${idx}`}>SKU</Label>
                <Input
                  id={`sku-${idx}`}
                  value={item.sku}
                  onChange={(e) => updateItem(idx, { sku: e.target.value })}
                  required
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={`name-${idx}`}>Name</Label>
                <Input
                  id={`name-${idx}`}
                  value={item.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                shape="square"
                size="sm"
                onClick={() => removeItem(idx)}
                aria-label="Remove line item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-row gap-3">
              <div className="flex w-24 flex-col gap-1">
                <Label htmlFor={`qty-${idx}`}>Qty</Label>
                <Input
                  id={`qty-${idx}`}
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={`price-${idx}`}>Unit price</Label>
                <Input
                  id={`price-${idx}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateItem(idx, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={`tax-${idx}`}>Tax</Label>
                <Input
                  id={`tax-${idx}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.taxAmount}
                  onChange={(e) =>
                    updateItem(idx, { taxAmount: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={`disc-${idx}`}>Discount</Label>
                <Input
                  id={`disc-${idx}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discountAmount}
                  onChange={(e) =>
                    updateItem(idx, { discountAmount: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="flex w-28 flex-col gap-1">
                <Label>Line total</Label>
                <div className="flex h-9 items-center justify-end rounded-md border border-transparent bg-[var(--color-surface-subtle)] px-3 text-sm tabular-nums">
                  $
                  {(item.quantity * item.unitPrice - item.discountAmount + item.taxAmount).toFixed(
                    2
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-row items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          iconStart={<Plus className="h-3.5 w-3.5" />}
        >
          Add line item
        </Button>
        <div className="flex flex-row gap-4">
          <p className="text-base-content/70 text-sm">
            Subtotal: <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </p>
          <p className="text-base-content/70 text-sm">
            Tax: <span className="tabular-nums">${taxSum.toFixed(2)}</span>
          </p>
          <p className="text-base-content/70 text-sm">
            Discount: <span className="tabular-nums">${discountSum.toFixed(2)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
