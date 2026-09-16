'use client';

// ENTERING A SUPPLIER'S INVOICE.
//
// Its own file because it is a different job from working an existing bill, and
// mixing "type this invoice in" with "decide whether to pay it" in one component
// produced a file that was really two screens wearing one name.
//
// ── It starts from the ORDER, not from a blank form ───────────────────────
//
// The order already knows every line, the agreed price and what arrived. Typing
// that in again is both slow and the main source of the errors the check exists
// to catch — a mistyped quantity produces a "discrepancy" that is your own. So
// the lines come across pre-filled at the AGREED price and the RECEIVED
// quantity, and the person entering the invoice changes only what the supplier
// has actually charged differently.
//
// A bill can still be entered with no order behind it (a carriage-only invoice,
// a consolidated statement). It simply cannot be checked, and the detail screen
// says so rather than showing a green tick.

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Table,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import { afterCommit } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, stockErrorMessage } from './data';
import { usePurchaseOrder, usePurchaseOrders } from './purchase-orders-data';
import { useCreateSupplierBill } from './supplier-bills-data';
import { MoneyTextInput, moneyCents } from '../../components/money-input';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

interface BillDraftLine {
  purchaseOrderLineId: string;
  variantId: string;
  sku: string | null;
  title: string | null;
  /** Whole units as typed. */
  quantity: string;
  /** Whole currency units as typed. */
  unitCost: string;
  /** What the order agreed, for the "they have changed it" hint. */
  agreedUnitCostCents: number;
  receivedQuantity: number;
}

function todayIso(): string {
  return new Date().toISOString();
}

