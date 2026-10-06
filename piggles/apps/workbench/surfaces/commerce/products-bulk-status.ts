'use client';

// Delete, retire and put on sale for the bulk bar. Each confirm says what the
// single-product one says, plus the count; each toast names what moved.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { productErrorMessage, type ProductStatus } from './products-data';
import { useBulkDeleteProducts, useBulkProductStatus } from './products-bulk';
import { productCount, targetCount, type BulkTarget } from './products-bulk-words';

export function useDeleteChosen(done: () => void) {
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useBulkDeleteProducts();
  const run = async (ids: string[]) => {
    const ok = await confirm({
      title: `Delete ${productCount(ids.length)}?`,
      description: `Their prices, codes, descriptions and every version of them go too, and they disappear from your website immediately. Orders that already contain them keep their record of what was bought. This cannot be undone: retire them instead if you might sell them again.`,
      confirmLabel: `Delete ${productCount(ids.length)}`,
      cancelLabel: 'Keep them',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(ids, {
      onSuccess: (result) => {
        done();
        toast.add({
          title: `${productCount(result.deleted)} deleted`,
          description:
            result.skipped > 0
              ? `${productCount(result.skipped)} had already gone, so nothing there was changed.`
              : undefined,
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete those',
          description: productErrorMessage(error, 'Nothing was removed.'),
          type: 'error',
        });
      },
    });
  };
  return { run, isPending: remove.isPending };
}

const STATUS_WORDS = {
  active: {
    title: (n: string) => `Put ${n} on sale?`,
    description:
      'They go onto your website and people can buy them straight away. You can take any of them back off at any time.',
    confirm: (n: string) => `Put ${n} on sale`,
    cancel: 'Not yet',
    color: 'success',
    done: (n: string) => `${n} put on sale`,
    already: (count: number) =>
      `${productCount(count)} ${count === 1 ? 'was' : 'were'} on sale already.`,
    failed: 'Could not put those on sale',
  },
  archived: {
    title: (n: string) => `Retire ${n}?`,
    description:
      'They come off your website and stop being sellable, and everything about them is kept. You can put them back on sale whenever you want.',
    confirm: (n: string) => `Retire ${n}`,
    cancel: 'Leave them',
    color: 'module',
    done: (n: string) => `${n} retired`,
    already: (count: number) => `${productCount(count)} had been retired already.`,
    failed: 'Could not retire those',
  },
} as const;

/** Put on sale (`active`) or retire (`archived`) the chosen products. */
export function useStatusChosen(
  status: Extract<ProductStatus, 'active' | 'archived'>,
  done: () => void
) {
  const toast = useToast();
  const confirm = useConfirm();
  const setStatus = useBulkProductStatus();
  const words = STATUS_WORDS[status];
  const run = async (target: BulkTarget) => {
    const n = productCount(targetCount(target));
    const ok = await confirm({
      title: words.title(n),
      description: words.description,
      confirmLabel: words.confirm(n),
      cancelLabel: words.cancel,
      color: words.color,
    });
    if (!ok) return;
    setStatus.mutate(
      { target, status },
      {
        onSuccess: (result) => {
          done();
          const unchanged = result.unchanged ?? 0;
          toast.add({
            title: words.done(productCount(result.updated)),
            description: unchanged > 0 ? words.already(unchanged) : undefined,
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: words.failed,
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };
  return { run, isPending: setStatus.isPending };
}
