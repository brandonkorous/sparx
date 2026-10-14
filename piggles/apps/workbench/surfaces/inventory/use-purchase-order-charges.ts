// The expected costs on one order (duty, customs, a broker's fee): the list, the
// add form's state, and removing one.

import { useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { formatCents } from './data';
import { buyingErrorMessage } from './suppliers-data';
import {
  useAddOrderCharge,
  useOrderCharges,
  useRemoveOrderCharge,
  type AllocationBasis,
  type ChargeKind,
} from './costing-data';
import { chargeAmountCents } from './purchase-order-draft';

function useChargeForm() {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<ChargeKind>('freight');
  const [amount, setAmount] = useState('');
  const [basis, setBasis] = useState<AllocationBasis>('value');
  const amountCents = chargeAmountCents(amount);
  const canSave = amountCents !== null && amountCents > 0;
  return {
    adding,
    setAdding,
    kind,
    setKind,
    amount,
    setAmount,
    basis,
    setBasis,
    amountCents,
    canSave,
  };
}

function useRemoveCharge(currency: string) {
  const toast = useToast();
  const confirm = useConfirm();
  const removeCharge = useRemoveOrderCharge();

  const remove = async (chargeId: string, label: string, allocated: number) => {
    const ok = await confirm({
      title: `Remove ${label}?`,
      description:
        allocated > 0
          ? `${formatCents(allocated, currency)} of this has already landed on deliveries. Removing it takes that back off and revalues whatever you still hold from them.`
          : 'It has not reached any delivery yet, so nothing you hold will change.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    removeCharge.mutate(chargeId, {
      onError: (error) => {
        toast.add({
          title: 'Could not remove that cost',
          description: buyingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return { removing: removeCharge.isPending, remove };
}

export function usePurchaseOrderCharges(purchaseOrderId: string, currency: string) {
  const toast = useToast();
  const charges = useOrderCharges(purchaseOrderId);
  const addCharge = useAddOrderCharge(purchaseOrderId);
  const removal = useRemoveCharge(currency);
  const form = useChargeForm();
  const rows = charges.data ?? [];

  const save = () => {
    if (!form.canSave || form.amountCents === null) return;
    addCharge.mutate(
      { kind: form.kind, amountCents: form.amountCents, allocationBasis: form.basis },
      {
        onSuccess: () => {
          form.setAdding(false);
          form.setAmount('');
          toast.add({
            title: 'Expected cost added',
            description:
              'Each delivery against this order will carry its share, worked out from how much of the order it brings.',
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that cost',
            description: buyingErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const total = rows.reduce((sum, c) => sum + c.amountCents, 0);
  const landed = rows.reduce((sum, c) => sum + (c.allocatedCents ?? 0), 0);
  return { ...form, ...removal, rows, total, landed, save, saving: addCharge.isPending };
}

export type PurchaseOrderCharges = ReturnType<typeof usePurchaseOrderCharges>;

/** The charges model plus the order's currency, as the section's parts read it. */
export type ChargesModel = PurchaseOrderCharges & { currency: string };
