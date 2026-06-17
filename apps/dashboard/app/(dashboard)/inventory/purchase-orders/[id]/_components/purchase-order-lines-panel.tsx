'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Input,
  Stack,
  Text,
} from '@sparx/ui';

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
      <CardHeader>
        <Stack gap={1}>
          <Heading level={3}>Lines</Heading>
          <CardDescription>
            {editable
              ? 'Add the variants to order by SKU; leave cost blank to use the supplier’s agreed cost.'
              : 'Ordered items. Receiving books goods against these and fills the received count.'}
          </CardDescription>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          {lines.length === 0 ? (
            <Text size="sm" variant="muted">
              No lines on this order.
            </Text>
          ) : (
            <Stack gap={2}>
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
            </Stack>
          )}

          {editable && <LineAddRow onAdd={onAdd} />}

          {error && (
            <Text size="sm" className="text-[var(--color-danger)]">
              {error}
            </Text>
          )}

          <Stack gap={1} className="ml-auto min-w-[16rem]">
            <Row label="Subtotal" value={formatMoney(summary.subtotalCents, summary.currency)} />
            {summary.shippingCents > 0 && (
              <Row label="Shipping" value={formatMoney(summary.shippingCents, summary.currency)} />
            )}
            <Row label="Total" value={formatMoney(summary.totalCents, summary.currency)} strong />
          </Stack>
        </Stack>
      </CardContent>
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
    <Stack
      direction="row"
      align="center"
      gap={3}
      wrap
      className="rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Stack gap={0} className="min-w-[12rem] flex-1">
        <Text size="sm" className="font-medium">
          {line.productTitle ?? line.description ?? line.variantSku ?? line.variantId.slice(0, 8)}
        </Text>
        <Text size="xs" variant="muted" className="font-mono">
          {line.variantSku ?? line.variantId}
          {line.supplierSku ? ` · their #${line.supplierSku}` : ''}
        </Text>
      </Stack>
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
      <Text size="sm" variant="muted" className="w-[5rem] text-right">
        {formatMoney(line.lineTotalCents, currency)}
      </Text>
      <Button color="module" variant="soft" size="sm" onClick={save} disabled={busy || !dirty}>
        Save
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
        Remove
      </Button>
      {error && (
        <Text size="xs" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function ReadOnlyLineRow({ line, currency }: { line: PurchaseOrderLineRow; currency: string }) {
  const fullyReceived = line.quantityReceived >= line.quantityOrdered;
  return (
    <Stack
      direction="row"
      align="center"
      gap={3}
      wrap
      className="rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Stack gap={0} className="min-w-[12rem] flex-1">
        <Text size="sm" className="font-medium">
          {line.productTitle ?? line.description ?? line.variantSku ?? line.variantId.slice(0, 8)}
        </Text>
        <Text size="xs" variant="muted" className="font-mono">
          {line.variantSku ?? line.variantId}
          {line.supplierSku ? ` · their #${line.supplierSku}` : ''}
        </Text>
      </Stack>
      <Badge color={fullyReceived ? 'success' : line.quantityReceived > 0 ? 'warning' : 'neutral'}>
        {line.quantityReceived}/{line.quantityOrdered} recv
      </Badge>
      <Text size="sm" variant="muted" className="w-[6rem] text-right">
        {formatMoney(line.unitCostCents, currency)}
      </Text>
      <Text size="sm" className="w-[6rem] text-right font-medium">
        {formatMoney(line.lineTotalCents, currency)}
      </Text>
    </Stack>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justify="between" gap={2}>
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Text size="sm" className={strong ? 'font-semibold' : undefined}>
        {value}
      </Text>
    </Stack>
  );
}
