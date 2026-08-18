'use client';

// The rows inside the views menu: the saved views themselves, and what you can
// do to the one you are currently looking at.
//
// Both kinds live in one menu because a saved view is not a setting you go and
// manage — it is the thing you just applied, and renaming or pinning it is a
// thought you have while looking at it.

import { Badge, DropdownMenuItem, useToast } from '@wizeworks/silicaui-react';
import { faCheck, faStar, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useMutation } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { afterCommit, afterMenuClose } from '../../lib/defer';
import { useConfirm } from '../../lib/confirm';
import { useInvalidateViews, type SavedView } from './data';

interface ViewRowsProps {
  items: readonly SavedView[];
  activeId: string | undefined;
  onApply: (params: Record<string, string>) => void;
}

/** Every view this list has, shared and private together — the distinction
 *  matters when SAVING and almost never afterwards. */
export function ViewRows({ items, activeId, onApply }: ViewRowsProps) {
  if (items.length === 0) {
    return <DropdownMenuItem disabled>No saved views yet</DropdownMenuItem>;
  }

  return (
    <>
      {items.map((view) => (
        <DropdownMenuItem
          key={view.id}
          onClick={() => {
            afterMenuClose(() => {
              onApply(view.config.params);
            });
          }}
        >
          {view.id === activeId ? (
            <Icon glyph={faCheck} className="size-4" aria-hidden />
          ) : (
            // A blank of the same size, so the names stay in one column.
            <span className="size-4" aria-hidden />
          )}
          <span className="flex-1 truncate">{view.name}</span>
          {view.shared ? (
            <Badge color="info" variant="soft" size="sm">
              Team
            </Badge>
          ) : null}
          {view.isDefault ? (
            <Badge color="module" variant="soft" size="sm">
              Opens here
            </Badge>
          ) : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** Pin it, or forget it. Only rendered when a saved view is actually applied —
 *  there is nothing to pin or delete otherwise. */
export function ViewAdminItems({ target, view }: { target: string; view: SavedView }) {
  const toast = useToast();
  const confirm = useConfirm();
  const invalidate = useInvalidateViews(target);

  const setDefault = useMutation({
    mutationFn: (id: string) => api.post<SavedView>(`/v1/saved-views/${id}/default`, {}),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/v1/saved-views/${id}`),
    onSuccess: invalidate,
  });

  const pin = () => {
    setDefault.mutate(view.id, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({ title: 'This list opens here now', type: 'success' });
        });
      },
    });
  };

  const askThenDelete = async () => {
    const ok = await confirm({
      title: `Delete "${view.name}"?`,
      description:
        'The rows are untouched — this only forgets the saved question. Anyone on the team using a shared view will lose it too.',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(view.id, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({ title: 'Deleted', type: 'success' });
        });
      },
    });
  };

  return (
    <>
      <DropdownMenuItem
        onClick={() => {
          afterMenuClose(pin);
        }}
      >
        <Icon glyph={faStar} className="size-4" aria-hidden />
        Open this list here by default
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          afterMenuClose(() => {
            void askThenDelete();
          });
        }}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        Delete this view
      </DropdownMenuItem>
    </>
  );
}
