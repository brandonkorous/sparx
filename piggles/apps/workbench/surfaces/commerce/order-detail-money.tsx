'use client';

// The money that moved on this order: every attempt to take it, and everything
// given back.

import { Badge } from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { SubSection } from './order-detail-blocks';
import { RecordPayment } from './record-payment';
import type { useOrderPayments, useOrderRefunds } from './data';
import {
  amountDue,
  formatDateTime,
  formatMoney,
  paymentRecordTone,
  refundTone,
  PAYMENT_PROCESSOR_LABELS,
  PAYMENT_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  type Order,
} from './data';

const ROW =
  'border-base-300 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0';

/**
 * What a person wrote down about this payment.
 *
 * `metadata.note` is where it belongs and where it goes now. `processorRef` is
 * read as a fallback because payments taken before issue 223 was fixed have the
 * note stored there — on a hand-taken payment that field only ever held what
 * somebody typed, so showing it is the honest reading of an old row.
 */
function paymentNote(payment: {
  processor: string;
  processorRef: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const note = payment.metadata?.note;
  if (typeof note === 'string' && note.trim()) return note.trim();
  if (payment.processor === 'stripe' || payment.processor === 'paypal') return null;
  const older = payment.processorRef?.trim() ?? '';
  return older === '' ? null : older;
}

export function PaymentsSection({
  order,
  payments,
}: {
  order: Order;
  payments: ReturnType<typeof useOrderPayments>;
}) {
  const due = amountDue(order);
  return (
    <SubSection
      title="Money in"
      description="Every attempt to take payment for this order, including the ones that did not work."
      isPending={payments.isPending}
      isError={payments.isError}
      errorText="We could not load the payments just now. The order and its money are unaffected — try reopening this order in a moment."
      emptyText="No payment has been recorded against this order yet."
      count={payments.data?.length ?? 0}
      footer={
        /* Only while money is actually outstanding. Offering the box on an
           order that is already square invites a second payment onto it. */
        due > 0 ? <RecordPayment order={order} due={due} /> : null
      }
    >
      <ul className="flex flex-col">
        {(payments.data ?? []).map((payment) => (
          <li key={payment.id} className={ROW}>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-medium">
                {formatMoney(payment.amount, payment.currency)} ·{' '}
                {PAYMENT_PROCESSOR_LABELS[payment.processor] ?? payment.processor}
              </span>
              <span className="text-sm">
                {formatDateTime(payment.capturedAt ?? payment.createdAt)}
              </span>
              {/* What she wrote down when the money came in. The box asked for a
                  cheque number and then showed it back nowhere (issue 223). */}
              {paymentNote(payment) ? (
                <span className="text-sm">{paymentNote(payment)}</span>
              ) : null}
              {payment.failureReason ? (
                <span className="text-sm">{payment.failureReason}</span>
              ) : null}
            </div>
            <Badge color={paymentRecordTone(payment.status)} variant="soft" size="sm">
              {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
            </Badge>
          </li>
        ))}
      </ul>
    </SubSection>
  );
}

/** Renders only when there are refunds: an empty "Refunds — none" card on every
 *  healthy order trains people to skip the bottom of this pane. */
export function RefundsSection({ refunds }: { refunds: ReturnType<typeof useOrderRefunds> }) {
  const rows = refunds.data ?? [];
  if (rows.length === 0) return null;
  return (
    <FormSection title="Money given back">
      <ul className="flex flex-col">
        {rows.map((refund) => (
          <li key={refund.id} className={ROW}>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-medium">
                {formatMoney(refund.amount, refund.currency)}
              </span>
              <span className="text-sm">
                {formatDateTime(refund.refundedAt ?? refund.createdAt)}
              </span>
              {refund.reason ? <span className="text-sm">{refund.reason}</span> : null}
            </div>
            <Badge color={refundTone(refund.status)} variant="soft" size="sm">
              {REFUND_STATUS_LABELS[refund.status] ?? refund.status}
            </Badge>
          </li>
        ))}
      </ul>
    </FormSection>
  );
}
