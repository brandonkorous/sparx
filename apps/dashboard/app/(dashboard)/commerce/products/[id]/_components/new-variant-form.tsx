'use client';

import * as React from 'react';

import {
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

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
  const [optionsError, setOptionsError] = React.useState<string | null>(null);

  const [sku, setSku] = React.useState('');
  const [priceCents, setPriceCents] = React.useState('');
  const [barcode, setBarcode] = React.useState('');
  const [inventoryPolicy, setInventoryPolicy] = React.useState('deny');
  const [isDefault, setIsDefault] = React.useState(false);

  // One <NativeSelect> per option; tracks the currently picked value id.
  const [picked, setPicked] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const o of options) {
      if (o.values[0]) initial[o.id] = o.values[0].id;
    }
    return initial;
  });

  const v = useFieldValidation(
    { sku, priceCents },
    {
      sku: rule.required('SKU is required.'),
      priceCents: (val) => {
        const s = String(val ?? '').trim();
        if (s === '') return 'Price is required.';
        const n = Number(s);
        if (!Number.isFinite(n)) return 'Enter a whole number of cents.';
        if (n < 0) return 'Price cannot be negative.';
        if (!Number.isInteger(n)) return 'Enter a whole number of cents.';
        return null;
      },
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOptionsError(null);

    if (!v.validate()) return;

    if (options.length > 0) {
      const missing = options.filter((o) => !picked[o.id]);
      if (missing.length > 0) {
        setOptionsError(`Pick a value for: ${missing.map((o) => o.name).join(', ')}`);
        return;
      }
    }

    const price = Number.parseInt(priceCents, 10);
    const trimmedBarcode = barcode.trim();

    const payload = {
      sku: sku.trim(),
      priceCents: price,
      inventoryPolicy,
      isDefault,
      ...(trimmedBarcode.length > 0 ? { barcode: trimmedBarcode } : {}),
      optionValueIds: options.map((o) => picked[o.id]!).filter(Boolean),
    };

    startTransition(async () => {
      const result = await createVariantAction(productId, payload);
      if (!result.ok) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
          const known = new Set(['sku', 'priceCents']);
          const map = Object.fromEntries(
            result.error.details.filter((d) => known.has(d.field)).map((d) => [d.field, d.message])
          );
          if (Object.keys(map).length > 0) v.setServerErrors(map);
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
              <Field key={o.id}>
                <FieldLabel>{o.name}</FieldLabel>
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
              </Field>
            ))}
            {optionsError && (
              <FieldStatus status="error" attached={false}>
                {optionsError}
              </FieldStatus>
            )}
          </div>
        )}

        <div className="flex flex-row gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Field {...v.field('sku')}>
              <FieldLabel required>SKU</FieldLabel>
              <FieldControl
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="TS-RED-S"
                {...v.control('sku')}
              />
            </Field>
          </div>
          <div className="flex w-40 flex-col gap-2">
            <Field {...v.field('priceCents')}>
              <FieldLabel required>Price (cents)</FieldLabel>
              <FieldControl
                id="priceCents"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                placeholder="1999"
                {...v.control('priceCents')}
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-row gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Field>
              <FieldLabel>Barcode (optional)</FieldLabel>
              <FieldControl
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="UPC / EAN / GTIN"
              />
            </Field>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Field>
              <FieldLabel>Inventory policy</FieldLabel>
              <NativeSelect
                id="inventoryPolicy"
                value={inventoryPolicy}
                onChange={(e) => setInventoryPolicy(e.target.value)}
              >
                <option value="deny">Deny when out</option>
                <option value="continue">Continue selling</option>
                <option value="preorder">Preorder</option>
              </NativeSelect>
            </Field>
          </div>
        </div>

        <div className="flex flex-row items-center gap-2">
          <Checkbox
            color="module"
            id="isDefault"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <FieldLabel htmlFor="isDefault">Make this the default variant</FieldLabel>
        </div>

        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
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
