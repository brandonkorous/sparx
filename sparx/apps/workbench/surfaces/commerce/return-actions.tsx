'use client';

// The forms behind a return's lifecycle moves.
//
// Each of these collects the handful of facts one transition needs — the
// approved quantities, a reason for turning it down, the condition of what came
// back, the amount to give back, the version to send instead — and commits it
// straight to the server. They
// are modals rather than panes on purpose: a return action is seconds of work
// with nothing to draft and nothing to come back to, the same class as
// inviting a teammate. Abandon one and nothing is lost — the return is untouched
// and you reopen and redo. That is the ONLY kind of modal this app allows.
//
// The read-only record they act on stays in the pane behind them; a modal here
// belongs to that ONE return via PaneScope, so acting on a return in one pane
// never blacks out the return open in the pane beside it.

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { formatMoney } from './data';
import { VariantPicker, versionOf } from './variant-picker';
import { ReplacementShipmentFields } from './replacement-shipment-fields';
import {
  EMPTY_SHIPMENT_FORM,
  replacementShipmentBody,
  swapSettledMessage,
  type ShipmentForm,
} from './return-shipment';
import type { VariantChoice } from './bundles-data';
import { sellable, useProductStock, type VariantStock } from './products-data';
import {
  conditionLabel,
  reasonLabel,
  returnErrorMessage,
  useApproveReturn,
  useDenyReturn,
  useInspectReturn,
  useRefundReturn,
  useRecordReplacementShipment,
  useSettleExchange,
  type ReturnDetail,
} from './returns-data';

const CONDITIONS = [
  'unopened',
  'like_new',
  'used_good',
  'used_acceptable',
  'damaged',
  'destroyed',
] as const;

function money(cents: number, currency: string): string {
  return formatMoney(cents / 100, currency);
}

/** Shared chrome for every action modal — the popup box, its scrolling body, and
 *  a Cancel / primary footer. Keeps every form visually identical so they read
 *  as one family of moves on a return. */
function ActionDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  submitColor = 'module',
  submitDisabled,
  busy,
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  submitLabel: string;
  submitColor?: 'module' | 'danger' | 'success';
  submitDisabled?: boolean;
  busy: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>

          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            {children}
          </div>

          <DialogFooter>
            <Button color="neutral" variant="ghost" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              color={submitColor}
              size="sm"
              loading={busy}
              disabled={submitDisabled}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

/* ── Approve ────────────────────────────────────────────────────────────── */

/** Say yes to a return. Each line defaults to the quantity the customer asked
 *  for; lower any of them to accept only part of a line back. */
