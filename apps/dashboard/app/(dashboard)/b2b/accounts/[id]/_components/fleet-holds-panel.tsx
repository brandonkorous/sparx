'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Input,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

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
    <Stack gap={4}>
      {/* Create form */}
      <Stack
        gap={3}
        className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3"
      >
        <Stack direction="row" gap={2} align="end" wrap>
          <Stack gap={1} className="min-w-[12rem] flex-1">
            <Text size="xs" variant="muted">
              SKU
            </Text>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. INJ-67C"
            />
          </Stack>
          <Button variant="outline" size="sm" onClick={check} disabled={pending || !sku.trim()}>
            Check availability
          </Button>
        </Stack>

        {avail ? (
          <Stack direction="row" gap={3} wrap align="end">
            <Text size="sm">
              <span className="font-medium">{avail.title ?? avail.sku}</span> — {avail.available}{' '}
              available
              {avail.heldForAccount > 0 ? `, ${avail.heldForAccount} already held` : ''}
              {avail.minOrderQty !== null || avail.maxOrderQty !== null
                ? ` (limits ${avail.minOrderQty ?? 1}–${avail.maxOrderQty ?? '∞'})`
                : ''}
            </Text>
            <Stack gap={1} className="w-24">
              <Text size="xs" variant="muted">
                Qty
              </Text>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Stack>
            <Stack gap={1} className="min-w-[10rem] flex-1">
              <Text size="xs" variant="muted">
                Work order
              </Text>
              <Input
                value={workOrderRef}
                onChange={(e) => setWorkOrderRef(e.target.value)}
                placeholder="e.g. WO-1042"
              />
            </Stack>
            <Button color="module" size="sm" onClick={place} disabled={pending}>
              {pending ? 'Placing…' : 'Place hold'}
            </Button>
          </Stack>
        ) : null}

        {error ? (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        ) : null}
      </Stack>

      {/* Holds list */}
      {holds.length === 0 ? (
        <Text size="sm" variant="muted">
          No fleet holds yet. Check a SKU above to reserve stock for a work order.
        </Text>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Work order</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holds.map((h) => (
              <TableRow key={h.id}>
                <TableCell>
                  {h.title ?? h.sku ?? '—'}
                  <Text size="xs" variant="muted" className="font-mono">
                    {h.sku} · {h.warehouseCode}
                  </Text>
                </TableCell>
                <TableCell>{h.workOrderRef}</TableCell>
                <TableCell className="text-right">{h.quantity}</TableCell>
                <TableCell>
                  <Badge color={STATUS_COLOR[h.status] ?? 'neutral'} variant="soft">
                    {h.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {h.status === 'active' ? (
                    <Stack direction="row" gap={2} justify="end">
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
                    </Stack>
                  ) : (
                    <Text size="xs" variant="muted">
                      —
                    </Text>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
