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
// ── Everything here is read-mostly ────────────────────────────────────────
//
// One control writes: the new expected date, because until now there was no way
// at all to record "they rang to say it will be a fortnight" — the buyer either
// left a date they knew was wrong, which made the overdue list useless, or the
// order stayed permanently late. Everything else links out to the surface that
// owns it, so the order pane never grows a second editor.

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
  Input,
  Table,
  Text,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { CalendarClock, Receipt, Truck } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, stockErrorMessage } from './data';
import { asnStatusLabel, asnStatusTone, useOrderAsns } from './advance-ship-notices-data';
import {
  useCancelPoApproval,
  useOrderApprovals,
  useRescheduleArrival,
  waitingTone,
} from './po-approvals-data';
import { billStatusLabel, billStatusTone, useSupplierBills } from './supplier-bills-data';

interface Props {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  status: string;
  expectedArrivalAt: string | null;
  currency: string;
  ctx: SurfaceContext;
}

export function PurchaseOrderProcurement(props: Props) {
  const { status } = props;
  const placed = status === 'submitted' || status === 'partial' || status === 'received';

  return (
    <>
      {status === 'pending_approval' ? <HeldForApproval {...props} /> : null}
      {status === 'submitted' || status === 'partial' ? <Reschedule {...props} /> : null}
      {placed || status === 'closed' ? <Notices {...props} /> : null}
      {placed || status === 'closed' ? <Bills {...props} /> : null}
    </>
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
          <Text className="text-sm">
            {pending.requiredApproverName
              ? `${pending.requiredApproverName} has to sign it off.`
              : 'Anybody who can approve spending can sign it off.'}
            {pending.ruleName ? ` Held by “${pending.ruleName}”.` : ''}
          </Text>
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

function Reschedule({ purchaseOrderId, expectedArrivalAt }: Props) {
  const reschedule = useRescheduleArrival();
  const toast = useToast();

  const [date, setDate] = useState(() => (expectedArrivalAt ?? '').slice(0, 10));
  const [dirty, setDirty] = useState(false);

  const overdue = expectedArrivalAt !== null && new Date(expectedArrivalAt).getTime() < Date.now();

  const onSave = () => {
    reschedule.mutate(
      {
        id: purchaseOrderId,
        expectedArrivalAt: date === '' ? null : new Date(date).toISOString(),
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
                  : 'If they miss this one too, you will hear about it.',
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
              It has been flagged once. Recording a new date starts the clock again, so a second
              broken promise is heard rather than lost in the first one.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field className="max-w-56">
          <FieldLabel>New expected date</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setDirty(true);
                }}
              />
            }
          />
          <FieldDescription>
            Clear it if they genuinely cannot say — an honest blank is better than a date nobody
            believes.
          </FieldDescription>
        </Field>
        <Button color="module" disabled={!dirty} loading={reschedule.isPending} onClick={onSave}>
          <CalendarClock className="size-4" aria-hidden />
          Record it
        </Button>
      </div>
    </FormSection>
  );
}

/* ── What they say has shipped ──────────────────────────────────────────── */

function Notices({ purchaseOrderId, ctx }: Props) {
  const notices = useOrderAsns(purchaseOrderId);
  const rows = notices.data?.items ?? [];

  return (
    <FormSection
      title="What they say has shipped"
      description="Recording a supplier’s dispatch note means receiving starts pre-filled — and means a short delivery is visible instead of being invisible."
    >
      {notices.isError ? (
        <Text className="text-sm">
          Could not check for shipment notices — a problem reaching the server, not a statement that
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
                <td className="w-full max-w-0">
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
                  {row.expectedArrivalAt ? (
                    <Timestamp value={row.expectedArrivalAt} format="relative" />
                  ) : (
                    '—'
                  )}
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

      <div>
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            ctx.open('inventory.advance-ship-notices', {}, { target: 'tab' });
          }}
        >
          <Truck className="size-4" aria-hidden />
          See everything on the way
        </Button>
      </div>
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
          Could not check for invoices — a problem reaching the server, not a statement that none
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
                <td className="w-full max-w-0">
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
          <Receipt className="size-4" aria-hidden />
          Enter their invoice
        </Button>
      </div>
    </FormSection>
  );
}
