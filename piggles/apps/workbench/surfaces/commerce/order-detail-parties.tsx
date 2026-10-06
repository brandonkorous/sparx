'use client';

// The one message at the top of the order, who bought it, and where it goes.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Text,
} from '@wizeworks/silicaui-react';
import { poNumberOf } from '@wizeworks/crm-schemas';
import { orderDeliveryRows } from './order-delivery-needs';

import { FormSection } from '../../components/form-section';
import { paymentTermsLabel } from '../../lib/payment-terms';
import { ModuleScope } from '../../components/module-scope';
import { AddressBlock, CollectedBy } from './order-detail-blocks';
import { OrderAddressForm } from './order-detail-address-form';
import { customerName, formatDateTime, formatMoney, type Order } from './data';
import type { OrderFacts } from './order-detail-facts';

/**
 * ONE message, the most specific true one.
 *
 * A cancelled order says why it was cancelled; otherwise money owed is the
 * thing worth saying, and an order that is paid and delivered says nothing at
 * all — the badges in the header already carry it.
 */
export function OrderHeadline({ order, facts }: { order: Order; facts: OrderFacts }) {
  const { shipped, due } = facts;
  const currency = order.currency;

  if (order.status === 'cancelled' || order.status === 'refunded') {
    return (
      <Alert color={shipped.tone} variant="soft">
        <AlertContent>
          <AlertTitle>{shipped.label}</AlertTitle>
          <AlertDescription>
            {shipped.detail}
            {order.cancelledAt ? ` (${formatDateTime(order.cancelledAt)})` : ''}
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  if (due <= 0) return null;

  // A deposit order is not a debt (issue 026) — money came in exactly as
  // arranged and the rest falls due on the day it is collected. Saying "still
  // owed" in warning yellow about an order behaving correctly sends somebody
  // chasing a customer who owes them nothing yet.
  const onCollection = order.readyOn !== null && order.amountPaid > 0;

  return (
    <Alert color={onCollection ? 'info' : 'warning'}>
      <AlertContent>
        <AlertTitle>
          {formatMoney(due, currency)} {onCollection ? 'due on collection' : 'still owed'}
        </AlertTitle>
        <AlertDescription>
          {order.amountPaid > 0
            ? `${formatMoney(order.amountPaid, currency)} of ${formatMoney(order.total, currency)} has come in${onCollection ? '. The rest is paid when it is handed over.' : ' so far.'}`
            : 'No money has come in for this order yet.'}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

/** The buyer is CRM's functionality showing up on a commerce screen, so this
 *  block wears CRM's hue — color follows functionality, not the pane. */
export function BuyerSection({ order }: { order: Order }) {
  return (
    <ModuleScope module="crm">
      <FormSection title="Who bought it">
        <div className="flex flex-col gap-1">
          <Text className="text-base font-medium">{customerName(order.customer)}</Text>
          {order.customer?.email ? (
            <a href={`mailto:${order.customer.email}`} className="link text-base break-all">
              {order.customer.email}
            </a>
          ) : null}
          {order.customer?.b2bAccount ? (
            <Text className="text-base">
              Wholesale customer: {order.customer.b2bAccount.companyName}
              {order.customer.b2bAccount.paymentTerms
                ? ` · ${paymentTermsLabel(order.customer.b2bAccount.paymentTerms)}`
                : ''}
            </Text>
          ) : null}
          {/* Their own purchase order number, from checkout or from the quote
              this order was made from (issue 077). */}
          {poNumberOf(order.metadata) ? (
            <Text className="text-base">Their PO number: {poNumberOf(order.metadata)}</Text>
          ) : null}
          {/* When and where they need it, from the quote request this
              order came from (sparx persona issue 086). */}
          {orderDeliveryRows(order.metadata).map((row) => (
            <Text key={row.label} className="text-base whitespace-pre-line">
              {row.label}: {row.value}
            </Text>
          ))}
        </div>
      </FormSection>
    </ModuleScope>
  );
}

/**
 * An order nobody is delivering does not have a "where it goes", and putting a
 * Delivery address heading over whatever a collecting customer once typed is
 * how a shop ends up posting something to somebody who was going to walk in.
 *
 * AND AN ORDER WITH NO ADDRESS NEEDS ONE PUT ON IT. This block used to read
 * "Not given" and stop there, which is honest and completely useless: the shop
 * still has the goods, the customer is still waiting, and the only screen that
 * could fix it had no box to type into. An order made by turning an accepted
 * quote into one always lands here, because a quote is a price and nobody asks
 * a price where the goods are going.
 * [[feedback_screen_over_a_function_nobody_calls]]
 *
 * ONCE SOMETHING HAS GONE OUT the address stops being a plan and becomes a
 * record of where a parcel actually went, so editing closes.
 */
export function DestinationSection({ order, facts }: { order: Order; facts: OrderFacts }) {
  const { plan } = facts;
  const [editing, setEditing] = useState(false);
  const sent = order.fulfilledAt !== null;
  const settled = order.status === 'cancelled' || order.status === 'refunded';
  const canEdit = !plan.collected && !sent && !settled;
  const nowhereToSend = !plan.collected && order.shippingAddress === null;

  return (
    <FormSection
      title={plan.collected ? 'How it leaves' : 'Where it goes'}
      description={
        plan.collected
          ? 'Nothing is being posted, so nothing here is a delivery address.'
          : 'Kept on the order itself, so changing the customer’s address later never rewrites where this one went.'
      }
      action={
        canEdit && !editing ? (
          <Button
            color="module"
            variant={nowhereToSend ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => {
              setEditing(true);
            }}
          >
            {nowhereToSend ? 'Say where it goes' : 'Change the address'}
          </Button>
        ) : null
      }
    >
      {/* The words the shopper chose. Absent on orders placed before checkout
          kept them, and absent is what it renders as — an order whose method
          was never recorded must not be shown a method. */}
      {plan.description ? <Text className="text-base font-medium">{plan.description}</Text> : null}
      {plan.collected ? (
        <CollectedBy order={order} />
      ) : editing ? (
        <OrderAddressForm
          order={order}
          onDone={() => {
            setEditing(false);
          }}
        />
      ) : (
        <>
          {nowhereToSend ? (
            <Alert color="warning" variant="soft">
              <AlertContent>
                <AlertTitle>Nobody has said where this one goes</AlertTitle>
                <AlertDescription>
                  {sent || settled
                    ? 'No address was ever written down for this order.'
                    : 'You cannot post it until there is an address on it. Put one on and it stays with this order only.'}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}
          <div className="grid gap-4 @md:grid-cols-2">
            <AddressBlock title="Delivery address" address={order.shippingAddress} />
            <AddressBlock title="Billing address" address={order.billingAddress} />
          </div>
        </>
      )}
    </FormSection>
  );
}
