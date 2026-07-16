'use client';

// Bulk price adjustment modal (docs/69 B-3). Two steps in one dialog:
//   1. Configure — percentage / fixed-amount (increase or decrease) / set-to.
//   2. Preview — a dry-run before→after table per product; nothing is written
//      until "Apply". Apply records a 30-minute undo (surfaced as a banner on
//      the products list).

import * as React from 'react';
import { ArrowDown, ArrowUp, DollarSign, Percent, Tag } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
  Loading,
  Table,
} from '@wizeworks/silicaui-react';
import { useFieldValidation } from '@sparx/forms';

import { applyBulkPriceAction, previewBulkPriceAction } from '../../product-actions';
import type { BulkPricePreview, PriceAdjustment } from '../_lib/bulk-price-types';

type Mode = 'percent' | 'fixed' | 'set';
type Direction = 'increase' | 'decrease';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onApplied: () => void;
}

const MODES: { value: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'percent', label: 'Percentage', icon: Percent },
  { value: 'fixed', label: 'Fixed amount', icon: DollarSign },
  { value: 'set', label: 'Set price', icon: Tag },
];

export function BulkPriceAdjustModal({ open, onOpenChange, productIds, onApplied }: Props) {
  const [mode, setMode] = React.useState<Mode>('percent');
  const [direction, setDirection] = React.useState<Direction>('increase');
  const [amount, setAmount] = React.useState('');
  const [preview, setPreview] = React.useState<BulkPricePreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setMode('percent');
    setDirection('increase');
    setAmount('');
    setPreview(null);
    setError(null);
    setBusy(false);
  }

  // Reset on close so the next open starts fresh (no prop→state effect needed).
  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const amountNum = Number(amount);

  // A decrease can't exceed 100 %; the amount must be a non-negative number.
  const v = useFieldValidation(
    { amount, mode, direction },
    {
      amount: (val) => {
        const s = String(val ?? '').trim();
        if (s === '') return 'Enter an amount.';
        const n = Number(s);
        if (!Number.isFinite(n)) return 'Enter a valid number.';
        if (n < 0) return 'Cannot be negative.';
        if (mode === 'percent' && direction === 'decrease' && n > 100) {
          return 'A decrease can’t be more than 100%.';
        }
        return null;
      },
    }
  );

  function buildAdjustment(): PriceAdjustment {
    if (mode === 'set') return { mode: 'set', priceCents: Math.round(amountNum * 100) };
    const sign = direction === 'increase' ? 1 : -1;
    if (mode === 'percent') return { mode: 'percent', percent: sign * amountNum };
    return { mode: 'fixed', amountCents: sign * Math.round(amountNum * 100) };
  }

  async function runPreview() {
    if (!v.validate()) return;
    setBusy(true);
    setError(null);
    const res = await previewBulkPriceAction(productIds, buildAdjustment());
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setPreview(res.data);
  }

  async function runApply() {
    setBusy(true);
    setError(null);
    const res = await applyBulkPriceAction(productIds, buildAdjustment());
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    onApplied();
    handleOpenChange(false);
  }

  const unit = mode === 'percent' ? '%' : '$';
  const amountLabel = mode === 'set' ? 'New price' : mode === 'percent' ? 'Percentage' : 'Amount';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle>Adjust prices</DialogTitle>
          <DialogDescription>
            {productIds.length} product{productIds.length === 1 ? '' : 's'} selected. Changes apply
            to every variant and can be undone for 30 minutes.
          </DialogDescription>
        </div>

        {preview ? (
          <PreviewStep preview={preview} />
        ) : (
          <div className="flex flex-col gap-5 py-2">
            <div className="flex flex-col gap-2">
              <Label>Adjustment</Label>
              <div className="flex flex-row flex-wrap gap-2">
                {MODES.map((m) => (
                  <Button
                    key={m.value}
                    type="button"
                    size="sm"
                    color="module"
                    variant={mode === m.value ? 'solid' : 'outline'}
                    iconStart={<m.icon className="h-4 w-4" />}
                    onClick={() => setMode(m.value)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>

            {mode !== 'set' ? (
              <div className="flex flex-col gap-2">
                <Label>Direction</Label>
                <div className="flex flex-row gap-2">
                  <Button
                    type="button"
                    size="sm"
                    color={direction === 'increase' ? 'success' : 'neutral'}
                    variant={direction === 'increase' ? 'solid' : 'outline'}
                    iconStart={<ArrowUp className="h-4 w-4" />}
                    onClick={() => setDirection('increase')}
                  >
                    Increase
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    color={direction === 'decrease' ? 'danger' : 'neutral'}
                    variant={direction === 'decrease' ? 'solid' : 'outline'}
                    iconStart={<ArrowDown className="h-4 w-4" />}
                    onClick={() => setDirection('decrease')}
                  >
                    Decrease
                  </Button>
                </div>
              </div>
            ) : null}

            <Field {...v.field('amount')} className="gap-2">
              <FieldLabel htmlFor="bulk-price-amount">{amountLabel}</FieldLabel>
              <div className="flex flex-row items-center gap-2">
                {unit === '$' ? <span className="text-base-content text-sm">$</span> : null}
                <FieldControl
                  id="bulk-price-amount"
                  type="number"
                  min={0}
                  step={mode === 'percent' ? 1 : 0.01}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={mode === 'percent' ? '10' : '0.00'}
                  className="max-w-40"
                  {...v.control('amount')}
                />
                {unit === '%' ? <span className="text-base-content text-sm">%</span> : null}
              </div>
            </Field>
          </div>
        )}

        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {preview ? (
            <>
              <Button
                variant="outline"
                color="neutral"
                onClick={() => setPreview(null)}
                disabled={busy}
              >
                Back
              </Button>
              <Button
                color="module"
                onClick={() => void runApply()}
                disabled={busy || preview.changedVariantCount === 0}
                iconStart={busy ? <Loading className="h-4 w-4" /> : undefined}
              >
                Apply to {preview.changedVariantCount} variant
                {preview.changedVariantCount === 1 ? '' : 's'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" color="neutral" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                color="module"
                onClick={() => void runPreview()}
                disabled={busy || !v.isValid}
                iconStart={busy ? <Loading className="h-4 w-4" /> : undefined}
              >
                Preview changes
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewStep({ preview }: { preview: BulkPricePreview }) {
  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-base-content text-sm">
        <span className="text-base-content font-medium">{preview.label}.</span>{' '}
        {preview.changedVariantCount} of {preview.variantCount} variant
        {preview.variantCount === 1 ? '' : 's'} across {preview.productCount} product
        {preview.productCount === 1 ? '' : 's'} will change.
      </p>
      <div className="max-h-80 overflow-y-auto">
        <Table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Current</th>
              <th className="text-right">New</th>
            </tr>
          </thead>
          <tbody>
            {preview.products.map((p) => {
              const changed =
                p.newMinCents !== p.currentMinCents || p.newMaxCents !== p.currentMaxCents;
              return (
                <tr key={p.productId}>
                  <td>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-base-content text-xs">
                      {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
                    </p>
                  </td>
                  <td className="text-right tabular-nums">
                    <span className="text-base-content text-sm">
                      {priceRange(p.currentMinCents, p.currentMaxCents)}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">
                    <span
                      className={
                        changed ? 'text-module text-sm font-medium' : 'text-base-content text-sm'
                      }
                    >
                      {priceRange(p.newMinCents, p.newMaxCents)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function priceRange(minCents: number | null, maxCents: number | null): string {
  if (minCents == null) return '—';
  if (maxCents == null || minCents === maxCents) return money(minCents);
  return `${money(minCents)}–${money(maxCents)}`;
}
