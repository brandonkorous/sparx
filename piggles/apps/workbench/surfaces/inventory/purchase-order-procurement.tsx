'use client';

// The Phase 8 panels that belong on a purchase order's own pane: who is holding
// it, when it is now expected, what the supplier says has shipped, and what they
// have billed.
//
// Its own file because purchase-order-detail.tsx is already the ORDER — the
// header, the lines, the money, the lifecycle. These four are about everything
// that happens AROUND the order, and folding them into that file would have made
// a 1,700-line screen into a 2,300-line one with two unrelated jobs.
//
// ── Everything here is read-mostly, bar two ───────────────────────────────
//
// The first writer is the new expected date, because until now there was no way
// at all to record "they rang to say it will be a fortnight" — the buyer either
// left a date they knew was wrong, which made the overdue list useless, or the
// order stayed permanently late.
//
// The second is the dispatch note, and it is here for the same reason: there was
// no way to record one ANYWHERE. Both the order pane and the On the way list
// told the buyer to do it on the other, and zero notices existed on the whole
// platform. The form is its own file (asn-record-dialog.tsx) so this one stays a
// set of panels rather than becoming a second editor.
//
// Everything else links out to the surface that owns it.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Text,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faCalendarClock, faReceipt, faTruck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, stockErrorMessage } from './data';
import { asnStatusLabel, asnStatusTone, useOrderAsns } from './advance-ship-notices-data';
import { RecordShipmentDialog } from './asn-record-dialog';
import {
  useCancelPoApproval,
  useOrderApprovals,
  useRescheduleArrival,
  waitingTone,
} from './po-approvals-data';
import { sentBackNote, whoSignsLine } from './po-approvals-words';
import { billStatusLabel, billStatusTone, useSupplierBills } from './supplier-bills-data';
import { badDayIn, dayStartUtc } from '../../lib/today';
import { DayInput } from '../../components/day-input';
import { dayCountLabel } from './purchase-orders-data';
import { useBusinessZone } from '../../lib/business-timezone';
import { daysUntilDue } from '../../lib/console/days';

interface Props {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  status: string;
  expectedArrivalAt: string | null;
  /** Null until the nightly pass has announced this order as late. The panel
   *  below used to STATE that it had been flagged, every time, with nothing to
   *  read it from; measured 2026-09-18, not one purchase order on the platform
   *  had ever been flagged. A sentence of fact needs a field behind it. */
  lateAlertedAt: string | null;
  currency: string;
  ctx: SurfaceContext;
}

export function PurchaseOrderProcurement(props: Props) {
  const { status } = props;
  const placed = status === 'submitted' || status === 'partial' || status === 'received';

  return (
    <>
      {status === 'draft' ? <SentBack {...props} /> : null}
      {status === 'pending_approval' ? <HeldForApproval {...props} /> : null}
      {status === 'submitted' || status === 'partial' ? <Reschedule {...props} /> : null}
      {placed || status === 'closed' ? <Notices {...props} /> : null}
      {placed || status === 'closed' ? <Bills {...props} /> : null}
    </>
  );
}

/* ── Turned down, and back with the buyer ────────────────────── */

/**
 * The refusal, on the screen of the person it is addressed to.
 *
 * Turning an order down REQUIRES a reason — the server refuses a "no" without
 * one, and the box asking for it says "Required. The buyer sees it, and it stays
 * on the order's history." The buyer saw a draft reading "Not sent yet. You can
 * still change anything on it." and nothing else, so the reasonable next move was
 * to place the identical order again and be refused again.
 *
 * Rendered from the order's own trail, which is why `useOrderApprovals` had to
 * stop asking for pending requests only.
 */
function SentBack({ purchaseOrderId, status, ctx }: Props) {
  const approvals = useOrderApprovals(purchaseOrderId);
  const note = sentBackNote(approvals.data?.items, status);
  if (!note) return null;

  return (
    <FormSection title="Sent back">
      <Alert color="danger">
        <AlertContent>
          <AlertTitle>{note.title}</AlertTitle>
          <AlertDescription>{note.detail}</AlertDescription>
        </AlertContent>
      </Alert>

      <Field>
        <FieldLabel>What they asked for</FieldLabel>
        <Text>{note.reason}</Text>
        <FieldDescription>
          It stays on this order&apos;s history. Place it again when you have changed it.
        </FieldDescription>
      </Field>

      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            ctx.open('inventory.purchase-orders.approvals', {}, { target: 'tab' });
          }}
        >
          See every sign-off
        </Button>
      </div>
    </FormSection>
  );
}

/* ── Waiting for somebody to sign ───────────────────────────────────────── */

