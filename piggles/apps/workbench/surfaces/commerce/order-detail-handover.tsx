'use client';

// How the order reaches the customer — one card with two vocabularies.
//
// The words follow the shopper's own choice rather than the module's:
// "Deliveries" on an order nobody is delivering is the kind of wrongness that
// makes a person distrust every other word on the screen.

import { Badge } from '@wizeworks/silicaui-react';
import { faArrowUpRightFromSquare } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { SubSection } from './order-detail-blocks';
import { RecordHandover } from './record-handover';
import type { useOrderFulfillments } from './data';
import {
  formatDateTime,
  fulfillmentTone,
  shipmentHeadline,
  shipmentStatusLabel,
  type Order,
} from './data';
import type { DeliveryPlan } from './order-types';

type Fulfillments = ReturnType<typeof useOrderFulfillments>;
type Shipment = NonNullable<Fulfillments['data']>[number];

const ROW =
  'border-base-300 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0';

/** A collection was not "sent" anywhere, and a shipment with no despatch time
 *  has not been sent yet — so this falls back to when the record was made and
 *  SAYS that, rather than presenting it as a despatch. */
function whenItMoved(shipment: Shipment): string {
  if (shipment.carrier === 'pickup' && shipment.deliveredAt) {
    return `Collected ${formatDateTime(shipment.deliveredAt)}`;
  }
  if (shipment.shippedAt) return `Sent ${formatDateTime(shipment.shippedAt)}`;
  return `Created ${formatDateTime(shipment.createdAt)}`;
}

function Tracking({ shipment }: { shipment: Shipment }) {
  if (!shipment.trackingNumber) return null;
  if (!shipment.trackingUrl) {
    return <span className="font-mono text-sm break-all">{shipment.trackingNumber}</span>;
  }
  return (
    <a
      href={shipment.trackingUrl}
      target="_blank"
      rel="noreferrer"
      className="link inline-flex items-center gap-1 font-mono text-sm break-all"
    >
      {shipment.trackingNumber}
      <Icon glyph={faArrowUpRightFromSquare} className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

function ShipmentRow({ shipment }: { shipment: Shipment }) {
  return (
    <li className={ROW}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-medium">{shipmentHeadline(shipment)}</span>
        <Tracking shipment={shipment} />
        {/* What she typed in the note box. Asking for a note and never showing
            it is asking somebody to write into a drawer that does not open. */}
        {shipment.notes ? <span className="text-sm">{shipment.notes}</span> : null}
        <span className="text-sm">{whenItMoved(shipment)}</span>
      </div>
      <Badge color={fulfillmentTone(shipment.status)} variant="soft" size="sm">
        {shipmentStatusLabel(shipment)}
      </Badge>
    </li>
  );
}

/** Past tense once there is nothing left to hand over. "Mark it off when they
 *  do" on an order they already collected reads as the screen not noticing. */
function describe(plan: DeliveryPlan, stillToFulfil: boolean): string {
  if (!plan.collected) return 'Each shipment sent for this order, and how to follow it.';
  return stillToFulfil
    ? 'The customer is coming to fetch this one. Mark it off when they do.'
    : 'They picked this up.';
}

export function HandoverSection({
  order,
  plan,
  stillToFulfil,
  fulfillments,
}: {
  order: Order;
  plan: DeliveryPlan;
  stillToFulfil: boolean;
  fulfillments: Fulfillments;
}) {
  return (
    <SubSection
      title={plan.collected ? 'Collection' : 'Deliveries'}
      description={describe(plan, stillToFulfil)}
      isPending={fulfillments.isPending}
      isError={fulfillments.isError}
      errorText="We could not load the deliveries just now. Anything already shipped is unaffected — try reopening this order in a moment."
      emptyText={
        plan.collected
          ? 'This order has not been collected yet.'
          : 'Nothing has been sent for this order yet.'
      }
      count={fulfillments.data?.length ?? 0}
      footer={
        /* Only while something is still owed — the server refuses a handover on
           a cancelled or refunded order anyway. */
        stillToFulfil ? <RecordHandover order={order} plan={plan} /> : null
      }
    >
      <ul className="flex flex-col">
        {(fulfillments.data ?? []).map((shipment) => (
          <ShipmentRow key={shipment.id} shipment={shipment} />
        ))}
      </ul>
    </SubSection>
  );
}
