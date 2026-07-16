'use client';

import * as React from 'react';

import { Button, Input } from '@wizeworks/silicaui-react';

import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';

// Resolve a sparx variant by SKU — shared by the unmapped-SKU map form and the
// mappings panel's add form. Renders a compact "enter SKU → Find" control; once
// resolved it shows the variant chip with a "Change" affordance. Lifts the
// resolved variant to the parent via `onResolve`.

export interface PickedVariant {
  variantId: string;
  sku: string;
  title: string | null;
}

interface VariantPickerProps {
  variant: PickedVariant | null;
  onResolve: (v: PickedVariant) => void;
  onClear: () => void;
  /** Pre-fill the SKU input (e.g. the external SKU, a likely match). */
  defaultSku?: string;
}

export function VariantPicker({ variant, onResolve, onClear, defaultSku }: VariantPickerProps) {
  const [value, setValue] = React.useState(defaultSku ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function resolve() {
    const sku = value.trim();
    if (!sku) {
      setError('Enter a variant SKU.');
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      const lookup = await lookupVariantBySkuAction(sku);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${sku}".`);
        setBusy(false);
        return;
      }
      onResolve({
        variantId: lookup.data.variantId,
        sku: lookup.data.sku,
        title: lookup.data.productTitle,
      });
      setBusy(false);
    })();
  }

  if (variant) {
    return (
      <div className="flex flex-row flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0">
          <p className="text-sm font-medium">{variant.title ?? variant.sku}</p>
          <p className="text-base-content font-mono text-xs">{variant.sku}</p>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={onClear}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              resolve();
            }
          }}
          placeholder="Map to SKU…"
          className="max-w-[16rem]"
        />
        <Button color="module" size="sm" type="button" onClick={resolve} disabled={busy}>
          {busy ? 'Finding…' : 'Find'}
        </Button>
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
