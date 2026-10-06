'use client';

// The core on one order line (persona issues 051 and 057): what kind of core it
// is, where it stands, and the counter's moves on it.
//
// Two kinds. A DEPOSIT line took a refundable deposit and shipped now; its moves
// are "the core came back" (the deposit goes back) and "keep the deposit". A
// SEND-FIRST line took nothing and waits for the old part before it ships; its
// moves are "the old part arrived" (which lets it ship, and moves no money) and
// "ship without waiting". The Cores owed list offers the same moves from the
// same words (core-line-words.ts), so the two screens cannot disagree.

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { formatMoney, type OrderItem } from './data';
import {
  coreErrorMessage,
  coreLineOfItem,
  useKeepCoreDeposits,
  useReceiveCores,
  useReleaseCoreHold,
  type CoreLine,
  type CoreRefundRoute,
} from './cores-data';
import {
  coreBadges,
  coreMoves,
  coreSummary,
  moveLabel,
  plural,
  type CoreMove,
} from './core-line-words';
import { ActionDialog } from './return-actions';

/** The core line under a part, with its state and its moves. Renders nothing for
 *  a part sold without a core. */
export function OrderLineCore({
  item,
  currency,
  customerName,
}: {
  item: OrderItem;
  currency: string;
  customerName: string;
}) {
  const [move, setMove] = useState<CoreMove | null>(null);
  if (item.coreCharge === null && !item.coreFirst) return null;

  const line = coreLineOfItem(item, currency, customerName);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm">{coreSummary(item, currency)}</span>
      <div className="flex flex-wrap items-center gap-2">
        <CoreBadges line={line} />
        <CoreMoveButtons line={line} onMove={setMove} />
      </div>
      <CoreMoveDialog
        line={line}
        move={move}
        onClose={() => {
          setMove(null);
        }}
      />
    </div>
  );
}

export function CoreBadges({ line }: { line: CoreLine }) {
  return (
    <>
      {coreBadges(line).map((badge) => (
        <Badge key={badge.label} color={badge.tone} variant="soft" size="sm">
          {badge.label}
        </Badge>
      ))}
    </>
  );
}

/** Getting the old part in is the move a counter makes most; shipping without
 *  waiting lets goods go with nothing held against them; keeping a deposit is a
 *  quiet bookkeeping move. */
const MOVE_LOOK: Record<CoreMove, { color?: string; variant: 'outline' | 'ghost' }> = {
  receive: { color: 'module', variant: 'outline' },
  release: { color: 'warning', variant: 'outline' },
  keep: { variant: 'ghost' },
};

/** The buttons for a line's moves. `stopPropagation` is for a clickable row: a
 *  move is not "open the order". */
export function CoreMoveButtons({
  line,
  onMove,
  stopPropagation = false,
}: {
  line: CoreLine;
  onMove: (move: CoreMove) => void;
  stopPropagation?: boolean;
}) {
  return (
    <>
      {coreMoves(line).map((move) => (
        <Button
          key={move}
          size="sm"
          variant={MOVE_LOOK[move].variant}
          {...(MOVE_LOOK[move].color ? { color: MOVE_LOOK[move].color } : {})}
          onClick={(event) => {
            if (stopPropagation) event.stopPropagation();
            onMove(move);
          }}
          onKeyDown={(event) => {
            // Enter on the button must not also reach a row that opens the order.
            if (stopPropagation) event.stopPropagation();
          }}
        >
          {moveLabel(line, move)}
        </Button>
      ))}
    </>
  );
}

/** The dialog for whichever move was picked. Rendered OUTSIDE any clickable row:
 *  React bubbles a click inside a portal up its component tree, so a dialog drawn
 *  inside a row would open the order on every click in it. */
export function CoreMoveDialog({
  line,
  move,
  onClose,
}: {
  line: CoreLine;
  move: CoreMove | null;
  onClose: () => void;
}) {
  return (
    <>
      {line.coreFirst ? (
        <OldPartArrivedModal line={line} open={move === 'receive'} onClose={onClose} />
      ) : (
        <ReceiveCoresModal line={line} open={move === 'receive'} onClose={onClose} />
      )}
      <KeepDepositsModal line={line} open={move === 'keep'} onClose={onClose} />
      <ReleaseHoldModal line={line} open={move === 'release'} onClose={onClose} />
    </>
  );
}

