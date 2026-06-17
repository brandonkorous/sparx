'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@sparx/ui';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <Input
            placeholder="Description"
            value={item.description}
            onChange={(e) => update(item.id, { description: e.target.value })}
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: '72px' }}>
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
            <div style={{ width: '110px' }}>
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
            <div style={{ flex: 1, minWidth: '80px', textAlign: 'right' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                }}
              >
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
        </div>
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
