'use client';

// The order pane's header: the two states this order is in, its total, the one
// commit action, and a refresh that reloads all four of its queries.

import { Badge, Button, Text, useToast } from '@wizeworks/silicaui-react';
import { faRoute } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useGeneratePickList, pickErrorMessage } from '../inventory/picking-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatMoney, type Order } from './data';
import type { Tone } from './order-tone';

export interface OrderToolbarProps {
  ctx: SurfaceContext;
  order: Order;
  paid: { tone: Tone; label: string };
  shipped: { tone: Tone; label: string };
  /** Stock left to fetch AND something being SENT. A picking walk for an order
   *  the customer is collecting routes a bakery's counter staff through a
   *  warehouse they do not have. */
  canSendToWarehouse: boolean;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

/** Both badges say the same word on a refunded order, and two identical badges
 *  side by side read as a rendering fault rather than as two facts. */
function OrderStatus({
  order,
  paid,
  shipped,
}: Pick<OrderToolbarProps, 'order' | 'paid' | 'shipped'>) {
  return (
    <>
      <Badge color={paid.tone} variant="soft" size="sm">
        {paid.label}
      </Badge>
      {shipped.label === paid.label ? null : (
        <Badge color={shipped.tone} variant="soft" size="sm">
          {shipped.label}
        </Badge>
      )}
      <div className="flex-1" />
      <Text className="text-sm tabular-nums">{formatMoney(order.total, order.currency)}</Text>
    </>
  );
}

/**
 * Send it to the warehouse (docs/146 Phase 4).
 *
 * Wears the INVENTORY hue on a commerce pane deliberately — it is a warehouse
 * action surfacing here, and color follows functionality rather than the page
 * it happens to be on.
 */
function SendToWarehouse({ ctx, order }: { ctx: SurfaceContext; order: Order }) {
  const toast = useToast();
  const generateWalk = useGeneratePickList();

  const run = async () => {
    try {
      const walk = await generateWalk.mutateAsync({ orderIds: [order.id] });
      toast.add({
        title: `Walk ${walk.number} ready`,
        description: `${String(walk.lineCount)} to fetch at ${walk.warehouseName}.`,
        type: 'success',
      });
      ctx.open('inventory.picking.detail', { id: walk.id }, { target: 'beside' });
    } catch (error) {
      toast.add({
        title: 'Could not create a walk',
        description: pickErrorMessage(
          error,
          'Nothing was changed. Check the order still has something to send.'
        ),
        type: 'error',
      });
    }
  };

  return (
    <Button
      size="sm"
      color="module-inventory"
      variant="outline"
      disabled={generateWalk.isPending}
      onClick={() => {
        void run();
      }}
    >
      <Icon glyph={faRoute} className="size-4" aria-hidden />
      Send to the warehouse
    </Button>
  );
}

export function OrderToolbar(props: OrderToolbarProps) {
  const { ctx, order, paid, shipped } = props;
  return (
    <PaneToolbar
      label="Order actions"
      status={<OrderStatus order={order} paid={paid} shipped={shipped} />}
      // A commit action is always `primary`: `controls` relocates into the
      // overflow popover under 672px. Enforced by scripts/check-toolbar-primary.mjs.
      primary={props.canSendToWarehouse ? <SendToWarehouse ctx={ctx} order={order} /> : null}
      refresh={
        /* Four queries feed this pane — the order and its money, shipments and
           refunds — so one refresh reloads all of them. */
        <RefreshButton
          isFetching={props.isFetching}
          updatedAt={props.updatedAt}
          onRefresh={props.onRefresh}
        />
      }
    />
  );
}
