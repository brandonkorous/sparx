'use client';

// What you can do to several products at once.
//
// ── The confirm has to say the same things the single one does ──────────────
//
// Deleting one product warns that its price, codes and versions go with it, that
// it leaves the website immediately, that past orders keep their record, and
// that retiring is the reversible alternative. All four are still true of
// fifteen, and a bulk dialog that drops them because it is talking about a
// number rather than a name is how a bulk action becomes the dangerous one.
//
// So: same warnings, plus the count, plus the alternative offered as an actual
// button rather than as advice.
//
// ── The bar has to offer the direction that makes money ─────────────────────
//
// It shipped with Retire and Delete only, so choosing rows meant getting rid of
// them. Putting a set of products ON sale is the commonest bulk act there is and
// the endpoint already did it — see issue 207.

import type { ReactNode } from 'react';
import { Button, useToast } from '@wizeworks/silicaui-react';
import { faBoxArchive, faStore, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { BulkBar } from '../../components/bulk-bar';
import { useConfirm } from '../../lib/confirm';
import type { ListSelection } from '../../lib/workbench/selection';
import { productErrorMessage, type ProductRow } from './products-data';
import { useBulkDeleteProducts, useBulkProductStatus } from './products-bulk';

/** "3 products" / "1 product" — the count is the thing a person checks before
 *  pressing something irreversible, so it leads every sentence here. */
function count(n: number): string {
  return n === 1 ? '1 product' : `${n} products`;
}

type Chosen = ListSelection<ProductRow>;

function useDeleteChosen(selection: Chosen) {
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useBulkDeleteProducts();

  const run = async (ids: string[]) => {
    const ok = await confirm({
      title: `Delete ${count(ids.length)}?`,
      description: `Their prices, codes, descriptions and every version of them go too, and they disappear from your website immediately. Orders that already contain them keep their record of what was bought. This cannot be undone — retire them instead if you might sell them again.`,
      confirmLabel: `Delete ${count(ids.length)}`,
      cancelLabel: 'Keep them',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(ids, {
      onSuccess: (result) => {
        selection.clear();
        toast.add({
          title: `${count(result.deleted)} deleted`,
          // A skip means somebody else got there first. Said plainly rather than
          // folded into the total, because "15 deleted" when 14 went is the kind
          // of thing found weeks later.
          description:
            result.skipped > 0
              ? `${count(result.skipped)} had already gone, so nothing there was changed.`
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

function usePutOnSaleChosen(selection: Chosen) {
  const toast = useToast();
  const confirm = useConfirm();
  const setStatus = useBulkProductStatus();

  const run = async (ids: string[]) => {
    const ok = await confirm({
      title: `Put ${count(ids.length)} on sale?`,
      description:
        'They go onto your website and people can buy them straight away. You can take any of them back off at any time.',
      confirmLabel: `Put ${count(ids.length)} on sale`,
      cancelLabel: 'Not yet',
      color: 'success',
    });
    if (!ok) return;
    setStatus.mutate(
      { productIds: ids, status: 'active' },
      {
        onSuccess: (result) => {
          selection.clear();
          toast.add({ title: `${count(result.updated)} put on sale`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not put those on sale',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return { run, isPending: setStatus.isPending };
}

function useRetireChosen(selection: Chosen) {
  const toast = useToast();
  const confirm = useConfirm();
  const setStatus = useBulkProductStatus();

  const run = async (ids: string[]) => {
    const ok = await confirm({
      title: `Retire ${count(ids.length)}?`,
      description:
        'They come off your website and stop being sellable, and everything about them is kept. You can put them back on sale whenever you want.',
      confirmLabel: `Retire ${count(ids.length)}`,
      cancelLabel: 'Leave them',
      color: 'module',
    });
    if (!ok) return;
    setStatus.mutate(
      { productIds: ids, status: 'archived' },
      {
        onSuccess: (result) => {
          selection.clear();
          toast.add({ title: `${count(result.updated)} retired`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not retire those',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return { run, isPending: setStatus.isPending };
}

export function ProductsBulkActions({
  selection,
  toolbar,
}: {
  selection: Chosen;
  toolbar: ReactNode;
}) {
  const remove = useDeleteChosen(selection);
  const retire = useRetireChosen(selection);
  const publish = usePutOnSaleChosen(selection);

  const ids = [...selection.chosen.keys()];
  // Only the ones this would actually move. "7 products put on sale" when four
  // moved is how a number stops being believed, so the three already out are not
  // counted and the button goes away when there is nothing off sale.
  const offSale = [...selection.chosen.values()].filter((row) => row.status !== 'active');
  const busy = remove.isPending || retire.isPending || publish.isPending;

  return (
    <BulkBar
      count={selection.count}
      summary={`${count(selection.count)} chosen`}
      onClear={selection.clear}
      toolbar={toolbar}
    >
      {/* Constructive first, reversible next, irreversible last, and only the
          last one is red. Two danger buttons side by side make neither mean
          anything, and a bar that offers only harm teaches that choosing rows is
          for getting rid of them. */}
      {offSale.length > 0 ? (
        <Button
          size="sm"
          color="success"
          disabled={busy}
          loading={publish.isPending}
          onClick={() => {
            void publish.run(offSale.map((row) => row.id));
          }}
        >
          <Icon glyph={faStore} className="size-4" aria-hidden />
          Put on sale
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        color="module"
        disabled={busy}
        loading={retire.isPending}
        onClick={() => {
          void retire.run(ids);
        }}
      >
        <Icon glyph={faBoxArchive} className="size-4" aria-hidden />
        Retire
      </Button>
      <Button
        size="sm"
        color="danger"
        disabled={busy}
        loading={remove.isPending}
        onClick={() => {
          void remove.run(ids);
        }}
      >
        <Icon glyph={faTrash} className="size-4" aria-hidden />
        Delete
      </Button>
    </BulkBar>
  );
}
