'use client';

// The one place a money figure admits a gap AND offers to close it.
//
// "No cost yet" on its own is honest and useless: it tells somebody their
// valuation is not a valuation without telling them what to do, and the thing to
// do is not on any screen they would think to look at. This is the door.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural } from './data';
import { costCoverage } from './reports-shared';

/** "1 unit has" / "354 units have". The verb has to agree or the sentence reads
 *  as broken English on the one panel that exists to be believed. */
function unitsPhrase(units: number): string {
  return `${plural(units, 'unit', 'units')} ${units === 1 ? 'has' : 'have'} no cost recorded`;
}

export function UncostedNotice({
  ctx,
  valuation,
}: {
  ctx: SurfaceContext;
  valuation: { totalUnits: number; totalCostCents: number; uncostedUnits: number };
}) {
  const cover = costCoverage(valuation);
  if (!cover.none && !cover.partial) return null;

  return (
    <Alert color={cover.none ? 'warning' : 'info'}>
      <AlertContent>
        <AlertTitle>
          {cover.none ? 'Nothing you hold has a cost recorded' : unitsPhrase(cover.uncostedUnits)}
        </AlertTitle>
        <AlertDescription>
          {cover.none
            ? 'Every figure on this page about what your stock is worth needs it, which is why they say “No cost yet” instead of a number. Put in what you paid and they all become real.'
            : 'The figures above are real but short by whatever those cost. They are usually stock that was on the shelf before you started recording deliveries.'}
        </AlertDescription>
        <Button
          size="sm"
          color="module"
          className="mt-3 self-start"
          onClick={() => {
            ctx.open('inventory.costing.uncosted', {}, { target: 'tab' });
          }}
        >
          Put in what they cost
        </Button>
      </AlertContent>
    </Alert>
  );
}
