'use client';

// The reading blocks an order pane is built out of: a money line, an address, a
// section that reports its own loading, and the identity line at the top.
//
// Split out of order-detail so that file can be the SHAPE of the pane rather
// than the shape of the pane plus every piece it is made of.

import { Heading, Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import {
  addressLines,
  channelLabel,
  customerName,
  formatDate,
  formatMoney,
  type Order,
  type OrderAddress,
} from './data';

/** The one column everything sits in. */
export const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** A money line in the totals block. `emphasis` is the order's own total and the
 *  amount still owed — the two numbers anyone opens this pane for. */
export function MoneyRow({
  label,
  amount,
  currency,
  emphasis = false,
  /** Words in place of the figure, for a real charge that came to nothing —
   *  "Free" delivery reads as a decision, where $0.00 reads as a gap. */
  reads,
}: {
  label: string;
  amount: number;
  currency: string;
  emphasis?: boolean;
  reads?: string;
}) {
  return (
    <div
      className={[
        'flex items-baseline justify-between gap-4',
        emphasis ? 'text-lg font-semibold' : 'text-base',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className="tabular-nums">{reads ?? formatMoney(amount, currency)}</span>
    </div>
  );
}

export function AddressBlock({ title, address }: { title: string; address: OrderAddress | null }) {
  const lines = addressLines(address);
  return (
    <div className="flex flex-col gap-1">
      <Heading level={3} className="text-base font-semibold">
        {title}
      </Heading>
      {lines.length === 0 ? (
        <Text className="text-sm">Not given</Text>
      ) : (
        <address className="text-base not-italic">
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      )}
    </div>
  );
}

/**
 * Who is coming to fetch it.
 *
 * A collected order has no delivery address, and since issue 064 it has no
 * address AT ALL — checkout stopped making a customer type a postal address to
 * buy a bun over a counter. So there is usually nothing to draw here, and
 * drawing an empty "Their address" block with "Not given" under it reads as a
 * shop that lost something rather than one that never needed it.
 *
 * An older collected order may still carry the address that checkout used to
 * insist on. It is shown, because it is what the shop has on record, and it is
 * labelled as what it actually is rather than as a destination.
 */
export function CollectedBy({ order }: { order: Order }) {
  const onFile = addressLines(order.billingAddress);
  return (
    <div className="flex flex-col gap-1">
      <Heading level={3} className="text-base font-semibold">
        Who is collecting
      </Heading>
      <Text className="text-base">{customerName(order.customer)}</Text>
      {order.customer?.email ? <Text className="text-base">{order.customer.email}</Text> : null}
      {onFile.length > 0 ? (
        <>
          <Text className="mt-2 text-sm">Address they gave when they ordered</Text>
          <address className="text-base not-italic">
            {onFile.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </>
      ) : null}
    </div>
  );
}

/** A section whose data comes from its own request, so it reports its own
 *  loading and its own failure. One bad subresource must not blank out the rest
 *  of the order. */
export function SubSection({
  title,
  description,
  isPending,
  isError,
  errorText,
  emptyText,
  count,
  children,
  footer,
}: {
  title: string;
  description?: string;
  isPending: boolean;
  isError: boolean;
  errorText: string;
  emptyText: string;
  count: number;
  children: React.ReactNode;
  /** Rendered under the list AND under the empty text, because the thing that
   *  ADDS the first row must be reachable when there are no rows — which is
   *  exactly the state it exists for. `children` alone could not do this: it
   *  is hidden at count 0. */
  footer?: React.ReactNode;
}) {
  return (
    <FormSection title={title} description={description}>
      {isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : isError ? (
        <Text className="text-sm">{errorText}</Text>
      ) : count === 0 ? (
        <Text>{emptyText}</Text>
      ) : (
        children
      )}
      {!isPending && !isError ? footer : null}
    </FormSection>
  );
}

export function OrderIdentity({ order, siteName }: { order: Order; siteName: string | null }) {
  const facts = [
    `Placed ${formatDate(order.placedAt)}`,
    channelLabel(order),
    ...(siteName ? [siteName] : []),
  ];
  return (
    <div className="flex flex-col gap-1">
      {/* The order number IS this pane's identity, and the pane TAB carries it —
          so it is not repeated here. The buyer leads instead: the number tells
          you which sale you opened, this tells you whose it is. */}
      <Text className="text-lg">{customerName(order.customer)}</Text>
      <Text className="text-sm">{facts.join(' · ')}</Text>
    </div>
  );
}
