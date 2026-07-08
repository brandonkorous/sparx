'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { Badge, Button, EmptyState, Input, Label, Table } from 'silicaui-react';
import { RadioGroup, RadioGroupItem } from '@sparx/ui';

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

  function onAddEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const variantId = stringOr(form.get('variantId'), '');
    if (!variantId) {
      setError('Pick a variant');
      return;
    }
    const minQuantity = Number(stringOr(form.get('minQuantity'), '1')) || 1;
    const maxRaw = stringOr(form.get('maxQuantity'), '');
    const maxQuantity = maxRaw ? Number(maxRaw) : undefined;

    let fixedPriceCents: number | undefined;
    let percentOffList: number | undefined;
    if (mode === 'fixed') {
      const dollars = Number(stringOr(form.get('fixedPrice'), '0'));
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setError('Fixed price must be positive');
        return;
      }
      fixedPriceCents = Math.round(dollars * 100);
    } else {
      const percent = Number(stringOr(form.get('percentOff'), '0'));
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        setError('Percent off must be 1-100');
        return;
      }
      percentOffList = percent;
    }

    startTransition(async () => {
      const result = await setPriceListEntryAction({
        priceListId,
        variantId,
        minQuantity,
        maxQuantity,
        fixedPriceCents: fixedPriceCents ?? null,
        percentOffList: percentOffList ?? null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      (e.target as HTMLFormElement).reset();
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
      <form onSubmit={onAddEntry}>
        <div className="flex flex-row flex-wrap items-end gap-3 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
          <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
            <p className="text-base-content/70 text-xs">Variant</p>
            <select
              name="variantId"
              defaultValue=""
              className="h-9 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm"
            >
              <option value="">— pick —</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.productTitle} · {v.sku}
                  {v.title ? ` (${v.title})` : ''} — base {moneyFmt.format(v.basePriceCents / 100)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base-content/70 text-xs">Mode</p>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as 'fixed' | 'percent')}
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
            <div className="flex w-[8rem] flex-col gap-1">
              <p className="text-base-content/70 text-xs">Fixed ($)</p>
              <Input name="fixedPrice" defaultValue="" placeholder="0.00" />
            </div>
          ) : (
            <div className="flex w-[8rem] flex-col gap-1">
              <p className="text-base-content/70 text-xs">Percent off</p>
              <Input name="percentOff" defaultValue="" placeholder="10" />
            </div>
          )}
          <div className="flex w-[6rem] flex-col gap-1">
            <p className="text-base-content/70 text-xs">Min qty</p>
            <Input name="minQuantity" defaultValue="1" />
          </div>
          <div className="flex w-[6rem] flex-col gap-1">
            <p className="text-base-content/70 text-xs">Max qty</p>
            <Input name="maxQuantity" defaultValue="" placeholder="any" />
          </div>
          <Button color="module" type="submit" size="sm" disabled={pending}>
            {pending ? 'Saving…' : 'Add'}
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
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

function stringOr(value: FormDataEntryValue | null, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}
