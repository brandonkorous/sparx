'use client';

// What you can do to several products at once. Once the page is ticked, the bar
// offers every product the list matches (issue 065). Delete never takes "every
// match": it acts only on rows somebody ticked, because it cannot be undone.

import { useState, type ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Text,
} from '@wizeworks/silicaui-react';
import {
  faBoxArchive,
  faChevronDown,
  faFolderPlus,
  faPuzzlePiece,
  faStore,
  faTrash,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { BulkBar } from '../../components/bulk-bar';
import { afterMenuClose } from '../../lib/defer';
import type { ListSelection } from '../../lib/workbench/selection';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { ProductRow } from './products-data';
import { useDeleteChosen, useStatusChosen } from './products-bulk-status';
import {
  chosenSummary,
  targetCount,
  wholeResultOffer,
  type BulkTarget,
  type ProductMatchQuery,
} from './products-bulk-words';
import { BulkCategoryDialog } from './products-bulk-category';
import { BulkFitmentDialog } from './products-bulk-fitment';

type Open = { kind: 'category' | 'fitment'; direction: 'add' | 'remove' } | null;

function TwoWayMenu(props: {
  glyph: typeof faFolderPlus;
  label: string;
  disabled: boolean;
  items: { label: string; onPick: () => void }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="sm" color="module" disabled={props.disabled}>
          <Icon glyph={props.glyph} className="size-4" aria-hidden />
          {props.label}
          <Icon glyph={faChevronDown} className="size-3" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {props.items.map((item) => (
          // Wait for the menu to close before a dialog opens, or they fight over focus.
          <DropdownMenuItem key={item.label} onClick={() => afterMenuClose(item.onPick)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Organize({ busy, onOpen }: { busy: boolean; onOpen: (next: Open) => void }) {
  return (
    <>
      <TwoWayMenu
        glyph={faFolderPlus}
        label="Category"
        disabled={busy}
        items={[
          {
            label: 'Put in a category…',
            onPick: () => onOpen({ kind: 'category', direction: 'add' }),
          },
          {
            label: 'Take out of a category…',
            onPick: () => onOpen({ kind: 'category', direction: 'remove' }),
          },
        ]}
      />
      <TwoWayMenu
        glyph={faPuzzlePiece}
        label="What they fit"
        disabled={busy}
        items={[
          {
            label: 'Add what they fit…',
            onPick: () => onOpen({ kind: 'fitment', direction: 'add' }),
          },
          {
            label: 'Remove what they fit…',
            onPick: () => onOpen({ kind: 'fitment', direction: 'remove' }),
          },
        ]}
      />
    </>
  );
}

/** Constructive first, reversible next, irreversible last; only the last is red. */
function StatusAndDelete({
  target,
  rows,
  done,
}: {
  target: BulkTarget;
  rows: ProductRow[];
  done: () => void;
}) {
  const remove = useDeleteChosen(done);
  const retire = useStatusChosen('archived', done);
  const publish = useStatusChosen('active', done);
  const busy = remove.isPending || retire.isPending || publish.isPending;
  // Ticked rows: only the ones off sale, so the count is the count that moves.
  const offSale: BulkTarget =
    target.kind === 'ids'
      ? { kind: 'ids', productIds: rows.filter((r) => r.status !== 'active').map((r) => r.id) }
      : target;
  return (
    <>
      {targetCount(offSale) > 0 ? (
        <Button
          size="sm"
          color="success"
          disabled={busy}
          loading={publish.isPending}
          onClick={() => void publish.run(offSale)}
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
        onClick={() => void retire.run(target)}
      >
        <Icon glyph={faBoxArchive} className="size-4" aria-hidden />
        Retire
      </Button>
      {target.kind === 'ids' ? (
        <Button
          size="sm"
          color="danger"
          disabled={busy}
          loading={remove.isPending}
          onClick={() => void remove.run(target.productIds)}
        >
          <Icon glyph={faTrash} className="size-4" aria-hidden />
          Delete
        </Button>
      ) : null}
    </>
  );
}

function Widen(props: {
  selection: ListSelection<ProductRow>;
  total: number | undefined;
  narrowed: boolean;
  everyMatch: boolean;
  onEveryMatch: (on: boolean) => void;
}) {
  if (props.everyMatch) return null;
  const offer = wholeResultOffer({
    allOnPageChosen: props.selection.allOnPageChosen,
    chosen: props.selection.count,
    total: props.total,
    narrowed: props.narrowed,
  });
  if (offer?.kind === 'too-many') return <Text className="text-base">{offer.text}</Text>;
  if (offer?.kind !== 'offer') return null;
  return (
    <Button size="sm" variant="link" color="module" onClick={() => props.onEveryMatch(true)}>
      {offer.label}
    </Button>
  );
}

export function ProductsBulkActions(props: {
  ctx: SurfaceContext;
  selection: ListSelection<ProductRow>;
  match: ProductMatchQuery;
  total: number | undefined;
  narrowed: boolean;
  everyMatch: boolean;
  onEveryMatch: (on: boolean) => void;
  toolbar: ReactNode;
}) {
  const { selection, total, everyMatch, onEveryMatch } = props;
  const [open, setOpen] = useState<Open>(null);
  const clear = () => {
    selection.clear();
    onEveryMatch(false);
  };
  const target: BulkTarget =
    everyMatch && total !== undefined
      ? { kind: 'match', match: props.match, total }
      : { kind: 'ids', productIds: [...selection.chosen.keys()] };
  const close = () => setOpen(null);
  return (
    <>
      <BulkBar
        count={targetCount(target)}
        summary={chosenSummary(target, props.narrowed)}
        beside={<Widen {...props} />}
        onClear={clear}
        toolbar={props.toolbar}
      >
        <Organize busy={false} onOpen={setOpen} />
        <StatusAndDelete target={target} rows={[...selection.chosen.values()]} done={clear} />
      </BulkBar>
      {open?.kind === 'category' ? (
        <BulkCategoryDialog
          direction={open.direction}
          target={target}
          onClose={close}
          onDone={clear}
        />
      ) : null}
      {open?.kind === 'fitment' ? (
        <BulkFitmentDialog
          ctx={props.ctx}
          direction={open.direction}
          target={target}
          onClose={close}
          onDone={clear}
        />
      ) : null}
    </>
  );
}
