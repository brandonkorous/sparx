// WHAT AN EMPTY DROPSHIP SCREEN MEANS.
//
// Two of the three Dropshipping panes described a business that routes orders to
// suppliers, to owners who have not connected a supplier at all.
//
// Supplier orders said, always:
//
//     No supplier orders yet
//     When a customer buys a product one of your suppliers ships, the order is
//     routed to that supplier and appears here with its tracking. Nothing has
//     been routed yet.
//
// And Profitability said, always:
//
//     No dropship sales in this period
//     Once customers buy products your suppliers ship, this fills with your
//     profit, your margin, and how each supplier is doing. Try a longer period
//     above, or check back after your next sale.
//
// "one of your suppliers" and "your next sale" both assume a supplier exists.
// **11 of the 12 businesses with Dropshipping switched on have connected none**,
// so for almost every reader the sentence describes somebody else's shop. The
// profitability advice is worse than vague: BOTH remedies it offers are dead
// ends. A longer period cannot contain a sale that no supplier could have
// shipped, and "check back after your next sale" waits for something that can
// never arrive. One outcome, two causes, and the message only ever names the
// cause with the easy fix ([[feedback_one_outcome_two_causes]]).
//
// The sibling pane on the same module, Supplier products, already had the right
// shape: it counts suppliers, branches, and offers the button that fixes it.
// Two of three renderers, as usual ([[feedback_a_fix_leaves_its_neighbour_behind]]).
//
// Branches rather than a ternary inside a sentence, so singular and plural each
// get their own words.

// ── THE OTHER HALF, FOUND A DAY LATER ───────────────────────────────
//
// The sentences above were true and still read as wrong, because THE WORD
// MEANS TWO THINGS IN THIS CONSOLE. Juniper Row has two suppliers, Ashcombe
// Mills and Fairfield Trims, whose bills she pays. She has no ship-direct
// supplier. So "You have not connected a supplier yet" is contradicted by her
// own Suppliers screen, one row up in the same app.
//
// Measured: 2 rows in `inventory_suppliers`, 0 in `dropship_suppliers`.
//
// The navigation had already solved exactly this and said so:
//
//     The dropship module and the inventory module BOTH have a screen called
//     Suppliers, and Piggles' Partners app shows them side by side — two rows,
//     one word, two entirely different lists. So the dropship one is named by
//     what makes it different: these are the suppliers who post the parcel
//     straight to your customer.
//
// Renamed the screen, left the sentences. So the zero case now says what KIND
// of arrangement is missing, in the same terms the navigation uses, and says
// out loud that it is not the same thing as the suppliers she buys from.
//
// Only the zero case. Once one is connected the context is settled and "your
// supplier" is the right, shorter word.

// ── AND THE BUTTON UNDERNEATH, FOUND ON THE CONFIRMING RELOAD ───────
//
// The sentence above the button was fixed and the button was not. It read
// "Connect a supplier", sitting directly under a paragraph whose whole job is
// to say that word means two things here. So the pane distinguished the kinds
// and then, one line lower, used the word that does not.
//
// The fix that leaves its neighbor behind, inside the fix for the fix that
// left its neighbor behind ([[feedback_a_fix_leaves_its_neighbour_behind]]).
//
// So the label is not a boolean any more. `connect` is the label itself, or
// null when there is nothing to connect: a pane cannot decide to show the
// button without holding the words that go on it.
//
// Only the three zero-state buttons. Inside the Ship-direct suppliers screen
// the heading has already settled the word, and "Connect a supplier" is the
// better, shorter writing there.

export interface DropshipEmpty {
  title: string;
  detail: string;
  /**
   * The words on the button that fixes this, or null when there is no button.
   *
   * A label rather than a flag so the three panes cannot word it differently,
   * and so a pane that decides to show the button is already holding the text.
   */
  connect: string | null;
}

/** The supplier-orders list, with nothing in it. */
export function supplierOrdersEmptyWords(supplierCount: number, filtered: boolean): DropshipEmpty {
  if (filtered) {
    return {
      title: 'No orders match those filters',
      detail: 'Try a different word, or switch the filters back to All.',
      connect: null,
    };
  }

  if (supplierCount === 0) {
    return {
      title: 'Nobody is shipping for you yet',
      detail:
        'An order lands here when a customer buys something another business posts straight to ' +
        'them for you. That is a different arrangement from the suppliers you buy from and stock ' +
        'yourself, and you have not set one up. Connect one, import the products you want to ' +
        'sell, and their orders land here with the tracking.',
      connect: 'Connect a ship-direct supplier',
    };
  }

  if (supplierCount === 1) {
    return {
      title: 'No supplier orders yet',
      detail:
        'When a customer buys a product your supplier ships, the order is routed to them and ' +
        'appears here with its tracking. Nothing has been routed yet.',
      connect: null,
    };
  }

  return {
    title: 'No supplier orders yet',
    detail:
      'When a customer buys a product one of your suppliers ships, the order is routed to that ' +
      'supplier and appears here with its tracking. Nothing has been routed yet.',
    connect: null,
  };
}

/** The profitability report, with no settled orders in the chosen period. */
export function dropshipProfitEmptyWords(supplierCount: number): DropshipEmpty {
  if (supplierCount === 0) {
    return {
      title: 'Nobody is shipping for you yet',
      detail:
        'This weighs what a business that ships for you charges against what your customers pay. ' +
        'That is a different arrangement from the suppliers you buy from and stock yourself, and ' +
        'you have not set one up, so there is nothing to weigh. A longer period above will not ' +
        'change that. Connect one and import a product to sell.',
      connect: 'Connect a ship-direct supplier',
    };
  }

  return {
    title: 'No dropship sales in this period',
    detail:
      'Once customers buy products your suppliers ship, this fills with your profit, your margin, ' +
      'and how each supplier is doing. Try a longer period above, or check back after your next ' +
      'sale.',
    connect: null,
  };
}

/**
 * The imported-products list, with nothing in it.
 *
 * Moved out of `products-list.tsx` to join its two siblings. It was the one
 * pane of the three that 575 found already correct, and correct only about the
 * COUNT: it branched on whether a supplier existed and offered the button. What
 * it did not do, and neither did the other two, was say which kind of supplier
 * it meant.
 */
export function supplierProductsEmptyWords(
  supplierCount: number,
  filtered: boolean
): DropshipEmpty {
  if (filtered) {
    return {
      title: 'No products match those filters',
      detail: 'Try a different word, or switch the filters back to All.',
      connect: null,
    };
  }

  if (supplierCount === 0) {
    return {
      title: 'Nobody is shipping for you yet',
      detail:
        'These are goods another business holds and posts straight to your customer. That is a ' +
        'different arrangement from the suppliers you buy from and put on your own shelves. ' +
        'Connect one that ships for you and its products appear here to import.',
      connect: 'Connect a ship-direct supplier',
    };
  }

  // Kept verbatim from the call site it came from: it already named the action
  // ("from its page"), which is the part an empty state usually leaves out.
  return {
    title: 'Nothing from this supplier yet',
    detail:
      'Sync a supplier from its page to pull its catalog in. Once it has synced, its products ' +
      'show here ready to import.',
    connect: null,
  };
}
