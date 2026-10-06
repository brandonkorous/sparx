'use client';

// Put the chosen products in a category, or take them out of one.
//
// A dialog rather than a pane: one choice and one press, seconds of work, and
// nothing to come back to. It acts on the chosen products and nothing else, and
// it ADDS: a product keeps every other category it is in. That is the whole
// difference from a product's own Filing tab, which sets the full list.
//
// Adding can make the category on the spot. Somebody who has just searched
// "Fuel System" and chosen 126 parts should not have to leave, build a category
// in another pane, and come back to a selection that a search box would have
// cleared on the way.

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
  RadioGroup,
  RadioOption,
  SearchInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { FolderMinus, FolderPlus } from 'lucide-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { afterPaneChange } from '../../lib/defer';
import {
  categoryErrorMessage,
  flattenCategories,
  useCategoryTree,
  useCreateCategory,
  type CategoryChoice,
} from './categories-data';
import { useBulkCategory } from './products-bulk';
import {
  categoryAddedToast,
  categoryRemovedToast,
  productCount,
  targetCount,
  type BulkTarget,
} from './products-bulk-words';

const NEW = '__new__';

function trail(category: CategoryChoice): string {
  return category.trail.join(' › ');
}

/** Case-insensitive over the whole trail, so typing a parent finds its children. */
function filter(all: CategoryChoice[], search: string): CategoryChoice[] {
  const needle = search.trim().toLowerCase();
  if (needle === '') return all;
  return all.filter((category) => trail(category).toLowerCase().includes(needle));
}

export function BulkCategoryDialog({
  direction,
  target,
  onClose,
  onDone,
}: {
  direction: 'add' | 'remove';
  target: BulkTarget;
  onClose: () => void;
  /** After a write that changed something: the selection has done its job. */
  onDone: () => void;
}) {
  const toast = useToast();
  const tree = useCategoryTree();
  const create = useCreateCategory();
  const write = useBulkCategory();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const all = useMemo(() => flattenCategories(tree.data), [tree.data]);
  const matches = useMemo(() => filter(all, search), [all, search]);
  const typed = search.trim();
  const canMake =
    direction === 'add' &&
    typed !== '' &&
    !all.some((category) => category.name.toLowerCase() === typed.toLowerCase());
  const chosen = all.find((category) => category.id === picked);
  const name = picked === NEW && canMake ? typed : chosen?.name;
  const n = targetCount(target);
  const busy = create.isPending || write.isPending;

  const submit = async () => {
    if (!name) return;
    setFailure(null);
    try {
      const categoryId =
        picked === NEW ? (await create.mutateAsync({ name: typed })).id : (chosen?.id ?? '');
      const result = await write.mutateAsync({ target, categoryId, direction });
      onClose();
      if (result.changed > 0) onDone();
      const words = direction === 'add' ? categoryAddedToast(result) : categoryRemovedToast(result);
      afterPaneChange(() => {
        toast.add({ ...words, type: result.changed > 0 ? 'success' : 'info' });
      });
    } catch (error) {
      // The server's own sentence when it has one. A category made a moment ago
      // stays made: it is real, empty, and in the list the next time this opens.
      setFailure(categoryErrorMessage(error, 'This is a problem reaching the server.'));
    }
  };

  const adding = direction === 'add';
  const action = adding
    ? `Put ${productCount(n)} in ${name ? `“${name}”` : 'it'}`
    : `Take ${productCount(n)} out of ${name ? `“${name}”` : 'it'}`;

  const list = () => {
    if (tree.isError) {
      return (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>Could not load your categories</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server. Nothing has been changed.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="danger"
            variant="soft"
            onClick={() => {
              void tree.refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      );
    }
    if (tree.isPending) return <Text role="status">Loading your categories…</Text>;
    if (all.length === 0 && !canMake) {
      return (
        <Text>
          {adding
            ? 'You have no categories yet. Type a name above to make your first one.'
            : 'You have no categories yet, so there is nothing to take these out of.'}
        </Text>
      );
    }
    return (
      <RadioGroup color="module" value={picked} onValueChange={setPicked} aria-label="Category">
        {canMake ? (
          <RadioOption value={NEW}>
            <span className="font-semibold">Make a new category called “{typed}”</span>
          </RadioOption>
        ) : null}
        {matches.map((category) => (
          <RadioOption key={category.id} value={category.id}>
            <span className="min-w-0">
              {category.trail.slice(0, -1).map((ancestor) => (
                <span key={ancestor}>{ancestor} › </span>
              ))}
              <span className="font-semibold">{category.name}</span>
            </span>
          </RadioOption>
        ))}
        {matches.length === 0 && !canMake ? (
          <Text>No category is called anything like “{typed}”.</Text>
        ) : null}
      </RadioGroup>
    );
  };

  return (
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
          <DialogTitle>
            {adding
              ? `Put ${productCount(n)} in a category`
              : `Take ${productCount(n)} out of a category`}
          </DialogTitle>
          <DialogDescription>
            {adding
              ? 'A category is a section of your website’s menu, like an aisle in a shop. Any category these are in already, they stay in.'
              : 'They come out of the one category you choose and stay in every other category they are in. You can put them back at any time.'}
          </DialogDescription>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            <SearchInput
              size="sm"
              aria-label={adding ? 'Find a category or type a new name' : 'Find a category'}
              placeholder={adding ? 'Find a category or type a new name…' : 'Find a category…'}
              value={search}
              onValueChange={setSearch}
            />
            {list()}
            {failure ? (
              <Alert color="danger" variant="soft" role="alert">
                <AlertContent>
                  <AlertTitle>Nothing was changed</AlertTitle>
                  <AlertDescription>{failure}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              color={adding ? 'module' : 'warning'}
              disabled={!name}
              loading={busy}
              onClick={() => {
                void submit();
              }}
            >
              {adding ? (
                <FolderPlus className="size-4" aria-hidden />
              ) : (
                <FolderMinus className="size-4" aria-hidden />
              )}
              {action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
