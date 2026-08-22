'use client';

// ENTER THE SUPPLIER'S INVOICE FOR THIS DELIVERY (docs/146 Phase 10.10).
//
// The path for a business with no accounting package: the goods have just been
// booked in, the invoice is in the driver's hand, and entering it should be
// typing the invoice number.
//
// ── Why the numbers are pre-filled and still have to be checked ──────────
//
// The panel fills in OUR side — what the delivery recorded — and asks the
// operator to correct it to THEIRS. That is not a nicety, it is the three-way
// match doing its job at the only moment it is cheap. A bill created straight
// from the receipt would match the receipt perfectly by construction, and a
// match that cannot fail is not a check. What is being compared is the
// supplier's numbers against ours, and the supplier's numbers are on the paper.
//
// ── The duplicate guard is on the screen, not only in the service ────────
//
// Paying the same delivery twice is the most expensive mistake in accounts
// payable, and the moment to prevent it is before somebody types a second
// invoice number. Where a bill already exists against this order the panel says
// so first and offers to open it.

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldLabel,
  Input,
  Table,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Receipt } from 'lucide-react';
import { useMutation, useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { FormSection } from '../../components/form-section';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, stockErrorMessage } from './data';

interface BillDraftLine {
  purchaseOrderLineId: string | null;
  variantId: string | null;
  sku: string | null;
  description: string;
  quantity: number;
  unitCostCents: number;
  amountCents: number;
  uomCode: string | null;
  unitsPerUom: number;
}

interface BillDraft {
  goodsReceiptId: string;
  receiptNumber: string | null;
  supplierId: string;
  supplierName: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  currency: string;
  suggestedBilledAt: string;
  /** Null when the supplier has no stated payment terms — never a due date
   *  invented on their behalf. */
  suggestedDueAt: string | null;
  lines: BillDraftLine[];
  subtotalCents: number;
  existingBillId: string | null;
  existingBillNumber: string | null;
}

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

function toIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00Z`).toISOString() : undefined;
}

function toCents(raw: string): number {
  const parsed = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function ReceiptBillPanel({
  ctx,
  goodsReceiptId,
}: {
  ctx: SurfaceContext;
  goodsReceiptId: string;
}) {
  const toast = useToast();

  const draft = useQuery({
    queryKey: ['inventory', 'receipts', goodsReceiptId, 'bill-draft'],
    queryFn: () => api.get<BillDraft>(`/v1/inventory/receipts/${goodsReceiptId}/bill-draft`),
    enabled: goodsReceiptId !== '',
  });

  const create = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<{ id: string; number: string }>(
        `/v1/inventory/receipts/${goodsReceiptId}/bill`,
        input
      ),
  });

  const [number, setNumber] = useState('');
  const [billedAt, setBilledAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [tax, setTax] = useState('');
  const [shipping, setShipping] = useState('');
  const [seeded, setSeeded] = useState(false);

  // Seed the dates from the draft ONCE. Guarded so a background refetch cannot
  // reset a date somebody has just corrected off the paper.
  useEffect(() => {
    const data = draft.data;
    if (!data || seeded) return;
    setBilledAt(toDateInput(data.suggestedBilledAt));
    setDueAt(toDateInput(data.suggestedDueAt));
    setSeeded(true);
  }, [draft.data, seeded]);

  if (draft.isError) {
    return (
      <FormSection title="The supplier's invoice">
        <Text className="text-sm">
          Could not work out a draft invoice for this delivery just now. The delivery itself is
          unaffected.
        </Text>
      </FormSection>
    );
  }

  const data = draft.data;
  if (!data) return null;

  const taxCents = toCents(tax);
  const shippingCents = toCents(shipping);
  const totalCents = data.subtotalCents + taxCents + shippingCents;

  return (
    <FormSection
      title={
        <span className="flex flex-wrap items-center gap-2">
          The supplier&rsquo;s invoice
          {data.existingBillId ? (
            <Badge color="success" variant="soft" size="sm">
              Already entered
            </Badge>
          ) : null}
        </span>
      }
      description={
        data.existingBillId
          ? undefined
          : 'Filled in from what was actually delivered. Correct anything the paper says differently — where the two disagree, the match will tell you.'
      }
    >
      {data.existingBillId ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>Invoice {data.existingBillNumber} is already on this order</AlertTitle>
            <AlertDescription>
              Entering a second one is how a delivery gets paid for twice. Open the existing invoice
              to check it covers this delivery before adding another.
            </AlertDescription>
          </AlertContent>
          <Button
            color="neutral"
            variant="outline"
            size="sm"
            onClick={() => {
              ctx.open('inventory.supplier-bills.detail', { id: data.existingBillId ?? '' });
            }}
          >
            Open it
          </Button>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
        <Field>
          <FieldLabel>Their invoice number</FieldLabel>
          <Input
            color="module"
            value={number}
            placeholder="INV-40218"
            onChange={(event) => {
              setNumber(event.target.value);
            }}
          />
          <Text className="text-sm">
            Off the paper. This is what {data.supplierName ?? 'they'} will quote back if it is ever
            queried.
          </Text>
        </Field>
        <Field>
          <FieldLabel>Invoice date</FieldLabel>
          <Input
            color="module"
            type="date"
            value={billedAt}
            onChange={(event) => {
              setBilledAt(event.target.value);
            }}
          />
        </Field>
        <Field>
          <FieldLabel>Due</FieldLabel>
          <Input
            color="module"
            type="date"
            value={dueAt}
            onChange={(event) => {
              setDueAt(event.target.value);
            }}
          />
          {data.suggestedDueAt === null ? (
            <Text className="text-sm">
              This supplier has no payment terms recorded, so no date was suggested.
            </Text>
          ) : null}
        </Field>
      </div>

      <Table size="sm">
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right">Received</th>
            <th className="hidden text-right @md:table-cell">Each</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, index) => (
            <tr key={`${line.purchaseOrderLineId ?? 'line'}-${index}`}>
              <td className="w-full max-w-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{line.description}</span>
                  <span className="truncate font-mono text-sm">{line.sku ?? 'No code'}</span>
                </span>
              </td>
              <td className="text-right tabular-nums">{line.quantity}</td>
              <td className="hidden text-right tabular-nums @md:table-cell">
                {formatCents(line.unitCostCents, data.currency)}
              </td>
              <td className="text-right font-medium tabular-nums">
                {formatCents(line.amountCents, data.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>Tax on the invoice</FieldLabel>
          <Input
            color="module"
            value={tax}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => {
              setTax(event.target.value);
            }}
          />
        </Field>
        <Field>
          <FieldLabel>Delivery charge</FieldLabel>
          <Input
            color="module"
            value={shipping}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => {
              setShipping(event.target.value);
            }}
          />
        </Field>
      </div>

      <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-col">
          <Text className="text-2xl font-semibold tabular-nums">
            {formatCents(totalCents, data.currency)}
          </Text>
          <Text className="text-sm">
            {plural(data.lines.length, 'line', 'lines')} ·{' '}
            {formatCents(data.subtotalCents, data.currency)} of goods
          </Text>
        </div>
        <Button
          color="module"
          disabled={number.trim() === '' || create.isPending}
          onClick={() => {
            create.mutate(
              {
                number: number.trim(),
                ...(toIso(billedAt) ? { billed_at: toIso(billedAt) } : {}),
                ...(toIso(dueAt) ? { due_at: toIso(dueAt) } : {}),
                tax_cents: taxCents,
                shipping_cents: shippingCents,
              },
              {
                onSuccess: (bill) => {
                  afterCommit(() => {
                    toast.add({ title: `Invoice ${bill.number} entered`, type: 'success' });
                  });
                  ctx.open('inventory.supplier-bills.detail', { id: bill.id });
                },
                onError: (error) => {
                  afterCommit(() => {
                    toast.add({
                      title: 'Could not enter it',
                      description: stockErrorMessage(error, 'Nothing was saved.'),
                      type: 'error',
                    });
                  });
                },
              }
            );
          }}
        >
          <Receipt className="size-4" aria-hidden />
          Enter this invoice
        </Button>
      </div>
    </FormSection>
  );
}
