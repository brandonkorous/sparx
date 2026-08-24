'use client';

// The one message at the top of the order, who bought it, and where it goes.

import { Alert, AlertContent, AlertDescription, AlertTitle, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import { AddressBlock, CollectedBy } from './order-detail-blocks';
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
          {order.customer?.company ? (
            <Text className="text-base">
              Trade account: {order.customer.company.companyName}
              {order.customer.company.paymentTerms
                ? ` · pays on ${order.customer.company.paymentTerms} terms`
                : ''}
            </Text>
          ) : null}
        </div>
      </FormSection>
    </ModuleScope>
  );
}

/**
 * An order nobody is delivering does not have a "where it goes", and putting a
 * Delivery address heading over whatever a collecting customer once typed is
 * how a shop ends up posting something to somebody who was going to walk in.
 */
export function DestinationSection({ order, facts }: { order: Order; facts: OrderFacts }) {
  const { plan } = facts;
  return (
    <FormSection
      title={plan.collected ? 'How it leaves' : 'Where it goes'}
      description={
        plan.collected
          ? 'Nothing is being posted, so nothing here is a delivery address.'
          : 'Copied down when the order was placed, so changing the customer’s address later never rewrites where this one went.'
      }
    >
      {/* The words the shopper chose. Absent on orders placed before checkout
          kept them, and absent is what it renders as — an order whose method
          was never recorded must not be shown a method. */}
      {plan.description ? <Text className="text-base font-medium">{plan.description}</Text> : null}
      {plan.collected ? (
        <CollectedBy order={order} />
      ) : (
        <div className="grid gap-4 @md:grid-cols-2">
          <AddressBlock title="Delivery address" address={order.shippingAddress} />
          <AddressBlock title="Billing address" address={order.billingAddress} />
        </div>
      )}
    </FormSection>
  );
}