export function ApproveReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const approve = useApproveReturn(detail.id);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [generateLabel, setGenerateLabel] = useState(true);
  const [staffNote, setStaffNote] = useState('');

  // Reset to the requested quantities every time the modal opens, so a cancelled
  // attempt never leaves stale numbers behind for the next one.
  useEffect(() => {
    if (open) {
      setQuantities(Object.fromEntries(detail.items.map((it) => [it.id, String(it.quantity)])));
      setGenerateLabel(true);
      setStaffNote('');
    }
  }, [open, detail.items]);

  const submit = () => {
    const itemDecisions = detail.items.map((it) => ({
      returnLineItemId: it.id,
      approvedQuantity: Math.max(0, Math.floor(Number(quantities[it.id] ?? '0')) || 0),
    }));
    approve.mutate(
      { itemDecisions, generateLabel, staffNote: staffNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.add({ title: 'Return approved', type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not approve this return',
            description: returnErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Approve this return"
      description="Accept the goods back. The customer is told it is approved, and a prepaid return label is bought automatically if you have a carrier connected."
      submitLabel="Approve return"
      busy={approve.isPending}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-3">
        {detail.items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-medium">{it.orderItemName ?? 'Item'}</span>
              <span className="text-sm">
                {reasonLabel(it.reasonCode)} · asked to return {it.quantity}
              </span>
            </div>
            <Field className="w-24">
              <FieldLabel>Accept back</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    type="number"
                    min="0"
                    max={String(it.quantity)}
                    className="text-right tabular-nums"
                    value={quantities[it.id] ?? ''}
                    aria-label={`Quantity to accept back for ${it.orderItemName ?? 'item'}`}
                    onChange={(event) => {
                      setQuantities((current) => ({ ...current, [it.id]: event.target.value }));
                    }}
                  />
                }
              />
            </Field>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2">
        <Checkbox
          color="module"
          checked={generateLabel}
          aria-label="Buy a prepaid return label automatically"
          onChange={(event) => {
            setGenerateLabel(event.target.checked);
          }}
        />
        <Text as="span">Buy a prepaid return label if a carrier is connected</Text>
      </label>

      <Field>
        <FieldLabel>Note for your team</FieldLabel>
        <Textarea
          color="module"
          rows={2}
          value={staffNote}
          placeholder="Optional. Only your team sees this."
          aria-label="Note for your team"
          onChange={(event) => {
            setStaffNote(event.target.value);
          }}
        />
      </Field>
    </ActionDialog>
  );
}

/* ── Deny ───────────────────────────────────────────────────────────────── */

/** Turn a return down. A reason is required — it is kept on the record and is
 *  what the customer is told. */
export function DenyReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const deny = useDenyReturn(detail.id);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const submit = () => {
    deny.mutate(
      { reason: reason.trim() },
      {
        onSuccess: () => {
          toast.add({ title: 'Return turned down', type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not turn down this return',
            description: returnErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Turn down this return"
      description="The customer keeps the item and no money changes hands. They are told the reason you give here."
      submitLabel="Turn it down"
      submitColor="danger"
      submitDisabled={reason.trim().length === 0}
      busy={deny.isPending}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel required>Reason</FieldLabel>
        <Textarea
          color="module"
          rows={3}
          value={reason}
          placeholder="Why are you turning this return down?"
          aria-label="Reason for turning down the return"
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </Field>
    </ActionDialog>
  );
}

/* ── Inspect ────────────────────────────────────────────────────────────── */

/** Record what came back. One condition per line, and whether it can go back on
 *  the shelf — restockable lines are added back into stock when you settle. */
export function InspectReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const inspect = useInspectReturn(detail.id);
  const [rows, setRows] = useState<Record<string, { condition: string; restockable: boolean }>>({});

  useEffect(() => {
    if (open) {
      setRows(
        Object.fromEntries(
          detail.items.map((it) => [it.id, { condition: 'like_new', restockable: true }])
        )
      );
    }
  }, [open, detail.items]);

  const submit = () => {
    const inspections = detail.items.map((it) => {
      const row = rows[it.id] ?? { condition: 'like_new', restockable: true };
      return {
        returnLineItemId: it.id,
        condition: row.condition,
        restockable: row.restockable,
      };
    });
    inspect.mutate(
      { inspections },
      {
        onSuccess: () => {
          toast.add({ title: 'Condition recorded', type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record the inspection',
            description: returnErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  // Already settled, so the sentence about settling cannot be true here.
  const settled = detail.status === 'refunded' || detail.status === 'exchanged';

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title={settled ? 'Say what came back' : 'Record what came back'}
      description={
        settled
          ? 'Note the condition of each item. This return is already finished, so no money moves. What you record puts the goods on your returns bench, where you decide whether they go back on sale.'
          : 'Note the condition of each item. Anything you mark fit to resell goes back into your stock once you say what happens to it.'
      }
      submitLabel="Save the check"
      busy={inspect.isPending}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        {detail.items.map((it) => {
          const row = rows[it.id] ?? { condition: 'like_new', restockable: true };
          return (
            <div key={it.id} className="flex flex-col gap-2">
              <span className="text-base font-medium">{it.orderItemName ?? 'Item'}</span>
              <div className="flex flex-wrap items-end gap-3">
                <Field className="min-w-[10rem] flex-1">
                  <FieldLabel>Condition</FieldLabel>
                  <NativeSelect
                    color="module"
                    value={row.condition}
                    aria-label={`Condition of ${it.orderItemName ?? 'item'}`}
                    onChange={(event) => {
                      setRows((current) => ({
                        ...current,
                        [it.id]: { ...row, condition: event.target.value },
                      }));
                    }}
                  >
                    {CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>
                        {conditionLabel(condition)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <label className="flex h-9 items-center gap-2">
                  <Checkbox
                    color="module"
                    checked={row.restockable}
                    aria-label={`Fit to resell: ${it.orderItemName ?? 'item'}`}
                    onChange={(event) => {
                      setRows((current) => ({
                        ...current,
                        [it.id]: { ...row, restockable: event.target.checked },
                      }));
                    }}
                  />
                  <Text as="span">Fit to resell</Text>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </ActionDialog>
  );
}

/* ── Refund ─────────────────────────────────────────────────────────────── */

/** Give the customer their money back — the move that settles the return, moves
 *  real money, and cannot be undone. */
export function RefundReturnModal({
  detail,
  currency,
  suggestedCents,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  currency: string;
  /** A starting amount worked out from the accepted lines, when the order's
   *  prices are known. Zero when they are not — the operator then types it. */
  suggestedCents: number;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const refund = useRefundReturn(detail.id);
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [asCredit, setAsCredit] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(suggestedCents > 0 ? (suggestedCents / 100).toFixed(2) : '');
      setFee('');
      setAsCredit(false);
    }
  }, [open, suggestedCents]);

  const amountCents = Math.round((Number(amount) || 0) * 100);
  const feeCents = fee.trim() ? Math.round((Number(fee) || 0) * 100) : undefined;
  const valid = amountCents > 0;

  const submit = () => {
    refund.mutate(
      {
        refundAmountCents: amountCents,
        asAccountCredit: asCredit,
        ...(feeCents ? { restockingFeeCents: feeCents } : {}),
      },
      {
        onSuccess: () => {
          toast.add({
            title: `${money(amountCents, currency)} given back`,
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not give the money back',
            description: returnErrorMessage(
              error,
              'The refund did not go through. Nothing was changed. You can try again.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  const who = detail.customerName ?? 'the customer';

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Give the money back"
      description={
        asCredit
          ? `${who} gets this as store credit to spend with you later. This settles the return and cannot be undone.`
          : `${who} gets this back the way they paid. This moves real money and cannot be undone.`
      }
      submitLabel={valid ? `Give back ${money(amountCents, currency)}` : 'Give the money back'}
      submitColor="danger"
      submitDisabled={!valid}
      busy={refund.isPending}
      onSubmit={submit}
    >
      <Field className="w-40">
        <FieldLabel required>Amount to give back</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="text-right tabular-nums"
              value={amount}
              placeholder="0.00"
              aria-label="Amount to give back"
              onChange={(event) => {
                setAmount(event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field className="w-40">
        <FieldLabel>Restocking fee kept</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="text-right tabular-nums"
              value={fee}
              placeholder="0.00"
              aria-label="Restocking fee kept"
              onChange={(event) => {
                setFee(event.target.value);
              }}
            />
          }
        />
      </Field>

      <label className="flex items-center gap-2">
        <Checkbox
          color="module"
          checked={asCredit}
          aria-label="Give as store credit instead of the original payment"
          onChange={(event) => {
            setAsCredit(event.target.checked);
          }}
        />
        <Text as="span">Give as store credit instead of back to their card</Text>
      </label>
    </ActionDialog>
  );
}

/* ── Send the replacement ───────────────────────────────────────────────── */

/** Settling an exchange: sending the replacement instead of moving money.
 *
 *  The only way out of "checked, ready to settle" used to be a refund, so an
 *  even swap could only be ended by giving back money nobody was owed (persona
 *  issue 220). This ends it the way the customer asked. */
export function ExchangeReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const settle = useSettleExchange(detail.id);
  const [picked, setPicked] = useState<VariantChoice | null>(null);
  // Known here only when the parcel has already gone, which some shops do and
  // most do not. Left empty, the swap settles and the tracking number is
  // recorded afterwards through "Say how it went out".
  const [shipping, setShipping] = useState<ShipmentForm>(EMPTY_SHIPMENT_FORM);
  const [staffNote, setStaffNote] = useState('');

  useEffect(() => {
    if (open) {
      setPicked(null);
      setShipping(EMPTY_SHIPMENT_FORM);
      setStaffNote('');
    }
  }, [open]);

  const submit = () => {
    if (!picked) return;
    const shipment = replacementShipmentBody(shipping);
    settle.mutate(
      {
        replacementVariantId: picked.id,
        quantity: 1,
        ...(staffNote.trim() ? { staffNote: staffNote.trim() } : {}),
        ...(shipment ? { shipment } : {}),
      },
      {
        onSuccess: (result) => {
          toast.add({
            title: 'Swap settled',
            description: swapSettledMessage(result, shipment !== undefined),
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not settle the swap',
            description: returnErrorMessage(
              error,
              'Nothing was changed on this return. Try again in a moment.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  const who = detail.customerName ?? 'the customer';

  // WHICH product came back. A swap is almost always another version of it, so
  // the picker opens on those; before this it opened alphabetically over the
  // whole catalog and offered signet rings for a returned knit.
  const cameBack = detail.items.find((line) => line.productId !== null)?.productId ?? null;

  // What she HAS of each version, which is the question the customer usually
  // asked her — "a size up in Oat if you have one". The picker showed price and
  // code and no count, so the decision was made from memory (persona issue 450).
  const productStock = useProductStock(cameBack ?? '');
  const stock = useMemo<VariantStock | undefined>(() => {
    // Nothing was asked, so nothing is claimed. A return line with no product
    // behind it (hand-typed, or a product since deleted) leaves every row
    // unbadged rather than badged wrong (issue 451).
    if (cameBack === null || productStock.data === undefined) return undefined;
    const counts = new Map<string, number>();
    for (const level of productStock.data.items) {
      counts.set(level.variantId, (counts.get(level.variantId) ?? 0) + sellable(level));
    }
    return { productId: cameBack, counts };
  }, [cameBack, productStock.data]);

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Send the replacement"
      description={`This finishes the return by sending ${who} the version they asked for. No money moves in either direction.`}
      submitLabel={picked ? `Send ${versionOf(picked) || picked.sku}` : 'Send the replacement'}
      submitColor="module"
      submitDisabled={!picked}
      busy={settle.isPending}
      onSubmit={submit}
    >
      {picked ? (
        <Field>
          <FieldLabel>Going out</FieldLabel>
          <div className="border-base-300 flex flex-col gap-0.5 rounded-lg border p-3">
            <Text className="text-base font-medium">{picked.productTitle}</Text>
            <Text className="text-base">{versionOf(picked) || picked.sku}</Text>
            <Text className="font-mono text-sm">{picked.sku}</Text>
          </div>
          <button
            type="button"
            className="link self-start text-sm"
            onClick={() => {
              setPicked(null);
            }}
          >
            Pick a different one
          </button>
        </Field>
      ) : (
        <Field>
          <FieldLabel required>What are you sending instead</FieldLabel>
          <VariantPicker
            onPick={setPicked}
            {...(cameBack ? { preferProductId: cameBack } : {})}
            {...(stock ? { stock } : {})}
            placeholder="Search your products…"
          />
        </Field>
      )}

      <ReplacementShipmentFields
        value={shipping}
        onChange={setShipping}
        trackingHint="Leave this empty if it has not gone yet. You can add it when you post it, and that is when the customer is told."
      />

      <Field>
        <FieldLabel>Note for your team</FieldLabel>
        <Textarea
          color="module"
          rows={2}
          value={staffNote}
          placeholder="Optional. Why this swap, for whoever looks at it next. The customer never sees it."
          aria-label="Note for your team"
          onChange={(event) => {
            setStaffNote(event.target.value);
          }}
        />
      </Field>

      <Text className="text-base">
        One of these comes off your stock the moment you send it. What came back went on the shelf
        when you decided what happened to it.
      </Text>
    </ActionDialog>
  );
}

/* ── Say how it went out ─────────────────────────────────────────── */

// The tracking number, when it arrived after the swap was settled.
//
// Which is the ordinary way round. A shop decides what to send while the
// customer is waiting, settles it there and then, and the parcel goes out that
// afternoon or the next morning. Until this existed, a number that turned up
// five minutes after the settle screen closed had nowhere in the product to go,
// so the customer's email could only say "on its way" and stop — on a platform
// whose ordinary shipping confirmation leads with the tracking number because
// that is what the recipient opened it for.
//
// Sending this is what tells the customer. It is not a note to self.

export function RecordReplacementShipmentModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const record = useRecordReplacementShipment(detail.id);
  const [form, setForm] = useState<ShipmentForm>(EMPTY_SHIPMENT_FORM);

  useEffect(() => {
    if (open) setForm(EMPTY_SHIPMENT_FORM);
  }, [open]);

  const shipment = replacementShipmentBody(form);
  const who = detail.customerName ?? 'the customer';

  const submit = () => {
    if (!shipment) return;
    record.mutate(
      { shipment },
      {
        onSuccess: () => {
          toast.add({
            title: 'Tracking number sent',
            description: `${who} has been emailed the number so they can follow it.`,
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record how it went out',
            description: returnErrorMessage(
              error,
              'Nothing was changed on this return. Try again in a moment.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Say how it went out"
      description={`${who} is waiting to hear how to follow their replacement. Putting the tracking number here emails it to them.`}
      submitLabel="Send the tracking number"
      submitColor="module"
      submitDisabled={!shipment}
      busy={record.isPending}
      onSubmit={submit}
    >
      <ReplacementShipmentFields value={form} onChange={setForm} />

      <Text className="text-base">
        The tracking number is the one thing this email exists to carry, so it is the one thing that
        has to be here. A carrier on its own gives them nothing to follow.
      </Text>
    </ActionDialog>
  );
}
