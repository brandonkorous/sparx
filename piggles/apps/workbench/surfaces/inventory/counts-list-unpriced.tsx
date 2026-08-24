'use client';

// A count that moved 372 garments and reports "No cost yet" has told the truth
// and left the reader stuck. This is the way out, and it only appears when a row
// on screen is actually saying it.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faCoins } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

export function CountsUnpricedNotice({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-base-100 flex shrink-0 flex-wrap items-center gap-3 rounded-lg p-2">
      <Text className="text-sm">
        Some counts below say “No cost yet”. They moved real stock — there is just nothing recorded
        about what it cost, so they cannot be given a value.
      </Text>
      <Button size="sm" color="module" className="ml-auto shrink-0" onClick={onOpen}>
        <Icon glyph={faCoins} className="size-4" aria-hidden />
        Put in what they cost
      </Button>
    </div>
  );
}
