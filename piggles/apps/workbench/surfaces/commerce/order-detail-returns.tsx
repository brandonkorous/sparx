'use client';

// Anything coming back from this order.
//
// Sits between the deliveries and the money because that is the order it
// happens in: it went out, it came back, and only then does anyone work out
// what the money should do.
//
// Before issue 219 this section did not exist and neither did any other way in.
// The returns module — approve, receive, inspect, four decisions about where
// the goods go, restocking fees, three ways to settle — was reachable only from
// a return, and nothing anywhere could create one.

import { Badge, Text } from '@wizeworks/silicaui-react';

import { SubSection } from './order-detail-blocks';
import { StartReturn } from './order-return-start';
import {
  returnableLines,
  spokenFor,
  useOrderReturnLines,
  useOrderReturns,
} from './order-return-data';
import { outcomeLabel, returnState, type ReturnSummary } from './returns-data';
import { formatDate, type Order } from './data';
import type { SurfaceContext } from '../../lib/surfaces/registry';

const ROW =
  'border-base-300 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0';

function ReturnRow({ entry, onOpen }: { entry: ReturnSummary; onOpen: () => void }) {
  const state = returnState(entry.status);
  return (
    <button type="button" className={`${ROW} w-full text-left`} onClick={onOpen}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-medium">
          {entry.itemCount === 1 ? '1 item' : `${entry.itemCount} items`} ·{' '}
          {outcomeLabel(entry.preferredOutcome)}
        </span>
        <span className="text-sm">Asked {formatDate(entry.requestedAt)}</span>
      </span>
      <Badge color={state.tone} variant="soft">
        {state.label}
      </Badge>
    </button>
  );
}

export function ReturnsSection({ order, ctx }: { order: Order; ctx: SurfaceContext }) {
  const opened = useOrderReturns(order.id);
  const entries = opened.data?.items ?? [];
  const held = useOrderReturnLines(entries);

  const items = order.items ?? [];
  const anythingWentOut = items.some((item) => item.quantityFulfilled > 0);
  const lines = returnableLines(items, spokenFor(held.details));

  const open = (id: string) => {
    ctx.open('commerce.return.detail', { id }, { target: 'tab' });
  };

  return (
    <SubSection
      title="Coming back"
      description="Anything a customer sends back starts here. Approving it, checking its condition and settling the money all happen on the return itself."
      isPending={opened.isPending}
      isError={opened.isError}
      errorText="Could not load what is coming back for this order."
      emptyText="Nothing has been sent back for this order."
      count={entries.length}
      footer={
        <Footer
          order={order}
          lines={lines}
          anythingWentOut={anythingWentOut}
          stillCounting={held.isPending}
          onStarted={open}
        />
      }
    >
      {entries.map((entry) => (
        <ReturnRow
          key={entry.id}
          entry={entry}
          onOpen={() => {
            open(entry.id);
          }}
        />
      ))}
    </SubSection>
  );
}

/**
 * The form, or the reason there isn't one.
 *
 * Both of the silent states are worth words. A shop cannot take back what it
 * has not sent, and the move at that point is to cancel — which the pane
 * already offers a few rows down, so this says where to go rather than growing
 * a second button for it.
 */
function Footer({
  order,
  lines,
  anythingWentOut,
  stillCounting,
  onStarted,
}: {
  order: Order;
  lines: ReturnType<typeof returnableLines>;
  anythingWentOut: boolean;
  stillCounting: boolean;
  onStarted: (id: string) => void;
}) {
  if (!anythingWentOut) {
    return (
      <Text className="border-base-300 mt-4 border-t pt-4 text-base">
        Nothing has gone out yet, so there is nothing to send back. To stop this order before it
        does, cancel it at the bottom of this page.
      </Text>
    );
  }
  if (stillCounting) {
    return (
      <Text className="border-base-300 mt-4 border-t pt-4 text-base" role="status">
        Checking what is already on its way back…
      </Text>
    );
  }
  if (lines.length === 0) {
    return (
      <Text className="border-base-300 mt-4 border-t pt-4 text-base">
        Everything that went out is either already coming back or has been refunded, so there is
        nothing left to add to a return.
      </Text>
    );
  }
  return (
    <StartReturn orderId={order.id} currency={order.currency} lines={lines} onStarted={onStarted} />
  );
}
