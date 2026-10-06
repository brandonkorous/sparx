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
// ── More than a page ─────────────────────────────────────────────────────────
//
// A catalog of 653 parts is organized by search: "Fuel System", then file all
// 126. Ticking the page header chooses the 50 on screen, and the bar then offers
// every match. Once chosen, the bar acts on the LIST'S NARROWING rather than on
// ids, and the server resolves it at the moment of the write (issue 065).
//
// Delete is the one action that never takes "every match": it acts only on
// rows somebody ticked, up to 200, because it is the one that cannot be undone
// and "everything that matched a search" is not something anybody has looked at.

import { useState, type ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Archive, ChevronDown, FolderPlus, Puzzle, Trash2 } from 'lucide-react';
import { BulkBar } from '../../components/bulk-bar';
import { useConfirm } from '../../lib/confirm';
import { afterMenuClose } from '../../lib/defer';
import { apiErrorMessage } from '../../lib/api-error';
import type { ListSelection } from '../../lib/workbench/selection';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { ProductRow } from './products-data';
import { useBulkDeleteProducts, useBulkProductStatus } from './products-bulk';
import {
  chosenSummary,
  productCount,
  targetCount,
  wholeResultOffer,
  type BulkTarget,
  type ProductMatchQuery,
} from './products-bulk-words';
import { BulkCategoryDialog } from './products-bulk-category';
import { BulkFitmentDialog } from './products-bulk-fitment';

type Chosen = ListSelection<ProductRow>;

type Open =
  | { kind: 'category'; direction: 'add' | 'remove' }
  | { kind: 'fitment'; direction: 'add' | 'remove' }
  | null;

function useDeleteChosen(done: () => void) {
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useBulkDeleteProducts();

  const run = async (ids: string[]) => {
    const ok = await confirm({
      title: `Delete ${productCount(ids.length)}?`,
      description:
        'Their prices, codes, descriptions and every version of them go too, and they disappear from your website immediately. Orders that already contain them keep their record of what was bought. This cannot be undone: retire them instead if you might sell them again.',
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
          // A skip means somebody else got there first. Said plainly rather than
          // folded into the total, because "15 deleted" when 14 went is the kind
          // of thing found weeks later.
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
          description: apiErrorMessage(error, 'Nothing was removed.'),
          type: 'error',
        });
      },
    });
  };

  return { run, isPending: remove.isPending };
}

function useRetireChosen(done: () => void) {
  const toast = useToast();
  const confirm = useConfirm();
  const setStatus = useBulkProductStatus();

  const run = async (target: BulkTarget) => {
    const n = targetCount(target);
    const ok = await confirm({
      title: `Retire ${productCount(n)}?`,
      description:
        'They come off your website and stop being sellable, and everything about them is kept. You can put them back on sale whenever you want.',
      confirmLabel: `Retire ${productCount(n)}`,
      cancelLabel: 'Leave them',
      color: 'module',
    });
    if (!ok) return;
    setStatus.mutate(
      { target, status: 'archived' },
      {
        onSuccess: (result) => {
          done();
          toast.add({
            title: `${productCount(result.updated)} retired`,
            description:
              result.unchanged !== undefined && result.unchanged > 0
                ? `${productCount(result.unchanged)} had been retired already.`
                : undefined,
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not retire those',
            description: apiErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return { run, isPending: setStatus.isPending };
}

/** A menu of the two directions of one kind of change. */
function TwoWayMenu({
  icon,
  label,
  disabled,
  items,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  items: { label: string; onPick: () => void }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="sm" color="module" disabled={disabled}>
          {icon}
          {label}
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={() => {
              // Opening a dialog from a menu item waits for the menu to finish
              // closing, or the two fight over focus.
              afterMenuClose(item.onPick);
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProductsBulkActions({
  ctx,
  selection,
  match,
  total,
  narrowed,
  everyMatch,
  onEveryMatch,
  toolbar,
}: {
  ctx: SurfaceContext;
  selection: Chosen;
  /** The list's narrowing right now. */
  match: ProductMatchQuery;
  /** How many the list matches, from the server. */
  total: number | undefined;
  narrowed: boolean;
  /** Whether "every match" is chosen rather than the ticked rows. */
  everyMatch: boolean;
  onEveryMatch: (on: boolean) => void;
  toolbar: ReactNode;
}) {
  const [open, setOpen] = useState<Open>(null);

  const clear = () => {
    selection.clear();
    onEveryMatch(false);
  };
  const remove = useDeleteChosen(clear);
  const retire = useRetireChosen(clear);

  const ids = [...selection.chosen.keys()];
  const target: BulkTarget =
    everyMatch && total !== undefined
      ? { kind: 'match', match, total }
      : { kind: 'ids', productIds: ids };
  const busy = remove.isPending || retire.isPending;
  const offer = everyMatch
    ? null
    : wholeResultOffer({
        allOnPageChosen: selection.allOnPageChosen,
        chosen: selection.count,
        total,
        narrowed,
      });

  return (
    <>
      <BulkBar
        count={everyMatch ? targetCount(target) : selection.count}
        summary={chosenSummary(target, narrowed)}
        beside={
          offer?.kind === 'offer' ? (
            <Button
              size="sm"
              variant="link"
              color="module"
              onClick={() => {
                onEveryMatch(true);
              }}
            >
              {offer.label}
            </Button>
          ) : offer?.kind === 'too-many' ? (
            <Text className="text-base">{offer.text}</Text>
          ) : null
        }
        onClear={clear}
        toolbar={toolbar}
      >
        {/* Organizing first, reversible next, irreversible last, and only the
            last one is red. */}
        <TwoWayMenu
          icon={<FolderPlus className="size-4" aria-hidden />}
          label="Category"
          disabled={busy}
          items={[
            {
              label: 'Put in a category…',
              onPick: () => {
                setOpen({ kind: 'category', direction: 'add' });
              },
            },
            {
              label: 'Take out of a category…',
              onPick: () => {
                setOpen({ kind: 'category', direction: 'remove' });
              },
            },
          ]}
        />
        <TwoWayMenu
          icon={<Puzzle className="size-4" aria-hidden />}
          label="What they fit"
          disabled={busy}
          items={[
            {
              label: 'Add what they fit…',
              onPick: () => {
                setOpen({ kind: 'fitment', direction: 'add' });
              },
            },
            {
              label: 'Remove what they fit…',
              onPick: () => {
                setOpen({ kind: 'fitment', direction: 'remove' });
              },
            },
          ]}
        />
        <Button
          size="sm"
          variant="outline"
          color="module"
          disabled={busy}
          loading={retire.isPending}
          onClick={() => {
            void retire.run(target);
          }}
        >
          <Archive className="size-4" aria-hidden />
          Retire
        </Button>
        {target.kind === 'ids' ? (
          <Button
            size="sm"
            color="danger"
            disabled={busy}
            loading={remove.isPending}
            onClick={() => {
              void remove.run(ids);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        ) : null}
      </BulkBar>

      {open?.kind === 'category' ? (
        <BulkCategoryDialog
          direction={open.direction}
          target={target}
          onClose={() => {
            setOpen(null);
          }}
          onDone={clear}
        />
      ) : null}
      {open?.kind === 'fitment' ? (
        <BulkFitmentDialog
          ctx={ctx}
          direction={open.direction}
          target={target}
          onClose={() => {
            setOpen(null);
          }}
          onDone={clear}
        />
      ) : null}
    </>
  );
}
