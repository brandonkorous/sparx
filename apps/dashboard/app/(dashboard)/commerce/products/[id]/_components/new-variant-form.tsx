'use client';

import * as React from 'react';

import { Button, Checkbox, Input, Label, NativeSelect } from 'silicaui-react';

import { createVariantAction } from '../../../variant-actions';

import type { OptionRow } from './variants-panel';

interface Props {
  productId: string;
  options: OptionRow[];
  onCreated: () => void;
  onCancel: () => void;
}

// Single-variant create form. For products with options, the merchant
// picks one value per option (the service requires the set to span the
// whole lattice). For option-less products, the form drops to just SKU +
// price + policy.

export function NewVariantForm({ productId, options, onCreated, onCancel }: Props) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // One <NativeSelect> per option; tracks the currently picked value id.
  const [picked, setPicked] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const o of options) {
      if (o.values[0]) initial[o.id] = o.values[0].id;
    }
    return initial;
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const sku = stringField(form.get('sku')).trim();
    const priceCentsRaw = stringField(form.get('priceCents')).trim();
    const priceCents = Number.parseInt(priceCentsRaw, 10);
    const inventoryPolicy = stringField(form.get('inventoryPolicy'), 'deny');
    const isDefault = form.get('isDefault') === 'on';
    const barcode = stringField(form.get('barcode')).trim();

    if (!sku) {
      setFieldErrors({ sku: 'SKU is required.' });
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setFieldErrors({ priceCents: 'Price (cents) must be a non-negative integer.' });
      return;
    }
    if (options.length > 0) {
      const missing = options.filter((o) => !picked[o.id]);
      if (missing.length > 0) {
        setFieldErrors({
          options: `Pick a value for: ${missing.map((o) => o.name).join(', ')}`,
        });
        return;
      }
    }

    const payload = {
      sku,
      priceCents,
      inventoryPolicy,
      isDefault,
      ...(barcode && barcode.length > 0 ? { barcode } : {}),
      optionValueIds: options.map((o) => picked[o.id]!).filter(Boolean),
    };

    startTransition(async () => {
      const result = await createVariantAction(productId, payload);
      if (!result.ok) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
          const fe: Record<string, string> = {};
          for (const d of result.error.details) fe[d.field] = d.message;
          setFieldErrors(fe);
        }
        setError(result.error.message);
        return;
      }
      onCreated();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-lg font-semibold">New variant</h4>
          <p className="text-base-content/70 text-sm">
            {options.length === 0
              ? 'This product has no options — fill the SKU + price to add the default purchasable row.'
              : 'Pick one value per option, then set SKU + price.'}
          </p>
        </div>

        {options.length > 0 && (
          <div className="flex flex-col gap-3">
            {options.map((o) => (
              <div key={o.id} className="flex flex-col gap-2">
                <Label htmlFor={`pick-${o.id}`}>{o.name}</Label>
                <NativeSelect
                  id={`pick-${o.id}`}
                  value={picked[o.id] ?? ''}
                  onChange={(e) => setPicked((p) => ({ ...p, [o.id]: e.target.value }))}
                >
                  {o.values.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.value}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ))}
            {fieldErrors.options && <p className="text-danger text-xs">{fieldErrors.options}</p>}
          </div>
        )}

        <div className="flex flex-row gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" name="sku" required placeholder="TS-RED-S" />
            {fieldErrors.sku && <p className="text-danger text-xs">{fieldErrors.sku}</p>}
          </div>
          <div className="flex w-40 flex-col gap-2">
            <Label htmlFor="priceCents">Price (cents)</Label>
            <Input
              id="priceCents"
              name="priceCents"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              placeholder="1999"
            />
            {fieldErrors.priceCents && (
              <p className="text-danger text-xs">{fieldErrors.priceCents}</p>
            )}
          </div>
        </div>

        <div className="flex flex-row gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="barcode">Barcode (optional)</Label>
            <Input id="barcode" name="barcode" placeholder="UPC / EAN / GTIN" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="inventoryPolicy">Inventory policy</Label>
            <NativeSelect id="inventoryPolicy" name="inventoryPolicy" defaultValue="deny">
              <option value="deny">Deny when out</option>
              <option value="continue">Continue selling</option>
              <option value="preorder">Preorder</option>
            </NativeSelect>
          </div>
        </div>

        <div className="flex flex-row items-center gap-2">
          <Checkbox color="module" id="isDefault" name="isDefault" />
          <Label htmlFor="isDefault">Make this the default variant</Label>
        </div>

        {error && (
          <p className="text-danger text-sm" role="alert" aria-live="polite">
            {error}
          </p>
        )}

        <div className="flex flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="module" disabled={pending} loading={pending}>
            Add variant
          </Button>
        </div>
      </div>
    </form>
  );
}

// FormData.get() returns string | File | null. We only ever submit text
// fields here, but the union forces a guard before .trim() — otherwise
// typescript-eslint's no-base-to-string flags it. This helper centralizes
// the narrowing.
function stringField(value: FormDataEntryValue | null, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