function HeldForApproval({ purchaseOrderId, purchaseOrderNumber, ctx }: Props) {
  const approvals = useOrderApprovals(purchaseOrderId);
  const withdraw = useCancelPoApproval();
  const toast = useToast();

  const pending = approvals.data?.items.find((row) => row.status === 'pending') ?? null;

  return (
    <FormSection title="Waiting for sign-off">
      <Alert color="warning">
        <AlertContent>
          <AlertTitle>Nothing has been ordered yet</AlertTitle>
          <AlertDescription>
            {purchaseOrderNumber} is over a limit your business set, so it is held until somebody
            approves it. The supplier has not seen it, and nothing can be received against it.
          </AlertDescription>
        </AlertContent>
      </Alert>

      {pending ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge color={waitingTone(pending.waitingDays)} variant="soft">
            {pending.waitingDays === null || pending.waitingDays === 0
              ? 'asked today'
              : `waiting ${plural(pending.waitingDays, 'day', 'days')}`}
          </Badge>
          <Text className="text-sm">{whoSignsLine(pending)}</Text>
          <Button
            className="ml-auto"
            size="sm"
            variant="outline"
            color="neutral"
            loading={withdraw.isPending}
            onClick={() => {
              withdraw.mutate(pending.id, {
                onSuccess: () => {
                  afterCommit(() => {
                    toast.add({
                      title: 'Request withdrawn',
                      description: 'The order is a draft again, so you can change it.',
                      type: 'info',
                    });
                  });
                },
                onError: (error) => {
                  afterCommit(() => {
                    toast.add({
                      title: 'Could not withdraw that request',
                      description: stockErrorMessage(error, 'Nothing was changed.'),
                      type: 'error',
                    });
                  });
                },
              });
            }}
          >
            Withdraw and edit
          </Button>
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open('inventory.purchase-orders.approvals', {}, { target: 'tab' });
            }}
          >
            Open sign-offs
          </Button>
        </div>
      ) : null}
    </FormSection>
  );
}

/* ── A new promised date ────────────────────────────────────────────────── */

