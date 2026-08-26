'use client';

// The three writes a discount editor makes — save, switch on, retire — with the
// toast and confirm each one owes the person doing it.
//
// Kept out of the surface so the editor reads as a form: what it shows and what
// it validates, rather than what it does afterwards.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { buildDiscountInput, type Draft } from './discount-draft';
import {
  discountErrorMessage,
  useActivateDiscount,
  useArchiveDiscount,
  useCreateDiscount,
  useUpdateDiscount,
  type Discount,
} from './discounts-data';

export interface DiscountWrites {
  save: (draft: Draft) => void;
  activate: () => void;
  retire: () => Promise<void>;
  saving: boolean;
  activating: boolean;
  retiring: boolean;
  /** A save that failed, in the owner's words. Null while nothing is wrong. */
  failure: string | null;
  /** True once a create has landed, so the leave-guard can stand down. */
  created: boolean;
}

export function useDiscountWrites(
  ctx: SurfaceContext,
  id: string,
  discount: Discount | undefined,
  onSaved: () => void
): DiscountWrites {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const create = useCreateDiscount();
  const update = useUpdateDiscount(id);
  const activate = useActivateDiscount(id);
  const archive = useArchiveDiscount(id);

  const save = (draft: Draft) => {
    const input = buildDiscountInput(draft);
    if (!input) return;

    if (isNew) {
      create.mutate(input, {
        onSuccess: (created) => {
          ctx.open('commerce.discount.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${input.name} created`, type: 'success' });
          });
        },
      });
      return;
    }

    update.mutate(input, {
      onSuccess: () => {
        onSaved();
        toast.add({ title: 'Discount saved', type: 'success' });
      },
    });
  };

  const onActivate = () => {
    activate.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: 'Discount switched on', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not switch it on',
          description: discountErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const retire = async () => {
    if (!discount) return;
    const ok = await confirm({
      title: `Retire ${discount.name}?`,
      description:
        'This switches the discount off for good — it stops applying immediately and cannot be reopened. Its record of how many times it was used is kept. To pause it temporarily instead, keep it and remove its end date another time.',
      confirmLabel: 'Retire this discount',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    archive.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${discount.name} retired`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not retire this discount',
          description: discountErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return {
    save,
    activate: onActivate,
    retire,
    saving: create.isPending || update.isPending,
    activating: activate.isPending,
    retiring: archive.isPending,
    failure:
      create.isError || update.isError
        ? discountErrorMessage(
            create.error ?? update.error,
            'Could not save this discount. Nothing was changed.'
          )
        : null,
    created: create.isSuccess,
  };
}
