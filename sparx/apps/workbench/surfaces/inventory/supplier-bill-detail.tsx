'use client';

// ONE SUPPLIER INVOICE, CHECKED AGAINST THE DELIVERY.
//
// Three documents: what was ORDERED, what was RECEIVED, what is being BILLED.
// The comparison that matters is billed-against-RECEIVED — a supplier who ships
// eight of the ten you ordered and invoices for ten has made no ordering error,
// they have billed for goods that are not on your shelf, and only the delivery
// record knows.
//
// ── The check is on the screen, not behind a button ───────────────────────
//
// Every line carries its own verdict, in words, next to the three numbers it was
// worked out from. A screen that needs a second click to say whether the invoice
// agrees is a screen where nobody clicks it.
//
// ── Approving is refused while something is unexplained ───────────────────
//
// That refusal IS the feature. An approval step that can be clicked through
// without reading is a formality, and the discrepancy the software went to the
// trouble of finding gets paid anyway. The way past it is to ACCEPT the
// difference with a written reason, which is recorded against your name — or to
// query it with the supplier, which stops the payment run.

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Text,
  Textarea,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { Ban, Banknote, Check, MessageCircleWarning, Receipt } from 'lucide-react';
import { PANE_SHELL, PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, stockErrorMessage } from './data';
import { NewSupplierBill } from './supplier-bill-new';
import {
  billStatusLabel,
  billStatusTone,
  matchSummary,
  useAcceptBillVariance,
  useApproveSupplierBill,
  useCancelSupplierBill,
  useDisputeSupplierBill,
  useSettleBillQuery,
  useRecordBillPayment,
  useSupplierBill,
  verdictLabel,
  verdictTone,
} from './supplier-bills-data';
import { MoneyTextInput, moneyCents } from '../../components/money-input';

export function SupplierBillDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = ctx.params.id ?? 'new';
  if (id === 'new') return <NewSupplierBill ctx={ctx} />;
  return <ExistingBill ctx={ctx} id={id} />;
}

