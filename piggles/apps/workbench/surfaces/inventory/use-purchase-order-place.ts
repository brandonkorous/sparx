// Placing an order with the supplier, and emailing a placed one.

import { useState } from 'react';
import { afterPaneChange } from '../../lib/defer';
import { formatCents } from './data';
import { buyingErrorMessage } from './suppliers-data';
import {
  useEmailPurchaseOrder,
  usePlacePurchaseOrder,
  type PurchaseOrderDetail,
} from './purchase-orders-data';
import { placingWords } from './po-approvals-words';
import { emailedToast } from './purchase-order-email-words';
import type { PurchaseOrderBase } from './use-purchase-order-base';

type Toast = PurchaseOrderBase['toast'];

function placeFailed(toast: Toast) {
  return (error: unknown) => {
    toast.add({
      title: 'Could not place that order',
      description: buyingErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };
}

/** Placed first, then emailed: if the email fails the order is still placed,
 *  and the toast says so rather than "could not place". */
function emailAfterPlacing(toast: Toast, detail: PurchaseOrderDetail) {
  return {
    onSuccess: (sent: { to: string }) => {
      afterPaneChange(() => {
        toast.add({
          title: `${detail.number} placed and emailed to ${sent.to}`,
          description: emailedToast(detail, sent.to).description,
          type: 'success',
        });
      });
    },
    onError: (error: unknown) => {
      afterPaneChange(() => {
        toast.add({
          title: `${detail.number} is placed, but the email did not go`,
          description: `${buyingErrorMessage(error, 'Try again in a moment.')} Use "Email to the supplier" to send it.`,
          type: 'warning',
        });
      });
    },
  };
}

/** Words for placing this order, held (`heldBy`) or not. */
function wordsFor(pane: PurchaseOrderBase, detail: PurchaseOrderDetail, held: boolean) {
  return placingWords(
    { number: detail.number, supplierName: pane.supplierName ?? null },
    held ? pane.heldBy : null,
    (cents) => formatCents(cents, pane.currency)
  );
}

function usePlaceNow(pane: PurchaseOrderBase, id: string) {
  const { toast, detail } = pane;
  const place = usePlacePurchaseOrder(id);
  const emailOrder = useEmailPurchaseOrder(id);
  const [placing, setPlacing] = useState(false);

  const placeNow = (emailIt: boolean) => {
    if (!detail) return;
    const words = wordsFor(pane, detail, false);
    place.mutate(undefined, {
      onSuccess: () => {
        setPlacing(false);
        if (emailIt) {
          emailOrder.mutate(undefined, emailAfterPlacing(toast, detail));
          return;
        }
        afterPaneChange(() => {
          toast.add({
            title: words.toastTitle,
            description: words.toastDescription,
            type: 'success',
          });
        });
      },
      onError: placeFailed(toast),
    });
  };

  return { place, emailOrder, placing, setPlacing, placeNow };
}

export type PlaceNow = ReturnType<typeof usePlaceNow>;

function useSendEmail(pane: PurchaseOrderBase, emailOrder: PlaceNow['emailOrder']) {
  const { toast } = pane;
  const [emailing, setEmailing] = useState(false);

  // `to` is for this one send; absent, the supplier's own.
  const sendEmail = (number: string, to?: string) => {
    emailOrder.mutate(to, {
      onSuccess: (sent) => {
        setEmailing(false);
        afterPaneChange(() => {
          toast.add({ ...emailedToast({ number }, sent.to), type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: `${number} was not emailed`,
          description: buyingErrorMessage(error, 'Nothing was sent. Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  return { emailing, setEmailing, sendEmail };
}

/** A held order cannot go to the supplier yet, so it gets a plain confirm that
 *  says so; one that places straight away gets the place-and-email dialog. */
async function sendForSignOff(pane: PurchaseOrderBase, place: PlaceNow['place']) {
  const { toast, confirm, detail } = pane;
  if (!detail) return;
  const words = wordsFor(pane, detail, true);
  const ok = await confirm({
    title: `Send ${detail.number} for sign-off?`,
    description: words.description,
    confirmLabel: words.confirmLabel,
    cancelLabel: 'Keep it a draft',
    color: 'module',
  });
  if (!ok) return;
  place.mutate(undefined, {
    onSuccess: () => {
      afterPaneChange(() => {
        toast.add({ title: words.toastTitle, description: words.toastDescription, type: 'info' });
      });
    },
    onError: placeFailed(toast),
  });
}

export function usePurchaseOrderPlace(
  pane: PurchaseOrderBase,
  doSave: () => Promise<PurchaseOrderDetail | null>
) {
  const placeNow = usePlaceNow(pane, pane.id);
  const email = useSendEmail(pane, placeNow.emailOrder);

  const onPlace = async () => {
    if (pane.isNew || !pane.detail) return;
    // Save pending edits first so what is placed is what is on screen.
    if (pane.dirty) {
      const saved = await doSave();
      if (!saved) return;
    }
    if (!pane.heldBy) {
      placeNow.setPlacing(true);
      return;
    }
    await sendForSignOff(pane, placeNow.place);
  };

  return { ...placeNow, ...email, onPlace };
}
