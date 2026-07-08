'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Badge, Button, Card, CardBody, Input } from 'silicaui-react';

import {
  addPurchaseOrderLineAction,
  removePurchaseOrderLineAction,
  updatePurchaseOrderLineAction,
} from '../../../_lib/purchase-order-actions';
import { LineAddRow, type ResolvedLine } from '../../_components/line-add-row';
import { formatMoney, type PurchaseOrderLineRow } from '../../_components/types';

interface Summary {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
}

// PO lines (docs/100 P3b). DRAFT → fully editable: add by SKU, edit qty/cost,
// remove. Once submitted the lines lock and show the received progress
// (quantityReceived / quantityOrdered) that receiving (P3c) fills in.

export function PurchaseOrderLinesPanel({
  id,
  lines,
  editable,
  summary,
}: {
  id: string;
  lines: PurchaseOrderLineRow[];
  editable: boolean;
  summary: Summary;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function onAdd(line: ResolvedLine) {
    setError(null);
    const result = await addPurchaseOrderLineAction(id, {
      variantId: line.variantId,
      quantity: line.quantity,
      ...(line.unitCostCents !== undefined ? { unitCostCents: line.unitCostCents } : {}),
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    refresh();
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold">Lines</h3>
          <p className="opacity-70">
            {editable
              ? 'Add the variants to order by SKU; leave cost blank to use the supplier’s agreed cost.'
              : 'Ordered items. Receiving books goods against these and fills the received count.'}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {lines.length === 0 ? (
            <p className="text-base-content/70 text-sm">No lines on this order.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {lines.map((line) =>
                editable ? (
                  <EditableLineRow
                    key={line.id}
                    poId={id}
                    line={line}
                    currency={summary.currency}
                    onChanged={refresh}
                  />
                ) : (
                  <ReadOnlyLineRow key={line.id} line={line} currency={summary.currency} />
                )
              )}
            </div>
          )}

          {editable && <LineAddRow onAdd={onAdd} />}

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="ml-auto flex min-w-[16rem] flex-col gap-1">
            <Row label="Subtotal" value={formatMoney(summary.subtotalCents, summary.currency)} />
            {summary.shippingCents > 0 && (
              <Row label="Shipping" value={formatMoney(summary.shippingCents, summary.currency)} />
            )}
            <Row label="Total" value={formatMoney(summary.totalCents, summary.currency)} strong />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function EditableLineRow({
  poId,
  line,
  currency,
  onChanged,
}: {
  poId: string;
  line: PurchaseOrderLineRow;
  currency: string;
  onChanged: () => void;
}) {
  const [qty, setQty] = React.useState(String(line.quantityOrdered));
  const [cost, setCost] = React.useState((line.unitCostCents / 100).toFixed(2));
  const [busy, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    qty !== String(line.quantityOrdered) || cost !== (line.unitCostCents / 100).toFixed(2);

  function save() {
    setError(null);
    const q = Number(qty);
    if (!Number.isInteger(q) || q <= 0) {
      setError('Quantity must be 1 or more.');
      return;
    }
    startTransition(async () => {
      const result = await updatePurchaseOrderLineAction(poId, line.id, {
        quantity: q,
        unitCostCents: Math.round(Number(cost) * 100),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onChanged();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removePurchaseOrderLineAction(poId, line.id);
      if (result.ok) onChanged();
    });
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-3 rounded border border-[var(--color-border-default)] px-3 py-2">
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
        <p className="text-sm font-medium">
          {line.productTitle ?? line.description ?? line.variantSku ?? line.variantId.slice(0, 8)}
        </p>
        <p className="text-base-content/70 font-mono text-xs">
          {line.variantSku ?? line.variantId}
          {line.supplierSku ? ` · their #${line.supplierSku}` : ''}
        </p>
      </div>
      <Input
        aria-label="Quantity"
        type="number"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="w-[5rem]"
      />
      <Input
        aria-label="Unit cost"
        type="number"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        className="w-[6rem]"
      />
      <p className="text-base-content/70 w-[5rem] text-right text-sm">
        {formatMoney(line.lineTotalCents, currency)}
      </p>
      <Button color="module" variant="soft" size="sm" onClick={save} disabled={busy || !dirty}>
        Save
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
        Remove
      </Button>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function ReadOnlyLineRow({ line, currency }: { line: PurchaseOrderLineRow; currency: string }) {
  const fullyReceived = line.quantityReceived >= line.quantityOrdered;
  return (
    <div className="flex flex-row flex-wrap items-center gap-3 rounded border border-[var(--color-border-default)] px-3 py-2">
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
        <p className="text-sm font-medium">
          {line.productTitle ?? line.description ?? line.variantSku ?? line.variantId.slice(0, 8)}
        </p>
        <p className="text-base-content/70 font-mono text-xs">
          {line.variantSku ?? line.variantId}
          {line.supplierSku ? ` · their #${line.supplierSku}` : ''}
        </p>
      </div>
      <Badge color={fullyReceived ? 'success' : line.quantityReceived > 0 ? 'warning' : 'neutral'}>
        {line.quantityReceived}/{line.quantityOrdered} recv
      </Badge>
      <p className="text-base-content/70 w-[6rem] text-right text-sm">
        {formatMoney(line.unitCostCents, currency)}
      </p>
      <p className="w-[6rem] text-right text-sm font-medium">
        {formatMoney(line.lineTotalCents, currency)}
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-row justify-between gap-2">
      <p className="text-base-content/70 text-sm">{label}</p>
      <p className={strong ? 'text-sm font-semibold' : 'text-sm'}>{value}</p>
    </div>
  );
}
