'use client';

// Feeds ShortcutPanel. Its own component so the hooks only run while a list is
// actually being browsed, and so the shell stays presentation-only.

import { useClearRecents, useToggleFavorite } from '@/lib/api/shell-data';
import { FAVOURITES_LIST, type ShortcutList } from '@/lib/console/shortcut-lists';
import { useShortcutSurfaces } from '@/lib/console/use-shortcut-surfaces';
import { useWorkbench } from '@/lib/workbench/context';
import { ShortcutPanel } from './shortcut-panel';

export function ShortcutPanelHost({
  list,
  pinned,
  onTogglePin,
  onDismiss,
}: {
  list: ShortcutList;
  pinned: boolean;
  onTogglePin: () => void;
  onDismiss: () => void;
}) {
  const { controller } = useWorkbench();
  const { favourites, recents } = useShortcutSurfaces();
  const toggleFavorite = useToggleFavorite();
  const clearRecents = useClearRecents();

  return (
    <ShortcutPanel
      list={list}
      surfaces={list === FAVOURITES_LIST ? favourites : recents}
      clearing={clearRecents.isPending}
      pinned={pinned}
      onTogglePin={onTogglePin}
      onDismiss={onDismiss}
      onOpen={(definition) => {
        controller.open(definition.key);
      }}
      onRemove={(definition) => {
        toggleFavorite.mutate({ actionId: definition.key, favorited: true });
      }}
      onClear={() => {
        clearRecents.mutate();
      }}
    />
  );
}
