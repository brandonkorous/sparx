'use client';

// The "who you're talking to" card at the top of a conversation, and their last
// orders. Moved out of thread.tsx (sparx persona issue 234), which also capped it:
// it took all the height it wanted and left the conversation one line.

import { Badge, Text } from '@wizeworks/silicaui-react';

import { describeAgo } from '../../lib/api/activity';
import { ModuleScope } from '../../components/module-scope';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useReachableModules } from '../../lib/surfaces/use-visible-nav';
import {
  formatDate as formatOrderDate,
  formatMoney as formatOrderMoney,
  shippingState,
  useOrders,
  type Order,
} from '../commerce/data';
import { targetFor } from '../commerce/orders-list-filters';
import {
  conversationName,
  formatMoney,
  sourceLabel,
  useCustomerContext,
  type ConversationDetail,
  type CustomerContext,
} from './data';
import { hasHistory, whoBadge, whoNote } from './who-line';

function WhoBadge({ match }: { match: CustomerContext['match'] }) {
  const badge = whoBadge(match);
  // Three states, and the middle one is the point: the email the visitor typed
  // matches somebody this shop knows, which is a strong hint and not proof. A
  // colorless badge for the unknown state rather than `neutral`, which is not
  // ours to choose.
  return badge.color === null ? (
    <Badge variant={badge.variant} size="sm">
      {badge.label}
    </Badge>
  ) : (
    <Badge color={badge.color} variant={badge.variant} size="sm">
      {badge.label}
    </Badge>
  );
}

/** Only somebody this shop knows has a spend history worth pulling up. An
 *  anonymous visitor's numbers would all be zero and say nothing. */
function SpendLine({ data }: { data: CustomerContext }) {
  return (
    <div className="border-base-300 flex flex-wrap gap-x-6 gap-y-1 border-t pt-2 text-sm">
      <span>
        <span className="font-semibold tabular-nums">{data.orderCount}</span>{' '}
        {data.orderCount === 1 ? 'order' : 'orders'}
      </span>
      {/* What the orders come to, then what was paid: a customer on account or
          paying on collection read "$0.00 spent" above thousands of orders
          (sparx persona issue 163). */}
      {data.orderCount > 0 ? (
        <span>
          <span className="font-semibold tabular-nums">{formatMoney(data.orderedValue)}</span>{' '}
          ordered
        </span>
      ) : null}
      <span>
        <span className="font-semibold tabular-nums">{formatMoney(data.lifetimeValue)}</span> paid
        {data.orderedValue > data.lifetimeValue
          ? `, ${formatMoney(data.orderedValue - data.lifetimeValue)} still to come`
          : ''}
      </span>
      {data.lastOrderAt ? <span>Last ordered {describeAgo(data.lastOrderAt)}</span> : null}
    </div>
  );
}

export function ContextCard(props: {
  conversation: ConversationDetail;
  siteName: string | null;
  ctx: SurfaceContext;
}) {
  const { conversation, siteName, ctx } = props;
  const data = useCustomerContext(conversation.id).data;
  const reachable = useReachableModules();
  const name = conversationName(conversation);
  // `null` while the module list loads, read as "show everything".
  const sells = reachable === null || reachable.has('commerce');
  const match = data?.match ?? 'none';
  const note = whoNote(match, name, data?.name ?? null);
  const email = data?.email ?? conversation.customerEmail;

  // Capped, and scrolling inside itself, so the conversation below keeps the room
  // (sparx persona issue 234).
  return (
    <section className="card bg-base-100 flex max-h-[30%] shrink-0 flex-col gap-2 overflow-y-auto p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Text as="span" className="text-base font-semibold">
          {name}
        </Text>
        <WhoBadge match={match} />
      </div>
      {note !== null ? <Text className="text-sm">{note}</Text> : null}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
        {email ? <span className="break-all">{email}</span> : null}
        {data?.phone ? <span>{data.phone}</span> : null}
        {data?.company ? <span>{data.company}</span> : null}
        <span>
          {sourceLabel(conversation.source)}
          {siteName ? ` · ${siteName}` : ''}
        </span>
      </div>
      {/* `hasHistory` is held against the badge by a test, so a history can never
          appear under a badge saying they have never been here. */}
      {hasHistory(match) && data ? <SpendLine data={data} /> : null}
      {hasHistory(match) && data?.customerId != null && sells ? (
        <RecentOrders ctx={ctx} customerId={data.customerId} />
      ) : null}
    </section>
  );
}

function RecentOrderRow({ ctx, row }: { ctx: SurfaceContext; row: Order }) {
  const state = shippingState(row);
  return (
    <li>
      <button
        type="button"
        className="hover:bg-base-200 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1.5 py-2 text-left"
        onClick={(event) => {
          ctx.open('commerce.order.detail', { id: row.id }, { target: targetFor(event) });
        }}
      >
        <span className="font-mono text-sm">{row.orderNumber}</span>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
        <span className="text-sm">{formatOrderDate(row.placedAt)}</span>
        <span className="ml-auto font-mono text-sm tabular-nums">
          {formatOrderMoney(row.total, row.currency)}
        </span>
      </button>
    </li>
  );
}

/**
 * WHAT THEY BOUGHT, WHICH IS USUALLY WHAT THE CHAT IS ABOUT.
 *
 * Reuses the Commerce order data layer whole, so the delivery state reads in the
 * words `shippingState` was written to keep honest and a click opens the real
 * order (issue 864). Canceled orders are left out, because the lifetime figures
 * above do not count them either.
 */
function RecentOrders({ ctx, customerId }: { ctx: SurfaceContext; customerId: string }) {
  const { data, isPending, isError } = useOrders({
    customerId,
    countedOnly: true,
    sortBy: 'placedAt',
    order: 'desc',
    take: 3,
    skip: 0,
  });
  const rows = data?.items ?? [];
  if (isError) {
    return (
      <div className="border-base-300 border-t pt-2">
        <Text className="text-warning text-sm">Could not load their orders just now.</Text>
      </div>
    );
  }
  if (isPending || rows.length === 0) return null;
  return (
    // Selling's data, so the rows read as Selling: the Commerce hue on the badges.
    <ModuleScope module="commerce">
      <div className="border-base-300 flex flex-col gap-1 border-t pt-2">
        <Text as="span" className="text-sm font-semibold">
          {rows.length === 1 ? 'Their last order' : `Their last ${rows.length} orders`}
        </Text>
        <ul className="flex flex-col">
          {rows.map((row) => (
            <RecentOrderRow key={row.id} ctx={ctx} row={row} />
          ))}
        </ul>
      </div>
    </ModuleScope>
  );
}
