'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Heading,
  Input,
  Label,
  Stack,
  Text,
} from '@sparx/ui';

import { createGoodsReceiptAction } from '../../../../_lib/goods-receipt-actions';
import { formatMoney, type PurchaseOrderLineRow } from '../../../_components/types';

interface RowState {
  lineId: string;
  label: string;
  sku: string | null;
  ordered: number;
  alreadyReceived: number;
  outstanding: number;
  qty: string;
  cost: string;
  lot: string;
}

// Receive-against-PO form (docs/100 P3c). One row per PO line, qty defaulting to
// the outstanding amount; a blank/zero qty skips the line. Cost defaults to the
// agreed line cost (overridable — it's the moving-average basis). Posting books
// the goods + advances the PO, then returns to the PO detail.

export function ReceiveForm({
  purchaseOrderId,
  purchaseOrderNumber,
  currency,
  lines,
  today,
}: {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  currency: string;
  lines: PurchaseOrderLineRow[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<RowState[]>(() =>
    lines.map((l) => {
      const outstanding = Math.max(0, l.quantityOrdered - l.quantityReceived);
      return {
        lineId: l.id,
        label: l.productTitle ?? l.description ?? l.variantSku ?? l.variantId.slice(0, 8),
        sku: l.variantSku,
        ordered: l.quantityOrdered,
        alreadyReceived: l.quantityReceived,
        outstanding,
        qty: outstanding > 0 ? String(outstanding) : '',
        cost: (l.unitCostCents / 100).toFixed(2),
        lot: '',
      };
    })
  );

  function patch(lineId: string, field: 'qty' | 'cost' | 'lot', value: string) {
    setRows((prev) => prev.map((r) => (r.lineId === lineId ? { ...r, [field]: value } : r)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const receivedDate = str(form.get('receivedAt'));

    const receiptLines = rows
      .filter((r) => Number(r.qty) > 0)
      .map((r) => ({
        purchaseOrderLineId: r.lineId,
        quantity: Number(r.qty),
        ...(r.cost ? { unitCostCents: Math.round(Number(r.cost) * 100) } : {}),
        ...(r.lot.trim() ? { lotNumber: r.lot.trim() } : {}),
      }));

    if (receiptLines.length === 0) {
      setError('Enter a received quantity on at least one line.');
      return;
    }

    const input = {
      purchaseOrderId,
      ...(receivedDate ? { receivedAt: new Date(receivedDate).toISOString() } : {}),
      ...nonEmpty('reference', form),
      ...nonEmpty('note', form),
      lines: receiptLines,
    };

    startTransition(async () => {
      const result = await createGoodsReceiptAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/purchase-orders/${purchaseOrderId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Receipt details</Heading>
            <CardDescription>
              What arrived for {purchaseOrderNumber}. A packing-slip reference + date are optional.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack direction="row" gap={3} wrap>
            <Field label="Received date" name="receivedAt" type="date" defaultValue={today} />
            <Field label="Reference" name="reference" placeholder="packing slip / carrier" />
            <Field label="Note" name="note" placeholder="optional" />
          </Stack>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Lines</Heading>
            <CardDescription>
              Quantity defaults to what&apos;s outstanding. Set a quantity to 0 to skip a line;
              enter a lot number to track the batch.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={2}>
            {rows.map((r) => (
              <Stack
                key={r.lineId}
                direction="row"
                align="center"
                gap={3}
                wrap
                className="rounded border border-[var(--color-border-default)] px-3 py-2"
              >
                <Stack gap={0} className="min-w-[12rem] flex-1">
                  <Text size="sm" className="font-medium">
                    {r.label}
                  </Text>
                  <Text size="xs" variant="muted" className="font-mono">
                    {r.sku ?? r.lineId.slice(0, 8)} · {r.alreadyReceived}/{r.ordered} received ·{' '}
                    {r.outstanding} outstanding
                  </Text>
                </Stack>
                <MiniField
                  label="Qty"
                  value={r.qty}
                  onChange={(v) => patch(r.lineId, 'qty', v)}
                  className="w-[5rem]"
                />
                <MiniField
                  label={`Cost (${currency})`}
                  value={r.cost}
                  onChange={(v) => patch(r.lineId, 'cost', v)}
                  className="w-[6rem]"
                />
                <MiniField
                  label="Lot #"
                  value={r.lot}
                  onChange={(v) => patch(r.lineId, 'lot', v)}
                  className="w-[8rem]"
                  text
                />
                <Text size="sm" variant="muted" className="w-[6rem] text-right">
                  {r.qty && Number(r.qty) > 0 && r.cost
                    ? formatMoney(Math.round(Number(r.cost) * 100) * Number(r.qty), currency)
                    : '—'}
                </Text>
              </Stack>
            ))}
          </Stack>
        </CardContent>
        <CardFooter>
          <Stack direction="row" gap={3} align="center" className="w-full">
            {error && (
              <Text size="sm" className="text-[var(--color-danger)]">
                {error}
              </Text>
            )}
            <Stack direction="row" gap={2} className="ml-auto">
              <Button type="button" variant="ghost" asChild>
                <Link href={`/inventory/purchase-orders/${purchaseOrderId}`}>Cancel</Link>
              </Button>
              <Button color="module" type="submit" disabled={pending}>
                {pending ? 'Receiving…' : 'Receive stock'}
              </Button>
            </Stack>
          </Stack>
        </CardFooter>
      </Card>
    </form>
  );
}

function MiniField({
  label,
  value,
  onChange,
  className,
  text,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  text?: boolean;
}) {
  return (
    <Stack gap={1} className={className}>
      <Label htmlFor={`f-${label}`}>{label}</Label>
      <Input
        id={`f-${label}`}
        type={text ? 'text' : 'number'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Stack>
  );
}

function Field({
  label,
  name,
  type,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <Stack gap={1} className="min-w-[10rem] flex-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </Stack>
  );
}

function nonEmpty(name: string, form: FormData): Record<string, string> {
  const v = str(form.get(name));
  return v ? { [name]: v } : {};
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