function Reschedule({ purchaseOrderId, expectedArrivalAt, lateAlertedAt }: Props) {
  const reschedule = useRescheduleArrival();
  const toast = useToast();

  const [date, setDate] = useState(() => (expectedArrivalAt ?? '').slice(0, 10));
  const [dirty, setDirty] = useState(false);

  const overdue = expectedArrivalAt !== null && new Date(expectedArrivalAt).getTime() < Date.now();

  const onSave = () => {
    const bad = badDayIn(date);
    if (bad) {
      toast.add({ title: 'Check the arrival date', description: bad, type: 'error' });
      return;
    }
    reschedule.mutate(
      {
        id: purchaseOrderId,
        expectedArrivalAt: date === '' ? null : dayStartUtc(date),
      },
      {
        onSuccess: () => {
          setDirty(false);
          afterCommit(() => {
            toast.add({
              title: date === '' ? 'Expected date cleared' : 'New date recorded',
              description:
                date === ''
                  ? 'This order will no longer be reported as overdue, because nothing says when it was due.'
                  : // NOT "you will hear about it": nobody in the business is emailed or
                    // notified when an order goes late. The one thing that IS true is the
                    // overdue list, which is read live and needs no nightly pass to be
                    // right. Say the true thing. [[feedback_a_promise_in_copy_is_a_contract]]
                    'If they miss this one too, it comes back on your overdue list.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          afterCommit(() => {
            toast.add({
              title: 'Could not record that date',
              description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <FormSection
      title="When it is expected"
      description="When a supplier gives you a new date, record it here. It is what the overdue list is measured against."
    >
      {overdue ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>This order is past its date</AlertTitle>
            <AlertDescription>
              {/* "It has been flagged once" was printed here unconditionally,
                  over a field the pane never read. And "flagged" is what the
                  code calls it: nobody in the business is emailed or notified,
                  so the words must not imply it. Same phrasing as the Overdue
                  deliveries list, which is the other place this fact appears. */}
              {lateAlertedAt === null ? (
                <>
                  Nothing has been passed to your other software about it yet: that happens once, on
                  the nightly check.
                </>
              ) : (
                <>
                  {/* Relative, not absolute. `absolute` is "6:10 PM" on the day it
                      happened and "Sep 12" after that, so no single preposition
                      fits both; "3 hours ago" and "6 days ago" both read as
                      English. The exact moment is on the hover tooltip. */}
                  It was passed to your other software once,{' '}
                  <Timestamp value={lateAlertedAt} format="relative" />.
                </>
              )}{' '}
              Recording a new date starts the clock again, so a second broken promise is heard
              rather than lost in the first one.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field className="max-w-56">
          <FieldLabel>New expected date</FieldLabel>
          <FieldControl
            render={
              <DayInput
                color="module"
                value={date}
                onValueChange={(value) => {
                  setDate(value);
                  setDirty(true);
                }}
              />
            }
          />
          <FieldDescription>
            Clear it if they genuinely cannot say: an honest blank is better than a date nobody
            believes.
          </FieldDescription>
        </Field>
        <Button color="module" disabled={!dirty} loading={reschedule.isPending} onClick={onSave}>
          <Icon glyph={faCalendarClock} className="size-4" aria-hidden />
          Record it
        </Button>
      </div>
    </FormSection>
  );
}

/* ── What they say has shipped ──────────────────────────────────────────── */

function Notices({ purchaseOrderId, purchaseOrderNumber, status, ctx }: Props) {
  const notices = useOrderAsns(purchaseOrderId);
  // Calendar days in the SHOP's own zone, never elapsed hours on whichever
  // clock the reader happens to be near. `lib/console/days.ts` is the rule.
  const zone = useBusinessZone();
  const now = new Date();
  const rows = notices.data?.items ?? [];
  const [recording, setRecording] = useState(false);
  // The service refuses a notice against anything but an open order, so the
  // button is only offered where it can actually work. Received and closed
  // orders keep the list, because what they said they sent is still a record.
  const canRecord = status === 'submitted' || status === 'partial';

  return (
    <FormSection
      title="What they say has shipped"
      description="Recording a supplier’s dispatch note means receiving starts pre-filled, and means a short delivery is visible instead of being invisible."
    >
      {notices.isError ? (
        <Text className="text-sm">
          Could not check for shipment notices: a problem reaching the server, not a statement that
          there are none.
        </Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm">
          Nothing recorded. Without a dispatch note, a short shipment and a short order look
          identical when the invoice arrives.
        </Text>
      ) : (
        <Table size="sm">
          <thead>
            <tr>
              <th>Shipment</th>
              <th className="text-right whitespace-nowrap">Units</th>
              <th className="whitespace-nowrap">Expected</th>
              <th className="whitespace-nowrap">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                onClick={() => {
                  ctx.open(
                    'inventory.advance-ship-notices.detail',
                    { id: row.id },
                    { target: 'beside' }
                  );
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  ctx.open('inventory.advance-ship-notices.detail', { id: row.id });
                }}
              >
                <td className="w-full max-w-0 min-w-56">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-mono">{row.number}</span>
                    <span className="truncate text-sm">
                      {row.carrier ?? 'No carrier given'}
                      {row.trackingNumber ? ` · ${row.trackingNumber}` : ''}
                    </span>
                  </span>
                </td>
                <td className="text-right tabular-nums">{row.unitsShipped}</td>
                <td className="whitespace-nowrap">
                  {row.expectedArrivalAt
                    ? dayCountLabel(daysUntilDue(row.expectedArrivalAt, now, zone))
                    : '—'}
                </td>
                <td className="whitespace-nowrap">
                  <Badge color={asnStatusTone(row)} variant="soft" size="sm">
                    {asnStatusLabel(row)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="flex flex-wrap gap-2">
        {canRecord ? (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              setRecording(true);
            }}
          >
            <Icon glyph={faTruck} className="size-4" aria-hidden />
            Record what they sent
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            ctx.open('inventory.advance-ship-notices', {}, { target: 'tab' });
          }}
        >
          See everything on the way
        </Button>
      </div>

      {canRecord ? (
        <RecordShipmentDialog
          open={recording}
          onClose={() => {
            setRecording(false);
          }}
          purchaseOrderId={purchaseOrderId}
          purchaseOrderNumber={purchaseOrderNumber}
        />
      ) : null}
    </FormSection>
  );
}

/* ── What they have billed ──────────────────────────────────────────────── */

function Bills({ purchaseOrderId, currency, ctx }: Props) {
  const bills = useSupplierBills({ purchaseOrderId });
  const rows = bills.data?.items ?? [];

  return (
    <FormSection
      title="What they have billed"
      description="Entering the invoice here checks it, line by line, against what was ordered and what actually turned up."
    >
      {bills.isError ? (
        <Text className="text-sm">
          Could not check for invoices: a problem reaching the server, not a statement that none
          have arrived.
        </Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm">No invoice entered against this order yet.</Text>
      ) : (
        <Table size="sm">
          <thead>
            <tr>
              <th>Invoice</th>
              <th className="text-right whitespace-nowrap">Amount</th>
              <th className="whitespace-nowrap">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                onClick={() => {
                  ctx.open('inventory.supplier-bills.detail', { id: row.id }, { target: 'beside' });
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  ctx.open('inventory.supplier-bills.detail', { id: row.id });
                }}
              >
                <td className="w-full max-w-0 min-w-56">
                  <span className="truncate font-mono">{row.number}</span>
                </td>
                <td className="text-right whitespace-nowrap tabular-nums">
                  {formatCents(row.totalCents, row.currency || currency)}
                </td>
                <td className="whitespace-nowrap">
                  <Badge color={billStatusTone(row.status)} variant="soft" size="sm">
                    {billStatusLabel(row.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div>
        <Button
          size="sm"
          color="module"
          onClick={() => {
            ctx.open('inventory.supplier-bills.detail', { id: 'new', purchaseOrderId });
          }}
        >
          <Icon glyph={faReceipt} className="size-4" aria-hidden />
          Enter their invoice
        </Button>
      </div>
    </FormSection>
  );
}