export function NewSupplierBill({ ctx }: { ctx: SurfaceContext }) {
  // Opened from an order's own pane, so the order usually arrives in the params.
  const seededOrderId = ctx.params.purchaseOrderId ?? '';
  const [purchaseOrderId, setPurchaseOrderId] = useState(seededOrderId);

  // Only orders that could plausibly have been invoiced. A draft has not been
  // sent, so nobody can have billed for it.
  const orders = usePurchaseOrders({ status: '', q: '', take: 100, skip: 0 });
  const billable = (orders.data?.items ?? []).filter(
    (order) =>
      order.status === 'submitted' || order.status === 'partial' || order.status === 'received'
  );

  const order = usePurchaseOrder(purchaseOrderId === '' ? 'new' : purchaseOrderId);
  const create = useCreateSupplierBill();
  const toast = useToast();

  const [number, setNumber] = useState('');
  const [billedAt, setBilledAt] = useState(() => todayIso().slice(0, 10));
  const [dueAt, setDueAt] = useState('');
  const [freight, setFreight] = useState('0');
  const [tax, setTax] = useState('0');
  const [lines, setLines] = useState<BillDraftLine[]>([]);
  // What the console filled in, so "unsaved" can mean what is on screen differs
  // from it. The flag used to be sticky: any keystroke set it and only a save
  // cleared it, so clearing a box again still left the pane claiming unsaved
  // work and still confirmed on close (issue 507).
  const seededLinesRef = useRef('[]');
  const seededBilledAt = useRef(billedAt).current;

  // Pre-fill from the order the moment it lands. Received quantity, agreed
  // price: what the invoice SHOULD say, so that anything the person changes is
  // a real difference rather than a typo.
  useEffect(() => {
    if (!order.data) {
      setLines([]);
      seededLinesRef.current = '[]';
      return;
    }
    const seeded = order.data.lines.map((line) => ({
      purchaseOrderLineId: line.id,
      variantId: line.variantId,
      sku: line.variantSku,
      title: line.productTitle ?? line.description,
      quantity: String(line.quantityReceived > 0 ? line.quantityReceived : line.quantityOrdered),
      unitCost: (line.unitCostCents / 100).toString(),
      agreedUnitCostCents: line.unitCostCents,
      receivedQuantity: line.quantityReceived,
    }));
    setLines(seeded);
    // Filling these in from the order is the console's work, not hers, so the
    // baseline moves with it.
    seededLinesRef.current = JSON.stringify(seeded);
  }, [order.data]);

  // `!create.isSuccess` because this pane replaces itself with the saved invoice
  // the instant it succeeds, and a flag still reading dirty at that moment asks
  // her to confirm discarding the invoice she just entered.
  const dirty =
    !create.isSuccess &&
    (purchaseOrderId !== seededOrderId ||
      number.trim() !== '' ||
      dueAt !== '' ||
      billedAt !== seededBilledAt ||
      freight !== '0' ||
      tax !== '0' ||
      JSON.stringify(lines) !== seededLinesRef.current);
  useDirtySource(dirty, 'This bill has not been saved. Close it anyway?');

  const supplierId = order.data?.supplierId ?? '';
  const currency = order.data?.currency ?? 'USD';

  // Amounts are read the way a person writes them — "1,250.00", "$8.00",
  // "8,50" — rather than the one spelling `Number.parseFloat` knows (issue 486).
  // A quantity is a count, not money, so it keeps its own parse.
  const goodsCents = lines.reduce((sum, line) => {
    const qty = Number.parseFloat(line.quantity);
    const cost = moneyCents(line.unitCost);
    if (!Number.isFinite(qty) || cost === null) return sum;
    return sum + Math.round(qty * cost);
  }, 0);
  const freightCents = moneyCents(freight) ?? 0;
  const taxCents = moneyCents(tax) ?? 0;

  const canSave =
    supplierId !== '' &&
    number.trim().length > 0 &&
    lines.length > 0 &&
    lines.every((line) => Number.parseFloat(line.quantity) > 0);

  const onSave = () => {
    create.mutate(
      {
        supplierId,
        purchaseOrderId,
        number: number.trim(),
        billedAt: new Date(billedAt).toISOString(),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        currency,
        taxCents,
        freightCents,
        lines: lines.map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          variantId: line.variantId,
          quantity: Math.round(Number.parseFloat(line.quantity)),
          unitCostCents: moneyCents(line.unitCost) ?? 0,
        })),
      },
      {
        onSuccess: (saved) => {
          afterCommit(() => {
            toast.add({
              title: `Invoice ${saved.number} entered`,
              description:
                saved.match.ok === false
                  ? `${plural(saved.match.linesFlagged, 'line', 'lines')} ${saved.match.linesFlagged === 1 ? 'does' : 'do'} not agree with the delivery: have a look before it is paid.`
                  : 'It agrees with what was ordered and received.',
              type: saved.match.ok === false ? 'warning' : 'success',
            });
          });
          ctx.open('inventory.supplier-bills.detail', { id: saved.id });
        },
        onError: (error) => {
          afterCommit(() => {
            toast.add({
              title: 'Could not enter that invoice',
              description: stockErrorMessage(error, 'Nothing was saved. Please try again.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL_SCROLL}>
      <div className={COLUMN}>
        <Heading level={2} className="text-lg">
          Enter a supplier&apos;s invoice
        </Heading>

        <FormSection
          title="Which order it is for"
          description="The lines come across from the order already filled in, so you only change what they have actually charged differently."
        >
          <Field>
            <FieldLabel>Purchase order</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={purchaseOrderId}
                  onChange={(event) => {
                    setPurchaseOrderId(event.target.value);
                  }}
                >
                  <option value="">Choose an order…</option>
                  {billable.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.number} · {candidate.supplierName ?? 'Unnamed supplier'} ·{' '}
                      {formatCents(candidate.totalCents, candidate.currency)}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
            <FieldDescription>
              Only orders that have actually been placed can have been invoiced.
            </FieldDescription>
          </Field>
        </FormSection>

        {purchaseOrderId === '' ? (
          <Alert color="info">
            <AlertContent>
              <AlertTitle>Choose an order to start</AlertTitle>
              <AlertDescription>
                Every line, the agreed price and what actually arrived all come from the order. That
                is what makes the check possible, and it is far quicker than typing the invoice out
                again.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}

        {purchaseOrderId !== '' ? (
          <>
            <FormSection title="The invoice" description="As printed on their paperwork.">
              <Field>
                <FieldLabel>Their invoice number</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={number}
                      placeholder="INV-88214"
                      onChange={(event) => {
                        setNumber(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Theirs, not ours. It is how a query to their accounts department is phrased. The
                  same number cannot be entered twice for one supplier.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Invoice date</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="date"
                      value={billedAt}
                      onChange={(event) => {
                        setBilledAt(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Due</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="date"
                      value={dueAt}
                      onChange={(event) => {
                        setDueAt(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Leave it blank if they have not stated one. An invoice with no due date is never
                  reported as overdue, which is honest rather than convenient.
                </FieldDescription>
              </Field>
            </FormSection>

            <FormSection
              title="What they have charged"
              description="Filled in from the order at the agreed price and what actually arrived. Change only what differs."
            >
              <Table size="sm">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th className="w-24 text-right">Arrived</th>
                    <th className="w-28 text-right">Billed</th>
                    <th className="w-32 text-right">Each</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const typedCost = moneyCents(line.unitCost) ?? 0;
                    const priceMoved = typedCost !== line.agreedUnitCostCents;
                    return (
                      <tr key={line.purchaseOrderLineId}>
                        <td className="w-full max-w-0">
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">{line.title ?? 'Untitled line'}</span>
                            <span className="truncate font-mono text-sm">
                              {line.sku ?? 'No code'}
                            </span>
                            {priceMoved ? (
                              <span className="truncate text-sm">
                                agreed {formatCents(line.agreedUnitCostCents, currency)}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="text-right tabular-nums">{line.receivedQuantity}</td>
                        <td>
                          <Input
                            size="sm"
                            color="module"
                            type="number"
                            min={0}
                            aria-label={`Quantity billed for ${line.sku ?? 'this line'}`}
                            value={line.quantity}
                            onChange={(event) => {
                              const quantity = event.target.value;
                              setLines((current) =>
                                current.map((l, i) => (i === index ? { ...l, quantity } : l))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <MoneyTextInput
                            size="sm"
                            color="module"
                            aria-label={`Price each billed for ${line.sku ?? 'this line'}`}
                            text={line.unitCost}
                            onTextChange={(unitCost) => {
                              setLines((current) =>
                                current.map((l, i) => (i === index ? { ...l, unitCost } : l))
                              );
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              <div className="flex flex-wrap gap-3">
                <Field className="max-w-40">
                  <FieldLabel>Freight</FieldLabel>
                  <FieldControl
                    render={
                      <MoneyTextInput
                        color="module"
                        aria-label="Freight"
                        text={freight}
                        onTextChange={(value) => {
                          setFreight(value);
                        }}
                      />
                    }
                  />
                </Field>
                <Field className="max-w-40">
                  <FieldLabel>Tax</FieldLabel>
                  <FieldControl
                    render={
                      <MoneyTextInput
                        color="module"
                        aria-label="Tax"
                        text={tax}
                        onTextChange={(value) => {
                          setTax(value);
                        }}
                      />
                    }
                  />
                </Field>
              </div>

              <Text>
                Total on this invoice:{' '}
                <strong>{formatCents(goodsCents + freightCents + taxCents, currency)}</strong>
              </Text>
            </FormSection>

            <div className="flex flex-wrap items-center gap-2 pb-4">
              <Button
                color="module"
                disabled={!canSave}
                loading={create.isPending}
                onClick={onSave}
              >
                Enter the invoice
              </Button>
              <Text className="text-sm">
                It is checked against the order and the delivery the moment it is saved.
              </Text>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
