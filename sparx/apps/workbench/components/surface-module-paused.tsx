'use client';

// What a pane shows when its module is paused because the bill lapsed.
//
// The sibling of SurfaceModuleOff, and asked at the same mount, for the same
// reason: the answer is the same for every surface of a module, so it is asked
// once. A paused module is not switched off. The owner did not choose it, the
// rail still lists it, and it comes back by itself the moment a card is added.
// So it says what happened, that nothing is lost, how long the website keeps
// working, and gives the one way back (sparx persona issue 289).

import { PauseCircle } from 'lucide-react';
import { Button, EmptyState } from '@wizeworks/silicaui-react';

import { moduleLabel } from '../lib/surfaces/nav';
import { useManageRights } from '../lib/manage-rights';
import type { SurfaceContext, SurfaceDefinition } from '../lib/surfaces/registry';
import type { Bill } from '../surfaces/finance/bill-data';
import { pausedWords } from '../surfaces/finance/subscription-words';

/** Where a card is added. */
const BILL_SURFACE = 'finance.subscription';

export function SurfaceModulePaused({
  definition,
  bill,
  ctx,
}: {
  definition: SurfaceDefinition;
  bill: Bill;
  ctx: SurfaceContext;
}) {
  const rights = useManageRights();
  const canPay = !rights.known || rights.canManage;
  const words = pausedWords(bill, moduleLabel(definition.module), canPay);

  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-1 px-6 py-10">
      <EmptyState
        // Warning, like the banner above it: the business can fix this in a
        // minute, and nothing is broken or gone.
        icon={
          <span className="text-warning">
            <PauseCircle className="size-6" aria-hidden />
          </span>
        }
        title={words.title}
        description={words.description}
        actions={
          canPay ? (
            <Button
              size="sm"
              color="warning"
              onClick={() => {
                ctx.open(BILL_SURFACE, {}, { target: 'beside' });
              }}
            >
              Add payment method
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
