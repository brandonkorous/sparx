'use client';

import * as React from 'react';

import { Button, Input, Stack, Text } from '@sparx/ui';

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
      <Stack direction="row" align="center" gap={2} wrap>
        <Stack gap={0} className="min-w-0">
          <Text size="sm" className="font-medium">
            {variant.title ?? variant.sku}
          </Text>
          <Text size="xs" variant="muted" className="font-mono">
            {variant.sku}
          </Text>
        </Stack>
        <Button variant="ghost" size="sm" type="button" onClick={onClear}>
          Change
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap={1}>
      <Stack direction="row" gap={2} align="center">
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
      </Stack>
      {error && (
        <Text size="xs" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}
