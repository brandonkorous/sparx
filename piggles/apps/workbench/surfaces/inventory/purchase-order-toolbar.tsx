// The order's toolbar: where it stands, Save while it is a draft, and the
// lifecycle actions that apply to its status.

import { Badge, Button, Text, Tooltip } from '@wizeworks/silicaui-react';
import {
  faBan,
  faBarcodeRead,
  faBoxCheck,
  faCircleCheck,
  faClipboardList,
  faFloppyDisk,
  faPaperPlane,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { purchaseOrderState } from './purchase-orders-data';
import type { PurchaseOrderPane } from './use-purchase-order-detail';
import { purchaseOrderMenu } from './purchase-order-menu';

type OrderState = ReturnType<typeof purchaseOrderState> | null;

function ToolbarStatus({ state }: { state: OrderState }) {
  return state ? (
    <Badge color={state.tone} variant="soft" size="sm">
      {state.label}
    </Badge>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <Icon glyph={faClipboardList} className="size-4" aria-hidden />
      <Text as="span" className="text-sm font-medium">
        New order
      </Text>
    </span>
  );
}

/** Place and receive. Scanning is the OTHER way to receive, so it sits beside it as
 *  an equal, outline because only one of the two can be the primary action. */
function ArrivalControls({ pane, canReceive }: { pane: PurchaseOrderPane; canReceive: boolean }) {
  const { isNew, editable, detail, ctx } = pane;
  return (
    <>
      {!isNew && editable ? (
        <Button
          size="sm"
          color="module"
          variant="outline"
          className="shrink-0"
          loading={pane.place.isPending}
          onClick={() => {
            void pane.onPlace();
          }}
        >
          <Icon glyph={faPaperPlane} className="size-4" aria-hidden />
          Place order
        </Button>
      ) : null}
      {canReceive ? (
        <Button size="sm" color="module" className="shrink-0" onClick={pane.onReceive}>
          <Icon glyph={faBoxCheck} className="size-4" aria-hidden />
          Receive
        </Button>
      ) : null}
      {canReceive && detail ? (
        <Tooltip content="Open the scanning screen for this delivery">
          <Button
            size="sm"
            variant="outline"
            color="module"
            className="shrink-0"
            onClick={() => {
              ctx.open('inventory.receiving.scan', { id: detail.id }, { target: 'tab' });
            }}
          >
            <Icon glyph={faBarcodeRead} className="size-4" aria-hidden />
            Scan it in
          </Button>
        </Tooltip>
      ) : null}
    </>
  );
}

function EndingControls({ pane }: { pane: PurchaseOrderPane }) {
  const { detail, status } = pane;
  return (
    <>
      {detail && (status === 'submitted' || status === 'partial' || status === 'received') ? (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          loading={pane.close.isPending}
          onClick={() => {
            void pane.onClose();
          }}
        >
          <Icon glyph={faCircleCheck} className="size-4" aria-hidden />
          Close
        </Button>
      ) : null}
      {detail && (status === 'draft' || status === 'pending_approval' || status === 'submitted') ? (
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          className="shrink-0"
          loading={pane.cancel.isPending}
          onClick={() => {
            void pane.onCancel();
          }}
        >
          <Icon glyph={faBan} className="size-4" aria-hidden />
          Cancel
        </Button>
      ) : null}
    </>
  );
}

function OrderRefresh({ pane }: { pane: PurchaseOrderPane }) {
  const { po, detail } = pane;
  return (
    <RefreshButton
      isFetching={po.isFetching}
      updatedAt={detail ? po.dataUpdatedAt : undefined}
      onRefresh={() => {
        void po.refetch();
      }}
    />
  );
}

export function PurchaseOrderToolbar({
  pane,
  state,
  canReceive,
  emailable,
}: {
  pane: PurchaseOrderPane;
  state: OrderState;
  canReceive: boolean;
  emailable: boolean;
}) {
  const { isNew, editable } = pane;
  return (
    <PaneToolbar
      label="Order to a supplier actions"
      status={<ToolbarStatus state={state} />}
      primary={
        editable ? (
          <Button
            size="sm"
            color="module"
            className="ml-auto shrink-0"
            disabled={!pane.canSave}
            loading={pane.saving}
            onClick={() => {
              void pane.doSave();
            }}
          >
            <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
            {isNew ? 'Save draft' : 'Save'}
          </Button>
        ) : (
          <span className="ml-auto" />
        )
      }
      controls={
        <>
          <ArrivalControls pane={pane} canReceive={canReceive} />
          <EndingControls pane={pane} />
        </>
      }
      actions={purchaseOrderMenu(pane, emailable)}
      refresh={isNew ? null : <OrderRefresh pane={pane} />}
    />
  );
}
