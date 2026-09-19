'use client';

// A count that moved 372 garments and reports no value has told the truth and
// left the reader stuck. This is the way out.
//
// IT DESCRIBES THE FACT, IT DOES NOT QUOTE THE COLUMN. This notice used to open
// with: Some counts below say "No cost yet". Those words live in the Difference
// column, which is `hidden @xl:table-cell` - so in the three-pane layout a shop
// owner actually works in, the column is off screen and the same row reads "no
// cost recorded" instead. The notice sent her hunting for a phrase that was not
// there. A sentence about what a row SAYS breaks the first time a breakpoint
// hides the row that says it.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faCoins } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

export function CountsUnpricedNotice({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-base-100 flex shrink-0 flex-wrap items-center gap-3 rounded-lg p-2">
      <Text className="text-sm">
        Some counts below moved real stock and cannot be given a value. There is nothing recorded
        about what those items cost.
      </Text>
      <Button size="sm" color="module" className="ml-auto shrink-0" onClick={onOpen}>
        <Icon glyph={faCoins} className="size-4" aria-hidden />
        Put in what they cost
      </Button>
    </div>
  );
}
