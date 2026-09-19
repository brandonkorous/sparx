'use client';

// RECORDING WHAT A SUPPLIER SAYS HAS SHIPPED.
//
// The dispatch note is the one piece of paper that makes a short delivery
// visible. Without it, six of twelve arriving looks identical to twelve being
// ordered and six being sent, and the difference only surfaces when the invoice
// does — by which time nobody can say whose mistake it was.
//
// The whole capability was already built and had no door: the service, the
// route, the list pane, the detail pane, the receiving pre-fill and even the
// console's own `useCreateAsn()` hook all existed, and `useCreateAsn` had ZERO
// callers. The order pane said "Nothing recorded" and the list pane said
// "record it against the order", each pointing at the other, and neither could
// do it. MEASURED 2026-09-18: zero rows in `inventory_advance_ship_notices`
// across every tenant on the platform.
//
// ── It starts from what is still outstanding ──────────────────────────────
//
// Filled in with everything the order is still waiting for, because "they sent
// the lot" is the ordinary case and the interesting one — a short shipment — is
// then a single edit rather than a form filled from nothing. The quantities are
// editable and nothing is written until the button is pressed, so this is a
// starting point the buyer confirms, never a figure the platform invented.
//
// ── What it deliberately does not do ──────────────────────────────────────
//
// It does not touch stock. A notice is a claim by the supplier; the goods become
// stock when somebody books the delivery in, and the pane says so at the bottom.
// Nothing here is a receipt.

import { useMemo, useState } from 'react';
import {
  Button,
  DateInput,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Table,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import { pickedDayUtc } from '../../lib/today';
import { stockErrorMessage } from './data';
import { useCreateAsn } from './advance-ship-notices-data';
import { usePurchaseOrder } from './purchase-orders-data';

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
}

/** One row of the form: an order line and how many of it they say went out. */
interface ShippedLine {
  purchaseOrderLineId: string;
  title: string;
  code: string;
  /** Single units still owed on this line. Zero lines are not offered at all. */
  outstanding: number;
  /** What the buyer has typed, kept as text so an empty box stays empty. */
  quantity: string;
}