function ExistingBill({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const bill = useSupplierBill(id);
  const approve = useApproveSupplierBill(id);
  const accept = useAcceptBillVariance(id);
  const dispute = useDisputeSupplierBill(id);
  const settle = useSettleBillQuery(id);
  const pay = useRecordBillPayment(id);
  const cancel = useCancelSupplierBill(id);
  const confirm = useConfirm();
  const toast = useToast();

  const data = bill.data;

  const [reason, setReason] = useState('');
  const [paidAmount, setPaidAmount] = useState('');

  useEffect(() => {
    if (!data) return;
    setPaidAmount((data.totalCents / 100).toString());
  }, [data]);

  if (bill.isError) {
    return (
      <div className={PANE_SHELL}>
        <EmptyState
          icon={<Receipt className="size-6" aria-hidden />}
          title="Could not load that bill"
          description="This is a problem reaching the server, not a statement that the bill is gone. Try again in a moment."
        />
      </div>
    );
  }
  if (bill.isLoading || !data) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-base" role="status">
          Loading the bill…
        </p>
      </div>
    );
  }

  const summary = matchSummary(data.match);
  const fail = (title: string) => (error: unknown) => {
    afterCommit(() => {
      toast.add({
        title,
        description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
        type: 'error',
      });
    });
  };

  const onApprove = () => {
    approve.mutate(undefined, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({
            title: `${data.number} approved to pay`,
            description: `${formatCents(data.totalCents, data.currency)} to ${data.supplierName ?? 'the supplier'}.`,
            type: 'success',
          });
        });
      },
      onError: fail('Could not approve that bill'),
    });
  };

  const onAccept = () => {
    if (reason.trim().length === 0) return;
    accept.mutate(reason.trim(), {
      onSuccess: () => {
        setReason('');
        afterCommit(() => {
          toast.add({
            title: 'Difference accepted',
            description: 'Recorded against your name. The bill can now be approved.',
            type: 'info',
          });
        });
      },
      onError: fail('Could not accept that difference'),
    });
  };

  const onDispute = () => {
    if (reason.trim().length === 0) return;
    dispute.mutate(reason.trim(), {
      onSuccess: () => {
        setReason('');
        afterCommit(() => {
          toast.add({
            title: `${data.number} queried`,
            description: 'It will not be paid until the query is settled.',
            type: 'warning',
          });
        });
      },
      onError: fail('Could not query that bill'),
    });
  };

  const onSettle = () => {
    settle.mutate(undefined, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({
            title: `${data.number} is back with you`,
            description: 'Put the figures right off what they sent back, then approve it.',
            type: 'info',
          });
        });
      },
      onError: fail('Could not settle that query'),
    });
  };

  const onPay = async () => {
    // Read the way a person writes money — "1,250.00", "$8.00" (issue 486).
    const paidCents = paidAmount.trim() === '' ? null : moneyCents(paidAmount);
    if (paidCents === null) return;
    const ok = await confirm({
      title: `Record ${formatCents(paidCents, data.currency)} paid?`,
      description:
        'This records that the money has gone. It does not send a payment. That happens in your bank or your accounting package.',
      confirmLabel: 'It has been paid',
      cancelLabel: 'Not yet',
      color: 'warning',
    });
    if (!ok) return;
    pay.mutate(
      { paidCents },
      {
        onSuccess: () => {
          afterCommit(() => {
            toast.add({ title: `${data.number} marked as paid`, type: 'success' });
          });
        },
        onError: fail('Could not record that payment'),
      }
    );
  };

  const onCancel = async () => {
    const ok = await confirm({
      title: `Cancel ${data.number}?`,
      description:
        'Use this when the invoice was entered by mistake, or the supplier withdrew it. The record stays so the number cannot be quietly reused.',
      confirmLabel: 'Cancel the bill',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    cancel.mutate(undefined, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({ title: `${data.number} canceled`, type: 'info' });
        });
        ctx.close();
      },
      onError: fail('Could not cancel that bill'),
    });
  };

  // Out with the supplier. Nothing about the match matters while it is: the
  // question on the screen is what they came back with, not whether to accept.
  const isQueried = data.status === 'disputed';
  const needsExplaining = data.match.ok === false && data.varianceAcceptedAt === null && !isQueried;
  const isOpen = data.status !== 'paid' && data.status !== 'cancelled';

  return (
    <div className={PANE_SHELL_SCROLL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} className="text-lg">
          <span className="font-mono">{data.number}</span> · {data.supplierName ?? 'Supplier'}
        </Heading>
        <Badge color={billStatusTone(data.status)} variant="soft">
          {billStatusLabel(data.status)}
        </Badge>
      </div>

      <Stats className="w-full">
        <Stat>
          <StatTitle>They are asking for</StatTitle>
          <StatValue>{formatCents(data.totalCents, data.currency)}</StatValue>
          <StatDesc>
            {formatCents(data.subtotalCents, data.currency)} goods
            {data.freightCents > 0
              ? ` + ${formatCents(data.freightCents, data.currency)} carriage`
              : ''}
            {data.taxCents > 0 ? ` + ${formatCents(data.taxCents, data.currency)} tax` : ''}
          </StatDesc>
        </Stat>
        <Stat>
          <StatTitle>The check</StatTitle>
          <StatValue>
            <Badge color={summary.tone} variant="soft">
              {summary.label}
            </Badge>
          </StatValue>
          <StatDesc>
            {/* At stake first, because that is what the badge above is about.
                A remainder nobody has invoiced yet is worth saying out loud —
                another invoice is coming and this is roughly what for — but it
                is not at stake and must never be read as a disagreement. */}
            {data.match.totalVarianceCents !== null && data.match.totalVarianceCents !== 0
              ? `${formatCents(Math.abs(data.match.totalVarianceCents), data.currency)} ${
                  data.match.totalVarianceCents > 0
                    ? 'more than the goods justify'
                    : 'in your favor'
                }`
              : data.match.uninvoicedCents !== null && data.match.uninvoicedCents > 0
                ? `${formatCents(
                    data.match.uninvoicedCents,
                    data.currency
                  )} of this order is still to be invoiced`
                : 'nothing at stake'}
          </StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Due</StatTitle>
          <StatValue>
            {data.paidAt ? (
              'Paid'
            ) : data.dueAt ? (
              <Timestamp value={data.dueAt} format="relative" />
            ) : (
              'No date'
            )}
          </StatValue>
          <StatDesc>
            Invoiced <Timestamp value={data.billedAt} format="relative" />
          </StatDesc>
        </Stat>
      </Stats>

      <Alert color={summary.tone} variant="soft">
        <AlertContent>
          <AlertTitle>{summary.label}</AlertTitle>
          <AlertDescription>{summary.detail}</AlertDescription>
        </AlertContent>
      </Alert>

      {/* Why it is out with them. The card that queried it says an override
          leaving no trace looks exactly like nobody noticing, and then the
          reason went to the database and onto no screen (issue 511). */}
      {isQueried ? (
        <Alert color="danger">
          <AlertContent>
            <AlertTitle>This is out with the supplier</AlertTitle>
            <AlertDescription>{data.notes ?? 'No reason was recorded.'}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {data.varianceAcceptedAt ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>
              The difference was accepted by {data.varianceAcceptedByName ?? 'someone'}
            </AlertTitle>
            <AlertDescription>
              <Timestamp value={data.varianceAcceptedAt} format="relative" />
              {data.notes ? ` (${data.notes})` : ''}
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Card className="min-h-0 overflow-x-auto">
        <Table size="sm">
          <thead>
            <tr>
              <th>Line</th>
              <th className="text-right whitespace-nowrap">Ordered</th>
              <th className="text-right whitespace-nowrap">Arrived</th>
              <th className="text-right whitespace-nowrap">Billed</th>
              <th className="text-right whitespace-nowrap">Each</th>
              <th className="whitespace-nowrap">Check</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td className="w-full max-w-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      {line.productTitle ?? line.description ?? 'Untitled line'}
                    </span>
                    <span className="truncate text-sm">
                      <span className="font-mono">{line.variantSku ?? 'No code'}</span>
                    </span>
                  </span>
                </td>
                <td className="text-right tabular-nums">{line.orderedQuantity ?? '—'}</td>
                <td className="text-right tabular-nums">
                  {/* What arrived, and how much of it somebody else's invoice
                      has already charged for. Without the second line, a row
                      saying 40 arrived, 2 billed and "agrees" looks broken. */}
                  <span className="flex flex-col items-end">
                    <span>{line.receivedQuantity ?? '—'}</span>
                    {line.alreadyBilledQuantity !== null && line.alreadyBilledQuantity > 0 ? (
                      <span className="text-sm">
                        {`${String(line.alreadyBilledQuantity)} on other invoices`}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="text-right tabular-nums">{line.quantity}</td>
                <td className="text-right tabular-nums">
                  <span className="flex flex-col items-end">
                    <span>{formatCents(line.unitCostCents, data.currency)}</span>
                    {line.orderedUnitCostCents !== null &&
                    line.orderedUnitCostCents !== line.unitCostCents ? (
                      <span className="text-sm">
                        agreed {formatCents(line.orderedUnitCostCents, data.currency)}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="whitespace-nowrap">
                  <Badge color={verdictTone(line.match.verdict)} variant="soft" size="sm">
                    {verdictLabel(line.match.verdict)}
                  </Badge>
                  {/* The money the badge is about. A shortfall is worth
                      naming — it is roughly what the next invoice will be —
                      but it lives in its own figure, because it is not money
                      wrongly charged. */}
                  {line.match.amountVarianceCents !== null &&
                  line.match.amountVarianceCents !== 0 ? (
                    <span className="block text-sm">
                      {formatCents(Math.abs(line.match.amountVarianceCents), data.currency)}
                    </span>
                  ) : line.match.uninvoicedCents !== null && line.match.uninvoicedCents > 0 ? (
                    <span className="block text-sm">
                      {formatCents(line.match.uninvoicedCents, data.currency)}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {isOpen ? (
        <Card className="flex flex-col gap-3 p-3">
          <Heading level={3} className="text-base">
            {isQueried
              ? 'While it is with the supplier'
              : needsExplaining
                ? 'Before this can be approved'
                : 'What happens next'}
          </Heading>

          {isQueried ? (
            <>
              <Text className="text-sm">
                Nothing will be paid against this invoice while it is queried. Settle the query once
                the supplier has answered. If they send a credit note or a new invoice, cancel this
                one and enter theirs instead. If they say this one was right, settle it and then
                accept the difference.
              </Text>
              <div className="flex flex-wrap gap-2">
                <Button color="module" loading={settle.isPending} onClick={onSettle}>
                  <Check className="size-4" aria-hidden />
                  The query is settled
                </Button>
              </div>
            </>
          ) : needsExplaining ? (
            <>
              <Text className="text-sm">
                {plural(data.match.linesFlagged, 'line does', 'lines do')} not agree with what was
                ordered and received. Either accept the difference (which is recorded against your
                name) or query it with the supplier, which stops it being paid.
              </Text>
              <Field>
                <FieldLabel>Why</FieldLabel>
                <FieldControl
                  render={
                    <Textarea
                      color="module"
                      rows={2}
                      value={reason}
                      placeholder="Two units were damaged and are going back separately: the invoice is right."
                      onChange={(event) => {
                        setReason(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Required either way. An override that leaves no trace looks exactly like nobody
                  noticing.
                </FieldDescription>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  color="warning"
                  disabled={reason.trim().length === 0}
                  loading={accept.isPending}
                  onClick={onAccept}
                >
                  <Check className="size-4" aria-hidden />
                  Accept the difference
                </Button>
                <Button
                  variant="outline"
                  color="danger"
                  disabled={reason.trim().length === 0}
                  loading={dispute.isPending}
                  onClick={onDispute}
                >
                  <MessageCircleWarning className="size-4" aria-hidden />
                  Query it with them
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              {data.status !== 'approved' ? (
                <Button color="module" loading={approve.isPending} onClick={onApprove}>
                  <Check className="size-4" aria-hidden />
                  Approve to pay
                </Button>
              ) : null}
              <Field className="max-w-48">
                <FieldLabel>Paid</FieldLabel>
                <FieldControl
                  render={
                    <MoneyTextInput
                      color="module"
                      aria-label="How much you paid"
                      text={paidAmount}
                      onTextChange={setPaidAmount}
                    />
                  }
                />
              </Field>
              <Button
                color="success"
                loading={pay.isPending}
                onClick={() => {
                  void onPay();
                }}
              >
                <Banknote className="size-4" aria-hidden />
                Record the payment
              </Button>
              <Button
                className="ml-auto"
                variant="outline"
                color="danger"
                loading={cancel.isPending}
                onClick={() => {
                  void onCancel();
                }}
              >
                <Ban className="size-4" aria-hidden />
                Cancel
              </Button>
            </div>
          )}
        </Card>
      ) : null}

      {data.paidAt ? (
        <Text className="text-sm">
          {formatCents(data.paidCents ?? 0, data.currency)} paid{' '}
          <Timestamp value={data.paidAt} format="relative" />.
        </Text>
      ) : null}
    </div>
  );
}
