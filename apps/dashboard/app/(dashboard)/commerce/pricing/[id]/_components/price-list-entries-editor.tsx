'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
  Table,
} from '@wizeworks/silicaui-react';
import { RadioGroup, RadioGroupItem } from '@sparx/ui';
import { useFieldValidation } from '@sparx/forms';

import { deletePriceListEntryAction, setPriceListEntryAction } from '../../../pricing-actions';

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export interface VariantSummary {
  id: string;
  sku: string;
  title: string | null;
  basePriceCents: number;
  productTitle: string;
}

export interface EntryRow {
  id: string;
  variantId: string;
  variantSku: string;
  productTitle: string;
  fixedPriceCents: number | null;
  percentOffList: number | null;
  minQuantity: number;
  maxQuantity: number | null;
}

export function PriceListEntriesEditor({
  priceListId,
  entries,
  variants,
}: {
  priceListId: string;
  entries: EntryRow[];
  variants: VariantSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'fixed' | 'percent'>('fixed');

  const [variantId, setVariantId] = React.useState('');
  const [fixedPrice, setFixedPrice] = React.useState('');
  const [percentOff, setPercentOff] = React.useState('');
  const [minQuantity, setMinQuantity] = React.useState('1');
  const [maxQuantity, setMaxQuantity] = React.useState('');

  // Field validation. A variant is required; the override value is validated for
  // the active mode (fixed price > 0, or percent off 1–100).
  const values = { variantId, fixedPrice, percentOff };
  const v = useFieldValidation(values, {
    variantId: (val) => (String(val).trim() === '' ? 'Pick a variant.' : null),
    fixedPrice: (val) => {
      if (mode !== 'fixed') return null;
      const n = Number(String(val).trim());
      return Number.isFinite(n) && n > 0 ? null : 'Fixed price must be greater than 0.';
    },
    percentOff: (val) => {
      if (mode !== 'percent') return null;
      const n = Number(String(val).trim());
      return Number.isFinite(n) && n > 0 && n <= 100
        ? null
        : 'Percent off must be between 1 and 100.';
    },
  });

  function resetEntry() {
    setVariantId('');
    setFixedPrice('');
    setPercentOff('');
    setMinQuantity('1');
    setMaxQuantity('');
  }

  function onAddEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;

    const min = Number(minQuantity.trim() || '1') || 1;
    const maxRaw = maxQuantity.trim();
    const max = maxRaw ? Number(maxRaw) : undefined;

    const fixedPriceCents =
      mode === 'fixed' ? Math.round(Number(fixedPrice.trim()) * 100) : undefined;
    const percentOffList = mode === 'percent' ? Number(percentOff.trim()) : undefined;

    startTransition(async () => {
      const result = await setPriceListEntryAction({
        priceListId,
        variantId,
        minQuantity: min,
        maxQuantity: max,
        fixedPriceCents: fixedPriceCents ?? null,
        percentOffList: percentOffList ?? null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      resetEntry();
      router.refresh();
    });
  }

  function onDelete(entryId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deletePriceListEntryAction(entryId, priceListId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onAddEntry} noValidate>
        <div className="border-base-300 bg-base-200 flex flex-row flex-wrap items-end gap-3 rounded border p-3">
          <Field {...v.field('variantId')} className="min-w-[16rem] flex-1">
            <FieldLabel required>Variant</FieldLabel>
            <FieldControl
              name="variantId"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              {...v.control('variantId')}
              render={
                <select className="border-base-300 bg-base-100 h-9 rounded border px-3 text-sm">
                  <option value="">— pick —</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.productTitle} · {variant.sku}
                      {variant.title ? ` (${variant.title})` : ''} — base{' '}
                      {moneyFmt.format(variant.basePriceCents / 100)}
                    </option>
                  ))}
                </select>
              }
            />
          </Field>
          <div className="flex flex-col gap-1">
            <p className="text-base-content/70 text-xs">Mode</p>
            <RadioGroup
              value={mode}
              onValueChange={(val) => setMode(val as 'fixed' | 'percent')}
              className="flex flex-row gap-2"
            >
              <Label htmlFor="mode-fixed" className="flex items-center gap-1">
                <RadioGroupItem color="module" value="fixed" id="mode-fixed" />
                <p className="text-sm">Fixed</p>
              </Label>
              <Label htmlFor="mode-percent" className="flex items-center gap-1">
                <RadioGroupItem color="module" value="percent" id="mode-percent" />
                <p className="text-sm">Percent off</p>
              </Label>
            </RadioGroup>
          </div>
          {mode === 'fixed' ? (
            <Field {...v.field('fixedPrice')} className="w-[8rem]">
              <FieldLabel>Fixed ($)</FieldLabel>
              <FieldControl
                name="fixedPrice"
                type="number"
                min="0"
                step="0.01"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
                placeholder="0.00"
                {...v.control('fixedPrice')}
              />
            </Field>
          ) : (
            <Field {...v.field('percentOff')} className="w-[8rem]">
              <FieldLabel>Percent off</FieldLabel>
              <FieldControl
                name="percentOff"
                type="number"
                min="0"
                step="1"
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                placeholder="10"
                {...v.control('percentOff')}
              />
            </Field>
          )}
          <Field className="w-[6rem]">
            <FieldLabel>Min qty</FieldLabel>
            <FieldControl
              name="minQuantity"
              type="number"
              min="1"
              step="1"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
            />
          </Field>
          <Field className="w-[6rem]">
            <FieldLabel>Max qty</FieldLabel>
            <FieldControl
              name="maxQuantity"
              type="number"
              min="1"
              step="1"
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(e.target.value)}
              placeholder="any"
            />
          </Field>
          <Button color="module" type="submit" size="sm" disabled={pending}>
            {pending ? 'Saving…' : 'Add'}
          </Button>
        </div>
        {error && (
          <FieldStatus
            status="error"
            attached={false}
            role="alert"
            aria-live="polite"
            className="mt-2"
          >
            {error}
          </FieldStatus>
        )}
      </form>

      {entries.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">$</span>}
          title="No entries yet"
          description="Add a per-variant override above. Variants without an entry fall back to the locked resolution chain."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Override</th>
              <th>Quantity range</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className="font-mono text-xs">{entry.variantSku}</span>
                </td>
                <td>{entry.productTitle}</td>
                <td>
                  {entry.fixedPriceCents !== null ? (
                    <Badge color="info" variant="soft" size="sm">
                      {moneyFmt.format(entry.fixedPriceCents / 100)} fixed
                    </Badge>
                  ) : (
                    <Badge color="info" variant="soft" size="sm">
                      {entry.percentOffList}% off
                    </Badge>
                  )}
                </td>
                <td>
                  {entry.minQuantity}
                  {entry.maxQuantity !== null ? `–${entry.maxQuantity}` : '+'}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(entry.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
