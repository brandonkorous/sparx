'use client';

// A recall, said on the screen that says how many you can sell.
//
// ── What was measured ────────────────────────────────────────────────────
//
// A batch of BRASS-BELT-1 was put under recall, with a reason, at 15:44. The
// item's stock pane, opened from the recall itself one click later, read
// **60 to sell · 60 on the shelf** and said nothing at all. Two of that sixty
// must not leave the building, and the only screen that names the number a
// person sells against did not know.
//
// The recall was not lost — it is on the batch, in the ledger, in the audit log,
// and `resolveFefoLot` already refuses to hand a recalled batch to a picker. It
// simply never reached the place the decision gets made.
// [[feedback_fetched_but_never_rendered]]
//
// ── Why a band and not a badge ───────────────────────────────────────────
//
// Same reason as the uncounted band next door: a badge is something you have to
// already be looking for, and the whole defect is not knowing. This is also why
// it names the batch codes rather than only counting them — somebody standing at
// a shelf needs the code that is printed on the box.
//
// ── What it deliberately does NOT claim ──────────────────────────────────
//
// It does not say the stock is held back, because it is not. Stock is counted
// per (item × location); a batch is traceability sitting alongside it. A
// location that picks by expiry date will skip a recalled batch, and one that
// does not will hand it over like any other. Saying "these are blocked" would be
// the comfortable sentence and the false one.
// [[feedback_never_present_absence_as_measurement]]

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural } from './data';
import { useLots, type LotRow } from './lots-data';

/** At most this many codes are named before the sentence gives up and counts. */
const NAMED = 3;

export function StockRecalledBand({ ctx, variantId }: { ctx: SurfaceContext; variantId: string }) {
  // Only the OPEN ones. A cleared recall is history the batch keeps; repeating
  // it here would put a red band on a shelf that is fine.
  const active = useLots({ variantId, recallStatus: 'active', take: 50, skip: 0 });
  const pending = useLots({ variantId, recallStatus: 'pending', take: 50, skip: 0 });

  const lots = [...(active.data?.items ?? []), ...(pending.data?.items ?? [])];
  if (lots.length === 0) return null;

  const units = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const codes = lots.slice(0, NAMED).map((lot) => lot.lotNumber);
  const rest = lots.length - codes.length;

  // One batch is the ordinary case and has somewhere to send them: the batch
  // itself, where the reason is written down. Several have no single
  // destination, so the button goes to the list rather than guessing one.
  const only: LotRow | undefined = lots.length === 1 ? lots[0] : undefined;

  return (
    <Alert color="danger" variant="soft">
      <AlertContent>
        <AlertTitle>
          {lots.length === 1
            ? `A batch of this is recalled: ${codes[0] ?? ''}`
            : `${plural(lots.length, 'batch', 'batches')} of this are recalled`}
        </AlertTitle>
        <AlertDescription>
          {lots.length === 1
            ? `${plural(lots[0]?.quantity ?? 0, 'unit', 'units')} came in on it. `
            : `${plural(units, 'unit', 'units')} came in on ${codes.join(', ')}${rest > 0 ? ` and ${plural(rest, 'other', 'others')}` : ''}. `}
          Those units are still counted in the numbers above, because a count is per place and a
          batch is not: nothing here has been held back. A location that picks by expiry date will
          skip a recalled batch; one that does not will hand it over like any other. Check the code
          on the box before anything goes out.
        </AlertDescription>
      </AlertContent>
      <Button
        size="sm"
        color="danger"
        variant="soft"
        onClick={(event) => {
          if (only) {
            ctx.open(
              'inventory.lots.detail',
              { id: only.id },
              { target: event.shiftKey ? 'beside' : 'tab' }
            );
            return;
          }
          ctx.open('inventory.lots.list', undefined, { target: event.shiftKey ? 'beside' : 'tab' });
        }}
      >
        {only ? 'Open the batch' : 'Open the batches'}
      </Button>
    </Alert>
  );
}
