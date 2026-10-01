'use client';

// THE WAY OUT OF "SET WHAT YOU PAID FOR THEM".
//
// Four screens tell a business owner that some of her stock has no cost price, and
// that the figures on them are therefore short:
//
//   Holding cost      "68 items have no cost price"
//   Slow moving        "the real amount tied up is higher than it says"
//   ABC classes        "those lines rank at the bottom whatever they are
//                       really worth"
//   GL reconciliation  "375 units counted onto the shelf with nothing
//                       recorded about what they cost"
//
// Every one of them then says to go and set a cost, and none of them said where.
// There IS a screen for it — "Uncosted stock" — which lists every
// unpriced item, biggest holding first, with a cost box on each row, so the top
// few entries fix most of the number. The catalog entry for that screen already
// claims it "is reached from the figures that admit the gap". It was reached
// from two screens, and neither of them was one of these.
//
// Cost variance used to carry this button too, and it was the wrong door there:
// its gap is a missing PLAN on stock that already has a cost, and this list
// holds only stock with no cost at all. It opens each product's price now
// (issue 902).
//
// One component rather than four buttons, so the words and the route stay in
// step and the next screen to admit the gap gets the same way out.

import { AlertActions, Button } from '@wizeworks/silicaui-react';
import { Coins } from 'lucide-react';

/** Where the button goes: a new tab beside the reader's other work, because the
 *  reader is going to come back to the figure they were reading. */
export const SET_COSTS_SURFACE = 'inventory.costing.uncosted';

export function SetCostsAction({ onOpen }: { onOpen: () => void }) {
  return (
    <AlertActions>
      <Button size="sm" color="module" variant="soft" onClick={onOpen}>
        <Coins className="size-4" aria-hidden />
        Put in what they cost
      </Button>
    </AlertActions>
  );
}
