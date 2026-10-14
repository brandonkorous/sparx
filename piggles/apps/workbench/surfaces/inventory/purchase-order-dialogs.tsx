// The dialogs an order opens: the line editor while it is a draft, and placing
// or emailing it once it exists.

import { formatCents } from './data';
import { formatMoment } from './purchase-orders-data';
import { placingWords } from './po-approvals-words';
import { EmailOrderDialog, PlaceOrderDialog } from './purchase-order-email';
import { LineEditor } from './purchase-order-line-editor';
import type { PurchaseOrderPane } from './use-purchase-order-detail';

function OrderDialogs({ pane }: { pane: PurchaseOrderPane }) {
  const { detail, supplierName, currency } = pane;
  if (!detail) return null;
  const order = { ...detail, supplierName: supplierName ?? null };
  return (
    <>
      <PlaceOrderDialog
        open={pane.placing}
        order={order}
        title={`Place ${detail.number} with ${supplierName ?? 'the supplier'}?`}
        description={
          placingWords(
            { number: detail.number, supplierName: supplierName ?? null },
            null,
            (cents) => formatCents(cents, currency)
          ).description
        }
        pending={pane.place.isPending || pane.emailOrder.isPending}
        onClose={() => {
          pane.setPlacing(false);
        }}
        onPlace={pane.placeNow}
      />
      <EmailOrderDialog
        open={pane.emailing}
        order={order}
        pending={pane.emailOrder.isPending}
        formatMoment={formatMoment}
        onClose={() => {
          pane.setEmailing(false);
        }}
        onSend={(to) => {
          pane.sendEmail(detail.number, to);
        }}
      />
    </>
  );
}

export function PurchaseOrderDialogs({ pane }: { pane: PurchaseOrderPane }) {
  return (
    <>
      {pane.editable ? (
        <LineEditor
          supplierId={pane.draft.header.supplierId}
          currency={pane.currency}
          editing={pane.editing}
          onClose={() => {
            pane.setEditing(null);
          }}
          onSave={pane.upsertLine}
        />
      ) : null}
      <OrderDialogs pane={pane} />
    </>
  );
}
