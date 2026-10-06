'use client';

// Put the chosen products in a category, or take them out of one. ADDS: each
// product keeps every other category. Adding can make the category on the spot,
// so a search-built selection survives (issue 065).

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  SearchInput,
  useToast,
} from '@wizeworks/silicaui-react';
import { faFolderMinus, faFolderPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneScope } from '../../lib/dock/window-boundary';
import { afterPaneChange } from '../../lib/defer';
import {
  categoryErrorMessage,
  flattenCategories,
  useCategoryTree,
  useCreateCategory,
} from './categories-data';
import { useBulkCategory } from './products-bulk';
import { CategoryChoices, NEW_CATEGORY, filterCategories } from './products-bulk-category-list';
import {
  categoryAddedToast,
  categoryRemovedToast,
  productCount,
  targetCount,
  type BulkTarget,
} from './products-bulk-words';

type Direction = 'add' | 'remove';

const WORDS = {
  add: {
    title: (n: number) => `Put ${productCount(n)} in a category`,
    lead: 'A category is a section of your website’s menu, like an aisle in a shop. Any category these are in already, they stay in.',
    find: 'Find a category or type a new name',
    action: (n: number, name: string) => `Put ${productCount(n)} in “${name}”`,
  },
  remove: {
    title: (n: number) => `Take ${productCount(n)} out of a category`,
    lead: 'They come out of the one category you choose and stay in every other category they are in. You can put them back at any time.',
    find: 'Find a category',
    action: (n: number, name: string) => `Take ${productCount(n)} out of “${name}”`,
  },
} as const;

/** What is chosen: an existing category, or a new one by the name typed. */
function useCategoryPick(direction: Direction) {
  const tree = useCategoryTree();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState('');
  const all = useMemo(() => flattenCategories(tree.data), [tree.data]);
  const typed = search.trim();
  const canMake =
    direction === 'add' &&
    typed !== '' &&
    !all.some((category) => category.name.toLowerCase() === typed.toLowerCase());
  const chosen = all.find((category) => category.id === picked);
  const making = picked === NEW_CATEGORY && canMake;
  return {
    tree,
    all,
    matches: filterCategories(all, search),
    search,
    setSearch,
    picked,
    setPicked,
    typed,
    canMake,
    chosen,
    making,
    name: making ? typed : chosen?.name,
  };
}

function useSubmit(direction: Direction, target: BulkTarget, done: () => void) {
  const toast = useToast();
  const create = useCreateCategory();
  const write = useBulkCategory();
  const [failure, setFailure] = useState<string | null>(null);
  const run = async (pick: ReturnType<typeof useCategoryPick>) => {
    setFailure(null);
    try {
      const categoryId = pick.making
        ? (await create.mutateAsync({ name: pick.typed })).id
        : (pick.chosen?.id ?? '');
      const result = await write.mutateAsync({ target, categoryId, direction });
      done();
      const words = direction === 'add' ? categoryAddedToast(result) : categoryRemovedToast(result);
      afterPaneChange(() => {
        toast.add({ ...words, type: result.changed > 0 ? 'success' : 'info' });
      });
      return result.changed;
    } catch (error) {
      // A category made a moment ago stays made: real, empty, listed next time.
      setFailure(categoryErrorMessage(error, 'This is a problem reaching the server.'));
      return null;
    }
  };
  return { run, failure, busy: create.isPending || write.isPending };
}

function Failure({ text }: { text: string }) {
  return (
    <Alert color="danger" variant="soft" role="alert">
      <AlertContent>
        <AlertTitle>Nothing was changed</AlertTitle>
        <AlertDescription>{text}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function Footer({
  direction,
  label,
  ready,
  busy,
  onCancel,
  onGo,
}: {
  direction: Direction;
  label: string;
  ready: boolean;
  busy: boolean;
  onCancel: () => void;
  onGo: () => void;
}) {
  return (
    <DialogFooter>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
      <Button
        size="sm"
        color={direction === 'add' ? 'module' : 'warning'}
        disabled={!ready}
        loading={busy}
        onClick={onGo}
      >
        <Icon
          glyph={direction === 'add' ? faFolderPlus : faFolderMinus}
          className="size-4"
          aria-hidden
        />
        {label}
      </Button>
    </DialogFooter>
  );
}

export function BulkCategoryDialog({
  direction,
  target,
  onClose,
  onDone,
}: {
  direction: Direction;
  target: BulkTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const words = WORDS[direction];
  const n = targetCount(target);
  const pick = useCategoryPick(direction);
  const submit = useSubmit(direction, target, onClose);
  const go = async () => {
    const changed = await submit.run(pick);
    if (changed !== null && changed > 0) onDone();
  };

  return (
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next && !submit.busy) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
          <DialogTitle>{words.title(n)}</DialogTitle>
          <DialogDescription>{words.lead}</DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            <SearchInput
              size="sm"
              aria-label={words.find}
              placeholder={`${words.find}…`}
              value={pick.search}
              onValueChange={pick.setSearch}
            />
            <CategoryChoices
              state={pick.tree.isError ? 'error' : pick.tree.isPending ? 'pending' : 'ready'}
              all={pick.all}
              matches={pick.matches}
              typed={pick.typed}
              canMake={pick.canMake}
              adding={direction === 'add'}
              picked={pick.picked}
              onPick={pick.setPicked}
              onRetry={() => void pick.tree.refetch()}
            />
            {submit.failure ? <Failure text={submit.failure} /> : null}
          </div>
          <Footer
            direction={direction}
            label={pick.name ? words.action(n, pick.name) : words.title(n)}
            ready={Boolean(pick.name)}
            busy={submit.busy}
            onCancel={onClose}
            onGo={() => void go()}
          />
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
