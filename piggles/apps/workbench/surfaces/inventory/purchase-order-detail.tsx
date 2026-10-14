'use client';

// ONE PURCHASE ORDER: written as a draft, placed with the supplier, then worked down
// as the goods arrive. `{id:'new'}` before it exists; once placed it is read-only.
// The whole draft saves on one Save; see use-purchase-order-detail.ts.

import { Card } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { isReceivable, outstandingUnits, purchaseOrderState } from './purchase-orders-data';
import { PurchaseOrderProcurement } from './purchase-order-procurement';
import { usePurchaseOrderDetail, type PurchaseOrderPane } from './use-purchase-order-detail';
import { PurchaseOrderToolbar } from './purchase-order-toolbar';
import { OrderIntro, PlacedAlert } from './purchase-order-summary';
import { OrderDetailsSection } from './purchase-order-fields';
import { ItemsSection } from './purchase-order-items';
import { OrderChargesSection } from './purchase-order-charges';
import { NotesSection } from './purchase-order-notes';
import { PurchaseOrderDialogs } from './purchase-order-dialogs';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

/** A failed load REPLACES the pane. */
function LoadFailed({ pane }: { pane: PurchaseOrderPane }) {
  return (
    <div className={PANE_SHELL}>
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          error={pane.po.error}
          title="Could not load this order"
          description="This is a problem reaching the server. The order itself is unaffected."
          missingTitle="This order no longer exists"
          missingDescription="It may have been a draft that was deleted."
          onRetry={() => {
            void pane.po.refetch();
          }}
        />
      </Card>
    </div>
  );
}

/** What happens AROUND a saved order (docs/146 Phase 8): expected costs, then who
 *  holds it, when it is due, what has shipped and been billed. */
function AroundTheOrder({ pane }: { pane: PurchaseOrderPane }) {
  const { isNew, id, detail, status, currency, ctx } = pane;
  if (isNew) return null;
  return (
    <>
      <OrderChargesSection
        purchaseOrderId={id}
        currency={currency}
        freightCents={pane.draft.header.freightCents}
      />
      {detail ? (
        <PurchaseOrderProcurement
          purchaseOrderId={id}
          purchaseOrderNumber={detail.number}
          status={status}
          expectedArrivalAt={detail.expectedArrivalAt}
          lateAlertedAt={detail.lateAlertedAt}
          currency={currency}
          ctx={ctx}
        />
      ) : null}
    </>
  );
}

export function PurchaseOrderDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const pane = usePurchaseOrderDetail(ctx);
  const { isNew, po, detail, status } = pane;
  if (!isNew && po.isError) return <LoadFailed pane={pane} />;
  if (!isNew && (po.isPending || !pane.loaded)) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  const state = detail ? purchaseOrderState(detail) : null;
  const outstanding = detail ? outstandingUnits(detail) : 0;
  const canReceive = detail !== null && isReceivable(status);
  const emailable =
    status === 'submitted' || status === 'partial' || status === 'received' || status === 'closed';

  return (
    <div className={PANE_SHELL}>
      <PurchaseOrderToolbar
        pane={pane}
        state={state}
        canReceive={canReceive}
        emailable={emailable}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <OrderIntro pane={pane} state={state} />
          <PlacedAlert pane={pane} state={state} outstanding={outstanding} emailable={emailable} />
          <OrderDetailsSection pane={pane} />
          <ItemsSection pane={pane} />
          <AroundTheOrder pane={pane} />
          <NotesSection pane={pane} />
        </div>
      </div>
      <PurchaseOrderDialogs pane={pane} />
    </div>
  );
}
