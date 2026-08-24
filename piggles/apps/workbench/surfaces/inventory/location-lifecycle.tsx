'use client';

// Closing keeps the location; archiving removes it. Both are quiet, deliberate
// rows after the work rather than cards competing with the fields somebody came
// to change.

import { Button, Checkbox, Text } from '@wizeworks/silicaui-react';
import { faBoxArchive } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { Location } from './locations-data';
import type { Draft } from './location-draft';

/** Archiving removes the location for good, so it says what survives and what
 *  the server will refuse. Only ever on a location that exists. */
function ArchiveRow({
  existing,
  archiving,
  onArchive,
}: {
  existing: Location | null;
  archiving: boolean;
  onArchive: () => Promise<void>;
}) {
  if (!existing) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Text className="text-sm">
        Archiving removes this location for good. Its past movements are kept. You can only archive
        a location once it holds no stock.
      </Text>
      <Button
        size="sm"
        variant="outline"
        color="danger"
        disabled={archiving}
        onClick={() => {
          void onArchive();
        }}
      >
        <Icon glyph={faBoxArchive} className="size-4" aria-hidden />
        {archiving ? 'Archiving…' : 'Archive'}
      </Button>
    </div>
  );
}

export function LocationLifecycle({
  draft,
  set,
  existing,
  archiving,
  onArchive,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  existing: Location | null;
  archiving: boolean;
  onArchive: () => Promise<void>;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
      <label className="flex items-start gap-3">
        <Checkbox
          color="module"
          checked={draft.isActive}
          aria-label="This location is in use"
          onChange={(event) => {
            set('isActive', event.target.checked);
          }}
        />
        <span className="flex flex-col gap-0.5">
          <Text as="span" className="font-medium">
            This location is in use
          </Text>
          <Text as="span" className="text-sm">
            Switch this off to close the location without removing it — it keeps its history but
            takes no new stock, and disappears from the everyday list. Turn it back on any time.
          </Text>
        </span>
      </label>

      <ArchiveRow existing={existing} archiving={archiving} onArchive={onArchive} />
    </div>
  );
}
