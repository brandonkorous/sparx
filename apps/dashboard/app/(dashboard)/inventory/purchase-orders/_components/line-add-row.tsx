'use client';

import * as React from 'react';

import { Button, Input, Label, Stack, Text } from '@sparx/ui';

import { lookupVariantBySkuAction } from '../../_lib/supplier-actions';

// Shared "add a line by SKU" row (docs/100 P3b). Resolves a variant by its SKU
// (the natural key buyers know) then hands the resolved line to `onAdd`. Reused
// by the create form (accumulates lines in memory) and the draft detail panel
// (persists each via the API) — the only difference is what onAdd does.

export interface ResolvedLine {
  variantId: string;
  sku: string;
  title: string | null;
  quantity: number;
  unitCostCents?: number;
}

export function LineAddRow({
  onAdd,
  disabled,
}: {
  onAdd: (line: ResolvedLine) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const sku = str(form.get('sku'));
    const quantity = Number(str(form.get('quantity')));
    const costStr = str(form.get('unitCost'));
    if (!sku) {
      setError('Enter a variant SKU.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError('Enter a quantity of 1 or more.');
      return;
    }

    setBusy(true);
    void (async () => {
      const lookup = await lookupVariantBySkuAction(sku);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${sku}".`);
        setBusy(false);
        return;
      }
      const line: ResolvedLine = {
        variantId: lookup.data.variantId,
        sku: lookup.data.sku,
        title: lookup.data.productTitle,
        quantity,
        ...(costStr ? { unitCostCents: Math.round(Number(costStr) * 100) } : {}),
      };
      await onAdd(line);
      formRef.current?.reset();
      setBusy(false);
    })();
  }

  return (
    <Stack gap={2}>
      <form ref={formRef} onSubmit={onSubmit}>
        <Stack
          direction="row"
          gap={3}
          align="end"
          wrap
          className="rounded border border-dashed border-[var(--color-border-default)] p-3"
        >
          <AddField label="Variant SKU" name="sku" placeholder="e.g. FUEL-FILTER-1" grow />
          <AddField label="Qty" name="quantity" type="number" placeholder="1" />
          <AddField label="Unit cost ($)" name="unitCost" type="number" placeholder="default" />
          <Button color="module" type="submit" disabled={busy || disabled}>
            {busy ? 'Adding…' : 'Add line'}
          </Button>
        </Stack>
      </form>
      {error && (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function AddField({
  label,
  name,
  type,
  placeholder,
  grow,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  grow?: boolean;
}) {
  return (
    <Stack gap={1} className={grow ? 'min-w-[12rem] flex-1' : 'min-w-[7rem]'}>
      <Label htmlFor={`po-add-${name}`}>{label}</Label>
      <Input id={`po-add-${name}`} name={name} type={type} placeholder={placeholder} />
    </Stack>
  );
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
