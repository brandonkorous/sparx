// Order-status timeline — the lifecycle of an order rendered as a vertical
// rail (placed, paid, shipped, delivered; paid last when it is paid later),
// with cancelled / refunded as
// terminal branches. Driven entirely by the order's own lifecycle timestamps
// (placedAt / paidAt / fulfilledAt / deliveredAt / cancelledAt), so it needs no
// extra data beyond the detail payload. When a shipment carries tracking, the
// "Shipped" step surfaces a real carrier + track-your-package link.
//
// Presentational — composes silica's <Timeline>. Runs in the client tree (the
// order page is a client component) but holds no state of its own.
//
// Each item is a date on the start side, a marker, and the step on the end
// side: silica's timeline is a two-sided grid, and a one-sided rail left the
// steps in the right half of the card with the left half blank (sparx persona
// issue 087). A step the order has REACHED wears the order's tone; unreached
// steps stay plain, so the colored markers read as progress at a glance.
//
// The RAIL ITSELF is silica's, drawn from `.timeline-middle`'s ::before/::after
// — this component adds no <hr> connectors. That markup is another library's
// Timeline contract; silica's says "no <hr> markup" outright, and because each
// <li> is a `1fr auto 1fr` grid whose tracks belong to start/middle/end, a
// class-less <hr> auto-placed into column 1 rendered as a black rule across the
// empty start track of every gap (issue 293). Per-segment rail color is
// therefore not expressible today; that is a silica-level ask, not something to
// re-patch here.

import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Hourglass,
  Package,
  Receipt,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Timeline,
  TimelineEnd,
  TimelineItem,
  TimelineMiddle,
  TimelineStart,
  type SilicaColor,
} from '@wizeworks/silicaui-react';
import { carrierLabel } from '@wizeworks/commerce-schemas';

import type { OrderDetail, OrderFulfillmentView } from '@/lib/customer-client';
import {
  invoiceStep,
  orderStatusLabel,
  orderStatusTone,
  paymentComesFirst,
} from '@/lib/order-status-words';
import { signedSentences, signOffWaitingSentence } from '@/lib/sign-off-words';

// The status words and tones live in `lib/order-status-words`, where they are
// tested; re-exported here for the pages that already import them from this file.
export { orderStatusLabel, orderStatusTone };

// Tailwind needs LITERAL class strings — a `text-${tone}` template never emits.
const MARK_CLASS: Record<string, string> = {
  primary: 'text-primary',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-danger',
};

