'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, Input, Label, NativeSelect, Stack, Text } from '@sparx/ui';

import { lookupVariantBySkuAction } from '../../_lib/supplier-actions';
import { RECALL_FILTER_OPTIONS } from './types';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export interface LotFilterState {
  warehouseId: string;
  recallStatus: string;
  expiring: boolean;
  q: string;
  sku: string;
  variantId: string;
  view: string;
}

// Filter controls for the lot list (docs/100 P4d): item (by SKU), warehouse, lot
// number, recall state, and an expiring-soon toggle. Server-side filtering — Apply
// builds the query string and navigates; the page reads it. SKU resolves to a
// variant id on apply; an unchanged SKU reuses the current id.

export function LotsFilterBar({
  warehouses,
  current,
}: {
  warehouses: WarehouseOption[];
  current: LotFilterState;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sku, setSku] = React.useState(current.sku);
  const [q, setQ] = React.useState(current.q);
  const [warehouseId, setWarehouseId] = React.useState(current.warehouseId);
  const [recallStatus, setRecallStatus] = React.useState(current.recallStatus);
  const [expiring, setExpiring] = React.useState(current.expiring);

  async function apply() {
    setError(null);
    let variantId = current.variantId;
    let skuParam = sku.trim();
    if (skuParam === '') {
      variantId = '';
    } else if (skuParam !== current.sku) {
      setBusy(true);
      const lookup = await lookupVariantBySkuAction(skuParam);
      setBusy(false);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${skuParam}".`);
        return;
      }
      variantId = lookup.data.variantId;
      skuParam = lookup.data.sku;
    }

    const qs = new URLSearchParams();
    if (warehouseId) qs.set('warehouse_id', warehouseId);
    if (recallStatus) qs.set('recall_status', recallStatus);
    if (expiring) qs.set('expiring', '1');
    if (q.trim()) qs.set('q', q.trim());
    if (variantId) {
      qs.set('variant_id', variantId);
      if (skuParam) qs.set('sku', skuParam);
    }
    if (current.view) qs.set('view', current.view);
    router.push(`/inventory/lots?${qs.toString()}`);
  }

  function clear() {
    router.push(current.view ? `/inventory/lots?view=${current.view}` : '/inventory/lots');
  }

  return (
    <Card>
      <CardContent>
        <Stack gap={3}>
          <Stack direction="row" gap={3} align="end" wrap>
            <Field label="Item SKU" className="min-w-[11rem] flex-1">
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                onKeyDown={onEnter(() => void apply())}
                placeholder="All items"
              />
            </Field>
            <Field label="Lot number" className="min-w-[10rem] flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onEnter(() => void apply())}
                placeholder="Any lot"
              />
            </Field>
            <Field label="Warehouse" className="min-w-[11rem] flex-1">
              <NativeSelect value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Recall" className="min-w-[10rem]">
              <NativeSelect value={recallStatus} onChange={(e) => setRecallStatus(e.target.value)}>
                {RECALL_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || 'any'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </Stack>
          <Stack direction="row" gap={3} align="center" wrap>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={expiring}
                onChange={(e) => setExpiring(e.target.checked)}
              />
              Expiring within a year
            </label>
            <Stack direction="row" gap={2} align="center" className="ml-auto">
              {error && (
                <Text size="sm" className="text-[var(--color-danger)]">
                  {error}
                </Text>
              )}
              <Button variant="ghost" size="sm" onClick={clear} disabled={busy}>
                Clear
              </Button>
              <Button color="module" size="sm" onClick={() => void apply()} disabled={busy}>
                {busy ? 'Applying…' : 'Apply filters'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function onEnter(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fn();
    }
  };
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={1} className={className}>
      <Label>{label}</Label>
      {children}
    </Stack>
  );
}
