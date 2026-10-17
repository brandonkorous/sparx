// Which modules are paused because the bill is not being paid (docs/17 §6).
//
// When the free trial ends with no card, or a paid renewal fails, the business
// enters `grace`: its public site stays live for seven days, and the PAID modules
// pause in the console until a card is added. Past grace (`suspended`) the site
// goes dark too, and the modules stay paused. Nothing is deleted at any step.
//
// The banner had said "paid features are paused" for as long as the ladder
// existed, and nothing paused: every pane went on working (sparx persona issue
// 289). This is the one rule both read.
//
// "Paid" means exactly the lines on the bill. A module that is free (Social,
// Campaigns) or included with another (Inventory and Invoicing with the Online
// store) is not a line, so it is not paused. A business on a custom plan is
// `exempt` and never reaches grace.

import type { Bill } from '../../surfaces/finance/bill-data';

/** Is this business in a phase where its paid modules pause? */
export function billPaused(bill: Pick<Bill, 'billing'>): boolean {
  return bill.billing.phase === 'grace' || bill.billing.phase === 'suspended';
}

/** The modules paused right now: empty unless the bill is lapsed. */
export function pausedModules(bill: Pick<Bill, 'billing' | 'planModules'>): ReadonlySet<string> {
  if (!billPaused(bill)) return new Set();
  return new Set(bill.planModules.map((line) => line.moduleKey));
}

/** Screens that never pause, whatever module they sit in. The bill is where the
 *  card is added: pausing it with Finance would lock the only way back. */
const NEVER_PAUSED = new Set(['finance.subscription']);

/** Is this one module paused? `undefined` (the bill not loaded yet) is never paused:
 *  a slow read must show the work, not accuse the business of not paying. Pass the
 *  screen too, so the bill itself stays open. */
export function moduleIsPaused(
  bill: Pick<Bill, 'billing' | 'planModules'> | undefined,
  module: string,
  surface?: string
): boolean {
  if (!bill || (surface && NEVER_PAUSED.has(surface))) return false;
  return pausedModules(bill).has(module);
}