export function RecordShipmentDialog({
  open,
  onClose,
  purchaseOrderId,
  purchaseOrderNumber,
}: Props) {
  const order = usePurchaseOrder(purchaseOrderId);
  const create = useCreateAsn();
  const toast = useToast();
  const confirm = useConfirm();

  const outstandingLines = useMemo<ShippedLine[]>(() => {
    const lines = order.data?.lines ?? [];
    return lines
      .map((line) => ({
        purchaseOrderLineId: line.id,
        title: line.description ?? line.productTitle ?? 'Item',
        code: line.supplierSku ?? line.variantSku ?? '',
        outstanding: Math.max(0, line.quantityOrdered - line.quantityReceived),
        quantity: String(Math.max(0, line.quantityOrdered - line.quantityReceived)),
      }))
      .filter((line) => line.outstanding > 0);
  }, [order.data]);

  // Re-seeded every time the dialog opens, so a cancelled attempt does not leave
  // last time's numbers sitting in the boxes.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [lines, setLines] = useState<ShippedLine[]>([]);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [reference, setReference] = useState('');
  const [expected, setExpected] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const seedKey = open ? `${purchaseOrderId}:${outstandingLines.length}` : null;
  if (open && seedKey !== null && seedKey !== seededFor && order.data) {
    setSeededFor(seedKey);
    setLines(outstandingLines);
    setCarrier('');
    setTracking('');
    setReference('');
    setExpected(null);
    setNotes('');
  }

  const setQuantity = (id: string, text: string) => {
    setLines((current) =>
      current.map((line) => (line.purchaseOrderLineId === id ? { ...line, quantity: text } : line))
    );
  };

  const parsed = lines.map((line) => ({
    line,
    n: /^\d+$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : null,
  }));
  const shipping = parsed.filter((row) => row.n !== null && row.n > 0);
  const malformed = parsed.some((row) => row.line.quantity.trim() !== '' && row.n === null);
  const unitsShipped = shipping.reduce((sum, row) => sum + (row.n ?? 0), 0);
  // A notice claiming MORE than the order still owes is exactly the thing a
  // notice exists to expose, so it is allowed through and said out loud rather
  // than clamped away.
  const overClaimed = shipping.filter((row) => (row.n ?? 0) > row.line.outstanding);
  const valid = shipping.length > 0 && !malformed && !create.isPending;

  const dirty =
    carrier !== '' ||
    tracking !== '' ||
    reference !== '' ||
    notes !== '' ||
    expected !== null ||
    lines.some((line) => line.quantity !== String(line.outstanding));

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard this shipment note?',
        description: `Nothing has been recorded against ${purchaseOrderNumber} yet.`,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        color: 'danger',
      });
      if (!ok) return;
    }
    setSeededFor(null);
    onClose();
  };

  const submit = () => {
    create.mutate(
      {
        purchaseOrderId,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
        ...(tracking.trim() ? { trackingNumber: tracking.trim() } : {}),
        // The day they NAMED, not local midnight pushed into UTC. See
        // `pickedDayUtc`: written the other way, a date typed in Berlin is
        // the day before to everyone reading it.
        ...(expected ? { expectedArrivalAt: pickedDayUtc(expected) ?? undefined } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: shipping.map((row) => ({
          purchaseOrderLineId: row.line.purchaseOrderLineId,
          quantityShipped: row.n ?? 0,
        })),
      },
      {
        onSuccess: (created) => {
          setSeededFor(null);
          onClose();
          afterCommit(() => {
            toast.add({
              title: `${created.number} recorded against ${purchaseOrderNumber}`,
              description:
                'This is what they say is coming, not stock. Booking the delivery in will start from these figures.',
              type: 'success',
            });
          });
        },
        onError: (error: unknown) => {
          afterCommit(() => {
            toast.add({
              title: 'Could not record that shipment',
              description: stockErrorMessage(error, 'Nothing was recorded.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) void requestClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden">
          <DialogTitle>What {purchaseOrderNumber} says has shipped</DialogTitle>

          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
            <Text className="text-sm">
              Copy this off their dispatch note or the email they sent. It does not add anything to
              your stock: it records what is coming, so booking the delivery in starts from these
              figures and a short delivery shows up instead of passing unnoticed.
            </Text>

            {order.isLoading ? (
              <Text className="text-sm">Reading the order…</Text>
            ) : outstandingLines.length === 0 ? (
              <Text className="text-sm">
                Every line on this order has already been booked in, so there is nothing left for
                them to send.
              </Text>
            ) : (
              <Table size="sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right whitespace-nowrap">Still owed</th>
                    <th className="text-right whitespace-nowrap">They sent</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.purchaseOrderLineId}>
                      <td className="w-full max-w-0 min-w-48">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{line.title}</span>
                          {line.code ? (
                            <span className="truncate font-mono text-sm">{line.code}</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{line.outstanding}</td>
                      <td className="w-28 text-right">
                        <Input
                          color="module"
                          className="text-right"
                          inputMode="numeric"
                          aria-label={`Units of ${line.title} they say have shipped`}
                          value={line.quantity}
                          onChange={(event) => {
                            setQuantity(line.purchaseOrderLineId, event.target.value);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            {overClaimed.length > 0 ? (
              <Text className="text-warning text-sm">
                They say they have sent more than this order is still waiting for on{' '}
                {overClaimed.length === 1
                  ? `“${overClaimed[0]?.line.title}”`
                  : `${overClaimed.length} lines`}
                . That is recorded as they said it, so you can take it up with them.
              </Text>
            ) : null}

            <div className="flex flex-wrap gap-4">
              <Field className="min-w-48 flex-1">
                <FieldLabel>Who is carrying it</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={carrier}
                      placeholder="The courier or haulier"
                      onChange={(event) => {
                        setCarrier(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field className="min-w-48 flex-1">
                <FieldLabel>Tracking number</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={tracking}
                      spellCheck={false}
                      placeholder="If they gave you one"
                      onChange={(event) => {
                        setTracking(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-4">
              <Field className="min-w-48 flex-1">
                <FieldLabel>Their note number</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={reference}
                      spellCheck={false}
                      placeholder="What they call this dispatch"
                      onChange={(event) => {
                        setReference(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field className="min-w-48 flex-1">
                <FieldLabel>They say it lands</FieldLabel>
                <DateInput
                  color="module"
                  value={expected}
                  aria-label="The date they say it lands"
                  onValueChange={setExpected}
                />
                <FieldDescription>
                  Only if they have named a day. This does not change the date on the order.
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel>Anything else worth keeping</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={notes}
                    placeholder="Two pallets, one on a later van…"
                    onChange={(event) => {
                      setNotes(event.target.value);
                    }}
                  />
                }
              />
            </Field>

            {unitsShipped > 0 ? (
              <div className="flex items-baseline gap-2">
                <Text as="span" className="text-sm">
                  On its way
                </Text>
                <Text as="span" className="text-lg font-semibold tabular-nums">
                  {unitsShipped}
                </Text>
                <Text as="span" className="text-sm">
                  {unitsShipped === 1 ? 'unit' : 'units'}
                </Text>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void requestClose();
              }}
            >
              Cancel
            </Button>
            <Button color="module" size="sm" disabled={!valid} onClick={submit}>
              {create.isPending ? 'Recording…' : 'Record what they sent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
