// What to say about a reorder line nobody can actually order.
//
// ── Why this exists ──────────────────────────────────────────────────────
//
// Drafting a purchase order needs a supplier. A line with none is on the
// worklist (it IS running low) but cannot leave it, so `useReorderSelection`
// refuses to choose it. That refusal was the whole of what the screen said: a
// tick box that does nothing when clicked, and a "No supplier yet" badge two
// columns away that reads as a label rather than as the reason the control is
// dead. Meanwhile the footer went on inviting "Choose lines to draft orders".
//
// MEASURED 2026-09-18 across every tenant: 71 of the platform's 76 triggered
// lines have no supplier linked. Threadline's entire worklist is 65 of 65.
// Juniper Row's is 1 of 1. This is not the edge of the screen's behaviour; for
// four of six tenants it is ALL of it.
//
// ── Separate from the component so it can be tested ──────────────────────
//
// The sentence changes shape three ways (all of them, some of them, one of
// them), and two of those read wrong if the singular is not handled. Same
// reason `soldUnitsLine` and `pickingRate` live beside their panes.

import { plural } from './data';

export interface UnsuppliedNote {
  title: string;
  body: string;
}

/** Where to go and what to do there. Named once so the two bodies below cannot
 *  drift apart, and because it is the only actionable half of either. */
const HOW_TO_FIX =
  'Open the supplier under Suppliers and add the item under “What you buy from this supplier”.';

/**
 * The notice for a worklist carrying lines that cannot become an order.
 *
 * `unsupplied` and `total` are both counted over the WHOLE narrowed list by the
 * server, never over the page in hand — a page is a window, and "3 of these"
 * about a window holding three of sixty-five is worse than saying nothing.
 *
 * Returns `null` when there is nothing to say, so the caller is one check.
 */
export function unsuppliedNote(
  unsupplied: number | undefined,
  total: number | undefined
): UnsuppliedNote | null {
  if (unsupplied === undefined || unsupplied <= 0) return null;
  if (total === undefined || total <= 0) return null;

  // Every line on the list. The screen can still tell her what is running low,
  // and should say plainly that it can do nothing else, rather than leaving her
  // to work it out from a tick box that will not tick.
  if (unsupplied >= total) {
    return {
      title: total === 1 ? 'This one cannot be ordered yet' : 'None of these can be ordered yet',
      body: `Drafting an order needs to know who you buy from, and no supplier is linked to ${
        total === 1 ? 'this item' : 'any of these items'
      }. ${HOW_TO_FIX} Until then this list can tell you what is running low, but it cannot turn it into an order.`,
    };
  }

  const rest = total - unsupplied;
  return {
    title: `${plural(unsupplied, 'of these needs', 'of these need')} a supplier first`,
    body: `Drafting an order needs to know who you buy from, and no supplier is linked to ${
      unsupplied === 1 ? 'one of them' : `${String(unsupplied)} of them`
    }, so ${unsupplied === 1 ? 'its' : 'their'} tick ${
      unsupplied === 1 ? 'box stays' : 'boxes stay'
    } off. ${HOW_TO_FIX} The other ${plural(rest, 'line', 'lines')} can be chosen and drafted as normal.`,
  };
}

/**
 * The footer's modifier hint, which used to open with "Choose lines to draft
 * orders" whether or not a single line on the page could be chosen.
 *
 * A sentence telling somebody to do what the screen will not let them do is the
 * same defect as a sentence sending them somewhere with nothing there.
 */
export function reorderHint(selectableOnPage: number): string {
  const rest = 'click a row to see how its figures were worked out · shift-click alongside';
  if (selectableOnPage === 0) return rest.charAt(0).toUpperCase() + rest.slice(1);
  return `Choose lines to draft orders · ${rest}`;
}

/* ── Ordering the same thing twice ───────────────────────────────────────── */

/**
 * What to add to the confirm dialog when some of the chosen lines already have
 * stock coming.
 *
 * Found as P03 on Juniper Row: she drafted PO-000003 for 12 of a shirt, the row
 * updated itself to say **"12 already on the way"**, and the screen then let her
 * tick the same line and draft PO-000004 for 12 more, with nothing anywhere
 * saying so. It would have gone to 36 and 48 the same way.
 *
 * The automatic reorder path in the same service file has always refused this
 * (`skipped_already_drafted`). The screen a person uses had no such guard.
 * [[feedback_a_fix_leaves_its_neighbour_behind]]
 *
 * It WARNS rather than refuses. A buyer may genuinely want more — demand jumped,
 * or the open order is one they mean to cancel — and this is the moment they are
 * deciding, which is where the fact belongs. Returns `null` when there is
 * nothing to say.
 */
export function alreadyComingLine(rows: { onOrder: number }[]): string | null {
  const coming = rows.filter((r) => r.onOrder > 0);
  if (coming.length === 0) return null;
  const units = coming.reduce((sum, r) => sum + r.onOrder, 0);
  const which = coming.length === 1 ? 'One of these' : `${String(coming.length)} of these`;
  return `${which} already ${coming.length === 1 ? 'has' : 'have'} stock on the way: ${plural(
    units,
    'unit',
    'units'
  )} on an order you have not received yet. Drafting now asks for that much again, on top of what is coming.`;
}

/** One order the drafting produced, as the toast needs to describe it. */
export interface DraftedOrder {
  number: string;
  /** True when the lines joined a draft that was already open, rather than
   *  starting a new order. */
  appended: boolean;
}

/**
 * What actually happened, named.
 *
 * The console used to create a NEW purchase order every time, so the toast could
 * always say "created". It now joins the draft already open for that supplier
 * and location — the rule the automatic path has always used — and "PO-000003
 * created" about an order that already existed sends a buyer looking for a new
 * row that is not there. [[feedback_a_promise_in_copy_is_a_contract]]
 */
export function draftedOutcome(orders: DraftedOrder[]): { title: string; description: string } {
  const numbers = orders.map((o) => o.number).join(', ');
  const where = numbers === '' ? '' : `${numbers}. `;
  const madeCount = orders.filter((o) => !o.appended).length;
  const joinedCount = orders.length - madeCount;

  if (joinedCount === 0) {
    return {
      title: `${plural(orders.length, 'draft order', 'draft orders')} created`,
      description: `${where}Find them under Orders to suppliers to review and send.`,
    };
  }
  if (madeCount === 0) {
    return {
      title:
        orders.length === 1
          ? 'Added to a draft order you already had'
          : 'Added to draft orders you already had',
      description: `${where}Nothing new was created: ${
        orders.length === 1
          ? 'that supplier already had an order open'
          : 'those suppliers already had orders open'
      } for this location. Find ${orders.length === 1 ? 'it' : 'them'} under Orders to suppliers.`,
    };
  }
  return {
    title: `${plural(orders.length, 'draft order', 'draft orders')} updated`,
    description: `${where}${String(madeCount)} new, and ${String(
      joinedCount
    )} added to an order that was already open. Find them under Orders to suppliers.`,
  };
}
