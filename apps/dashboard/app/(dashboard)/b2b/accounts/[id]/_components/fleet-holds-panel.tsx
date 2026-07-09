'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Table,
} from '@wizeworks/silicaui-react';

import {
  checkAvailabilityAction,
  createFleetHoldAction,
  releaseFleetHoldAction,
  consumeFleetHoldAction,
  type AvailabilityRow,
} from '../_lib/fleet-hold-actions';

export interface FleetHold {
  id: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  quantity: number;
  workOrderRef: string;
  note: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  released: 'neutral',
  consumed: 'warning',
};

export function FleetHoldsPanel({ accountId, holds }: { accountId: string; holds: FleetHold[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [sku, setSku] = React.useState('');
  const [variantId, setVariantId] = React.useState<string | null>(null);
  const [avail, setAvail] = React.useState<AvailabilityRow | null>(null);
  const [quantity, setQuantity] = React.useState('1');
  const [workOrderRef, setWorkOrderRef] = React.useState('');

  function check() {
    setError(null);
    setAvail(null);
    setVariantId(null);
    startTransition(async () => {
      const result = await checkAvailabilityAction(accountId, sku.trim());
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setVariantId(result.variantId);
      setAvail(result.row);
    });
  }

  function place() {
    setError(null);
    if (!variantId) return;
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setError('Enter a quantity of 1 or more.');
      return;
    }
    if (!workOrderRef.trim()) {
      setError('A work-order reference is required.');
      return;
    }
    startTransition(async () => {
      const result = await createFleetHoldAction(accountId, {
        variantId,
        quantity: qty,
        workOrderRef: workOrderRef.trim(),
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setSku('');
      setVariantId(null);
      setAvail(null);
      setQuantity('1');
      setWorkOrderRef('');
      router.refresh();
    });
  }

  function act(fn: (id: string) => Promise<{ ok: true } | { error: string }>, id: string) {
    setError(null);
    startTransition(async () => {
      const result = await fn(id);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create form */}
      <div className="border-base-300 bg-base-200 flex flex-col gap-3 rounded border p-3">
        <div className="flex flex-row flex-wrap items-end gap-2">
          <Field className="min-w-[12rem] flex-1">
            <FieldLabel>SKU</FieldLabel>
            <FieldControl
              name="sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. INJ-67C"
            />
          </Field>
          <Button variant="outline" size="sm" onClick={check} disabled={pending || !sku.trim()}>
            Check availability
          </Button>
        </div>

        {avail ? (
          <div className="flex flex-row flex-wrap items-end gap-3">
            <p className="text-sm">
              <span className="font-medium">{avail.title ?? avail.sku}</span> — {avail.available}{' '}
              available
              {avail.heldForAccount > 0 ? `, ${avail.heldForAccount} already held` : ''}
              {avail.minOrderQty !== null || avail.maxOrderQty !== null
                ? ` (limits ${avail.minOrderQty ?? 1}–${avail.maxOrderQty ?? '∞'})`
                : ''}
            </p>
            <Field className="w-24">
              <FieldLabel>Qty</FieldLabel>
              <FieldControl
                name="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field className="min-w-[10rem] flex-1">
              <FieldLabel>Work order</FieldLabel>
              <FieldControl
                name="workOrderRef"
                value={workOrderRef}
                onChange={(e) => setWorkOrderRef(e.target.value)}
                placeholder="e.g. WO-1042"
              />
            </Field>
            <Button color="module" size="sm" onClick={place} disabled={pending}>
              {pending ? 'Placing…' : 'Place hold'}
            </Button>
          </div>
        ) : null}

        {error ? (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        ) : null}
      </div>

      {/* Holds list */}
      {holds.length === 0 ? (
        <p className="text-base-content/70 text-sm">
          No fleet holds yet. Check a SKU above to reserve stock for a work order.
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Work order</th>
              <th className="text-right">Qty</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id}>
                <td>
                  {h.title ?? h.sku ?? '—'}
                  <p className="text-base-content/70 font-mono text-xs">
                    {h.sku} · {h.warehouseCode}
                  </p>
                </td>
                <td>{h.workOrderRef}</td>
                <td className="text-right">{h.quantity}</td>
                <td>
                  <Badge color={STATUS_COLOR[h.status] ?? 'neutral'} variant="soft">
                    {h.status}
                  </Badge>
                </td>
                <td className="text-right">
                  {h.status === 'active' ? (
                    <div className="flex flex-row justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => act(releaseFleetHoldAction, h.id)}
                      >
                        Release
                      </Button>
                      <Button
                        size="sm"
                        color="module"
                        variant="soft"
                        disabled={pending}
                        onClick={() => act(consumeFleetHoldAction, h.id)}
                      >
                        Consume
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base-content/70 text-xs">—</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
