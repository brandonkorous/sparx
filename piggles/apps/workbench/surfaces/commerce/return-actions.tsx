'use client';

// The forms behind a return's lifecycle moves.
//
// Each of these collects the handful of facts one transition needs — the
// approved quantities, a reason for turning it down, the condition of what came
// back, the amount to give back — and commits it straight to the server. They
// are modals rather than panes on purpose: a return action is seconds of work
// with nothing to draft and nothing to come back to, the same class as
// inviting a teammate. Abandon one and nothing is lost — the return is untouched
// and you reopen and redo. That is the ONLY kind of modal this app allows.
//
// The read-only record they act on stays in the pane behind them; a modal here
// belongs to that ONE return via PaneScope, so acting on a return in one pane
// never blacks out the return open in the pane beside it.

import { useEffect, useState } from 'react';
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
import { MoneyTextInput } from '../../components/money-input';
import { formatMoney } from './data';
import {
  conditionLabel,
  reasonLabel,
  returnErrorMessage,
  useApproveReturn,
  useDenyReturn,
  useInspectReturn,
  useRefundReturn,
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
 *  a Cancel / primary footer. Keeps all four forms visually identical so they
 *  read as one family of moves on a return. */
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

          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
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
          placeholder="Optional — only your team sees this."
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

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Record what came back"
      description="Note the condition of each item. Anything you mark fit to resell is added back into your stock when you settle the refund."
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
                    aria-label={`Fit to resell — ${it.orderItemName ?? 'item'}`}
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
              'The refund did not go through. Nothing was changed — you can try again.'
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
            <MoneyTextInput
              color="module"
              className="text-right"
              aria-label="Amount to give back"
              text={amount}
              onTextChange={setAmount}
            />
          }
        />
      </Field>

      <Field className="w-40">
        <FieldLabel>Restocking fee kept</FieldLabel>
        <FieldControl
          render={
            <MoneyTextInput
              color="module"
              className="text-right"
              aria-label="Restocking fee kept"
              text={fee}
              onTextChange={setFee}
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
