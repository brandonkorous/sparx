// One Save for the whole draft: the data layer reconciles header and lines down
// to the add/update/remove calls the API exposes.

import { afterPaneChange } from '../../lib/defer';
import { buyingErrorMessage } from './suppliers-data';
import { useSavePurchaseOrder, type PurchaseOrderDetail } from './purchase-orders-data';
import type { PurchaseOrderBase } from './use-purchase-order-base';

export function usePurchaseOrderSave(pane: PurchaseOrderBase) {
  const { ctx, id, isNew, toast, draft, original, rebase } = pane;
  const save = useSavePurchaseOrder();

  const doSave = () =>
    new Promise<PurchaseOrderDetail | null>((resolve) => {
      save.mutate(
        { id, header: draft.header, lines: draft.lines, original },
        {
          onSuccess: (saved) => {
            // Rebased BEFORE the pane swap, on both paths (issue 483).
            rebase(saved);
            if (isNew) {
              ctx.open('inventory.purchase-orders.detail', { id: saved.id }, { target: 'replace' });
            }
            afterPaneChange(() => {
              toast.add({
                title: `${saved.number} saved${isNew ? ' as a draft' : ''}`,
                type: 'success',
              });
            });
            resolve(saved);
          },
          onError: (error) => {
            toast.add({
              title: 'Could not save that order',
              description: buyingErrorMessage(error, 'Nothing was changed.'),
              type: 'error',
            });
            resolve(null);
          },
        }
      );
    });

  return { saving: save.isPending, doSave };
}
