// The order's secondary actions as VALUES, so the narrow bar's popover gives each
// one a labelled row. scripts/check-toolbar-glyph.mjs holds the line.

import { faEnvelope, faPrint, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { openServerHtml } from '../../lib/api/html-artifact';
import { readFailureMessage } from '../../lib/api/write-failure';
import type { ToolbarAction } from '../../components/pane-toolbar-actions';
import type { PurchaseOrderDetail } from './purchase-orders-data';
import type { PurchaseOrderPane } from './use-purchase-order-detail';

/** A placed order, to the supplier (issue 071). The server refuses a draft or one
 *  waiting for sign-off, and so does this. */
function emailAction(pane: PurchaseOrderPane, detail: PurchaseOrderDetail): ToolbarAction {
  return {
    label: 'Email to the supplier',
    title: `Email ${detail.number} to ${pane.supplierName ?? 'the supplier'}`,
    icon: faEnvelope,
    loading: pane.emailOrder.isPending,
    onClick: () => {
      pane.setEmailing(true);
    },
  };
}

/** The order on the business's letterhead. Drafts too: people print one to check it. */
function printOrderAction(pane: PurchaseOrderPane, detail: PurchaseOrderDetail): ToolbarAction {
  return {
    label: 'Print the order',
    title: 'Open the order to print or save as a PDF for your supplier',
    icon: faPrint,
    onClick: () => {
      openServerHtml(`/v1/inventory/purchase-orders/${detail.id}/document`).catch(
        (error: unknown) => {
          pane.toast.add({
            title: 'Could not open the print view',
            description: readFailureMessage(error, 'Try again in a moment.'),
            type: 'error',
          });
        }
      );
    },
  };
}

function printLabelAction(pane: PurchaseOrderPane, detail: PurchaseOrderDetail): ToolbarAction {
  return {
    label: 'Print a label',
    title: 'Print a scannable label for the paperwork and the pallet',
    icon: faPrint,
    onClick: () => {
      pane.ctx.open(
        'inventory.documents.label',
        {
          number: detail.number,
          title: 'Order to a supplier',
          subtitle: detail.supplierName ?? '',
        },
        { target: 'beside' }
      );
    },
  };
}

function deleteAction(pane: PurchaseOrderPane): ToolbarAction {
  return {
    label: 'Delete',
    title: 'Delete this draft',
    icon: faTrashCan,
    tone: 'danger',
    loading: pane.remove.isPending,
    onClick: () => {
      void pane.onDelete();
    },
  };
}

export function purchaseOrderMenu(pane: PurchaseOrderPane, emailable: boolean): ToolbarAction[] {
  const { detail, status } = pane;
  if (!detail) return [];
  return [
    ...(emailable ? [emailAction(pane, detail)] : []),
    printOrderAction(pane, detail),
    ...(status !== 'draft' ? [printLabelAction(pane, detail)] : []),
    ...(status === 'draft' ? [deleteAction(pane)] : []),
  ];
}
