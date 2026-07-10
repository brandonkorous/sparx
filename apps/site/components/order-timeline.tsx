// Order-status timeline — the lifecycle of an order rendered as a vertical
// rail (placed → paid → shipped → delivered), with cancelled / refunded as
// terminal branches. Driven entirely by the order's own lifecycle timestamps
// (placedAt / paidAt / fulfilledAt / deliveredAt / cancelledAt), so it needs no
// extra data beyond the detail payload. When a shipment carries tracking, the
// "Shipped" step surfaces a real carrier + track-your-package link.
//
// Presentational — composes silica's <Timeline>. Runs in the client tree (the
// order page is a client component) but holds no state of its own.
//
// The rail is one-sided (no <TimelineStart>): each item is a marker + content.
// A step the order has REACHED wears the order's tone; unreached steps stay
// neutral, so the filled portion of the rail reads as progress at a glance.

import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
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
  type SilicaColor,
} from '@wizeworks/silicaui-react';

import { cn } from '@/lib/cn';
import type { OrderDetail, OrderFulfillmentView } from '@/lib/customer-client';

/** Semantic tone for an order status — used by the header badge and the
 *  timeline track so the two always agree. */
export function orderStatusTone(status: string): SilicaColor {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'fulfilled':
      return 'info';
    case 'cancelled':
      return 'danger';
    case 'refunded':
      return 'warning';
    default:
      return 'primary';
  }
}

// Tailwind needs LITERAL class strings — a `bg-${tone}` template never emits.
const RAIL_CLASS: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
};
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
}

const CARRIER_LABELS: Record<string, string> = {
  ups: 'UPS',
  usps: 'USPS',
  fedex: 'FedEx',
  dhl: 'DHL',
  digital: 'Digital delivery',
  dropship: 'Drop-ship',
};

function carrierLabel(carrier: string | null): string {
  if (!carrier) return 'Carrier';
  return CARRIER_LABELS[carrier] ?? carrier.toUpperCase();
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

/** A shipment line: carrier + service and, when present, a tracking link. */
function ShipmentLine({ fulfillment }: { fulfillment: OrderFulfillmentView }): ReactNode {
  const label = [carrierLabel(fulfillment.carrier), fulfillment.service]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="mt-1.5 text-sm">
      <span className="text-base-content/60">{label}</span>
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
          <span className="text-base-content/60 ml-2">Tracking {fulfillment.trackingNumber}</span>
        )
      ) : null}
    </div>
  );
}

/** Build the ordered lifecycle steps + the track's overall tone from the order. */
function buildTimeline(order: OrderDetail): { steps: TimelineStep[]; color: SilicaColor } {
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

  const steps: TimelineStep[] = [
    {
      key: 'placed',
      label: 'Order placed',
      at: order.placedAt,
      complete: true,
      icon: <Receipt size={16} aria-hidden />,
    },
    {
      key: 'paid',
      label: 'Payment confirmed',
      at: order.paidAt,
      complete: Boolean(order.paidAt) || order.paymentStatus === 'paid',
      icon: <CreditCard size={16} aria-hidden />,
    },
  ];

  const shippedComplete = Boolean(order.fulfilledAt);
  const deliveredComplete = Boolean(order.deliveredAt);

  // On a live order, show the road ahead (shipped/delivered as upcoming). On a
  // terminal (cancelled/refunded) order, only show stages actually reached.
  if (!terminal || shippedComplete) {
    steps.push({
      key: 'shipped',
      label: 'Shipped',
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

  if (cancelled) {
    steps.push({
      key: 'cancelled',
      label: 'Order cancelled',
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

  const color: SilicaColor = cancelled
    ? 'danger'
    : refunded
      ? 'warning'
      : order.status === 'delivered'
        ? 'success'
        : 'primary';

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

export function OrderTimeline({ order }: { order: OrderDetail }) {
  const { steps, color } = buildTimeline(order);
  const isTerminal = order.status === 'cancelled' || order.status === 'refunded';
  const states = resolveState(steps, isTerminal);
  const rail = RAIL_CLASS[color] ?? 'bg-primary';
  const mark = MARK_CLASS[color] ?? 'text-primary';

  return (
    <Timeline>
      {steps.map((step, i) => {
        const reached = states[i] !== 'upcoming';
        // A connector is "filled" only when BOTH steps it joins are reached.
        const before = i > 0 && reached;
        const after = i < steps.length - 1 && states[i + 1] !== 'upcoming';
        return (
          <TimelineItem key={step.key}>
            {i > 0 ? <hr className={before ? rail : 'bg-base-300'} /> : null}
            <TimelineMiddle className={reached ? mark : 'text-base-content/30'}>
              {step.icon}
            </TimelineMiddle>
            <TimelineEnd className="pb-6">
              <span
                className={cn(
                  'block text-base font-semibold',
                  reached ? 'text-base-content' : 'text-base-content/50'
                )}
              >
                {step.label}
              </span>
              {step.at ? (
                <span className="text-base-content/60 mt-0.5 block text-sm">
                  {formatStamp(step.at)}
                </span>
              ) : states[i] === 'active' && !step.terminal ? (
                <span className="text-base-content/60 mt-0.5 block text-sm">In progress</span>
              ) : null}
              {step.detail}
            </TimelineEnd>
            {i < steps.length - 1 ? <hr className={after ? rail : 'bg-base-300'} /> : null}
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
