'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardBody, Input, Label, NativeSelect } from '@wizeworks/silicaui-react';

import { lookupVariantBySkuAction } from '../../_lib/supplier-actions';
import { ACTOR_OPTIONS, REASON_OPTIONS } from './types';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export interface MovementFilterState {
  warehouseId: string;
  reason: string;
  actorType: string;
  from: string;
  to: string;
  sku: string;
  variantId: string;
  view: string;
}

// Filter controls for the movement / audit-log viewer (docs/99 D5): variant (by
// SKU), warehouse, reason, actor, and a created-at date range. Server-side
// filtering — Apply builds the query string and navigates; the page reads it.
// SKU resolves to a variant id on apply; an unchanged SKU reuses the current id.

export function MovementsFilterBar({
  warehouses,
  current,
}: {
  warehouses: WarehouseOption[];
  current: MovementFilterState;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sku, setSku] = React.useState(current.sku);
  const [warehouseId, setWarehouseId] = React.useState(current.warehouseId);
  const [reason, setReason] = React.useState(current.reason);
  const [actorType, setActorType] = React.useState(current.actorType);
  const [from, setFrom] = React.useState(current.from);
  const [to, setTo] = React.useState(current.to);

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
    if (reason) qs.set('reason', reason);
    if (actorType) qs.set('actor_type', actorType);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (variantId) {
      qs.set('variant_id', variantId);
      if (skuParam) qs.set('sku', skuParam);
    }
    if (current.view) qs.set('view', current.view);
    router.push(`/inventory/movements?${qs.toString()}`);
  }

  function clear() {
    router.push(
      current.view ? `/inventory/movements?view=${current.view}` : '/inventory/movements'
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex flex-row flex-wrap items-end gap-3">
            <Field label="Item SKU" className="min-w-[12rem] flex-1">
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void apply();
                  }
                }}
                placeholder="All items"
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
            <Field label="Reason" className="min-w-[10rem]">
              <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASON_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Actor" className="min-w-[9rem]">
              <NativeSelect value={actorType} onChange={(e) => setActorType(e.target.value)}>
                {ACTOR_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex flex-row flex-wrap items-end gap-3">
            <Field label="From" className="min-w-[9rem]">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To" className="min-w-[9rem]">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div className="ml-auto flex flex-row items-center gap-2">
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button variant="ghost" size="sm" onClick={clear} disabled={busy}>
                Clear
              </Button>
              <Button color="module" size="sm" onClick={() => void apply()} disabled={busy}>
                {busy ? 'Applying…' : 'Apply filters'}
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
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
    <div className={`flex flex-col gap-1${className ? ` ${className}` : ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
