'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardActions,
  CardBody,
  Input,
  Label,
} from '@wizeworks/silicaui-react';

import {
  addTransferLineAction,
  receiveTransferAction,
  removeTransferLineAction,
  updateTransferLineAction,
} from '../../../_lib/transfer-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';
import type { InventoryTransferLineRow } from '../../_components/types';

// The transfer lines surface (docs/100 P4). While `draft` the lines are editable
// (add by SKU, change quantity, remove). While `in_transit` it becomes a receive
// form — a received quantity per line (default = shipped; a short receipt is
// written off in transit). Once received/cancelled it's read-only.

export function TransferLinesPanel({
  id,
  status,
  lines,
}: {
  id: string;
  status: string;
  lines: InventoryTransferLineRow[];
}) {
  if (status === 'draft') return <DraftLines id={id} lines={lines} />;
  if (status === 'in_transit') return <ReceiveLines id={id} lines={lines} />;
  return <ReadonlyLines lines={lines} />;
}

// ─── Draft: editable lines ───────────────────────────────────────────────────────

function DraftLines({ id, lines }: { id: string; lines: InventoryTransferLineRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function saveQuantity(lineId: string, quantity: number): void {
    setError(null);
    startTransition(async () => {
      const result = await updateTransferLineAction(id, lineId, { quantity });
      if (!result.ok) setError(result.error.message);
      else router.refresh();
    });
  }

  function removeLine(lineId: string): void {
    setError(null);
    startTransition(async () => {
      const result = await removeTransferLineAction(id, lineId);
      if (!result.ok) setError(result.error.message);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-xl font-semibold">Lines</h3>
        <div className="flex flex-col gap-2">
          {lines.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              No lines on this transfer yet — add a SKU below.
            </p>
          ) : (
            lines.map((l) => (
              <DraftLineRow
                key={l.id}
                line={l}
                disabled={pending}
                onSaveQuantity={(q) => saveQuantity(l.id, q)}
                onRemove={() => removeLine(l.id)}
              />
            ))
          )}
          <AddLineRow id={id} disabled={pending} />
        </div>
        {error && (
          <CardActions className="justify-start">
            <p className="text-danger text-sm">{error}</p>
          </CardActions>
        )}
      </CardBody>
    </Card>
  );
}

function DraftLineRow({
  line: l,
  disabled,
  onSaveQuantity,
  onRemove,
}: {
  line: InventoryTransferLineRow;
  disabled: boolean;
  onSaveQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const [armed, setArmed] = React.useState(false);
  const [value, setValue] = React.useState(String(l.quantity));

  function commit(): void {
    const q = Math.max(1, Math.round(Number(value)));
    if (Number.isFinite(q) && q !== l.quantity) onSaveQuantity(q);
    else setValue(String(l.quantity));
  }

  return (
    <div className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2">
      <LineIdentity line={l} />
      <div className="flex w-[5.5rem] flex-col gap-0">
        <Label htmlFor={`qty-${l.id}`} className="sr-only">
          Quantity
        </Label>
        <Input
          id={`qty-${l.id}`}
          type="number"
          min={1}
          value={value}
          disabled={disabled}
          aria-label="Quantity"
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
        />
      </div>
      {armed ? (
        <div className="flex flex-row items-center gap-1">
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setArmed(false)}>
            Keep
          </Button>
          <Button color="danger" size="sm" disabled={disabled} onClick={onRemove}>
            Remove
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setArmed(true)}>
          Remove
        </Button>
      )}
    </div>
  );
}

// ─── In transit: receive form ────────────────────────────────────────────────────

function ReceiveLines({ id, lines }: { id: string; lines: InventoryTransferLineRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [received, setReceived] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, String(l.quantity)]))
  );

  function receive(): void {
    setError(null);
    const payload = lines.map((l) => ({
      lineId: l.id,
      receivedQuantity: clampReceived(received[l.id], l.quantity),
    }));
    startTransition(async () => {
      const result = await receiveTransferAction(id, { lines: payload });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  const short = lines.some((l) => clampReceived(received[l.id], l.quantity) < l.quantity);

  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold">Receive</h3>
          <p className="text-base-content/70 text-sm">
            Confirm what arrived at the destination. A quantity short of what shipped is written off
            in transit.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((l) => (
            <div
              key={l.id}
              className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2"
            >
              <LineIdentity line={l} />
              <Stat label="Shipped" value={String(l.quantity)} />
              <div className="flex w-[6rem] flex-col gap-0">
                <Label htmlFor={`rcv-${l.id}`} className="sr-only">
                  Received
                </Label>
                <Input
                  id={`rcv-${l.id}`}
                  type="number"
                  min={0}
                  max={l.quantity}
                  value={received[l.id] ?? ''}
                  aria-label="Received quantity"
                  onChange={(e) => setReceived((prev) => ({ ...prev, [l.id]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>
        <CardActions>
          <div className="flex w-full flex-row items-center justify-between gap-3">
            {error ? (
              <p className="text-danger text-sm">{error}</p>
            ) : short ? (
              <p className="text-base-content/70 text-sm">
                Some lines are short — the difference is written off in transit.
              </p>
            ) : (
              <span />
            )}
            <Button color="module" disabled={pending} onClick={receive}>
              {pending ? 'Receiving…' : 'Receive transfer'}
            </Button>
          </div>
        </CardActions>
      </CardBody>
    </Card>
  );
}

// ─── Received / cancelled: read-only ─────────────────────────────────────────────

function ReadonlyLines({ lines }: { lines: InventoryTransferLineRow[] }) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-xl font-semibold">Lines</h3>
        <div className="flex flex-col gap-2">
          {lines.map((l) => {
            const short =
              l.receivedQuantity !== null && l.receivedQuantity < l.quantity
                ? l.quantity - l.receivedQuantity
                : 0;
            return (
              <div
                key={l.id}
                className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2"
              >
                <LineIdentity line={l} />
                <Stat label="Shipped" value={String(l.quantity)} />
                <Stat
                  label="Received"
                  value={l.receivedQuantity === null ? '—' : String(l.receivedQuantity)}
                />
                {short > 0 ? (
                  <Badge color="warning" variant="soft">
                    {short} short
                  </Badge>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────────

function LineIdentity({ line: l }: { line: InventoryTransferLineRow }) {
  return (
    <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
      <p className="text-sm font-medium">
        {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
      </p>
      <p className="text-base-content/70 font-mono text-xs">{l.variantSku ?? l.variantId}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[5rem] flex-col gap-0 text-right">
      <p className="text-base-content/70 text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function clampReceived(raw: string | undefined, shipped: number): number {
  const n = Math.round(Number(raw ?? ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, shipped);
}

function AddLineRow({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [sku, setSku] = React.useState('');
  const [qty, setQty] = React.useState('1');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function add(): void {
    const code = sku.trim();
    if (!code) {
      setError('Enter a variant SKU.');
      return;
    }
    const quantity = Math.max(1, Math.round(Number(qty)));
    setError(null);
    setBusy(true);
    void (async () => {
      const lookup = await lookupVariantBySkuAction(code);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${code}".`);
        setBusy(false);
        return;
      }
      const result = await addTransferLineAction(id, {
        variantId: lookup.data.variantId,
        quantity,
      });
      if (!result.ok) {
        setError(result.error.message);
        setBusy(false);
        return;
      }
      setSku('');
      setQty('1');
      setBusy(false);
      router.refresh();
    })();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-base-300 flex flex-row flex-wrap items-end gap-3 rounded border border-dashed p-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="transfer-line-sku">Add item by SKU</Label>
          <Input
            id="transfer-line-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. FUEL-FILTER-1"
          />
        </div>
        <div className="flex w-[5.5rem] flex-col gap-1">
          <Label htmlFor="transfer-line-qty">Qty</Label>
          <Input
            id="transfer-line-qty"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
