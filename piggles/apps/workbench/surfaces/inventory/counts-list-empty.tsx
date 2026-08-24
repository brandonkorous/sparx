'use client';

// The two kinds of nothing on the counts list.
//
// Nothing matches the filters · no count has ever been started. The second
// invites the first count; the first must not, or someone who filtered to
// "Applied" and has none yet is told to go start counting when they are mid-way
// through their first session two filters away.

import { Button } from '@wizeworks/silicaui-react';
import { faClipboardCheck, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListEmptyState } from '../../components/list-empty-state';
import type { SurfaceContext } from '../../lib/surfaces/registry';

export function CountsListEmpty({
  ctx,
  module,
  filtered,
  locationName,
}: {
  ctx: SurfaceContext;
  module: string;
  filtered: boolean;
  locationName: string | null;
}) {
  return (
    <ListEmptyState
      module={module}
      filtered={filtered}
      noResults={{
        icon: <Icon glyph={faClipboardCheck} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: locationName
          ? `No counts match those filters at ${locationName}. Clear the status, or switch back to every location.`
          : 'No counts match those filters. Try clearing the status filter or a different location.',
      }}
      firstRun={{
        title: 'No stock counts yet',
        description:
          'A stock count is where you count what is really on the shelf and put the numbers right. Start one, count each item, and apply it to correct your stock in one go.',
        actions: (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open('inventory.counts.detail', { id: 'new' }, { target: 'tab' });
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Start a count
          </Button>
        ),
      }}
    />
  );
}
