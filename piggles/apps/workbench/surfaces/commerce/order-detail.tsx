'use client';

// One order — what was bought, what was paid, where it went.
//
// A TRANSACTION detail: a record of something that already happened, so it
// keeps a real identity heading rather than an editable name field. Nothing
// here is a draft, so there is nothing to save and no dirty state to guard.
//
// Deliberately NOT built on EditorLayout. That chassis is a form with a running
// summary rail; this pane is a narrative, so it is one centred column, capped —
// a pane torn onto a second monitor is otherwise 2000px of grey.
//
// The audience owns a business, not a warehouse system. "Fulfilled" means "on
// the way" here and a payment processor's vocabulary never reaches the screen
// untranslated.
//
// This file loads and composes; the pieces are the order-detail-* siblings.

import { useEffect } from 'react';

import { Card } from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useSites, useModuleStates, useViewer } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useOrderRisk } from './order-detail-actions';
import { OrderToolbar } from './order-detail-toolbar';
import { OrderBody } from './order-detail-body';
import { orderFacts } from './order-detail-facts';
import { useOrder, useOrderFulfillments, useOrderPayments, useOrderRefunds } from './data';

export function OrderDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';

  const {
    data: order,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useOrder(id);
  const { data: sites } = useSites();
  const payments = useOrderPayments(id);
  const fulfillments = useOrderFulfillments(id);
  const refunds = useOrderRefunds(id);
  const risk = useOrderRisk(id);

  // "Who sold it" needs BOTH: the staff module on (otherwise there is no roster
  // to credit) and pay access (every /v1/staff/sales/* route is admin-only —
  // pay is the one place the viewer/editor ladder is deliberately wrong).
  const viewer = useViewer();
  const modules = useModuleStates();
  const canSeeCommission =
    (modules.data?.some((m) => m.slug === 'staff' && m.enabled) ?? false) &&
    (viewer.data?.role === 'admin' || viewer.data?.role === 'owner');

  // Keyed on the NUMBER, not the order object. Depending on the object retitles
  // the tab on every refetch — including the one after a cancellation, which
  // pushes a dockview title update out of a commit to set the title it already
  // has.
  const orderNumber = order?.orderNumber ?? null;
  useEffect(() => {
    if (orderNumber) ctx.setTitle(`Order ${orderNumber}`);
  }, [ctx, orderNumber]);

  // A failed load REPLACES the pane. Rendering an empty order beside a live
  // Cancel button offers a move against something that isn't there.
  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="order"
            title="Could not load this order"
            description="This is a problem reaching the server. The order itself is unaffected — nothing has been changed or lost."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !order) return <PaneWaiting />;

  const facts = orderFacts(order, payments);
  const site = sites?.find((candidate) => candidate.id === order.propertyId);

  return (
    <div className={PANE_SHELL}>
      <OrderToolbar
        ctx={ctx}
        order={order}
        paid={facts.paid}
        shipped={facts.shipped}
        canSendToWarehouse={facts.stillToFulfil && !facts.plan.collected}
        isFetching={
          isFetching || payments.isFetching || fulfillments.isFetching || refunds.isFetching
        }
        updatedAt={dataUpdatedAt}
        onRefresh={() => {
          void refetch();
          void payments.refetch();
          void fulfillments.refetch();
          void refunds.refetch();
        }}
      />
      <OrderBody
        order={order}
        facts={facts}
        ctx={ctx}
        siteName={site?.name ?? null}
        canSeeCommission={canSeeCommission}
        payments={payments}
        fulfillments={fulfillments}
        refunds={refunds}
        risk={risk}
      />
    </div>
  );
}