interface TimelineStep {
  key: string;
  label: string;
  at: string | null;
  complete: boolean;
  terminal?: boolean;
  icon: ReactNode;
  detail?: ReactNode;
  /** Beside the rail in place of a time stamp: an invoice's due date. */
  when?: string | null;
  /** A step that has gone wrong, like an overdue invoice: marked in danger
   *  whatever the order's own tone. */
  problem?: boolean;
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A shipment line: carrier + service and, when present, a tracking link.
 *
 *  The carrier words come from the schema package, not a local map. This file's
 *  copy was the worst of the three that had grown: it told a shopper "Drop-ship"
 *  where the owner's console said "Sent by the supplier", it had no entry for
 *  `other` so its `toUpperCase()` fallback showed the word "OTHER", and a
 *  fulfillment with no carrier at all rendered the literal word "Carrier" beside
 *  the service. The shared helper returns '' for absent, which this `filter`
 *  already knows what to do with. */
function ShipmentLine({ fulfillment }: { fulfillment: OrderFulfillmentView }): ReactNode {
  const label = [carrierLabel(fulfillment.carrier), fulfillment.service]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="mt-1.5 text-sm">
      <span className="text-base-content">{label}</span>
      {fulfillment.trackingNumber ? (
        fulfillment.trackingUrl ? (
          <a
            href={fulfillment.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary ml-2 inline-flex items-center gap-1 font-semibold"
          >
            Track {fulfillment.trackingNumber}
            <ExternalLink size={13} aria-hidden />
          </a>
        ) : (
          <span className="text-base-content ml-2">Tracking {fulfillment.trackingNumber}</span>
        )
      ) : null}
    </div>
  );
}

/** Build the ordered lifecycle steps + the track's overall tone from the order. */
function buildTimeline(
  order: OrderDetail,
  viewerId: string | null
): { steps: TimelineStep[]; color: SilicaColor } {
  const cancelled = order.status === 'cancelled';
  const refunded = order.status === 'refunded' || order.paymentStatus === 'refunded';
  const terminal = cancelled ? 'cancelled' : refunded ? 'refunded' : null;

  const shipments = order.fulfillments.filter(
    (f) =>
      Boolean(f.trackingNumber) ||
      Boolean(f.carrier) ||
      f.status === 'shipped' ||
      f.status === 'delivered'
  );

  // A held wholesale order is not placed until it is signed off, so its first
  // step says it was received, the words the checkout's last screen used, and
  // the next says who it is waiting on and who has already said yes. It read
  // "Waiting for approval" with nobody named, while the one person who could
  // release it was the buyer's own colleague (sparx persona issue 087).
  const held = order.status === 'pending_approval';
  const steps: TimelineStep[] = [
    {
      key: 'placed',
      label: held ? 'Order received' : 'Order placed',
      at: order.placedAt,
      complete: true,
      icon: <Receipt size={16} aria-hidden />,
    },
  ];
  if (held) {
    const signOff = order.signOff ?? null;
    steps.push({
      key: 'approval',
      label: 'Waiting for approval',
      at: null,
      complete: false,
      icon: <Hourglass size={16} aria-hidden />,
      detail: signOff ? (
        <div className="text-base-content mt-0.5 flex flex-col gap-0.5 text-sm">
          <span>{signOffWaitingSentence(signOff, null, viewerId)}</span>
          {signedSentences(signOff, null, viewerId).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ) : undefined,
    });
  }
  // Where the money sits in the story. A card paid at checkout is confirmed
  // straight after the order; an order on account terms, against an invoice or
  // paid by hand is paid after it ships, so its payment is the last step, still
  // to come, never "next" ahead of the goods (sparx persona issue 087).
  // On account terms the payment is the invoice, and it is always last.
  const onAccount = order.onAccount ?? null;
  const paidFirst = onAccount === null && paymentComesFirst(order);
  const payment: TimelineStep = {
    key: 'paid',
    label: paidFirst ? 'Payment confirmed' : 'Payment received',
    at: order.paidAt,
    complete: Boolean(order.paidAt) || order.paymentStatus === 'paid',
    icon: <CreditCard size={16} aria-hidden />,
  };
  if (paidFirst) steps.push(payment);

  const shippedComplete = Boolean(order.fulfilledAt);
  const deliveredComplete = Boolean(order.deliveredAt);

  // On a live order, show the road ahead (shipped/delivered as upcoming). On a
  // terminal (cancelled/refunded) order, only show stages actually reached.
  if (!terminal || shippedComplete) {
    steps.push({
      key: 'shipped',
      label: 'On its way',
      at: order.fulfilledAt,
      complete: shippedComplete,
      icon: <Truck size={16} aria-hidden />,
      detail:
        shippedComplete && shipments.length > 0 ? (
          <>
            {shipments.map((f) => (
              <ShipmentLine key={f.id} fulfillment={f} />
            ))}
          </>
        ) : undefined,
    });
  }
  if (!terminal || deliveredComplete) {
    steps.push({
      key: 'delivered',
      label: 'Delivered',
      at: order.deliveredAt,
      complete: deliveredComplete,
      icon: deliveredComplete ? (
        <CheckCircle2 size={16} aria-hidden />
      ) : (
        <Package size={16} aria-hidden />
      ),
    });
  }

  // Paid later: the last thing to happen to a live order. A canceled or
  // refunded order shows it only if money actually moved.
  if (onAccount !== null) {
    // The invoice: what is due and when, overdue marked as a problem, "Invoice
    // paid" once it is, and on a held order, that it comes once approved (sparx
    // persona issue 087). A canceled order shows it only if one was issued.
    if (!terminal || onAccount.invoice !== null) {
      const invoice = invoiceStep({ onAccount, held, currency: order.currency });
      steps.push({
        key: 'invoice',
        label: invoice.label,
        at: onAccount.invoice?.status === 'paid' ? order.paidAt : null,
        when: invoice.when,
        complete: invoice.complete,
        problem: invoice.overdue,
        icon: <Receipt size={16} aria-hidden />,
        detail: invoice.detail ? (
          <span className="text-base-content mt-0.5 block text-sm">{invoice.detail}</span>
        ) : undefined,
      });
    }
  } else if (!paidFirst && (!terminal || payment.complete)) {
    steps.push(payment);
  }

  if (cancelled) {
    steps.push({
      key: 'cancelled',
      label: 'Order canceled',
      at: order.cancelledAt,
      complete: true,
      terminal: true,
      icon: <XCircle size={16} aria-hidden />,
    });
  } else if (refunded) {
    steps.push({
      key: 'refunded',
      label: 'Refunded',
      at: null,
      complete: true,
      terminal: true,
      icon: <RotateCcw size={16} aria-hidden />,
    });
  }

  // The track wears the order's own status tone, so it always agrees with the
  // badge above it: in motion is info, waiting is warning, done is success.
  const color: SilicaColor = cancelled
    ? 'danger'
    : refunded
      ? 'warning'
      : orderStatusTone(order.status);

  return { steps, color };
}

/** Resolve each step's visual state: the first unreached non-terminal step is
 *  the "active" (next expected) one; a terminal step is always active. */
type StepState = 'complete' | 'active' | 'upcoming';
function resolveState(steps: TimelineStep[], terminal: boolean): StepState[] {
  let activeAssigned = false;
  return steps.map((step) => {
    if (step.terminal) return 'active';
    if (step.complete) return 'complete';
    // On a terminal order nothing is "in progress" — unreached stages are muted.
    if (terminal) return 'upcoming';
    if (!activeAssigned) {
      activeAssigned = true;
      return 'active';
    }
    return 'upcoming';
  });
}

export function OrderTimeline({
  order,
  viewerId = null,
}: {
  order: OrderDetail;
  /** The signed-in customer, so a sign-off they are part of says "you". */
  viewerId?: string | null;
}) {
  const { steps, color } = buildTimeline(order, viewerId);
  const isTerminal = order.status === 'cancelled' || order.status === 'refunded';
  const states = resolveState(steps, isTerminal);
  const mark = MARK_CLASS[color] ?? 'text-primary';

  return (
    <Timeline>
      {steps.map((step, i) => {
        const reached = states[i] !== 'upcoming';
        return (
          <TimelineItem key={step.key}>
            {/* When it happened, on the start side of the rail. The silica
                timeline is a two-sided grid, and with this side left empty the
                steps sat in the right half of the card with the left half blank
                (sparx persona issue 087). */}
            <TimelineStart className={step.problem ? 'text-danger text-sm' : 'text-sm'}>
              {step.at
                ? formatStamp(step.at)
                : (step.when ?? (states[i] === 'active' && !step.terminal ? 'In progress' : null))}
            </TimelineStart>
            <TimelineMiddle
              className={step.problem ? 'text-danger' : reached ? mark : 'text-base-content'}
            >
              {step.icon}
            </TimelineMiddle>
            <TimelineEnd className="pb-6">
              <span
                className={
                  step.problem
                    ? 'text-danger block text-base font-semibold'
                    : 'text-base-content block text-base font-semibold'
                }
              >
                {step.label}
              </span>
              {step.detail}
            </TimelineEnd>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