function count(value: string): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function CountInput({
  value,
  error,
  label,
  onChange,
}: {
  value: string;
  error: boolean;
  label: string;
  onChange: (next: string) => void;
}) {
  return (
    <Input
      color={error ? 'error' : 'module'}
      type="number"
      min="0"
      step="1"
      inputMode="numeric"
      className="tabular-nums"
      value={value}
      aria-label={label}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

/** Old parts came back on a deposit line: refund the usable ones, keep the rest
 *  with a reason. */
function ReceiveCoresModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const receive = useReceiveCores();
  const [usable, setUsable] = useState('');
  const [unusable, setUnusable] = useState('');
  const [note, setNote] = useState('');
  const [refundTo, setRefundTo] = useState<CoreRefundRoute>('original_payment');
  const { owed, currency } = line;
  const deposit = line.depositCents / 100;

  useEffect(() => {
    if (open) {
      setUsable(String(owed));
      setUnusable('0');
      setNote('');
      setRefundTo('original_payment');
    }
  }, [open, owed]);

  const good = count(usable);
  const bad = count(unusable);
  const back = good * deposit;
  const tooMany = good + bad > owed;
  const needsReason = bad > 0 && note.trim() === '';
  const valid = good + bad > 0 && !tooMany && !needsReason;

  const submit = () => {
    receive.mutate(
      {
        orderItemId: line.orderItemId,
        body: {
          usable: good,
          unusable: bad,
          refundTo,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: (settlement) => {
          toast.add({ title: 'Core recorded', description: settlement.summary, type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record the core',
            description: coreErrorMessage(
              error,
              'Nothing was changed and no money moved. You can try again.'
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
      title="Old part came back"
      description={`${line.name}: ${plural(owed, 'core is', 'cores are')} still owed by ${line.customerName}. A usable core gets its ${formatMoney(deposit, currency)} deposit back. If this order has an invoice still open, the deposit comes off that invoice first.`}
      submitLabel={
        !valid
          ? 'Record the core'
          : back > 0
            ? `Give back ${formatMoney(back, currency)}`
            : `Keep ${plural(bad, 'deposit', 'deposits')}`
      }
      submitColor={back > 0 ? 'danger' : 'module'}
      submitDisabled={!valid}
      busy={receive.isPending}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-3 @md:flex-row">
        <Field className="min-w-0 flex-1">
          <FieldLabel>Usable</FieldLabel>
          <FieldControl
            render={
              <CountInput
                value={usable}
                error={tooMany}
                label="Cores that can be rebuilt"
                onChange={setUsable}
              />
            }
          />
          <FieldDescription>Fit to rebuild. Their deposits go back.</FieldDescription>
        </Field>
        <Field className="min-w-0 flex-1">
          <FieldLabel>Not usable</FieldLabel>
          <FieldControl
            render={
              <CountInput
                value={unusable}
                error={tooMany}
                label="Cores that cannot be used"
                onChange={setUnusable}
              />
            }
          />
          <FieldDescription>
            Cracked, missing parts, or the wrong part. You keep their deposits.
          </FieldDescription>
        </Field>
      </div>
      {tooMany ? (
        <p className="text-error text-sm" role="alert">
          Only {plural(owed, 'core is', 'cores are')} still owed on this line.
        </p>
      ) : null}

      {bad > 0 ? (
        <Field>
          <FieldLabel required>Why it cannot be used</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color={needsReason ? 'error' : 'module'}
                rows={2}
                value={note}
                placeholder="For example: cracked nozzle body"
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>The customer will ask. This is kept with the order.</FieldDescription>
        </Field>
      ) : null}

      {good > 0 ? (
        <Field>
          <FieldLabel>Deposit already paid goes</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                color="module"
                value={refundTo}
                onChange={(event) => {
                  setRefundTo(event.target.value as CoreRefundRoute);
                }}
              >
                <option value="original_payment">Back the way they paid</option>
                <option value="account_credit">As credit on their account</option>
              </NativeSelect>
            }
          />
        </Field>
      ) : null}
    </ActionDialog>
  );
}

/**
 * The old part arrived on a send-first line. No money moves: nothing was paid.
 * Each one that arrives lets one part ship. An old part that cannot be used is
 * not recorded here at all; the server refuses it, because there is no deposit
 * to keep for it, so the line keeps waiting for one that can.
 */
function OldPartArrivedModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const receive = useReceiveCores();
  const [arrived, setArrived] = useState('');
  const [note, setNote] = useState('');
  const { owed } = line;

  useEffect(() => {
    if (open) {
      setArrived(String(owed));
      setNote('');
    }
  }, [open, owed]);

  const n = count(arrived);
  const tooMany = n > owed;
  const valid = n > 0 && !tooMany;

  const submit = () => {
    receive.mutate(
      {
        orderItemId: line.orderItemId,
        body: {
          usable: n,
          unusable: 0,
          refundTo: 'original_payment',
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: (settlement) => {
          toast.add({
            title: `${plural(n, 'old part', 'old parts')} in`,
            description: settlement.summary,
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record the old part',
            description: coreErrorMessage(error, 'Nothing was changed. You can try again.'),
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
      title="Old part arrived"
      description={`${line.name}: ${line.customerName} is sending the old part first, so nothing was paid as a deposit and no money moves. Each old part that arrives lets one part ship. Only record one that can be rebuilt. If it cannot, leave the line waiting and ask the customer for another.`}
      submitLabel={valid ? `Record ${plural(n, 'old part', 'old parts')}` : 'Record the old part'}
      submitDisabled={!valid}
      busy={receive.isPending}
      onSubmit={submit}
    >
      <Field className="w-48">
        <FieldLabel>How many arrived</FieldLabel>
        <FieldControl
          render={
            <CountInput
              value={arrived}
              error={tooMany}
              label="Old parts that arrived"
              onChange={setArrived}
            />
          }
        />
      </Field>
      {tooMany ? (
        <p className="text-error text-sm" role="alert">
          Only {plural(owed, 'old part is', 'old parts are')} still to come on this line.
        </p>
      ) : null}
      <Field>
        <FieldLabel>Anything to note</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={2}
              value={note}
              placeholder="For example: came in by courier, box was damaged"
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>Optional. Kept with the order.</FieldDescription>
      </Field>
    </ActionDialog>
  );
}

/** The core is not coming back: the deposit stays with the business. */
function KeepDepositsModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const keep = useKeepCoreDeposits();
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const { owed } = line;

  useEffect(() => {
    if (open) {
      setQuantity(String(owed));
      setNote('');
    }
  }, [open, owed]);

  const n = count(quantity);
  const valid = n > 0 && n <= owed && note.trim() !== '';

  const submit = () => {
    keep.mutate(
      { orderItemId: line.orderItemId, body: { quantity: n, note: note.trim() } },
      {
        onSuccess: () => {
          toast.add({ title: `${plural(n, 'deposit', 'deposits')} kept`, type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not keep the deposit',
            description: coreErrorMessage(error, 'Nothing was changed. You can try again.'),
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
      title="Keep the core deposit"
      description={`For an old part that is not coming back. The ${formatMoney(line.depositCents / 100, line.currency)} deposit stays with you and no money moves. The line stops showing as owed.`}
      submitLabel={valid ? `Keep ${plural(n, 'deposit', 'deposits')}` : 'Keep the deposit'}
      submitDisabled={!valid}
      busy={keep.isPending}
      onSubmit={submit}
    >
      <Field className="w-40">
        <FieldLabel>How many</FieldLabel>
        <FieldControl
          render={
            <CountInput
              value={quantity}
              error={n > owed}
              label="Deposits to keep"
              onChange={setQuantity}
            />
          }
        />
      </Field>
      <Field>
        <FieldLabel required>Why</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={2}
              value={note}
              placeholder="For example: the customer is keeping the old part"
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>The customer will ask. This is kept with the order.</FieldDescription>
      </Field>
    </ActionDialog>
  );
}

/**
 * Ship a send-first line before its old part arrives: a trusted fleet customer, a
 * breakdown that cannot wait. Nothing is held against the part once it goes, so
 * the dialog says so and asks why: the old part is still owed and stays on the
 * Cores owed list, and the next person to open the order will want the reason.
 */
function ReleaseHoldModal({
  line,
  open,
  onClose,
}: {
  line: CoreLine;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const release = useReleaseCoreHold();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const valid = note.trim() !== '';

  const submit = () => {
    release.mutate(
      { orderItemId: line.orderItemId, body: { note: note.trim() } },
      {
        onSuccess: () => {
          toast.add({
            title: `${line.name} can go now`,
            description: `The old part is still owed by ${line.customerName} and stays on your Cores owed list until it arrives.`,
            type: 'success',
          });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not stop waiting',
            description: coreErrorMessage(error, 'Nothing was changed. You can try again.'),
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
      title={`Stop waiting for the old part for ${line.name}?`}
      description={`${line.customerName} chose to send the old part first and paid no deposit. If ${line.waiting === 1 ? 'this part goes' : `these ${String(line.waiting)} parts go`} now, nothing is held against ${line.waiting === 1 ? 'it' : 'them'}: if the old part never comes, there is no deposit to keep.`}
      submitLabel="Don't wait for the old part"
      submitColor="warning"
      submitDisabled={!valid}
      busy={release.isPending}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel required>Why it can go now</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={2}
              value={note}
              placeholder="For example: fleet customer, truck is off the road"
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>Kept with the order, for whoever opens it next.</FieldDescription>
      </Field>
    </ActionDialog>
  );
}
