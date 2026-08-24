'use client';

// Retiring and deleting: both RARE and one of them permanent. As full cards
// beside the description they would carry the same weight as the work somebody
// came here to do, which is how a destructive button becomes a habit.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faBox, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

export function ProductRareMoves({
  retired,
  retiring,
  deleting,
  onToggleRetired,
  onDelete,
}: {
  retired: boolean;
  retiring: boolean;
  deleting: boolean;
  onToggleRetired: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-sm">
          {retired
            ? 'This product is retired. Bringing it back puts it in your working catalog again — it stays off sale until you say otherwise.'
            : 'Retiring takes it off your website and out of your working catalog without deleting anything. You can bring it back at any time.'}
        </Text>
        <Button
          size="sm"
          variant="outline"
          color={retired ? 'module' : undefined}
          loading={retiring}
          onClick={onToggleRetired}
        >
          <Icon glyph={faBox} className="size-4" aria-hidden />
          {retired ? 'Bring it back' : 'Retire it'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-sm">
          Deleting removes this product and every version of it for good. Past orders keep their
          record of what was bought.
        </Text>
        <Button size="sm" variant="outline" color="danger" loading={deleting} onClick={onDelete}>
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          Delete this product
        </Button>
      </div>
    </div>
  );
}
