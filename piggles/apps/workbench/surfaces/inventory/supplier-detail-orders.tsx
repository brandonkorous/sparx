'use client';

// The most recent orders to this supplier, and the button that starts a new one
// with them already chosen.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faClipboardList } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents } from './data';
import {
  outstandingUnits,
  purchaseOrderState,
  usePurchaseOrders,
  type PurchaseOrder,
} from './purchase-orders-data';

function OrderRow({
  po,
  onOpen,
}: {
  po: PurchaseOrder;
  onOpen: (po: PurchaseOrder, event: { shiftKey: boolean }) => void;
}) {
  const state = purchaseOrderState(po);
  const outstanding = outstandingUnits(po);
  return (
    <li>
      <button
        type="button"
        className="border-base-300 hover:border-module flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors"
        onClick={(event) => {
          onOpen(po, event);
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon glyph={faClipboardList} className="size-4 shrink-0" aria-hidden />
          <Text className="font-mono font-medium">{po.number}</Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {outstanding > 0 ? (
            <Text className="text-sm tabular-nums">{String(outstanding)} still to come</Text>
          ) : null}
          <Text className="text-sm tabular-nums">{formatCents(po.totalCents, po.currency)}</Text>
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        </div>
      </button>
    </li>
  );
}

interface OrdersProps {
  supplierId: string;
  ctx: SurfaceContext;
}

export function SupplierPurchaseOrders({ supplierId, ctx }: OrdersProps) {
  const { data, isLoading } = usePurchaseOrders({ supplierId, take: 10, skip: 0 });
  const rows = data?.items ?? [];

  if (isLoading) return null;

  const openPo = (po: PurchaseOrder, event: { shiftKey: boolean }) => {
    ctx.open(
      'inventory.purchase-orders.detail',
      { id: po.id },
      { target: event.shiftKey ? 'beside' : 'tab' }
    );
  };

  return (
    <FormSection
      title="Orders to this supplier"
      description="Their most recent orders. A new one starts with this supplier chosen and their items ready to add."
      action={
        <Button
          size="sm"
          color="module"
          onClick={() => {
            // The section promised that an order to them starts here; until there
            // was a button, it started nowhere (sparx persona issue 071).
            ctx.open(
              'inventory.purchase-orders.detail',
              { id: 'new', supplier: supplierId },
              { target: 'tab' }
            );
          }}
        >
          New order
        </Button>
      }
    >
      {rows.length === 0 ? <Text className="text-sm">Nothing ordered from them yet.</Text> : null}
      <ul className="flex flex-col gap-2">
        {rows.map((po) => (
          <OrderRow key={po.id} po={po} onOpen={openPo} />
        ))}
      </ul>
    </FormSection>
  );
}
